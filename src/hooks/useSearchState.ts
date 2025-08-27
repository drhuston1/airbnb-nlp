import { useReducer, useMemo } from 'react'
import type { AirbnbListing, SearchContext, ChatMessage, SearchHistory, LocationValidation } from '../types'
import type { RefinementSuggestion } from '../utils/refinementAnalyzer'

// Consolidated state interface
export interface SearchState {
  // Search results and data
  results: AirbnbListing[]
  messages: ChatMessage[]
  searchHistory: SearchHistory[]
  
  // Search configuration
  context: SearchContext | null
  currentQuery: string
  currentPage: number
  hasMore: boolean
  
  // Filters and refinement
  quickFilters: RefinementSuggestion[]
  currentDates: { checkin?: string; checkout?: string; flexible?: boolean } | null
  currentPriceRange: { min?: number; max?: number; budget?: string } | null
  
  // UI state
  loading: boolean
  showResults: boolean
  showSidebar: boolean
  showDateEditor: boolean
  showLocationDisambiguation: boolean
  showAnalysisModal: boolean
  
  // Modal and interaction state
  selectedListingForAnalysis: AirbnbListing | null
  locationValidation: LocationValidation | null
  imageIndexes: Record<string, number>
  
  // Input state
  searchQuery: string
  
  // Analysis state
  lastQueryAnalysis: any
}

// Action types for state updates
export type SearchAction = 
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SHOW_RESULTS'; payload: boolean }
  | { type: 'SET_SHOW_SIDEBAR'; payload: boolean }
  | { type: 'SET_SHOW_DATE_EDITOR'; payload: boolean }
  | { type: 'SET_SHOW_LOCATION_DISAMBIGUATION'; payload: boolean }
  | { type: 'SET_SHOW_ANALYSIS_MODAL'; payload: boolean }
  | { type: 'SET_SELECTED_LISTING'; payload: AirbnbListing | null }
  | { type: 'SET_LOCATION_VALIDATION'; payload: LocationValidation | null }
  | { type: 'SET_IMAGE_INDEX'; payload: { listingId: string; index: number } }
  | { type: 'SET_LAST_QUERY_ANALYSIS'; payload: any }
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'UPDATE_MESSAGES'; payload: ChatMessage[] }
  | { type: 'SEARCH_START'; payload: { query: string; page?: number } }
  | { type: 'SEARCH_SUCCESS'; payload: { 
      results: AirbnbListing[]
      hasMore: boolean
      page: number
      context?: SearchContext
      filters?: RefinementSuggestion[]
      dates?: { checkin?: string; checkout?: string; flexible?: boolean } | null
      priceRange?: { min?: number; max?: number; budget?: string } | null
    }}
  | { type: 'SEARCH_ERROR'; payload: string }
  | { type: 'LOAD_MORE_SUCCESS'; payload: { 
      results: AirbnbListing[]
      hasMore: boolean
      page: number
    }}
  | { type: 'SET_SEARCH_CONTEXT'; payload: SearchContext | null }
  | { type: 'SET_QUICK_FILTERS'; payload: RefinementSuggestion[] }
  | { type: 'SET_CURRENT_DATES'; payload: { checkin?: string; checkout?: string; flexible?: boolean } | null }
  | { type: 'SET_CURRENT_PRICE_RANGE'; payload: { min?: number; max?: number; budget?: string } | null }
  | { type: 'ADD_TO_HISTORY'; payload: { query: string; resultCount: number } }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'LOAD_HISTORY'; payload: SearchHistory[] }
  | { type: 'START_NEW_CHAT' }
  | { type: 'REPLACE_OPTIMISTIC_MESSAGE'; payload: ChatMessage }

// Initial state
const initialState: SearchState = {
  // Search results and data
  results: [],
  messages: [],
  searchHistory: [],
  
  // Search configuration
  context: null,
  currentQuery: '',
  currentPage: 1,
  hasMore: false,
  
  // Filters and refinement
  quickFilters: [],
  currentDates: null,
  currentPriceRange: null,
  
  // UI state
  loading: false,
  showResults: false,
  showSidebar: false,
  showDateEditor: false,
  showLocationDisambiguation: false,
  showAnalysisModal: false,
  
  // Modal and interaction state
  selectedListingForAnalysis: null,
  locationValidation: null,
  imageIndexes: {},
  
  // Input state
  searchQuery: '',
  
  // Analysis state
  lastQueryAnalysis: null
}

