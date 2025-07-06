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
  Flex
} from '@chakra-ui/react'
import { Star, User, ExternalLink, MapPin } from 'lucide-react'
import type { AirbnbListing } from '../types'

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
        {listings.map((listing) => (
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
                <HStack gap={1}>
                  <Icon as={Star} w={4} h={4} color="orange.400" />
                  <Text fontSize="sm" fontWeight="medium">
                    {listing.rating}
                  </Text>
                  <Text fontSize="sm" color="gray.500">
                    ({listing.reviewsCount})
                  </Text>
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
        ))}
      </SimpleGrid>
    </Box>
  )
}