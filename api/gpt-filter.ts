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
    const prompt = `Filter properties based on this query: "${query}"

For each property, determine if it matches the query. Follow these STRICT rules:

${listings.map((listing, i) => {
  // Pre-analyze each property for the prompt
  const isLuxury = listing.price >= 200 || listing.rating >= 4.8 || listing.isSuperhost;
  const isVilla = listing.roomType.toLowerCase().includes('villa') || listing.name.toLowerCase().includes('villa') || listing.name.toLowerCase().includes('estate');
  const isHostel = listing.roomType.toLowerCase().includes('shared') || listing.roomType.toLowerCase().includes('dorm') || listing.name.toLowerCase().includes('hostel');
  
  return `Property ${listing.id}:
Name: ${listing.name}
Type: ${listing.roomType}
Price: $${listing.price}/night
Rating: ${listing.rating}/5
Superhost: ${listing.isSuperhost ? 'YES' : 'NO'}
Is Luxury: ${isLuxury ? 'YES' : 'NO'} (based on price/rating/superhost)
Is Villa-like: ${isVilla ? 'YES' : 'NO'}
Is Hostel/Shared: ${isHostel ? 'YES' : 'NO'}`
}).join('\n\n')}

FILTERING RULES:
1. If query contains "villa" → ONLY include properties where "Is Villa-like: YES"
2. If query contains "luxury" → ONLY include properties where "Is Luxury: YES"  
3. If query contains "superhost only" → ONLY include properties where "Superhost: YES"
4. If query contains "hostel" → ONLY include properties where "Is Hostel/Shared: YES"
5. If query contains "apartment" → EXCLUDE properties where "Is Villa-like: YES" or "Is Hostel/Shared: YES"

STRICT EXCLUSIONS:
- "villa" queries: EXCLUDE all hostels/shared rooms
- "luxury" queries: EXCLUDE all budget properties (Is Luxury: NO)
- "superhost only": EXCLUDE all non-superhosts (Superhost: NO)

Apply these rules to the query "${query}" and return a JSON array of property IDs that match ALL criteria.

Return format: ["id1", "id2"] or [] if none match.`

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
            content: 'You are a selective travel accommodation matcher. Your job is to filter properties to return only the most relevant matches. Be strict and exclude properties that don\'t genuinely match the user\'s intent. Quality over quantity. Always return valid JSON arrays.'
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