import type { AirbnbListing } from '../types'
import type { QueryAnalysis, TripContext } from './nlpAnalysis'

export interface AIEnhancedResponse {
  personalizedMessage: string
  clarifyingQuestions: string[]
  recommendations: PropertyRecommendation[]
  insights: string[]
}

export interface PropertyRecommendation {
  listing: AirbnbListing
  reason: string
  score: number
}

// This would integrate with OpenAI API or similar for complex queries
export async function enhanceWithAI(
  _query: string,
  analysis: QueryAnalysis,
  tripContext: TripContext,
  listings: AirbnbListing[]
): Promise<AIEnhancedResponse> {
  
  // For now, provide a sophisticated rule-based enhancement
  // In production, this could call OpenAI API for complex cases
  
  const personalizedMessage = generatePersonalizedMessage(_query, analysis, tripContext, listings.length)
  const clarifyingQuestions = generateSmartQuestions(analysis, tripContext)
  const recommendations = generateRecommendations(listings, tripContext)
  const insights = generateInsights(listings, tripContext, analysis)
  
  return {
    personalizedMessage,
    clarifyingQuestions,
    recommendations,
    insights
  }
}

function generatePersonalizedMessage(
  _query: string,
  analysis: QueryAnalysis,
  tripContext: TripContext,
  resultsCount: number
): string {
  let message = ''
  
  // Personalize based on group type and purpose
  if (tripContext.groupType === 'family' && tripContext.purpose === 'relaxation') {
    message = `Perfect! I found ${resultsCount} family-friendly properties for a relaxing getaway. `
  } else if (tripContext.groupType === 'business') {
    message = `I've found ${resultsCount} business-suitable properties with professional amenities. `
  } else if (tripContext.purpose === 'romantic') {
    message = `Wonderful! I have ${resultsCount} romantic properties perfect for your special trip. `
  } else {
    message = `Great! I found ${resultsCount} properties that match your needs. `
  }
  
  // Add context about search sophistication
  if (analysis.keywords.length > 5) {
    message += "I've analyzed your detailed preferences to rank these specifically for you. "
  }
  
  // Add urgency context
  if (tripContext.urgency === 'urgent') {
    message += "I've prioritized properties with immediate availability. "
  }
  
  return message
}

function generateSmartQuestions(
  analysis: QueryAnalysis,
  tripContext: TripContext
): string[] {
  const questions: string[] = []
  
  // Smart questions based on trip context
  if (tripContext.purpose === 'business' && !analysis.completeness.hasDates) {
    questions.push("When is your business trip? I can check availability and suggest properties near conference centers or business districts.")
  } else if (tripContext.purpose === 'romantic' && analysis.completeness.score < 0.7) {
    questions.push("What would make this trip extra special? Private hot tub, ocean view, or perhaps a cozy fireplace?")
  } else if (tripContext.groupType === 'family' && !analysis.completeness.hasGroupSize) {
    questions.push("How many in your family and what ages? This helps me find properties with the right safety features and amenities.")
  }
  
  // Generic smart questions based on completeness
  if (!analysis.completeness.hasLocation) {
    questions.push("Which destination has caught your eye? I can provide local insights and neighborhood recommendations.")
  }
  
  if (!analysis.completeness.hasBudget && tripContext.purpose) {
    questions.push(`For ${tripContext.purpose} trips, I typically see budgets ranging from $100-500/night. What feels comfortable for you?`)
  }
  
  return questions.slice(0, 2)
}

function generateRecommendations(
  listings: AirbnbListing[],
  tripContext: TripContext
): PropertyRecommendation[] {
  if (listings.length === 0) return []
  
  const recommendations: PropertyRecommendation[] = []
  
  // Sort listings by relevance to trip context
  const sortedListings = [...listings].sort((a, b) => {
    return calculateRelevanceScore(b, tripContext) - calculateRelevanceScore(a, tripContext)
  })
  
  // Generate recommendations for top 3 properties
  sortedListings.slice(0, 3).forEach(listing => {
    const reason = generateRecommendationReason(listing, tripContext)
    const score = calculateRelevanceScore(listing, tripContext)
    
    recommendations.push({
      listing,
      reason,
      score
    })
  })
  
  return recommendations
}

