// Test endpoint for geocoding functionality
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { geocodingService } from './services/geocoding'

interface TestCase {
  query: string
  description: string
  expectedIssues?: string[]
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method === 'POST') {
    // Handle individual location testing
    try {
      const { location, options = {} } = req.body

      if (!location) {
        return res.status(400).json({ error: 'Location is required' })
      }

      console.log(`🧪 Testing geocoding for: "${location}"`)
      
      const result = await geocodingService.geocode(location, {
        includeAlternatives: options.includeAlternatives || true,
        maxResults: options.maxResults || 5,
        fuzzyMatching: true
      })

      if (!result) {
        console.log(`❌ No geocoding results for: "${location}"`)
        return res.status(404).json({ 
          error: 'No results found',
          location,
          confidence: 0,
          alternatives: []
        })
      }

      console.log(`✅ Geocoding success: "${location}" → "${result.displayName}" (confidence: ${result.confidence})`)

      return res.status(200).json({
        location: result.location,
        displayName: result.displayName,
        confidence: result.confidence,
        coordinates: result.coordinates,
        components: result.components,
        type: result.type,
        providers: result.providers,
        alternatives: result.alternatives || []
      })

    } catch (error) {
      console.error('Test geocoding error:', error)
      return res.status(500).json({ 
        error: 'Geocoding failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const testCases: TestCase[] = [
    {
      query: 'Paris',
      description: 'Ambiguous city name - should prefer Paris, France for travel',
      expectedIssues: ['Disambiguation between Paris, France and Paris, Texas']
    },
    {
      query: 'London',
      description: 'Another ambiguous city - should prefer London, UK',
      expectedIssues: ['Multiple Londons exist (UK, Ontario, etc.)']
    },
    {
      query: 'Mami',
      description: 'Common typo for Miami',
      expectedIssues: ['Typo should be detected and corrected']
    },
    {
      query: 'NYC',
      description: 'Common abbreviation',
      expectedIssues: ['Should expand to New York City']
    },
    {
      query: 'San Francisco',
      description: 'Clear location - should work perfectly',
      expectedIssues: []
    },
    {
      query: 'Narnia',
      description: 'Fictional location - should fail gracefully',
      expectedIssues: ['No real location found, should provide suggestions']
    },
    {
      query: 'Berlin',
      description: 'Ambiguous between Germany and New Hampshire',
      expectedIssues: ['Should prefer Berlin, Germany for travel context']
    }
  ]

  const results = []

  for (const testCase of testCases) {
    try {
      console.log(`🧪 Testing: ${testCase.query}`)
      
      const startTime = Date.now()
      const result = await geocodingService.geocode(testCase.query, {
        includeAlternatives: true,
        maxResults: 3,
        fuzzyMatching: true
      })
      const duration = Date.now() - startTime

      // Test fuzzy matching if no result
      let fuzzyResults = null
      if (!result || result.confidence < 0.7) {
        const fuzzyStartTime = Date.now()
        fuzzyResults = await geocodingService.fuzzyGeocode(testCase.query, {
          maxResults: 3
        })
        const fuzzyDuration = Date.now() - fuzzyStartTime
        
        results.push({
          query: testCase.query,
          description: testCase.description,
          expectedIssues: testCase.expectedIssues,
          result: {
            primary: result,
            fuzzy: fuzzyResults,
            timing: {
              primary: duration,
              fuzzy: fuzzyDuration,
              total: duration + fuzzyDuration
            }
          },
          status: result ? 'success' : 'failed',
          analysis: {
            confidence: result?.confidence || 0,
            needsDisambiguation: result?.alternatives && result.alternatives.length > 0,
            foundTypoCorrection: fuzzyResults && fuzzyResults.length > 0,
            responseTime: duration + (fuzzyResults ? fuzzyDuration : 0)
          }
        })
      } else {
        results.push({
          query: testCase.query,
          description: testCase.description,
          expectedIssues: testCase.expectedIssues,
          result: {
            primary: result,
            timing: {
              primary: duration,
              total: duration
            }
          },
          status: 'success',
          analysis: {
            confidence: result.confidence,
            needsDisambiguation: result.alternatives && result.alternatives.length > 0,
            responseTime: duration
          }
        })
      }
    } catch (error) {
      results.push({
        query: testCase.query,
        description: testCase.description,
        expectedIssues: testCase.expectedIssues,
        result: null,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        analysis: {
          confidence: 0,
          responseTime: 0
        }
      })
    }
  }

  // Calculate overall statistics
  const stats = {
    totalTests: results.length,
    successful: results.filter(r => r.status === 'success').length,
    failed: results.filter(r => r.status === 'failed').length,
    errors: results.filter(r => r.status === 'error').length,
    averageConfidence: results
      .filter(r => r.analysis.confidence > 0)
      .reduce((sum, r) => sum + r.analysis.confidence, 0) / 
      results.filter(r => r.analysis.confidence > 0).length,
    averageResponseTime: results
      .reduce((sum, r) => sum + r.analysis.responseTime, 0) / results.length,
    disambiguationNeeded: results.filter(r => r.analysis.needsDisambiguation).length,
    typoCorrections: results.filter(r => r.analysis.foundTypoCorrection).length
  }

  return res.status(200).json({
    message: 'Geocoding functionality test completed',
    timestamp: new Date().toISOString(),
    statistics: stats,
    testResults: results,
    recommendations: generateRecommendations(results)
  })
}

function generateRecommendations(results: any[]): string[] {
  const recommendations: string[] = []
  
  const lowConfidenceCount = results.filter(r => r.analysis.confidence < 0.7).length
  const slowResponseCount = results.filter(r => r.analysis.responseTime > 2000).length
  const errorCount = results.filter(r => r.status === 'error').length
  
  if (lowConfidenceCount > results.length * 0.3) {
    recommendations.push('Consider improving confidence thresholds or adding more geocoding providers')
  }
  
  if (slowResponseCount > 0) {
    recommendations.push('Some queries are slow - consider implementing caching or timeout optimization')
  }
  
  if (errorCount > 0) {
    recommendations.push('API errors detected - check geocoding service configuration and API keys')
  }
  
  recommendations.push('Test with more edge cases including international locations and special characters')
  recommendations.push('Consider implementing user preference storage for frequently used locations')
  
  return recommendations
}