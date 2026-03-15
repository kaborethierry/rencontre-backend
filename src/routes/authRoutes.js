const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const upload = require('../middlewares/uploadMiddleware');
// const faceBlurMiddleware = require('../middlewares/faceBlurMiddleware'); // ← À SUPPRIMER

// Validation pour l'inscription
const registerValidation = [
  body('nom').notEmpty().withMessage('Le nom est requis'),
  body('prenom').notEmpty().withMessage('Le prénom est requis'),
  body('email').isEmail().withMessage('Email invalide'),
  body('password').isLength({ min: 6 }).withMessage('Le mot de passe doit contenir au moins 6 caractères'),
  body('age').isInt({ min: 18, max: 100 }).withMessage('Âge invalide'),
  body('ville').notEmpty().withMessage('La ville est requise'),
  body('religion').isIn(['Chrétien', 'Musulman', 'Athée', 'Autre']).withMessage('Religion invalide')
];

// Routes d'authentification
router.post(
  '/register',
  upload.single('photo'),
  // faceBlurMiddleware, // ← À SUPPRIMER
  registerValidation,
  authController.register
);

router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/refresh-token', authController.refreshToken);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

module.exports = router;