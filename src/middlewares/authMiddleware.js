const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Récupérer le token
      token = req.headers.authorization.split(' ')[1];

      // Vérifier le token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Récupérer l'utilisateur
      const [users] = await pool.execute(
        'SELECT id, nom, prenom, email, role, photo FROM users WHERE id = ?',
        [decoded.id]
      );

      if (users.length === 0) {
        return res.status(401).json({ message: 'Utilisateur non trouvé' });
      }

      req.user = users[0];
      next();
    } catch (error) {
      console.error('❌ Erreur d\'authentification:', error.message);
      return res.status(401).json({ message: 'Non autorisé, token invalide' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Non autorisé, pas de token' });
  }
};

const admin = (req, res, next) => {
  console.log('='.repeat(50));
  console.log('🔐 VÉRIFICATION ADMIN');
  console.log('📍 URL:', req.originalUrl);
  console.log('📝 Méthode:', req.method);
  console.log('👤 User présent dans req.user:', req.user ? 'OUI' : 'NON');
  
  if (req.user) {
    console.log('👤 ID:', req.user.id);
    console.log('👤 Rôle:', req.user.role);
    console.log('👤 Email:', req.user.email);
  } else {
    console.log('⚠️ req.user est undefined - le middleware protect a peut-être échoué');
  }
  
  console.log('='.repeat(50));

  if (req.user && req.user.role === 'admin') {
    console.log('✅ ACCÈS ADMIN AUTORISÉ');
    next();
  } else {
    console.log('❌ ACCÈS ADMIN REFUSÉ');
    res.status(403).json({ message: 'Accès interdit - Admin seulement' });
  }
};

module.exports = { protect, admin };