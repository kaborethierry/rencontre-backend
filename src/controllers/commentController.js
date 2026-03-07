const { pool } = require('../config/db');

// Ajouter un commentaire
const addComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;
    
    if (!postId || !content) {
      return res.status(400).json({ message: 'PostId et contenu requis' });
    }

    const [result] = await pool.execute(
      'INSERT INTO comments (userId, postId, content) VALUES (?, ?, ?)',
      [req.user.id, postId, content]
    );

    // Mettre à jour le compteur de commentaires dans posts
    await pool.execute(
      'UPDATE posts SET commentsCount = commentsCount + 1 WHERE id = ?',
      [postId]
    );

    // Récupérer le commentaire avec les infos utilisateur
    const [comments] = await pool.execute(
      `SELECT c.*, u.nom, u.prenom, u.photo
       FROM comments c
       JOIN users u ON c.userId = u.id
       WHERE c.id = ?`,
      [result.insertId]
    );

    res.status(201).json(comments[0]);
  } catch (error) {
    console.error('❌ Erreur addComment:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Récupérer les commentaires d'une publication
const getPostComments = async (req, res) => {
  try {
    const { postId } = req.params;
    
    if (!postId) {
      return res.status(400).json({ message: 'PostId requis' });
    }

    const [comments] = await pool.execute(
      `SELECT c.*, u.nom, u.prenom, u.photo
       FROM comments c
       JOIN users u ON c.userId = u.id
       WHERE c.postId = ?
       ORDER BY c.createdAt ASC`,
      [postId]
    );

    res.json(comments);
  } catch (error) {
    console.error('❌ Erreur getPostComments:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Supprimer un commentaire
const deleteComment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'ID du commentaire requis' });
    }

    // Vérifier que le commentaire appartient à l'utilisateur
    const [comment] = await pool.execute(
      'SELECT postId FROM comments WHERE id = ? AND userId = ?',
      [id, req.user.id]
    );

    if (comment.length === 0) {
      return res.status(404).json({ message: 'Commentaire non trouvé' });
    }

    await pool.execute('DELETE FROM comments WHERE id = ?', [id]);

    // Mettre à jour le compteur de commentaires
    await pool.execute(
      'UPDATE posts SET commentsCount = commentsCount - 1 WHERE id = ?',
      [comment[0].postId]
    );

    res.json({ message: 'Commentaire supprimé' });
  } catch (error) {
    console.error('❌ Erreur deleteComment:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

module.exports = {
  addComment,
  getPostComments,
  deleteComment
};