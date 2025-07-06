// Using compromise.js for open-source NLP processing
// @ts-ignore
import nlp from 'compromise'
import type { SearchContext } from '../types'

export interface QueryAnalysis {
  entities: {
    places: string[]
    dates: string[]
    people: string[]
    money: string[]
    organizations: string[]
  }
  sentiment: {
    score: number
    label: 'positive' | 'negative' | 'neutral'
  }
  keywords: string[]
  intents: string[]
  completeness: {
    hasLocation: boolean
    hasDates: boolean
    hasGroupSize: boolean
    hasBudget: boolean
    score: number
  }
  suggestions: string[]
}

export interface TripContext {
  purpose: string | null
  urgency: 'flexible' | 'specific' | 'urgent'
  groupType: 'solo' | 'couple' | 'family' | 'friends' | 'business' | 'unknown'
  priorities: string[]
}

// Simple rule-based trip purpose detection using compromise
const TRIP_PURPOSE_PATTERNS = {
  business: ['work', 'business', 'conference', 'meeting', 'corporate', 'client'],
  romantic: ['romantic', 'honeymoon', 'anniversary', 'couples', 'date'],
  family: ['family', 'kids', 'children', 'reunion'],
  adventure: ['adventure', 'hiking', 'outdoor', 'active', 'sports'],
  relaxation: ['relax', 'spa', 'peaceful', 'quiet', 'wellness'],
  social: ['friends', 'group', 'party', 'celebration'],
  cultural: ['culture', 'museum', 'art', 'history', 'local']
}

export function analyzeQuery(query: string, context?: SearchContext): QueryAnalysis {
  // Use compromise for NLP parsing
  const doc = nlp(query)
  
  // Extract entities using compromise's built-in recognizers
  const entities = {
    places: doc.places().out('array') || [],
    dates: doc.match('#Date').out('array') || [],
    people: doc.people().out('array') || [],
    money: doc.money().out('array') || [],
    organizations: doc.organizations().out('array') || []
  }
  
  // Use natural.js for sentiment analysis
  const sentiment = analyzeSentiment(query)
  
  // Extract keywords using compromise
  const nouns = doc.nouns().out('array') || []
  const adjectives = doc.adjectives().out('array') || []
  const keywords = [...nouns, ...adjectives].slice(0, 10)
  
  // Detect intents using simple pattern matching
  const intents = detectIntents(query)
  
  // Analyze completeness
  const completeness = analyzeCompleteness(query, entities, context)
  
  // Generate suggestions based on missing information
  const suggestions = generateSuggestions(completeness, entities, intents)
  
  return {
    entities,
    sentiment,
    keywords,
    intents,
    completeness,
    suggestions
  }
}

export function extractTripContext(query: string): TripContext {
  const doc = nlp(query)
  const lowerQuery = query.toLowerCase()
  
  // Detect trip purpose using simple pattern matching
  let purpose: string | null = null
  let maxMatches = 0
  
  for (const [tripType, patterns] of Object.entries(TRIP_PURPOSE_PATTERNS)) {
    const matches = patterns.filter(pattern => lowerQuery.includes(pattern)).length
    if (matches > maxMatches) {
      maxMatches = matches
      purpose = tripType
    }
  }
  
  // Detect urgency from temporal language
  let urgency: TripContext['urgency'] = 'flexible'
  if (lowerQuery.includes('asap') || lowerQuery.includes('urgent') || lowerQuery.includes('immediately')) {
    urgency = 'urgent'
  } else if (doc.match('#Date').length > 0 || lowerQuery.includes('specific') || lowerQuery.includes('exact')) {
    urgency = 'specific'
  }
  
  // Detect group type
  let groupType: TripContext['groupType'] = 'unknown'
  if (lowerQuery.includes('alone') || lowerQuery.includes('solo') || lowerQuery.includes('myself')) {
    groupType = 'solo'
  } else if (lowerQuery.includes('couple') || lowerQuery.includes('partner') || lowerQuery.includes('spouse')) {
    groupType = 'couple'
  } else if (lowerQuery.includes('family') || lowerQuery.includes('kids') || lowerQuery.includes('children')) {
    groupType = 'family'
  } else if (lowerQuery.includes('friends') || lowerQuery.includes('group')) {
    groupType = 'friends'
  } else if (lowerQuery.includes('business') || lowerQuery.includes('work') || lowerQuery.includes('corporate')) {
    groupType = 'business'
  }
  
  // Extract priorities from adjectives and emphasized words
  const priorities = doc.adjectives().out('array')
    .concat(doc.match('#Adjective').out('array'))
    .filter((word: string) => word.length > 3)
    .slice(0, 5)
  
  return {
    purpose,
    urgency,
    groupType,
    priorities
  }
}

function analyzeSentiment(text: string) {
  // Simple rule-based sentiment analysis
  const positiveWords = ['love', 'great', 'amazing', 'perfect', 'excellent', 'wonderful', 'fantastic']
  const negativeWords = ['hate', 'terrible', 'awful', 'bad', 'horrible', 'disappointed', 'frustrated']
  
  const lowerText = text.toLowerCase()
  const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length
  const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length
  
  const score = (positiveCount - negativeCount) / Math.max(positiveCount + negativeCount, 1)
  
  let label: 'positive' | 'negative' | 'neutral' = 'neutral'
  if (score > 0.1) label = 'positive'
  else if (score < -0.1) label = 'negative'
  
  return { score, label }
}

