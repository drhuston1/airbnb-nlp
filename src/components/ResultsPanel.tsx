import { 
  Box, 
  VStack, 
  Text, 
  SimpleGrid, 
  Image, 
  Badge, 
  HStack, 
  Icon,
  Spinner,
  Center,
  Button,
  Flex,
  Tooltip,
  Collapse,
  useDisclosure
} from '@chakra-ui/react'
import { Star, User, ExternalLink, MapPin, Bed, Bath, Shield, AlertTriangle, ThumbsUp, ChevronDown, ChevronUp } from 'lucide-react'
import type { AirbnbListing } from '../types'
import { useState } from 'react'

interface ResultsPanelProps {
  listings: AirbnbListing[]
  isLoading: boolean
  hasSearched: boolean
  onListingClick: (listing: AirbnbListing) => void
}

export const ResultsPanel = ({ 
  listings, 
  isLoading, 
  hasSearched, 
  onListingClick 
}: ResultsPanelProps) => {
  if (isLoading) {
    return (
      <Box ml="400px" p={8}>
        <Center h="50vh">
          <VStack gap={4}>
            <Spinner size="xl" color="green.500" />
            <Text color="gray.600">Searching for properties...</Text>
          </VStack>
        </Center>
      </Box>
    )
  }

  if (!hasSearched) {
    return (
      <Box ml="400px" p={8}>
        <Center h="50vh">
          <VStack gap={4} textAlign="center">
            <Icon as={MapPin} w={12} h={12} color="gray.400" />
            <Text fontSize="lg" color="gray.600">Ready to find your perfect stay?</Text>
            <Text color="gray.500">Use the search box to explore Airbnb properties</Text>
          </VStack>
        </Center>
      </Box>
    )
  }

  if (listings.length === 0) {
    return (
      <Box ml="400px" p={8}>
        <Center h="50vh">
          <VStack gap={4} textAlign="center">
            <Text fontSize="lg" color="gray.600">No properties found</Text>
            <Text color="gray.500">Try adjusting your search criteria</Text>
          </VStack>
        </Center>
      </Box>
    )
  }

  return (
    <Box ml="400px" p={6}>
      <Text fontSize="xl" fontWeight="bold" mb={6} color="gray.800">
        Found {listings.length} properties
      </Text>
      
      <SimpleGrid columns={{ base: 1, lg: 2, xl: 3 }} gap={6}>
        {listings.map((listing) => {
          const { isOpen: isReviewOpen, onToggle: onReviewToggle } = useDisclosure()
          const [reviewInsights, setReviewInsights] = useState(listing.reviewInsights)
          const [loadingInsights, setLoadingInsights] = useState(false)
          
          const loadReviewInsights = async () => {
            if (reviewInsights || loadingInsights) return
            
            setLoadingInsights(true)
            try {
              const response = await fetch('/api/get-review-insights', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  listingId: listing.id,
                  listingUrl: listing.url
                })
              })
              
              if (response.ok) {
                const data = await response.json()
                if (data.success) {
                  setReviewInsights(data.reviewInsights)
                }
              }
            } catch (error) {
              console.error('Failed to load review insights:', error)
            } finally {
              setLoadingInsights(false)
            }
          }
          
          return (
            <Box
              key={listing.id}
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
              onClick={() => onListingClick(listing)}
            >
            <Image
              src={listing.images[0]}
              alt={listing.name}
              h="200px"
              w="100%"
              objectFit="cover"
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
                      {listing.rating}
                    </Text>
                    <Text fontSize="sm" color="gray.500">
                      ({listing.reviewsCount} reviews)
                    </Text>
                  </HStack>
                  
                  {/* Trust Score Badge */}
                  {listing.trustScore !== undefined && (
                    <Tooltip 
                      label={`Trust Score: ${listing.trustScore}/100 based on rating consistency and review count`}
                      placement="top"
                    >
                      <Badge 
                        colorScheme={
                          listing.trustScore >= 80 ? "green" : 
                          listing.trustScore >= 60 ? "yellow" : "red"
                        }
                        size="sm"
                        variant="subtle"
                      >
                        <HStack gap={1}>
                          <Icon as={Shield} w={3} h={3} />
                          <Text>{listing.trustScore}</Text>
                        </HStack>
                      </Badge>
                    </Tooltip>
                  )}
                </HStack>
                
                {listing.host.isSuperhost && (
                  <Badge colorScheme="green" size="sm">
                    Superhost
                  </Badge>
                )}
              </HStack>
              
              <HStack gap={1} color="gray.600">
                <Icon as={User} w={4} h={4} />
                <Text fontSize="sm">{listing.roomType}</Text>
              </HStack>
              
              {/* Property details: bedrooms and bathrooms */}
              <HStack gap={4} color="gray.600">
                {listing.bedrooms !== undefined && listing.bedrooms > 0 && (
                  <HStack gap={1}>
                    <Icon as={Bed} w={4} h={4} />
                    <Text fontSize="sm">
                      {listing.bedrooms} {listing.bedrooms === 1 ? 'bedroom' : 'bedrooms'}
                    </Text>
                  </HStack>
                )}
                {listing.bathrooms !== undefined && listing.bathrooms > 0 && (
                  <HStack gap={1}>
                    <Icon as={Bath} w={4} h={4} />
                    <Text fontSize="sm">
                      {listing.bathrooms} {listing.bathrooms === 1 ? 'bath' : 'baths'}
                    </Text>
                  </HStack>
                )}
              </HStack>
              
              {/* Review Insights Section */}
              <Box>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!isReviewOpen) {
                      loadReviewInsights()
                    }
                    onReviewToggle()
                  }}
                  leftIcon={
                    loadingInsights ? (
                      <Spinner size="sm" w={4} h={4} />
                    ) : (
                      <Icon as={isReviewOpen ? ChevronUp : ChevronDown} w={4} h={4} />
                    )
                  }
                  color="gray.600"
                  fontSize="sm"
                  p={2}
                  h="auto"
                  isDisabled={loadingInsights}
                >
                  {loadingInsights ? 'Loading...' : 'Review Insights'}
                </Button>
                  
                  <Collapse in={isReviewOpen} animateOpacity>
                    <VStack align="stretch" gap={2} mt={2} p={3} bg="gray.50" borderRadius="md">
                      {reviewInsights ? (
                        <>
                          {/* Negative Insights (most important) */}
                          {reviewInsights.negativeInsights?.length > 0 && (
                            <Box>
                              <HStack gap={1} mb={1}>
                                <Icon as={AlertTriangle} w={3} h={3} color="orange.500" />
                                <Text fontSize="xs" fontWeight="semibold" color="orange.600">
                                  Things to Consider
                                </Text>
                              </HStack>
                              {reviewInsights.negativeInsights.slice(0, 2).map((insight, i) => (
                                <Text key={i} fontSize="xs" color="gray.700" pl={4}>
                                  • {insight}
                                </Text>
                              ))}
                            </Box>
                          )}
                          
                          {/* Positive Highlights */}
                          {reviewInsights.positiveHighlights?.length > 0 && (
                            <Box>
                              <HStack gap={1} mb={1}>
                                <Icon as={ThumbsUp} w={3} h={3} color="green.500" />
                                <Text fontSize="xs" fontWeight="semibold" color="green.600">
                                  Highlights
                                </Text>
                              </HStack>
                              {reviewInsights.positiveHighlights.slice(0, 2).map((highlight, i) => (
                                <Text key={i} fontSize="xs" color="gray.700" pl={4}>
                                  • {highlight}
                                </Text>
                              ))}
                            </Box>
                          )}
                          
                          {/* Common Concerns */}
                          {reviewInsights.commonConcerns?.length > 0 && (
                            <Box>
                              <Text fontSize="xs" fontWeight="semibold" color="gray.600" mb={1}>
                                Common Mentions
                              </Text>
                              {reviewInsights.commonConcerns.slice(0, 2).map((concern, i) => (
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
                  </Collapse>
                </Box>
              
              <Flex justify="space-between" align="center">
                <VStack align="start" gap={0}>
                  <Text fontWeight="bold" fontSize="lg">
                    ${listing.price.rate}
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    per night
                  </Text>
                </VStack>
                
                <Button
                  size="sm"
                  variant="outline"
                  colorScheme="green"
                  onClick={(e) => {
                    e.stopPropagation()
                    window.open(listing.url, '_blank')
                  }}
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
        })}
      </SimpleGrid>
    </Box>
  )
}