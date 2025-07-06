// API configuration constants
export const API_CONFIG = {
  // OpenAI API settings
  GPT_MAX_TOKENS: 1000,
  GPT_TEMPERATURE: 0,
  
  // Fallback confidence when parsing fails
  FALLBACK_CONFIDENCE: 0.5,
  
  // Response array indices
  FIRST_CHOICE_INDEX: 0,
} as const