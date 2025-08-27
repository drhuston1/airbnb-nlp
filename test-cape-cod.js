#!/usr/bin/env node

// Test the full Cape Cod workflow with the fix
import { config } from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables  
config({ path: '.env.local' });

async function testCapeCodeWorkflow() {
  console.log('🧪 Testing Cape Cod Full Workflow');
  console.log('=================================\n');
  
  const query = 'Cape Cod houses for families';
  
  try {
    // Test the analyze-query endpoint
    console.log('1. Testing Query Analysis...');
    const analysisResponse = await fetch('http://localhost:5175/api/analyze-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query,
        previousLocation: null,
        hasExistingResults: false
      })
    });
    
    if (!analysisResponse.ok) {
      console.log('❌ Query analysis failed:', analysisResponse.status);
      return;
    }
    
    const analysisData = await analysisResponse.json();
    console.log('✅ Query Analysis Results:');
    console.log(`   Extracted Location: "${analysisData.analysis?.location}"`);
    console.log(`   Confidence: ${analysisData.analysis?.confidence}`);
    console.log(`   Is Refinement: ${analysisData.analysis?.isRefinement}`);
    
    if (analysisData.analysis?.locationValidation) {
      console.log(`   Location Valid: ${analysisData.analysis.locationValidation.valid}`);
      console.log(`   Validation Confidence: ${analysisData.analysis.locationValidation.confidence}`);
      
      if (analysisData.analysis.locationValidation.validated) {
        console.log(`   Validated Location: "${analysisData.analysis.locationValidation.validated.displayName}"`);
      }
      
      if (analysisData.analysis.locationValidation.disambiguation?.required) {
        console.log(`   Disambiguation Required: ${analysisData.analysis.locationValidation.disambiguation.required}`);
        console.log(`   Options: ${analysisData.analysis.locationValidation.disambiguation.options?.length || 0}`);
      }
    }
    
    // Test the geocoding directly
    console.log('\n2. Testing Direct Geocoding...');
    const geocodingResponse = await fetch('http://localhost:5175/api/test-geocoding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'Cape Cod',
        options: {
          includeAlternatives: true,
          maxResults: 3
        }
      })
    });
    
    if (geocodingResponse.ok) {
      const geocodingData = await geocodingResponse.json();
      console.log('✅ Direct Geocoding Results:');
      console.log(`   Location: "${geocodingData.location}"`);
      console.log(`   Display Name: "${geocodingData.displayName}"`);
      console.log(`   Confidence: ${geocodingData.confidence}`);
      console.log(`   Coordinates: [${geocodingData.coordinates?.lat}, ${geocodingData.coordinates?.lng}]`);
      console.log(`   Country: ${geocodingData.components?.country} (${geocodingData.components?.countryCode})`);
      console.log(`   State: ${geocodingData.components?.state || 'N/A'}`);
      console.log(`   Providers: ${geocodingData.providers?.join(', ') || 'N/A'}`);
      
      if (geocodingData.alternatives && geocodingData.alternatives.length > 0) {
        console.log(`   Alternatives: ${geocodingData.alternatives.length}`);
      }
      
      // Check if this is the correct Cape Cod
      if (geocodingData.displayName?.includes('Massachusetts') && 
          geocodingData.displayName?.includes('Cape Cod')) {
        console.log('🎉 SUCCESS: Found correct Cape Cod, Massachusetts!');
      } else {
        console.log('❌ STILL WRONG: This is not Cape Cod, Massachusetts');
        console.log(`   Got: "${geocodingData.displayName}"`);
      }
    } else {
      console.log('❌ Direct geocoding failed:', geocodingResponse.status);
    }
    
    // Test unified search if we have a good location
    const location = analysisData.analysis?.locationValidation?.validated?.location || 
                    analysisData.analysis?.location ||
                    'Cape Cod';
    
    console.log('\n3. Testing Unified Search...');
    const searchResponse = await fetch('http://localhost:5175/api/unified-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query,
        location: location,
        adults: 2,
        children: 0,
        page: 1
      })
    });
    
    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      console.log('✅ Unified Search Results:');
      console.log(`   Found: ${searchData.listings?.length || 0} listings`);
      console.log(`   Sources: ${searchData.sources?.map(s => `${s.platform}: ${s.status}`).join(', ') || 'None'}`);
      
      if (searchData.listings && searchData.listings.length > 0) {
        const firstListing = searchData.listings[0];
        console.log(`   First listing: "${firstListing.name}"`);
        console.log(`   Location: ${firstListing.location?.city}, ${firstListing.location?.country}`);
        console.log(`   Price: $${firstListing.price?.rate}/night`);
        
        // Check if results are in the right area
        if (firstListing.location?.country === 'United States' || 
            firstListing.location?.city?.toLowerCase().includes('cape') ||
            firstListing.location?.city?.toLowerCase().includes('massachusetts')) {
          console.log('🎉 SUCCESS: Search results appear to be in the correct area!');
        } else {
          console.log('❌ LOCATION MISMATCH: Search results are not near Cape Cod');
        }
      } else {
        console.log('⚠️ No listings found');
      }
    } else {
      console.log('❌ Unified search failed:', searchResponse.status);
      const errorText = await searchResponse.text();
      console.log('   Error:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Workflow test failed:', error);
  }
}

async function main() {
  console.log('🚀 Testing Cape Cod End-to-End Workflow');
  console.log('This tests the complete pipeline after our geocoding fix.\n');
  
  await testCapeCodeWorkflow();
  
  console.log('\n📋 Summary');
  console.log('==========');
  console.log('If all steps show Cape Cod, Massachusetts, the fix is working!');
}

main().catch(console.error);