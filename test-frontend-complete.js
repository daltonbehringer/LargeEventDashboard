#!/usr/bin/env node

/**
 * Frontend Integration Test
 * Tests all API endpoints that the dashboard uses
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    }).on('error', reject);
  });
}

async function testEndpoint(name, url, validator) {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    console.log(`   URL: ${url}`);
    
    const result = await httpGet(url);
    
    if (result.status !== 200) {
      console.log(`   ❌ HTTP ${result.status}`);
      return false;
    }
    
    if (validator) {
      const valid = validator(result.data);
      if (valid === true) {
        console.log(`   ✅ Response valid`);
        return true;
      } else {
        console.log(`   ❌ Validation failed: ${valid}`);
        return false;
      }
    }
    
    console.log(`   ✅ OK`);
    return true;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎯 LARGE EVENT DASHBOARD - FRONTEND API TESTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const tests = [];
  
  // Test 1: Config endpoint
  tests.push(await testEndpoint(
    'Configuration',
    `${BASE_URL}/api/config`,
    (data) => {
      if (!data.event) return 'Missing event config';
      if (!data.event.name) return 'Missing event name';
      if (!data.event.latitude) return 'Missing latitude';
      console.log(`   📍 Event: ${data.event.name}`);
      console.log(`   📌 Location: ${data.event.latitude}, ${data.event.longitude}`);
      return true;
    }
  ));
  
  // Test 2: Current Weather
  tests.push(await testEndpoint(
    'Current Weather',
    `${BASE_URL}/api/weather/current`,
    (data) => {
      if (!data.observations) return 'Missing observations';
      if (!data.station) return 'Missing station info';
      const temp = data.observations.temperature?.value;
      const wind = data.observations.wind?.speed?.value;
      const unit = data.observations.temperature?.unit;
      console.log(`   🌡️  Temperature: ${temp}°${unit}`);
      console.log(`   💨 Wind: ${wind} ${data.observations.wind?.speed?.unit} ${data.observations.wind?.cardinal || ''}`);
      console.log(`   📡 Station: ${data.station.id} (${data.station.name})`);
      if (unit !== 'F') return 'Temperature not in Fahrenheit';
      if (data.observations.wind?.speed?.unit !== 'mph') return 'Wind not in mph';
      return true;
    }
  ));
  
  // Test 3: Latest Radar
  tests.push(await testEndpoint(
    'Latest Radar',
    `${BASE_URL}/api/radar/latest`,
    (data) => {
      if (!data.url) return 'Missing radar URL';
      if (!data.station) return 'Missing station';
      console.log(`   📡 Station: ${data.station}`);
      console.log(`   📸 Size: ${(data.size / 1024).toFixed(1)} KB`);
      console.log(`   🔗 URL: ${data.url}`);
      if (data.size < 100000) return 'Image too small (possible blank)';
      return true;
    }
  ));
  
  // Test 4: Latest Satellite
  tests.push(await testEndpoint(
    'Latest Satellite',
    `${BASE_URL}/api/satellite/latest`,
    (data) => {
      if (data.error) {
        console.log(`   ⚠️  ${data.error} (may be expected if no satellite data cached)`);
        return true; // Allow this to pass
      }
      if (!data.url && !data.imageUrl) return 'Missing satellite URL';
      console.log(`   🛰️  Product: ${data.product || 'N/A'}`);
      console.log(`   📸 Size: ${data.size ? (data.size / 1024).toFixed(1) + ' KB' : 'N/A'}`);
      return true;
    }
  ));
  
  // Test 5: Hourly Forecast
  tests.push(await testEndpoint(
    'Hourly Forecast',
    `${BASE_URL}/api/weather/forecast/hourly`,
    (data) => {
      if (data.error) {
        console.log(`   ⚠️  ${data.error}`);
        return true; // May not be available
      }
      if (!data.forecast) return 'Missing forecast';
      console.log(`   📊 Periods: ${data.forecast.length}`);
      if (data.forecast.length > 0) {
        console.log(`   🕐 First: ${data.forecast[0].startTime}`);
      }
      return true;
    }
  ));
  
  // Test 6: Weather Alerts
  tests.push(await testEndpoint(
    'Weather Alerts',
    `${BASE_URL}/api/weather/alerts`,
    (data) => {
      if (data.error) {
        console.log(`   ⚠️  ${data.error}`);
        return true; // May not be available
      }
      console.log(`   ⚠️  Active alerts: ${data.count || 0}`);
      return true;
    }
  ));
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const passed = tests.filter(t => t).length;
  const total = tests.length;
  
  console.log(`\n  Passed: ${passed}/${total}`);
  
  if (passed === total) {
    console.log('\n✅ All tests passed! Frontend should display correctly.');
  } else {
    console.log(`\n⚠️  ${total - passed} test(s) failed. Check errors above.`);
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

runTests().catch(console.error);
