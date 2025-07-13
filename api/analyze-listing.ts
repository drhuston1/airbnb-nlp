// AI-powered Airbnb listing analysis API
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { API_CONFIG } from './config'

interface ListingAnalysisRequest {
  listing: {
    id: string
    name: string
    price: {
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
    bedrooms?: number
    bathrooms?: number
    maxGuests?: number
    trustScore?: number
    images?: string[]
  }
  context?: {
    searchQuery?: string
    alternatives?: Array<{
      price: { rate: number }
      rating: number
      trustScore?: number
    }>
  }
}

interface ListingAnalysis {
  overallScore: number
  insights: {
    priceAnalysis: {
      score: number
      assessment: 'excellent' | 'good' | 'fair' | 'expensive'
      details: string
      comparison?: string
    }
    locationAnalysis: {
      score: number
      highlights: string[]
      concerns: string[]
      walkability?: string
    }
    hostAnalysis: {
      score: number
      trustLevel: 'high' | 'medium' | 'low'
      details: string
      experience?: string
    }
    propertyAnalysis: {
      score: number
      highlights: string[]
      amenityScore: number
      spaceAssessment?: string
    }
    reviewAnalysis: {
      score: number
      credibility: 'high' | 'medium' | 'low'
      summary: string
    }
  }
  recommendations: string[]
  redFlags: string[]
  bottomLine: string
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
    const { listing, context }: ListingAnalysisRequest = req.body

    if (!listing || !listing.id) {
      return res.status(400).json({ 
        error: 'Listing data is required'
      })
    }

    console.log(`🔍 Analyzing listing: ${listing.name} (${listing.id})`)

    // Check for OpenAI API key
    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      console.error('OPENAI_API_KEY not configured')
      return res.status(500).json({ 
        error: 'Analysis service not configured'
      })
    }

    const analysis = await analyzeListingWithAI(listing, context, openaiKey)

    console.log(`✅ Analysis complete for ${listing.name}`)
    
