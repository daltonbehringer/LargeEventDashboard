// Test script for radar data flow
const radarService = require('./backend/services/radar.service');
const path = require('path');
const fs = require('fs').promises;

async function testRadarDataFlow() {
  console.log('🧪 Testing Radar Data Flow from AWS MRMS...\n');

  try {
    // Test 1: Load configuration
    console.log('Test 1: Loading configuration...');
    const config = await radarService.loadConfig();
    console.log('✅ Config loaded:', JSON.stringify(config.event, null, 2));
    console.log('');

    // Test 2: Find nearest radar station
    console.log('Test 2: Finding nearest radar station...');
    const station = await radarService.findNearestRadarStation();
    console.log(`✅ Radar station: ${station}`);
    console.log('');

    // Test 3: List available MRMS files
    console.log('Test 3: Listing available MRMS files...');
    const availableFiles = await radarService.listAvailableMRMSFiles();
    console.log(`✅ Found ${availableFiles.length} potential MRMS files`);
    console.log('Recent files:');
    availableFiles.slice(0, 5).forEach((file, i) => {
      console.log(`  ${i + 1}. Date: ${file.date}, Time: ${file.time}Z`);
    });
    console.log('');

    // Test 4: Fetch latest radar data
    console.log('Test 4: Fetching latest radar data from AWS...');
    console.log('(This may take 10-30 seconds...)');
    const radarData = await radarService.getLatestRadar();
    
    if (radarData.error) {
      console.log('❌ Error fetching radar:', radarData.error);
    } else {
      console.log('✅ Radar data fetched successfully!');
      console.log('  Source:', radarData.source);
      console.log('  Product:', radarData.product);
      console.log('  Timestamp:', radarData.timestamp);
      console.log('  MRMS Time:', radarData.mrmsTime);
      console.log('  Local Path:', radarData.localPath);
      
      // Verify file exists and check size
      try {
        const stats = await fs.stat(radarData.localPath);
        console.log(`  File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      } catch (err) {
        console.log('  ⚠️  Warning: File not found at local path');
      }
    }
    console.log('');

    // Test 5: Get radar loop
    console.log('Test 5: Getting radar loop...');
    const loop = await radarService.getRadarLoop();
    console.log(`✅ Found ${loop.length} radar frames for animation`);
    if (loop.length > 0) {
      console.log('  Latest frame:', loop[0].filename);
    }
    console.log('');

    // Test 6: Cleanup test
    console.log('Test 6: Testing cleanup function...');
    await radarService.cleanupOldRadar();
    console.log('✅ Cleanup completed');
    console.log('');

    console.log('🎉 All tests completed!');
    console.log('\n📊 Summary:');
    console.log(`  - Configuration: ${config.event.name}`);
    console.log(`  - Location: ${config.event.location} (${config.event.latitude}, ${config.event.longitude})`);
    console.log(`  - Radar Station: ${station}`);
    console.log(`  - Data Source: NOAA MRMS via AWS S3`);
    console.log(`  - Status: ${radarData.error ? '❌ Failed' : '✅ Success'}`);

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    console.error('Stack trace:', error.stack);
  }

  process.exit(0);
}

// Run the test
testRadarDataFlow();
