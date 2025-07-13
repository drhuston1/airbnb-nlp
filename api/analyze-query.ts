// Enhanced query analysis with GPT-4o-mini for location and refinement understanding
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { API_CONFIG } from './config'
import { geocodingService, type GeocodeResult } from './services/geocoding'

interface QueryAnalysisRequest {
  query: string
  previousLocation?: string
  hasExistingResults?: boolean
}

interface QueryAnalysis {
  location: string
  isRefinement: boolean
  refinementType?: 'price' | 'rating' | 'amenity' | 'property_type' | 'host_type' | 'general'
  extractedCriteria: {
    priceRange?: {
      min?: number
      max?: number
      budget?: 'budget' | 'mid-range' | 'luxury'
    }
    rating?: {
      min?: number
      excellent?: boolean
      superhost?: boolean
      reviewCount?: number
    }
    amenities?: string[]
    propertyType?: string
    bedrooms?: number
    bathrooms?: number
    guests?: {
      adults?: number
      children?: number
      total?: number
    }
    dates?: {
      checkin?: string
      checkout?: string
      flexible?: boolean
    }
  }
  intent: 'new_search' | 'refine_location' | 'refine_criteria' | 'more_specific'
  confidence: number
  locationValidation?: {
    valid: boolean
    confidence: number
    validated?: GeocodeResult
    alternatives?: GeocodeResult[]
    disambiguation?: {
      required: boolean
      options: GeocodeResult[]
      message: string
    }
    suggestions?: string[]
  }
}

