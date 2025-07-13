// Comprehensive geocoding service with multiple providers and disambiguation

interface GeocodeResult {
  location: string
  confidence: number
  coordinates: {
    lat: number
    lng: number
  }
  components: {
    city?: string
    state?: string
    country?: string
    countryCode?: string
    postalCode?: string
    neighborhood?: string
  }
  displayName: string
  type: 'city' | 'neighborhood' | 'landmark' | 'region' | 'country'
  providers: string[]
  alternatives?: GeocodeResult[]
}

interface GeocodeOptions {
  preferredCountry?: string
  maxResults?: number
  includeAlternatives?: boolean
  fuzzyMatching?: boolean
  biasLocation?: { lat: number; lng: number }
}

export class GeocodingService {
  private cache = new Map<string, GeocodeResult>()
  private cacheExpiry = 24 * 60 * 60 * 1000 // 24 hours
  
  // Provider configuration with different strategies
  private providers = [
    { 
      name: 'mapbox', 
      handler: this.geocodeWithMapbox.bind(this),
      config: { excludeAddresses: true, goodFor: ['cities', 'countries'] }
    },
    { 
      name: 'nominatim', 
      handler: this.geocodeWithNominatim.bind(this),
      config: { goodFor: ['geographic_features', 'disambiguation'] }
    },
    { 
      name: 'google', 
      handler: this.geocodeWithGoogle.bind(this),
      config: { goodFor: ['accuracy', 'local_places'] }
    }
  ]

  /**
   * Main geocoding function with intelligent provider selection
   */
  async geocode(
    query: string, 
    options: GeocodeOptions = {}
  ): Promise<GeocodeResult | null> {
    const cacheKey = this.getCacheKey(query, options)
    const cached = this.cache.get(cacheKey)
    
    if (cached) {
      console.log(`🗺️ Using cached geocoding result for: ${query}`)
      return cached
    }

    console.log(`🔍 Geocoding location: "${query}"`)
    
    // Check for proximity queries first (e.g., "near Disney World")
    const extractedLandmark = this.extractLandmarkFromProximityQuery(query)
    const searchQuery = extractedLandmark || query
    
    console.log(extractedLandmark ? `🎯 Extracted landmark: "${extractedLandmark}"` : `📍 Direct location search`)
    
    // Preprocess query for better matching
    const processedQuery = this.preprocessQuery(searchQuery)
    
    // Try intelligent provider selection
    const results = await this.tryMultipleProviders(processedQuery, options)
    
    if (results.length === 0) {
      console.log(`❌ All geocoding providers failed for: ${query}`)
      return null
    }
    
    // Select best result and merge alternatives
    const bestResult = this.selectBestResult(results, query)
    
    // Add alternatives from all providers if requested
    if (options.includeAlternatives) {
      bestResult.alternatives = this.mergeAlternatives(results, bestResult)
    }
    
    console.log(`✅ Selected best result: ${bestResult.displayName} (confidence: ${bestResult.confidence}, provider: ${bestResult.providers.join(',')})`)
    
    // Cache the result
    this.cache.set(cacheKey, bestResult)
    return bestResult
  }

