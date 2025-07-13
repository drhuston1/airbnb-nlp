import type { VercelRequest, VercelResponse } from '@vercel/node'

interface QueryClassificationRequest {
  query: string
  context?: {
    hasSearchResults?: boolean
    previousLocation?: string
  }
}

interface QueryClassificationResponse {
  intent: 'search' | 'travel_question' | 'refinement'
  confidence: number
  reasoning: string
  suggestedAction: 'search_properties' | 'travel_assistant' | 'refine_search'
  extractedLocation?: string
  isSpecific: boolean
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { query, context = {} }: QueryClassificationRequest = req.body

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' })
    }

    const queryLower = query.toLowerCase().trim()

    // Quick heuristic classification first
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

    // Check for location extraction
    const locationPatterns = [
      /\bin\s+([^,?!.]+)/i,
      /\bnear\s+([^,?!.]+)/i,
      /\baround\s+([^,?!.]+)/i,
      /\bat\s+([^,?!.]+)/i,
      /([a-z\s]+),\s*([a-z\s]+)/i // City, State pattern
    ]

    let extractedLocation: string | undefined
    for (const pattern of locationPatterns) {
      const match = query.match(pattern)
      if (match) {
        extractedLocation = match[1].trim()
        break
      }
    }

    // Question patterns that indicate travel questions
    const questionPatterns = [
      /what\s+is\s+the\s+best/i,
      /where\s+should\s+i/i,
      /which\s+(town|area|neighborhood|place)/i,
      /what\s+(town|area|neighborhood|place)/i,
      /best\s+(town|area|neighborhood|place|city)/i,
      /where\s+to\s+(stay|go|visit)/i
    ]

    const isQuestion = questionPatterns.some(pattern => pattern.test(query))

    // Determine intent based on scores and patterns
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
      // Fallback - if uncertain, lean towards search if there's a location
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

    // Determine if query is specific enough for good results
    const isSpecific = !!(extractedLocation && (searchScore >= 2 || intent === 'search'))

    const result: QueryClassificationResponse = {
      intent,
      confidence,
      reasoning,
      suggestedAction,
      extractedLocation,
      isSpecific
    }

    console.log('Query classification:', {
      query,
      result,
      scores: { search: searchScore, travel: travelScore, refinement: refinementScore },
      isQuestion,
      context
    })

    res.status(200).json(result)

  } catch (error) {
    console.error('Query classification error:', error)
    
    // Fallback classification
    res.status(200).json({
      intent: 'search',
      confidence: 0.5,
      reasoning: 'Error in classification - defaulting to search',
      suggestedAction: 'search_properties',
      isSpecific: false
    })
  }
}