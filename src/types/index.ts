// Web Speech API type declarations
declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

export interface SpeechRecognitionEvent extends Event {
  results: any
}

export interface SpeechRecognitionErrorEvent extends Event {
  error: string
}

export interface AirbnbListing {
  id: string
  name: string
  url: string
  images: string[]
  price: {
    total: number
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
  platform?: 'airbnb' | 'booking' | 'vrbo'
}

export interface SearchResponse {
  listings: AirbnbListing[]
  hasMore: boolean
  totalResults: number
  page: number
  searchUrl?: string
  source?: string
}

export interface ChatMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  followUps?: string[]
  timestamp: Date
}

export interface SearchHistory {
  id: string
  query: string
  timestamp: Date
  resultCount: number
}

export interface SearchContext {
  location: string
  adults: number
  children: number
  nights?: number
  checkin?: string
  checkout?: string
  minPrice?: number
  maxPrice?: number
}