import { useState, useRef, useEffect } from 'react'
import {
  Box,
  Text,
  Button,
  HStack,
  Spinner,
  Flex,
  Link,
  Icon,
  VStack,
  Textarea,
  Grid
} from '@chakra-ui/react'
import { 
  MapPin, 
  Star, 
  Crown,
  ExternalLink,
  Send,
  Home,
  Clock,
  X,
  Plus,
  Menu,
  DollarSign,
  Award,
  Wifi,
  Filter,
  Calendar,
  Building,
  Bed,
  Bath,
  Shield
} from 'lucide-react'

// Import types
import type { SearchContext } from './types'

// Import enhanced query analysis and refinement utilities
import { RefinementAnalyzer, type RefinementSuggestion } from './utils/refinementAnalyzer'
import { SEARCH_CONFIG } from './config/constants'

// GPT-powered semantic filtering function
async function filterWithGPT(query: string, listings: AirbnbListing[]): Promise<AirbnbListing[]> {
  try {
    const response = await fetch('/api/gpt-filter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        listings: listings.map(listing => ({
          id: listing.id,
          name: listing.name,
          roomType: listing.roomType,
          amenities: listing.amenities,
          rating: listing.rating,
          reviewsCount: listing.reviewsCount,
          price: listing.price.rate,
          isSuperhost: listing.host.isSuperhost
        }))
      })
    })

    if (!response.ok) {
      throw new Error(`GPT filtering failed: ${response.status}`)
    }

    const result = await response.json()
    
    // Map back to full listing objects
    const filteredIds = new Set(result.filteredIds)
    return listings.filter(listing => filteredIds.has(listing.id))
    
  } catch (error) {
    console.error('GPT filtering error:', error)
    throw error
  }
}
interface AirbnbListing {
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
  propertyType?: string
  platform?: string
  // Enhanced property details
  bedrooms?: number
  bathrooms?: number
  beds?: number
  maxGuests?: number
  // Review insights
  trustScore?: number // 0-100 score based on rating and review count
  reviewInsights?: {
    positiveHighlights: string[]
    negativeInsights: string[]
    commonConcerns: string[]
    overallSentiment: 'positive' | 'mixed' | 'negative'
  }
}

interface SearchResponse {
  listings: AirbnbListing[]
  hasMore: boolean
  totalResults: number
  page: number
  searchUrl?: string
  source?: string
  dates?: {
    checkin?: string
    checkout?: string
    flexible?: boolean
  }
  sources?: {
    platform: string
    count: number
    status: 'success' | 'error' | 'timeout'
    error?: string
  }[]
}

interface ChatMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  followUps?: string[]
  refinementSuggestions?: RefinementSuggestion[]
  timestamp: Date
}

interface SearchHistory {
  id: string
  query: string
  timestamp: Date
  resultCount: number
}

