#!/usr/bin/env node

// Direct API testing to identify Cape Cod geocoding issue
import { config } from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
config({ path: '.env.local' });

const TEST_LOCATION = 'Cape Cod';

async function testMapboxDirectly() {
  console.log('🗺️ Testing Mapbox Geocoding API Directly');
  console.log('=========================================\n');
  
  const apiKey = process.env.MAPBOX_ACCESS_TOKEN;
  if (!apiKey) {
    console.log('❌ MAPBOX_ACCESS_TOKEN not found in environment variables');
    return;
  }
  
  console.log('✅ Mapbox API key found');
  console.log(`📍 Testing location: "${TEST_LOCATION}"\n`);
  
  try {
    const params = new URLSearchParams({
      access_token: apiKey,
      types: 'place,locality,neighborhood,address',
      limit: '5'
    });

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(TEST_LOCATION)}.json?${params}`;
    console.log('🔗 Request URL:', url.replace(apiKey, 'REDACTED'));
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ChatBnb-Test/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Mapbox API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log(`✅ Mapbox API response received`);
    console.log(`📊 Found ${data.features?.length || 0} results\n`);
    
    if (!data.features || data.features.length === 0) {
      console.log('❌ No results found for Cape Cod');
      return;
    }
    
    // Analyze each result
    data.features.forEach((feature, index) => {
      console.log(`Result ${index + 1}:`);
      console.log(`  Text: ${feature.text}`);
      console.log(`  Place Name: ${feature.place_name}`);
      console.log(`  Relevance: ${feature.relevance}`);
      console.log(`  Center: [${feature.center.join(', ')}]`);
      console.log(`  Place Type: ${feature.place_type?.join(', ') || 'N/A'}`);
      
      // Check context for location details
      if (feature.context) {
        console.log(`  Context:`);
        feature.context.forEach(ctx => {
          const [category] = ctx.id.split('.');
          console.log(`    ${category}: ${ctx.text} (${ctx.short_code || 'no code'})`);
        });
      }
      
      console.log(''); // Empty line
    });
    
    // Analysis
    console.log('🔍 Analysis:');
    const firstResult = data.features[0];
    
    if (firstResult.place_name.toLowerCase().includes('cape cod')) {
      console.log('✅ First result contains "Cape Cod"');
      
      // Check if it's in Massachusetts
      const massContext = firstResult.context?.find(ctx => 
        ctx.text?.toLowerCase().includes('massachusetts') || 
        ctx.short_code?.toLowerCase() === 'us-ma'
      );
      
      if (massContext) {
        console.log('✅ Result is in Massachusetts - this is correct!');
      } else {
        console.log('❌ Result is NOT in Massachusetts');
        console.log('🔍 This explains why searches are returning wrong locations');
      }
    } else {
      console.log('❌ First result does NOT contain "Cape Cod"');
      console.log(`   Instead got: "${firstResult.place_name}"`);
      console.log('🔍 This is the core problem - Mapbox is not returning Cape Cod');
    }
    
  } catch (error) {
    console.error('❌ Mapbox API test failed:', error);
  }
}

async function testNominatimDirectly() {
  console.log('\n🌍 Testing Nominatim (OpenStreetMap) API Directly');
  console.log('=================================================\n');
  
  try {
    const params = new URLSearchParams({
      q: TEST_LOCATION,
      format: 'json',
      addressdetails: '1',
      limit: '5',
      extratags: '1',
      namedetails: '1'
    });

    const url = `https://nominatim.openstreetmap.org/search?${params}`;
    console.log('🔗 Request URL:', url);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ChatBnb-Test/1.0 (test@example.com)',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log(`✅ Nominatim API response received`);
    console.log(`📊 Found ${data?.length || 0} results\n`);
    
    if (!data || data.length === 0) {
      console.log('❌ No results found for Cape Cod');
      return;
    }
    
    // Analyze each result
    data.forEach((result, index) => {
      console.log(`Result ${index + 1}:`);
      console.log(`  Display Name: ${result.display_name}`);
      console.log(`  Name: ${result.name}`);
      console.log(`  Type: ${result.type}`);
      console.log(`  Class: ${result.class}`);
      console.log(`  Importance: ${result.importance}`);
      console.log(`  Coordinates: [${result.lat}, ${result.lon}]`);
      
      if (result.address) {
        console.log(`  Address:`);
        Object.entries(result.address).forEach(([key, value]) => {
          console.log(`    ${key}: ${value}`);
        });
      }
      
      console.log(''); // Empty line
    });
    
    // Analysis
    console.log('🔍 Analysis:');
    const firstResult = data[0];
    
    if (firstResult.display_name.toLowerCase().includes('cape cod')) {
      console.log('✅ First result contains "Cape Cod"');
      
      // Check if it's in Massachusetts
      if (firstResult.address?.state?.toLowerCase().includes('massachusetts') || 
          firstResult.address?.country_code?.toLowerCase() === 'us') {
        console.log('✅ Result is in Massachusetts/US - this looks correct!');
        
        // Compare with Mapbox results
        console.log('\n💡 Recommendation:');
        console.log('   Nominatim seems to be returning better Cape Cod results than Mapbox.');
        console.log('   Consider prioritizing Nominatim for Cape Cod-type queries.');
      } else {
        console.log('❌ Result is NOT in Massachusetts/US');
      }
    } else {
      console.log('❌ First result does NOT contain "Cape Cod"');
      console.log(`   Instead got: "${firstResult.display_name}"`);
    }
    
  } catch (error) {
    console.error('❌ Nominatim API test failed:', error);
  }
}

async function main() {
  console.log('🚀 Direct Geocoding API Testing');
  console.log('Testing why Cape Cod searches return wrong locations\n');
  
  await testMapboxDirectly();
  await testNominatimDirectly();
  
  console.log('\n📋 Final Analysis');
  console.log('=================');
  console.log('This test shows which geocoding provider returns the correct Cape Cod.');
  console.log('The provider that returns "Cape Cod, Massachusetts" should be preferred.');
  console.log('If both fail, we need to examine the exact API responses and adjust our geocoding logic.');
}

main().catch(console.error);