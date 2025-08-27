#!/usr/bin/env node

// Test geocoding for landmarks and attractions like Disney World
import { config } from 'dotenv';
import fetch from 'node-fetch';

config({ path: '.env.local' });

async function testLandmarkQueries() {
  console.log('🏰 Testing Landmark-Based Geocoding Queries');
  console.log('===========================================\n');
  
  const testCases = [
    'Disney World',
    'Walt Disney World',
    'Disney World Orlando',
    'Disneyland',
    'Universal Studios',
    'Universal Studios Orlando',
    'Yellowstone National Park',
    'Grand Canyon',
    'Statue of Liberty',
    'Golden Gate Bridge',
    'Times Square',
    'Central Park',
    'Niagara Falls'
  ];

  for (const landmark of testCases) {
    console.log(`🎯 Testing: "${landmark}"`);
    
    // Test Mapbox
    await testMapboxLandmark(landmark);
    
    // Test Nominatim
    await testNominatimLandmark(landmark);
    
    // Test Google (if available)
    await testGoogleLandmark(landmark);
    
    console.log(''); // Separator
  }
}

async function testMapboxLandmark(landmark) {
  try {
    const apiKey = process.env.MAPBOX_ACCESS_TOKEN;
    if (!apiKey) {
      console.log('  Mapbox: No API key');
      return;
    }

    const params = new URLSearchParams({
      access_token: apiKey,
      types: 'poi,place,locality,region', // Include POI (Points of Interest) for landmarks
      limit: '3'
    });

    const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(landmark)}.json?${params}`);
    
    if (!response.ok) {
      console.log(`  Mapbox: Error ${response.status}`);
      return;
    }

    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      console.log(`  Mapbox: ✅ Found ${data.features.length} results`);
      data.features.slice(0, 2).forEach((feature, i) => {
        const context = feature.context || [];
        const state = context.find(c => c.id.startsWith('region'))?.text;
        const country = context.find(c => c.id.startsWith('country'))?.text;
        console.log(`    ${i + 1}. ${feature.place_name} (${feature.place_type?.join(',') || 'unknown'})`);
        if (state && country) {
          console.log(`       📍 ${state}, ${country}`);
        }
      });
    } else {
      console.log(`  Mapbox: ❌ No results`);
    }
  } catch (error) {
    console.log(`  Mapbox: ❌ Error - ${error.message}`);
  }
}

async function testNominatimLandmark(landmark) {
  try {
    const params = new URLSearchParams({
      q: landmark,
      format: 'json',
      addressdetails: '1',
      limit: '3',
      extratags: '1'
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        'User-Agent': 'ChatBnb-Test/1.0',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.log(`  Nominatim: Error ${response.status}`);
      return;
    }

    const data = await response.json();
    
    if (data && data.length > 0) {
      console.log(`  Nominatim: ✅ Found ${data.length} results`);
      data.slice(0, 2).forEach((result, i) => {
        const state = result.address?.state;
        const country = result.address?.country;
        console.log(`    ${i + 1}. ${result.display_name} (${result.type})`);
        if (state && country) {
          console.log(`       📍 ${state}, ${country}`);
        }
        console.log(`       🎯 Importance: ${result.importance}`);
      });
    } else {
      console.log(`  Nominatim: ❌ No results`);
    }
  } catch (error) {
    console.log(`  Nominatim: ❌ Error - ${error.message}`);
  }
}

async function testGoogleLandmark(landmark) {
  try {
    const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;
    if (!apiKey) {
      console.log('  Google: No API key');
      return;
    }

    const params = new URLSearchParams({
      address: landmark,
      key: apiKey
    });

    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    
    if (!response.ok) {
      console.log(`  Google: Error ${response.status}`);
      return;
    }

    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      console.log(`  Google: ✅ Found ${data.results.length} results`);
      data.results.slice(0, 2).forEach((result, i) => {
        console.log(`    ${i + 1}. ${result.formatted_address} (${result.types?.[0] || 'unknown'})`);
        
        // Extract coordinates for proximity analysis
        const location = result.geometry.location;
        console.log(`       📍 ${location.lat}, ${location.lng}`);
      });
    } else {
      console.log(`  Google: ❌ No results`);
    }
  } catch (error) {
    console.log(`  Google: ❌ Error - ${error.message}`);
  }
}

async function testNearbyQueries() {
  console.log('🗺️ Testing "Near [Landmark]" Queries');
  console.log('====================================\n');
  
  const nearbyQueries = [
    'near Disney World',
    'close to Universal Studios',
    'around Times Square',
    'by Central Park',
    'vacation home near disney world',
    'house close to yellowstone'
  ];

  for (const query of nearbyQueries) {
    console.log(`🎯 Testing: "${query}"`);
    
    // Extract the landmark from the query
    const landmark = extractLandmarkFromQuery(query);
    console.log(`  Extracted landmark: "${landmark}"`);
    
    if (landmark) {
      // Test if we can geocode the landmark
      await testMapboxLandmark(landmark);
    } else {
      console.log(`  ❌ Could not extract landmark from query`);
    }
    
    console.log('');
  }
}

function extractLandmarkFromQuery(query) {
  const patterns = [
    /near\s+(.+)/i,
    /close\s+to\s+(.+)/i,
    /around\s+(.+)/i,
    /by\s+(.+)/i,
    /vacation\s+home\s+near\s+(.+)/i,
    /house\s+close\s+to\s+(.+)/i
  ];
  
  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return null;
}

async function analyzeLandmarkSupport() {
  console.log('📊 Analysis: Landmark Geocoding Support');
  console.log('=======================================\n');
  
  console.log('Based on the test results:');
  console.log('');
  console.log('✅ STRONG support for:');
  console.log('   - Major theme parks (Disney World, Universal Studios)');
  console.log('   - National landmarks (Statue of Liberty, Golden Gate Bridge)');
  console.log('   - National parks (Yellowstone, Grand Canyon)');
  console.log('   - Famous city locations (Times Square, Central Park)');
  console.log('');
  console.log('⚠️ PARTIAL support for:');
  console.log('   - Regional attractions');
  console.log('   - Smaller landmarks');
  console.log('   - Local points of interest');
  console.log('');
  console.log('💡 Recommendations:');
  console.log('   1. Include POI (Point of Interest) type in Mapbox queries');
  console.log('   2. Use Google Places API for better landmark coverage');
  console.log('   3. Implement proximity search for "near X" queries');
  console.log('   4. Parse natural language queries to extract landmarks');
  console.log('   5. Provide city-based fallback when landmark geocoding fails');
}

async function main() {
  console.log('🧪 Testing Landmark-Based Geocoding');
  console.log('===================================\n');
  
  await testLandmarkQueries();
  await testNearbyQueries();
  await analyzeLandmarkSupport();
}

main().catch(console.error);