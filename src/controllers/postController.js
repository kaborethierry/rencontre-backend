// src/controllers/postController.js
const { pool } = require('../config/db');
const notificationController = require('./notificationController');

// Créer une publication (en attente d'approbation)
const createPost = async (req, res) => {
  try {
    const { content } = req.body;
    
    // Par défaut, les posts sont en attente d'approbation
    const isApproved = req.user.role === 'admin' ? 1 : 0;
    
    const [result] = await pool.execute(
      'INSERT INTO posts (userId, content, isApproved) VALUES (?, ?, ?)',
      [req.user.id, content, isApproved]
    );

    // Récupérer le post créé
    const [posts] = await pool.execute(
      `SELECT p.*, u.nom, u.prenom, u.photo 
       FROM posts p
       JOIN users u ON p.userId = u.id
       WHERE p.id = ?`,
      [result.insertId]
    );

    // Si ce n'est pas un admin, notifier les admins
    if (!isApproved) {
      const [admins] = await pool.execute(
        'SELECT id FROM users WHERE role = "admin"'
      );
      
      for (const admin of admins) {
        // Créer une notification dans la base
        await notificationController.createNotification(
          admin.id,
          'post_approval',
          req.user.id,
          result.insertId,
          `Nouvelle publication en attente de ${req.user.prenom} ${req.user.nom}`
        );
        
        // Envoyer une notification push
        await notificationController.sendPushNotification(
          admin.id,
          '📝 Nouvelle publication à approuver',
          `${req.user.prenom} ${req.user.nom} a publié un message`,
          '/admin?tab=posts'
        );
      }
    }

    res.status(201).json(posts[0]);
  } catch (error) {
    console.error('❌ Erreur createPost:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Récupérer UNIQUEMENT les publications approuvées (feed public)
const getPosts = async (req, res) => {
  try {
    const [posts] = await pool.execute(
      `SELECT 
        p.id, p.content, p.createdAt,
        u.id as userId, u.nom, u.prenom, u.photo, u.age, u.ville, u.religion,
        (SELECT COUNT(*) FROM likes WHERE postId = p.id) as likesCount,
        (SELECT JSON_ARRAYAGG(userId) FROM likes WHERE postId = p.id) as likesUsers
       FROM posts p
       JOIN users u ON p.userId = u.id
       WHERE p.isApproved = 1
       ORDER BY p.createdAt DESC`
    );

    // Parsing JSON pour les likes
    const formattedPosts = posts.map(post => ({
      ...post,
      likesUsers: post.likesUsers ? JSON.parse(post.likesUsers) : [],
      comments: [] // Les commentaires seront chargés séparément
    }));

    res.json(formattedPosts);
  } catch (error) {
    console.error('❌ Erreur getPosts:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Récupérer les publications d'un utilisateur (profil public)
const getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;

    const [posts] = await pool.execute(
      `SELECT p.id, p.content, p.createdAt,
              u.id as userId, u.nom, u.prenom, u.photo
       FROM posts p
       JOIN users u ON p.userId = u.id
       WHERE p.userId = ? AND p.isApproved = 1
       ORDER BY p.createdAt DESC`,
      [userId]
    );
    res.json(posts);
  } catch (error) {
    console.error('❌ Erreur getUserPosts:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Récupérer les publications en attente (admin seulement)
const getPendingPosts = async (req, res) => {
  try {
    const [posts] = await pool.execute(
      `SELECT p.*, u.nom, u.prenom, u.photo, u.age, u.ville, u.religion
       FROM posts p
       JOIN users u ON p.userId = u.id
       WHERE p.isApproved = 0
       ORDER BY p.createdAt DESC`,
      []
    );
    res.json(posts);
  } catch (error) {
    console.error('❌ Erreur getPendingPosts:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Approuver une publication (admin seulement)
const approvePost = async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.execute(
      'UPDATE posts SET isApproved = 1 WHERE id = ?',
      [id]
    );
    
    // Récupérer les infos du post
    const [posts] = await pool.execute(
      `SELECT p.*, u.nom, u.prenom, u.email, u.id as userId
       FROM posts p
       JOIN users u ON p.userId = u.id
       WHERE p.id = ?`,
      [id]
    );
    
    const post = posts[0];
    
    // Notifier l'utilisateur
    await notificationController.createNotification(
      post.userId,
      'post_approved',
      req.user.id,
      id,
      'Votre publication a été approuvée'
    );
    
    // Notification push
    await notificationController.sendPushNotification(
      post.userId,
      '✅ Publication approuvée',
      'Votre message est maintenant visible sur le feed',
      '/profile'
    );
    
    res.json({ message: 'Publication approuvée' });
  } catch (error) {
    console.error('❌ Erreur approvePost:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Supprimer une publication
const deletePost = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.execute(
      'DELETE FROM posts WHERE id = ? AND userId = ?',
      [id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Publication non trouvée' });
    }

    res.json({ message: 'Publication supprimée' });
  } catch (error) {
    console.error('❌ Erreur deletePost:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

module.exports = {
  createPost,
  getPosts,
  getUserPosts,
  getPendingPosts,
  approvePost,
  deletePost
};