// Lightweight NL parameter extraction for travel searches
import nlp from 'compromise'

export interface ExtractedParams {
  location: string | null
  adults?: number
  children?: number
  checkin?: string
  checkout?: string
  priceMin?: number
  priceMax?: number
}

export function extractParams(query: string): ExtractedParams {
  const text = query.trim()
  const lower = text.toLowerCase()
  const out: ExtractedParams = { location: null }

  // Location: simple preposition-based extraction
  const locMatch = text.match(/\b(?:in|near|at)\s+([^,]+?)(?:\s+(?:for|with|under|over|between)|[,.!?]|$)/i)
  if (locMatch) {
    out.location = locMatch[1].trim()
  } else {
    // Fallback: use compromise to get places
    try {
      const doc = nlp(text)
      const places = doc.places().out('array') as string[]
      if (places && places.length > 0) out.location = places[0]
    } catch {}
  }

  // Guests
  const guests = lower.match(/\b(?:for\s+)?(\d{1,2})\s+(?:guests?|people|adults?)\b/)
  if (guests) out.adults = parseInt(guests[1])
  const children = lower.match(/\b(\d{1,2})\s+(?:kids|children)\b/)
  if (children) out.children = parseInt(children[1])

  // Price
  const under = lower.match(/\bunder\s*\$?(\d{1,5})/)
  if (under) out.priceMax = parseInt(under[1])
  const between = lower.match(/\bbetween\s*\$?(\d{1,5})\s*[-–to]{1,3}\s*\$?(\d{1,5})/)
  if (between) {
    out.priceMin = parseInt(between[1])
    out.priceMax = parseInt(between[2])
  }

  // Dates: very naive parsing (YYYY-MM-DD present)
  const dateRegex = /(\d{4}-\d{2}-\d{2})/g
  const dates = Array.from(text.matchAll(dateRegex)).map(m => m[1])
  if (dates.length >= 1) out.checkin = dates[0]
  if (dates.length >= 2) out.checkout = dates[1]

  return out
}

