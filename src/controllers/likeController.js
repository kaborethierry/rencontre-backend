const { pool } = require('../config/db');

// Liker/Unliker un post
const toggleLike = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    if (!postId) {
      return res.status(400).json({ message: 'PostId requis' });
    }

    // Vérifier si déjà liké
    const [existing] = await pool.execute(
      'SELECT * FROM likes WHERE userId = ? AND postId = ?',
      [userId, postId]
    );

    if (existing.length > 0) {
      // Unlike
      await pool.execute(
        'DELETE FROM likes WHERE userId = ? AND postId = ?',
        [userId, postId]
      );
      await pool.execute(
        'UPDATE posts SET likesCount = likesCount - 1 WHERE id = ?',
        [postId]
      );
    } else {
      // Like
      await pool.execute(
        'INSERT INTO likes (userId, postId) VALUES (?, ?)',
        [userId, postId]
      );
      await pool.execute(
        'UPDATE posts SET likesCount = likesCount + 1 WHERE id = ?',
        [postId]
      );
    }

    // Récupérer le nouveau count
    const [count] = await pool.execute(
      'SELECT COUNT(*) as count FROM likes WHERE postId = ?',
      [postId]
    );

    // Récupérer tous les users qui ont liké
    const [users] = await pool.execute(
      'SELECT userId FROM likes WHERE postId = ?',
      [postId]
    );

    res.json({ 
      count: count[0].count, 
      users: users.map(u => u.userId) 
    });
  } catch (error) {
    console.error('❌ Erreur toggleLike:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Récupérer les likes d'un post
const getPostLikes = async (req, res) => {
  try {
    const { postId } = req.params;

    if (!postId) {
      return res.status(400).json({ message: 'PostId requis' });
    }

    const [likes] = await pool.execute(
      'SELECT userId FROM likes WHERE postId = ?',
      [postId]
    );

    const [count] = await pool.execute(
      'SELECT COUNT(*) as count FROM likes WHERE postId = ?',
      [postId]
    );

    res.json({ 
      count: count[0].count, 
      users: likes.map(l => l.userId) 
    });
  } catch (error) {
    console.error('❌ Erreur getPostLikes:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

module.exports = {
  toggleLike,
  getPostLikes
};