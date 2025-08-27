#!/usr/bin/env node

// Simple manual testing of individual workflow components
// Run without server dependency - direct service testing

import { geocodingService } from './api/services/geocoding.js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const TEST_LOCATION = 'Cape Cod';

async function testGeocodingDirect() {
  console.log('🧪 Testing Direct Geocoding Service');
  console.log('=====================================\n');
  
  console.log(`Test location: "${TEST_LOCATION}"`);
  console.log(`Environment check:`);
  console.log(`  MAPBOX_ACCESS_TOKEN: ${process.env.MAPBOX_ACCESS_TOKEN ? 'Present' : '❌ Missing'}`);
  console.log(`  GOOGLE_GEOCODING_API_KEY: ${process.env.GOOGLE_GEOCODING_API_KEY ? 'Present' : '❌ Missing'}`);
  console.log(`  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'Present' : '❌ Missing'}\n`);
  
  try {
    console.log(`🔍 Testing geocoding for: "${TEST_LOCATION}"`);
    
    const startTime = Date.now();
    const result = await geocodingService.geocode(TEST_LOCATION, {
      includeAlternatives: true,
      maxResults: 5,
      fuzzyMatching: true
    });
    const duration = Date.now() - startTime;
    
    if (!result) {
      console.log('❌ No geocoding results found');
      
      // Try fuzzy matching
      console.log('🔍 Trying fuzzy matching...');
      const fuzzyResults = await geocodingService.fuzzyGeocode(TEST_LOCATION, {
        maxResults: 3
      });
      
      if (fuzzyResults.length > 0) {
        console.log(`✅ Fuzzy matching found ${fuzzyResults.length} results:`);
        fuzzyResults.forEach((result, index) => {
          console.log(`  ${index + 1}. ${result.displayName} (confidence: ${result.confidence})`);
        });
      } else {
        console.log('❌ Fuzzy matching also failed');
      }
      return;
    }
    
    console.log(`✅ Geocoding successful (${duration}ms)`);
    console.log(`Result details:`);
    console.log(`  Location: ${result.location}`);
    console.log(`  Display Name: ${result.displayName}`);
    console.log(`  Confidence: ${result.confidence}`);
    console.log(`  Coordinates: ${result.coordinates.lat}, ${result.coordinates.lng}`);
    console.log(`  Type: ${result.type}`);
    console.log(`  Providers: ${result.providers.join(', ')}`);
    console.log(`  Components:`);
    console.log(`    City: ${result.components.city || 'N/A'}`);
    console.log(`    State: ${result.components.state || 'N/A'}`);
    console.log(`    Country: ${result.components.country || 'N/A'} (${result.components.countryCode || 'N/A'})`);
    
    if (result.alternatives && result.alternatives.length > 0) {
      console.log(`\n  Alternatives (${result.alternatives.length}):`);
      result.alternatives.forEach((alt, index) => {
        console.log(`    ${index + 1}. ${alt.displayName} (confidence: ${alt.confidence})`);
      });
    }
    
    // Analysis
    console.log(`\n📊 Analysis:`);
    console.log(`  This result shows why Cape Cod search is failing.`);
    
    if (result.displayName.includes('Cape Cod')) {
      console.log(`  ✅ Correctly found Cape Cod`);
    } else {
      console.log(`  ❌ DID NOT find Cape Cod - found "${result.displayName}" instead`);
      console.log(`  🔍 This is the core problem! The geocoding service is returning the wrong location.`);
    }
    
    if (result.components.country !== 'United States' && result.components.countryCode !== 'US') {
      console.log(`  ❌ Wrong country: ${result.components.country} (expected: United States)`);
    }
    
    if (result.confidence < 0.7) {
      console.log(`  ⚠️ Low confidence score: ${result.confidence}`);
    }
    
  } catch (error) {
    console.error('❌ Geocoding test failed:', error);
    console.error('Error details:', error.message);
  }
}

async function testLocationPreprocessing() {
  console.log('\n🧪 Testing Location Preprocessing');
  console.log('==================================\n');
  
  const testCases = [
    'Cape Cod',
    'cape cod',
    'Cape Cod for families',
    'Cape Cod area',
    'Cape Cod Massachusetts', 
    'Cape Cod, MA',
    'Cape Cod, Massachusetts'
  ];
  
  // Test preprocessing function from analyze-query.ts
  testCases.forEach(testCase => {
    // Since we removed hardcoded preprocessing, this should return the original
    const processed = testCase
      .replace(/\\s+for\\s+families?/gi, '')
      .replace(/\\s+area$/gi, '')
      .replace(/\\s+region$/gi, '')
      .trim();
    
    console.log(`"${testCase}" → "${processed}"`);
    
    if (processed !== testCase) {
      console.log(`  🔧 Preprocessing changed the input`);
    }
  });
}

async function main() {
  console.log('🚀 Starting Direct Component Testing');
  console.log('=====================================\n');
  
  await testLocationPreprocessing();
  await testGeocodingDirect();
  
  console.log('\n📋 Summary');
  console.log('==========');
  console.log('This test will show us exactly where Cape Cod geocoding fails.');
  console.log('The key question: Does the geocoding service return the right Cape Cod?');
}

main().catch(console.error);