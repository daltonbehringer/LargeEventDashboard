// Test radar API endpoints
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testRadarAPI() {
  console.log('🧪 Testing Radar API Endpoints...\n');
  
  try {
    // Test 1: Get latest radar
    console.log('Test 1: GET /api/radar/latest');
    const latestResponse = await axios.get(`${BASE_URL}/api/radar/latest`);
    console.log('✅ Status:', latestResponse.status);
    console.log('   Response:', JSON.stringify(latestResponse.data, null, 2));
    console.log('');
    
    // Wait a moment
    await sleep(1000);
    
    // Test 2: Get radar loop
    console.log('Test 2: GET /api/radar/loop');
    const loopResponse = await axios.get(`${BASE_URL}/api/radar/loop`);
    console.log('✅ Status:', loopResponse.status);
    console.log(`   Found ${loopResponse.data.length} radar frames`);
    if (loopResponse.data.length > 0) {
      console.log('   Latest frame:', loopResponse.data[0]);
    }
    console.log('');
    
    // Test 3: Get available MRMS files
    console.log('Test 3: GET /api/radar/mrms/available');
    const mrmsResponse = await axios.get(`${BASE_URL}/api/radar/mrms/available`);
    console.log('✅ Status:', mrmsResponse.status);
    console.log(`   Found ${mrmsResponse.data.length} available time slots`);
    console.log('');
    
    // Test 4: Get radar by timestamp
    if (latestResponse.data.timestamp) {
      console.log('Test 4: GET /api/radar/image/:timestamp');
      const timestamp = latestResponse.data.timestamp;
      const imageResponse = await axios.get(`${BASE_URL}/api/radar/image/${encodeURIComponent(timestamp)}`);
      console.log('✅ Status:', imageResponse.status);
      console.log('   Format:', imageResponse.data.format);
      console.log('   Content Type:', imageResponse.data.contentType);
      console.log('   Data size:', imageResponse.data.size || 'N/A');
      console.log('');
    }
    
    console.log('🎉 All API tests passed!');
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Error: Server is not running!');
      console.error('   Please start the server with: npm start');
    } else if (error.response) {
      console.error('❌ API Error:', error.response.status, error.response.statusText);
      console.error('   Response:', error.response.data);
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

testRadarAPI().then(() => process.exit(0));
