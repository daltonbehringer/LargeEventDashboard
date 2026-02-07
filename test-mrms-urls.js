// Quick test to check MRMS availability
const axios = require('axios');

async function testMRMSUrls() {
  console.log('Testing MRMS URL patterns...\n');
  
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  
  // Try different time offsets
  const tests = [];
  for (let i = 0; i < 60; i += 2) {
    const testTime = new Date(now.getTime() - (i * 60 * 1000));
    const minutes = Math.floor(testTime.getUTCMinutes() / 2) * 2;
    const timeStr = `${testTime.getUTCHours().toString().padStart(2, '0')}${minutes.toString().padStart(2, '0')}00`;
    const testDateStr = testTime.toISOString().slice(0, 10).replace(/-/g, '');
    
    tests.push({
      offset: i,
      date: testDateStr,
      time: timeStr,
      url: `https://noaa-mrms-pds.s3.amazonaws.com/CONUS/MergedReflectivityQCComposite_00.50/${testDateStr}/MergedReflectivityQCComposite_00.50_${testDateStr}-${timeStr}.grib2.gz`
    });
  }
  
  console.log(`Testing ${tests.length} URLs (last 60 minutes)...`);
  
  for (const test of tests.slice(0, 10)) {
    try {
      console.log(`\nTrying ${test.date}-${test.time} (${test.offset}min ago)...`);
      const response = await axios.head(test.url, { timeout: 5000 });
      console.log(`✅ SUCCESS! Status: ${response.status}, Size: ${response.headers['content-length']} bytes`);
      console.log(`URL: ${test.url}`);
      return test;
    } catch (error) {
      if (error.response) {
        console.log(`❌ ${error.response.status}`);
      } else {
        console.log(`❌ ${error.message}`);
      }
    }
  }
  
  console.log('\n⚠️  No valid MRMS data found in recent time range');
  return null;
}

testMRMSUrls().then(() => process.exit(0));
