const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const cron = require('node-cron');

const CONFIG_PATH = path.join(__dirname, '../../config/event.config.json');
const RADAR_CACHE_PATH = path.join(__dirname, '../../data/radar');

class RadarService {
  constructor() {
    this.config = null;
    this.updateTask = null;
    this.radarStation = null;
  }

  async loadConfig() {
    const configData = await fs.readFile(CONFIG_PATH, 'utf8');
    this.config = JSON.parse(configData);
    return this.config;
  }

  async findNearestRadarStation() {
    if (!this.config) await this.loadConfig();
    
    // Calculate nearest radar station based on event location
    const lat = this.config.event.latitude;
    const lon = this.config.event.longitude;
    
    // Common NEXRAD stations with approximate locations
    const stations = [
      { id: 'KMUX', lat: 37.155, lon: -121.898, name: 'San Francisco Bay Area' },
      { id: 'KDAX', lat: 38.501, lon: -121.678, name: 'Sacramento' },
      { id: 'KHNX', lat: 36.314, lon: -119.632, name: 'San Joaquin Valley' },
      { id: 'KOKX', lat: 40.866, lon: -72.864, name: 'New York' },
      { id: 'KDOX', lat: 38.826, lon: -75.440, name: 'Philadelphia' },
      { id: 'KLWX', lat: 38.975, lon: -77.478, name: 'Washington DC' },
    ];
    
    // Find nearest station
    let nearest = stations[0];
    let minDist = this.calculateDistance(lat, lon, nearest.lat, nearest.lon);
    
    for (const station of stations) {
      const dist = this.calculateDistance(lat, lon, station.lat, station.lon);
      if (dist < minDist) {
        minDist = dist;
        nearest = station;
      }
    }
    
    this.radarStation = nearest.id;
    console.log(`Selected radar station: ${nearest.id} (${nearest.name}), ${minDist.toFixed(1)}km away`);
    
    return this.radarStation;
  }
  
  calculateDistance(lat1, lon1, lat2, lon2) {
    // Haversine formula for distance between two points
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  async getLatestRadar() {
    try {
      if (!this.radarStation) await this.findNearestRadarStation();
      
      // Use Weather.gov station radar with Python enhancement
      // This provides actual radar imagery with proper visualization
      const station = this.radarStation;
      const timestamp = new Date().toISOString();
      const pngFilename = `radar_${timestamp.replace(/:/g, '-').replace(/\./g, '-')}.png`;
      const pngPath = path.join(RADAR_CACHE_PATH, pngFilename);
      
      await fs.mkdir(RADAR_CACHE_PATH, { recursive: true });
      
      console.log(`Fetching NEXRAD radar for station ${station}...`);
      
      const processorPath = path.join(__dirname, '../utils/simple_radar.py');
      
      // Use venv Python if available, otherwise system Python
      const venvPython = path.join(__dirname, '../../venv/bin/python');
      const pythonCmd = require('fs').existsSync(venvPython) ? venvPython : 'python3';
      
      const { spawn } = require('child_process');
      const pythonProcess = spawn(pythonCmd, [processorPath, station, pngPath]);
      
      await new Promise((resolve, reject) => {
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
            resolve();
          } else {
            reject(new Error(`Radar processor failed with code ${code}: ${error}`));
          }
        });
        
        setTimeout(() => reject(new Error('Radar processing timeout')), 30000);
      });
      
      // Verify PNG was created
      const pngStats = await fs.stat(pngPath);
      console.log(`✅ Radar image ready: ${pngFilename} (${(pngStats.size / 1024).toFixed(1)} KB)`);
      
      const imageUrl = `/api/radar/image/${encodeURIComponent(timestamp)}`;
      
