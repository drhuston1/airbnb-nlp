import type { VercelRequest, VercelResponse } from '@vercel/node'
import { extractParams } from './tools/extract-params'
import { searchAirbnb } from './providers/airbnb'
import { searchBooking } from './providers/booking'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { query, page = 1, maxResults = 40 } = req.body || {}
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' })
    }

    // Try LLM tool-calling orchestrator first; fallback to lightweight parser
    const openaiKey = process.env.OPENAI_API_KEY
    let combinedListings: any[] | null = null
    let sources: { platform: string, count: number, status: 'success'|'error'|'timeout', error?: string }[] = []

    if (openaiKey) {
      try {
        const orchestration = await orchestrateWithLLM(query, page)
        combinedListings = orchestration.listings
        sources = orchestration.sources
      } catch (e) {
        console.warn('LLM orchestration failed, using fallback:', e instanceof Error ? e.message : e)
      }
    }

    if (!combinedListings) {
      const params = extractParams(query)
      if (!params.location) {
        return res.status(200).json({
          listings: [],
          sources: [],
          page,
          notes: 'Location not detected. Try: "in Paris" or "near Austin".'
        })
      }
      const providerParams = {
        location: params.location,
        checkin: params.checkin,
        checkout: params.checkout,
        adults: params.adults,
        children: params.children,
        priceMin: params.priceMin,
        priceMax: params.priceMax,
        page,
      }

      const { listings, status } = await runProviders(providerParams)
      combinedListings = listings
      sources = status
    }

    const unique = dedupeAndSort(combinedListings)

    return res.status(200).json({
      listings: unique.slice(0, maxResults),
      sources,
      page,
    })
  } catch (error) {
    console.error('Unified search error:', error)
    return res.status(500).json({ error: 'Failed to perform search' })
  }
}

async function orchestrateWithLLM(query: string, page: number) {
  const openaiKey = process.env.OPENAI_API_KEY!

  const hasBooking = !!process.env.SERPAPI_KEY

  const tools: any[] = [
    {
      type: 'function',
      function: {
        name: 'extract_params',
        description: 'Extracts location, guests, dates (YYYY-MM-DD), and priceMin/priceMax from a travel search query',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'search_airbnb',
        description: 'Search Airbnb listings for given parameters. Must include location. Dates and price help relevance.',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string' },
            checkin: { type: 'string' },
            checkout: { type: 'string' },
            adults: { type: 'number' },
            children: { type: 'number' },
            priceMin: { type: 'number' },
            priceMax: { type: 'number' },
            page: { type: 'number' }
          },
          required: ['location']
        }
      }
    }
  ]

  if (hasBooking) {
    tools.push({
      type: 'function',
      function: {
        name: 'search_booking',
        description: 'Search Booking.com/Google Hotels for given parameters. Must include location.',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string' },
            checkin: { type: 'string' },
            checkout: { type: 'string' },
            adults: { type: 'number' },
            children: { type: 'number' },
            priceMin: { type: 'number' },
            priceMax: { type: 'number' },
            page: { type: 'number' }
          },
          required: ['location']
        }
      }
    })
  }

  const system = [
    'You are a travel search orchestrator. Your job is to call tools, not write prose.',
    '- Always call extract_params first using the user query.',
    '- Validate that a location string exists before calling search tools. If missing, you may still call Airbnb to probe, but prefer returning no more tool calls.',
    '- If price constraints or dates are present, include them in tool calls.',
    '- Provider selection: default to Airbnb; if unsure or for broad/urban queries, call both (if Booking available).',
    '- Never call the same provider more than once per request.',
    '- Keep tool usage to 1–3 calls total. Stop when providers have been called.',
    '- Do not output natural language. Only tool calls are expected.',
    `Capabilities: booking_available=${hasBooking ? 'true' : 'false'}, page=${page}.`
  ].join('\n')

  const examples = [
    {
      user: '2BR in Charleston under $200/night for 2 adults',
      calls: [
        { name: 'extract_params', args: { query: '2BR in Charleston under $200/night for 2 adults' } },
        { name: 'search_airbnb', args: { location: 'Charleston', priceMax: 200, adults: 2, page: 1 } },
      ]
    },
    {
      user: 'Paris 2025-07-10 to 2025-07-14 for 2',
      calls: [
        { name: 'extract_params', args: { query: 'Paris 2025-07-10 to 2025-07-14 for 2' } },
        { name: 'search_airbnb', args: { location: 'Paris', checkin: '2025-07-10', checkout: '2025-07-14', adults: 2, page: 1 } },
      ]
    }
  ]

  const messages: any[] = [
    { role: 'system', content: system },
    { role: 'user', content: query },
    { role: 'user', content: `EXAMPLE 1: ${examples[0].user}` },
    { role: 'assistant', tool_calls: [{ type: 'function', id: 'ex1a', function: { name: 'extract_params', arguments: JSON.stringify(examples[0].calls[0].args) } }], content: null },
    { role: 'tool', tool_call_id: 'ex1a', content: JSON.stringify({ location: 'Charleston', adults: 2, priceMax: 200 }) },
    { role: 'assistant', tool_calls: [{ type: 'function', id: 'ex1b', function: { name: 'search_airbnb', arguments: JSON.stringify(examples[0].calls[1].args) } }], content: null },
  ]

  const collected: any[] = []
  const sourceStatus: { platform: string, count: number, status: 'success'|'error'|'timeout', error?: string }[] = []

  for (let i = 0; i < 3; i++) {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.1, max_tokens: 400, messages, tools, tool_choice: 'auto' })
    })
    if (!resp.ok) throw new Error(`OpenAI error ${resp.status}`)
    const data = await resp.json()
    const msg = data.choices?.[0]?.message
    if (!msg) break
    messages.push(msg)

    const toolCalls = msg.tool_calls || []
    if (!toolCalls.length) break

    for (const call of toolCalls) {
      const name = call.function?.name
      const args = safeJson(call.function?.arguments)

      if (name === 'extract_params') {
        const p = extractParams(args.query || query)
        const toolResult = JSON.stringify(p)
        messages.push({ role: 'tool', tool_call_id: call.id, content: toolResult })
      } else if (name === 'search_airbnb') {
        const { listings, status } = await runProviders({ ...args, page: args.page || page }, ['airbnb'])
        collected.push(...listings)
        sourceStatus.push(...status)
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ count: listings.length }) })
      } else if (name === 'search_booking') {
        const { listings, status } = await runProviders({ ...args, page: args.page || page }, ['booking'])
        collected.push(...listings)
        sourceStatus.push(...status)
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ count: listings.length }) })
      }
    }
  }

  const unique = dedupeAndSort(collected)
  return { listings: unique, sources: sourceStatus }
}

