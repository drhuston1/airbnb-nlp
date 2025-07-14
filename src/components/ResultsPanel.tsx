import React, { useMemo } from 'react'
import { 
  Box, 
  VStack, 
  Text, 
  SimpleGrid, 
  Icon,
  Spinner,
  Center
} from '@chakra-ui/react'
import { MapPin } from 'lucide-react'
import type { AirbnbListing } from '../types'
import { PropertyCard } from './PropertyCard'

interface ResultsPanelProps {
  listings: AirbnbListing[]
  isLoading: boolean
  hasSearched: boolean
  onListingClick: (listing: AirbnbListing) => void
}

export const ResultsPanel = React.memo(({ 
  listings, 
  isLoading, 
  hasSearched, 
  onListingClick 
}: ResultsPanelProps) => {
  // Memoize the listings count to prevent unnecessary recalculations
  const listingsCount = useMemo(() => listings.length, [listings.length])
  
  // Memoize the grid columns configuration
  const gridColumns = useMemo(() => ({ base: 1, lg: 2, xl: 3 }), [])
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
        Found {listingsCount} properties
      </Text>
      
      <SimpleGrid columns={gridColumns} gap={6}>
        {listings.map((listing) => (
          <PropertyCard
            key={listing.id}
            listing={listing}
            onListingClick={onListingClick}
          />
        ))}
      </SimpleGrid>
    </Box>
  )
}, (prevProps, nextProps) => {
  // Custom comparison for ResultsPanel to prevent unnecessary re-renders
  return (
    prevProps.listings.length === nextProps.listings.length &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.hasSearched === nextProps.hasSearched &&
    prevProps.onListingClick === nextProps.onListingClick &&
    // Deep comparison of listings array - only compare IDs for performance
    prevProps.listings.every((listing, index) => 
      listing.id === nextProps.listings[index]?.id &&
      listing.price.rate === nextProps.listings[index]?.price.rate &&
      listing.rating === nextProps.listings[index]?.rating
    )
  )
})

ResultsPanel.displayName = 'ResultsPanel'