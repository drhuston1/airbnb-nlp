import { useState, useMemo } from 'react'
import {
  Box,
  Container,
  Heading,
  Text,
  Input,
  Button,
  SimpleGrid,
  Badge,
  HStack,
  Spinner,
  Center,
  Stack,
  Flex,
  Link,
  ButtonGroup,
  Icon
} from '@chakra-ui/react'
import { 
  Search, 
  MapPin, 
  Star, 
  Crown, 
  AlertCircle, 
  Settings,
  ExternalLink 
} from 'lucide-react'
import { searchAirbnbListings, type AirbnbListing } from './services/airbnbService'

function App() {
  const [searchQuery, setSearchQuery] = useState('')
  const [allListings, setAllListings] = useState<AirbnbListing[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  
  // Filter states
  const [minRating, setMinRating] = useState(0)
  const [minReviews, setMinReviews] = useState(0)

  // Filter listings based on client-side criteria
  const filteredListings = useMemo(() => {
    return allListings.filter(listing => 
      listing.rating >= minRating && listing.reviewsCount >= minReviews
    )
  }, [allListings, minRating, minReviews])

  const handleSearch = async (page = 1) => {
    if (!searchQuery.trim()) {
      setError('Please enter a search query')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const searchResults = await searchAirbnbListings(searchQuery, page)
      setAllListings(searchResults)
      setCurrentPage(page)
      setHasMore(searchResults.length === 18) // Assume more if we got full page
    } catch (error) {
      setError('Search failed. Please try again.')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleNextPage = () => {
    if (hasMore && !loading) {
      handleSearch(currentPage + 1)
    }
  }

  const handlePrevPage = () => {
    if (currentPage > 1 && !loading) {
      handleSearch(currentPage - 1)
    }
  }

  return (
    <Box minH="100vh" bg="gray.50" overflow="hidden">
      <Container maxW="7xl" px={{ base: 4, md: 6 }} py={12}>
        <Stack gap={10} align="stretch">
          {/* Hero Section */}
          <Box textAlign="center" py={{ base: 12, md: 16 }}>
            {/* Badge */}
            <Badge 
              colorScheme="blue" 
              variant="subtle" 
              px={4} 
              py={2} 
              borderRadius="full" 
              mb={6}
              fontSize="sm"
              fontWeight="600"
            >
              Powered by AI
            </Badge>
            
            {/* Main Heading */}
            <Heading 
              as="h1" 
              size={{ base: "2xl", md: "3xl", lg: "4xl" }}
              mb={6} 
              fontWeight="900"
              letterSpacing="-0.03em"
              lineHeight="1.1"
            >
              <Text as="span" color="blue.600">
                Airbnb
              </Text>{" "}
              <Text as="span" color="gray.800">in</Text>{" "}
              <Text as="span" 
                bgGradient="linear(to-r, purple.500, pink.500)" 
                bgClip="text"
                color="purple.500"
              >
                Plain English
              </Text>
            </Heading>
            
            {/* Subtitle */}
            <Text 
              fontSize={{ base: "lg", md: "xl" }} 
              color="gray.600" 
              maxW="3xl" 
              mx="auto" 
              lineHeight="1.6" 
              mb={8}
              fontWeight="400"
            >
              Skip the complex filters. Just tell us what you're looking for and we'll find the perfect Airbnb properties for you.
            </Text>
            
            {/* Feature highlights */}
            <HStack 
              justify="center" 
              gap={8} 
              mb={10}
              flexWrap="wrap"
              fontSize="sm"
              color="gray.600"
            >
              <HStack>
                <Icon as={Search} color="blue.500" />
                <Text>Natural Language</Text>
              </HStack>
              <HStack>
                <Icon as={ExternalLink} color="blue.500" />
                <Text>Real-time Data</Text>
              </HStack>
              <HStack>
                <Icon as={Star} color="blue.500" />
                <Text>Quality Filtering</Text>
              </HStack>
            </HStack>
            
            {/* Popular searches */}
            <Box>
              <Text fontSize="sm" fontWeight="600" color="gray.700" mb={4}>
                Try these popular searches:
              </Text>
              <Flex gap={3} flexWrap="wrap" justify="center" maxW="4xl" mx="auto">
                {[
                  "Beach house in Malibu for 4 guests",
                  "Studio apartment in Tokyo under $100", 
                  "Pet-friendly cabin in Colorado",
                  "Luxury villa in Tuscany with pool"
                ].map((example) => (
                  <Button
                    key={example}
                    size="sm"
                    variant="outline"
                    colorScheme="gray"
                    onClick={() => setSearchQuery(example)}
                    px={4}
                    py={2}
                    fontSize="xs"
                    fontWeight="500"
                    bg="white"
                    borderColor="gray.300"
                    _hover={{ 
                      bg: "blue.50", 
                      borderColor: "blue.300", 
                      transform: "translateY(-1px)",
                      color: "blue.700"
                    }}
                    transition="all 0.2s"
                    borderRadius="full"
                    shadow="sm"
                  >
                    {example}
                  </Button>
                ))}
              </Flex>
            </Box>
          </Box>

        {/* Search Section */}
        <Box maxW="5xl" mx="auto">
          <Stack gap={6}>
            <Box 
              bg="white" 
              p={{ base: 6, md: 8 }} 
              borderRadius="2xl" 
              shadow="xl" 
              border="1px" 
              borderColor="gray.200"
              position="relative"
              _before={{
                content: '""',
                position: "absolute",
                top: "-1px",
                left: "-1px",
                right: "-1px", 
                bottom: "-1px",
                bgGradient: "linear(to-r, blue.400, purple.400)",
                borderRadius: "2xl",
                zIndex: -1,
                opacity: 0.1
              }}
            >
              <Stack gap={6}>
                <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="700" color="gray.800" textAlign="center">
                  What kind of place are you looking for?
                </Text>
                
                <Input
                  placeholder="Describe your ideal stay... 'Oceanfront villa in Santorini for a romantic getaway'"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  size="lg"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  bg="gray.50"
                  border="2px"
                  borderColor="gray.200"
                  _focus={{
                    borderColor: "blue.400",
                    bg: "white",
                    shadow: "0 0 0 4px rgba(66, 153, 225, 0.1)"
                  }}
                  _hover={{ borderColor: "gray.300" }}
                  fontSize={{ base: "md", md: "lg" }}
                  h={{ base: "60px", md: "70px" }}
                  borderRadius="xl"
                />
                
                <Button
                  colorScheme="blue"
                  size="lg"
                  onClick={() => handleSearch()}
                  loading={loading}
                  w="full"
                  h={{ base: "60px", md: "70px" }}
                  fontSize={{ base: "md", md: "lg" }}
                  fontWeight="600"
                  _hover={{ transform: "translateY(-2px)", shadow: "xl" }}
                  transition="all 0.2s"
                  borderRadius="xl"
                  bgGradient="linear(to-r, blue.500, blue.600)"
                  _active={{ transform: "translateY(0)" }}
                >
                  <Icon as={Search} mr={3} boxSize={5} />
                  Search Airbnb Properties
                </Button>
              </Stack>
            </Box>

            {/* Quality Filters */}
            <Box bg="white" p={6} borderRadius="xl" shadow="md" border="1px" borderColor="gray.200">
              <HStack alignItems="center" mb={6}>
                <Icon as={Settings} color="gray.600" mr={2} />
                <Text fontSize="lg" fontWeight="600" color="gray.700">
                  Quality Filters
                </Text>
              </HStack>
              
              <Stack gap={5}>
                <Flex gap={6} flexWrap="wrap" w="full">
                  <Box flex="1" minW="180px">
                    <Text fontSize="sm" fontWeight="600" color="gray.700" mb={3}>Minimum Rating</Text>
                    <Input
                      type="number"
                      value={minRating}
                      onChange={(e) => setMinRating(parseFloat(e.target.value) || 0)}
                      min={0}
                      max={5}
                      step={0.1}
                      size="md"
                      bg="gray.50"
                      border="2px"
                      borderColor="gray.200"
                      _focus={{ borderColor: "blue.400", bg: "white" }}
                      _hover={{ borderColor: "gray.300" }}
                      borderRadius="lg"
                      h="48px"
                    />
                  </Box>
                  
                  <Box flex="1" minW="180px">
                    <Text fontSize="sm" fontWeight="600" color="gray.700" mb={3}>Minimum Reviews</Text>
                    <Input
                      type="number"
                      value={minReviews}
                      onChange={(e) => setMinReviews(parseInt(e.target.value) || 0)}
                      min={0}
                      size="md"
                      bg="gray.50"
                      border="2px"
                      borderColor="gray.200"
                      _focus={{ borderColor: "blue.400", bg: "white" }}
                      _hover={{ borderColor: "gray.300" }}
                      borderRadius="lg"
                      h="48px"
                    />
                  </Box>
                </Flex>
                
                <HStack gap={3} flexWrap="wrap">
                  <Button 
                    size="md" 
                    colorScheme="purple" 
                    variant="outline"
                    onClick={() => {
                      setMinRating(4.9)
                      setMinReviews(20)
                    }}
                    _hover={{ bg: "purple.50" }}
                    borderRadius="lg"
                  >
                    <Icon as={Star} mr={2} />
                    4.9+ stars, 20+ reviews
                  </Button>
                  
                  <Button 
                    size="md" 
                    variant="outline"
                    colorScheme="gray"
                    onClick={() => {
                      setMinRating(0)
                      setMinReviews(0)
                    }}
                    _hover={{ bg: "gray.50" }}
                    borderRadius="lg"
                  >
                    Clear Filters
                  </Button>
                </HStack>
              </Stack>
            </Box>
          </Stack>
        </Box>

        {error && (
          <Box maxW="4xl" mx="auto" bg="red.50" p={6} borderRadius="xl" border="1px" borderColor="red.200">
            <HStack mb={3}>
              <Icon as={AlertCircle} color="red.600" />
              <Text fontWeight="600" color="red.800">Connection Issue</Text>
            </HStack>
            <Text fontSize="sm" color="red.700" mb={3}>
              Unable to connect to the search service. Please try again in a moment.
            </Text>
            <Text fontSize="xs" color="red.600">
              Error: {error}
            </Text>
          </Box>
        )}

        {loading && (
          <Center py={12}>
            <Stack align="center" gap={4}>
              <Spinner size="xl" color="blue.500" />
              <Text color="gray.600" fontWeight="500">Searching Airbnb...</Text>
            </Stack>
          </Center>
        )}

        {allListings.length > 0 && !loading && (
          <Box maxW="7xl" mx="auto">
            <Box mb={8} bg="white" p={6} borderRadius="xl" shadow="sm" border="1px" borderColor="gray.200">
              <Flex justify="space-between" align="center" mb={4} flexWrap="wrap" gap={4}>
                <Box>
                  <Heading as="h2" size="lg" color="gray.800" mb={2}>
                    {(minRating > 0 || minReviews > 0) ? (
                      <>Showing {filteredListings.length} of {allListings.length} properties</>
                    ) : (
                      <>Found {allListings.length} Airbnb properties</>
                    )}
                  </Heading>
                  <Text fontSize="sm" color="gray.600">Page {currentPage}</Text>
                </Box>
                <ButtonGroup size="sm" variant="outline" colorScheme="gray">
                  <Button 
                    onClick={handlePrevPage}
                    disabled={currentPage === 1 || loading}
                    _hover={{ bg: "gray.50" }}
                  >
                    ← Previous
                  </Button>
                  <Button 
                    onClick={handleNextPage}
                    disabled={!hasMore || loading}
                    _hover={{ bg: "gray.50" }}
                  >
                    Next →
                  </Button>
                </ButtonGroup>
              </Flex>
              <Box p={4} bg="blue.50" borderRadius="lg" border="1px" borderColor="blue.200">
                <HStack>
                  <Icon as={ExternalLink} color="blue.600" />
                  <Text fontSize="sm" color="blue.800" fontWeight="500">
                    Live data from Airbnb
                  </Text>
                </HStack>
                <Text fontSize="xs" color="blue.700" mt={1}>
                  Real properties with current prices and availability
                  {(minRating > 0 || minReviews > 0) && filteredListings.length < allListings.length && (
                    <Text as="span" ml={2}>
                      • Filtered by {minRating > 0 ? `${minRating}+ stars` : ''}{minRating > 0 && minReviews > 0 ? ', ' : ''}{minReviews > 0 ? `${minReviews}+ reviews` : ''}
                    </Text>
                  )}
                </Text>
              </Box>
            </Box>

            {(minRating > 0 || minReviews > 0) && filteredListings.length === 0 ? (
              <Box maxW="2xl" mx="auto" p={8} textAlign="center" bg="white" borderRadius="xl" shadow="sm" border="1px" borderColor="gray.200">
                <Icon as={Search} boxSize={12} color="gray.400" mb={4} />
                <Text fontSize="xl" fontWeight="600" color="gray.800" mb={3}>
                  No matches found
                </Text>
                <Text fontSize="sm" color="gray.600" mb={6}>
                  Try adjusting your filters. Currently set to {minRating > 0 ? `${minRating}+ stars` : ''}{minRating > 0 && minReviews > 0 ? ' with ' : ''}{minReviews > 0 ? `${minReviews}+ reviews` : ''}.
                </Text>
                <Button 
                  size="md" 
                  colorScheme="blue" 
                  variant="outline"
                  onClick={() => {
                    setMinRating(0)
                    setMinReviews(0)
                  }}
                  _hover={{ bg: "blue.50" }}
                >
                  Clear Filters
                </Button>
              </Box>
            ) : (
              <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={8}>
                {filteredListings.map((listing) => (
                <Box 
                  key={listing.id} 
                  bg="white" 
                  borderRadius="xl" 
                  overflow="hidden"
                  shadow="md" 
                  border="1px" 
                  borderColor="gray.200"
                  _hover={{ 
                    shadow: 'xl', 
                    transform: 'translateY(-2px)',
                    borderColor: 'gray.300'
                  }}
                  transition="all 0.2s"
                >
                  <Box p={6}>
                    <Stack gap={4} align="stretch">
                      <Heading as="h3" size="md" lineClamp={2} color="gray.800" lineHeight="1.3">
                        {listing.name}
                      </Heading>
                      <HStack justify="space-between" align="center">
                        <HStack>
                          <Icon as={MapPin} color="gray.500" size="sm" />
                          <Text fontSize="sm" color="gray.600" fontWeight="500">
                            {listing.location.country ? 
                              `${listing.location.city}, ${listing.location.country}` : 
                              listing.location.city
                            }
                          </Text>
                        </HStack>
                        <Badge 
                          colorScheme={listing.rating >= 4.8 ? "green" : listing.rating >= 4.5 ? "blue" : "gray"}
                          fontSize="xs"
                          px={2}
                          py={1}
                          borderRadius="full"
                        >
                          <HStack gap={1}>
                            <Icon as={Star} size="xs" />
                            <Text>{listing.rating} ({listing.reviewsCount})</Text>
                          </HStack>
                        </Badge>
                      </HStack>
                      <Text fontSize="sm" color="gray.600" bg="gray.50" px={3} py={1} borderRadius="full" alignSelf="flex-start">
                        {listing.roomType}
                      </Text>
                      <HStack justify="space-between" align="center" pt={2}>
                        <Box>
                          <Text fontWeight="700" fontSize="xl" color="gray.800">
                            ${listing.price.rate}
                          </Text>
                          <Text fontSize="xs" color="gray.500">per night</Text>
                        </Box>
                        {listing.host.isSuperhost && (
                          <Badge colorScheme="purple" variant="subtle" px={3} py={1} borderRadius="full">
                            <HStack gap={1}>
                              <Icon as={Crown} size="xs" />
                              <Text>Superhost</Text>
                            </HStack>
                          </Badge>
                        )}
                      </HStack>
                      <Link href={listing.url} target="_blank" rel="noopener noreferrer">
                        <Button
                          colorScheme="blue"
                          size="md"
                          w="full"
                          mt={2}
                          fontWeight="600"
                          _hover={{ transform: "translateY(-1px)" }}
                          transition="all 0.2s"
                        >
                          View on Airbnb
                          <Icon as={ExternalLink} ml={2} />
                        </Button>
                      </Link>
                    </Stack>
                  </Box>
                </Box>
                ))}
              </SimpleGrid>
            )}
            
            {/* Pagination controls at bottom */}
            <Center mt={12}>
              <Box bg="white" p={4} borderRadius="xl" shadow="sm" border="1px" borderColor="gray.200">
                <HStack gap={4}>
                  <Button 
                    onClick={handlePrevPage}
                    disabled={currentPage === 1 || loading}
                    variant="outline"
                    colorScheme="gray"
                    _hover={{ bg: "gray.50" }}
                  >
                    ← Previous
                  </Button>
                  <Box px={6} py={2} bg="gray.50" borderRadius="lg">
                    <Text fontWeight="600" color="gray.700">Page {currentPage}</Text>
                  </Box>
                  <Button 
                    onClick={handleNextPage}
                    disabled={!hasMore || loading}
                    variant="outline"
                    colorScheme="gray"
                    _hover={{ bg: "gray.50" }}
                  >
                    Next →
                  </Button>
                </HStack>
              </Box>
            </Center>
          </Box>
        )}
        </Stack>
      </Container>
    </Box>
  )
}

export default App
