const express = require('express');
const router = express.Router();
const mrmsService = require('../services/mrms.service');
const path = require('path');
const fs = require('fs');

// Get latest MRMS radar
router.get('/latest', async (req, res) => {
  try {
    const data = await mrmsService.getLatestMRMS();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get MRMS loop/animation
router.get('/loop', async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 10;
    const frames = await mrmsService.getMRMSLoop(count);
    res.json(frames);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get MRMS by timestamp
router.get('/timestamp/:timestamp', async (req, res) => {
  try {
    const data = await mrmsService.getMRMSByTimestamp(req.params.timestamp);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve MRMS image file
router.get('/image/:timestamp', async (req, res) => {
  try {
    const data = await mrmsService.getMRMSByTimestamp(req.params.timestamp);
    
    if (data.localPath && fs.existsSync(data.localPath)) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.sendFile(data.localPath);
    } else {
      res.status(404).json({ error: 'MRMS image not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List available MRMS files for a date
router.get('/available/:date?', async (req, res) => {
  try {
    const date = req.params.date ? new Date(req.params.date) : new Date();
    const files = await mrmsService.listAvailableFiles(date);
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve MRMS data directory as static files
router.use('/data', express.static(path.join(__dirname, '../../data/mrms')));

module.exports = router;