function calculateRelevanceScore(listing: AirbnbListing, tripContext: TripContext): number {
  let score = listing.rating * 20 // Base score from rating
  
  const name = listing.name.toLowerCase()
  const roomType = listing.roomType.toLowerCase()
  
  // Score based on trip purpose
  if (tripContext.purpose === 'business') {
    if (name.includes('workspace') || name.includes('office') || name.includes('desk')) score += 30
    if (name.includes('wifi') || name.includes('internet')) score += 20
    if (name.includes('downtown') || name.includes('center')) score += 15
  } else if (tripContext.purpose === 'romantic') {
    if (name.includes('private') || name.includes('secluded')) score += 30
    if (name.includes('view') || name.includes('ocean') || name.includes('sunset')) score += 25
    if (name.includes('hot tub') || name.includes('fireplace')) score += 20
  } else if (tripContext.purpose === 'family') {
    if (name.includes('family') || name.includes('kid')) score += 30
    if (name.includes('pool') || name.includes('playground')) score += 25
    if (name.includes('kitchen') || name.includes('multiple bedroom')) score += 20
  }
  
  // Score based on group type
  if (tripContext.groupType === 'business' && roomType.includes('entire')) score += 15
  if (tripContext.groupType === 'family' && roomType.includes('entire')) score += 20
  if (tripContext.groupType === 'solo' && roomType.includes('private')) score += 10
  
  // Superhost bonus
  if (listing.host.isSuperhost) score += 15
  
  // Review count reliability
  if (listing.reviewsCount > 50) score += 10
  else if (listing.reviewsCount > 20) score += 5
  
  return score
}

function generateRecommendationReason(listing: AirbnbListing, tripContext: TripContext): string {
  const reasons: string[] = []
  const name = listing.name.toLowerCase()
  
  // Purpose-specific reasons
  if (tripContext.purpose === 'business') {
    if (name.includes('workspace') || name.includes('office')) {
      reasons.push("dedicated workspace")
    }
    if (name.includes('downtown') || name.includes('center')) {
      reasons.push("central business location")
    }
  } else if (tripContext.purpose === 'romantic') {
    if (name.includes('private') || name.includes('secluded')) {
      reasons.push("private and intimate setting")
    }
    if (name.includes('view') || name.includes('ocean')) {
      reasons.push("beautiful views")
    }
  } else if (tripContext.purpose === 'family') {
    if (name.includes('family') || name.includes('kid')) {
      reasons.push("family-friendly features")
    }
    if (name.includes('pool')) {
      reasons.push("swimming pool for the kids")
    }
  }
  
  // General quality indicators
  if (listing.host.isSuperhost) {
    reasons.push("superhost with excellent reviews")
  }
  
  if (listing.rating >= 4.8) {
    reasons.push("outstanding guest ratings")
  }
  
  if (listing.reviewsCount > 100) {
    reasons.push("well-established with many happy guests")
  }
  
  // Construct reason string
  if (reasons.length === 0) {
    return `Highly rated property (${listing.rating}/5) with good reviews`
  }
  
  if (reasons.length === 1) {
    return `Perfect for ${reasons[0]}`
  }
  
  if (reasons.length === 2) {
    return `Great choice for ${reasons[0]} and ${reasons[1]}`
  }
  
  return `Excellent option featuring ${reasons[0]}, ${reasons[1]}, and ${reasons[2]}`
}

function generateInsights(
  listings: AirbnbListing[],
  tripContext: TripContext,
  _analysis: QueryAnalysis
): string[] {
  const insights: string[] = []
  
  if (listings.length === 0) return insights
  
  // Price insights
  const prices = listings.map(l => l.price.rate)
  const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  
  insights.push(`Price range: $${minPrice}-$${maxPrice}/night (avg: $${Math.round(avgPrice)})`)
  
  // Quality insights
  const avgRating = listings.reduce((sum, l) => sum + l.rating, 0) / listings.length
  const superhostCount = listings.filter(l => l.host.isSuperhost).length
  
  if (avgRating >= 4.5) {
    insights.push(`Excellent quality options - average rating ${avgRating.toFixed(1)}/5`)
  }
  
  if (superhostCount > 0) {
    insights.push(`${superhostCount} properties are hosted by Superhosts`)
  }
  
  // Purpose-specific insights
  if (tripContext.purpose === 'business') {
    const businessFriendly = listings.filter(l => 
      l.name.toLowerCase().includes('workspace') || 
      l.name.toLowerCase().includes('wifi') ||
      l.name.toLowerCase().includes('desk')
    ).length
    
    if (businessFriendly > 0) {
      insights.push(`${businessFriendly} properties mention business amenities`)
    }
  }
  
  return insights.slice(0, 3) // Limit to 3 insights
}

// Simple function to determine if we should use AI enhancement
export function shouldEnhanceWithAI(query: string, analysis: QueryAnalysis): boolean {
  // Use AI enhancement for complex queries or when rule-based approach isn't sufficient
  return (
    analysis.intents.length > 2 || // Multiple intents
    analysis.sentiment.label === 'negative' || // User seems frustrated
    analysis.keywords.length > 8 || // Very detailed query
    query.length > 100 // Long, complex query
  )
}

// Placeholder for actual AI API integration
export async function callAIAPI(prompt: string): Promise<string> {
  // In production, this would call OpenAI or similar service
  // For now, return a placeholder
  console.log('Would call AI API with prompt:', prompt)
  return "AI-enhanced response would go here"
}