// Simple, reliable location extraction without complex NLP

export function extractLocationFromQuery(query: string): string {
  const normalizedQuery = query.trim()
  
  // Simple patterns that just work
  const locationPatterns = [
    // "near X", "in X", "at X"  
    /(?:near|in|at|around)\s+([A-Za-z\s,]+?)(?:\s+for|\s+with|\s+under|\s*$)/i,
    // "X properties", "X rentals"
    /^([A-Za-z\s,]+?)\s+(?:properties|rentals|cabins|houses)/i,
    // Just city names at start
    /^([A-Za-z\s,]+?)(?:\s+beach|\s+downtown|\s+area|\s*$)/i
  ]
  
  for (const pattern of locationPatterns) {
    const match = normalizedQuery.match(pattern)
    if (match && match[1]) {
      let location = match[1].trim()
      
      // Remove obvious non-location words
      location = location.replace(/\b(looking|for|property|properties|cabin|house|home|rental|beach|front)\b/gi, '').trim()
      
      // Map common ambiguous names to US locations
      const usMap: Record<string, string> = {
        'charleston': 'Charleston, SC',
        'montreal': 'Burlington, VT',
        'paris': 'Paris, TX',
        'london': 'London, KY'
      }
      
      const lowerLocation = location.toLowerCase()
      if (usMap[lowerLocation]) {
        console.log(`Simple location mapping: "${location}" → "${usMap[lowerLocation]}"`)
        return usMap[lowerLocation]
      }
      
      // Return if it looks valid
      if (location.length >= 2 && !/^\d+$/.test(location)) {
        console.log(`Simple location extraction: "${location}"`)
        return location
      }
    }
  }
  
  console.log('No location found in query:', query)
  return 'Unknown'
}

export function generateSimpleFollowUps(results: any[], _query: string): string[] {
  if (results.length === 0) {
    return ['Try a different location', 'Expand your search', 'Search nearby areas']
  }
  
  const suggestions = [
    'Show budget options',
    'Show luxury properties', 
    'Sort by highest rated',
    'Show entire homes only'
  ]
  
  return suggestions.slice(0, 3)
}