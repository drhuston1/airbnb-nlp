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
} as const