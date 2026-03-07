const { pool } = require('../config/db');

// Récupérer toutes les conversations de l'utilisateur
const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    const [conversations] = await pool.execute(
      `SELECT c.*, 
        lm.content as lastMessageContent,
        lm.type as lastMessageType,
        lm.createdAt as lastMessageTime,
        lm.senderId as lastMessageSenderId,
        lm.isRead as lastMessageIsRead,
        u1.id as user1Id,
        u1.nom as user1Nom,
        u1.prenom as user1Prenom,
        u1.photo as user1Photo,
        u2.id as user2Id,
        u2.nom as user2Nom,
        u2.prenom as user2Prenom,
        u2.photo as user2Photo
       FROM conversations c
       LEFT JOIN messages lm ON c.lastMessageId = lm.id
       LEFT JOIN users u1 ON c.user1Id = u1.id
       LEFT JOIN users u2 ON c.user2Id = u2.id
       WHERE c.user1Id = ? OR c.user2Id = ?
       ORDER BY c.lastMessageAt DESC`,
      [userId, userId]
    );

    // Formater les conversations
    const formattedConversations = conversations.map(conv => {
      const lastMessage = conv.lastMessageId ? {
        id: conv.lastMessageId,
        content: conv.lastMessageContent,
        type: conv.lastMessageType,
        createdAt: conv.lastMessageTime,
        senderId: conv.lastMessageSenderId,
        isRead: conv.lastMessageIsRead
      } : null;

      return {
        id: conv.id,
        user1Id: conv.user1Id,
        user2Id: conv.user2Id,
        lastMessage,
        lastMessageAt: conv.lastMessageAt,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt
      };
    });

    res.json(formattedConversations);
  } catch (error) {
    console.error('❌ Erreur getConversations:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Récupérer les messages d'une conversation
const getMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const { userId: otherUserId } = req.params;

    if (!otherUserId) {
      return res.status(400).json({ message: 'ID du destinataire requis' });
    }

    const [messages] = await pool.execute(
      `SELECT m.*, u.nom, u.prenom, u.photo
       FROM messages m
       JOIN users u ON m.senderId = u.id
       WHERE (m.senderId = ? AND m.receiverId = ?) 
          OR (m.senderId = ? AND m.receiverId = ?)
       ORDER BY m.createdAt ASC`,
      [userId, parseInt(otherUserId), parseInt(otherUserId), userId]
    );

    // Marquer les messages comme lus
    if (messages.length > 0) {
      await pool.execute(
        `UPDATE messages SET isRead = true, readAt = NOW() 
         WHERE receiverId = ? AND senderId = ? AND isRead = false`,
        [userId, parseInt(otherUserId)]
      );
    }

    res.json(messages);
  } catch (error) {
    console.error('❌ Erreur getMessages:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Envoyer un message (route HTTP alternative)
const sendMessage = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiverId, content, type = 'text', image } = req.body;

    if (!receiverId) {
      return res.status(400).json({ message: 'ID du destinataire requis' });
    }

    // Insérer le message
    const [result] = await pool.execute(
      `INSERT INTO messages (senderId, receiverId, content, image, type) 
       VALUES (?, ?, ?, ?, ?)`,
      [senderId, parseInt(receiverId), content, image, type]
    );

    // Récupérer le message créé
    const [messages] = await pool.execute(
      `SELECT m.*, u.nom, u.prenom, u.photo 
       FROM messages m
       JOIN users u ON m.senderId = u.id
       WHERE m.id = ?`,
      [result.insertId]
    );

    const message = messages[0];

    // Gérer la conversation
    await handleConversation(senderId, parseInt(receiverId), message);

    // Créer une notification
    await createNotification(receiverId, senderId, 'message', null, message.content);

    res.status(201).json(message);
  } catch (error) {
    console.error('❌ Erreur sendMessage:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Marquer les messages comme lus
const markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { messageIds, senderId } = req.body;

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ message: 'Liste des messages requise' });
    }

    if (!senderId) {
      return res.status(400).json({ message: 'ID de l\'expéditeur requis' });
    }

    // Créer la chaîne de placeholders
    const placeholders = messageIds.map(() => '?').join(',');
    
    await pool.execute(
      `UPDATE messages SET isRead = true, readAt = NOW() 
       WHERE id IN (${placeholders}) AND receiverId = ? AND senderId = ?`,
      [...messageIds, userId, senderId]
    );

    res.json({ message: 'Messages marqués comme lus' });
  } catch (error) {
    console.error('❌ Erreur markAsRead:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Supprimer une conversation
const deleteConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Vérifier que la conversation appartient à l'utilisateur
    const [conversations] = await pool.execute(
      `SELECT id FROM conversations 
       WHERE id = ? AND (user1Id = ? OR user2Id = ?)`,
      [id, userId, userId]
    );

    if (conversations.length === 0) {
      return res.status(404).json({ message: 'Conversation non trouvée' });
    }

    // Supprimer la conversation
    await pool.execute('DELETE FROM conversations WHERE id = ?', [id]);

    res.json({ message: 'Conversation supprimée' });
  } catch (error) {
    console.error('❌ Erreur deleteConversation:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Récupérer le nombre de messages non lus
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const [result] = await pool.execute(
      `SELECT COUNT(*) as count FROM messages 
       WHERE receiverId = ? AND isRead = false`,
      [userId]
    );

    res.json({ count: result[0].count });
  } catch (error) {
    console.error('❌ Erreur getUnreadCount:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Fonctions utilitaires (exportées séparément pour être utilisées dans socketService)
async function handleConversation(user1Id, user2Id, lastMessage) {
  try {
    // Vérifier si la conversation existe
    const [conversations] = await pool.execute(
      `SELECT id FROM conversations 
       WHERE (user1Id = ? AND user2Id = ?) OR (user1Id = ? AND user2Id = ?)`,
      [user1Id, user2Id, user2Id, user1Id]
    );

    if (conversations.length === 0) {
      // Créer nouvelle conversation
      await pool.execute(
        `INSERT INTO conversations (user1Id, user2Id, lastMessageId, lastMessageAt) 
         VALUES (?, ?, ?, NOW())`,
        [user1Id, user2Id, lastMessage.id]
      );
    } else {
      // Mettre à jour conversation existante
      await pool.execute(
        `UPDATE conversations 
         SET lastMessageId = ?, lastMessageAt = NOW() 
         WHERE id = ?`,
        [lastMessage.id, conversations[0].id]
      );
    }
  } catch (error) {
    console.error('❌ Erreur gestion conversation:', error);
    throw error;
  }
}

async function createNotification(userId, senderId, type, postId, content) {
  try {
    await pool.execute(
      `INSERT INTO notifications (userId, type, senderId, postId, content) 
       VALUES (?, ?, ?, ?, ?)`,
      [userId, type, senderId, postId, content]
    );
  } catch (error) {
    console.error('❌ Erreur création notification:', error);
    throw error;
  }
}

module.exports = {
  getConversations,
  getMessages,
  sendMessage,
  markAsRead,
  deleteConversation,
  getUnreadCount,
  // Exporter les fonctions utilitaires pour socketService
  handleConversation,
  createNotification
};