// Consolidated reducer for all state management
const searchReducer = (state: SearchState, action: SearchAction): SearchState => {
  switch (action.type) {
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload }
    
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    
    case 'SET_SHOW_RESULTS':
      return { ...state, showResults: action.payload }
    
    case 'SET_SHOW_SIDEBAR':
      return { ...state, showSidebar: action.payload }
    
    case 'SET_SHOW_DATE_EDITOR':
      return { ...state, showDateEditor: action.payload }
    
    case 'SET_SHOW_LOCATION_DISAMBIGUATION':
      return { ...state, showLocationDisambiguation: action.payload }
    
    case 'SET_SHOW_ANALYSIS_MODAL':
      return { ...state, showAnalysisModal: action.payload }
    
    case 'SET_SELECTED_LISTING':
      return { ...state, selectedListingForAnalysis: action.payload }
    
    case 'SET_LOCATION_VALIDATION':
      return { ...state, locationValidation: action.payload }
    
    case 'SET_IMAGE_INDEX':
      return { 
        ...state, 
        imageIndexes: {
          ...state.imageIndexes,
          [action.payload.listingId]: action.payload.index
        }
      }
    
    case 'SET_LAST_QUERY_ANALYSIS':
      return { ...state, lastQueryAnalysis: action.payload }
    
    case 'ADD_MESSAGE':
      return { 
        ...state, 
        messages: [...state.messages, action.payload]
      }
    
    case 'UPDATE_MESSAGES':
      return { ...state, messages: action.payload }
    
    case 'SEARCH_START':
      return {
        ...state,
        loading: true,
        currentQuery: action.payload.query,
        currentPage: action.payload.page || 1,
        // Don't clear searchQuery if it's a direct query (refinement)
        searchQuery: action.payload.page ? state.searchQuery : ''
      }
    
    case 'SEARCH_SUCCESS':
      return {
        ...state,
        loading: false,
        results: action.payload.results,
        hasMore: action.payload.hasMore,
        currentPage: action.payload.page,
        showResults: true,
        ...(action.payload.context && { context: action.payload.context }),
        ...(action.payload.filters && { quickFilters: action.payload.filters }),
        ...(action.payload.dates !== undefined && { currentDates: action.payload.dates }),
        ...(action.payload.priceRange !== undefined && { currentPriceRange: action.payload.priceRange })
      }
    
    case 'SEARCH_ERROR':
      return {
        ...state,
        loading: false
      }
    
    case 'LOAD_MORE_SUCCESS':
      return {
        ...state,
        results: [...state.results, ...action.payload.results],
        hasMore: action.payload.hasMore,
        currentPage: action.payload.page
      }
    
    case 'SET_SEARCH_CONTEXT':
      return { ...state, context: action.payload }
    
    case 'SET_QUICK_FILTERS':
      return { ...state, quickFilters: action.payload }
    
    case 'SET_CURRENT_DATES':
      return { ...state, currentDates: action.payload }
    
    case 'SET_CURRENT_PRICE_RANGE':
      return { ...state, currentPriceRange: action.payload }
    
    case 'ADD_TO_HISTORY':
      const newHistoryItem: SearchHistory = {
        id: Date.now().toString(),
        query: action.payload.query,
        timestamp: new Date(),
        resultCount: action.payload.resultCount
      }
      
      // Remove duplicate queries and keep only the latest 20
      const filteredHistory = state.searchHistory.filter(item => item.query !== action.payload.query)
      const newHistory = [newHistoryItem, ...filteredHistory].slice(0, 20) // MAX_SEARCH_HISTORY_ITEMS
      
      // Persist to localStorage
      localStorage.setItem('airbnb-search-history', JSON.stringify(newHistory))
      
      return { ...state, searchHistory: newHistory }
    
    case 'CLEAR_HISTORY':
      localStorage.removeItem('airbnb-search-history')
      return { ...state, searchHistory: [] }
    
    case 'LOAD_HISTORY':
      return { ...state, searchHistory: action.payload }
    
    case 'START_NEW_CHAT':
      return {
        ...state,
        messages: [],
        results: [],
        showResults: false,
        currentPage: 1,
        hasMore: false,
        currentQuery: '',
        searchQuery: '',
        context: null,
        lastQueryAnalysis: null,
        quickFilters: [],
        currentDates: null,
        currentPriceRange: null
      }
    
    case 'REPLACE_OPTIMISTIC_MESSAGE':
      return {
        ...state,
        messages: state.messages.map(msg => 
          msg.isOptimistic 
            ? action.payload
            : msg
        ).filter(msg => !msg.isOptimistic || msg.id === action.payload.id)
      }
    
    default:
      return state
  }
}

