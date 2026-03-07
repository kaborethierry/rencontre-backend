const { pool } = require('../config/db');

// Récupérer le profil de l'utilisateur connecté
const getProfile = async (req, res) => {
  try {
    console.log("Récupération du profil pour l'utilisateur:", req.user.id);
    
    const [users] = await pool.execute(
      `SELECT id, nom, prenom, email, age, ville, profession, religion, 
              description, photo, sexe, statut, role, isActive, registeredAt 
       FROM users WHERE id = ?`,
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    console.log("Profil trouvé:", users[0]);
    res.json(users[0]);
  } catch (error) {
    console.error('❌ Erreur getProfile:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Mettre à jour le profil
const updateProfile = async (req, res) => {
  try {
    const { nom, prenom, age, ville, profession, religion, description, sexe, statut, role } = req.body;
    
    let photoPath = null;
    if (req.file) {
      photoPath = `/uploads/profiles/${req.file.filename}`;
      console.log("📸 Nouvelle photo uploadée:", photoPath);
    }

    // Construire la requête dynamiquement
    let sql = 'UPDATE users SET ';
    const params = [];
    const updates = [];

    if (nom) { updates.push('nom = ?'); params.push(nom); }
    if (prenom) { updates.push('prenom = ?'); params.push(prenom); }
    if (age) { updates.push('age = ?'); params.push(age); }
    if (ville) { updates.push('ville = ?'); params.push(ville); }
    if (profession) { updates.push('profession = ?'); params.push(profession); }
    if (religion) { updates.push('religion = ?'); params.push(religion); }
    if (description) { updates.push('description = ?'); params.push(description); }
    if (sexe) { updates.push('sexe = ?'); params.push(sexe); }
    if (statut) { updates.push('statut = ?'); params.push(statut); }
    if (role) { updates.push('role = ?'); params.push(role); }
    if (photoPath) { updates.push('photo = ?'); params.push(photoPath); }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'Aucune donnée à mettre à jour' });
    }

    sql += updates.join(', ') + ' WHERE id = ?';
    params.push(req.user.id);

    const [result] = await pool.execute(sql, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Récupérer l'utilisateur mis à jour
    const [users] = await pool.execute(
      `SELECT id, nom, prenom, email, age, ville, profession, religion, 
              description, photo, sexe, statut, role 
       FROM users WHERE id = ?`,
      [req.user.id]
    );

    res.json({ message: 'Profil mis à jour', user: users[0] });
  } catch (error) {
    console.error('❌ Erreur updateProfile:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Rechercher des utilisateurs
const searchUsers = async (req, res) => {
  try {
    const { q, ville, ageMin, ageMax, religion, sexe } = req.query;
    
    let sql = 'SELECT id, nom, prenom, age, ville, profession, religion, description, photo FROM users WHERE id != ?';
    const params = [req.user.id];

    if (q) {
      sql += ' AND (nom LIKE ? OR prenom LIKE ? OR ville LIKE ?)';
      const searchTerm = `%${q}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (ville) {
      sql += ' AND ville LIKE ?';
      params.push(`%${ville}%`);
    }

    if (ageMin) {
      sql += ' AND age >= ?';
      params.push(ageMin);
    }

    if (ageMax) {
      sql += ' AND age <= ?';
      params.push(ageMax);
    }

    if (religion) {
      sql += ' AND religion = ?';
      params.push(religion);
    }

    if (sexe) {
      sql += ' AND sexe = ?';
      params.push(sexe);
    }

    const [users] = await pool.execute(sql, params);
    res.json(users);
  } catch (error) {
    console.error('❌ Erreur searchUsers:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Récupérer un utilisateur par ID
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const [users] = await pool.execute(
      `SELECT id, nom, prenom, age, ville, profession, religion, 
              description, photo, sexe, statut, registeredAt 
       FROM users WHERE id = ?`,
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error('❌ Erreur getUserById:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// SUPPRIMER LE COMPTE UTILISATEUR
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`🗑️ Demande de suppression du compte utilisateur: ${userId}`);

    // Vérifier que l'utilisateur existe
    const [users] = await pool.execute(
      'SELECT id, email FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // SUPPRESSION EN CASCADE
    await pool.execute('DELETE FROM users WHERE id = ?', [userId]);

    console.log(`✅ Compte utilisateur ${userId} (${users[0].email}) supprimé avec succès`);
    res.json({ 
      message: 'Compte supprimé avec succès',
      deletedUserId: userId 
    });

  } catch (error) {
    console.error('❌ Erreur deleteAccount:', error);
    
    let errorMessage = 'Erreur lors de la suppression du compte';
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      errorMessage = 'Impossible de supprimer le compte car il est référencé par d\'autres données';
    }
    
    res.status(500).json({ message: errorMessage });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  searchUsers,
  getUserById,
  deleteAccount
};