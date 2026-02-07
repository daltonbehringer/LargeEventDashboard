const express = require('express');
const router = express.Router();
const radarService = require('../services/radar.service');
const path = require('path');
const fs = require('fs');

// Get latest radar image
router.get('/latest', async (req, res) => {
  try {
    const data = await radarService.getLatestRadar();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get radar animation loop
router.get('/loop', async (req, res) => {
  try {
    const frames = await radarService.getRadarLoop();
    res.json(frames);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get radar image by timestamp
router.get('/image/:timestamp', async (req, res) => {
  try {
    const data = await radarService.getRadarByTimestamp(req.params.timestamp);
    
    // If localPath exists, serve the actual image file
    if (data.localPath && fs.existsSync(data.localPath)) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.sendFile(data.localPath);
    } else {
      res.status(404).json({ error: 'Radar image not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve radar data directory as static files
router.use('/data', express.static(path.join(__dirname, '../../data/radar')));

// Get list of available MRMS files
router.get('/mrms/available', async (req, res) => {
  try {
    const files = await radarService.listAvailableMRMSFiles();
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
