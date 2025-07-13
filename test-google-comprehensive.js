#!/usr/bin/env node

// Comprehensive test of Google Geocoding API to understand the pattern
import { config } from 'dotenv';
import fetch from 'node-fetch';

config({ path: '.env.local' });

async function testGoogleComprehensive() {
  console.log('🌐 Comprehensive Google Geocoding Test');
  console.log('======================================\n');
  
  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;
  
  // Test different types of queries
  const testCategories = {
    'Major Cities': [
      'New York',
      'San Francisco', 
      'Los Angeles',
      'Chicago',
      'Paris',
      'London',
      'Tokyo'
    ],
    'Landmarks': [
      'Disney World',
      'Walt Disney World',
      'Universal Studios',
      'Times Square',
      'Central Park',
      'Golden Gate Bridge',
      'Statue of Liberty'
    ],
    'Geographic Features': [
      'Cape Cod',
      'Yellowstone National Park',
      'Grand Canyon',
      'Niagara Falls'
    ],
    'Ambiguous Locations': [
      'Portland',
      'Springfield',
      'Cambridge',
      'Berlin'
    ]
  };

  for (const [category, queries] of Object.entries(testCategories)) {
    console.log(`\n📍 ${category}`);
    console.log('='.repeat(category.length + 4));
    
    for (const query of queries) {
      await testSingleQuery(query, apiKey);
    }
  }
}

async function testSingleQuery(query, apiKey) {
  try {
    const params = new URLSearchParams({
      address: query,
      key: apiKey
    });

    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    const data = await response.json();
    
    console.log(`🎯 "${query}": ${data.status}`);
    
    if (data.status === 'OK' && data.results?.length > 0) {
      const result = data.results[0];
      console.log(`   ✅ ${result.formatted_address}`);
      console.log(`   📍 [${result.geometry.location.lat}, ${result.geometry.location.lng}]`);
      
      // Show additional results for ambiguous queries
      if (data.results.length > 1) {
        console.log(`   🔄 ${data.results.length - 1} alternatives available`);
        data.results.slice(1, 3).forEach((alt, i) => {
          console.log(`      ${i + 2}. ${alt.formatted_address}`);
        });
      }
    } else if (data.status === 'REQUEST_DENIED') {
      console.log(`   ❌ REQUEST_DENIED: ${data.error_message || 'No message'}`);
    } else {
      console.log(`   ⚠️ ${data.status}: ${data.error_message || 'No results'}`);
    }
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
}

async function analyzeResults() {
  console.log('\n📊 Analysis');
  console.log('===========\n');
  
  console.log('Based on the test results above:');
  console.log('');
  console.log('✅ WORKING queries typically:');
  console.log('   - Are major city names');
  console.log('   - Are well-known locations');
  console.log('   - Don\'t have complex formatting');
  console.log('');
  console.log('❌ FAILING queries might:');
  console.log('   - Still have some API restrictions');
  console.log('   - Be related to specific query types');
  console.log('   - Have caching issues (try again in a few minutes)');
  console.log('');
  console.log('💡 Next steps:');
  console.log('   1. Check if pattern is consistent');
  console.log('   2. Wait a few minutes and test again (API changes can take time)');
  console.log('   3. Compare Google results with Mapbox/Nominatim');
}

async function main() {
  await testGoogleComprehensive();
  await analyzeResults();
}

main().catch(console.error);