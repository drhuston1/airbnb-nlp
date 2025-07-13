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
  
  // Provider priority order
  private providers = [
    { name: 'mapbox', handler: this.geocodeWithMapbox.bind(this) },
    { name: 'nominatim', handler: this.geocodeWithNominatim.bind(this) },
    { name: 'google', handler: this.geocodeWithGoogle.bind(this) }
  ]

  /**
   * Main geocoding function with multi-provider fallback
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
    
    // Preprocess query for better matching
    const processedQuery = this.preprocessQuery(query)
    
    // Try each provider in order
    for (const provider of this.providers) {
      try {
        console.log(`📍 Trying ${provider.name} for geocoding...`)
        const result = await provider.handler(processedQuery, options)
        
        if (result && result.confidence > 0.5) {
          console.log(`✅ ${provider.name} geocoding successful: ${result.displayName} (confidence: ${result.confidence})`)
          
          // Add alternatives if requested
          if (options.includeAlternatives) {
            result.alternatives = await this.findAlternatives(processedQuery, result, options)
          }
          
          // Cache the result
          this.cache.set(cacheKey, result)
          return result
        }
      } catch (error) {
        console.warn(`⚠️ ${provider.name} geocoding failed:`, error instanceof Error ? error.message : error)
        continue
      }
    }

    console.log(`❌ All geocoding providers failed for: ${query}`)
    return null
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
      types: 'place,locality,neighborhood,address',
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
    
    // Common ambiguous city names
    const ambiguousNames = [
      'paris', 'london', 'berlin', 'cambridge', 'oxford', 'manchester',
      'birmingham', 'bristol', 'glasgow', 'dublin', 'york', 'newcastle',
      'springfield', 'franklin', 'georgetown', 'madison', 'clinton'
    ]
    
    const queryLower = query.toLowerCase()
    const isAmbiguous = ambiguousNames.some(name => queryLower.includes(name))
    
    if (isAmbiguous) {
      // Try with different country contexts
      const countryVariations = ['us', 'ca', 'gb', 'fr', 'de', 'au']
      
      for (const country of countryVariations) {
        if (country === primaryResult.components.countryCode) continue
        
        try {
          const altOptions = { ...options, preferredCountry: country, maxResults: 1 }
          const altResult = await this.geocodeWithNominatim(query, altOptions)
          
          if (altResult && altResult.coordinates.lat !== primaryResult.coordinates.lat) {
            alternatives.push(altResult)
          }
        } catch (error) {
          // Ignore errors for alternatives
        }
      }
    }
    
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
   * Preprocess query to improve matching
   */
  private preprocessQuery(query: string): string {
    // Remove common travel-related words that don't help with geocoding
    const travelWords = /\b(vacation|rental|airbnb|hotel|stay|trip|visit|near|around|close to)\b/gi
    
    // Handle common abbreviations
    const abbreviations: Record<string, string> = {
      'nyc': 'New York City',
      'sf': 'San Francisco',
      'la': 'Los Angeles',
      'dc': 'Washington DC',
      'uk': 'United Kingdom',
      'usa': 'United States',
      'uae': 'United Arab Emirates'
    }
    
    let processed = query.replace(travelWords, '').trim()
    
    // Replace abbreviations
    Object.entries(abbreviations).forEach(([abbr, full]) => {
      const regex = new RegExp(`\\b${abbr}\\b`, 'gi')
      processed = processed.replace(regex, full)
    })
    
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
    
    // Common city name corrections
    const corrections: Record<string, string[]> = {
      'mami': ['miami'],
      'chigago': ['chicago'],
      'pheonix': ['phoenix'],
      'sanfransisco': ['san francisco'],
      'los angeles': ['la', 'los angeles'],
      'new york': ['nyc', 'new york city'],
      'wasington': ['washington'],
      'seatle': ['seattle'],
      'sandiego': ['san diego'],
      'lasvegas': ['las vegas']
    }
    
    const queryLower = query.toLowerCase()
    
    // Check for direct corrections
    Object.entries(corrections).forEach(([typo, corrections]) => {
      if (queryLower.includes(typo)) {
        corrections.forEach(correction => {
          variations.push(query.replace(new RegExp(typo, 'gi'), correction))
        })
      }
    })
    
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