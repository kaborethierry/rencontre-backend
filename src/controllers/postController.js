const { pool } = require('../config/db');
const notificationController = require('./notificationController');

// Créer une publication (en attente d'approbation)
const createPost = async (req, res) => {
  try {
    const { content } = req.body;
    
    // ✅ CORRECTION: Par défaut, les posts sont en attente (isApproved = 0)
    // Seuls les admins ont leurs posts directement approuvés
    const isApproved = req.user.role === 'admin' ? 1 : 0;
    
    console.log(`Création d'un post pour user ${req.user.id}, approuvé: ${isApproved}`);
    
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

    const newPost = posts[0];

    // ✅ CORRECTION: Si ce n'est pas un admin, notifier les admins
    if (!isApproved) {
      console.log("Post en attente, notification aux admins");
      
      const [admins] = await pool.execute(
        'SELECT id FROM users WHERE role = "admin"'
      );
      
      for (const admin of admins) {
        try {
          await notificationController.createNotification(
            admin.id,
            'post_approval',
            req.user.id,
            result.insertId,
            `Nouvelle publication en attente de ${req.user.prenom} ${req.user.nom}`
          );
          
          await notificationController.sendPushNotification(
            admin.id,
            '📝 Nouvelle publication à approuver',
            `${req.user.prenom} ${req.user.nom} a publié un message`,
            '/admin?tab=posts'
          );
        } catch (notifError) {
          console.error("Erreur envoi notification admin:", notifError);
        }
      }
    }

    res.status(201).json(newPost);
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
        p.id, p.content, p.createdAt, p.isApproved,
        u.id as userId, u.nom, u.prenom, u.photo, u.age, u.ville, u.religion,
        (SELECT COUNT(*) FROM likes WHERE postId = p.id) as likesCount,
        (SELECT JSON_ARRAYAGG(userId) FROM likes WHERE postId = p.id) as likesUsers
       FROM posts p
       JOIN users u ON p.userId = u.id
       WHERE p.isApproved = 1
       ORDER BY p.createdAt DESC`
    );

    const formattedPosts = posts.map(post => ({
      ...post,
      likesUsers: post.likesUsers ? JSON.parse(post.likesUsers) : [],
      comments: []
    }));

    res.json(formattedPosts);
  } catch (error) {
    console.error('❌ Erreur getPosts:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ✅ CORRECTION: Récupérer les publications d'un utilisateur (AVEC LEUR STATUT)
const getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?.id;

    console.log(`Chargement des posts pour l'utilisateur ${userId}`);

    const [posts] = await pool.execute(
      `SELECT p.id, p.content, p.createdAt, p.isApproved,
              u.id as userId, u.nom, u.prenom, u.photo
       FROM posts p
       JOIN users u ON p.userId = u.id
       WHERE p.userId = ?
       ORDER BY p.createdAt DESC`,
      [userId]
    );
    
    console.log(`${posts.length} posts trouvés pour l'utilisateur ${userId}`);
    
    // ✅ CORRECTION: Ajouter le statut explicite pour chaque post
    const postsWithStatus = posts.map(post => ({
      ...post,
      status: post.isApproved === 1 ? 'approved' : 'pending'
    }));

    res.json(postsWithStatus);
  } catch (error) {
    console.error('❌ Erreur getUserPosts:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Récupérer les publications en attente (admin seulement)
const getPendingPosts = async (req, res) => {
  try {
    console.log("Récupération des posts en attente...");
    
    const [posts] = await pool.execute(
      `SELECT p.*, u.nom, u.prenom, u.photo, u.age, u.ville, u.religion
       FROM posts p
       JOIN users u ON p.userId = u.id
       WHERE p.isApproved = 0
       ORDER BY p.createdAt DESC`
    );
    
    console.log(`${posts.length} posts en attente trouvés`);
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
    
    console.log(`Approbation du post ${id}`);
    
    // ✅ CORRECTION: Mettre isApproved à 1
    await pool.execute(
      'UPDATE posts SET isApproved = 1 WHERE id = ?',
      [id]
    );
    
    // Récupérer les infos du post pour notification
    const [posts] = await pool.execute(
      `SELECT p.*, u.nom, u.prenom, u.email, u.id as userId
       FROM posts p
       JOIN users u ON p.userId = u.id
       WHERE p.id = ?`,
      [id]
    );
    
    if (posts.length > 0) {
      const post = posts[0];
      
      // Notifier l'utilisateur
      try {
        await notificationController.createNotification(
          post.userId,
          'post_approved',
          req.user.id,
          id,
          'Votre publication a été approuvée'
        );
        
        await notificationController.sendPushNotification(
          post.userId,
          '✅ Publication approuvée',
          'Votre message est maintenant visible sur le feed',
          '/profile'
        );
      } catch (notifError) {
        console.error("Erreur envoi notification utilisateur:", notifError);
      }
    }
    
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