function detectIntents(query: string): string[] {
  const intents: string[] = []
  const lowerQuery = query.toLowerCase()
  
  // Simple intent detection patterns
  const intentPatterns = {
    search: ['find', 'search', 'look for', 'need', 'want'],
    compare: ['compare', 'vs', 'versus', 'better', 'difference'],
    filter: ['only', 'just', 'specifically', 'must have'],
    question: ['what', 'how', 'where', 'when', 'why', 'which'],
    book: ['book', 'reserve', 'availability', 'available']
  }
  
  for (const [intent, patterns] of Object.entries(intentPatterns)) {
    if (patterns.some(pattern => lowerQuery.includes(pattern))) {
      intents.push(intent)
    }
  }
  
  return intents
}

function analyzeCompleteness(
  query: string, 
  entities: QueryAnalysis['entities'], 
  context?: SearchContext
): QueryAnalysis['completeness'] {
  const hasLocation = entities.places.length > 0 || 
                     (context?.location && context.location !== 'Unknown') ||
                     /\b(in|at|near|around)\s+\w+/.test(query)
  
  const hasDates = (entities.dates && entities.dates.length > 0) || 
                  !!(context?.checkin || context?.checkout) ||
                  /\b(from|to|during|in)\s+\w+/.test(query)
  
  const hasGroupSize = /\b\d+\s+(people|adults?|guests?)/.test(query) ||
                      !!(context?.adults && context.adults > 0) ||
                      /\b(solo|couple|family|group)/.test(query.toLowerCase())
  
  const hasBudget = (entities.money && entities.money.length > 0) ||
                   !!(context?.maxPrice || context?.minPrice) ||
                   /\b(budget|cheap|expensive|luxury)/.test(query.toLowerCase())
  
  const factors = [hasLocation, hasDates, hasGroupSize, hasBudget]
  const score = factors.filter(Boolean).length / factors.length
  
  return {
    hasLocation,
    hasDates,
    hasGroupSize,
    hasBudget,
    score
  }
}

function generateSuggestions(
  completeness: QueryAnalysis['completeness'],
  _entities: QueryAnalysis['entities'],
  intents: string[]
): string[] {
  const suggestions: string[] = []
  
  if (!completeness.hasLocation) {
    suggestions.push("Where would you like to stay? (e.g., 'in San Francisco' or 'near downtown Austin')")
  }
  
  if (!completeness.hasDates) {
    suggestions.push("When are you planning to visit? (e.g., 'next weekend' or 'March 15-18')")
  }
  
  if (!completeness.hasGroupSize) {
    suggestions.push("How many people will be staying? (e.g., '2 adults' or 'family of 4')")
  }
  
  if (!completeness.hasBudget) {
    suggestions.push("Do you have a budget range in mind? (e.g., 'under $200/night' or 'luxury options')")
  }
  
  // Add intent-specific suggestions
  if (intents.includes('compare')) {
    suggestions.push("What specific features would you like me to compare?")
  }
  
  if (intents.includes('question')) {
    suggestions.push("I'd be happy to provide more details about any specific aspect!")
  }
  
  return suggestions.slice(0, 3) // Limit to 3 suggestions
}

// Helper function to generate conversational responses
export function generateConversationalResponse(
  analysis: QueryAnalysis, 
  tripContext: TripContext,
  resultsCount: number
): string {
  const { sentiment } = analysis
  const { purpose, groupType, urgency } = tripContext
  
  let response = ''
  
  // Acknowledge the request based on sentiment and context
  if (sentiment.label === 'positive') {
    response = "I'd love to help you find the perfect place! "
  } else if (sentiment.label === 'negative') {
    response = "Let me help you find something that'll work better for you. "
  } else {
    response = "I'll help you find great options. "
  }
  
  // Add context-specific language
  if (purpose && groupType !== 'unknown') {
    response += `For your ${purpose} ${groupType === 'solo' ? 'trip' : `${groupType} trip`}, `
  } else if (purpose) {
    response += `For your ${purpose} trip, `
  } else if (groupType !== 'unknown') {
    response += `For your ${groupType} trip, `
  }
  
  // Add results context
  if (resultsCount > 0) {
    response += `I found ${resultsCount} properties that match your criteria. `
  }
  
  // Add urgency context
  if (urgency === 'urgent') {
    response += "I'll prioritize options with immediate availability. "
  }
  
  return response
}

export function shouldUseAIEnhancement(analysis: QueryAnalysis): boolean {
  // Use AI enhancement when:
  // 1. Query is complex (multiple intents)
  // 2. Sentiment suggests frustration or specific needs
  // 3. Query is very incomplete but has some context
  
  return analysis.intents.length > 2 || 
         analysis.sentiment.label === 'negative' ||
         (analysis.completeness.score < 0.5 && analysis.keywords.length > 3)
}