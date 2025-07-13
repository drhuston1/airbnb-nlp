// Location validation and disambiguation API endpoint
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { geocodingService, type GeocodeResult, type GeocodeOptions } from './services/geocoding'

interface LocationValidationRequest {
  location: string
  fuzzyMatch?: boolean
  includeAlternatives?: boolean
  preferredCountry?: string
  context?: 'travel' | 'business' | 'vacation'
}

interface LocationValidationResponse {
  valid: boolean
  confidence: number
  validated?: GeocodeResult
  alternatives?: GeocodeResult[]
  suggestions?: string[]
  error?: string
  disambiguation?: {
    required: boolean
    options: GeocodeResult[]
    message: string
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { 
      location, 
      fuzzyMatch = true, 
      includeAlternatives = true,
      preferredCountry,
      context = 'travel'
    }: LocationValidationRequest = req.body

    if (!location || typeof location !== 'string') {
      return res.status(400).json({ 
        valid: false,
        error: 'Location parameter is required and must be a string'
      })
    }

    console.log(`🗺️ Validating location: "${location}" (context: ${context})`)

    // Configure geocoding options based on context
    const geocodeOptions: GeocodeOptions = {
      includeAlternatives,
      maxResults: 5,
      fuzzyMatching: fuzzyMatch,
      ...(preferredCountry && { preferredCountry }),
      ...(context === 'travel' && { 
        // Bias towards tourist destinations for travel context
        biasLocation: await getBiasLocationForTravel(location)
      })
    }

    let result: GeocodeResult | null = null
    let fuzzyResults: GeocodeResult[] = []

    // Try exact geocoding first
    result = await geocodingService.geocode(location, geocodeOptions)

    // If exact fails or has low confidence, try fuzzy matching
    if ((!result || result.confidence < 0.7) && fuzzyMatch) {
      console.log(`🔍 Trying fuzzy matching for: ${location}`)
      fuzzyResults = await geocodingService.fuzzyGeocode(location, geocodeOptions)
      
      if (fuzzyResults.length > 0 && fuzzyResults[0].confidence > (result?.confidence || 0)) {
        result = fuzzyResults[0]
      }
    }

    // Build response
    const response: LocationValidationResponse = {
      valid: result !== null && result.confidence >= 0.5,
      confidence: result?.confidence || 0
    }

    if (result) {
      response.validated = result
      
      // Add alternatives if requested and available
      if (includeAlternatives && result.alternatives?.length) {
        response.alternatives = result.alternatives
      }
      
      // Check if disambiguation is needed (multiple high-confidence results)
      const disambiguationNeeded = await checkDisambiguationNeeded(location, result)
      if (disambiguationNeeded) {
        response.disambiguation = disambiguationNeeded
      }
      
      // Add suggestions for low confidence results
      if (result.confidence < 0.8) {
        response.suggestions = generateLocationSuggestions(location, result, fuzzyResults)
      }
    } else {
      // No result found - provide helpful suggestions
      response.suggestions = await generateFailureSuggestions(location, context)
    }

    console.log(`✅ Location validation complete: ${result?.displayName || 'No match'} (confidence: ${result?.confidence || 0})`)
    
    return res.status(200).json(response)

  } catch (error) {
    console.error('Location validation error:', error)
    return res.status(500).json({ 
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown validation error',
      confidence: 0
    })
  }
}

/**
 * Get bias location for travel context to prefer tourist destinations
 */
async function getBiasLocationForTravel(location: string): Promise<{ lat: number; lng: number } | undefined> {
  // Major tourist destination coordinates for biasing
  const touristDestinations: Record<string, { lat: number; lng: number }> = {
    'paris': { lat: 48.8566, lng: 2.3522 }, // France, not Texas
    'london': { lat: 51.5074, lng: -0.1278 }, // UK, not Ontario
    'berlin': { lat: 52.5200, lng: 13.4050 }, // Germany, not New Hampshire
    'cambridge': { lat: 52.2053, lng: 0.1218 }, // UK, not Massachusetts (for travel)
    'dublin': { lat: 53.3498, lng: -6.2603 }, // Ireland, not California
    'york': { lat: 53.9600, lng: -1.0873 }, // UK, not Pennsylvania
    'manchester': { lat: 53.4808, lng: -2.2426 }, // UK, not New Hampshire
    'birmingham': { lat: 52.4862, lng: -1.8904 } // UK, not Alabama (for travel)
  }
  
  const locationLower = location.toLowerCase()
  
  for (const [city, coords] of Object.entries(touristDestinations)) {
    if (locationLower.includes(city)) {
      return coords
    }
  }
  
  return undefined
}

