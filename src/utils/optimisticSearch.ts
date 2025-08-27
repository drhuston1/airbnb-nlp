/**
 * Optimistic search utilities for instant user feedback
 * Provides quick location extraction and prediction for immediate UI updates
 */

interface OptimisticSearchPrediction {
  location: string
  confidence: number
  searchType: 'location' | 'refinement' | 'travel_question'
  estimatedResults: number
  suggestedMessage: string
  loadingSteps: string[]
}

/**
 * Quickly extract location from query using regex patterns
 * Much faster than AI analysis for immediate feedback
 */
export function extractLocationQuickly(query: string): string {
  const cleanQuery = query.toLowerCase().trim()
  
  // Common location patterns
  const locationPatterns = [
    // "in [location]" or "near [location]"
    /(?:in|near|around|close to|by)\s+([a-z\s,]+?)(?:\s|$|,|\.|!|\?)/i,
    
    // "[location] vacation" or "[location] rental"
    /^([a-z\s,]+?)\s+(?:vacation|rental|property|house|cabin|condo|apartment|airbnb|stays?)/i,
    
    // "Find [something] in [location]"
    /find\s+.+?\s+in\s+([a-z\s,]+?)(?:\s|$|,|\.|!|\?)/i,
    
    // Direct city names (common patterns)
    /\b(san francisco|los angeles|new york|miami|chicago|seattle|portland|austin|denver|boston|washington dc|las vegas|orlando|phoenix|atlanta|philadelphia|detroit|nashville|charlotte|baltimore|milwaukee|columbus|indianapolis|jacksonville|memphis|louisville|oklahoma city|albuquerque|tucson|fresno|sacramento|kansas city|virginia beach|omaha|colorado springs|raleigh|long beach|tulsa|cleveland|tampa|new orleans|honolulu|anaheim|santa ana|riverside|corpus christi|lexington|anchorage|stockton|toledo|saint paul|newark|plano|henderson|lincoln|buffalo|jersey city|chula vista|fort wayne|orlando|chandler|laredo|madison|lubbock|winston salem|garland|glendale|hialeah|reno|baton rouge|irvine|chesapeake|irving|scottsdale|north las vegas|fremont|gilbert|san bernardino|boise|birmingham)\b/i,
    
    // State names
    /\b(california|florida|new york|texas|georgia|north carolina|illinois|ohio|pennsylvania|michigan|virginia|washington|arizona|massachusetts|tennessee|indiana|missouri|maryland|wisconsin|colorado|minnesota|south carolina|alabama|louisiana|kentucky|oregon|oklahoma|connecticut|utah|iowa|nevada|arkansas|mississippi|kansas|new mexico|nebraska|west virginia|idaho|hawaii|new hampshire|maine|montana|rhode island|delaware|south dakota|north dakota|alaska|vermont|wyoming)\b/i,
    
    // Countries
    /\b(usa|america|canada|mexico|france|italy|spain|portugal|greece|turkey|japan|thailand|australia|new zealand|brazil|argentina|chile|colombia|peru|ecuador|costa rica|panama|nicaragua|honduras|guatemala|belize|el salvador|venezuela|guyana|suriname|uruguay|paraguay|bolivia|united kingdom|england|scotland|wales|ireland|germany|netherlands|belgium|austria|switzerland|denmark|norway|sweden|finland|poland|czech republic|hungary|slovakia|slovenia|croatia|serbia|bosnia|montenegro|albania|macedonia|bulgaria|romania|moldova|ukraine|belarus|lithuania|latvia|estonia|russia|china|south korea|india|singapore|malaysia|indonesia|philippines|vietnam|cambodia|laos|myanmar|bangladesh|sri lanka|nepal|bhutan|maldives|pakistan|afghanistan|iran|iraq|israel|jordan|lebanon|syria|saudi arabia|uae|oman|yemen|qatar|bahrain|kuwait|egypt|libya|tunisia|algeria|morocco|sudan|ethiopia|kenya|tanzania|uganda|rwanda|burundi|madagascar|mauritius|seychelles|south africa|namibia|botswana|zimbabwe|zambia|malawi|mozambique|swaziland|lesotho)\b/i,
    
    // Beach/mountain/landmark keywords with location
    /(?:beach|mountain|lake|river|park|resort|ski|wine|desert|forest|valley|coast|island)\s+(?:in|at|near)\s+([a-z\s,]+?)(?:\s|$|,|\.|!|\?)/i,
    
    // Simple pattern: anything that looks like a place name (2+ words starting with capital)
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*(?:\s+[A-Z]{2})?)\b/
  ]
  
  // Try each pattern
  for (const pattern of locationPatterns) {
    const match = cleanQuery.match(pattern)
    if (match && match[1]) {
      const location = match[1].trim()
      // Filter out common false positives
      const falsePositives = ['vacation', 'rental', 'property', 'house', 'cabin', 'condo', 'apartment', 'airbnb', 'stay', 'stays', 'find', 'looking', 'search', 'need', 'want', 'book', 'reserve']
      
      if (!falsePositives.includes(location.toLowerCase()) && location.length > 2) {
        return location
      }
    }
  }
  
  // Fallback: look for any capitalized word that might be a place
  const words = query.split(/\s+/)
  for (const word of words) {
    if (/^[A-Z][a-z]{2,}$/.test(word) && !['Airbnb', 'Looking', 'Find', 'Need', 'Want', 'Book', 'Reserve'].includes(word)) {
      return word
    }
  }
  
  return 'your destination'
}

