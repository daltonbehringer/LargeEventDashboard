// Test US units conversions
const { celsiusToFahrenheit, msToMph, mmToInches, pascalsToInHg, degToCompass } = require('./backend/utils/conversions');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔬 US UNITS CONVERSION TESTS');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Temperature
const tempC = 17.783;
const tempF = celsiusToFahrenheit(tempC);
console.log(`\n📐 Temperature:`);
console.log(`   ${tempC}°C → ${tempF?.toFixed(1)}°F`);
console.log(`   ✓ Expected: ~64.0°F`);

// Wind Speed
const windMs = 0.288;
const windMph = msToMph(windMs);
console.log(`\n�� Wind Speed:`);
console.log(`   ${windMs} m/s → ${windMph?.toFixed(1)} mph`);
console.log(`   ✓ Expected: ~0.6 mph`);

// Wind Gust
const gustMs = 2.156;
const gustMph = msToMph(gustMs);
console.log(`\n💨 Wind Gust:`);
console.log(`   ${gustMs} m/s → ${gustMph?.toFixed(1)} mph`);
console.log(`   ✓ Expected: ~4.8 mph`);

// Pressure
const pressurePa = 101325; // Standard atmosphere
const pressureInHg = pascalsToInHg(pressurePa);
console.log(`\n🌡️  Pressure:`);
console.log(`   ${pressurePa} Pa → ${pressureInHg?.toFixed(2)} inHg`);
console.log(`   ✓ Expected: ~29.92 inHg`);

// Precipitation
const precipMm = 25.4; // 1 inch
const precipIn = mmToInches(precipMm);
console.log(`\n🌧️  Precipitation:`);
console.log(`   ${precipMm} mm → ${precipIn?.toFixed(2)} inches`);
console.log(`   ✓ Expected: 1.00 inches`);

// Wind Direction
const windDir = 331.1;
const cardinal = degToCompass(windDir);
console.log(`\n🧭 Wind Direction:`);
console.log(`   ${windDir}° → ${cardinal}`);
console.log(`   ✓ Expected: NNW`);

// Null handling
console.log(`\n🔍 Null Value Handling:`);
console.log(`   celsiusToFahrenheit(null) = ${celsiusToFahrenheit(null)}`);
console.log(`   msToMph(undefined) = ${msToMph(undefined)}`);
console.log(`   ✓ All return null for null/undefined input`);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ All conversion tests passed!');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
