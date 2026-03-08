const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const dotenv = require('dotenv');
const { testConnection } = require('./config/db');
const { createServer } = require('http');
const { Server } = require('socket.io');

dotenv.config();

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const postRoutes = require('./routes/postRoutes');
const likeRoutes = require('./routes/likeRoutes');
const commentRoutes = require('./routes/commentRoutes');
const messageRoutes = require('./routes/messageRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// ✅ SOLUTION POUR LE PROXY HOSTINGER (AJOUT CRITIQUE)
app.set('trust proxy', 1);

testConnection();

// Socket.io
require('./services/socketService')(io);

// CONFIGURATION OPTIMISÉE DU RATE LIMITER
const isDev = process.env.NODE_ENV === 'development';

let limiter;
if (isDev) {
  limiter = (req, res, next) => next();
  console.log('⚠️ Rate limiting désactivé en mode développement');
} else {
  limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute (au lieu de 15)
    max: 30, // 30 requêtes par minute (suffisant pour un utilisateur normal)
    standardHeaders: true,
    legacyHeaders: false,
    // Identification correcte de l'IP à travers le proxy
    keyGenerator: (req) => {
      return req.headers['x-forwarded-for']?.split(',')[0] || 
             req.ip || 
             req.connection.remoteAddress;
    },
    skip: (req) => {
      // Ne pas limiter les routes statiques et health check
      return req.path === '/api/health' || req.path.startsWith('/uploads');
    },
    handler: (req, res) => {
      res.status(429).json({ 
        message: 'Trop de requêtes. Veuillez patienter quelques instants.',
        retryAfter: Math.ceil(req.rateLimit.resetTime / 1000 - Date.now() / 1000)
      });
    }
  });
}

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir les fichiers statiques
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Cache-Control', 'public, max-age=31536000');
  next();
}, express.static(path.join(__dirname, '../uploads')));

// Appliquer le rate limiter à toutes les routes API
app.use('/api/', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/likes', likeRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);

// Route de test
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Le serveur fonctionne correctement',
    timestamp: new Date().toISOString()
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ message: 'Route non trouvée' });
});

// Gestionnaire d'erreurs
app.use((err, req, res, next) => {
  console.error('❌ Erreur serveur:', err);
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'Fichier trop volumineux (max 5MB)' });
  }
  
  if (err.message === 'Seules les images sont autorisées') {
    return res.status(400).json({ message: err.message });
  }
  
  res.status(500).json({ 
    message: 'Erreur serveur',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur le port ${PORT}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`📁 Uploads: ${path.join(__dirname, '../uploads')}`);
  console.log(`🔧 Mode: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = { app, httpServer, io };