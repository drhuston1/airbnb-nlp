import React, { useMemo, useCallback } from 'react'
import {
  Box,
  Text,
  Grid,
  Button,
  HStack,
  Icon
} from '@chakra-ui/react'
import { 
  DollarSign, 
  Star, 
  Wifi, 
  Award, 
  Home, 
  Filter 
} from 'lucide-react'
import type { RefinementSuggestion } from '../utils/refinementAnalyzer'

interface QuickFiltersProps {
  filters: RefinementSuggestion[]
  onFilterClick: (query: string) => void
}

// Memoized individual filter button
const FilterButton = React.memo(({ 
  filter, 
  onFilterClick 
}: { 
  filter: RefinementSuggestion
  onFilterClick: (query: string) => void 
}) => {
  // Memoize icon selection
  const IconComponent = useMemo(() => {
    switch (filter.type) {
      case 'price': return DollarSign
      case 'rating': return Star
      case 'amenity': return Wifi
      case 'host_type': return Award
      case 'property_type': return Home
      default: return Filter
    }
  }, [filter.type])

  // Memoize color scheme
  const colorScheme = useMemo(() => {
    switch (filter.priority) {
      case 'high': return { main: '#4ECDC4', bg: 'white', dark: '#2E7A73' }
      case 'medium': return { main: '#FF8E53', bg: 'white', dark: '#CC6B2E' }
      default: return { main: '#FF6B6B', bg: 'white', dark: '#CC5555' }
    }
  }, [filter.priority])

  // Memoize click handler
  const handleClick = useCallback(() => {
    onFilterClick(filter.query)
  }, [filter.query, onFilterClick])

  return (
    <Button
      size="xs"
      variant="outline"
      onClick={handleClick}
      borderColor={colorScheme.main}
      color={colorScheme.dark}
      bg="white"
      border="1px solid"
      _hover={{ 
        bg: '#F8FDFC',
        borderColor: colorScheme.dark,
        transform: 'translateY(-1px)'
      }}
      borderRadius="md"
      px={2}
      py={1}
      h="auto"
      whiteSpace="normal"
      textAlign="left"
      fontSize="xs"
      fontWeight="500"
      transition="all 0.15s ease"
      flexDirection="column"
      alignItems="flex-start"
    >
      <HStack w="full" justify="space-between">
        <HStack gap={1}>
          <Icon as={IconComponent} w={2} h={2} />
          <Text fontSize="xs" fontWeight="500" lineHeight="1.2">
            {filter.label}
          </Text>
        </HStack>
        <Text fontSize="xs" color={colorScheme.main} fontWeight="500">
          {filter.count}
        </Text>
      </HStack>
    </Button>
  )
}, (prevProps, nextProps) => {
  // Custom comparison for optimal re-render prevention
  return (
    prevProps.filter.type === nextProps.filter.type &&
    prevProps.filter.priority === nextProps.filter.priority &&
    prevProps.filter.query === nextProps.filter.query &&
    prevProps.filter.label === nextProps.filter.label &&
    prevProps.filter.count === nextProps.filter.count &&
    prevProps.onFilterClick === nextProps.onFilterClick
  )
})

FilterButton.displayName = 'FilterButton'

export const QuickFilters = React.memo(({ 
  filters, 
  onFilterClick 
}: QuickFiltersProps) => {
  // Memoize grid configuration
  const gridConfig = useMemo(() => ({
    templateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: 1
  }), [])

  // Early return if no filters
  if (filters.length === 0) {
    return null
  }

  return (
    <Box mt={2}>
      <Text fontSize="xs" fontWeight="500" color="gray.500" mb={1}>
        Quick filters
      </Text>
      <Grid 
        templateColumns={gridConfig.templateColumns} 
        gap={gridConfig.gap}
      >
        {filters.map((filter, index) => (
          <FilterButton
            key={`${filter.type}-${filter.query}-${index}`}
            filter={filter}
            onFilterClick={onFilterClick}
          />
        ))}
      </Grid>
    </Box>
  )
}, (prevProps, nextProps) => {
  // Custom comparison for QuickFilters
  return (
    prevProps.filters.length === nextProps.filters.length &&
    prevProps.onFilterClick === nextProps.onFilterClick &&
    prevProps.filters.every((filter, index) => {
      const nextFilter = nextProps.filters[index]
      return (
        filter.type === nextFilter?.type &&
        filter.priority === nextFilter?.priority &&
        filter.query === nextFilter?.query &&
        filter.label === nextFilter?.label &&
        filter.count === nextFilter?.count
      )
    })
  )
})

QuickFilters.displayName = 'QuickFilters'