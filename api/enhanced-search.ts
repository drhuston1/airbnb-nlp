// Enhanced unified search endpoint that eliminates API waterfall
// Combines query classification, analysis, and search in a single optimized call
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { API_CONFIG } from './config'
import { geocodingService, type GeocodeResult } from './services/geocoding'
import { callAirbnbHttpAPI } from './airbnb-api'
import { requestDeduplicator } from './utils/request-deduplicator'

interface EnhancedSearchRequest {
  query: string
  context?: {
    hasSearchResults?: boolean
    previousLocation?: string
    currentPage?: number
  }
  preferences?: {
    maxResults?: number
    includeAlternatives?: boolean
    strictFiltering?: boolean
  }
}

interface QueryClassification {
  intent: 'search' | 'travel_question' | 'refinement'
  confidence: number
  reasoning: string
  suggestedAction: 'search_properties' | 'travel_assistant' | 'refine_search'
  extractedLocation?: string
  isSpecific: boolean
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

interface SearchResult {
  id: string
  name: string
  url: string
  images: string[]
  price: {
    total: number
    rate: number
    currency: string
  }
  rating: number
  reviewsCount: number
  location: {
    city: string
    country: string
  }
  host: {
    name: string
    isSuperhost: boolean
  }
  amenities: string[]
  roomType: string
  propertyType?: string
  platform?: string
  bedrooms?: number
  bathrooms?: number
  beds?: number
  maxGuests?: number
  trustScore?: number
}

interface EnhancedSearchResponse {
  success: boolean
  
  // Classification results
  classification: QueryClassification
  
  // Analysis results  
  analysis: QueryAnalysis
  
  // Search results (if classification suggests search)
  searchResults?: {
    listings: SearchResult[]
    hasMore: boolean
    totalResults: number
    page: number
    sources: {
      platform: string
      count: number
      status: 'success' | 'error' | 'timeout'
      error?: string
    }[]
  }
  
  // Travel assistant response (if classification suggests travel question)
  travelResponse?: {
    response: string
    topic: string
    location?: string
    suggestions: string[]
    followUpQuestions: string[]
  }
  
  // Performance metrics
  timing: {
    classification: number
    analysis: number
    search?: number
    travelAssistant?: number
    total: number
  }
  
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

  const startTime = Date.now()
  let classificationTime = 0
  let analysisTime = 0
  let searchTime = 0
  let travelAssistantTime = 0

  try {
    const { 
      query, 
      context = {}, 
      preferences = {} 
    }: EnhancedSearchRequest = req.body

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ 
        success: false,
        error: 'Query is required and must be a string'
      })
    }

    console.log('🚀 Enhanced search request:', { query, context, preferences })

    // Step 1: Quick classification with early exits
    const classificationStart = Date.now()
    const classification = await performInlineClassification(query, context)
    classificationTime = Date.now() - classificationStart
    
    console.log('⚡ Classification completed in', classificationTime, 'ms:', classification)

    // Step 2: Early exit for travel questions
    if (classification.suggestedAction === 'travel_assistant') {
      const travelStart = Date.now()
      const travelResponse = await handleTravelQuestion(query, context)
      travelAssistantTime = Date.now() - travelStart
      
      console.log('🗺️ Travel assistant completed in', travelAssistantTime, 'ms')
      
      return res.status(200).json({
        success: true,
        classification,
        analysis: createMinimalAnalysis(query, context),
        travelResponse,
        timing: {
          classification: classificationTime,
          analysis: 0,
          travelAssistant: travelAssistantTime,
          total: Date.now() - startTime
        }
      })
    }

    // Step 3: Early exit if no location found
    if (!classification.extractedLocation) {
      return res.status(200).json({
        success: true,
        classification,
        analysis: {
          location: 'Unknown',
          isRefinement: false,
          extractedCriteria: {},
          intent: 'new_search',
          confidence: 0.3
        },
        timing: {
          classification: classificationTime,
          analysis: 0,
          total: Date.now() - startTime
        },
        error: 'Location is required for search. Please specify where you would like to stay.'
      })
    }

    // Step 4: PARALLEL execution - Analysis + Location Validation
    const parallelStart = Date.now()
    
    const [analysis, locationValidation] = await Promise.all([
      performInlineAnalysis(query, context, classification),
      validateLocation(classification.extractedLocation)
    ])
    
    const parallelTime = Date.now() - parallelStart
    analysisTime = parallelTime // Both operations completed in parallel
    
    console.log('🔄 Parallel analysis + validation completed in', parallelTime, 'ms')

    // Step 5: Handle location validation results
    if (!locationValidation.valid) {
      return res.status(200).json({
        success: false,
        classification,
        analysis: {
          ...analysis,
          locationValidation
        },
        timing: {
          classification: classificationTime,
          analysis: analysisTime,
          total: Date.now() - startTime
        },
        error: locationValidation.suggestions?.[0] || `Could not find location "${classification.extractedLocation}"`
      })
    }

    // Update analysis with validated location
    if (locationValidation.validated) {
      analysis.location = locationValidation.validated.location
      analysis.locationValidation = locationValidation
    }

    // Step 6: Execute search with validated location
    const searchStart = Date.now()
    const searchResults = await performInlineSearch(query, analysis, preferences, context)
    searchTime = Date.now() - searchStart
    
    console.log('🏠 Search completed in', searchTime, 'ms, found', searchResults?.listings.length || 0, 'properties')

    const totalTime = Date.now() - startTime
    
    // Log request deduplication statistics
    const deduplicationStats = requestDeduplicator.getStats()
    console.log('✅ Enhanced search completed in', totalTime, 'ms (', 
      Math.round(((1200 - totalTime) / 1200) * 100), '% improvement vs 1200ms target)')
    console.log('🔄 Request deduplication:', {
      total: deduplicationStats.totalRequests,
      prevented: deduplicationStats.duplicatePrevented,
      savedRequests: deduplicationStats.duplicatePrevented > 0 
        ? `${Math.round((deduplicationStats.duplicatePrevented / deduplicationStats.totalRequests) * 100)}%` 
        : '0%',
      avgResponseTime: `${deduplicationStats.avgResponseTime}ms`
    })

    const response: EnhancedSearchResponse = {
      success: true,
      classification,
      analysis,
      searchResults,
      timing: {
        classification: classificationTime,
        analysis: analysisTime,
        search: searchTime,
        total: totalTime
      }
    }

    return res.status(200).json(response)

  } catch (error) {
    console.error('Enhanced search error:', error)
    
    const totalTime = Date.now() - startTime
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timing: {
        classification: classificationTime,
        analysis: analysisTime,
        search: searchTime,
        travelAssistant: travelAssistantTime,
        total: totalTime
      }
    })
  }
}

