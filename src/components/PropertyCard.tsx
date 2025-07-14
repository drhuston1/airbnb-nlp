import React, { useState, useCallback, useMemo } from 'react'
import {
  Box,
  VStack,
  Text,
  Image,
  Badge,
  HStack,
  Icon,
  Spinner,
  Button,
  Flex
} from '@chakra-ui/react'
import { 
  Star, 
  User, 
  ExternalLink, 
  MapPin, 
  Bed, 
  Bath, 
  Shield, 
  AlertTriangle, 
  ThumbsUp, 
  ChevronDown, 
  ChevronUp 
} from 'lucide-react'
import type { AirbnbListing } from '../types'

interface PropertyCardProps {
  listing: AirbnbListing
  onListingClick: (listing: AirbnbListing) => void
}

interface ReviewInsightsState {
  isOpen: boolean
  data: AirbnbListing['reviewInsights'] | null
  isLoading: boolean
}

// Memoized sub-components for better performance
const TrustScoreBadge = React.memo(({ trustScore }: { trustScore?: number }) => {
  const colorScheme = useMemo(() => {
    if (!trustScore) return 'gray'
    if (trustScore >= 80) return 'green'
    if (trustScore >= 60) return 'yellow'
    return 'red'
  }, [trustScore])

  if (trustScore === undefined) return null

  return (
    <Badge 
      colorScheme={colorScheme}
      size="sm"
      variant="subtle"
      title={`Trust Score: ${trustScore}/100 based on rating consistency and review count`}
    >
      <HStack gap={1}>
        <Icon as={Shield} w={3} h={3} />
        <Text>{trustScore}</Text>
      </HStack>
    </Badge>
  )
})

const PropertyDetails = React.memo(({ 
  bedrooms, 
  bathrooms 
}: { 
  bedrooms?: number
  bathrooms?: number 
}) => {
  const hasDetails = (bedrooms && bedrooms > 0) || (bathrooms && bathrooms > 0)
  
  if (!hasDetails) return null

  return (
    <HStack gap={4} color="gray.600">
      {bedrooms !== undefined && bedrooms > 0 && (
        <HStack gap={1}>
          <Icon as={Bed} w={4} h={4} />
          <Text fontSize="sm">
            {bedrooms} {bedrooms === 1 ? 'bedroom' : 'bedrooms'}
          </Text>
        </HStack>
      )}
      {bathrooms !== undefined && bathrooms > 0 && (
        <HStack gap={1}>
          <Icon as={Bath} w={4} h={4} />
          <Text fontSize="sm">
            {bathrooms} {bathrooms === 1 ? 'bath' : 'baths'}
          </Text>
        </HStack>
      )}
    </HStack>
  )
})

const ReviewInsightsSection = React.memo(({ 
  insights,
  isOpen,
  isLoading,
  onToggle,
  onLoad
}: {
  insights: AirbnbListing['reviewInsights'] | null
  isOpen: boolean
  isLoading: boolean
  onToggle: () => void
  onLoad: () => void
}) => {
  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isOpen) {
      onLoad()
    }
    onToggle()
  }, [isOpen, onLoad, onToggle])

  return (
    <Box>
      <Button
        size="sm"
        variant="ghost"
        onClick={handleToggle}
        color="gray.600"
        fontSize="sm"
        p={2}
        h="auto"
        disabled={isLoading}
      >
        <HStack gap={1}>
          {isLoading ? (
            <Spinner size="sm" w={4} h={4} />
          ) : (
            <Icon as={isOpen ? ChevronUp : ChevronDown} w={4} h={4} />
          )}
          <Text>{isLoading ? 'Loading...' : 'Review Insights'}</Text>
        </HStack>
      </Button>
        
      {isOpen && (
        <VStack align="stretch" gap={2} mt={2} p={3} bg="gray.50" borderRadius="md">
          {insights ? (
            <>
              {/* Negative Insights */}
              {insights.negativeInsights?.length > 0 && (
                <Box>
                  <HStack gap={1} mb={1}>
                    <Icon as={AlertTriangle} w={3} h={3} color="orange.500" />
                    <Text fontSize="xs" fontWeight="semibold" color="orange.600">
                      Things to Consider
                    </Text>
                  </HStack>
                  {insights.negativeInsights.slice(0, 2).map((insight, i) => (
                    <Text key={i} fontSize="xs" color="gray.700" pl={4}>
                      • {insight}
                    </Text>
                  ))}
                </Box>
              )}
              
              {/* Positive Highlights */}
              {insights.positiveHighlights?.length > 0 && (
                <Box>
                  <HStack gap={1} mb={1}>
                    <Icon as={ThumbsUp} w={3} h={3} color="green.500" />
                    <Text fontSize="xs" fontWeight="semibold" color="green.600">
                      Highlights
                    </Text>
                  </HStack>
                  {insights.positiveHighlights.slice(0, 2).map((highlight, i) => (
                    <Text key={i} fontSize="xs" color="gray.700" pl={4}>
                      • {highlight}
                    </Text>
                  ))}
                </Box>
              )}
              
              {/* Common Concerns */}
              {insights.commonConcerns?.length > 0 && (
                <Box>
                  <Text fontSize="xs" fontWeight="semibold" color="gray.600" mb={1}>
                    Common Mentions
                  </Text>
                  {insights.commonConcerns.slice(0, 2).map((concern, i) => (
                    <Text key={i} fontSize="xs" color="gray.600" pl={2}>
                      • {concern}
                    </Text>
                  ))}
                </Box>
              )}
            </>
          ) : (
            <Text fontSize="xs" color="gray.500" textAlign="center">
              Click to load review insights
            </Text>
          )}
        </VStack>
      )}
    </Box>
  )
})

