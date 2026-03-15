const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const notificationController = require('../controllers/notificationController');

module.exports = (io) => {
  // Middleware d'authentification socket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentification requise'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const [users] = await pool.execute(
        'SELECT id, nom, prenom, email, photo FROM users WHERE id = ?',
        [decoded.id]
      );

      if (users.length === 0) {
        return next(new Error('Utilisateur non trouvé'));
      }

      socket.user = users[0];
      console.log(`✅ Socket authentifié: ${socket.user.prenom} ${socket.user.nom}`);
      next();
    } catch (error) {
      console.error('❌ Erreur auth socket:', error.message);
      next(new Error('Token invalide'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔵 Socket connecté: ${socket.user.prenom} ${socket.user.nom}`);

    // Rejoindre une room personnelle
    socket.join(`user:${socket.user.id}`);

    // Gérer l'envoi de messages
    socket.on('send-message', async (data) => {
      try {
        console.log('📨 Données reçues:', {
          receiverId: data.receiverId,
          type: data.type,
          hasContent: !!data.content,
          hasImage: !!data.image
        });
        
        const { receiverId, content, type = 'text', image } = data;
        
        if (!receiverId) {
          console.error('❌ receiverId manquant');
          socket.emit('message-error', { error: 'Destinataire non spécifié' });
          return;
        }

        if (!content && !image) {
          console.error('❌ Contenu manquant');
          socket.emit('message-error', { error: 'Message vide' });
          return;
        }

        console.log(`📨 Message de ${socket.user.id} vers ${receiverId}:`, type === 'image' ? '[Image]' : content);

        // Sauvegarder le message dans la DB
        const [result] = await pool.execute(
          `INSERT INTO messages (senderId, receiverId, content, image, type) 
           VALUES (?, ?, ?, ?, ?)`,
          [socket.user.id, parseInt(receiverId), content || null, image || null, type]
        );

        // Récupérer le message créé avec les infos de l'utilisateur
        const [messages] = await pool.execute(
          `SELECT m.*, u.nom, u.prenom, u.photo 
           FROM messages m
           JOIN users u ON m.senderId = u.id
           WHERE m.id = ?`,
          [result.insertId]
        );

        const message = messages[0];
        console.log('✅ Message sauvegardé ID:', message.id);

        // Émettre au destinataire (socket en temps réel)
        io.to(`user:${receiverId}`).emit('receive-message', message);

        // Émettre à l'expéditeur (confirmation)
        socket.emit('message-sent', message);

        // Gérer la conversation
        await handleConversation(socket.user.id, parseInt(receiverId), message);

        // Récupérer les informations de l'expéditeur
        const [senderInfo] = await pool.execute(
          'SELECT nom, prenom FROM users WHERE id = ?',
          [socket.user.id]
        );

        // ✅ NOTIFICATION PUSH - Envoyer via le contrôleur de notifications
        try {
          await notificationController.sendPushNotification(
            parseInt(receiverId),
            'new_message',
            type === 'image' ? '📷 Photo' : content,
            socket.user.id,
            null,
            `/chat?userId=${socket.user.id}`
          );
          console.log(`✅ Notification push envoyée à l'utilisateur ${receiverId}`);
        } catch (pushError) {
          console.error('❌ Erreur envoi notification push:', pushError);
        }

        // ✅ Notification socket (pour les utilisateurs connectés)
        io.to(`user:${receiverId}`).emit('new-notification', {
          type: 'message',
          title: `📩 Nouveau message de ${senderInfo[0].prenom}`,
          body: type === 'image' ? '📷 Photo' : content,
          senderId: socket.user.id,
          timestamp: new Date().toISOString(),
          url: `/chat?userId=${socket.user.id}`
        });

      } catch (error) {
        console.error('❌ Erreur envoi message:', error);
        
        let errorMessage = 'Erreur lors de l\'envoi du message';
        if (error.code === 'ER_DATA_TOO_LONG') {
          errorMessage = 'L\'image est trop volumineuse. Maximum 5MB.';
        }
        
        socket.emit('message-error', { error: errorMessage });
      }
    });

    // Gérer la lecture des messages
    socket.on('mark-read', async (data) => {
      try {
        const { messageIds, senderId } = data;

        if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
          return;
        }

        console.log(`📖 Marquage des messages comme lus:`, messageIds);

        const placeholders = messageIds.map(() => '?').join(',');
        
        await pool.execute(
          `UPDATE messages SET isRead = true, readAt = NOW() 
           WHERE id IN (${placeholders}) AND receiverId = ? AND senderId = ?`,
          [...messageIds, socket.user.id, senderId]
        );

        // Notifier l'expéditeur
        io.to(`user:${senderId}`).emit('messages-read', {
          messageIds,
          readerId: socket.user.id
        });

      } catch (error) {
        console.error('❌ Erreur marquage lecture:', error);
      }
    });

    // Gérer la frappe
    socket.on('typing', (data) => {
      const { receiverId, isTyping } = data;
      
      if (!receiverId) return;
      
      socket.to(`user:${receiverId}`).emit('user-typing', {
        userId: socket.user.id,
        isTyping
      });
    });

    // Déconnexion
    socket.on('disconnect', () => {
      console.log(`🔴 Socket déconnecté: ${socket.user.prenom} ${socket.user.nom}`);
    });
  });
};

// Fonction utilitaire pour gérer les conversations
async function handleConversation(user1Id, user2Id, lastMessage) {
  try {
    const [conversations] = await pool.execute(
      `SELECT id FROM conversations 
       WHERE (user1Id = ? AND user2Id = ?) OR (user1Id = ? AND user2Id = ?)`,
      [user1Id, user2Id, user2Id, user1Id]
    );

    if (conversations.length === 0) {
      await pool.execute(
        `INSERT INTO conversations (user1Id, user2Id, lastMessageId, lastMessageAt) 
         VALUES (?, ?, ?, NOW())`,
        [user1Id, user2Id, lastMessage.id]
      );
      console.log('✅ Nouvelle conversation créée');
    } else {
      await pool.execute(
        `UPDATE conversations 
         SET lastMessageId = ?, lastMessageAt = NOW() 
         WHERE id = ?`,
        [lastMessage.id, conversations[0].id]
      );
      console.log('✅ Conversation mise à jour');
    }
  } catch (error) {
    console.error('❌ Erreur gestion conversation:', error);
  }
}