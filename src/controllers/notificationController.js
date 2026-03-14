const { pool } = require('../config/db');
const webpush = require('web-push');

// Configuration des notifications push
const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;

webpush.setVapidDetails(
  'mailto:admin@rencontreauthentique.org',
  publicVapidKey,
  privateVapidKey
);

// Stockage des abonnements (en mémoire - à remplacer par une table en production)
let subscriptions = {};

// Créer une notification
const createNotification = async (userId, type, senderId, postId, content) => {
  try {
    const [result] = await pool.execute(
      `INSERT INTO notifications (userId, type, senderId, postId, content) 
       VALUES (?, ?, ?, ?, ?)`,
      [userId, type, senderId, postId, content]
    );
    return result.insertId;
  } catch (error) {
    console.error('❌ Erreur création notification:', error);
    throw error;
  }
};

// Récupérer les notifications non lues
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

// Marquer une notification comme lue
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

// Envoyer une notification push
const sendPushNotification = async (userId, title, body, url) => {
  if (!subscriptions[userId]) return;
  
  const payload = JSON.stringify({ title, body, url });
  
  subscriptions[userId].forEach(async (subscription) => {
    try {
      await webpush.sendNotification(subscription, payload);
    } catch (error) {
      console.error('❌ Erreur envoi push:', error);
      subscriptions[userId] = subscriptions[userId].filter(
        s => s.endpoint !== subscription.endpoint
      );
    }
  });
};

// S'abonner aux notifications push
const subscribe = async (req, res) => {
  try {
    const { subscription } = req.body;
    const userId = req.user.id;
    
    if (!subscriptions[userId]) {
      subscriptions[userId] = [];
    }
    subscriptions[userId].push(subscription);
    
    res.status(201).json({ message: 'Abonnement réussi' });
  } catch (error) {
    console.error('❌ Erreur subscription:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Désabonner
const unsubscribe = async (req, res) => {
  try {
    const { subscription } = req.body;
    const userId = req.user.id;
    
    if (subscriptions[userId]) {
      subscriptions[userId] = subscriptions[userId].filter(
        s => s.endpoint !== subscription.endpoint
      );
    }
    
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
  sendPushNotification,
  subscribe,
  unsubscribe
};