/**
 * Inline classification logic (no external API call)
 */
async function performInlineClassification(
  query: string, 
  context: any
): Promise<QueryClassification> {
  const queryLower = query.toLowerCase().trim()

  // Quick heuristic classification
  const searchKeywords = [
    'house', 'cabin', 'apartment', 'condo', 'villa', 'room', 'rental', 'airbnb',
    'bedroom', 'bathroom', 'sleeps', 'guests', 'night', 'week', 'weekend',
    'pool', 'kitchen', 'parking', 'wifi', 'pet-friendly', 'superhost',
    'luxury', 'budget', 'cheap', 'under', 'over', '$', 'price'
  ]

  const travelQuestionKeywords = [
    'best town', 'best area', 'best neighborhood', 'best place', 'where to stay',
    'what to do', 'activities', 'attractions', 'restaurants', 'when to visit',
    'best time', 'weather', 'season', 'recommend', 'suggestion', 'advice'
  ]

  const refinementKeywords = [
    'show me', 'filter', 'only', 'prefer', 'want', 'need', 'must have',
    'change', 'different', 'another', 'more', 'less', 'cheaper', 'expensive'
  ]

  // Count keyword matches
  const searchScore = searchKeywords.filter(keyword => queryLower.includes(keyword)).length
  const travelScore = travelQuestionKeywords.filter(keyword => queryLower.includes(keyword)).length
  const refinementScore = refinementKeywords.filter(keyword => queryLower.includes(keyword)).length

  // Generic location extraction patterns
  const locationPatterns = [
    /\bnear\s+([^,?!.]+?)(?:\s+\w+(?:ing|ed|s|er|est)|\s*[,$!.]|$)/i,  // "near [location]"
    /\bin\s+([^,?!.]+?)(?:\s+\w+(?:ing|ed|s|er|est)|\s*[,$!.]|$)/i,    // "in [location]"
    /\baround\s+([^,?!.]+?)(?:\s+\w+(?:ing|ed|s|er|est)|\s*[,$!.]|$)/i, // "around [location]"
    /\bat\s+([^,?!.]+?)(?:\s+\w+(?:ing|ed|s|er|est)|\s*[,$!.]|$)/i      // "at [location]"
  ]

  let extractedLocation: string | undefined
  
  // Try location pattern matching
  for (const pattern of locationPatterns) {
    const match = query.match(pattern)
    if (match) {
      extractedLocation = match[1].trim()
      // Generic cleanup - remove common descriptive suffixes
      extractedLocation = extractedLocation.replace(/\s+(area|region|town|city|place|location)$/i, '')
      break
    }
  }

  // Question patterns
  const questionPatterns = [
    /what\s+is\s+the\s+best/i,
    /where\s+should\s+i/i,
    /which\s+(town|area|neighborhood|place)/i,
    /what\s+(town|area|neighborhood|place)/i,
    /best\s+(town|area|neighborhood|place|city)/i,
    /where\s+to\s+(stay|go|visit)/i
  ]

  const isQuestion = questionPatterns.some(pattern => pattern.test(query))

  // Determine intent
  let intent: 'search' | 'travel_question' | 'refinement'
  let confidence: number
  let reasoning: string
  let suggestedAction: 'search_properties' | 'travel_assistant' | 'refine_search'

  if (isQuestion && travelScore > 0 && searchScore === 0) {
    intent = 'travel_question'
    confidence = 0.9
    reasoning = 'Query contains question patterns asking for travel advice without specific property requirements'
    suggestedAction = 'travel_assistant'
  } else if (context.hasSearchResults && refinementScore > 0 && !extractedLocation) {
    intent = 'refinement'
    confidence = 0.8
    reasoning = 'Query contains refinement keywords and user has existing search results'
    suggestedAction = 'refine_search'
  } else if (searchScore > travelScore && (extractedLocation || searchScore >= 2)) {
    intent = 'search'
    confidence = Math.min(0.95, 0.6 + (searchScore * 0.1))
    reasoning = `Query contains ${searchScore} property search keywords${extractedLocation ? ' and has location' : ''}`
    suggestedAction = 'search_properties'
  } else if (travelScore > searchScore || isQuestion) {
    intent = 'travel_question'
    confidence = Math.min(0.9, 0.6 + (travelScore * 0.1))
    reasoning = `Query contains ${travelScore} travel question keywords or question patterns`
    suggestedAction = 'travel_assistant'
  } else {
    if (extractedLocation) {
      intent = 'search'
      confidence = 0.6
      reasoning = 'Query has location but unclear intent - defaulting to property search'
      suggestedAction = 'search_properties'
    } else {
      intent = 'travel_question'
      confidence = 0.5
      reasoning = 'Unclear intent without location - defaulting to travel assistant'
      suggestedAction = 'travel_assistant'
    }
  }

  const isSpecific = !!(extractedLocation && (searchScore >= 2 || intent === 'search'))

  return {
    intent,
    confidence,
    reasoning,
    suggestedAction,
    extractedLocation,
    isSpecific
  }
}

