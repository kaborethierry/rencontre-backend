const { pool } = require('../config/db');
const notificationController = require('./notificationController');

// ✅ Vérifier si l'utilisateur est "approuvé" (au moins un post approuvé)
const isUserApproved = async (userId) => {
  try {
    const [result] = await pool.execute(
      'SELECT COUNT(*) as count FROM posts WHERE userId = ? AND isApproved = 1',
      [userId]
    );
    return result[0].count > 0;
  } catch (error) {
    console.error('❌ Erreur vérification statut utilisateur:', error);
    return false;
  }
};

// Créer une publication
const createPost = async (req, res) => {
  try {
    const { content } = req.body;
    const userId = req.user.id;
    
    // ✅ Vérifier si l'utilisateur a déjà un post approuvé
    const userHasApprovedPost = await isUserApproved(userId);
    
    // ✅ Si l'utilisateur a déjà un post approuvé, son nouveau post est auto-approuvé
    // ✅ Sinon, il est en attente
    const isApproved = userHasApprovedPost ? 1 : 0;
    
    console.log(`Création d'un post pour user ${userId}`);
    console.log(`- A déjà un post approuvé: ${userHasApprovedPost}`);
    console.log(`- Statut du nouveau post: ${isApproved ? 'APPROUVÉ' : 'EN ATTENTE'}`);

    const [result] = await pool.execute(
      'INSERT INTO posts (userId, content, isApproved) VALUES (?, ?, ?)',
      [userId, content, isApproved]
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

    // ✅ Si le post est en attente (premier post), notifier les admins
    if (!isApproved) {
      console.log("📢 Premier post en attente, notification aux admins");
      
      const [admins] = await pool.execute(
        'SELECT id FROM users WHERE role = "admin"'
      );
      
      for (const admin of admins) {
        try {
          await notificationController.createNotification(
            admin.id,
            'post_approval',
            userId,
            result.insertId,
            `Nouvelle publication en attente de ${req.user.prenom} ${req.user.nom}`
          );
          
          await notificationController.sendPushNotification(
            admin.id,
            '📝 Nouvelle publication à approuver',
            `${req.user.prenom} ${req.user.nom} a publié son premier message`,
            '/admin?tab=posts'
          );
        } catch (notifError) {
          console.error("Erreur envoi notification admin:", notifError);
        }
      }
    } else {
      console.log(`✅ Post auto-approuvé pour l'utilisateur ${userId} (déjà approuvé précédemment)`);
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

// Récupérer les publications d'un utilisateur (avec leur statut)
const getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;

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
    
    res.json(posts);
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
    
    console.log(`✅ Approbation du post ${id}`);
    
    // Récupérer les infos du post avant approbation
    const [postInfo] = await pool.execute(
      `SELECT userId FROM posts WHERE id = ?`,
      [id]
    );
    
    if (postInfo.length === 0) {
      return res.status(404).json({ message: 'Post non trouvé' });
    }
    
    const userId = postInfo[0].userId;
    
    // Approuver le post
    await pool.execute(
      'UPDATE posts SET isApproved = 1 WHERE id = ?',
      [id]
    );
    
    // Récupérer les infos complètes pour notification
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
          userId,
          'post_approved',
          req.user.id,
          id,
          'Votre première publication a été approuvée ! Désormais, vos futures publications seront automatiquement publiées.'
        );
        
        await notificationController.sendPushNotification(
          userId,
          '✅ Première publication approuvée',
          'Votre message est maintenant visible. Vos prochaines publications seront automatiques !',
          '/profile'
        );
      } catch (notifError) {
        console.error("Erreur envoi notification utilisateur:", notifError);
      }
    }
    
    res.json({ 
      message: 'Publication approuvée',
      userId: userId
    });
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