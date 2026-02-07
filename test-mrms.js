#!/usr/bin/env node
/**
 * Test MRMS Service
 * Tests downloading, decompressing, and processing MRMS GRIB2 files
 */

const mrmsService = require('./backend/services/mrms.service');

console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║              MRMS SERVICE TEST                                 ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

async function testMRMS() {
  try {
    // Test 1: Load configuration
    console.log('1️⃣  Loading configuration...');
    await mrmsService.loadConfig();
    console.log('✅ Configuration loaded\n');
    
    // Test 2: Find latest MRMS file
    console.log('2️⃣  Finding latest MRMS file...');
    const latest = await mrmsService.getLatestMRMSUrl();
    console.log(`✅ Found: ${latest.dateStr}-${latest.timeStr}`);
    console.log(`   URL: ${latest.url}\n`);
    
    // Test 3: Download and process
    console.log('3️⃣  Downloading and processing MRMS data...');
    console.log('   (This may take 1-2 minutes...)\n');
    
    const result = await mrmsService.getLatestMRMS();
    
    console.log('\n✅ MRMS Processing Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 MRMS Data:');
    console.log(`   Timestamp: ${result.timestamp}`);
    console.log(`   Source: ${result.source}`);
    console.log(`   Product: ${result.product}`);
    console.log(`   Coverage: ${result.coverage}`);
    console.log(`   Resolution: ${result.resolution}`);
    console.log(`   Image: ${result.localPath}`);
    console.log(`   Size: ${(result.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   GRIB Size: ${(result.gribSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   API URL: ${result.url}\n`);
    
    // Test 4: Get loop
    console.log('4️⃣  Getting MRMS loop...');
    const loop = await mrmsService.getMRMSLoop(5);
    console.log(`✅ Found ${loop.length} MRMS images for animation\n`);
    
    if (loop.length > 0) {
      console.log('   Recent images:');
      loop.forEach((frame, i) => {
        console.log(`   ${i + 1}. ${frame.timestamp}`);
      });
    }
    
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║           🎉 ALL MRMS TESTS PASSED! 🎉                        ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');
    
    console.log('📝 Next steps:');
    console.log('   1. View image at: ' + result.localPath);
    console.log('   2. Access via API: http://localhost:3000' + result.url);
    console.log('   3. MRMS updates automatically every 5 minutes\n');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\n Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run test
testMRMS();