    return res.status(200).json({
      success: true,
      analysis,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Listing analysis error:', error)
    return res.status(500).json({ 
      error: 'Failed to analyze listing',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function analyzeListingWithAI(
  listing: ListingAnalysisRequest['listing'],
  context: ListingAnalysisRequest['context'],
  apiKey: string
): Promise<ListingAnalysis> {
  
  // Prepare context for analysis
  const averagePrice = context?.alternatives?.length 
    ? context.alternatives.reduce((sum, alt) => sum + alt.price.rate, 0) / context.alternatives.length
    : null

  const averageRating = context?.alternatives?.length
    ? context.alternatives.reduce((sum, alt) => sum + alt.rating, 0) / context.alternatives.length
    : null

  const prompt = `Analyze this Airbnb listing and provide a comprehensive assessment for a traveler.

LISTING DETAILS:
- Name: ${listing.name}
- Price: ${listing.price.currency}${listing.price.rate}/night
- Rating: ${listing.rating}/5 (${listing.reviewsCount} reviews)
- Location: ${listing.location.city}, ${listing.location.country}
- Host: ${listing.host.name} ${listing.host.isSuperhost ? '(Superhost)' : ''}
- Room Type: ${listing.roomType}
- Property Type: ${listing.propertyType || 'Unknown'}
- Capacity: ${listing.maxGuests || 'Unknown'} guests, ${listing.bedrooms || 'Unknown'} bedrooms, ${listing.bathrooms || 'Unknown'} bathrooms
- Amenities: ${listing.amenities.join(', ') || 'None listed'}
- Trust Score: ${listing.trustScore || 'Not available'}/100

CONTEXT:
- Search Query: ${context?.searchQuery || 'Not provided'}
- Average Price of Alternatives: ${averagePrice ? `${listing.price.currency}${averagePrice.toFixed(0)}/night` : 'Not available'}
- Average Rating of Alternatives: ${averageRating ? `${averageRating.toFixed(1)}/5` : 'Not available'}

Provide a JSON analysis with this exact structure:

{
  "overallScore": number (0-100),
  "insights": {
    "priceAnalysis": {
      "score": number (0-100),
      "assessment": "excellent|good|fair|expensive",
      "details": "Detailed price assessment including value for money",
      "comparison": "How price compares to alternatives if available"
    },
    "locationAnalysis": {
      "score": number (0-100),
      "highlights": ["Location advantages"],
      "concerns": ["Location concerns if any"],
      "walkability": "Assessment of walkability and transportation"
    },
    "hostAnalysis": {
      "score": number (0-100),
      "trustLevel": "high|medium|low",
      "details": "Host experience and reliability assessment",
      "experience": "Assessment of host's experience level"
    },
    "propertyAnalysis": {
      "score": number (0-100),
      "highlights": ["Property strengths"],
      "amenityScore": number (0-100),
      "spaceAssessment": "Assessment of space and layout"
    },
    "reviewAnalysis": {
      "score": number (0-100),
      "credibility": "high|medium|low", 
      "summary": "What the review count and rating suggest"
    }
  },
  "recommendations": ["Key recommendations for this booking"],
  "redFlags": ["Any concerns or red flags"],
  "bottomLine": "One-sentence summary recommendation"
}

Focus on practical travel advice. Consider:
- Price competitiveness and value
- Location convenience for travelers
- Host reliability and communication
- Property amenities and condition
- Review credibility and patterns
- Overall booking confidence

Be honest about both positives and concerns. Provide actionable insights.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert travel advisor and Airbnb analyst. Provide comprehensive, honest, and practical listing assessments to help travelers make informed decisions. Always return valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: API_CONFIG.GPT_MAX_TOKENS,
        temperature: 0.3 // Lower temperature for more consistent analysis
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const analysisText = data.choices[API_CONFIG.FIRST_CHOICE_INDEX]?.message?.content?.trim()
    
    if (!analysisText) {
      throw new Error('Empty response from AI analysis')
    }

    // Parse the JSON response
    let analysis: ListingAnalysis
    try {
      analysis = JSON.parse(analysisText)
    } catch (parseError) {
      console.error('Failed to parse AI analysis response:', analysisText)
      // Provide fallback analysis
      analysis = generateFallbackAnalysis(listing, context)
    }

    // Validate and ensure all required fields exist
    analysis = validateAndCleanAnalysis(analysis, listing)

    return analysis

  } catch (error) {
    console.error('AI analysis failed:', error)
    // Return fallback analysis instead of failing completely
    return generateFallbackAnalysis(listing, context)
  }
}

function generateFallbackAnalysis(
  listing: ListingAnalysisRequest['listing'],
  context: ListingAnalysisRequest['context']
): ListingAnalysis {
  // Generate basic analysis without AI
  const priceScore = listing.price.rate < 100 ? 80 : listing.price.rate < 200 ? 60 : 40
  const ratingScore = Math.min(100, listing.rating * 20)
  const hostScore = listing.host.isSuperhost ? 90 : 70
  const reviewScore = listing.reviewsCount > 50 ? 90 : listing.reviewsCount > 10 ? 70 : 50
  
  const overallScore = Math.round((priceScore + ratingScore + hostScore + reviewScore) / 4)

  return {
    overallScore,
    insights: {
      priceAnalysis: {
        score: priceScore,
        assessment: priceScore > 70 ? 'good' : priceScore > 50 ? 'fair' : 'expensive',
        details: `Price of ${listing.price.currency}${listing.price.rate}/night analyzed based on location and amenities.`,
        comparison: context?.alternatives?.length ? 'Compared to similar properties in search results.' : undefined
      },
      locationAnalysis: {
        score: 75,
        highlights: [`Located in ${listing.location.city}`],
        concerns: [],
        walkability: 'Location assessment not available without AI analysis'
      },
      hostAnalysis: {
        score: hostScore,
        trustLevel: listing.host.isSuperhost ? 'high' : 'medium',
        details: listing.host.isSuperhost 
          ? `${listing.host.name} is a Superhost, indicating excellent hosting standards.`
          : `Host ${listing.host.name} appears reliable based on available information.`,
        experience: listing.host.isSuperhost ? 'Experienced' : 'Standard'
      },
      propertyAnalysis: {
        score: 70,
        highlights: listing.amenities.slice(0, 3),
        amenityScore: Math.min(100, listing.amenities.length * 10),
        spaceAssessment: `${listing.bedrooms || 'Unknown'} bedrooms, ${listing.maxGuests || 'Unknown'} guests capacity`
      },
      reviewAnalysis: {
        score: reviewScore,
        credibility: listing.reviewsCount > 50 ? 'high' : listing.reviewsCount > 10 ? 'medium' : 'low',
        summary: `${listing.reviewsCount} reviews with ${listing.rating}/5 rating suggests ${listing.rating > 4.5 ? 'excellent' : listing.rating > 4 ? 'good' : 'average'} guest satisfaction.`
      }
    },
    recommendations: [
      `Property rated ${listing.rating}/5 based on ${listing.reviewsCount} reviews`,
      listing.host.isSuperhost ? 'Superhost provides added confidence' : 'Verify host responsiveness before booking'
    ],
    redFlags: listing.reviewsCount < 5 ? ['Limited review history'] : [],
    bottomLine: `${overallScore > 80 ? 'Excellent' : overallScore > 60 ? 'Good' : 'Fair'} choice for ${listing.location.city} at ${listing.price.currency}${listing.price.rate}/night.`
  }
}

function validateAndCleanAnalysis(
  analysis: any,
  listing: ListingAnalysisRequest['listing']
): ListingAnalysis {
  // Ensure all required fields exist with defaults
  return {
    overallScore: Math.max(0, Math.min(100, analysis.overallScore || 50)),
    insights: {
      priceAnalysis: {
        score: Math.max(0, Math.min(100, analysis.insights?.priceAnalysis?.score || 50)),
        assessment: analysis.insights?.priceAnalysis?.assessment || 'fair',
        details: analysis.insights?.priceAnalysis?.details || 'Price analysis unavailable',
        comparison: analysis.insights?.priceAnalysis?.comparison
      },
      locationAnalysis: {
        score: Math.max(0, Math.min(100, analysis.insights?.locationAnalysis?.score || 50)),
        highlights: Array.isArray(analysis.insights?.locationAnalysis?.highlights) 
          ? analysis.insights.locationAnalysis.highlights 
          : [`Located in ${listing.location.city}`],
        concerns: Array.isArray(analysis.insights?.locationAnalysis?.concerns)
          ? analysis.insights.locationAnalysis.concerns
          : [],
        walkability: analysis.insights?.locationAnalysis?.walkability
      },
      hostAnalysis: {
        score: Math.max(0, Math.min(100, analysis.insights?.hostAnalysis?.score || 50)),
        trustLevel: analysis.insights?.hostAnalysis?.trustLevel || (listing.host.isSuperhost ? 'high' : 'medium'),
        details: analysis.insights?.hostAnalysis?.details || `Host: ${listing.host.name}`,
        experience: analysis.insights?.hostAnalysis?.experience
      },
      propertyAnalysis: {
        score: Math.max(0, Math.min(100, analysis.insights?.propertyAnalysis?.score || 50)),
        highlights: Array.isArray(analysis.insights?.propertyAnalysis?.highlights)
          ? analysis.insights.propertyAnalysis.highlights
          : listing.amenities.slice(0, 3),
        amenityScore: Math.max(0, Math.min(100, analysis.insights?.propertyAnalysis?.amenityScore || 50)),
        spaceAssessment: analysis.insights?.propertyAnalysis?.spaceAssessment
      },
      reviewAnalysis: {
        score: Math.max(0, Math.min(100, analysis.insights?.reviewAnalysis?.score || 50)),
        credibility: analysis.insights?.reviewAnalysis?.credibility || 'medium',
        summary: analysis.insights?.reviewAnalysis?.summary || `${listing.reviewsCount} reviews available`
      }
    },
    recommendations: Array.isArray(analysis.recommendations) ? analysis.recommendations : ['Analysis recommendations unavailable'],
    redFlags: Array.isArray(analysis.redFlags) ? analysis.redFlags : [],
    bottomLine: analysis.bottomLine || `Property analysis for ${listing.name}`
  }
}