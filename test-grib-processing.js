#!/usr/bin/env node
/**
 * Test GRIB2 download and processing
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

async function testGribProcessing() {
  console.log('🧪 Testing GRIB2 Download and Processing...\n');
  
  try {
    // Try to get recent MRMS data
    const now = new Date();
    let gribData = null;
    let mrmsTime = null;
    
    console.log('Searching for recent MRMS data...');
    
    for (let offset = 0; offset < 20; offset++) {
      const checkTime = new Date(now.getTime() - (offset * 2 * 60 * 1000));
      const minutes = Math.floor(checkTime.getUTCMinutes() / 2) * 2;
      const timeStr = `${checkTime.getUTCHours().toString().padStart(2, '0')}${minutes.toString().padStart(2, '0')}00`;
      const dateStr = checkTime.toISOString().slice(0, 10).replace(/-/g, '');
      
      const mrmsUrl = `https://noaa-mrms-pds.s3.amazonaws.com/CONUS/MergedReflectivityQCComposite_00.50/${dateStr}/MergedReflectivityQCComposite_00.50_${dateStr}-${timeStr}.grib2.gz`;
      
      try {
        process.stdout.write(`\rTrying ${dateStr}-${timeStr} (${offset * 2}min ago)...`);
        const response = await axios.head(mrmsUrl, { timeout: 5000 });
        
        if (response.status === 200) {
          console.log(`\n✅ Found MRMS data: ${dateStr}-${timeStr}`);
          console.log(`   Size: ${(response.headers['content-length'] / 1024 / 1024).toFixed(2)} MB`);
          
          // Download it
          console.log('   Downloading...');
          const dataResponse = await axios.get(mrmsUrl, {
            responseType: 'arraybuffer',
            timeout: 30000
          });
          
          gribData = dataResponse.data;
          mrmsTime = `${dateStr}-${timeStr}`;
          break;
        }
      } catch (err) {
        continue;
      }
    }
    
    if (!gribData) {
      console.log('\n❌ No recent MRMS data found in last 40 minutes');
      return;
    }
    
    // Save GRIB file
    const testDir = path.join(__dirname, 'test_radar');
    await fs.mkdir(testDir, { recursive: true });
    
    const gribPath = path.join(testDir, `test_${mrmsTime}.grib2.gz`);
    await fs.writeFile(gribPath, gribData);
    console.log(`✅ GRIB2 saved: ${gribPath}`);
    console.log(`   Size: ${(gribData.length / 1024 / 1024).toFixed(2)} MB\n`);
    
    // Process with Python
    const pngPath = path.join(testDir, `test_${mrmsTime}.png`);
    const processorPath = path.join(__dirname, 'backend/utils/grib_processor.py');
    
    // Levi's Stadium coordinates
    const lat = 37.403;
    const lon = -121.970;
    
    console.log('Processing GRIB2 to PNG...');
    console.log(`Event location: ${lat}, ${lon}`);
    console.log(`Bounds: lat ${lat-5} to ${lat+5}, lon ${lon-5} to ${lon+5}\n`);
    
    const pythonProcess = spawn('python3', [
      processorPath,
      gribPath,
      pngPath,
      lat - 5, lat + 5, lon - 5, lon + 5
    ]);
    
    pythonProcess.stdout.on('data', (data) => {
      console.log(data.toString().trim());
    });
    
    pythonProcess.stderr.on('data', (data) => {
      console.error(data.toString().trim());
    });
    
    await new Promise((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Python process exited with code ${code}`));
        }
      });
      
      setTimeout(() => reject(new Error('Timeout')), 60000);
    });
    
    // Check output
    const stats = await fs.stat(pngPath);
    console.log(`\n✅ PNG created: ${pngPath}`);
    console.log(`   Size: ${(stats.size / 1024).toFixed(1)} KB`);
    console.log(`\n🎉 Test complete! Opening image...`);
    
    // Open the image
    const { exec } = require('child_process');
    exec(`open "${pngPath}"`);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testGribProcessing();