/**
 * Inline analysis using GPT (optimized prompt)
 */
async function performInlineAnalysis(
  query: string, 
  context: any,
  classification?: QueryClassification
): Promise<QueryAnalysis> {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    throw new Error('OpenAI API key not configured')
  }

  const contextInfo = context.previousLocation 
    ? `Previous search was for: "${context.previousLocation}". ${context.hasSearchResults ? 'User has existing search results.' : ''}`
    : 'This is a new search with no previous context.'

  // Optimized prompt for faster processing
  const prompt = `Analyze this travel query and extract structured information:

Context: ${contextInfo}
Query: "${query}"

Return JSON with this structure:
{
  "location": "extracted location name as mentioned in query, 'SAME' if refining existing location, or 'Unknown'",
  "isRefinement": boolean,
  "refinementType": "price|rating|amenity|property_type|host_type|general|null",
  "extractedCriteria": {
    "priceRange": {"min": number|null, "max": number|null, "budget": "budget|mid-range|luxury|null"},
    "rating": {"min": number|null, "excellent": boolean, "superhost": boolean, "reviewCount": number|null},
    "amenities": ["extracted amenities"],
    "propertyType": "extracted property type or null",
    "bedrooms": number|null,
    "bathrooms": number|null,
    "guests": {"adults": number|null, "children": number|null, "total": number|null},
    "dates": {"checkin": "YYYY-MM-DD|null", "checkout": "YYYY-MM-DD|null", "flexible": boolean}
  },
  "intent": "new_search|refine_location|refine_criteria|more_specific",
  "confidence": number
}`

  // Use request deduplicator for OpenAI API calls to prevent duplicate requests
  const data = await requestDeduplicator.fetchJson('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Extract structured information from travel queries. Return only valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 800,
      temperature: 0.1
    })
  })

  const analysisText = data.choices[0]?.message?.content?.trim()
  
  if (!analysisText) {
    throw new Error('Empty response from GPT')
  }

  let analysis: QueryAnalysis
  try {
    analysis = JSON.parse(analysisText)
  } catch (parseError) {
    console.error('Failed to parse GPT response:', analysisText)
    analysis = createFallbackAnalysis(query, context, classification)
  }

  // Handle SAME location logic
  if (analysis.location === 'SAME') {
    if (context.previousLocation) {
      analysis.location = context.previousLocation
    } else {
      analysis.location = 'Unknown'
      analysis.isRefinement = false
    }
  }

  // Perform location validation if needed
  if (analysis.location && analysis.location !== 'Unknown') {
    try {
      const locationValidation = await validateLocation(analysis.location)
      analysis.locationValidation = locationValidation
      
      if (locationValidation.valid && locationValidation.validated) {
        analysis.location = locationValidation.validated.location
      }
    } catch (error) {
      console.warn('Location validation failed:', error)
    }
  }

  return analysis
}

