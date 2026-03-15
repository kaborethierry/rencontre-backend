const { pool } = require('../config/db');
const webpush = require('web-push');

// Configuration des notifications push
const publicVapidKey = process.env.VAPID_PUBLIC_KEY || 'BPvQSeODcyM1HeCsscthJxdqTVZVZvuRcTz9r89tqJfvbN1AN2S2UaLgxjF8eET__Plbx4b18qUGH-APE3xN92o';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || 'votre_clé_privée';

webpush.setVapidDetails(
  'mailto:admin@rencontreauthentique.org',
  publicVapidKey,
  privateVapidKey
);

// ✅ Créer une notification et envoyer push
const createNotification = async (userId, type, senderId, postId, content, url = null) => {
  try {
    console.log(`📢 Création notification pour user ${userId}: ${type}`);
    
    // ✅ S'assurer que le type est valide
    const validTypes = ['like', 'comment', 'message', 'friend_request', 'post_approval', 'post_approved', 'new_message'];
    const notificationType = validTypes.includes(type) ? type : 'message';
    
    // Sauvegarder en base
    const [result] = await pool.execute(
      `INSERT INTO notifications (userId, type, senderId, postId, content, createdAt) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [userId, notificationType, senderId, postId, content]
    );

    // Envoyer notification push immédiatement
    await sendPushNotification(userId, notificationType, content, senderId, postId, url);

    return result.insertId;
  } catch (error) {
    console.error('❌ Erreur création notification:', error);
    throw error;
  }
};

// ✅ Envoyer une notification push
const sendPushNotification = async (userId, type, content, senderId, postId, url = null) => {
  try {
    // Récupérer les infos de l'expéditeur
    let senderName = 'Quelqu\'un';
    if (senderId) {
      const [sender] = await pool.execute(
        'SELECT prenom, nom FROM users WHERE id = ?',
        [senderId]
      );
      if (sender.length > 0) {
        senderName = `${sender[0].prenom} ${sender[0].nom}`;
      }
    }

    // Construire le titre selon le type
    let title = '';
    let body = content;
    
    switch (type) {
      case 'post_approval':
        title = '📝 Nouvelle publication à approuver';
        body = `${senderName} a publié un message`;
        break;
      case 'post_approved':
        title = '✅ Publication approuvée';
        body = 'Votre publication a été approuvée !';
        break;
      case 'new_message':
        title = `💬 Message de ${senderName}`;
        body = content || 'Nouveau message';
        break;
      case 'like':
        title = `❤️ ${senderName} a aimé votre publication`;
        break;
      case 'comment':
        title = `💬 ${senderName} a commenté votre publication`;
        break;
      default:
        title = '🔔 Rencontre Authentique';
    }

    // Construire les données de la notification
    const notificationData = {
      title,
      body,
      type,
      senderId,
      postId,
      url: url || (type === 'post_approval' ? '/admin?tab=posts' : '/'),
      timestamp: new Date().toISOString(),
      actions: type === 'post_approval' ? [
        { action: 'approve', title: '✅ Approuver' },
        { action: 'view', title: '👁️ Voir' }
      ] : type === 'new_message' ? [
        { action: 'reply', title: '💬 Répondre' },
        { action: 'view', title: '👁️ Voir' }
      ] : [
        { action: 'view', title: '👁️ Voir' }
      ]
    };

    console.log(`📨 Envoi push à ${userId}:`, notificationData);

    // Récupérer tous les abonnements de l'utilisateur
    const [subscriptions] = await pool.execute(
      'SELECT subscription FROM push_subscriptions WHERE userId = ?',
      [userId]
    );

    if (subscriptions.length === 0) {
      console.log(`ℹ️ Aucun abonnement push pour l'utilisateur ${userId}`);
      return;
    }

    // Envoyer à chaque abonnement
    const sendPromises = subscriptions.map(async (sub) => {
      try {
        const subscription = JSON.parse(sub.subscription);
        await webpush.sendNotification(subscription, JSON.stringify(notificationData));
        console.log(`✅ Push envoyé à ${userId}`);
      } catch (error) {
        console.error(`❌ Erreur envoi push à ${userId}:`, error.message);
        
        // Si l'abonnement est invalide, le supprimer
        if (error.statusCode === 410) { // Gone - abonnement expiré
          await pool.execute(
            'DELETE FROM push_subscriptions WHERE userId = ? AND subscription = ?',
            [userId, sub.subscription]
          );
        }
      }
    });

    await Promise.allSettled(sendPromises);

  } catch (error) {
    console.error('❌ Erreur sendPushNotification:', error);
  }
};

// ✅ Récupérer les notifications non lues
const getUnreadNotifications = async (req, res) => {
  try {
    const [notifications] = await pool.execute(
      `SELECT n.*, 
              u.nom as senderNom, u.prenom as senderPrenom, u.photo as senderPhoto
       FROM notifications n
       LEFT JOIN users u ON n.senderId = u.id
       WHERE n.userId = ? AND n.isRead = 0
       ORDER BY n.createdAt DESC`,
      [req.user.id]
    );
    res.json(notifications);
  } catch (error) {
    console.error('❌ Erreur getUnreadNotifications:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ✅ Marquer une notification comme lue
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute(
      'UPDATE notifications SET isRead = 1 WHERE id = ? AND userId = ?',
      [id, req.user.id]
    );
    res.json({ message: 'Notification marquée comme lue' });
  } catch (error) {
    console.error('❌ Erreur markAsRead:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ✅ Marquer toutes les notifications comme lues
const markAllAsRead = async (req, res) => {
  try {
    await pool.execute(
      'UPDATE notifications SET isRead = 1 WHERE userId = ? AND isRead = 0',
      [req.user.id]
    );
    res.json({ message: 'Toutes les notifications marquées comme lues' });
  } catch (error) {
    console.error('❌ Erreur markAllAsRead:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ✅ S'abonner aux notifications push
const subscribe = async (req, res) => {
  try {
    const { subscription } = req.body;
    const userId = req.user.id;
    
    console.log(`📱 Nouvel abonnement push pour user ${userId}`);

    // Vérifier si l'abonnement existe déjà
    const [existing] = await pool.execute(
      'SELECT id FROM push_subscriptions WHERE userId = ? AND subscription = ?',
      [userId, JSON.stringify(subscription)]
    );

    if (existing.length === 0) {
      // Sauvegarder en base
      await pool.execute(
        'INSERT INTO push_subscriptions (userId, subscription, createdAt) VALUES (?, ?, NOW())',
        [userId, JSON.stringify(subscription)]
      );
    }

    // Envoyer une notification de test
    await sendPushNotification(
      userId, 
      'welcome', 
      'Notifications activées avec succès !', 
      userId, 
      null, 
      '/'
    );

    res.status(201).json({ message: 'Abonnement réussi' });
  } catch (error) {
    console.error('❌ Erreur subscription:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ✅ Se désabonner
const unsubscribe = async (req, res) => {
  try {
    const { subscription } = req.body;
    const userId = req.user.id;
    
    await pool.execute(
      'DELETE FROM push_subscriptions WHERE userId = ? AND subscription = ?',
      [userId, JSON.stringify(subscription)]
    );
    
    res.json({ message: 'Désabonnement réussi' });
  } catch (error) {
    console.error('❌ Erreur unsubscribe:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

module.exports = {
  createNotification,
  getUnreadNotifications,
  markAsRead,
  markAllAsRead,
  sendPushNotification,
  subscribe,
  unsubscribe
};