/**
 * Check if disambiguation is needed for ambiguous locations
 */
async function checkDisambiguationNeeded(
  originalLocation: string, 
  primaryResult: GeocodeResult
): Promise<LocationValidationResponse['disambiguation'] | undefined> {
  
  // Known ambiguous city names that require disambiguation
  const ambiguousCities = [
    'paris', 'london', 'berlin', 'cambridge', 'oxford', 'manchester',
    'birmingham', 'bristol', 'glasgow', 'dublin', 'york', 'newcastle',
    'springfield', 'franklin', 'georgetown', 'madison', 'clinton',
    'athens', 'rome', 'florence', 'milan', 'geneva', 'basel'
  ]
  
  const locationLower = originalLocation.toLowerCase().trim()
  const isAmbiguous = ambiguousCities.some(city => locationLower === city || locationLower.includes(city))
  
  if (!isAmbiguous) {
    return undefined
  }
  
  // Get alternatives for the same city name in different countries
  try {
    const alternatives: GeocodeResult[] = []
    const countries = ['us', 'ca', 'gb', 'fr', 'de', 'it', 'es', 'au']
    
    for (const country of countries) {
      if (country === primaryResult.components.countryCode?.toLowerCase()) continue
      
      try {
        const altResult = await geocodingService.geocode(originalLocation, {
          preferredCountry: country,
          maxResults: 1
        })
        
        if (altResult && altResult.confidence > 0.6) {
          alternatives.push(altResult)
        }
      } catch (error) {
        // Ignore errors for alternatives
      }
    }
    
    if (alternatives.length > 0) {
      return {
        required: true,
        options: [primaryResult, ...alternatives.slice(0, 3)],
        message: `Multiple locations found for "${originalLocation}". Please select the intended destination:`
      }
    }
  } catch (error) {
    console.warn('Error checking disambiguation:', error)
  }
  
  return undefined
}

/**
 * Generate helpful suggestions for improving location queries
 */
function generateLocationSuggestions(
  originalLocation: string, 
  result: GeocodeResult, 
  fuzzyResults: GeocodeResult[]
): string[] {
  const suggestions: string[] = []
  
  // Suggest adding country/state for disambiguation
  if (result.confidence < 0.8 && result.components.country) {
    if (result.components.state) {
      suggestions.push(`Try: "${originalLocation}, ${result.components.state}"`)
    }
    suggestions.push(`Try: "${originalLocation}, ${result.components.country}"`)
  }
  
  // Suggest fuzzy match alternatives
  fuzzyResults.slice(0, 2).forEach(fuzzyResult => {
    if (fuzzyResult.displayName !== result.displayName) {
      suggestions.push(`Did you mean: "${fuzzyResult.displayName}"?`)
    }
  })
  
  // Suggest popular nearby destinations if type is city
  if (result.type === 'city' && result.confidence < 0.7) {
    suggestions.push(`Try a more specific location like "${originalLocation} city center" or "${originalLocation} downtown"`)
  }
  
  return suggestions.slice(0, 3) // Limit to 3 suggestions
}

/**
 * Generate suggestions when geocoding completely fails
 */
async function generateFailureSuggestions(
  originalLocation: string, 
  context: string
): Promise<string[]> {
  const suggestions: string[] = []
  
  // Check for common typos and suggest corrections
  const commonCorrections: Record<string, string> = {
    'mami': 'Miami',
    'chigago': 'Chicago',
    'pheonix': 'Phoenix',
    'sanfransisco': 'San Francisco',
    'wasington': 'Washington',
    'seatle': 'Seattle',
    'sandiego': 'San Diego',
    'lasvegas': 'Las Vegas',
    'newyork': 'New York',
    'losangeles': 'Los Angeles'
  }
  
  const locationLower = originalLocation.toLowerCase().replace(/\s+/g, '')
  
  Object.entries(commonCorrections).forEach(([typo, correction]) => {
    if (locationLower.includes(typo)) {
      suggestions.push(`Did you mean "${correction}"?`)
    }
  })
  
  // Context-specific suggestions
  if (context === 'travel') {
    suggestions.push('Try popular destinations like "Miami", "New York", "Los Angeles", or "San Francisco"')
    suggestions.push('Include country name for international destinations like "Paris, France" or "London, UK"')
  }
  
  // General formatting suggestions
  suggestions.push('Check spelling and try including state/country (e.g., "Austin, Texas")')
  suggestions.push('Use full city names instead of abbreviations')
  
  return suggestions.slice(0, 3)
}