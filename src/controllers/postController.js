// src/controllers/postController.js
const { pool } = require('../config/db');

// Créer une publication
const createPost = async (req, res) => {
  try {
    const { content } = req.body;
    
    const [result] = await pool.execute(
      'INSERT INTO posts (userId, content) VALUES (?, ?)',
      [req.user.id, content]
    );

    const [posts] = await pool.execute(
      `SELECT p.*, u.nom, u.prenom, u.photo 
       FROM posts p
       JOIN users u ON p.userId = u.id
       WHERE p.id = ?`,
      [result.insertId]
    );

    res.status(201).json(posts[0]);
  } catch (error) {
    console.error('Erreur createPost:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Récupérer toutes les publications
const getPosts = async (req, res) => {
  try {
    const [posts] = await pool.execute(
      `SELECT p.*, u.nom, u.prenom, u.photo,
        (SELECT COUNT(*) FROM likes WHERE postId = p.id) as likesCount,
        (SELECT COUNT(*) FROM comments WHERE postId = p.id) as commentsCount
       FROM posts p
       JOIN users u ON p.userId = u.id
       ORDER BY p.createdAt DESC`
    );
    res.json(posts);
  } catch (error) {
    console.error('Erreur getPosts:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Récupérer les publications d'un utilisateur
const getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;

    const [posts] = await pool.execute(
      `SELECT p.*, u.nom, u.prenom, u.photo,
        (SELECT COUNT(*) FROM likes WHERE postId = p.id) as likesCount,
        (SELECT COUNT(*) FROM comments WHERE postId = p.id) as commentsCount
       FROM posts p
       JOIN users u ON p.userId = u.id
       WHERE p.userId = ?
       ORDER BY p.createdAt DESC`,
      [userId]
    );
    res.json(posts);
  } catch (error) {
    console.error('Erreur getUserPosts:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Mettre à jour une publication
const updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    const [result] = await pool.execute(
      'UPDATE posts SET content = ?, edited = true, editedAt = NOW() WHERE id = ? AND userId = ?',
      [content, id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Publication non trouvée' });
    }

    const [posts] = await pool.execute(
      'SELECT * FROM posts WHERE id = ?',
      [id]
    );

    res.json(posts[0]);
  } catch (error) {
    console.error('Erreur updatePost:', error);
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
    console.error('Erreur deletePost:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

module.exports = {
  createPost,
  getPosts,
  getUserPosts,
  updatePost,
  deletePost
};