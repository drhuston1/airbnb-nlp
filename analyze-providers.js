#!/usr/bin/env node

// Analyze different geocoding providers and their configurations
import { config } from 'dotenv';
import fetch from 'node-fetch';

config({ path: '.env.local' });

async function testMapboxConfigurations() {
  console.log('🗺️ Testing Different Mapbox Configurations');
  console.log('==========================================\n');
  
  const apiKey = process.env.MAPBOX_ACCESS_TOKEN;
  if (!apiKey) {
    console.log('❌ No Mapbox API key');
    return;
  }

  const testCases = [
    'Cape Cod',
    'Paris',
    'Portland',
    'London',
    'Berlin'
  ];

  for (const location of testCases) {
    console.log(`\n📍 Testing: "${location}"`);
    
    // Test 1: Default configuration (what we were using)
    await testMapboxConfig(location, apiKey, 'Default', {
      types: 'place,locality,neighborhood,address',
      limit: '5'
    });

    // Test 2: Geographic features prioritized
    await testMapboxConfig(location, apiKey, 'Geographic Focus', {
      types: 'place,locality,region,district',
      limit: '5'
    });

    // Test 3: Without address types (should reduce street name matches)
    await testMapboxConfig(location, apiKey, 'No Addresses', {
      types: 'place,locality,region',
      limit: '5'
    });
  }
}

async function testMapboxConfig(location, apiKey, configName, params) {
  try {
    const searchParams = new URLSearchParams({
      access_token: apiKey,
      ...params
    });

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json?${searchParams}`;
    
    const response = await fetch(url);
    if (!response.ok) return;

    const data = await response.json();
    
    console.log(`  ${configName}:`);
    if (data.features && data.features.length > 0) {
      data.features.slice(0, 3).forEach((feature, i) => {
        console.log(`    ${i + 1}. ${feature.place_name} (${feature.place_type?.join(',') || 'unknown'}) [${feature.relevance}]`);
      });
    } else {
      console.log(`    No results`);
    }
  } catch (error) {
    console.log(`    Error: ${error.message}`);
  }
}

async function testGoogleGeocoding() {
  console.log('\n🌐 Testing Google Geocoding API');
  console.log('===============================\n');
  
  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;
  if (!apiKey) {
    console.log('❌ No Google API key');
    return;
  }

  const testCases = ['Cape Cod', 'Paris', 'Portland', 'London'];

  for (const location of testCases) {
    console.log(`📍 Testing: "${location}"`);
    
    try {
      const params = new URLSearchParams({
        address: location,
        key: apiKey
      });

      const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
      
      if (!response.ok) {
        console.log(`  Error: ${response.status}`);
        continue;
      }

      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        data.results.slice(0, 3).forEach((result, i) => {
          console.log(`  ${i + 1}. ${result.formatted_address} (${result.types?.[0] || 'unknown'})`);
        });
      } else {
        console.log(`  No results`);
      }
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }
    console.log('');
  }
}

async function testAmbiguousLocations() {
  console.log('\n🤔 Testing Ambiguous Location Handling');
  console.log('======================================\n');
  
  const ambiguousTests = [
    { query: 'Paris', expected: ['Paris, France', 'Paris, Texas', 'Paris, Tennessee'] },
    { query: 'Portland', expected: ['Portland, Oregon', 'Portland, Maine'] },
    { query: 'London', expected: ['London, UK', 'London, Ontario'] },
    { query: 'Cambridge', expected: ['Cambridge, UK', 'Cambridge, Massachusetts'] }
  ];

  for (const test of ambiguousTests) {
    console.log(`📍 Ambiguous Location: "${test.query}"`);
    console.log(`   Expected options: ${test.expected.join(', ')}`);
    
    // Test Nominatim's handling
    await testNominatimAmbiguous(test.query);
  }
}

async function testNominatimAmbiguous(location) {
  try {
    const params = new URLSearchParams({
      q: location,
      format: 'json',
      addressdetails: '1',
      limit: '10', // Get more results to see alternatives
      extratags: '1'
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        'User-Agent': 'ChatBnb-Test/1.0',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) return;

    const data = await response.json();
    
    if (data && data.length > 0) {
      console.log(`   Nominatim results:`);
      
      // Group by country to show diversity
      const byCountry = {};
      data.forEach(result => {
        const country = result.address?.country || 'Unknown';
        if (!byCountry[country]) byCountry[country] = [];
        byCountry[country].push(result);
      });
      
      Object.entries(byCountry).forEach(([country, results]) => {
        console.log(`     ${country}:`);
        results.slice(0, 2).forEach(result => {
          console.log(`       - ${result.display_name} (${result.type}, importance: ${result.importance})`);
        });
      });
    }
    console.log('');
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }
}

async function main() {
  console.log('🔍 Comprehensive Geocoding Provider Analysis');
  console.log('============================================');
  console.log('This will help us understand the best configuration for each provider.\n');
  
  await testMapboxConfigurations();
  await testGoogleGeocoding();
  await testAmbiguousLocations();
  
  console.log('\n📋 Recommendations');
  console.log('==================');
  console.log('Based on this analysis, we should:');
  console.log('1. Configure Mapbox to exclude "address" type for geographic searches');
  console.log('2. Use provider-specific strengths (Nominatim for regions, Google for accuracy)');
  console.log('3. Implement intelligent disambiguation based on travel context');
  console.log('4. Return multiple high-confidence options for user selection');
}

main().catch(console.error);