export const PropertyCard = React.memo(({ 
  listing, 
  onListingClick 
}: PropertyCardProps) => {
  // Local state for review insights
  const [reviewState, setReviewState] = useState<ReviewInsightsState>({
    isOpen: false,
    data: listing.reviewInsights || null,
    isLoading: false
  })

  // Memoized expensive calculations
  const priceDisplay = useMemo(() => `$${listing.price.rate}`, [listing.price.rate])
  
  const ratingDisplay = useMemo(() => ({
    rating: listing.rating,
    reviewText: `(${listing.reviewsCount} reviews)`
  }), [listing.rating, listing.reviewsCount])

  const locationText = useMemo(() => listing.location.city, [listing.location.city])

  // Memoized event handlers
  const handleCardClick = useCallback(() => {
    onListingClick(listing)
  }, [listing, onListingClick])

  const handleViewClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    window.open(listing.url, '_blank')
  }, [listing.url])

  const handleMapClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const query = encodeURIComponent(`${listing.location.city}, ${listing.location.country}`)
    window.open(`https://maps.google.com/maps?q=${query}`, '_blank')
  }, [listing.location.city, listing.location.country])

  const handleReviewToggle = useCallback(() => {
    setReviewState(prev => ({ ...prev, isOpen: !prev.isOpen }))
  }, [])

  const loadReviewInsights = useCallback(async () => {
    if (reviewState.data || reviewState.isLoading) return
    
    setReviewState(prev => ({ ...prev, isLoading: true }))
    
    try {
      const response = await fetch('/api/get-review-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: listing.id,
          listingUrl: listing.url
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setReviewState(prev => ({ 
            ...prev, 
            data: data.reviewInsights,
            isLoading: false 
          }))
          return
        }
      }
    } catch (error) {
      console.error('Failed to load review insights:', error)
    }
    
    setReviewState(prev => ({ ...prev, isLoading: false }))
  }, [listing.id, listing.url, reviewState.data, reviewState.isLoading])

  return (
    <Box
      bg="white"
      borderRadius="xl"
      overflow="hidden"
      border="1px"
      borderColor="gray.200"
      _hover={{ 
        shadow: "lg", 
        borderColor: "green.300",
        transform: "translateY(-2px)"
      }}
      transition="all 0.2s"
      cursor="pointer"
      onClick={handleCardClick}
    >
      <Image
        src={listing.images[0]}
        alt={listing.name}
        h="200px"
        w="100%"
        objectFit="cover"
        loading="lazy"
      />
      
      <VStack p={4} align="stretch" gap={3}>
        <Text fontWeight="semibold" fontSize="md" minH="3em">
          {listing.name}
        </Text>
        
        <HStack justify="space-between">
          <HStack gap={2}>
            <HStack gap={1}>
              <Icon as={Star} w={4} h={4} color="orange.400" />
              <Text fontSize="sm" fontWeight="medium">
                {ratingDisplay.rating}
              </Text>
              <Text fontSize="sm" color="gray.500">
                {ratingDisplay.reviewText}
              </Text>
            </HStack>
            
            <TrustScoreBadge trustScore={listing.trustScore} />
          </HStack>
          
          {listing.host.isSuperhost && (
            <Badge colorScheme="green" size="sm">
              Superhost
            </Badge>
          )}
        </HStack>
        
        <HStack justify="space-between" align="center">
          <HStack gap={1} color="gray.600">
            <Icon as={User} w={4} h={4} />
            <Text fontSize="sm">{listing.roomType}</Text>
          </HStack>
          
          <HStack gap={1} color="gray.500">
            <Icon as={MapPin} w={3} h={3} />
            <Text fontSize="xs">{locationText}</Text>
            <Button
              size="xs"
              variant="ghost"
              p={1}
              minW="auto"
              h="auto"
              onClick={handleMapClick}
              _hover={{ bg: 'blue.50' }}
            >
              <Icon as={ExternalLink} w={3} h={3} color="blue.500" />
            </Button>
          </HStack>
        </HStack>
        
        <PropertyDetails 
          bedrooms={listing.bedrooms} 
          bathrooms={listing.bathrooms} 
        />
        
        <ReviewInsightsSection
          insights={reviewState.data}
          isOpen={reviewState.isOpen}
          isLoading={reviewState.isLoading}
          onToggle={handleReviewToggle}
          onLoad={loadReviewInsights}
        />
        
        <Flex justify="space-between" align="center">
          <VStack align="start" gap={0}>
            <Text fontWeight="bold" fontSize="lg">
              {priceDisplay}
            </Text>
            <Text fontSize="xs" color="gray.500">
              per night
            </Text>
          </VStack>
          
          <Button
            size="sm"
            variant="outline"
            colorScheme="green"
            onClick={handleViewClick}
          >
            <Flex align="center" gap={1}>
              View
              <ExternalLink size={14} />
            </Flex>
          </Button>
        </Flex>
      </VStack>
    </Box>
  )
}, (prevProps, nextProps) => {
  // Custom comparison for optimal re-render prevention
  return (
    prevProps.listing.id === nextProps.listing.id &&
    prevProps.listing.price.rate === nextProps.listing.price.rate &&
    prevProps.listing.rating === nextProps.listing.rating &&
    prevProps.listing.reviewsCount === nextProps.listing.reviewsCount &&
    prevProps.listing.trustScore === nextProps.listing.trustScore &&
    prevProps.onListingClick === nextProps.onListingClick
  )
})

PropertyCard.displayName = 'PropertyCard'
TrustScoreBadge.displayName = 'TrustScoreBadge'
PropertyDetails.displayName = 'PropertyDetails'
ReviewInsightsSection.displayName = 'ReviewInsightsSection'