/**
 * Predict search characteristics for optimistic UI
 */
export function predictSearchCharacteristics(query: string): OptimisticSearchPrediction {
  const location = extractLocationQuickly(query)
  const cleanQuery = query.toLowerCase()
  
  // Determine search type
  let searchType: 'location' | 'refinement' | 'travel_question' = 'location'
  
  // Travel question indicators
  const travelQuestionKeywords = ['how', 'what', 'where', 'when', 'why', 'should i', 'recommend', 'suggest', 'tell me about', 'best time', 'weather', 'transportation', 'food', 'culture', 'tips', 'advice']
  if (travelQuestionKeywords.some(keyword => cleanQuery.includes(keyword))) {
    searchType = 'travel_question'
  }
  
  // Refinement indicators
  const refinementKeywords = ['cheaper', 'expensive', 'more beds', 'pool', 'pet friendly', 'closer', 'further', 'bigger', 'smaller', 'different dates']
  if (refinementKeywords.some(keyword => cleanQuery.includes(keyword))) {
    searchType = 'refinement'
  }
  
  // Estimate results based on location popularity and query specificity
  let estimatedResults = 50 // default
  const popularCities = ['san francisco', 'los angeles', 'new york', 'miami', 'chicago', 'seattle', 'austin', 'denver']
  const isPopularCity = popularCities.some(city => cleanQuery.includes(city))
  
  if (isPopularCity) {
    estimatedResults = 100
  }
  
  // Adjust for query specificity
  const specificKeywords = ['luxury', 'budget', 'pet friendly', 'pool', 'hot tub', 'oceanfront', 'downtown']
  const specificityCount = specificKeywords.filter(keyword => cleanQuery.includes(keyword)).length
  estimatedResults = Math.max(10, estimatedResults - (specificityCount * 15))
  
  // Generate optimistic message
  let suggestedMessage = ''
  let loadingSteps: string[] = []
  
  if (searchType === 'travel_question') {
    suggestedMessage = `Let me help you with information about ${location}...`
    loadingSteps = [
      'Gathering travel insights',
      'Analyzing local recommendations',
      'Preparing personalized advice'
    ]
  } else {
    suggestedMessage = `Searching for properties in ${location}...`
    loadingSteps = [
      `Finding available properties in ${location}`,
      'Analyzing property details and amenities',
      'Calculating trust scores and rankings',
      'Preparing your personalized results'
    ]
  }
  
  return {
    location,
    confidence: location === 'your destination' ? 0.3 : 0.8,
    searchType,
    estimatedResults,
    suggestedMessage,
    loadingSteps
  }
}

/**
 * Generate realistic loading steps with timing
 */
export function createOptimisticLoadingSteps(prediction: OptimisticSearchPrediction) {
  const steps = prediction.loadingSteps.map((step, index) => ({
    id: `step-${index}`,
    message: step,
    duration: 800 + (index * 300), // Staggered timing
    completed: false
  }))
  
  return steps
}

/**
 * Smart follow-up predictions based on query analysis
 */
export function predictFollowUps(query: string, prediction: OptimisticSearchPrediction): string[] {
  const followUps: string[] = []
  const cleanQuery = query.toLowerCase()
  
  // Price-related follow-ups
  if (!cleanQuery.includes('$') && !cleanQuery.includes('budget') && !cleanQuery.includes('cheap') && !cleanQuery.includes('luxury')) {
    followUps.push(`What's your budget for ${prediction.location}?`)
  }
  
  // Date-related follow-ups
  const hasDateKeywords = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'weekend', 'week', 'month'].some(keyword => cleanQuery.includes(keyword))
  if (!hasDateKeywords) {
    followUps.push('When are you planning to visit?')
  }
  
  // Group size follow-ups
  if (!cleanQuery.includes('people') && !cleanQuery.includes('guest') && !cleanQuery.includes('adult') && !cleanQuery.includes('couple') && !cleanQuery.includes('family')) {
    followUps.push('How many guests will be staying?')
  }
  
  // Location-specific follow-ups
  if (prediction.location.toLowerCase().includes('beach') || prediction.location.toLowerCase().includes('coast')) {
    followUps.push('Would you like oceanfront properties?')
  } else if (prediction.location.toLowerCase().includes('mountain') || prediction.location.toLowerCase().includes('ski')) {
    followUps.push('Are you looking for ski-in/ski-out access?')
  } else if (prediction.location.toLowerCase().includes('city') || ['san francisco', 'new york', 'chicago', 'seattle'].some(city => prediction.location.toLowerCase().includes(city))) {
    followUps.push('Do you prefer downtown or quieter neighborhoods?')
  }
  
  return followUps.slice(0, 3) // Limit to 3 follow-ups
}

/**
 * Generate optimistic search results preview
 */
export function createOptimisticResultsPreview(prediction: OptimisticSearchPrediction) {
  const isPopularDestination = prediction.estimatedResults > 75
  const isSpecific = prediction.confidence > 0.7
  
  let preview = ''
  
  if (isPopularDestination && isSpecific) {
    preview = `Great news! ${prediction.location} has many excellent properties. I'm finding the best matches for you...`
  } else if (isPopularDestination) {
    preview = `${prediction.location} is a popular destination with lots of options. Let me find the perfect fit...`
  } else if (isSpecific) {
    preview = `Searching for properties in ${prediction.location}. This might take a moment to find the best options...`
  } else {
    preview = `Looking for properties in your area. I'll have results shortly...`
  }
  
  return preview
}