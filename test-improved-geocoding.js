#!/usr/bin/env node

// Test the improved multi-provider geocoding strategy
import { config } from 'dotenv';
import fetch from 'node-fetch';

config({ path: '.env.local' });

async function testImprovedMapbox() {
  console.log('🗺️ Testing Improved Mapbox Configuration');
  console.log('=========================================\n');
  
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
    console.log(`📍 Testing: "${location}"`);
    
    try {
      // New configuration: exclude 'address' type
      const params = new URLSearchParams({
        access_token: apiKey,
        types: 'place,locality,region,district', // No more 'address'
        limit: '5'
      });

      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json?${params}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        console.log(`  ❌ Error: ${response.status}`);
        continue;
      }

      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        console.log(`  ✅ Found ${data.features.length} results:`);
        data.features.slice(0, 3).forEach((feature, i) => {
          const country = feature.context?.find(c => c.id.startsWith('country'))?.text || 'Unknown';
          console.log(`    ${i + 1}. ${feature.place_name} (${feature.place_type?.join(',')}) [${country}]`);
        });
        
        // Special check for Cape Cod
        if (location === 'Cape Cod') {
          const hasCorrectCapeCod = data.features.some(f => 
            f.place_name.includes('Massachusetts') && f.place_name.includes('Cape Cod')
          );
          if (hasCorrectCapeCod) {
            console.log(`    🎉 SUCCESS: Found Cape Cod, Massachusetts!`);
          } else {
            console.log(`    ⚠️ Still no Cape Cod, Massachusetts in Mapbox results`);
          }
        }
      } else {
        console.log(`  ❌ No results found`);
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
    console.log('');
  }
}

async function testAmbiguousLocationHandling() {
  console.log('🤔 Testing Ambiguous Location Strategy');
  console.log('=====================================\n');
  
  const testCases = [
    { location: 'Paris', expected: ['Paris, France', 'Paris, Texas'] },
    { location: 'Portland', expected: ['Portland, Oregon', 'Portland, Maine'] },
    { location: 'London', expected: ['London, UK', 'London, Ontario'] }
  ];

  for (const test of testCases) {
    console.log(`📍 Testing: "${test.location}"`);
    console.log(`   Expected alternatives: ${test.expected.join(', ')}`);
    
    // Test both providers
    await testProviderForAmbiguous('Mapbox', test.location, testMapboxAmbiguous);
    await testProviderForAmbiguous('Nominatim', test.location, testNominatimAmbiguous);
    console.log('');
  }
}

async function testProviderForAmbiguous(providerName, location, testFunc) {
  try {
    const results = await testFunc(location);
    console.log(`   ${providerName}:`);
    if (results && results.length > 0) {
      results.slice(0, 3).forEach((result, i) => {
        console.log(`     ${i + 1}. ${result.name} (${result.confidence || 'N/A'})`);
      });
    } else {
      console.log(`     No results`);
    }
  } catch (error) {
    console.log(`   ${providerName}: Error`);
  }
}

async function testMapboxAmbiguous(location) {
  const apiKey = process.env.MAPBOX_ACCESS_TOKEN;
  if (!apiKey) return [];
  
  const params = new URLSearchParams({
    access_token: apiKey,
    types: 'place,locality,region,district',
    limit: '5'
  });

  const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json?${params}`);
  
  if (!response.ok) return [];
  
  const data = await response.json();
  return data.features?.map(f => ({
    name: f.place_name,
    confidence: f.relevance
  })) || [];
}

async function testNominatimAmbiguous(location) {
  const params = new URLSearchParams({
    q: location,
    format: 'json',
    addressdetails: '1',
    limit: '5'
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: {
      'User-Agent': 'ChatBnb-Test/1.0',
      'Accept': 'application/json'
    }
  });
  
  if (!response.ok) return [];
  
  const data = await response.json();
  return data?.map(r => ({
    name: r.display_name,
    confidence: r.importance
  })) || [];
}

async function main() {
  console.log('🧪 Testing Improved Multi-Provider Geocoding Strategy');
  console.log('======================================================\n');
  
  await testImprovedMapbox();
  await testAmbiguousLocationHandling();
  
  console.log('📋 Analysis');
  console.log('===========');
  console.log('✅ Mapbox without addresses should now work better for cities');
  console.log('✅ Nominatim provides good alternatives for ambiguous locations');
  console.log('✅ Combined approach should give users choice without making assumptions');
  console.log('💡 Next: Implement the disambiguation UI to let users choose');
}

main().catch(console.error);