#!/usr/bin/env node
/**
 * Simple MRMS URL Test
 * Tests if MRMS URLs are accessible
 */

const axios = require('axios');

async function testMRMSUrl(url) {
  try {
    const response = await axios.head(url, { timeout: 10000 });
    console.log(`✅ FOUND: ${url}`);
    console.log(`   Size: ${(response.headers['content-length'] / 1024 / 1024).toFixed(2)} MB`);
    return true;
  } catch (error) {
    if (error.response) {
      console.log(`❌ NOT FOUND (${error.response.status}): ${url}`);
    } else {
      console.log(`❌ ERROR: ${error.message}`);
    }
    return false;
  }
}

async function main() {
  console.log('Testing MRMS URLs from NOAA AWS S3 bucket...\n');
  
  const now = new Date();
  const baseUrl = 'https://noaa-mrms-pds.s3.amazonaws.com';
  const product = 'CONUS/MergedReflectivityQCComposite_00.50';
  
  // Format date YYYYMMDD
  const year = now.getUTCFullYear();
  const month = (now.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = now.getUTCDate().toString().padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  
  console.log(`Date: ${dateStr} (${now.toISOString()})\n`);
  console.log('Testing recent 2-minute intervals...\n');
  
  let foundCount = 0;
  
  // Test last 10 intervals (20 minutes)
  for (let i = 0; i < 10; i++) {
    const testTime = new Date(now.getTime() - (i * 2 * 60 * 1000));
    const hours = testTime.getUTCHours().toString().padStart(2, '0');
    const minutes = Math.floor(testTime.getUTCMinutes() / 2) * 2;
    const timeStr = `${hours}${minutes.toString().padStart(2, '0')}00`;
    
    const url = `${baseUrl}/${product}/${dateStr}/MergedReflectivityQCComposite_00.50_${dateStr}-${timeStr}.grib2.gz`;
    
    const found = await testMRMSUrl(url);
    if (found) foundCount++;
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Found ${foundCount} out of 10 tested URLs`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  if (foundCount === 0) {
    console.log('⚠️  No MRMS files found. Possible reasons:');
    console.log('   1. MRMS data may have a delay');
    console.log('   2. The S3 bucket URL structure may have changed');
    console.log('   3. Network connectivity issues\n');
    console.log('Try checking manually:');
    console.log(`   aws s3 ls --no-sign-request s3://noaa-mrms-pds/${product}/${dateStr}/\n`);
  }
}

main().catch(console.error);
