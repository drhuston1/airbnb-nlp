// GPT-powered semantic filtering for property listings
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { API_CONFIG } from './config'

interface ListingSummary {
  id: string
  name: string
  roomType: string
  amenities: string[]
  rating: number
  reviewsCount: number
  price: number
  isSuperhost: boolean
}

interface GPTFilterRequest {
  query: string
  listings: ListingSummary[]
}

interface GPTFilterResponse {
  filteredIds: string[]
  success: boolean
  error?: string
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
    const { query, listings }: GPTFilterRequest = req.body

    if (!query || !listings || !Array.isArray(listings)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Query and listings array are required',
        filteredIds: []
      })
    }

    // Check for OpenAI API key
    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      console.error('OPENAI_API_KEY not configured')
      return res.status(500).json({ 
        success: false, 
        error: 'OpenAI API key not configured',
        filteredIds: []
      })
    }

    console.log(`GPT filtering ${listings.length} listings for query: "${query}"`)
    
    const filteredIds = await filterListingsWithGPT(query, listings, openaiKey)
    
    const response: GPTFilterResponse = {
      filteredIds,
      success: true
    }

    console.log(`GPT filtering result: ${filteredIds.length}/${listings.length} properties matched`)
    return res.status(200).json(response)

  } catch (error) {
    console.error('GPT filtering error:', error)
    return res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      filteredIds: []
    })
  }
}

async function filterListingsWithGPT(
  query: string, 
  listings: ListingSummary[], 
  apiKey: string
): Promise<string[]> {
  try {
    const prompt = `You are an expert travel accommodation matcher. Given a user's search query and a list of properties, identify which properties best match the user's intent using semantic understanding.

User Query: "${query}"

Properties to evaluate:
${listings.map((listing, i) => 
  `${i + 1}. ID: ${listing.id}
   Name: ${listing.name}
   Type: ${listing.roomType}
   Rating: ${listing.rating}/5 (${listing.reviewsCount} reviews)
   Price: $${listing.price}/night
   Superhost: ${listing.isSuperhost ? 'Yes' : 'No'}
   Amenities: ${listing.amenities.join(', ') || 'None listed'}`
).join('\n\n')}

Instructions:
1. Use semantic understanding to match properties. For example:
   - "villa" can match "luxury home", "estate", "beachfront house", "retreat"
   - "beachfront" can match "oceanfront", "beach house", "coastal"
   - "luxury" can match high-end properties, superhosts, expensive places
   - "superhost only" should prioritize superhost properties

2. Consider ALL relevant factors: property name, type, amenities, price range, rating, superhost status

3. Return the IDs of properties that match the query intent, ranked by relevance (best matches first)

4. Be generous - include properties that semantically match even if not exact word matches

5. If the query has multiple criteria, prioritize properties that match more criteria, but don't exclude properties that match some criteria

Return ONLY a JSON array of property IDs in order of relevance: ["id1", "id2", "id3", ...]`

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
            content: 'You are an expert travel accommodation matcher. You understand semantic meaning and can match properties based on intent, not just exact keywords. Always return valid JSON arrays.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: API_CONFIG.GPT_MAX_TOKENS,
        temperature: 0.1 // Low temperature for consistent filtering
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const gptResponse = data.choices[API_CONFIG.FIRST_CHOICE_INDEX]?.message?.content?.trim()
    
    if (!gptResponse) {
      throw new Error('Empty response from GPT')
    }

    // Parse the JSON response
    let filteredIds: string[]
    try {
      filteredIds = JSON.parse(gptResponse)
      
      // Validate that it's an array of strings
      if (!Array.isArray(filteredIds) || !filteredIds.every(id => typeof id === 'string')) {
        throw new Error('Invalid response format')
      }
      
      // Filter to only include valid IDs that exist in the input
      const validIds = new Set(listings.map(l => l.id))
      filteredIds = filteredIds.filter(id => validIds.has(id))
      
    } catch (parseError) {
      console.error('Failed to parse GPT response:', gptResponse)
      // Fallback: return all IDs if parsing fails
      filteredIds = listings.map(l => l.id)
    }

    console.log(`GPT matched ${filteredIds.length} properties:`, filteredIds.slice(0, 5))
    return filteredIds

  } catch (error) {
    console.error('GPT filtering failed:', error)
    throw error
  }
}