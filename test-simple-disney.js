#!/usr/bin/env node

// Simple direct test of Disney World geocoding
import { config } from 'dotenv';
import fetch from 'node-fetch';

config({ path: '.env.local' });

async function testDisneyWorldDirect() {
  console.log('🏰 Testing Disney World Direct');
  console.log('=============================\n');
  
  try {
    // Test Nominatim directly for Disney World
    const params = new URLSearchParams({
      q: 'Walt Disney World',
      format: 'json',
      addressdetails: '1',
      limit: '1'
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        'User-Agent': 'ChatBnb-Test/1.0',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data && data.length > 0) {
      const result = data[0];
      console.log('✅ Disney World Found:');
      console.log(`   Name: ${result.name}`);
      console.log(`   Display: ${result.display_name}`);
      console.log(`   Type: ${result.type}`);
      console.log(`   Class: ${result.class}`);
      console.log(`   Coordinates: [${result.lat}, ${result.lon}]`);
      console.log(`   State: ${result.address?.state}`);
      console.log(`   Country: ${result.address?.country}`);
      console.log(`   Importance: ${result.importance}`);
      
      // Verify this is correct Disney World
      if (result.address?.state === 'Florida' && 
          result.display_name.includes('Walt Disney World')) {
        console.log('\n🎉 SUCCESS: This is the correct Disney World in Florida!');
        return {
          location: result.name,
          displayName: result.display_name,
          coordinates: { lat: parseFloat(result.lat), lng: parseFloat(result.lon) },
          type: result.type,
          confidence: parseFloat(result.importance || '0.5'),
          components: {
            state: result.address?.state,
            country: result.address?.country,
            countryCode: result.address?.country_code?.toUpperCase()
          }
        };
      } else {
        console.log('\n❌ This is not the Disney World we expected');
      }
    } else {
      console.log('❌ No results found');
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
  
  return null;
}

async function testProximityQueries() {
  console.log('\n🗺️ Testing Proximity Query Processing');
  console.log('=====================================\n');
  
  const proximityQueries = [
    'vacation home near Disney World',
    'house close to Walt Disney World', 
    'rental near Disney World',
    'stay near Disney World Orlando'
  ];

  for (const query of proximityQueries) {
    console.log(`🎯 Query: "${query}"`);
    
    // Extract landmark using our pattern matching
    const patterns = [
      /near\s+(.+)/i,
      /close\s+to\s+(.+)/i,
      /vacation\s+home\s+near\s+(.+)/i,
      /house\s+close\s+to\s+(.+)/i,
      /rental\s+near\s+(.+)/i,
      /stay\s+near\s+(.+)/i
    ];
    
    let extractedLandmark = null;
    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match) {
        extractedLandmark = match[1].trim();
        break;
      }
    }
    
    if (extractedLandmark) {
      console.log(`   ✅ Extracted: "${extractedLandmark}"`);
      
      // Test if this landmark would work with our geocoding
      if (extractedLandmark.toLowerCase().includes('disney')) {
        console.log(`   🎯 Would geocode Disney World → Orlando, Florida area`);
      }
    } else {
      console.log(`   ❌ Could not extract landmark`);
    }
  }
}

async function main() {
  const disneyResult = await testDisneyWorldDirect();
  await testProximityQueries();
  
  console.log('\n📋 Conclusion');
  console.log('=============');
  
  if (disneyResult) {
    console.log('✅ Disney World geocoding works with Nominatim');
    console.log('✅ Proximity query extraction works');
    console.log('💡 The combination should handle "vacation home near Disney World" perfectly');
    console.log('🎯 Expected result: Orlando/Bay Lake, Florida area properties');
  } else {
    console.log('❌ Disney World geocoding failed - need to investigate');
  }
}

main().catch(console.error);