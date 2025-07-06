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
  guestInfo: {
    adults: number | null
    children: number | null
    totalGuests: number | null
    guestTypes: string[]
    hasGroupInfo: boolean
  }
  propertyNeeds: {
    minBedrooms: number | null
    amenities: string[]
    propertyType: string | null
    accessibility: string[]
  }
  reviewRequirements: {
    minReviews: number | null
    minRating: number | null
    qualityKeywords: string[]
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
    hasPropertyNeeds: boolean
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
  
  // Extract entities using compromise's built-in recognizers + enhanced place detection
  const entities = {
    places: extractEnhancedPlaces(query, doc),
    dates: doc.match('#Date').out('array') || [],
    people: doc.people().out('array') || [],
    money: doc.money().out('array') || [],
    organizations: doc.organizations().out('array') || []
  }
  
  // Extract guest information using NLP
  const guestInfo = extractGuestInfo(query, doc)
  
  // Extract property requirements using NLP
  const propertyNeeds = extractPropertyNeeds(query, doc, guestInfo)
  
  // Extract review requirements
  const reviewRequirements = extractReviewRequirements(query)
  
  // Use sentiment analysis
  const sentiment = analyzeSentiment(query)
  
  // Extract keywords using compromise
  const nouns = doc.nouns().out('array') || []
  const adjectives = doc.adjectives().out('array') || []
  const keywords = [...nouns, ...adjectives].slice(0, 10)
  
  // Detect intents using simple pattern matching
  const intents = detectIntents(query)
  
  // Analyze completeness
  const completeness = analyzeCompleteness(query, entities, context, guestInfo, propertyNeeds)
  
  // Generate suggestions based on missing information
  const suggestions = generateSuggestions(completeness, entities, intents, guestInfo, propertyNeeds)
  
  return {
    entities,
    guestInfo,
    propertyNeeds,
    reviewRequirements,
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
  context?: SearchContext,
  guestInfo?: any,
  propertyNeeds?: any
): QueryAnalysis['completeness'] {
  const hasLocation = entities.places.length > 0 || 
                     (context?.location && context.location !== 'Unknown') ||
                     /\b(in|at|near|around)\s+\w+/.test(query)
  
  const hasDates = (entities.dates && entities.dates.length > 0) || 
                  !!(context?.checkin || context?.checkout) ||
                  /\b(from|to|during|in)\s+\w+/.test(query)
  
  const hasGroupSize = guestInfo?.hasGroupInfo || 
                      !!(context?.adults && context.adults > 0)
  
  const hasBudget = (entities.money && entities.money.length > 0) ||
                   !!(context?.maxPrice || context?.minPrice) ||
                   /\b(budget|cheap|expensive|luxury)/.test(query.toLowerCase())
  
  const hasPropertyNeeds = propertyNeeds?.amenities?.length > 0 || 
                          propertyNeeds?.propertyType !== null ||
                          propertyNeeds?.minBedrooms !== null
  
  const factors = [hasLocation, hasDates, hasGroupSize, hasBudget, hasPropertyNeeds]
  const score = factors.filter(Boolean).length / factors.length
  
  return {
    hasLocation,
    hasDates,
    hasGroupSize,
    hasBudget,
    hasPropertyNeeds,
    score
  }
}

function generateSuggestions(
  completeness: QueryAnalysis['completeness'],
  _entities: QueryAnalysis['entities'],
  intents: string[],
  guestInfo?: any,
  propertyNeeds?: any
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
  } else if (guestInfo?.totalGuests >= 4 && !propertyNeeds?.minBedrooms) {
    suggestions.push(`For ${guestInfo.totalGuests} guests, would you prefer a specific number of bedrooms?`)
  }
  
  if (!completeness.hasPropertyNeeds && guestInfo?.guestTypes?.includes('children')) {
    suggestions.push("Any family-friendly amenities needed? (e.g., 'pool', 'playground', 'baby-safe')")
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

// Extract guest information using NLP
function extractGuestInfo(query: string, _doc: unknown) {
  // Convert text numbers to digits for Compromise.js
  const textNumbers = {
    'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
    'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10'
  }
  
  let normalizedQuery = query.toLowerCase()
  for (const [word, digit] of Object.entries(textNumbers)) {
    normalizedQuery = normalizedQuery.replace(new RegExp(`\\b${word}\\b`, 'g'), digit)
  }
  
  // Use Compromise.js to find numbers (for future enhancement)
  // const numbers = nlp(normalizedQuery).match('#Value').out('array')
  
  // Extract adults using NLP patterns
  let adults: number | null = null
  const adultPatterns = [
    /(\d+)\s+adults?/i,
    /for\s+(\d+)\s+adults?/i
  ]
  
  for (const pattern of adultPatterns) {
    const match = normalizedQuery.match(pattern)
    if (match) {
      adults = parseInt(match[1])
      break
    }
  }
  
  // Extract children/toddlers using NLP patterns
  let children: number | null = null
  const childPatterns = [
    /(\d+)\s+(?:child|children|toddler|toddlers|kids?)/i,
    /and\s+(\d+)\s+(?:child|children|toddler|toddlers|kids?)/i
  ]
  
  for (const pattern of childPatterns) {
    const match = normalizedQuery.match(pattern)
    if (match) {
      children = parseInt(match[1])
      break
    }
  }
  
  // Extract guest types using NLP
  const guestTypes: string[] = []
  const guestTypePatterns = {
    'adults': /adults?/i,
    'children': /child|children|kids?/i,
    'toddlers': /toddlers?/i,
    'infants': /infants?|babies/i,
    'seniors': /seniors?|elderly/i,
    'teenagers': /teen|teenagers?/i
  }
  
  for (const [type, pattern] of Object.entries(guestTypePatterns)) {
    if (pattern.test(query)) {
      guestTypes.push(type)
    }
  }
  
  // Calculate total guests
  let totalGuests: number | null = null
  if (adults !== null || children !== null) {
    totalGuests = (adults || 0) + (children || 0)
  } else {
    // Fallback: look for total people count
    const peopleMatch = normalizedQuery.match(/for\s+(\d+)\s+people/i)
    if (peopleMatch) {
      totalGuests = parseInt(peopleMatch[1])
      adults = totalGuests // Assume all adults if not specified
    }
  }
  
  return {
    adults,
    children,
    totalGuests,
    guestTypes,
    hasGroupInfo: adults !== null || children !== null || totalGuests !== null
  }
}

// Extract property requirements using NLP
function extractPropertyNeeds(query: string, _doc: unknown, guestInfo: unknown) {
  const lowerQuery = query.toLowerCase()
  
  // Estimate minimum bedrooms based on guest count
  let minBedrooms: number | null = null
  const guestInfoTyped = guestInfo as { totalGuests?: number }
  if (guestInfoTyped.totalGuests) {
    if (guestInfoTyped.totalGuests >= 7) minBedrooms = 4
    else if (guestInfoTyped.totalGuests >= 5) minBedrooms = 3
    else if (guestInfoTyped.totalGuests >= 3) minBedrooms = 2
    else minBedrooms = 1
  }
  
  // Override with explicit bedroom mentions
  const bedroomMatch = lowerQuery.match(/(\d+)\s+bedroom/i)
  if (bedroomMatch) {
    minBedrooms = parseInt(bedroomMatch[1])
  }
  
  // Extract amenities using NLP
  const amenities: string[] = []
  const amenityPatterns = {
    'pool': /pool/i,
    'hot_tub': /hot\s*tub|jacuzzi|spa/i,
    'kitchen': /kitchen|cooking/i,
    'parking': /parking|garage/i,
    'wifi': /wifi|internet/i,
    'workspace': /workspace|office|desk|work\s+area/i,
    'laundry': /laundry|washer|dryer/i,
    'pet_friendly': /pet\s*friendly|dogs?\s+allowed/i,
    'beach_access': /beach|beachfront|oceanfront/i,
    'view': /view|scenic|overlook/i,
    'fireplace': /fireplace/i,
    'balcony': /balcony|terrace|deck/i,
    'air_conditioning': /air\s*conditioning|a\/c/i
  }
  
  for (const [amenity, pattern] of Object.entries(amenityPatterns)) {
    if (pattern.test(query)) {
      amenities.push(amenity)
    }
  }
  
  // Extract property type using NLP
  let propertyType: string | null = null
  const typePatterns = {
    'house': /house|home|villa/i,
    'apartment': /apartment|condo/i,
    'studio': /studio/i,
    'cabin': /cabin|cottage/i,
    'loft': /loft/i
  }
  
  for (const [type, pattern] of Object.entries(typePatterns)) {
    if (pattern.test(query)) {
      propertyType = type
      break
    }
  }
  
  // Extract accessibility needs
  const accessibility: string[] = []
  if (/wheelchair|accessible|disability/i.test(query)) {
    accessibility.push('wheelchair_accessible')
  }
  if (/elevator/i.test(query)) {
    accessibility.push('elevator')
  }
  if (/ground\s+floor|first\s+floor/i.test(query)) {
    accessibility.push('ground_floor')
  }
  
  return {
    minBedrooms,
    amenities,
    propertyType,
    accessibility
  }
}

// Extract review and rating requirements using NLP
function extractReviewRequirements(query: string) {
  const lowerQuery = query.toLowerCase()
  
  let minReviews: number | null = null
  let minRating: number | null = null
  const qualityKeywords: string[] = []
  
  // Extract review count requirements
  const reviewPatterns = [
    /(?:at least|minimum|min)?\s*(\d+)\s*(?:\+)?\s*reviews?/i,
    /(?:over|more than)\s*(\d+)\s*reviews?/i,
    /(\d+)\s*(?:\+)?\s*reviews?\s*(?:or more|minimum|min)/i
  ]
  
  for (const pattern of reviewPatterns) {
    const match = lowerQuery.match(pattern)
    if (match && match[1]) {
      minReviews = parseInt(match[1])
      break
    }
  }
  
  // Extract rating requirements
  const ratingPatterns = [
    /(?:highest|best|top)\s*(?:rated?|rating)/i,
    /(\d(?:\.\d)?)\s*(?:\+)?\s*(?:star|rating)/i,
    /rating\s*(?:of\s*)?(\d(?:\.\d)?)\s*(?:\+)?/i
  ]
  
  for (const pattern of ratingPatterns) {
    const match = lowerQuery.match(pattern)
    if (match && match[1]) {
      minRating = parseFloat(match[1])
      break
    } else if (pattern.test(lowerQuery)) {
      // "highest rating" without specific number
      qualityKeywords.push('highest_rating')
      break
    }
  }
  
  // Extract quality keywords
  const qualityTerms = ['well reviewed', 'highly rated', 'top rated', 'best rated', 'excellent', 'superhost']
  qualityTerms.forEach(term => {
    if (lowerQuery.includes(term)) {
      qualityKeywords.push(term.replace(/\s+/g, '_'))
    }
  })
  
  return {
    minReviews,
    minRating,
    qualityKeywords
  }
}

// Enhanced place detection that combines NLP with location patterns
function extractEnhancedPlaces(query: string, doc: unknown): string[] {
  // Start with Compromise.js built-in place detection
  const nlpDoc = doc as { places(): { out(format: string): string[] } }
  const nlpPlaces = nlpDoc.places().out('array') || []
  
  // If NLP found places, use them
  if (nlpPlaces.length > 0) {
    return nlpPlaces
  }
  
  // Enhanced place detection using location context patterns
  const locationContextPatterns = [
    /(?:near|in|at|around|by)\s+([A-Z][a-zA-Z\s]+?)(?:\s+under|\s+with|\s+for|\s*$|\s+\d)/i,
    /(?:cabin|property|house|home)\s+(?:near|in|at)\s+([A-Z][a-zA-Z\s]+?)(?:\s+under|\s+with|\s+for|\s*$)/i
  ]
  
  for (const pattern of locationContextPatterns) {
    const match = query.match(pattern)
    if (match && match[1]) {
      let place = match[1].trim()
      // Remove common non-location words
      place = place.replace(/\b(for|with|and|the|a|an|property|house|cabin|under|over|rating)\b/gi, '')
      place = place.replace(/\s+/g, ' ').trim()
      
      // Only return if it looks like a valid place name (starts with capital, reasonable length)
      if (place.length >= 3 && /^[A-Z]/.test(place) && !/^\d/.test(place)) {
        console.log(`Enhanced place detection found: "${place}"`)
        return [place]
      }
    }
  }
  
  return []
}