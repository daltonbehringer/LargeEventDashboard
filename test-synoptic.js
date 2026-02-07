#!/usr/bin/env node
/**
 * Test Synoptic API to find nearest station
 */

const axios = require('axios');

async function testSynopticAPI() {
  console.log('🧪 Testing Synoptic API...\n');
  
  const apiKey = 'e0fb17ad65504848934b1f1ece0c78f8';
  const lat = 37.403147;
  const lon = -121.969814;
  
  try {
    // Test 1: Get nearest station
    console.log('Test 1: Finding nearest station...');
    const nearestUrl = 'https://api.synopticdata.com/v2/stations/nearesttime';
    
    const params = {
      token: apiKey,
      radius: `${lat},${lon},50`, // Format: lat,lon,radius_km
      limit: 5,
      within: 120, // Last 120 minutes  
      vars: 'air_temp,dew_point_temperature,relative_humidity,wind_speed,wind_direction,wind_gust,visibility',
      output: 'json'
    };
    
    console.log('Request:', nearestUrl);
    console.log('Params:', JSON.stringify(params, null, 2));
    
    const response = await axios.get(nearestUrl, { params });
    
    console.log('\n✅ Response received:');
    console.log('Summary:', response.data.SUMMARY);
    
    if (response.data.STATION && response.data.STATION.length > 0) {
      console.log(`\nFound ${response.data.STATION.length} stations:\n`);
      response.data.STATION.forEach((station, i) => {
        console.log(`${i + 1}. ${station.STID} - ${station.NAME}`);
        console.log(`   Location: ${station.LATITUDE}, ${station.LONGITUDE}`);
        console.log(`   Distance: ${station.DISTANCE?.toFixed(2)} km`);
        console.log(`   Elevation: ${station.ELEVATION} m`);
        console.log('');
      });
      
      // Test 2: Get latest observations from nearest station
      console.log('\nTest 2: Getting latest observations from nearest station...');
      const stationId = response.data.STATION[0].STID;
      
      const obsUrl = 'https://api.synopticdata.com/v2/stations/timeseries';
      const obsParams = {
        token: apiKey,
        stid: stationId,
        recent: 120, // Last 2 hours
        vars: 'air_temp,dew_point_temperature,relative_humidity,wind_speed,wind_direction,wind_gust,visibility',
        output: 'json'
      };
      
      const obsResponse = await axios.get(obsUrl, { params: obsParams });
      
      if (obsResponse.data.STATION && obsResponse.data.STATION.length > 0) {
        const station = obsResponse.data.STATION[0];
        const obs = station.OBSERVATIONS;
        
        console.log(`\n✅ Latest observations from ${station.STID} (${station.NAME}):`);
        
        if (obs.air_temp_set_1) {
          console.log(`   Temperature: ${obs.air_temp_set_1.value[obs.air_temp_set_1.value.length - 1]}°C`);
        }
        if (obs.relative_humidity_set_1) {
          console.log(`   Humidity: ${obs.relative_humidity_set_1.value[obs.relative_humidity_set_1.value.length - 1]}%`);
        }
        if (obs.wind_speed_set_1) {
          console.log(`   Wind Speed: ${obs.wind_speed_set_1.value[obs.wind_speed_set_1.value.length - 1]} m/s`);
        }
        if (obs.wind_direction_set_1) {
          console.log(`   Wind Direction: ${obs.wind_direction_set_1.value[obs.wind_direction_set_1.value.length - 1]}°`);
        }
        
        console.log('\n✅ Full observation data:');
        console.log(JSON.stringify(obs, null, 2));
      }
      
    } else {
      console.log('❌ No stations found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testSynopticAPI();
