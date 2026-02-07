#!/usr/bin/env node

/**
 * Radar System Validation Script
 * Performs comprehensive checks on the radar data flow system
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

const RADAR_DIR = path.join(__dirname, 'data/radar');
const BASE_URL = 'http://localhost:3000';

async function validateRadarSystem() {
  console.log(`${BLUE}╔════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BLUE}║   Radar Data Flow Validation System           ║${RESET}`);
  console.log(`${BLUE}╚════════════════════════════════════════════════╝${RESET}\n`);

  const results = {
    passed: 0,
    failed: 0,
    warnings: 0
  };

  // Test 1: Check radar directory exists
  console.log(`${BLUE}[1/8]${RESET} Checking radar directory...`);
  try {
    const stats = await fs.stat(RADAR_DIR);
    if (stats.isDirectory()) {
      console.log(`${GREEN}✓${RESET} Radar directory exists: ${RADAR_DIR}\n`);
      results.passed++;
    }
  } catch (error) {
    console.log(`${RED}✗${RESET} Radar directory not found\n`);
    results.failed++;
  }

  // Test 2: Check for radar files
  console.log(`${BLUE}[2/8]${RESET} Checking cached radar files...`);
  try {
    const files = await fs.readdir(RADAR_DIR);
    const radarFiles = files.filter(f => f.startsWith('radar_'));
    if (radarFiles.length > 0) {
      console.log(`${GREEN}✓${RESET} Found ${radarFiles.length} radar files`);
      console.log(`   Latest: ${radarFiles[radarFiles.length - 1]}\n`);
      results.passed++;
    } else {
      console.log(`${YELLOW}⚠${RESET} No radar files found (may need time to populate)\n`);
      results.warnings++;
    }
  } catch (error) {
    console.log(`${RED}✗${RESET} Error reading radar files: ${error.message}\n`);
    results.failed++;
  }

  // Test 3: Check server is running
  console.log(`${BLUE}[3/8]${RESET} Checking server status...`);
  try {
    await axios.get(`${BASE_URL}/api/config/event`, { timeout: 3000 });
    console.log(`${GREEN}✓${RESET} Server is running at ${BASE_URL}\n`);
    results.passed++;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log(`${RED}✗${RESET} Server is not running\n`);
      console.log(`   Start with: ${YELLOW}npm start${RESET}\n`);
      results.failed++;
      return results;
    }
  }

  // Test 4: Check radar latest endpoint
  console.log(`${BLUE}[4/8]${RESET} Testing /api/radar/latest endpoint...`);
  try {
    const response = await axios.get(`${BASE_URL}/api/radar/latest`);
    if (response.data && response.data.timestamp) {
      console.log(`${GREEN}✓${RESET} Endpoint working`);
      console.log(`   Station: ${response.data.station}`);
      console.log(`   Source: ${response.data.source}`);
      console.log(`   Format: ${response.data.format}`);
      console.log(`   Size: ${(response.data.size / 1024).toFixed(1)} KB\n`);
      results.passed++;
    } else {
      console.log(`${YELLOW}⚠${RESET} Endpoint returned unexpected data\n`);
      results.warnings++;
    }
  } catch (error) {
    console.log(`${RED}✗${RESET} Endpoint failed: ${error.message}\n`);
    results.failed++;
  }

  // Test 5: Check radar loop endpoint
  console.log(`${BLUE}[5/8]${RESET} Testing /api/radar/loop endpoint...`);
  try {
    const response = await axios.get(`${BASE_URL}/api/radar/loop`);
    if (Array.isArray(response.data)) {
      console.log(`${GREEN}✓${RESET} Endpoint working`);
      console.log(`   Available frames: ${response.data.length}\n`);
      results.passed++;
    } else {
      console.log(`${YELLOW}⚠${RESET} Endpoint returned non-array data\n`);
      results.warnings++;
    }
  } catch (error) {
    console.log(`${RED}✗${RESET} Endpoint failed: ${error.message}\n`);
    results.failed++;
  }

  // Test 6: Check MRMS available endpoint
  console.log(`${BLUE}[6/8]${RESET} Testing /api/radar/mrms/available endpoint...`);
  try {
    const response = await axios.get(`${BASE_URL}/api/radar/mrms/available`);
    if (Array.isArray(response.data) && response.data.length > 0) {
      console.log(`${GREEN}✓${RESET} Endpoint working`);
      console.log(`   Time slots available: ${response.data.length}\n`);
      results.passed++;
    } else {
      console.log(`${YELLOW}⚠${RESET} Endpoint returned empty data\n`);
      results.warnings++;
    }
  } catch (error) {
    console.log(`${RED}✗${RESET} Endpoint failed: ${error.message}\n`);
    results.failed++;
  }

  // Test 7: Check image retrieval
  console.log(`${BLUE}[7/8]${RESET} Testing radar image retrieval...`);
  try {
    const latestResponse = await axios.get(`${BASE_URL}/api/radar/latest`);
    if (latestResponse.data.timestamp) {
      const imageResponse = await axios.get(
        `${BASE_URL}/api/radar/image/${encodeURIComponent(latestResponse.data.timestamp)}`
      );
      if (imageResponse.data.data || imageResponse.data.error === undefined) {
        console.log(`${GREEN}✓${RESET} Image retrieval working`);
        console.log(`   Content-Type: ${imageResponse.data.contentType}\n`);
        results.passed++;
      } else {
        console.log(`${RED}✗${RESET} Image not found\n`);
        results.failed++;
      }
    }
  } catch (error) {
    console.log(`${RED}✗${RESET} Image retrieval failed: ${error.message}\n`);
    results.failed++;
  }

  // Test 8: Validate file integrity
  console.log(`${BLUE}[8/8]${RESET} Validating file integrity...`);
  try {
    const files = await fs.readdir(RADAR_DIR);
    const radarFiles = files.filter(f => f.startsWith('radar_'));
    let validFiles = 0;
    
    for (const file of radarFiles) {
      const filePath = path.join(RADAR_DIR, file);
      const stats = await fs.stat(filePath);
      if (stats.size > 0) {
        validFiles++;
      }
    }
    
    if (validFiles === radarFiles.length && radarFiles.length > 0) {
      console.log(`${GREEN}✓${RESET} All ${validFiles} files are valid (non-zero size)\n`);
      results.passed++;
    } else if (radarFiles.length === 0) {
      console.log(`${YELLOW}⚠${RESET} No files to validate\n`);
      results.warnings++;
    } else {
      console.log(`${RED}✗${RESET} Some files are corrupted (${validFiles}/${radarFiles.length} valid)\n`);
      results.failed++;
    }
  } catch (error) {
    console.log(`${RED}✗${RESET} Validation failed: ${error.message}\n`);
    results.failed++;
  }

  // Summary
  console.log(`${BLUE}═══════════════════════════════════════════════════${RESET}`);
  console.log(`${BLUE}VALIDATION SUMMARY${RESET}`);
  console.log(`${BLUE}═══════════════════════════════════════════════════${RESET}`);
  console.log(`${GREEN}✓ Passed:  ${results.passed}${RESET}`);
  console.log(`${RED}✗ Failed:  ${results.failed}${RESET}`);
  console.log(`${YELLOW}⚠ Warnings: ${results.warnings}${RESET}`);
  console.log(`${BLUE}═══════════════════════════════════════════════════${RESET}\n`);

  if (results.failed === 0 && results.warnings === 0) {
    console.log(`${GREEN}🎉 All systems operational!${RESET}\n`);
    return 0;
  } else if (results.failed === 0) {
    console.log(`${YELLOW}⚠️  System working with warnings${RESET}\n`);
    return 0;
  } else {
    console.log(`${RED}❌ System has failures that need attention${RESET}\n`);
    return 1;
  }
}

validateRadarSystem()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    console.error(`${RED}Fatal error:${RESET}`, error);
    process.exit(1);
  });