  /**
   * Try multiple providers with optimal strategy
   */
  private async tryMultipleProviders(
    query: string, 
    options: GeocodeOptions
  ): Promise<GeocodeResult[]> {
    const results: GeocodeResult[] = []
    
    // STRATEGY: Google first for accuracy, then get alternatives from other providers
    
    // Step 1: Try Google first (best accuracy)
    try {
      console.log(`🌐 Trying Google for primary result...`)
      const googleResult = await this.geocodeWithGoogle(query, options)
      if (googleResult && googleResult.confidence > 0.5) {
        console.log(`✅ Google successful: ${googleResult.displayName}`)
        results.push(googleResult)
      }
    } catch (error) {
      console.warn(`⚠️ Google failed:`, error instanceof Error ? error.message : error)
    }
    
    // Step 2: Always try other providers for alternatives (disambiguation)
    const alternativeProviders = [
      { name: 'nominatim', handler: this.geocodeWithNominatim.bind(this) },
      { name: 'mapbox', handler: this.geocodeWithMapbox.bind(this) }
    ]
    
    for (const provider of alternativeProviders) {
      try {
        console.log(`📍 Trying ${provider.name} for alternatives...`)
        const result = await provider.handler(query, { ...options, maxResults: 3 })
        if (result && result.confidence > 0.4) { // Lower threshold for alternatives
          console.log(`✅ ${provider.name} alternative: ${result.displayName}`)
          
          // Only add if it's meaningfully different from existing results
          const isDifferent = results.every(existing => 
            Math.abs(existing.coordinates.lat - result.coordinates.lat) > 0.1 ||
            Math.abs(existing.coordinates.lng - result.coordinates.lng) > 0.1 ||
            existing.components.country !== result.components.country
          )
          
          if (isDifferent) {
            results.push(result)
          } else {
            console.log(`   📍 ${provider.name} result too similar to existing, skipping`)
          }
        }
      } catch (error) {
        console.warn(`⚠️ ${provider.name} failed:`, error instanceof Error ? error.message : error)
      }
    }
    
    // Step 3: If Google failed completely, use best alternative as primary
    if (results.length === 0) {
      console.log(`🔄 Google failed, trying fallback strategy...`)
      
      // Try in order of preference for fallback
      const fallbackOrder = [
        { name: 'nominatim', handler: this.geocodeWithNominatim.bind(this) },
        { name: 'mapbox', handler: this.geocodeWithMapbox.bind(this) }
      ]
      
      for (const provider of fallbackOrder) {
        try {
          console.log(`📍 Fallback to ${provider.name}...`)
          const result = await provider.handler(query, options)
          if (result && result.confidence > 0.5) {
            console.log(`✅ ${provider.name} fallback successful: ${result.displayName}`)
            results.push(result)
            break // Use first successful fallback as primary
          }
        } catch (error) {
          console.warn(`⚠️ ${provider.name} fallback failed:`, error instanceof Error ? error.message : error)
        }
      }
    }
    
    console.log(`📊 Final results: ${results.length} from providers: ${results.map(r => r.providers.join(',')).join(', ')}`)
    return results
  }

  /**
   * Select the best result from multiple providers
   */
  private selectBestResult(results: GeocodeResult[], originalQuery: string): GeocodeResult {
    if (results.length === 1) return results[0]
    
    // Score each result based on relevance to travel queries
    const scoredResults = results.map(result => ({
      result,
      score: this.calculateTravelRelevanceScore(result, originalQuery)
    }))
    
    // Sort by score descending
    scoredResults.sort((a, b) => b.score - a.score)
    
    return scoredResults[0].result
  }

  /**
   * Calculate travel relevance score for result selection
   */
  private calculateTravelRelevanceScore(result: GeocodeResult, originalQuery: string): number {
    let score = result.confidence * 100 // Base score from confidence
    
    // Major bonus for Google results (our primary provider)
    if (result.providers.includes('google')) {
      score += 50
    }
    
    // Bonus for geographic features (like Cape Cod)  
    if (result.type === 'region' || result.type === 'landmark') {
      score += 20
    }
    
    // Bonus for major travel destinations
    const isMajorDestination = ['France', 'United Kingdom', 'Germany', 'United States'].includes(result.components.country || '')
    if (isMajorDestination && result.type === 'city') {
      score += 15
    }
    
    // Bonus for exact name matches
    const queryLower = originalQuery.toLowerCase()
    const locationLower = result.location.toLowerCase()
    if (locationLower === queryLower) {
      score += 10
    }
    
    // Penalty for very specific addresses when looking for general locations
    if (result.type === 'address' && !originalQuery.includes('street') && !originalQuery.includes('address')) {
      score -= 30
    }
    
    return score
  }

