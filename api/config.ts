// API configuration constants
export const API_CONFIG = {
  // OpenAI API settings
  GPT_MAX_TOKENS: 1000,
  GPT_TEMPERATURE: 0, // Critical: Keep at 0 for deterministic responses
  
  // Fallback confidence when parsing fails
  FALLBACK_CONFIDENCE: 0.5,
  
  // Response array indices
  FIRST_CHOICE_INDEX: 0,
  
  // Sorting determinism settings
  ENABLE_STABLE_SORT: true,
  SORT_BY_ID_FALLBACK: true, // Use ID as tiebreaker for stable sorting
  
  // Geocoding service settings
  GEOCODING: {
    CACHE_EXPIRY_MS: 24 * 60 * 60 * 1000, // 24 hours
    MIN_CONFIDENCE_THRESHOLD: 0.5,
    MAX_ALTERNATIVES: 5,
    REQUEST_TIMEOUT_MS: 10000, // 10 seconds
    ENABLE_FUZZY_MATCHING: true,
    
    // Provider configuration
    PROVIDERS: {
      MAPBOX: {
        ENABLED: true,
        PRIORITY: 1,
        TYPES: 'place,locality,neighborhood,address'
      },
      NOMINATIM: {
        ENABLED: true,
        PRIORITY: 2,
        USER_AGENT: 'ChatBnb-Geocoding/1.0 (https://chatbnb.vercel.app)'
      },
      GOOGLE: {
        ENABLED: false, // Disabled by default due to cost
        PRIORITY: 3
      }
    }
  }
} as const