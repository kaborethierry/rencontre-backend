const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

// Générer un token JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// Inscription
const register = async (req, res) => {
  try {
    // Vérifier les erreurs de validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Récupérer les données (peuvent venir de req.body ou de FormData)
    const nom = req.body.nom || req.body.get('nom');
    const prenom = req.body.prenom || req.body.get('prenom');
    const email = req.body.email || req.body.get('email');
    const password = req.body.password || req.body.get('password');
    const age = req.body.age || req.body.get('age');
    const ville = req.body.ville || req.body.get('ville');
    const profession = req.body.profession || req.body.get('profession');
    const religion = req.body.religion || req.body.get('religion');
    const description = req.body.description || req.body.get('description');
    const sexe = req.body.sexe || req.body.get('sexe');
    const statut = req.body.statut || req.body.get('statut');

    // Vérifier si l'utilisateur existe déjà
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }

    // Hasher le mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Gérer la photo uploadée
    let photoPath = null;
    if (req.file) {
      photoPath = `/uploads/profiles/${req.file.filename}`;
    }

    // Insérer l'utilisateur (avec rôle user par défaut)
    const [result] = await pool.execute(
      `INSERT INTO users 
       (nom, prenom, email, password, age, ville, profession, religion, description, photo, sexe, statut, role) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nom,
        prenom,
        email,
        hashedPassword,
        age,
        ville,
        profession || null,
        religion,
        description || null,
        photoPath,
        sexe || 'Autre',
        statut || 'Célibataire',
        'user' // Rôle par défaut
      ]
    );

    // Récupérer l'utilisateur créé
    const [newUser] = await pool.execute(
      'SELECT id, nom, prenom, email, role, photo FROM users WHERE id = ?',
      [result.insertId]
    );

    // Générer le token
    const token = generateToken(newUser[0].id);

    res.status(201).json({
      message: 'Inscription réussie',
      user: newUser[0],
      token
    });

  } catch (error) {
    console.error('❌ Erreur lors de l\'inscription:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Connexion
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Vérifier si l'utilisateur existe
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    const user = users[0];

    // Vérifier si le compte est actif
    if (user.isActive === 0) {
      return res.status(403).json({ message: 'Compte suspendu. Contactez l\'administrateur.' });
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    // Mettre à jour la dernière connexion
    await pool.execute(
      'UPDATE users SET lastLogin = NOW() WHERE id = ?',
      [user.id]
    );

    // Générer le token
    const token = generateToken(user.id);

    // Ne pas renvoyer le mot de passe
    delete user.password;

    res.json({
      message: 'Connexion réussie',
      user,
      token
    });

  } catch (error) {
    console.error('❌ Erreur lors de la connexion:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Déconnexion
const logout = (req, res) => {
  res.json({ message: 'Déconnexion réussie' });
};

// Rafraîchir le token
const refreshToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(401).json({ message: 'Token requis' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const [users] = await pool.execute(
      'SELECT id FROM users WHERE id = ?',
      [decoded.id]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Utilisateur non trouvé' });
    }

    const newToken = generateToken(decoded.id);

    res.json({ token: newToken });

  } catch (error) {
    console.error('❌ Erreur lors du rafraîchissement du token:', error);
    res.status(401).json({ message: 'Token invalide' });
  }
};

// Mot de passe oublié
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const [users] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'Aucun compte avec cet email' });
    }

    const resetToken = jwt.sign(
      { id: users[0].id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ 
      message: 'Si cet email existe, vous recevrez un lien de réinitialisation',
      ...(process.env.NODE_ENV === 'development' && { resetToken })
    });

  } catch (error) {
    console.error('❌ Erreur mot de passe oublié:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Réinitialiser le mot de passe
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await pool.execute(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, decoded.id]
    );

    res.json({ message: 'Mot de passe réinitialisé avec succès' });

  } catch (error) {
    console.error('❌ Erreur réinitialisation:', error);
    res.status(400).json({ message: 'Token invalide ou expiré' });
  }
};

module.exports = {
  register,
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword
};