  /**
   * Merge alternatives from multiple providers
   */
  private mergeAlternatives(results: GeocodeResult[], bestResult: GeocodeResult): GeocodeResult[] {
    const alternatives: GeocodeResult[] = []
    
    // Add other primary results as alternatives
    results.forEach(result => {
      if (result !== bestResult) {
        alternatives.push(result)
      }
      // Add their alternatives too
      if (result.alternatives) {
        alternatives.push(...result.alternatives)
      }
    })
    
    // Remove duplicates and sort by confidence
    const uniqueAlternatives = alternatives.filter((alt, index, arr) => 
      index === arr.findIndex(other => 
        Math.abs(other.coordinates.lat - alt.coordinates.lat) < 0.1 &&
        Math.abs(other.coordinates.lng - alt.coordinates.lng) < 0.1
      )
    ).sort((a, b) => b.confidence - a.confidence)
    
    return uniqueAlternatives.slice(0, 5) // Limit to top 5 alternatives
  }

  /**
   * Mapbox Geocoding API (Primary - most accurate for travel locations)
   */
  private async geocodeWithMapbox(
    query: string, 
    options: GeocodeOptions
  ): Promise<GeocodeResult | null> {
    const apiKey = process.env.MAPBOX_ACCESS_TOKEN
    if (!apiKey) {
      console.log('⚠️ MAPBOX_ACCESS_TOKEN not found in environment variables')
      console.log('Available env vars:', Object.keys(process.env).filter(key => key.toLowerCase().includes('map')))
      throw new Error('Mapbox API key not configured')
    }
    
    console.log('✅ Using Mapbox for geocoding with configured API key')

    const params = new URLSearchParams({
      q: query,
      access_token: apiKey,
      types: 'place,locality,region,district', // Exclude 'address' to avoid street name pollution
      limit: (options.maxResults || 5).toString(),
      ...(options.preferredCountry && { country: options.preferredCountry }),
      ...(options.biasLocation && { 
        proximity: `${options.biasLocation.lng},${options.biasLocation.lat}` 
      })
    })

    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`,
      {
        headers: {
          'User-Agent': 'ChatBnb-Geocoding/1.0'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Mapbox API error: ${response.status}`)
    }

    const data = await response.json()
    
    if (!data.features || data.features.length === 0) {
      return null
    }

    return this.transformMapboxResult(data.features[0], query)
  }

  /**
   * OpenStreetMap Nominatim (Fallback - free and reliable)
   */
  private async geocodeWithNominatim(
    query: string, 
    options: GeocodeOptions
  ): Promise<GeocodeResult | null> {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      addressdetails: '1',
      limit: '10', // Get more results to find best US match
      extratags: '1',
      namedetails: '1',
      ...(options.preferredCountry && { countrycodes: options.preferredCountry })
    })

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: {
          'User-Agent': 'ChatBnb-Geocoding/1.0 (https://chatbnb.vercel.app)',
          'Accept': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`)
    }

    const data = await response.json()
    
    if (!data || data.length === 0) {
      return null
    }

    // Select the best result based on importance and relevance, not just order
    let bestResult = data[0]
    
    // If we have multiple results, prefer the one with highest importance score
    if (data.length > 1) {
      bestResult = data.reduce((best: any, current: any) => {
        const bestImportance = parseFloat(best.importance || '0')
        const currentImportance = parseFloat(current.importance || '0')
        
        // Also consider if it's a more specific location type
        const bestIsCity = ['city', 'town', 'village'].includes(best.type)
        const currentIsCity = ['city', 'town', 'village'].includes(current.type)
        
        if (currentIsCity && !bestIsCity) return current
        if (bestIsCity && !currentIsCity) return best
        
        return currentImportance > bestImportance ? current : best
      })
    }
    
    if (options.preferredCountry) {
      const countryCode = options.preferredCountry.toLowerCase()
      const preferredCountryResult = data.find((result: any) => 
        result.address?.country_code?.toLowerCase() === countryCode
      )
      
      if (preferredCountryResult) {
        bestResult = preferredCountryResult
        console.log(`🌍 Found preferred country match: ${bestResult.display_name}`)
      }
    }

    return this.transformNominatimResult(bestResult, query)
  }

  /**
   * Google Geocoding API (Premium option - requires API key)
   */
  private async geocodeWithGoogle(
    query: string, 
    options: GeocodeOptions
  ): Promise<GeocodeResult | null> {
    const apiKey = process.env.GOOGLE_GEOCODING_API_KEY
    if (!apiKey) {
      throw new Error('Google Geocoding API key not configured')
    }

    const params = new URLSearchParams({
      address: query,
      key: apiKey,
      ...(options.preferredCountry && { region: options.preferredCountry }),
      ...(options.biasLocation && { 
        bounds: `${options.biasLocation.lat-0.1},${options.biasLocation.lng-0.1}|${options.biasLocation.lat+0.1},${options.biasLocation.lng+0.1}` 
      })
    })

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params}`
    )

    if (!response.ok) {
      throw new Error(`Google Geocoding API error: ${response.status}`)
    }

    const data = await response.json()
    
    if (!data.results || data.results.length === 0) {
      return null
    }

    return this.transformGoogleResult(data.results[0], query)
  }

  /**
   * Find alternative interpretations of ambiguous locations
   */
  private async findAlternatives(
    query: string, 
    primaryResult: GeocodeResult, 
    options: GeocodeOptions
  ): Promise<GeocodeResult[]> {
    const alternatives: GeocodeResult[] = []
    
    // Remove hardcoded ambiguous names detection
    
    return alternatives.slice(0, 3) // Limit to 3 alternatives
  }

  /**
   * Transform Mapbox result to our standard format
   */
  private transformMapboxResult(feature: any, originalQuery: string): GeocodeResult {
    const [lng, lat] = feature.center
    const context = feature.context || []
    
    // Extract components from Mapbox context
    const components: GeocodeResult['components'] = {}
    
    context.forEach((item: any) => {
      const [category] = item.id.split('.')
      switch (category) {
        case 'place':
          components.city = item.text
          break
        case 'region':
          components.state = item.text
          break
        case 'country':
          components.country = item.text
          components.countryCode = item.short_code?.toUpperCase()
          break
        case 'neighborhood':
          components.neighborhood = item.text
          break
        case 'postcode':
          components.postalCode = item.text
          break
      }
    })

    // Determine location type
    const placeType = feature.place_type?.[0] || 'place'
    let type: GeocodeResult['type'] = 'city'
    
    switch (placeType) {
      case 'neighborhood':
        type = 'neighborhood'
        break
      case 'poi':
        type = 'landmark'
        break
      case 'region':
        type = 'region'
        break
      case 'country':
        type = 'country'
        break
      default:
        type = 'city'
    }

    // Calculate confidence based on relevance and match quality
    const confidence = this.calculateConfidence(
      originalQuery, 
      feature.place_name, 
      feature.relevance || 1
    )

    return {
      location: feature.text,
      confidence,
      coordinates: { lat, lng },
      components,
      displayName: feature.place_name,
      type,
      providers: ['mapbox']
    }
  }

  /**
   * Transform Nominatim result to our standard format
   */
  private transformNominatimResult(result: any, originalQuery: string): GeocodeResult {
    const lat = parseFloat(result.lat)
    const lng = parseFloat(result.lon)
    
    const components: GeocodeResult['components'] = {
      city: result.address?.city || result.address?.town || result.address?.village,
      state: result.address?.state,
      country: result.address?.country,
      countryCode: result.address?.country_code?.toUpperCase(),
      postalCode: result.address?.postcode,
      neighborhood: result.address?.neighbourhood || result.address?.suburb
    }

    // Determine type from OSM class
    let type: GeocodeResult['type'] = 'city'
    
    switch (result.class) {
      case 'place':
        if (['neighbourhood', 'suburb'].includes(result.type)) {
          type = 'neighborhood'
        } else if (['city', 'town', 'village'].includes(result.type)) {
          type = 'city'
        } else if (result.type === 'state') {
          type = 'region'
        }
        break
      case 'tourism':
      case 'historic':
        type = 'landmark'
        break
      case 'boundary':
        type = result.type === 'administrative' ? 'region' : 'city'
        break
    }

    const confidence = this.calculateConfidence(
      originalQuery, 
      result.display_name, 
      parseFloat(result.importance || '0.5')
    )

    return {
      location: result.name || result.display_name.split(',')[0],
      confidence,
      coordinates: { lat, lng },
      components,
      displayName: result.display_name,
      type,
      providers: ['nominatim']
    }
  }

  /**
   * Transform Google result to our standard format
   */
  private transformGoogleResult(result: any, originalQuery: string): GeocodeResult {
    const location = result.geometry.location
    const components: GeocodeResult['components'] = {}
    
    // Extract components from Google's address_components
    result.address_components?.forEach((component: any) => {
      const types = component.types
      
      if (types.includes('locality')) {
        components.city = component.long_name
      } else if (types.includes('administrative_area_level_1')) {
        components.state = component.long_name
      } else if (types.includes('country')) {
        components.country = component.long_name
        components.countryCode = component.short_name
      } else if (types.includes('neighborhood')) {
        components.neighborhood = component.long_name
      } else if (types.includes('postal_code')) {
        components.postalCode = component.long_name
      }
    })

    // Determine type from Google's types
    let type: GeocodeResult['type'] = 'city'
    
    if (result.types.includes('neighborhood')) {
      type = 'neighborhood'
    } else if (result.types.includes('point_of_interest')) {
      type = 'landmark'
    } else if (result.types.includes('administrative_area_level_1')) {
      type = 'region'
    } else if (result.types.includes('country')) {
      type = 'country'
    }

    const confidence = this.calculateConfidence(
      originalQuery, 
      result.formatted_address, 
      0.9 // Google generally has high quality
    )

    return {
      location: components.city || result.formatted_address.split(',')[0],
      confidence,
      coordinates: { lat: location.lat, lng: location.lng },
      components,
      displayName: result.formatted_address,
      type,
      providers: ['google']
    }
  }

  /**
   * Calculate confidence score based on query match and provider relevance
   */
  private calculateConfidence(
    originalQuery: string, 
    resultName: string, 
    providerRelevance: number
  ): number {
    const queryLower = originalQuery.toLowerCase().trim()
    const resultLower = resultName.toLowerCase()
    
    // Exact match gets highest score
    if (resultLower.includes(queryLower)) {
      return Math.min(0.95, providerRelevance * 0.95)
    }
    
    // Check for partial matches
    const queryWords = queryLower.split(/\s+/)
    const resultWords = resultLower.split(/\s+/)
    
    const matchingWords = queryWords.filter(qWord => 
      resultWords.some(rWord => rWord.includes(qWord) || qWord.includes(rWord))
    )
    
    const wordMatchRatio = matchingWords.length / queryWords.length
    const baseConfidence = wordMatchRatio * providerRelevance
    
    // Boost confidence for exact city name matches
    if (queryWords.length === 1 && resultWords.some(word => word === queryWords[0])) {
      return Math.min(0.9, baseConfidence + 0.2)
    }
    
    return Math.min(0.85, baseConfidence)
  }

  /**
   * Check if query is for a geographic feature
   */
  private isGeographicFeature(query: string): boolean {
    const queryLower = query.toLowerCase()
    const geographicTerms = [
      'cape', 'peninsula', 'island', 'bay', 'beach', 'coast', 'shore',
      'mountain', 'valley', 'canyon', 'national park', 'state park',
      'lake', 'river', 'falls', 'forest', 'desert', 'plateau'
    ]
    
    return geographicTerms.some(term => queryLower.includes(term))
  }

  /**
   * Check if query is for a landmark or point of interest
   */
  private isLandmarkQuery(query: string): boolean {
    const queryLower = query.toLowerCase()
    const landmarkTerms = [
      'disney', 'disneyland', 'universal studios', 'theme park',
      'statue of liberty', 'golden gate bridge', 'times square',
      'central park', 'empire state', 'hollywood', 'broadway',
      'smithsonian', 'museum', 'cathedral', 'tower', 'monument',
      'observatory', 'zoo', 'aquarium', 'casino', 'stadium',
      'airport', 'pier', 'boardwalk', 'downtown', 'french quarter'
    ]
    
    return landmarkTerms.some(term => queryLower.includes(term))
  }

  /**
   * Extract landmark from proximity queries like "near Disney World"
   */
  private extractLandmarkFromProximityQuery(query: string): string | null {
    const patterns = [
      /near\s+(.+)/i,
      /close\s+to\s+(.+)/i,
      /around\s+(.+)/i,
      /by\s+(.+)/i,
      /vacation\s+home\s+near\s+(.+)/i,
      /house\s+close\s+to\s+(.+)/i,
      /rental\s+near\s+(.+)/i,
      /stay\s+near\s+(.+)/i
    ]
    
    for (const pattern of patterns) {
      const match = query.match(pattern)
      if (match) {
        return match[1].trim()
      }
    }
    
    return null
  }

  /**
   * Preprocess query to improve matching
   */
  private preprocessQuery(query: string): string {
    // Remove common travel-related words that don't help with geocoding
    const travelWords = /\b(vacation|rental|airbnb|hotel|stay|trip|visit|near|around|close to)\b/gi
    
    // Remove travel-related words but keep abbreviations as-is
    let processed = query.replace(travelWords, '').trim()
    
    return processed
  }

  /**
   * Create cache key for geocoding results
   */
  private getCacheKey(query: string, options: GeocodeOptions): string {
    const optionsStr = JSON.stringify(options)
    const combined = query + optionsStr
    // Simple hash function for caching (not cryptographically secure)
    let hash = 0
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * Fuzzy matching for typos and variations
   */
  async fuzzyGeocode(
    query: string, 
    options: GeocodeOptions = {}
  ): Promise<GeocodeResult[]> {
    const results: GeocodeResult[] = []
    
    // Try original query first
    const directResult = await this.geocode(query, options)
    if (directResult) {
      results.push(directResult)
    }
    
    // Generate common typo variations if direct match has low confidence
    if (!directResult || directResult.confidence < 0.7) {
      const variations = this.generateTypoVariations(query)
      
      for (const variation of variations) {
        try {
          const result = await this.geocode(variation, { ...options, maxResults: 1 })
          if (result && result.confidence > 0.6) {
            result.location = `${result.location} (did you mean "${variation}"?)`
            results.push(result)
          }
        } catch (error) {
          // Ignore errors for fuzzy matching
        }
      }
    }
    
    return results.slice(0, 5) // Limit to 5 suggestions
  }

  /**
   * Generate common typo variations
   */
  private generateTypoVariations(query: string): string[] {
    const variations: string[] = []
    
    // Add variations with different spacing
    if (query.includes(' ')) {
      variations.push(query.replace(/\s+/g, '')) // Remove spaces
    } else if (query.length > 6) {
      // Add space before last 3-5 characters for compound city names
      for (let i = 3; i <= 5; i++) {
        if (query.length > i) {
          const spaced = query.slice(0, -i) + ' ' + query.slice(-i)
          variations.push(spaced)
        }
      }
    }
    
    return [...new Set(variations)].slice(0, 3) // Remove duplicates, limit to 3
  }
}

// Export singleton instance
export const geocodingService = new GeocodingService()

// Export types
export type { GeocodeResult, GeocodeOptions }