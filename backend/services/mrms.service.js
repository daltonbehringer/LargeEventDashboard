const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const zlib = require('zlib');
const { promisify } = require('util');
const gunzip = promisify(zlib.gunzip);
const cron = require('node-cron');

const CONFIG_PATH = path.join(__dirname, '../../config/event.config.json');
const MRMS_CACHE_PATH = path.join(__dirname, '../../data/mrms');
const GRIB_CACHE_PATH = path.join(__dirname, '../../data/grib');

class MRMSService {
  constructor() {
    this.config = null;
    this.updateTask = null;
    this.bucket = 'noaa-mrms-pds';
    this.baseUrl = `https://${this.bucket}.s3.amazonaws.com`;
    this.product = 'CONUS/ReflectivityAtLowestAltitude_00.50';
    this.filePrefix = 'MRMS_ReflectivityAtLowestAltitude_00.50';
  }

  async loadConfig() {
    const configData = await fs.readFile(CONFIG_PATH, 'utf8');
    this.config = JSON.parse(configData);
    return this.config;
  }

  /**
   * List recent MRMS files from the S3 bucket using the ListObjectsV2 API.
   * Files have non-predictable timestamps, so we must query the bucket index.
   */
  async listBucketFiles(dateStr, hourPrefix = '') {
    // S3 ListObjectsV2 via HTTPS (no auth needed — public bucket)
    const prefix = `${this.product}/${dateStr}/${this.filePrefix}_${dateStr}-${hourPrefix}`;
    const listUrl = `${this.baseUrl}/?list-type=2&prefix=${encodeURIComponent(prefix)}&max-keys=100`;

    console.log(`  S3 list: prefix=${this.filePrefix}_${dateStr}-${hourPrefix}*`);

    const response = await axios.get(listUrl, { timeout: 15000 });
    const xml = response.data;

    // Parse <Key> elements from the XML response
    const keys = [];
    const keyRegex = /<Key>([^<]+)<\/Key>/g;
    let match;
    while ((match = keyRegex.exec(xml)) !== null) {
      keys.push(match[1]);
    }

    return keys;          // e.g. ["CONUS/…/MRMS_…_20260207-030234.grib2.gz"]
  }

