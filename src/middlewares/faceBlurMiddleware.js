const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

// Simuler la détection de visage (version simplifiée)
const blurFace = async (inputPath, outputPath) => {
  try {
    // Version simplifiée : on floute toute l'image
    // Dans une vraie application, utilisez une bibliothèque comme 'face-api.js'
    await sharp(inputPath)
      .blur(10)
      .toFile(outputPath);
    
    return true;
  } catch (error) {
    console.error('Erreur lors du floutage:', error);
    return false;
  }
};

const faceBlurMiddleware = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  try {
    const inputPath = req.file.path;
    const outputPath = inputPath.replace(/(\.[^.]+)$/, '-blurred$1');
    
    const blurred = await blurFace(inputPath, outputPath);
    
    if (blurred) {
      // Remplacer le chemin du fichier par la version floutée
      req.file.path = outputPath;
      req.file.filename = req.file.filename.replace(/(\.[^.]+)$/, '-blurred$1');
      
      // Supprimer l'original
      await fs.unlink(inputPath);
    }
    
    next();
  } catch (error) {
    console.error('Erreur dans le middleware de floutage:', error);
    next(error);
  }
};

module.exports = faceBlurMiddleware;