// Custom hook for search state management
export const useSearchState = () => {
  const [state, dispatch] = useReducer(searchReducer, initialState)
  
  // Memoized action creators to prevent unnecessary re-renders
  const actions = useMemo(() => ({
    setSearchQuery: (query: string) => dispatch({ type: 'SET_SEARCH_QUERY', payload: query }),
    setLoading: (loading: boolean) => dispatch({ type: 'SET_LOADING', payload: loading }),
    setShowResults: (show: boolean) => dispatch({ type: 'SET_SHOW_RESULTS', payload: show }),
    setShowSidebar: (show: boolean) => dispatch({ type: 'SET_SHOW_SIDEBAR', payload: show }),
    setShowDateEditor: (show: boolean) => dispatch({ type: 'SET_SHOW_DATE_EDITOR', payload: show }),
    setShowLocationDisambiguation: (show: boolean) => dispatch({ type: 'SET_SHOW_LOCATION_DISAMBIGUATION', payload: show }),
    setShowAnalysisModal: (show: boolean) => dispatch({ type: 'SET_SHOW_ANALYSIS_MODAL', payload: show }),
    setSelectedListing: (listing: AirbnbListing | null) => dispatch({ type: 'SET_SELECTED_LISTING', payload: listing }),
    setLocationValidation: (validation: LocationValidation | null) => dispatch({ type: 'SET_LOCATION_VALIDATION', payload: validation }),
    setImageIndex: (listingId: string, index: number) => dispatch({ type: 'SET_IMAGE_INDEX', payload: { listingId, index } }),
    setLastQueryAnalysis: (analysis: any) => dispatch({ type: 'SET_LAST_QUERY_ANALYSIS', payload: analysis }),
    addMessage: (message: ChatMessage) => dispatch({ type: 'ADD_MESSAGE', payload: message }),
    updateMessages: (messages: ChatMessage[]) => dispatch({ type: 'UPDATE_MESSAGES', payload: messages }),
    searchStart: (query: string, page?: number) => dispatch({ type: 'SEARCH_START', payload: { query, page } }),
    searchSuccess: (payload: { 
      results: AirbnbListing[]
      hasMore: boolean
      page: number
      context?: SearchContext
      filters?: RefinementSuggestion[]
      dates?: { checkin?: string; checkout?: string; flexible?: boolean } | null
      priceRange?: { min?: number; max?: number; budget?: string } | null
    }) => dispatch({ type: 'SEARCH_SUCCESS', payload }),
    searchError: (error: string) => dispatch({ type: 'SEARCH_ERROR', payload: error }),
    loadMoreSuccess: (payload: { 
      results: AirbnbListing[]
      hasMore: boolean
      page: number
    }) => dispatch({ type: 'LOAD_MORE_SUCCESS', payload }),
    setSearchContext: (context: SearchContext | null) => dispatch({ type: 'SET_SEARCH_CONTEXT', payload: context }),
    setQuickFilters: (filters: RefinementSuggestion[]) => dispatch({ type: 'SET_QUICK_FILTERS', payload: filters }),
    setCurrentDates: (dates: { checkin?: string; checkout?: string; flexible?: boolean } | null) => dispatch({ type: 'SET_CURRENT_DATES', payload: dates }),
    setCurrentPriceRange: (priceRange: { min?: number; max?: number; budget?: string } | null) => dispatch({ type: 'SET_CURRENT_PRICE_RANGE', payload: priceRange }),
    addToHistory: (query: string, resultCount: number) => dispatch({ type: 'ADD_TO_HISTORY', payload: { query, resultCount } }),
    clearHistory: () => dispatch({ type: 'CLEAR_HISTORY' }),
    loadHistory: (history: SearchHistory[]) => dispatch({ type: 'LOAD_HISTORY', payload: history }),
    startNewChat: () => dispatch({ type: 'START_NEW_CHAT' }),
    replaceOptimisticMessage: (message: ChatMessage) => dispatch({ type: 'REPLACE_OPTIMISTIC_MESSAGE', payload: message })
  }), [])
  
  return { state, actions }
}