  /**
   * Get the most recent MRMS file URL by querying the S3 bucket listing.
   */
  async getLatestMRMSUrl() {
    const now = new Date();
    const dateStr = this.formatDate(now);

    console.log(`Searching for latest MRMS file (${dateStr})...`);

    // Search current hour, then previous hours until we find something
    for (let hourOffset = 0; hourOffset < 3; hourOffset++) {
      const checkTime = new Date(now.getTime() - hourOffset * 60 * 60 * 1000);
      const checkDateStr = this.formatDate(checkTime);
      const hourPrefix = checkTime.getUTCHours().toString().padStart(2, '0');

      const keys = await this.listBucketFiles(checkDateStr, hourPrefix);

      if (keys.length > 0) {
        // Sort descending so the newest file is first
        keys.sort().reverse();
        const latestKey = keys[0];
        const url = `${this.baseUrl}/${latestKey}`;

        // Extract the HHMMSS portion from the filename
        const timeMatch = latestKey.match(/_(\d{8})-(\d{6})\.grib2\.gz$/);
        const fileDateStr = timeMatch ? timeMatch[1] : checkDateStr;
        const timeStr = timeMatch ? timeMatch[2] : hourPrefix + '0000';

        // Build a proper UTC Date from the filename
        const y = fileDateStr.substring(0, 4);
        const mo = fileDateStr.substring(4, 6);
        const d = fileDateStr.substring(6, 8);
        const h = timeStr.substring(0, 2);
        const mi = timeStr.substring(2, 4);
        const s = timeStr.substring(4, 6);
        const timestamp = `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;

        console.log(`✅ Found latest MRMS: ${fileDateStr}-${timeStr}  (${keys.length} files this hour)`);
        return { url, dateStr: fileDateStr, timeStr, timestamp, key: latestKey };
      }

      console.log(`  No files for hour ${hourPrefix}, checking previous hour...`);
    }

    throw new Error('No MRMS files found in the last 3 hours');
  }

  /**
   * Download MRMS GRIB2.gz file
   */
  async downloadMRMS(url, outputPath) {
    console.log(`📥 Downloading MRMS from: ${url}`);
    
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': 'LargeEventDashboard/1.0'
      }
    });
    
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, response.data);
    
    const sizeMB = (response.data.length / 1024 / 1024).toFixed(2);
    console.log(`✅ Downloaded: ${path.basename(outputPath)} (${sizeMB} MB)`);
    
    return outputPath;
  }

  /**
   * Decompress .gz file
   */
  async decompressGzip(gzPath, outputPath) {
    console.log(`📦 Decompressing: ${path.basename(gzPath)}`);
    
    const compressedData = await fs.readFile(gzPath);
    const decompressed = await gunzip(compressedData);
    
    await fs.writeFile(outputPath, decompressed);
    
    const sizeMB = (decompressed.length / 1024 / 1024).toFixed(2);
    console.log(`✅ Decompressed: ${path.basename(outputPath)} (${sizeMB} MB)`);
    
    return outputPath;
  }

  /**
   * Process GRIB2 file and create map visualization
   */
  async processGRIB2(gribPath, outputPngPath) {
    if (!this.config) await this.loadConfig();
    
    console.log(`🗺️  Processing GRIB2 file: ${path.basename(gribPath)}`);
    
    const processorPath = path.join(__dirname, '../utils/mrms_processor.py');
    
    // Use venv Python if available
    const venvPython = path.join(__dirname, '../../venv/bin/python');
    const pythonCmd = require('fs').existsSync(venvPython) ? venvPython : 'python3';
    
    // Get event location for map centering
    const { latitude, longitude } = this.config.event;
    
    const pythonProcess = spawn(pythonCmd, [
      processorPath,
      gribPath,
      outputPngPath,
      latitude.toString(),
      longitude.toString()
    ]);
    
    return new Promise((resolve, reject) => {
      let output = '';
      let error = '';
      
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
        console.log(data.toString().trim());
      });
      
      pythonProcess.stderr.on('data', (data) => {
        error += data.toString();
        console.error(data.toString().trim());
      });
      
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ MRMS map generated: ${path.basename(outputPngPath)}`);
          resolve(outputPngPath);
        } else {
          reject(new Error(`MRMS processor failed with code ${code}: ${error}`));
        }
      });
      
      // 2 minute timeout for processing
      setTimeout(() => reject(new Error('MRMS processing timeout')), 120000);
    });
  }

  /**
   * Get latest MRMS radar data with full processing pipeline
   */
  async getLatestMRMS() {
    try {
      // 1. Find latest available file
      const latest = await this.getLatestMRMSUrl();
      
      // 2. Generate file paths
      const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
      const gzFilename = `mrms_${latest.dateStr}_${latest.timeStr}.grib2.gz`;
      const gribFilename = `mrms_${latest.dateStr}_${latest.timeStr}.grib2`;
      const pngFilename = `mrms_${timestamp}.png`;
      
      const gzPath = path.join(GRIB_CACHE_PATH, gzFilename);
      const gribPath = path.join(GRIB_CACHE_PATH, gribFilename);
      const pngPath = path.join(MRMS_CACHE_PATH, pngFilename);
      
      // 3. Download if not already cached
      if (!await this.fileExists(gzPath)) {
        await this.downloadMRMS(latest.url, gzPath);
      } else {
        console.log(`📦 Using cached file: ${gzFilename}`);
      }
      
      // 4. Decompress
      if (!await this.fileExists(gribPath)) {
        await this.decompressGzip(gzPath, gribPath);
      } else {
        console.log(`📦 Using cached GRIB2: ${gribFilename}`);
      }
      
      // 5. Process and create map
      await this.processGRIB2(gribPath, pngPath);
      
      // 6. Get file stats
      const pngStats = await fs.stat(pngPath);
      const gribStats = await fs.stat(gribPath);
      
      return {
        timestamp: latest.timestamp,
        dateStr: latest.dateStr,
        timeStr: latest.timeStr,
        source: 'NOAA MRMS',
        product: 'Merged Reflectivity QC Composite (0.50°)',
        url: `/api/mrms/image/${encodeURIComponent(timestamp)}`,
        imageUrl: `/api/mrms/image/${encodeURIComponent(timestamp)}`,
        localPath: pngPath,
        gribPath: gribPath,
        format: 'png',
        size: pngStats.size,
        gribSize: gribStats.size,
        coverage: 'CONUS',
        resolution: '0.01° (~1km)'
      };
      
    } catch (error) {
      console.error('❌ Error processing MRMS:', error.message);
      throw error;
    }
  }

  /**
   * List available MRMS files for a given date (queries S3 bucket)
   */
  async listAvailableFiles(date = new Date()) {
    const dateStr = this.formatDate(date);
    
    try {
      // Query the bucket for all files on this date (no hour prefix = get all)
      const keys = await this.listBucketFiles(dateStr);
      
      return keys.map(key => {
        const timeMatch = key.match(/_(\d{8})-(\d{6})\.grib2\.gz$/);
        const ts = timeMatch ? timeMatch[2] : '000000';
        return {
          dateStr,
          timeStr: ts,
          url: `${this.baseUrl}/${key}`,
          key,
          timestamp: `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}T${ts.substring(0,2)}:${ts.substring(2,4)}:${ts.substring(4,6)}Z`
        };
      });
    } catch (error) {
      console.error('Error listing MRMS files:', error.message);
      return [];
    }
  }

  /**
   * Get MRMS data for specific timestamp.
   * First checks local cache, then searches S3 for the closest available file.
   */
  async getMRMSByTimestamp(timestamp) {
    // Normalise the timestamp so it's safe in filenames
    const safeName = timestamp.replace(/:/g, '-').replace(/\./g, '-');

    // 1. Check local PNG cache first
    const pngPath = path.join(MRMS_CACHE_PATH, `mrms_${safeName}.png`);
    if (await this.fileExists(pngPath)) {
      const stats = await fs.stat(pngPath);
      return {
        timestamp,
        localPath: pngPath,
        url: `/api/mrms/image/${encodeURIComponent(safeName)}`,
        format: 'png',
        size: stats.size
      };
    }

    // 2. Search the bucket for files near the requested timestamp
    const date = new Date(timestamp);
    const dateStr = this.formatDate(date);
    const hourPrefix = date.getUTCHours().toString().padStart(2, '0');
    const keys = await this.listBucketFiles(dateStr, hourPrefix);

    if (keys.length === 0) {
      return { error: 'No MRMS files found for the requested timestamp' };
    }

    // Pick the file whose embedded time is closest to the request
    const requestSec = date.getUTCHours() * 3600 + date.getUTCMinutes() * 60 + date.getUTCSeconds();
    let bestKey = keys[0];
    let bestDiff = Infinity;
    for (const key of keys) {
      const m = key.match(/-(\d{2})(\d{2})(\d{2})\.grib2\.gz$/);
      if (m) {
        const sec = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]);
        if (Math.abs(sec - requestSec) < bestDiff) {
          bestDiff = Math.abs(sec - requestSec);
          bestKey = key;
        }
      }
    }

    const url = `${this.baseUrl}/${bestKey}`;
    const timeMatch = bestKey.match(/_(\d{8})-(\d{6})\.grib2\.gz$/);
    const fileTimeStr = timeMatch ? timeMatch[2] : '000000';

    const gzFilename = `mrms_${dateStr}_${fileTimeStr}.grib2.gz`;
    const gribFilename = `mrms_${dateStr}_${fileTimeStr}.grib2`;

    const gzPath = path.join(GRIB_CACHE_PATH, gzFilename);
    const gribPath = path.join(GRIB_CACHE_PATH, gribFilename);

    if (!await this.fileExists(gzPath))   await this.downloadMRMS(url, gzPath);
    if (!await this.fileExists(gribPath)) await this.decompressGzip(gzPath, gribPath);
    await this.processGRIB2(gribPath, pngPath);

    const stats = await fs.stat(pngPath);
    return {
      timestamp,
      localPath: pngPath,
      url: `/api/mrms/image/${encodeURIComponent(safeName)}`,
      format: 'png',
      size: stats.size
    };
  }

  /**
   * Get loop/animation of recent MRMS images
   */
  async getMRMSLoop(count = 10) {
    try {
      const files = await fs.readdir(MRMS_CACHE_PATH);
      const mrmsFiles = files
        .filter(f => f.startsWith('mrms_') && f.endsWith('.png'))
        .sort()
        .reverse()
        .slice(0, count);
      
      return mrmsFiles.map(f => {
        const timestamp = f.replace('mrms_', '').replace('.png', '').replace(/-/g, ':');
        return {
          filename: f,
          url: `/api/mrms/data/${f}`,
          timestamp,
          imageUrl: `/api/mrms/image/${encodeURIComponent(timestamp)}`
        };
      });
    } catch (error) {
      console.error('Error getting MRMS loop:', error.message);
      return [];
    }
  }

  /**
   * Clean up old MRMS files
   */
  async cleanupOldFiles() {
    try {
      const maxFiles = 20;
      
      // Clean MRMS images
      const mrmsFiles = await fs.readdir(MRMS_CACHE_PATH);
      const mrmsPngs = mrmsFiles
        .filter(f => f.startsWith('mrms_') && f.endsWith('.png'))
        .map(f => ({ name: f, path: path.join(MRMS_CACHE_PATH, f) }))
        .sort((a, b) => b.name.localeCompare(a.name));
      
      for (const file of mrmsPngs.slice(maxFiles)) {
        await fs.unlink(file.path);
        console.log(`🗑️  Cleaned up old MRMS PNG: ${file.name}`);
      }
      
      // Clean GRIB files
      const gribFiles = await fs.readdir(GRIB_CACHE_PATH);
      const gribData = gribFiles
        .filter(f => f.startsWith('mrms_'))
        .map(f => ({ name: f, path: path.join(GRIB_CACHE_PATH, f) }))
        .sort((a, b) => b.name.localeCompare(a.name));
      
      for (const file of gribData.slice(maxFiles * 2)) { // Keep more GRIB files (compressed + decompressed)
        await fs.unlink(file.path);
        console.log(`🗑️  Cleaned up old GRIB: ${file.name}`);
      }
      
      console.log('✅ MRMS cleanup complete');
    } catch (error) {
      console.error('Error cleaning up MRMS files:', error.message);
    }
  }

  /**
   * Start periodic MRMS updates
   */
  startPeriodicUpdates() {
    // Update every 5 minutes (MRMS updates every 2 min, but processing takes time)
    this.updateTask = cron.schedule('*/5 * * * *', async () => {
      console.log('🔄 Updating MRMS data...');
      try {
        await this.getLatestMRMS();
        await this.cleanupOldFiles();
      } catch (error) {
        console.error('MRMS update failed:', error.message);
      }
    });
    
    // Initial update
    this.getLatestMRMS().catch(err => console.error('Initial MRMS fetch failed:', err.message));
  }

  stopPeriodicUpdates() {
    if (this.updateTask) {
      this.updateTask.stop();
    }
  }

  // Helper methods
  formatDate(date) {
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
  }

  formatTime(date) {
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const seconds = date.getUTCSeconds().toString().padStart(2, '0');
    return `${hours}${minutes}${seconds}`;
  }

  async fileExists(filepath) {
    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = new MRMSService();
