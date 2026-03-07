const { pool } = require('../config/db');

// Récupérer les statistiques du tableau de bord
const getDashboardStats = async (req, res) => {
  try {
    // Nombre total d'utilisateurs
    const [totalUsers] = await pool.execute(
      'SELECT COUNT(*) as count FROM users'
    );

    // Nombre d'utilisateurs actifs (connectés dans les dernières 24h)
    const [activeUsers] = await pool.execute(
      `SELECT COUNT(*) as count FROM users 
       WHERE lastLogin >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`
    );

    // Nombre d'utilisateurs suspendus (isActive = 0)
    const [suspendedUsers] = await pool.execute(
      'SELECT COUNT(*) as count FROM users WHERE isActive = 0'
    );

    // Nombre total de posts
    const [totalPosts] = await pool.execute(
      'SELECT COUNT(*) as count FROM posts'
    );

    // Nombre total de commentaires
    const [totalComments] = await pool.execute(
      'SELECT COUNT(*) as count FROM comments'
    );

    // Nombre total de likes
    const [totalLikes] = await pool.execute(
      'SELECT COUNT(*) as count FROM likes'
    );

    // Nouveaux utilisateurs aujourd'hui
    const [newUsersToday] = await pool.execute(
      `SELECT COUNT(*) as count FROM users 
       WHERE DATE(registeredAt) = CURDATE()`
    );

    // Nouveaux posts aujourd'hui
    const [newPostsToday] = await pool.execute(
      `SELECT COUNT(*) as count FROM posts 
       WHERE DATE(createdAt) = CURDATE()`
    );

    // Signalements en attente
    const [pendingReports] = await pool.execute(
      `SELECT COUNT(*) as count FROM reports 
       WHERE status = 'pending'`
    );

    // Statistiques par mois (pour les graphiques)
    const [usersByMonth] = await pool.execute(
      `SELECT DATE_FORMAT(registeredAt, '%Y-%m') as month, 
              COUNT(*) as count 
       FROM users 
       WHERE registeredAt >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY month 
       ORDER BY month DESC`
    );

    const [postsByMonth] = await pool.execute(
      `SELECT DATE_FORMAT(createdAt, '%Y-%m') as month, 
              COUNT(*) as count 
       FROM posts 
       WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY month 
       ORDER BY month DESC`
    );

    res.json({
      totalUsers: totalUsers[0].count,
      activeUsers: activeUsers[0].count,
      suspendedUsers: suspendedUsers[0].count,
      totalPosts: totalPosts[0].count,
      totalComments: totalComments[0].count,
      totalLikes: totalLikes[0].count,
      newUsersToday: newUsersToday[0].count,
      newPostsToday: newPostsToday[0].count,
      pendingReports: pendingReports[0].count,
      usersByMonth,
      postsByMonth
    });

  } catch (error) {
    console.error('❌ Erreur getDashboardStats:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Récupérer tous les utilisateurs (pour admin)
const getAllUsers = async (req, res) => {
  try {
    const [users] = await pool.execute(
      `SELECT id, nom, prenom, email, age, ville, profession, religion, 
              sexe, statut, role, isActive, lastLogin, registeredAt,
              (SELECT COUNT(*) FROM posts WHERE userId = users.id) as postsCount,
              (SELECT COUNT(*) FROM comments WHERE userId = users.id) as commentsCount
       FROM users 
       ORDER BY registeredAt DESC`
    );

    res.json(users);
  } catch (error) {
    console.error('❌ Erreur getAllUsers:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Suspendre/Activer un utilisateur
const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    await pool.execute(
      'UPDATE users SET isActive = ? WHERE id = ?',
      [isActive, id]
    );

    res.json({ 
      message: isActive ? 'Utilisateur activé' : 'Utilisateur suspendu',
      isActive 
    });
  } catch (error) {
    console.error('❌ Erreur toggleUserStatus:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Supprimer un utilisateur
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.execute('DELETE FROM users WHERE id = ?', [id]);

    res.json({ message: 'Utilisateur supprimé' });
  } catch (error) {
    console.error('❌ Erreur deleteUser:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Récupérer tous les posts (pour admin)
const getAllPosts = async (req, res) => {
  try {
    const [posts] = await pool.execute(
      `SELECT p.*, u.nom, u.prenom, u.email, u.photo as userPhoto,
              (SELECT COUNT(*) FROM likes WHERE postId = p.id) as likesCount,
              (SELECT COUNT(*) FROM comments WHERE postId = p.id) as commentsCount
       FROM posts p
       JOIN users u ON p.userId = u.id
       ORDER BY p.createdAt DESC`
    );

    res.json(posts);
  } catch (error) {
    console.error('❌ Erreur getAllPosts:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Supprimer un post (admin)
const deletePost = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.execute('DELETE FROM posts WHERE id = ?', [id]);

    res.json({ message: 'Publication supprimée' });
  } catch (error) {
    console.error('❌ Erreur deletePost:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Récupérer tous les signalements
const getReports = async (req, res) => {
  try {
    const [reports] = await pool.execute(
      `SELECT r.*, 
              u1.nom as reporterNom, u1.prenom as reporterPrenom, u1.email as reporterEmail,
              u2.nom as reportedNom, u2.prenom as reportedPrenom, u2.email as reportedEmail,
              p.content as postContent
       FROM reports r
       LEFT JOIN users u1 ON r.reporterId = u1.id
       LEFT JOIN users u2 ON r.reportedUserId = u2.id
       LEFT JOIN posts p ON r.reportedPostId = p.id
       ORDER BY r.createdAt DESC`
    );

    res.json(reports);
  } catch (error) {
    console.error('❌ Erreur getReports:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Traiter un signalement
const resolveReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, action } = req.body;

    await pool.execute(
      'UPDATE reports SET status = ?, resolvedAt = NOW() WHERE id = ?',
      [status, id]
    );

    // Si action est "delete_post", supprimer le post signalé
    if (action === 'delete_post') {
      const [report] = await pool.execute(
        'SELECT reportedPostId FROM reports WHERE id = ?',
        [id]
      );
      if (report[0]?.reportedPostId) {
        await pool.execute('DELETE FROM posts WHERE id = ?', [report[0].reportedPostId]);
      }
    }

    // Si action est "suspend_user", suspendre l'utilisateur signalé
    if (action === 'suspend_user') {
      const [report] = await pool.execute(
        'SELECT reportedUserId FROM reports WHERE id = ?',
        [id]
      );
      if (report[0]?.reportedUserId) {
        await pool.execute('UPDATE users SET isActive = 0 WHERE id = ?', [report[0].reportedUserId]);
      }
    }

    res.json({ message: 'Signalement traité' });
  } catch (error) {
    console.error('❌ Erreur resolveReport:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Récupérer toutes les conversations (admin)
const getAllConversations = async (req, res) => {
  try {
    const [conversations] = await pool.execute(
      `SELECT c.*,
              u1.nom as user1Nom, u1.prenom as user1Prenom, u1.email as user1Email,
              u2.nom as user2Nom, u2.prenom as user2Prenom, u2.email as user2Email,
              lm.content as lastMessageContent,
              lm.createdAt as lastMessageTime
       FROM conversations c
       JOIN users u1 ON c.user1Id = u1.id
       JOIN users u2 ON c.user2Id = u2.id
       LEFT JOIN messages lm ON c.lastMessageId = lm.id
       ORDER BY c.lastMessageAt DESC`
    );

    res.json(conversations);
  } catch (error) {
    console.error('❌ Erreur getAllConversations:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Récupérer les messages d'une conversation (admin)
const getConversationMessages = async (req, res) => {
  try {
    const { id } = req.params;

    const [messages] = await pool.execute(
      `SELECT m.*, u.nom, u.prenom, u.email
       FROM messages m
       JOIN users u ON m.senderId = u.id
       WHERE (m.senderId = (SELECT user1Id FROM conversations WHERE id = ?) 
          AND m.receiverId = (SELECT user2Id FROM conversations WHERE id = ?))
          OR (m.senderId = (SELECT user2Id FROM conversations WHERE id = ?) 
          AND m.receiverId = (SELECT user1Id FROM conversations WHERE id = ?))
       ORDER BY m.createdAt ASC`,
      [id, id, id, id]
    );

    res.json(messages);
  } catch (error) {
    console.error('❌ Erreur getConversationMessages:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Récupérer les messages de contact (simulés pour l'instant)
const getContactMessages = async (req, res) => {
  // Simulation de messages de contact
  const mockMessages = [
    {
      id: 1,
      name: 'Jean Dupont',
      email: 'jean.dupont@email.com',
      subject: 'Question sur l\'inscription',
      message: 'Bonjour, je n\'arrive pas à finaliser mon inscription. Pouvez-vous m\'aider ?',
      date: '2026-03-05T10:30:00',
      status: 'non lu'
    },
    {
      id: 2,
      name: 'Marie Martin',
      email: 'marie.martin@email.com',
      subject: 'Problème de connexion',
      message: 'Je ne peux plus me connecter à mon compte depuis hier.',
      date: '2026-03-04T15:45:00',
      status: 'lu'
    },
    {
      id: 3,
      name: 'Pierre Durand',
      email: 'pierre.durand@email.com',
      subject: 'Signalement d\'un utilisateur',
      message: 'Je souhaite signaler un comportement inapproprié.',
      date: '2026-03-03T09:15:00',
      status: 'traité'
    }
  ];

  res.json(mockMessages);
};

module.exports = {
  getDashboardStats,
  getAllUsers,
  toggleUserStatus,
  deleteUser,
  getAllPosts,
  deletePost,
  getReports,
  resolveReport,
  getAllConversations,
  getConversationMessages,
  getContactMessages
};