function App() {
  const [searchQuery, setSearchQuery] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [currentQuery, setCurrentQuery] = useState('')
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([])
  const [showResults, setShowResults] = useState(false)
  const [currentResults, setCurrentResults] = useState<AirbnbListing[]>([])
  const [showSidebar, setShowSidebar] = useState(false)
  const [searchContext, setSearchContext] = useState<SearchContext | null>(null)
  const [, setLastQueryAnalysis] = useState<any>(null)
  const [quickFilters, setQuickFilters] = useState<RefinementSuggestion[]>([])
  const [currentDates, setCurrentDates] = useState<{checkin?: string, checkout?: string, flexible?: boolean} | null>(null)
  const [currentPriceRange, setCurrentPriceRange] = useState<{min?: number, max?: number, budget?: string} | null>(null)
  
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)



  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Load search history from localStorage on mount only
  useEffect(() => {
    const savedHistory = localStorage.getItem('airbnb-search-history')
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory)
        setSearchHistory(parsed.map((item: SearchHistory) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        })))
      } catch (error) {
        console.error('Error loading search history:', error)
      }
    }
  }, [])

  // Add search to history and persist to localStorage
  const addToHistory = (query: string, resultCount: number) => {
    const newHistoryItem: SearchHistory = {
      id: Date.now().toString(),
      query,
      timestamp: new Date(),
      resultCount
    }
    
    setSearchHistory(prev => {
      // Remove duplicate queries and keep only the latest 20
      const filtered = prev.filter(item => item.query !== query)
      const newHistory = [newHistoryItem, ...filtered].slice(0, SEARCH_CONFIG.MAX_SEARCH_HISTORY_ITEMS)
      
      // Persist to localStorage immediately
      localStorage.setItem('airbnb-search-history', JSON.stringify(newHistory))
      
      return newHistory
    })
  }

  // Clear search history and localStorage
  const clearHistory = () => {
    setSearchHistory([])
    localStorage.removeItem('airbnb-search-history')
  }

  // Start new chat
  const startNewChat = () => {
    setMessages([])
    setCurrentResults([])
    setShowResults(false)
    setCurrentPage(1)
    setHasMore(false)
    setCurrentQuery('')
    setSearchQuery('')
    setSearchContext(null)
    setLastQueryAnalysis(null)
    setQuickFilters([])
    setCurrentDates(null)
    setCurrentPriceRange(null)
  }



  const handleSearch = async (page = 1, directQuery?: string) => {
    const query = directQuery || searchQuery
    if (!query.trim()) return

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: query,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])

    setLoading(true)
    // Scroll to bottom to show user message and loading state
    setTimeout(scrollToBottom, 100)
    
    // Only clear search query if not using directQuery (refinement)
    if (!directQuery) {
      setSearchQuery('')
    }

    // Use enhanced query analysis to understand intent and extract location
    let extractedLocation = 'Unknown'
    let queryAnalysis: any = null
    
    const analysisResponse = await fetch('/api/analyze-query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        previousLocation: searchContext?.location,
        hasExistingResults: currentResults.length > 0
      })
    })
    
    if (!analysisResponse.ok) {
      throw new Error(`Query analysis failed: ${analysisResponse.status}`)
    }
    
    const analysisData = await analysisResponse.json()
    queryAnalysis = analysisData.analysis
    
    // Handle location context preservation for refinements
    if (queryAnalysis.location === 'SAME' && searchContext?.location) {
      extractedLocation = searchContext.location
      console.log(`Refinement detected: using previous location "${extractedLocation}"`)
    } else {
      extractedLocation = queryAnalysis.location
    }
    
    setLastQueryAnalysis(queryAnalysis)
    console.log('Enhanced Query Analysis:', queryAnalysis)
    console.log('Final extracted location:', extractedLocation)
    
    // If no location found, ask for one
    if (extractedLocation === 'Unknown') {
      const clarificationMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'I need to know where you\'d like to stay. Could you please specify a location?',
        followUps: ['Try: "Dog-friendly cabin near Yellowstone"', 'Try: "Charleston vacation rental"', 'Try: "Austin loft for 2 adults"'],
        timestamp: new Date()
      }
      setMessages(prev => [...prev, clarificationMessage])
      setTimeout(scrollToBottom, 100)
      setLoading(false)
      return
    }

    try {
      // Enhanced search payload with extracted criteria
      const searchPayload: Record<string, unknown> = {
        query,
        page,
        location: extractedLocation,
        adults: queryAnalysis?.extractedCriteria?.guests?.adults || SEARCH_CONFIG.DEFAULT_ADULTS,
        children: queryAnalysis?.extractedCriteria?.guests?.children || SEARCH_CONFIG.DEFAULT_CHILDREN
      }
      
      // Add extracted dates if available
      if (queryAnalysis?.extractedCriteria?.dates?.checkin) {
        searchPayload.checkin = queryAnalysis.extractedCriteria.dates.checkin
      }
      if (queryAnalysis?.extractedCriteria?.dates?.checkout) {
        searchPayload.checkout = queryAnalysis.extractedCriteria.dates.checkout
      }
      
      // Add extracted price range if available
      if (queryAnalysis?.extractedCriteria?.priceRange?.min) {
        searchPayload.priceMin = queryAnalysis.extractedCriteria.priceRange.min
      }
      if (queryAnalysis?.extractedCriteria?.priceRange?.max) {
        searchPayload.priceMax = queryAnalysis.extractedCriteria.priceRange.max
      }
      
      // Add extracted bedroom/bathroom criteria if available
      if (queryAnalysis?.extractedCriteria?.bedrooms) {
        searchPayload.minBedrooms = queryAnalysis.extractedCriteria.bedrooms
      }
      if (queryAnalysis?.extractedCriteria?.bathrooms) {
        searchPayload.minBathrooms = queryAnalysis.extractedCriteria.bathrooms
      }
      
      console.log('ENHANCED SEARCH PAYLOAD WITH EXTRACTED CRITERIA:', searchPayload)
      console.log('EXTRACTED QUERY ANALYSIS:', queryAnalysis)
      console.log('BEDROOM/BATHROOM CRITERIA:', {
        bedrooms: queryAnalysis?.extractedCriteria?.bedrooms,
        bathrooms: queryAnalysis?.extractedCriteria?.bathrooms,
        minBedrooms: searchPayload.minBedrooms,
        minBathrooms: searchPayload.minBathrooms
      })

      const response = await fetch('/api/unified-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchPayload)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `Search failed: ${response.statusText}`)
      }

      const data: SearchResponse = await response.json()
      const searchResults = data.listings || []
      
      console.log('AIRBNB SEARCH RESULTS:', {
        totalListings: searchResults.length,
        firstListing: searchResults[0] ? {
          name: searchResults[0].name,
          location: searchResults[0].location,
          rating: searchResults[0].rating,
          price: searchResults[0].price.rate,
          trustScore: searchResults[0].trustScore
        } : 'No listings'
      })
      
      // Enhanced context tracking with refinement awareness
      if (page === 1) {
        if (queryAnalysis?.isRefinement && searchContext) {
          // Update existing context with new criteria, preserving location if "SAME"
          const updatedContext = {
            ...searchContext,
            location: extractedLocation === 'SAME' ? searchContext.location : extractedLocation,
            // Merge any extracted criteria from the query analysis
            ...(queryAnalysis.extractedCriteria.guests?.adults && {
              adults: queryAnalysis.extractedCriteria.guests.adults
            }),
            ...(queryAnalysis.extractedCriteria.guests?.children && {
              children: queryAnalysis.extractedCriteria.guests.children
            })
          }
          setSearchContext(updatedContext)
          console.log('Updated search context for refinement:', updatedContext)
        } else {
          // New search context
          const newContext = {
            location: extractedLocation,
            adults: queryAnalysis?.extractedCriteria.guests?.adults || SEARCH_CONFIG.DEFAULT_ADULTS,
            children: queryAnalysis?.extractedCriteria.guests?.children || SEARCH_CONFIG.DEFAULT_CHILDREN
          }
          setSearchContext(newContext)
          console.log('Created new search context:', newContext)
        }
      }
      
      // Apply GPT-powered semantic filtering for complex queries
      let filteredResults = searchResults
      
      // For complex queries with multiple criteria, use GPT to semantically filter and rank
      if (queryAnalysis?.extractedCriteria && 
          (queryAnalysis.extractedCriteria.propertyType || 
           queryAnalysis.extractedCriteria.amenities?.length > 0 ||
           queryAnalysis.extractedCriteria.rating?.superhost)) {
        
        try {
          console.log('Using GPT-powered semantic filtering for complex query')
          const semanticResults = await filterWithGPT(query, searchResults)
          if (semanticResults && semanticResults.length > 0) {
            filteredResults = semanticResults
            console.log(`GPT semantic filtering: ${filteredResults.length} out of ${searchResults.length} results`)
          } else {
            console.log('GPT filtering returned no results, falling back to basic filtering')
          }
        } catch (error) {
          console.error('GPT filtering failed, using basic filtering:', error)
        }
      }
      
      if (queryAnalysis?.extractedCriteria && filteredResults === searchResults) {
        const criteria = queryAnalysis.extractedCriteria
        
        // Helper function to apply filter with fallback
        const applyFilterWithFallback = (
          results: typeof searchResults,
          filterFn: (listing: typeof searchResults[0]) => boolean,
          filterName: string,
          allowEmpty = false
        ) => {
          const filtered = results.filter(filterFn)
          if (filtered.length === 0 && !allowEmpty && results.length > 0) {
            console.log(`${filterName} would eliminate all results, skipping filter`)
            return results
          }
          console.log(`${filterName}: ${filtered.length} results`)
          return filtered
        }
        
        // Filter by rating (strict - usually reasonable)
        if (criteria.rating?.min) {
          filteredResults = applyFilterWithFallback(
            filteredResults,
            listing => listing.rating >= criteria.rating.min!,
            `Filtered by rating >= ${criteria.rating.min}`,
            criteria.rating.min > 4.5 // Allow empty for very high rating requirements
          )
        }
        
        // Filter by price range and budget categories
        if (criteria.priceRange?.min || criteria.priceRange?.max || criteria.priceRange?.budget) {
          filteredResults = applyFilterWithFallback(
            filteredResults,
            listing => {
              const price = listing.price.rate
              
              // Handle budget categories
              if (criteria.priceRange?.budget) {
                switch (criteria.priceRange.budget) {
                  case 'budget':
                    return price <= 150
                  case 'mid-range':
                    return price >= 100 && price <= 300
                  case 'luxury':
                    return price >= 300 || listing.host.isSuperhost || listing.rating >= 4.8
                  default:
                    break
                }
              }
              
              // Handle explicit price range
              const minOk = !criteria.priceRange?.min || price >= criteria.priceRange.min
              const maxOk = !criteria.priceRange?.max || price <= criteria.priceRange.max
              return minOk && maxOk
            },
            `Filtered by price ${criteria.priceRange.budget ? `(${criteria.priceRange.budget})` : 'range'}`,
            true // Allow empty for price filtering
          )
        }
        
        // Filter by property type (intelligent matching for luxury terms)
        if (criteria.propertyType) {
          const targetType = criteria.propertyType.toLowerCase()
          filteredResults = applyFilterWithFallback(
            filteredResults,
            listing => {
              const roomType = listing.roomType.toLowerCase()
              const name = listing.name.toLowerCase()
              
              // Direct match first
              if (roomType.includes(targetType) || name.includes(targetType)) {
                return true
              }
              
              // Intelligent mapping for luxury property types
              if (targetType === 'villa') {
                // Villa should match luxury homes, estates, retreats, mansions
                return name.includes('luxury') || name.includes('estate') || 
                       name.includes('retreat') || name.includes('mansion') ||
                       name.includes('beachfront') || name.includes('oceanfront') ||
                       roomType.includes('entire') // Villas are usually entire places
              }
              
              if (targetType === 'house') {
                // House should match homes, cottages, cabins
                return name.includes('home') || name.includes('cottage') || 
                       name.includes('cabin') || roomType.includes('entire')
              }
              
              if (targetType === 'cabin') {
                // Cabin should match lodges, chalets, retreats
                return name.includes('lodge') || name.includes('chalet') || 
                       name.includes('retreat') || name.includes('cottage')
              }
              
              return false
            },
            `Filtered by property type '${targetType}'`
          )
        }
        
        // Filter by amenities (very lenient - amenity matching is unreliable)
        if (criteria.amenities && criteria.amenities.length > 0) {
          filteredResults = applyFilterWithFallback(
            filteredResults,
            listing => {
              return criteria.amenities!.some((amenity: string) => 
                listing.amenities.some((listingAmenity: string) => 
                  listingAmenity.toLowerCase().includes(amenity.toLowerCase())
                ) || listing.name.toLowerCase().includes(amenity.toLowerCase())
              )
            },
            `Filtered by amenities [${criteria.amenities.join(', ')}]`
          )
        }
        
        // Filter by superhost requirement (lenient)
        if (criteria.rating?.superhost) {
          filteredResults = applyFilterWithFallback(
            filteredResults,
            listing => listing.host.isSuperhost,
            `Filtered by superhost requirement`
          )
        }
        
        // Filter by review count (lenient - review count can be unreliable)
        if (criteria.rating?.reviewCount) {
          filteredResults = applyFilterWithFallback(
            filteredResults,
            listing => listing.reviewsCount >= criteria.rating!.reviewCount!,
            `Filtered by minimum ${criteria.rating.reviewCount} reviews`
          )
        }
        
        // Smart bedroom filtering using heuristics (lenient - bedroom data is unreliable)
        if (criteria.bedrooms) {
          filteredResults = applyFilterWithFallback(
            filteredResults,
            listing => {
              const roomType = listing.roomType.toLowerCase()
              const name = listing.name.toLowerCase()
              
              // Primary heuristic: Use property type as main signal
              if (criteria.bedrooms === 1) {
                // 1 bedroom: Allow private rooms, studios, and entire places
                return true // Don't filter out for 1 bedroom requests
              } else if (criteria.bedrooms >= 2) {
                // 2+ bedrooms: Strongly prefer entire homes/apartments
                if (!roomType.includes('entire')) {
                  // Check if name explicitly mentions multiple bedrooms
                  const hasMultiBedInName = /\b([2-9]|[1-9][0-9]+)\s*(bed|br)\b/i.test(name)
                  if (!hasMultiBedInName) {
                    return false // Filter out non-entire places without explicit multi-bed mention
                  }
                }
              }
              
              // Secondary heuristic: Basic name parsing with fallbacks
              const bedroomMatch = name.match(/\b(\d+)\s*(bed|br|bedroom)\b/i)
              if (bedroomMatch) {
                const nameBedroomCount = parseInt(bedroomMatch[1])
                return nameBedroomCount >= criteria.bedrooms!
              }
              
              // Fallback: If we can't determine bedroom count but it's an entire place, allow it
              return roomType.includes('entire')
            },
            `Smart bedroom filtering (${criteria.bedrooms}+ bedrooms)`
          )
        }
        
        // Smart bathroom filtering using heuristics (very lenient - bathroom data is unreliable)
        if (criteria.bathrooms) {
          filteredResults = applyFilterWithFallback(
            filteredResults,
            listing => {
              const name = listing.name.toLowerCase()
              const roomType = listing.roomType.toLowerCase()
              
              // Try to parse bathroom count from name
              const bathroomMatch = name.match(/\b(\d+(?:\.5)?|\d+\s*1\/2)\s*(bath|bathroom)\b/i)
              if (bathroomMatch) {
                let nameBathroomCount = parseFloat(bathroomMatch[1].replace(/\s*1\/2/, '.5'))
                return nameBathroomCount >= criteria.bathrooms!
              }
              
              // Heuristic: For 2+ bathroom requests, prefer entire homes
              if (criteria.bathrooms >= 2) {
                return roomType.includes('entire')
              }
              
              // For 1 bathroom requests, don't filter (most places have at least 1)
              return true
            },
            `Smart bathroom filtering (${criteria.bathrooms}+ bathrooms)`
          )
        }
        
        console.log(`Final filtered results: ${filteredResults.length} out of ${searchResults.length} original results`)
      }
      
      setCurrentPage(page)
      setHasMore(data.hasMore || false)
      setCurrentQuery(query)
      
      // Multi-platform response
      const platformCounts = filteredResults.reduce((acc, listing) => {
        const platform = listing.platform || 'unknown'
        acc[platform] = (acc[platform] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      const platformSummary = Object.entries(platformCounts)
        .map(([platform, count]) => `${count} from ${platform}`)
        .join(', ')
      
      let responseContent = `Found ${filteredResults.length} properties in ${extractedLocation}`
      if (filteredResults.length > 0) {
        responseContent += ` (${platformSummary}). Check the results panel →`  
      }
      
      // Generate intelligent refinement suggestions based on search results
      const followUpSuggestions: string[] = []
      let refinementSuggestions: RefinementSuggestion[] = []
      
      if (filteredResults.length > 0) {
        try {
          const analyzer = new RefinementAnalyzer(filteredResults)
          refinementSuggestions = analyzer.generateRefinementSuggestions(query)
          console.log('Generated refinement suggestions:', refinementSuggestions)
        } catch (error) {
          console.error('Failed to generate refinement suggestions:', error)
        }
      }
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: responseContent,
        followUps: followUpSuggestions,
        refinementSuggestions: refinementSuggestions,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMessage])
      setTimeout(scrollToBottom, 100)

      setCurrentResults(filteredResults)
      setShowResults(true)
      addToHistory(query, filteredResults.length)
      
      // Store current dates if they were used for filtering
      if (queryAnalysis?.extractedCriteria?.dates?.checkin && queryAnalysis?.extractedCriteria?.dates?.checkout) {
        setCurrentDates({
          checkin: queryAnalysis.extractedCriteria.dates.checkin,
          checkout: queryAnalysis.extractedCriteria.dates.checkout,
          flexible: queryAnalysis.extractedCriteria.dates.flexible || false
        })
      } else {
        setCurrentDates(null)
      }
      
      // Store current price range if it was used for filtering
      if (queryAnalysis?.extractedCriteria?.priceRange && 
          (queryAnalysis.extractedCriteria.priceRange.min || 
           queryAnalysis.extractedCriteria.priceRange.max || 
           queryAnalysis.extractedCriteria.priceRange.budget)) {
        setCurrentPriceRange({
          min: queryAnalysis.extractedCriteria.priceRange.min,
          max: queryAnalysis.extractedCriteria.priceRange.max,
          budget: queryAnalysis.extractedCriteria.priceRange.budget
        })
      } else {
        setCurrentPriceRange(null)
      }
      
      // Set quick filters for the results panel - include more options
      setQuickFilters(refinementSuggestions.slice(0, 12)) // Show up to 12 quick filters

    } catch (error) {
      // Add error message with more details for debugging
      console.error('Search error details:', error)
      
      let errorContent = 'Sorry, I had trouble searching for properties. Please try again.'
      
      // Provide more specific error messages based on the error
      if (error instanceof Error) {
        if (error.message.includes('Location is required')) {
          errorContent = 'I couldn\'t identify a location in your search. Could you please specify where you\'d like to stay?'
        } else if (error.message.includes('filter refinement')) {
          errorContent = 'This seems like a refinement request, but I need a location first. Where would you like to search?'
        }
        console.error('Search API error:', error.message)
      }
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: errorContent,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
      setTimeout(scrollToBottom, 100)
    } finally {
      setLoading(false)
    }
  }

  const handleNextPage = () => {
    if (hasMore && !loading && currentQuery) {
      handleSearch(currentPage + 1)
    }
  }

  const handlePrevPage = () => {
    if (currentPage > 1 && !loading && currentQuery) {
      handleSearch(currentPage - 1)
    }
  }

  // Handle refinement queries directly without setting input box
  const handleRefinementQuery = (query: string) => {
    if (loading) return
    handleSearch(1, query)
  }


  return (
    <Box 
      h="100vh" 
      bg="#E0F7F4" 
      display="flex" 
      flexDirection="row"
      position="relative"
      overflow="hidden"
    >
      {/* Subtle Background Decorative Elements */}
      <Box
        position="absolute"
        top="10%"
        left="15%"
        width="80px"
        height="80px"
        borderRadius="50%"
        bg="linear-gradient(135deg, #FF6B6B20, #FF8E5330)"
        opacity={0.3}
        zIndex={0}
      />
      <Box
        position="absolute"
        top="60%"
        right="20%"
        width="60px"
        height="60px"
        borderRadius="20px"
        bg="linear-gradient(45deg, #4ECDC420, #E0F7F430)"
        opacity={0.4}
        zIndex={0}
        transform="rotate(45deg)"
      />
      <Box
        position="absolute"
        bottom="20%"
        left="5%"
        width="40px"
        height="120px"
        borderRadius="20px"
        bg="linear-gradient(180deg, #FFE8D620, #FFEEE630)"
        opacity={0.3}
        zIndex={0}
        transform="rotate(-15deg)"
      />
      <Box
        position="absolute"
        top="30%"
        right="5%"
        width="50px"
        height="50px"
        bg="linear-gradient(90deg, #FF8E5320, #4ECDC420)"
        opacity={0.25}
        zIndex={0}
        clipPath="polygon(50% 0%, 0% 100%, 100% 100%)"
      />
      <Box
        position="absolute"
        bottom="40%"
        right="35%"
        width="70px"
        height="30px"
        borderRadius="15px"
        bg="linear-gradient(135deg, #E0F7F425, #FFE5E525)"
        opacity={0.35}
        zIndex={0}
        transform="rotate(25deg)"
      />
      <Box
        position="absolute"
        top="5%"
        right="40%"
        width="35px"
        height="35px"
        borderRadius="50%"
        bg="#FF6B6B15"
        opacity={0.4}
        zIndex={0}
      />
      {/* Main Sidebar */}
      <Box
        position="relative"
        zIndex={1} 
        w={showSidebar ? "300px" : "60px"} 
        bg="#FFEEE6" 
        borderRight="1px" 
        borderColor="#E6D5CC"
        transition="width 0.3s ease"
        display="flex"
        flexDirection="column"
      >
        {/* Sidebar Header */}
        <Box p={3} borderBottom="1px" borderColor="#E6D5CC">
          {showSidebar ? (
            <VStack align="stretch" gap={3}>
              <HStack justify="space-between" align="center">
                <HStack gap={2}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowSidebar(!showSidebar)}
                    color="#CC6B2E"
                    _hover={{ bg: "#FFE8D6" }}
                    px={2}
                  >
                    <Icon as={Menu} w={4} h={4} />
                  </Button>
                  
                  <Text 
                    fontSize="lg" 
                    fontWeight="600" 
                    color="gray.800"
                    cursor="pointer"
                    onClick={() => window.location.reload()}
                  >
                    ChatBnb
                  </Text>
                </HStack>
              </HStack>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={startNewChat}
                color="#CC6B2E"
                _hover={{ bg: "#FFE8D6" }}
                px={3}
                w="full"
                justifyContent="flex-start"
              >
                <Icon as={Plus} w={4} h={4} mr={2} />
                New chat
              </Button>
            </VStack>
          ) : (
            <VStack gap={2}>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowSidebar(!showSidebar)}
                color="#CC6B2E"
                _hover={{ bg: "#FFE8D6" }}
                px={2}
                w="full"
              >
                <Icon as={Menu} w={4} h={4} />
              </Button>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={startNewChat}
                color="#CC6B2E"
                _hover={{ bg: "#FFE8D6" }}
                px={2}
                w="full"
              >
                <Icon as={Plus} w={4} h={4} />
              </Button>
            </VStack>
          )}
        </Box>

        {/* Sidebar Content */}
        {showSidebar && (
          <>
            <Box flex="1" overflow="auto" p={3}>
              <VStack align="stretch" gap={2}>
                <Text fontSize="xs" fontWeight="500" color="gray.500" textTransform="uppercase" mb={2}>
                  Recent Searches
                </Text>
                
                {searchHistory.length === 0 ? (
                  <Text fontSize="sm" color="gray.500" textAlign="center" mt={4}>
                    No searches yet
                  </Text>
                ) : (
                  searchHistory.map((item) => (
                    <Box
                      key={item.id}
                      p={3}
                      bg="#FFE8D6"
                      borderRadius="md"
                      cursor="pointer"
                      _hover={{ bg: "#FFDDCC" }}
                      onClick={() => {
                        setSearchQuery(item.query)
                        setShowSidebar(false)
                      }}
                    >
                      <Text fontSize="sm" color="gray.800" lineHeight="1.4" lineClamp={2}>
                        {item.query}
                      </Text>
                      <HStack justify="space-between" mt={2}>
                        <HStack gap={1}>
                          <Icon as={Clock} w={3} h={3} color="gray.400" />
                          <Text fontSize="xs" color="gray.500">
                            {item.timestamp.toLocaleDateString()}
                          </Text>
                        </HStack>
                        <Text fontSize="xs" color="gray.500">
                          {item.resultCount} results
                        </Text>
                      </HStack>
                    </Box>
                  ))
                )}
              </VStack>
            </Box>
            
            {searchHistory.length > 0 && (
              <Box p={3} borderTop="1px" borderColor="#E6D5CC">
                <Button
                  size="sm"
                  variant="outline"
                  w="full"
                  onClick={clearHistory}
                  borderColor="#E6D5CC"
                  color="#CC6B2E"
                  _hover={{ bg: "#FFE8D6" }}
                >
                  Clear History
                </Button>
              </Box>
            )}
          </>
        )}
      </Box>

      {/* Main Chat Content */}
      <Box flex="1" display="flex" flexDirection="column" minW="0" position="relative" zIndex={1}>
        {/* Header with controls */}
        <Box p={3} borderBottom="1px" borderColor="#E6D5CC" bg="white">
          <HStack justify="space-between" align="center">
            <HStack gap={3} align="center">
              {currentQuery && (
                <Text fontSize="sm" color="gray.600" maxW="2xl" lineClamp={1}>
                  {currentQuery}
                </Text>
              )}
            </HStack>
            
            {currentResults.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowResults(!showResults)}
                borderColor="#E6D5CC"
                color="#CC6B2E"
                _hover={{ bg: "#FFE8D6" }}
              >
                <Icon as={Home} w={4} h={4} mr={2} />
                {showResults ? 'Hide Results' : 'Show Results'} ({currentResults.length})
              </Button>
            )}
          </HStack>
        </Box>

        {/* Chat Messages */}
        <Box 
          flex="1" 
          overflow="auto" 
          ref={chatContainerRef}
          display="flex"
          flexDirection="column"
        >
        {messages.length === 0 ? (
          <Flex flex="1" align="center" justify="center" direction="column" px={4}>
            <Box textAlign="center" mb={12}>
              <HStack justify="center" mb={4}>
                <Icon as={Home} w={8} h={8} color="gray.600" />
                <Text fontSize="3xl" color="gray.800" fontWeight="500">
                  ChatBnb
                </Text>
              </HStack>
              <Text fontSize="lg" color="gray.500" mb={12} maxW="md" mx="auto" lineHeight="1.6">
                Describe what you're looking for in plain English
              </Text>
            </Box>

            {/* Chat Input - Centered */}
            <Box w="full" maxW="2xl" mb={8}>
              <HStack gap={3}>
                <Textarea
                  placeholder="Beach house in Malibu, dog-friendly cabin, modern loft downtown..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSearch()
                    }
                  }}
                  resize="none"
                  minH="52px"
                  maxH="120px"
                  bg="white"
                  border="2px"
                  borderColor="gray.400"
                  _focus={{
                    borderColor: "#4ECDC4",
                    boxShadow: "0 0 0 3px rgba(78, 205, 196, 0.1)"
                  }}
                  _hover={{ borderColor: "#FF8E53" }}
                  borderRadius="xl"
                  py={4}
                  px={4}
                  fontSize="md"
                />
                <Button
                  onClick={() => handleSearch()}
                  disabled={!searchQuery.trim() || loading}
                  size="md"
                  bg="#4ECDC4"
                  color="white"
                  _hover={{ bg: "#3FB8B3" }}
                  _disabled={{ 
                    bg: "gray.300",
                    color: "gray.500"
                  }}
                  borderRadius="xl"
                  px={6}
                  h="52px"
                >
                  <Icon as={Send} w={4} h={4} />
                </Button>
              </HStack>
            </Box>

            {/* Example searches */}
            <Box textAlign="center">
              <Text fontSize="sm" color="gray.500" mb={4}>Ask complex questions in plain English:</Text>
              <Flex gap={3} flexWrap="wrap" justify="center" maxW="4xl">
                {[
                  "Luxury beachfront villa in Malibu for 6 people with pool, superhost only",
                  "Dog-friendly cabin near Yellowstone under $150 with 4.8+ rating", 
                  "Modern downtown loft in Chicago with parking, entire home under $200",
                  "Family cottage near Disney World with kitchen, well-reviewed, quiet area",
                  "Romantic getaway in Napa Valley, private hot tub, superhost, luxury only",
                  "Group house in Austin for 10 people, pool table, close to downtown"
                ].map((example) => (
                  <Button
                    key={example}
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchQuery(example)}
                    borderColor="gray.300"
                    color="gray.700"
                    _hover={{ 
                      bg: "gray.50",
                      borderColor: "gray.400"
                    }}
                    borderRadius="md"
                    px={4}
                    py={3}
                    h="auto"
                    whiteSpace="normal"
                    textAlign="left"
                    maxW="300px"
                  >
                    {example}
                  </Button>
                ))}
              </Flex>
            </Box>
          </Flex>
        ) : (
          <Box maxW="3xl" mx="auto" px={4} py={6} w="full">
            {/* Chat Messages */}
            {messages.map((message) => (
              <Box key={message.id} mb={8}>
              {message.type === 'user' ? (
                <Flex justify="flex-end">
                  <Box
                    bg="#FF6B6B"
                    px={4}
                    py={3}
                    borderRadius="xl"
                    maxW="80%"
                  >
                    <Text fontSize="md" color="white">{message.content}</Text>
                  </Box>
                </Flex>
              ) : (
                <Box>
                  <Text fontSize="md" color="gray.800" mb={4} lineHeight="1.6">
                    {message.content}
                  </Text>
                </Box>
                )}

                
                {/* Legacy Follow-up Suggestions (fallback) */}
                {message.type === 'assistant' && message.followUps && message.followUps.length > 0 && !message.refinementSuggestions && (
                  <Box mt={4}>
                    <Text fontSize="sm" color="gray.600" mb={3}>You might also want to:</Text>
                    <Flex gap={2} flexWrap="wrap">
                      {message.followUps.map((followUp, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          onClick={() => handleRefinementQuery(followUp)}
                          borderColor="#4ECDC4"
                          color="#2E7A73"
                          bg="#E0F7F4"
                          _hover={{ 
                            bg: "#C0F0EC",
                            borderColor: "#3FB8B3",
                            color: "#1F5C57"
                          }}
                          borderRadius="full"
                          px={3}
                          fontSize="xs"
                          fontWeight="500"
                        >
                          {followUp}
                        </Button>
                      ))}
                    </Flex>
                  </Box>
                )}
              </Box>
          ))}

          {/* Loading indicator */}
          {loading && (
            <Box mb={8}>
              <HStack>
                <Spinner size="sm" color="#4ECDC4" />
                <Text fontSize="md" color="gray.600">Searching for properties...</Text>
              </HStack>
            </Box>
          )}

            <div ref={messagesEndRef} />
          </Box>
        )}
      </Box>

        {/* Chat Input - Only show when there are messages */}
        {messages.length > 0 && (
        <Box bg="white" px={4} py={4} borderTop="1px" borderColor="#E6D5CC">
          <Box maxW="3xl" mx="auto">
            <HStack gap={3}>
              <Textarea
                placeholder="Ask for more properties or refine your search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSearch()
                  }
                }}
                resize="none"
                minH="44px"
                maxH="120px"
                bg="white"
                border="2px"
                borderColor="gray.400"
                _focus={{
                  borderColor: "#4ECDC4",
                  boxShadow: "0 0 0 3px rgba(78, 205, 196, 0.1)"
                }}
                _hover={{ borderColor: "#FF8E53" }}
                borderRadius="xl"
                py={3}
                px={4}
                fontSize="md"
              />
              <Button
                onClick={() => handleSearch()}
                disabled={!searchQuery.trim() || loading}
                size="md"
                bg="#4ECDC4"
                color="white"
                _hover={{ bg: "#3FB8B3" }}
                _disabled={{ 
                  bg: "gray.300",
                  color: "gray.500"
                }}
                borderRadius="xl"
                px={4}
                h="44px"
              >
                <Icon as={Send} w={4} h={4} />
              </Button>
            </HStack>
          </Box>
        </Box>
      )}
      </Box>

      {/* Results Panel */}
      <Box
        position="relative"
        zIndex={1} 
        w={showResults ? "800px" : "0"} 
        bg="white" 
        borderLeft="1px" 
        borderColor="#E6D5CC"
        transition="width 0.3s ease"
        overflow="hidden"
        display="flex"
        flexDirection="column"
      >
        {showResults && (
          <>
            <Box p={3} borderBottom="1px" borderColor="#E6D5CC">
              <HStack justify="space-between" align="center" mb={2}>
                <VStack align="start" gap={1} spacing={1}>
                  <HStack gap={2}>
                    <Icon as={Home} w={3} h={3} color="gray.600" />
                    <Text fontSize="sm" fontWeight="500" color="gray.700">
                      Properties ({currentResults.length})
                    </Text>
                  </HStack>
                  {/* Compact info row */}
                  <HStack gap={3} flexWrap="wrap" fontSize="xs" color="gray.600">
                    {/* Platform count */}
                    {currentResults.length > 0 && (
                      <Text>
                        {Object.entries(
                          currentResults.reduce((acc, listing) => {
                            const platform = listing.platform || 'unknown'
                            acc[platform] = (acc[platform] || 0) + 1
                            return acc
                          }, {} as Record<string, number>)
                        ).map(([platform, count]) => 
                          `${count} ${platform === 'airbnb' ? 'Airbnb' : platform}`
                        ).join(', ')}
                      </Text>
                    )}
                    
                    {/* Date Filter Indicator */}
                    {currentDates && currentDates.checkin && currentDates.checkout && (
                      <HStack gap={1}>
                        <Icon as={Calendar} w={3} h={3} color="#4ECDC4" />
                        <Text color="#2E7A73">
                          {new Date(currentDates.checkin).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(currentDates.checkout).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {currentDates.flexible && ' (flexible)'}
                        </Text>
                      </HStack>
                    )}
                    
                    {/* Price Filter Indicator */}
                    {currentPriceRange && (currentPriceRange.min || currentPriceRange.max || currentPriceRange.budget) && (
                      <HStack gap={1}>
                        <Icon as={DollarSign} w={3} h={3} color="#FF8E53" />
                        <Text color="#CC6B2E">
                          {currentPriceRange.budget ? (
                            <Text as="span" textTransform="capitalize">{currentPriceRange.budget} range</Text>
                          ) : (
                            <>
                              {currentPriceRange.min ? `$${currentPriceRange.min}` : '$0'} - {currentPriceRange.max ? `$${currentPriceRange.max}` : 'unlimited'}/night
                            </>
                          )}
                        </Text>
                      </HStack>
                    )}
                  </HStack>
                </VStack>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => setShowResults(false)}
                  color="#8B9DC3"
                  _hover={{ bg: "#F5F7FA" }}
                >
                  <Icon as={X} w={3} h={3} />
                </Button>
              </HStack>
              
              {/* Compact Quick Filters */}
              {quickFilters.length > 0 && (
                <Box>
                  <HStack mb={2} align="center">
                    <Icon as={Filter} w={3} h={3} color="#4ECDC4" />
                    <Text fontSize="sm" fontWeight="500" color="gray.700">
                      Quick filters ({quickFilters.length})
                    </Text>
                  </HStack>
                  <Grid templateColumns="repeat(auto-fit, minmax(140px, 1fr))" gap={2}>
                    {quickFilters.map((filter, index) => {
                      const getIcon = () => {
                        switch (filter.type) {
                          case 'price': return DollarSign
                          case 'rating': return Star
                          case 'amenity': return Wifi
                          case 'host_type': return Award
                          case 'property_type': return Home
                          default: return Filter
                        }
                      }
                      
                      const getColor = () => {
                        switch (filter.priority) {
                          case 'high': return { main: '#4ECDC4', light: '#E0F7F4', dark: '#2E7A73' }
                          case 'medium': return { main: '#FF8E53', light: '#FFE8D6', dark: '#CC6B2E' }
                          default: return { main: '#FF6B6B', light: '#FFE5E5', dark: '#CC5555' }
                        }
                      }
                      
                      const color = getColor()
                      
                      return (
                        <Button
                          key={index}
                          size="xs"
                          variant="outline"
                          onClick={() => handleRefinementQuery(filter.query)}
                          borderColor={color.main}
                          color={color.dark}
                          bg={color.light}
                          _hover={{ 
                            bg: color.light,
                            borderColor: color.dark,
                            transform: 'translateY(-1px)'
                          }}
                          borderRadius="md"
                          px={2}
                          py={1}
                          h="auto"
                          whiteSpace="normal"
                          textAlign="left"
                          transition="all 0.2s"
                          flexDirection="column"
                          alignItems="flex-start"
                        >
                          <HStack w="full" justify="space-between">
                            <HStack gap={1}>
                              <Icon as={getIcon()} w={2} h={2} />
                              <Text fontSize="xs" fontWeight="500" lineHeight="1.2">
                                {filter.label}
                              </Text>
                            </HStack>
                            <Text fontSize="xs" color={color.main} fontWeight="500">
                              {filter.count}
                            </Text>
                          </HStack>
                        </Button>
                      )
                    })}
                  </Grid>
                </Box>
              )}
            </Box>
            
            <Box flex="1" overflow="auto" p={4}>
              {currentResults.length === 0 ? (
                <Text fontSize="sm" color="gray.500" textAlign="center" mt={4}>
                  No properties to display
                </Text>
              ) : (
                <Grid templateColumns="repeat(3, 1fr)" gap={4}>
                  {currentResults.map((listing) => (
                    <Box
                      key={listing.id}
                      border="1px"
                      borderColor="#E6D5CC"
                      borderRadius="md"
                      overflow="hidden"
                      bg="#FFEEE6"
                      _hover={{ 
                        borderColor: '#E6D5CC',
                        bg: 'white'
                      }}
                      transition="all 0.2s"
                    >
                      {/* Property Image */}
                      <Box 
                        h="120px" 
                        bg="#F0F8F7" 
                        position="relative"
                        overflow="hidden"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                      >
                        {listing.images && listing.images.length > 0 ? (
                          <>
                            <img
                              src={listing.images[0]}
                              alt={listing.name}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                objectPosition: 'center'
                              }}
                              onLoad={() => {
                                console.log(`✅ Image loaded successfully: ${listing.images[0]}`)
                              }}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                console.error(`❌ Image failed to load: ${target.src}`)
                                target.style.display = 'none'
                                // Show placeholder when image fails
                                const parent = target.parentElement
                                if (parent) {
                                  const placeholder = parent.querySelector('.image-placeholder') as HTMLElement
                                  if (placeholder) {
                                    placeholder.style.display = 'flex'
                                  }
                                }
                              }}
                            />
                            {/* Fallback placeholder (hidden by default) */}
                            <Box
                              className="image-placeholder"
                              w="full"
                              h="full"
                              display="none"
                              alignItems="center"
                              justifyContent="center"
                              bg="#E0F7F4"
                              color="#8B9DC3"
                              position="absolute"
                              top={0}
                              left={0}
                            >
                              <VStack gap={1}>
                                <Icon as={Home} w={6} h={6} />
                                <Text fontSize="xs" fontWeight="500">
                                  {listing.platform === 'airbnb' ? 'Airbnb' :
                                   listing.platform === 'booking' ? 'Booking' :
                                   listing.platform === 'vrbo' ? 'VRBO' : 'Property'}
                                </Text>
                              </VStack>
                            </Box>
                            {/* Image overlay with additional info */}
                            {listing.images.length > 1 && (
                              <Box
                                position="absolute"
                                bottom={2}
                                right={2}
                                bg="blackAlpha.700"
                                color="white"
                                px={2}
                                py={1}
                                borderRadius="md"
                                fontSize="xs"
                                fontWeight="500"
                              >
                                +{listing.images.length - 1} more
                              </Box>
                            )}
                          </>
                        ) : (
                          <Box
                            className="image-placeholder"
                            w="full"
                            h="full"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            bg="#E0F7F4"
                            color="#8B9DC3"
                          >
                            <VStack gap={1}>
                              <Icon as={Home} w={6} h={6} />
                              <Text fontSize="xs" fontWeight="500">
                                {listing.platform === 'airbnb' ? 'Airbnb' :
                                 listing.platform === 'booking' ? 'Booking' :
                                 listing.platform === 'vrbo' ? 'VRBO' : 'Property'}
                              </Text>
                            </VStack>
                          </Box>
                        )}
                      </Box>
                      
                      <Box p={3}>
                        <VStack align="start" gap={2}>
                          <Text fontWeight="600" color="gray.900" lineHeight="1.3" fontSize="sm" lineClamp={2}>
                            {listing.name}
                          </Text>
                          
                          <HStack justify="space-between" w="full">
                            <HStack gap={1}>
                              <Icon as={MapPin} color="gray.400" w={3} h={3} />
                              <Text fontSize="xs" color="gray.600" lineClamp={1}>
                                {listing.location.city}
                              </Text>
                            </HStack>
                            <HStack gap={2}>
                              <HStack gap={1}>
                                <Icon as={Star} color="yellow.400" w={3} h={3} />
                                <Text fontSize="xs" color="gray.600">
                                  {listing.rating} ({listing.reviewsCount})
                                </Text>
                              </HStack>
                              
                              {/* Trust Score Badge */}
                              {listing.trustScore !== undefined && (
                                <Box
                                  px={2}
                                  py={1}
                                  borderRadius="full"
                                  fontSize="xs"
                                  fontWeight="600"
                                  bg={
                                    listing.trustScore >= 80 ? '#E0F7F4' :
                                    listing.trustScore >= 60 ? '#FFE8D6' : '#FFE5E5'
                                  }
                                  color={
                                    listing.trustScore >= 80 ? '#2E7A73' :
                                    listing.trustScore >= 60 ? '#CC6B2E' : '#CC5555'
                                  }
                                  title={`Trust Score: ${listing.trustScore}/100 based on rating and review count`}
                                >
                                  <HStack gap={1}>
                                    <Icon as={Shield} w={3} h={3} />
                                    <Text>{listing.trustScore}</Text>
                                  </HStack>
                                </Box>
                              )}
                            </HStack>
                          </HStack>

                          {/* Property details: bedrooms and bathrooms */}
                          <HStack gap={4} color="gray.600">
                            {listing.bedrooms !== undefined && listing.bedrooms > 0 && (
                              <HStack gap={1}>
                                <Icon as={Bed} w={3} h={3} />
                                <Text fontSize="xs">
                                  {listing.bedrooms} {listing.bedrooms === 1 ? 'bed' : 'beds'}
                                </Text>
                              </HStack>
                            )}
                            {listing.bathrooms !== undefined && listing.bathrooms > 0 && (
                              <HStack gap={1}>
                                <Icon as={Bath} w={3} h={3} />
                                <Text fontSize="xs">
                                  {listing.bathrooms} {listing.bathrooms === 1 ? 'bath' : 'baths'}
                                </Text>
                              </HStack>
                            )}
                            <HStack gap={1}>
                              <Icon as={Building} w={3} h={3} color="gray.400" />
                              <Text fontSize="xs" color="gray.500">
                                {listing.propertyType || listing.roomType}
                              </Text>
                            </HStack>
                          </HStack>

                          <HStack justify="space-between" w="full" align="center">
                            <VStack align="start" gap={0}>
                              <Text fontWeight="600" color="gray.900" fontSize="sm">
                                ${listing.price.rate}/night
                              </Text>
                            </VStack>
                            
                            <VStack align="end" gap={1}>
                              {listing.host.isSuperhost && (
                                <HStack gap={1}>
                                  <Icon as={Crown} w={2} h={2} color="yellow.400" />
                                  <Text fontSize="xs" color="gray.500">Host</Text>
                                </HStack>
                              )}
                              <Link href={listing.url} target="_blank" rel="noopener noreferrer">
                                <Button
                                  size="xs"
                                  variant="outline"
                                  borderColor="#4ECDC4"
                                  color="#2E7A73"
                                  _hover={{ bg: "#E0F7F4" }}
                                >
                                  View
                                  <Icon as={ExternalLink} ml={1} w={2} h={2} />
                                </Button>
                              </Link>
                            </VStack>
                          </HStack>
                        </VStack>
                      </Box>
                    </Box>
                  ))}
                </Grid>
              )}
            </Box>
            
            {/* Pagination in results panel */}
            {currentResults.length > 0 && (
              <Box p={3} borderTop="1px" borderColor="#E6D5CC">
                <Flex justify="space-between" align="center">
                  <Text fontSize="xs" color="gray.500">
                    Page {currentPage}
                  </Text>
                  <HStack gap={1}>
                    <Button 
                      size="xs" 
                      variant="outline"
                      onClick={handlePrevPage}
                      disabled={currentPage === 1 || loading}
                      borderColor="#E6D5CC"
                      _hover={{ bg: "#FFE8D6" }}
                    >
                      ←
                    </Button>
                    <Button 
                      size="xs" 
                      variant="outline"
                      onClick={handleNextPage}
                      disabled={!hasMore || loading}
                      borderColor="#E6D5CC"
                      _hover={{ bg: "#FFE8D6" }}
                    >
                      →
                    </Button>
                  </HStack>
                </Flex>
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  )
}

export default App