const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

// Redimensionner une image
const resizeImage = async (inputPath, outputPath, width, height) => {
  try {
    await sharp(inputPath)
      .resize(width, height, {
        fit: 'cover',
        position: 'center'
      })
      .toFile(outputPath);
    
    return true;
  } catch (error) {
    console.error('Erreur redimensionnement:', error);
    return false;
  }
};

// Compresser une image
const compressImage = async (inputPath, outputPath, quality = 80) => {
  try {
    await sharp(inputPath)
      .jpeg({ quality })
      .toFile(outputPath);
    
    return true;
  } catch (error) {
    console.error('Erreur compression:', error);
    return false;
  }
};

// Créer un thumbnail
const createThumbnail = async (inputPath, outputPath) => {
  try {
    await sharp(inputPath)
      .resize(200, 200, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 70 })
      .toFile(outputPath);
    
    return true;
  } catch (error) {
    console.error('Erreur création thumbnail:', error);
    return false;
  }
};

// Obtenir les métadonnées d'une image
const getImageMetadata = async (imagePath) => {
  try {
    const metadata = await sharp(imagePath).metadata();
    return metadata;
  } catch (error) {
    console.error('Erreur récupération métadonnées:', error);
    return null;
  }
};

// Supprimer une image
const deleteImage = async (imagePath) => {
  try {
    await fs.unlink(imagePath);
    return true;
  } catch (error) {
    console.error('Erreur suppression image:', error);
    return false;
  }
};

module.exports = {
  resizeImage,
  compressImage,
  createThumbnail,
  getImageMetadata,
  deleteImage
};