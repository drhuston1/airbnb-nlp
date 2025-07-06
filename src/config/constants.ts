// Application configuration constants
export const SEARCH_CONFIG = {
  // Default guest counts when not specified
  DEFAULT_ADULTS: 1,
  DEFAULT_CHILDREN: 0,
  
  // Search history limits
  MAX_SEARCH_HISTORY_ITEMS: 50,
  
  // UI interaction delays
  SEARCH_DEBOUNCE_MS: 150,
  
  // Refinement suggestions
  MAX_QUICK_FILTERS: 6,
  MAX_REFINEMENT_SUGGESTIONS: 8,
  
  // Result analysis thresholds
  HIGH_PRIORITY_THRESHOLD: 0.25, // 25% of results
  SUPERHOST_HIGH_PRIORITY_THRESHOLD: 25, // 25% superhosts
  POPULAR_AMENITY_THRESHOLD: 40, // 40% of listings have amenity
} as const

export const FILTER_CONFIG = {
  // Price analysis
  QUARTILE_Q1: 0.25,
  QUARTILE_Q3: 0.75,
  
  // Amenity analysis
  MAX_POPULAR_AMENITIES: 12,
  MAX_AMENITY_SUGGESTIONS: 4,
  
  // Property type analysis
  MAX_PROPERTY_TYPE_SUGGESTIONS: 3,
  
  // Minimum counts for suggestions
  MIN_SUGGESTION_COUNT: 2,
} as const