interface QueryAnalysisResponse {
  analysis: QueryAnalysis
  success: boolean
  error?: string
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { query, previousLocation, hasExistingResults }: QueryAnalysisRequest = req.body

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Query is required and must be a string'
      })
    }

    // Check for OpenAI API key
    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      console.error('OPENAI_API_KEY not configured')
      return res.status(500).json({ 
        success: false, 
        error: 'OpenAI API key not configured'
      })
    }

    console.log('Analyzing query with context:', { 
      query, 
      previousLocation, 
      hasExistingResults 
    })
    
    const analysis = await analyzeQueryWithGPT(query, openaiKey, previousLocation, hasExistingResults)
    
    // Validate location if one was extracted and it's not a refinement using previous location
    if (analysis.location && analysis.location !== 'Unknown' && analysis.location !== 'SAME') {
      console.log(`🗺️ Validating extracted location: "${analysis.location}"`)
      
      try {
        const locationValidation = await validateExtractedLocation(analysis.location, query)
        analysis.locationValidation = locationValidation
        
        // Update the location with validated result if available
        if (locationValidation.valid && locationValidation.validated) {
          analysis.location = locationValidation.validated.location
          console.log(`✅ Location validated and updated: ${analysis.location}`)
        }
      } catch (error) {
        console.warn('Location validation failed:', error)
        // Continue without validation - don't break the flow
      }
    }
    
    const response: QueryAnalysisResponse = {
      analysis,
      success: true
    }

    console.log('Query analysis result:', response)
    return res.status(200).json(response)

  } catch (error) {
    console.error('Query analysis error:', error)
    return res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function analyzeQueryWithGPT(
  query: string, 
  apiKey: string, 
  previousLocation?: string,
  hasExistingResults?: boolean
): Promise<QueryAnalysis> {
  try {
    const contextInfo = previousLocation 
      ? `Previous search was for: "${previousLocation}". ${hasExistingResults ? 'User has existing search results.' : ''}`
      : 'This is a new search with no previous context.'

    const prompt = `Analyze this travel accommodation query and extract structured information. Consider the context and determine if this is a new search or a refinement.

Context: ${contextInfo}

Query: "${query}"

Analyze and return a JSON object with this exact structure:
{
  "location": "extracted city/state/country, 'SAME' if refining existing location, or 'Unknown' if no location found",
  "isRefinement": boolean,
  "refinementType": "price|rating|amenity|property_type|host_type|general|null",
  "extractedCriteria": {
    "priceRange": {
      "min": number or null,
      "max": number or null,
      "budget": "budget|mid-range|luxury|null"
    },
    "rating": {
      "min": number or null,
      "excellent": boolean,
      "superhost": boolean,
      "reviewCount": number or null
    },
    "amenities": ["extracted amenities"],
    "propertyType": "extracted property type or null",
    "bedrooms": number or null,
    "bathrooms": number or null,
    "guests": {
      "adults": number or null,
      "children": number or null,
      "total": number or null
    },
    "dates": {
      "checkin": "YYYY-MM-DD or null (convert natural language like 'early september' to specific dates)",
      "checkout": "YYYY-MM-DD or null",
      "flexible": boolean
    }
  },
  "intent": "new_search|refine_location|refine_criteria|more_specific",
  "confidence": number between 0 and 1
}

Examples:

Query: "Beach house in Malibu for 6 people"
Previous: none
→ {
  "location": "Malibu",
  "isRefinement": false,
  "refinementType": null,
  "extractedCriteria": {
    "priceRange": { "min": null, "max": null, "budget": null },
    "rating": { "min": null, "excellent": false, "superhost": false },
    "amenities": [],
    "propertyType": "house",
    "guests": { "adults": null, "children": null, "total": 6 },
    "dates": { "checkin": null, "checkout": null, "flexible": false }
  },
  "intent": "new_search",
  "confidence": 0.95
}

Query: "under $200 per night"
Previous: "Malibu"
→ {
  "location": "SAME",
  "isRefinement": true,
  "refinementType": "price",
  "extractedCriteria": {
    "priceRange": { "min": null, "max": 200, "budget": null },
    "rating": { "min": null, "excellent": false, "superhost": false },
    "amenities": [],
    "propertyType": null,
    "guests": { "adults": null, "children": null, "total": null },
    "dates": { "checkin": null, "checkout": null, "flexible": false }
  },
  "intent": "refine_criteria",
  "confidence": 0.9
}

Query: "with pool and hot tub"
Previous: "Malibu"
→ {
  "location": "SAME",
  "isRefinement": true,
  "refinementType": "amenity",
  "extractedCriteria": {
    "priceRange": { "min": null, "max": null, "budget": null },
    "rating": { "min": null, "excellent": false, "superhost": false },
    "amenities": ["pool", "hot tub"],
    "propertyType": null,
    "guests": { "adults": null, "children": null, "total": null },
    "dates": { "checkin": null, "checkout": null, "flexible": false }
  },
  "intent": "refine_criteria",
  "confidence": 0.85
}

Query: "superhost only with excellent reviews"
Previous: "Malibu"
→ {
  "location": "SAME",
  "isRefinement": true,
  "refinementType": "rating",
  "extractedCriteria": {
    "priceRange": { "min": null, "max": null, "budget": null },
    "rating": { "min": null, "excellent": true, "superhost": true },
    "amenities": [],
    "propertyType": null,
    "guests": { "adults": null, "children": null, "total": null },
    "dates": { "checkin": null, "checkout": null, "flexible": false }
  },
  "intent": "refine_criteria",
  "confidence": 0.9
}

Query: "lakefront house in Charleston SC; 4 bedrooms; minimum 2-1/2 bathrooms for 5 days in September, 2025; rated 4.80 and above w/minimum of 40 reviews"
Previous: none
→ {
  "location": "Charleston SC",
  "isRefinement": false,
  "refinementType": null,
  "extractedCriteria": {
    "priceRange": { "min": null, "max": null, "budget": null },
    "rating": { "min": 4.80, "excellent": false, "superhost": false, "reviewCount": 40 },
    "amenities": ["lakefront"],
    "propertyType": "house",
    "bedrooms": 4,
    "bathrooms": 2.5,
    "guests": { "adults": null, "children": null, "total": null },
    "dates": { "checkin": "2025-09-01", "checkout": "2025-09-06", "flexible": true }
  },
  "intent": "new_search",
  "confidence": 0.95
}

Query: "looking for a house on cape cod. early september. 4 bedrooms"
Previous: none
→ {
  "location": "Cape Cod",
  "isRefinement": false,
  "refinementType": null,
  "extractedCriteria": {
    "priceRange": { "min": null, "max": null, "budget": null },
    "rating": { "min": null, "excellent": false, "superhost": false },
    "amenities": [],
    "propertyType": "house",
    "bedrooms": 4,
    "bathrooms": null,
    "guests": { "adults": null, "children": null, "total": null },
    "dates": { "checkin": "2024-09-01", "checkout": "2024-09-10", "flexible": true }
  },
  "intent": "new_search",
  "confidence": 0.9
}

Query: "next weekend"
Previous: "Austin"
→ {
  "location": "SAME",
  "isRefinement": true,
  "refinementType": "general",
  "extractedCriteria": {
    "priceRange": { "min": null, "max": null, "budget": null },
    "rating": { "min": null, "excellent": false, "superhost": false },
    "amenities": [],
    "propertyType": null,
    "guests": { "adults": null, "children": null, "total": null },
    "dates": { "checkin": "2024-01-20", "checkout": "2024-01-22", "flexible": false }
  },
  "intent": "refine_criteria",
  "confidence": 0.85
}

Query: "luxury house with pool"
Previous: none
→ {
  "location": "Unknown",
  "isRefinement": false,
  "refinementType": null,
  "extractedCriteria": {
    "priceRange": { "min": null, "max": null, "budget": "luxury" },
    "rating": { "min": null, "excellent": false, "superhost": false },
    "amenities": ["pool"],
    "propertyType": "house",
    "guests": { "adults": null, "children": null, "total": null },
    "dates": { "checkin": null, "checkout": null, "flexible": false }
  },
  "intent": "new_search",
  "confidence": 0.8
}

Query: "under $300 per night"
Previous: "Miami"
→ {
  "location": "SAME",
  "isRefinement": true,
  "refinementType": "price",
  "extractedCriteria": {
    "priceRange": { "min": null, "max": 300, "budget": null },
    "rating": { "min": null, "excellent": false, "superhost": false },
    "amenities": [],
    "propertyType": null,
    "guests": { "adults": null, "children": null, "total": null },
    "dates": { "checkin": null, "checkout": null, "flexible": false }
  },
  "intent": "refine_criteria",
  "confidence": 0.95
}

Query: "budget friendly options around $100-150"
Previous: "Austin"
→ {
  "location": "SAME",
  "isRefinement": true,
  "refinementType": "price",
  "extractedCriteria": {
    "priceRange": { "min": 100, "max": 150, "budget": "budget" },
    "rating": { "min": null, "excellent": false, "superhost": false },
    "amenities": [],
    "propertyType": null,
    "guests": { "adults": null, "children": null, "total": null },
    "dates": { "checkin": null, "checkout": null, "flexible": false }
  },
  "intent": "refine_criteria",
  "confidence": 0.9
}

Date Parsing Guidelines:
- "early september" → first 10 days of September (e.g., "2024-09-01" to "2024-09-10")
- "late september" → last 10 days of September (e.g., "2024-09-21" to "2024-09-30") 
- "mid september" → middle of September (e.g., "2024-09-10" to "2024-09-20")
- "september" without qualifier → first weekend of September
- "next weekend" → calculate next Saturday-Sunday
- "this weekend" → current Saturday-Sunday
- "christmas week" → December 20-27
- Assume current year (2024) unless specified otherwise
- Default stay length: 3-7 days for most queries, 2 days for weekends

Price Parsing Guidelines:
- "under $200" → max: 200
- "$100-300" or "$100 to $300" → min: 100, max: 300
- "around $250" → min: 200, max: 300 (±20% range)
- "budget" or "cheap" → budget: "budget", max: 150
- "luxury" or "high-end" → budget: "luxury", min: 300
- "mid-range" → budget: "mid-range", min: 100, max: 300
- "over $500" → min: 500
- "$200+" → min: 200
- Extract price per night, not total cost

Return ONLY the JSON object, no other text:`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a travel query analysis expert. Extract structured information from accommodation search queries and determine if they are new searches or refinements. Always return valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: API_CONFIG.GPT_MAX_TOKENS,
        temperature: API_CONFIG.GPT_TEMPERATURE
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const analysisText = data.choices[API_CONFIG.FIRST_CHOICE_INDEX]?.message?.content?.trim()
    
    if (!analysisText) {
      throw new Error('Empty response from GPT')
    }

    // Parse the JSON response
    let analysis: QueryAnalysis
    try {
      analysis = JSON.parse(analysisText)
    } catch (parseError) {
      console.error('Failed to parse GPT response:', analysisText)
      // Fallback analysis
      analysis = {
        location: previousLocation || 'Unknown',
        isRefinement: !!previousLocation,
        extractedCriteria: {},
        intent: previousLocation ? 'refine_criteria' : 'new_search',
        confidence: API_CONFIG.FALLBACK_CONFIDENCE
      }
    }

    // Validate and clean up the analysis
    if (analysis.location === 'SAME') {
      if (previousLocation) {
        analysis.location = previousLocation
      } else {
        // If GPT returned SAME but there's no previous location, treat as Unknown
        analysis.location = 'Unknown'
        analysis.isRefinement = false
      }
    }

    console.log(`GPT analyzed query: "${query}" →`, analysis)
    return analysis

  } catch (error) {
    console.error('GPT query analysis failed:', error)
    throw error
  }
}

/**
 * Validate extracted location using geocoding service
 */
async function validateExtractedLocation(location: string, originalQuery: string) {
  try {
    // Determine context from query for better geocoding
    const context = originalQuery.toLowerCase().includes('business') ? 'business' : 'travel'
    
    const result = await geocodingService.geocode(location, {
      includeAlternatives: true,
      maxResults: 3,
      fuzzyMatching: true
    })
    
    if (!result) {
      // Try fuzzy matching for typos
      const fuzzyResults = await geocodingService.fuzzyGeocode(location, {
        maxResults: 3
      })
      
      if (fuzzyResults.length > 0) {
        return {
          valid: false,
          confidence: 0,
          suggestions: fuzzyResults.map(r => `Did you mean "${r.displayName}"?`).slice(0, 3)
        }
      }
      
      return {
        valid: false,
        confidence: 0,
        suggestions: [`Could not find location "${location}". Please check spelling.`]
      }
    }
    
    // Check for disambiguation needed
    let disambiguation = undefined
    
    if (result.alternatives && result.alternatives.length > 0) {
      // Check if we have significantly different locations with same name
      const hasAmbiguity = result.alternatives.some(alt => 
        alt.components.country !== result.components.country && alt.confidence > 0.6
      )
      
      if (hasAmbiguity) {
        disambiguation = {
          required: true,
          options: [result, ...result.alternatives.slice(0, 3)],
          message: `Multiple locations found for "${location}". Did you mean:`
        }
      }
    }
    
    return {
      valid: result.confidence >= 0.5,
      confidence: result.confidence,
      validated: result,
      alternatives: result.alternatives,
      disambiguation
    }
    
  } catch (error) {
    console.error('Location validation error:', error)
    return {
      valid: false,
      confidence: 0,
      suggestions: [`Unable to validate location "${location}"`]
    }
  }
}