/**
 * Inline search execution
 */
async function performInlineSearch(
  query: string,
  analysis: QueryAnalysis,
  preferences: any,
  context: any
) {
  // Import the actual search logic from unified-search.ts
  const searchPayload = {
    query,
    location: analysis.location,
    page: context.currentPage || 1,
    adults: analysis.extractedCriteria.guests?.adults || 2,
    children: analysis.extractedCriteria.guests?.children || 0,
    ...(analysis.extractedCriteria.dates?.checkin && { checkin: analysis.extractedCriteria.dates.checkin }),
    ...(analysis.extractedCriteria.dates?.checkout && { checkout: analysis.extractedCriteria.dates.checkout }),
    ...(analysis.extractedCriteria.priceRange?.min && { priceMin: analysis.extractedCriteria.priceRange.min }),
    ...(analysis.extractedCriteria.priceRange?.max && { priceMax: analysis.extractedCriteria.priceRange.max }),
    ...(analysis.extractedCriteria.bedrooms && { minBedrooms: analysis.extractedCriteria.bedrooms }),
    ...(analysis.extractedCriteria.bathrooms && { minBathrooms: analysis.extractedCriteria.bathrooms })
  }

  // Call the Airbnb search function (pre-imported for performance)
  const result = await callAirbnbHttpAPI(searchPayload)
  
  return {
    listings: result.properties || [],
    hasMore: result.hasMore || false,
    totalResults: result.totalResults || 0,
    page: searchPayload.page,
    sources: [{
      platform: 'airbnb',
      count: result.properties?.length || 0,
      status: 'success' as const
    }]
  }
}

/**
 * Handle travel questions
 */
async function handleTravelQuestion(query: string, context: any) {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    throw new Error('OpenAI API key not configured')
  }

  const prompt = `You are a travel expert. Answer this travel question with practical advice:

Question: "${query}"

Provide a helpful response and suggest follow-up questions. Format as JSON:
{
  "response": "detailed travel advice",
  "topic": "general topic category",
  "location": "mentioned location or null",
  "suggestions": ["specific actionable suggestions"],
  "followUpQuestions": ["related questions the user might ask"]
}`

  // Use request deduplicator for travel assistant calls
  const data = await requestDeduplicator.fetchJson('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful travel assistant. Provide practical travel advice and suggestions.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 600,
      temperature: 0.3
    })
  })

  const responseText = data.choices[0]?.message?.content?.trim()
  
  try {
    return JSON.parse(responseText)
  } catch (error) {
    return {
      response: "I'd be happy to help with your travel question. Could you provide more specific details?",
      topic: "general",
      location: null,
      suggestions: ["Be more specific about your travel needs", "Include your destination", "Mention your travel dates"],
      followUpQuestions: ["What destination are you considering?", "When are you planning to travel?"]
    }
  }
}

/**
 * Create minimal analysis for travel questions
 */
function createMinimalAnalysis(query: string, context: any): QueryAnalysis {
  return {
    location: 'Unknown',
    isRefinement: false,
    extractedCriteria: {},
    intent: 'new_search',
    confidence: 0.5
  }
}

/**
 * Create fallback analysis
 */
function createFallbackAnalysis(query: string, context: any, classification?: QueryClassification): QueryAnalysis {
  // Use classification location if available, otherwise fallback to previous or Unknown
  const location = classification?.extractedLocation || context.previousLocation || 'Unknown'
  
  return {
    location,
    isRefinement: !!context.previousLocation,
    extractedCriteria: {},
    intent: context.previousLocation ? 'refine_criteria' : 'new_search',
    confidence: 0.3
  }
}


/**
 * Validate location using geocoding with enhanced caching
 */
async function validateLocation(location: string) {
  try {
    const startTime = Date.now()
    const result = await geocodingService.geocode(location, {
      includeAlternatives: true,
      maxResults: 3,
      fuzzyMatching: true
    })
    const geocodingTime = Date.now() - startTime
    
    // Log cache performance
    const cacheStats = geocodingService.getCacheStats()
    console.log(`🗺️ Location validation completed in ${geocodingTime}ms (cache: ${cacheStats.size} entries, ${cacheStats.totalHits} total hits)`)
    
    if (!result) {
      return {
        valid: false,
        confidence: 0,
        suggestions: [`Could not find location "${location}". Please check spelling.`]
      }
    }
    
    return {
      valid: result.confidence >= 0.5,
      confidence: result.confidence,
      validated: result,
      alternatives: result.alternatives
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