function safeJson(str: any) {
  try { return JSON.parse(str || '{}') } catch { return {} }
}

async function runProviders(providerParams: any, which: ('airbnb'|'booking')[] = ['airbnb','booking']) {
  const withTimeout = <T>(p: Promise<T>, ms = 10000): Promise<T> => {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout')), ms)
      p.then(v => { clearTimeout(t); resolve(v) }).catch(e => { clearTimeout(t); reject(e) })
    })
  }

  const tasks: Promise<any>[] = []
  const platforms: ('airbnb'|'booking')[] = []
  if (which.includes('airbnb')) { tasks.push(withTimeout(searchAirbnb(providerParams), 12000)); platforms.push('airbnb') }
  if (which.includes('booking')) { tasks.push(withTimeout(searchBooking(providerParams), 12000)); platforms.push('booking') }

  const settled = await Promise.allSettled(tasks)
  const listings: any[] = []
  const status: { platform: string, count: number, status: 'success'|'error'|'timeout', error?: string }[] = []

  settled.forEach((r, idx) => {
    const platform = platforms[idx]
    if (r.status === 'fulfilled') {
      const arr = Array.isArray(r.value) ? r.value : []
      listings.push(...arr)
      status.push({ platform, count: arr.length, status: 'success' })
    } else {
      const err = r.reason instanceof Error ? r.reason.message : String(r.reason)
      status.push({ platform, count: 0, status: err === 'timeout' ? 'timeout' : 'error', error: err })
    }
  })

  return { listings, status }
}

function dedupeAndSort(listings: any[]) {
  const seen = new Set<string>()
  const unique = listings.filter(l => {
    const key = l.url || l.id
    if (!key) return false
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  unique.sort((a, b) => {
    const tA = a.trustScore || 0, tB = b.trustScore || 0
    if (tA !== tB) return tB - tA
    if ((a.rating || 0) !== (b.rating || 0)) return (b.rating || 0) - (a.rating || 0)
    return (a.price?.rate || 0) - (b.price?.rate || 0)
  })
  return unique
}