      return {
        timestamp,
        station,
        source: 'NOAA NEXRAD',
        product: 'Base Reflectivity',
        url: imageUrl, // For frontend compatibility
        imageUrl: imageUrl,
        localPath: pngPath,
        format: 'png',
        size: pngStats.size
      };
      
    } catch (error) {
      console.error('Error fetching/processing radar:', error.message);
      
      // Fallback: Try raw GIF download
      return this.getWeatherGovRadarRaw();
    }
  }
  
  async getWeatherGovRadarRaw() {
    try {
      if (!this.radarStation) await this.findNearestRadarStation();
      
      const station = this.radarStation;
      // Use weather.gov radar images (raw GIF)
      const fallbackUrl = `https://radar.weather.gov/ridge/standard/${station}_0.gif`;
      
      console.log(`Trying raw Weather.gov radar: ${fallbackUrl}`);
      
      const response = await axios.get(fallbackUrl, {
        responseType: 'arraybuffer',
        timeout: 30000
      });
      
      const timestamp = new Date().toISOString();
      const filename = `radar_${timestamp.replace(/:/g, '-').replace(/\./g, '-')}.gif`;
      const filepath = path.join(RADAR_CACHE_PATH, filename);
      
      await fs.mkdir(RADAR_CACHE_PATH, { recursive: true });
      await fs.writeFile(filepath, response.data);
      
      console.log(`✅ Weather.gov radar saved: ${filename} (${(response.data.length / 1024).toFixed(1)} KB)`);
      
      return {
        timestamp,
        station,
        source: 'NOAA Weather.gov (raw)',
        product: 'Base Reflectivity',
        imageUrl: `/api/radar/image/${encodeURIComponent(timestamp)}`,
        localPath: filepath,
        format: 'gif',
        size: response.data.length
      };
    } catch (error) {
      console.error('Weather.gov radar fetch failed:', error.message);
      return this.createMockRadar();
    }
  }
  
  async createMockRadar() {
    console.log('Creating mock radar data for testing...');
    
    const timestamp = new Date().toISOString();
    const filename = `radar_${timestamp.replace(/:/g, '-').replace(/\./g, '-')}.json`;
    const filepath = path.join(RADAR_CACHE_PATH, filename);
    
    const mockData = {
      timestamp,
      station: this.radarStation || 'MOCK',
      source: 'Mock Data (No Live Data Available)',
      product: 'Test Pattern',
      imageUrl: `/api/radar/image/${encodeURIComponent(timestamp)}`,
      localPath: filepath,
      format: 'json',
      message: 'Live radar data temporarily unavailable. This is test data.',
      coordinates: this.config?.event ? {
        latitude: this.config.event.latitude,
        longitude: this.config.event.longitude,
        location: this.config.event.location
      } : null
    };
    
    await fs.mkdir(RADAR_CACHE_PATH, { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(mockData, null, 2));
    
    return mockData;
  }

  async getRadarLoop() {
    // Return list of recent radar images for animation
    try {
      const files = await fs.readdir(RADAR_CACHE_PATH);
      const radarFiles = files
        .filter(f => f.startsWith('radar_') && (f.endsWith('.png') || f.endsWith('.gif') || f.endsWith('.grib2.gz') || f.endsWith('.json')))
        .sort()
        .reverse()
        .slice(0, 10); // Last 10 frames
      
      return radarFiles.map(f => {
        const ext = path.extname(f);
        return {
          filename: f,
          url: `/data/radar/${f}`,
          format: ext.replace('.', ''),
          timestamp: f.replace('radar_', '').replace(ext, '').replace(/-/g, ':')
        };
      });
    } catch (error) {
      console.error('Error getting radar loop:', error.message);
      return [];
    }
  }

  async getRadarByTimestamp(timestamp) {
    // Try to find the file with various extensions
    const baseFilename = `radar_${timestamp.replace(/:/g, '-').replace(/\./g, '-')}`;
    const extensions = ['.png', '.gif', '.grib2.gz', '.json'];
    
    for (const ext of extensions) {
      const filename = baseFilename + ext;
      const filepath = path.join(RADAR_CACHE_PATH, filename);
      
      try {
        const data = await fs.readFile(filepath);
        
        // Determine content type
        let contentType = 'application/octet-stream';
        if (ext === '.png') contentType = 'image/png';
        else if (ext === '.gif') contentType = 'image/gif';
        else if (ext === '.json') contentType = 'application/json';
        else if (ext === '.grib2.gz') contentType = 'application/gzip';
        
        return {
          timestamp,
          data: ext === '.json' ? JSON.parse(data.toString()) : data.toString('base64'),
          contentType,
          format: ext.replace('.', ''),
          size: data.length
        };
      } catch (error) {
        // Try next extension
        continue;
      }
    }
    
    return { error: 'Radar image not found' };
  }

  async listAvailableMRMSFiles(date = new Date()) {
    // List available MRMS files for a given date
    // This helps find the most recent available data
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    
    try {
      // Since S3 bucket is public, we can construct URLs for recent times
      const files = [];
      const now = new Date();
      
      // Check last 30 minutes worth of 2-minute intervals
      for (let i = 0; i < 15; i++) {
        const checkTime = new Date(now.getTime() - (i * 2 * 60 * 1000));
        const minutes = Math.floor(checkTime.getUTCMinutes() / 2) * 2;
        const timeStr = `${checkTime.getUTCHours().toString().padStart(2, '0')}${minutes.toString().padStart(2, '0')}00`;
        const checkDateStr = checkTime.toISOString().slice(0, 10).replace(/-/g, '');
        
        files.push({
          date: checkDateStr,
          time: timeStr,
          url: `https://noaa-mrms-pds.s3.amazonaws.com/CONUS/MergedReflectivityAtLowestAltitude_00.50/${checkDateStr}/MergedReflectivityQCComposite_00.50_${checkDateStr}-${timeStr}.grib2.gz`
        });
      }
      
      return files;
    } catch (error) {
      console.error('Error listing MRMS files:', error.message);
      return [];
    }
  }

  async cleanupOldRadar() {
    try {
      const files = await fs.readdir(RADAR_CACHE_PATH);
      const maxFiles = this.config?.dataRetention?.maxRadarImages || 20;
      
      const radarFiles = files
        .filter(f => f.startsWith('radar_'))
        .map(f => ({
          name: f,
          path: path.join(RADAR_CACHE_PATH, f)
        }));
      
      // Sort by filename (which includes timestamp)
      radarFiles.sort((a, b) => b.name.localeCompare(a.name));
      
      // Delete old files
      const filesToDelete = radarFiles.slice(maxFiles);
      for (const file of filesToDelete) {
        await fs.unlink(file.path);
        console.log(`🗑️  Cleaned up old radar: ${file.name}`);
      }
      
      if (filesToDelete.length > 0) {
        console.log(`Cleanup complete: removed ${filesToDelete.length} old radar files`);
      }
    } catch (error) {
      console.error('Error cleaning up radar:', error.message);
    }
  }

  startPeriodicUpdates() {
    // Update every 2 minutes
    this.updateTask = cron.schedule('*/2 * * * *', async () => {
      console.log('🔄 Updating radar data...');
      await this.getLatestRadar();
      await this.cleanupOldRadar();
    });
    
    // Initial update
    this.getLatestRadar();
  }

  stopPeriodicUpdates() {
    if (this.updateTask) {
      this.updateTask.stop();
    }
  }
}

module.exports = new RadarService();
