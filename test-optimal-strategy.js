#!/usr/bin/env node

// Test the optimal multi-provider geocoding strategy
const { config } = require('dotenv');
const fetch = require('node-fetch');

config({ path: '.env.local' });

async function testOptimalStrategy() {
  console.log('🚀 Testing Optimal Multi-Provider Strategy');
  console.log('=========================================\n');
  
  const testCases = [
    {
      query: 'Paris',
      expectation: 'Primary: Paris, France (Google). Alternatives: Paris, Texas (Nominatim)',
      priority: 'Disambiguation'
    },
    {
      query: 'Portland', 
      expectation: 'Primary: Portland, OR (Google). Alternatives: Portland, ME (others)',
      priority: 'Disambiguation'
    },
    {
      query: 'Disney World',
      expectation: 'Primary: Disney World, Florida (Google). Backup: Nominatim if Google fails',
      priority: 'Accuracy'
    },
    {
      query: 'Cape Cod',
      expectation: 'Primary: Cape Cod, MA (Google/Nominatim). Fallback if one fails',
      priority: 'Reliability'
    },
    {
      query: 'vacation home near Disney World',
      expectation: 'Extract "Disney World", then geocode it with full strategy',
      priority: 'Complex Query'
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n🎯 Testing: "${testCase.query}"`);
    console.log(`Expected: ${testCase.expectation}`);
    console.log(`Priority: ${testCase.priority}\n`);
    
    await testWithOptimalStrategy(testCase.query);
    console.log('─'.repeat(80));
  }
}

async function testWithOptimalStrategy(query) {
  try {
    const response = await fetch('http://localhost:5175/api/test-geocoding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: query,
        options: {
          includeAlternatives: true,
          maxResults: 5
        }
      })
    });
    
    if (!response.ok) {
      console.log(`❌ API Error: ${response.status}`);
      const errorText = await response.text();
      console.log(`Details: ${errorText}`);
      return;
    }

    const data = await response.json();
    
    // Analyze primary result
    console.log('🏆 PRIMARY RESULT:');
    console.log(`   Location: "${data.location}"`);
    console.log(`   Display: "${data.displayName}"`);
    console.log(`   Confidence: ${data.confidence}`);
    console.log(`   Type: ${data.type}`);
    console.log(`   Providers: ${data.providers?.join(', ')}`);
    console.log(`   Country: ${data.components?.country} (${data.components?.countryCode})`);
    console.log(`   State: ${data.components?.state || 'N/A'}`);
    
    // Check if Google was used
    const usedGoogle = data.providers?.includes('google');
    if (usedGoogle) {
      console.log(`   ✅ Used Google as primary (optimal strategy working)`);
    } else {
      console.log(`   ⚠️ Google not used - check if API failed or fallback triggered`);
    }
    
    // Analyze alternatives
    if (data.alternatives && data.alternatives.length > 0) {
      console.log(`\n🔄 ALTERNATIVES (${data.alternatives.length}):`);
      data.alternatives.forEach((alt, i) => {
        console.log(`   ${i + 1}. "${alt.displayName}" (${alt.confidence})`);
        console.log(`      Providers: ${alt.providers?.join(', ')}`);
        console.log(`      Country: ${alt.components?.country}`);
        
        // Check for good disambiguation
        if (alt.components?.country !== data.components?.country) {
          console.log(`      ✅ Good disambiguation - different country`);
        }
      });
      
      // Analyze disambiguation quality
      const countries = new Set([data.components?.country, ...data.alternatives.map(alt => alt.components?.country)])
      if (countries.size > 1) {
        console.log(`   🌍 Excellent disambiguation: ${countries.size} countries represented`);
      }
    } else {
      console.log(`\n🔄 No alternatives found`);
    }
    
    // Overall assessment
    console.log(`\n📊 STRATEGY ASSESSMENT:`);
    assessStrategySuccess(query, data);
    
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
  }
}

function assessStrategySuccess(query, data) {
  const scores = {
    accuracy: 0,
    disambiguation: 0, 
    reliability: 0,
    cost: 0
  };
  
  // Accuracy score
  if (data.providers?.includes('google')) {
    scores.accuracy = 10; // Google provides best accuracy
  } else if (data.confidence > 0.8) {
    scores.accuracy = 8; // High confidence from alternatives
  } else {
    scores.accuracy = 5; // Lower confidence
  }
  
  // Disambiguation score  
  if (data.alternatives && data.alternatives.length > 0) {
    const countries = new Set([data.components?.country, ...data.alternatives.map(alt => alt.components?.country)]);
    if (countries.size > 1) {
      scores.disambiguation = 10; // Multiple countries = excellent disambiguation
    } else {
      scores.disambiguation = 5; // Same country alternatives
    }
  } else {
    scores.disambiguation = 0; // No alternatives
  }
  
  // Reliability score (multiple providers used)
  const providerCount = new Set([
    ...data.providers || [],
    ...data.alternatives?.flatMap(alt => alt.providers || []) || []
  ]).size;
  scores.reliability = Math.min(10, providerCount * 3); // More providers = more reliable
  
  // Cost efficiency score
  const hasGoogle = data.providers?.includes('google');
  const hasFree = data.providers?.includes('nominatim') || 
                  data.alternatives?.some(alt => alt.providers?.includes('nominatim'));
  
  if (hasGoogle && hasFree) {
    scores.cost = 10; // Best of both worlds
  } else if (hasFree) {
    scores.cost = 8; // Using free providers
  } else {
    scores.cost = 5; // Only paid providers
  }
  
  const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
  const maxScore = 40;
  
  console.log(`   Accuracy: ${scores.accuracy}/10 (Google primary)`);
  console.log(`   Disambiguation: ${scores.disambiguation}/10 (Multiple options)`);
  console.log(`   Reliability: ${scores.reliability}/10 (Provider diversity)`);
  console.log(`   Cost Efficiency: ${scores.cost}/10 (Smart provider mix)`);
  console.log(`   TOTAL SCORE: ${totalScore}/${maxScore} (${Math.round(totalScore/maxScore*100)}%)`);
  
  if (totalScore >= 35) {
    console.log(`   🏆 EXCELLENT - Optimal strategy working perfectly!`);
  } else if (totalScore >= 25) {
    console.log(`   ✅ GOOD - Strategy working well with minor issues`);
  } else {
    console.log(`   ⚠️ NEEDS IMPROVEMENT - Strategy not optimal`);
  }
}

async function testCostOptimization() {
  console.log('\n💰 Cost Optimization Analysis');
  console.log('============================\n');
  
  const queries = ['Paris', 'Disney World', 'Cape Cod', 'London', 'Portland'];
  let totalGoogleCalls = 0;
  let totalFreeCalls = 0;
  
  for (const query of queries) {
    try {
      const response = await fetch('http://localhost:5175/api/test-geocoding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: query, options: { includeAlternatives: true } })
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Count API calls
        if (data.providers?.includes('google')) totalGoogleCalls++;
        if (data.providers?.includes('nominatim')) totalFreeCalls++;
        
        data.alternatives?.forEach(alt => {
          if (alt.providers?.includes('google')) totalGoogleCalls++;
          if (alt.providers?.includes('nominatim')) totalFreeCalls++;
        });
      }
    } catch (error) {
      console.log(`Error testing ${query}: ${error.message}`);
    }
  }
  
  console.log(`📊 API Usage Summary:`);
  console.log(`   Google calls: ${totalGoogleCalls} (cost: $${(totalGoogleCalls * 0.005).toFixed(3)})`);
  console.log(`   Free calls: ${totalFreeCalls} (cost: $0.000)`);
  console.log(`   Total cost per ${queries.length} queries: $${(totalGoogleCalls * 0.005).toFixed(3)}`);
  console.log(`   Projected monthly cost (10k queries): $${(totalGoogleCalls * 0.005 * 10000 / queries.length).toFixed(2)}`);
}

async function main() {
  // Check server status
  try {
    const pingResponse = await fetch('http://localhost:5175/');
    if (!pingResponse.ok) throw new Error('Server not accessible');
    console.log('✅ Development server is running\n');
  } catch (error) {
    console.log('❌ Development server not accessible. Please run: npm run dev\n');
    return;
  }
  
  await testOptimalStrategy();
  await testCostOptimization();
  
  console.log('\n🎯 Summary');
  console.log('==========');
  console.log('The optimal strategy should show:');
  console.log('✅ Google as primary for accuracy');
  console.log('✅ Multiple alternatives for disambiguation'); 
  console.log('✅ Graceful fallbacks for reliability');
  console.log('✅ Cost-effective provider mixing');
}

main().catch(console.error);