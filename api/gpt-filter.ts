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
    const prompt = `You are an expert travel accommodation matcher. Given a user's search query and a list of properties, identify which properties genuinely match the user's intent. Be selective - only include properties that are truly relevant.

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

STRICT Filtering Rules - EXCLUDE properties that don't match:

1. Property Type Requirements:
   - "villa" query = ONLY villas, luxury homes, estates (EXCLUDE: apartments, hostels, standard rooms)
   - "apartment" query = ONLY apartments, condos, flats (EXCLUDE: villas, houses, hostels)
   - "house" query = ONLY houses, homes, cottages (EXCLUDE: apartments, hostels, shared rooms)
   - "luxury" query = ONLY high-end properties: $200+/night OR 4.8+ rating OR superhost (EXCLUDE: budget options under $150)

2. Mandatory Requirements (STRICT):
   - "superhost only" = EXCLUDE ALL non-superhosts (isSuperhost must be true)
   - "beachfront/oceanfront" = EXCLUDE properties without beach/ocean/water in name/amenities
   - Price limits ("under $X") = EXCLUDE properties above that price
   - Rating requirements ("4.8+") = EXCLUDE properties below that rating

3. Quality Exclusions:
   - For "luxury" queries: EXCLUDE hostels, shared rooms, anything under $100/night
   - For "villa" queries: EXCLUDE hostels, apartments, shared accommodations
   - For "budget" queries: EXCLUDE luxury properties over $200/night

4. Examples of what to EXCLUDE:
   - Query "luxury villa" → EXCLUDE: hostels, apartments, budget properties, shared rooms
   - Query "superhost only" → EXCLUDE: any property with isSuperhost = false
   - Query "beachfront house" → EXCLUDE: properties without beach/ocean mentions

5. STRICT FILTERING APPROACH:
   - If query specifies "villa", EXCLUDE everything that's not villa-like
   - If query specifies "luxury", EXCLUDE budget accommodations
   - If query specifies "superhost only", EXCLUDE all non-superhosts
   - Better to return 1 perfect match than 10 mediocre ones

EXAMPLE FILTERING DECISIONS:

Query: "luxury beachfront villa"
Property A: "Luxury Oceanfront Estate", $500/night, villa, 4.9 rating → INCLUDE
Property B: "Budget Downtown Hostel", $25/night, shared room, 3.5 rating → EXCLUDE (not luxury, not villa, not beachfront)

Query: "superhost only"  
Property A: Superhost = true → INCLUDE
Property B: Superhost = false → EXCLUDE

Query: "budget apartment under $100"
Property A: Apartment, $80/night → INCLUDE  
Property B: Villa, $300/night → EXCLUDE (over budget, not apartment)

Return ONLY a JSON array of property IDs that genuinely match: ["id1", "id2"]

If no properties meet the strict criteria, return an empty array: []`

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