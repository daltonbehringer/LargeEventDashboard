const express = require('express');
const router = express.Router();
const satelliteService = require('../services/satellite.service');
const path = require('path');
const fs = require('fs');

// Get latest satellite image
router.get('/latest', async (req, res) => {
  try {
    const data = await satelliteService.getLatestSatellite();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get satellite loop
router.get('/loop', async (req, res) => {
  try {
    const frames = await satelliteService.getSatelliteLoop();
    res.json(frames);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific product (visible, infrared, water vapor, etc.)
router.get('/product/:type', async (req, res) => {
  try {
    const data = await satelliteService.getSatelliteProduct(req.params.type);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get satellite image by timestamp
router.get('/image/:timestamp', async (req, res) => {
  try {
    const timestamp = decodeURIComponent(req.params.timestamp);
    const satelliteDir = path.join(__dirname, '../../data/satellite');
    
    // Find the satellite file matching the timestamp
    const files = fs.readdirSync(satelliteDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
    const matchingFile = files.find(f => f.includes(timestamp.replace(/:/g, '-')));
    
    if (matchingFile) {
      const filePath = path.join(satelliteDir, matchingFile);
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: 'Satellite image not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve satellite data directory as static files
router.use('/data', express.static(path.join(__dirname, '../../data/satellite')));

module.exports = router;
