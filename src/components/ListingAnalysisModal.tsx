import {
  Box,
  Button,
  VStack,
  HStack,
  Text,
  Badge,
  Spinner,
  Icon,
  Grid,
  Circle
} from '@chakra-ui/react';
import { X, ExternalLink, CheckCircle, AlertTriangle, Star, DollarSign, MapPin, User, Home } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { AirbnbListing } from '../types';

interface ListingAnalysis {
  overallScore: number;
  insights: {
    priceAnalysis: {
      score: number;
      assessment: 'excellent' | 'good' | 'fair' | 'expensive';
      details: string;
      comparison?: string;
    };
    locationAnalysis: {
      score: number;
      highlights: string[];
      concerns: string[];
      walkability?: string;
    };
    hostAnalysis: {
      score: number;
      trustLevel: 'high' | 'medium' | 'low';
      details: string;
      experience?: string;
    };
    propertyAnalysis: {
      score: number;
      highlights: string[];
      amenityScore: number;
      spaceAssessment?: string;
    };
    reviewAnalysis: {
      score: number;
      credibility: 'high' | 'medium' | 'low';
      summary: string;
    };
  };
  recommendations: string[];
  redFlags: string[];
  bottomLine: string;
}

interface ListingAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing: AirbnbListing;
  searchQuery?: string;
  alternatives?: AirbnbListing[];
}

export function ListingAnalysisModal({ 
  isOpen, 
  onClose, 
  listing, 
  searchQuery, 
  alternatives 
}: ListingAnalysisModalProps) {
  const [analysis, setAnalysis] = useState<ListingAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState('overview');

  useEffect(() => {
    if (isOpen && !analysis) {
      fetchAnalysis();
    }
  }, [isOpen]);

  const fetchAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/analyze-listing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          listing,
          context: {
            searchQuery,
            alternatives: alternatives?.map(alt => ({
              price: alt.price,
              rating: alt.rating,
              trustScore: alt.trustScore
            }))
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.status}`);
      }

      const data = await response.json();
      setAnalysis(data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'green';
    if (score >= 60) return 'yellow';
    return 'red';
  };

  const renderScoreCircle = (score: number, label: string) => (
    <VStack gap={1}>
      <Circle
        size="60px"
        bg={`${getScoreColor(score)}.100`}
        color={`${getScoreColor(score)}.800`}
        fontWeight="bold"
        fontSize="lg"
        border="3px solid"
        borderColor={`${getScoreColor(score)}.300`}
      >
        {score}
      </Circle>
      <Text fontSize="sm" fontWeight="medium" textAlign="center">{label}</Text>
    </VStack>
  );

  if (!isOpen) return null;

  return (
    <Box
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      bg="blackAlpha.800"
      zIndex={9999}
      display="flex"
      alignItems="center"
      justifyContent="center"
      onClick={onClose}
    >
      <Box
        bg="white"
        borderRadius="lg"
        maxW="4xl"
        w="90vw"
        maxH="90vh"
        overflow="hidden"
        onClick={(e) => e.stopPropagation()}
        display="flex"
        flexDirection="column"
      >
        {/* Header */}
        <Box p={4} borderBottom="1px" borderColor="gray.200">
          <HStack justify="space-between">
            <VStack align="start" gap={1}>
              <Text fontSize="lg" fontWeight="bold">
                📊 Property Analysis
              </Text>
              <Text fontSize="md" color="gray.600">
                {listing.name}
              </Text>
            </VStack>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <Icon as={X} w={4} h={4} />
            </Button>
          </HStack>
        </Box>

        {/* Content */}
        <Box flex="1" overflow="auto" p={4}>
          {loading && (
            <Box textAlign="center" py={8}>
              <Spinner size="lg" color="blue.500" />
              <Text mt={4} color="gray.600">
                Analyzing property details...
              </Text>
            </Box>
          )}

          {error && (
            <Box p={4} bg="red.50" borderRadius="md" border="1px" borderColor="red.200">
              <HStack>
                <Icon as={AlertTriangle} color="red.500" />
                <Text color="red.700">Analysis Failed: {error}</Text>
              </HStack>
            </Box>
          )}

          {analysis && (
            <VStack gap={6} align="stretch">
              {/* Overall Score */}
              <Box p={4} border="1px" borderColor="gray.200" borderRadius="lg" bg="white">
                <HStack justify="space-between" align="center">
                  <VStack align="start">
                    <Text fontSize="xl" fontWeight="bold">
                      Overall Score
                    </Text>
                    <Text fontSize="lg" color="gray.600">
                      {analysis.bottomLine}
                    </Text>
                  </VStack>
                  <Circle
                    size="80px"
                    bg={`${getScoreColor(analysis.overallScore)}.100`}
                    color={`${getScoreColor(analysis.overallScore)}.800`}
                    fontWeight="bold"
                    fontSize="2xl"
                    border="4px solid"
                    borderColor={`${getScoreColor(analysis.overallScore)}.300`}
                  >
                    {analysis.overallScore}
                  </Circle>
                </HStack>
              </Box>

              {/* Tab Navigation */}
              <HStack gap={2} wrap="wrap">
                {[
                  { id: 'overview', label: '📋 Overview', icon: Home },
                  { id: 'price', label: '💰 Price', icon: DollarSign },
                  { id: 'location', label: '📍 Location', icon: MapPin },
                  { id: 'host', label: '👤 Host', icon: User },
                  { id: 'reviews', label: '⭐ Reviews', icon: Star }
                ].map(tab => (
                  <Button
                    key={tab.id}
                    size="sm"
                    variant={currentTab === tab.id ? 'solid' : 'outline'}
                    colorScheme={currentTab === tab.id ? 'blue' : 'gray'}
                    onClick={() => setCurrentTab(tab.id)}
                  >
                    {tab.label}
                  </Button>
                ))}
              </HStack>

              {/* Tab Content */}
              <Box>
                {currentTab === 'overview' && (
                  <VStack gap={4} align="stretch">
                    <Grid templateColumns="repeat(4, 1fr)" gap={4}>
                      {renderScoreCircle(analysis.insights.priceAnalysis.score, 'Price')}
                      {renderScoreCircle(analysis.insights.locationAnalysis.score, 'Location')}
                      {renderScoreCircle(analysis.insights.hostAnalysis.score, 'Host')}
                      {renderScoreCircle(analysis.insights.reviewAnalysis.score, 'Reviews')}
                    </Grid>
                    
                    {analysis.recommendations.length > 0 && (
                      <Box>
                        <Text fontWeight="bold" mb={2}>💡 Recommendations</Text>
                        <VStack align="start" gap={1}>
                          {analysis.recommendations.map((rec, i) => (
                            <HStack key={i}>
                              <Icon as={CheckCircle} color="green.500" w={4} h={4} />
                              <Text fontSize="sm">{rec}</Text>
                            </HStack>
                          ))}
                        </VStack>
                      </Box>
                    )}

                    {analysis.redFlags.length > 0 && (
                      <Box>
                        <Text fontWeight="bold" mb={2} color="red.600">🚩 Things to Consider</Text>
                        <VStack align="start" gap={1}>
                          {analysis.redFlags.map((flag, i) => (
                            <HStack key={i}>
                              <Icon as={AlertTriangle} color="red.500" w={4} h={4} />
                              <Text fontSize="sm">{flag}</Text>
                            </HStack>
                          ))}
                        </VStack>
                      </Box>
                    )}
                  </VStack>
                )}

                {currentTab === 'price' && (
                  <VStack gap={4} align="stretch">
                    <HStack justify="space-between">
                      {renderScoreCircle(analysis.insights.priceAnalysis.score, 'Price Score')}
                      <Badge 
                        colorScheme={analysis.insights.priceAnalysis.assessment === 'excellent' ? 'green' : 
                                    analysis.insights.priceAnalysis.assessment === 'good' ? 'blue' :
                                    analysis.insights.priceAnalysis.assessment === 'fair' ? 'yellow' : 'red'}
                        fontSize="md"
                        px={3}
                        py={1}
                        textTransform="capitalize"
                      >
                        {analysis.insights.priceAnalysis.assessment}
                      </Badge>
                    </HStack>
                    <Text>{analysis.insights.priceAnalysis.details}</Text>
                    {analysis.insights.priceAnalysis.comparison && (
                      <Box p={3} bg="blue.50" borderRadius="md">
                        <Text fontSize="sm">{analysis.insights.priceAnalysis.comparison}</Text>
                      </Box>
                    )}
                  </VStack>
                )}

                {currentTab === 'location' && (
                  <VStack gap={4} align="stretch">
                    {renderScoreCircle(analysis.insights.locationAnalysis.score, 'Location Score')}
                    
                    {analysis.insights.locationAnalysis.highlights.length > 0 && (
                      <Box>
                        <Text fontWeight="bold" mb={2}>✅ Highlights</Text>
                        <VStack align="start" gap={1}>
                          {analysis.insights.locationAnalysis.highlights.map((highlight, i) => (
                            <HStack key={i}>
                              <Icon as={CheckCircle} color="green.500" w={4} h={4} />
                              <Text fontSize="sm">{highlight}</Text>
                            </HStack>
                          ))}
                        </VStack>
                      </Box>
                    )}

                    {analysis.insights.locationAnalysis.concerns.length > 0 && (
                      <Box>
                        <Text fontWeight="bold" mb={2}>⚠️ Considerations</Text>
                        <VStack align="start" gap={1}>
                          {analysis.insights.locationAnalysis.concerns.map((concern, i) => (
                            <HStack key={i}>
                              <Icon as={AlertTriangle} color="orange.500" w={4} h={4} />
                              <Text fontSize="sm">{concern}</Text>
                            </HStack>
                          ))}
                        </VStack>
                      </Box>
                    )}
                  </VStack>
                )}

                {currentTab === 'host' && (
                  <VStack gap={4} align="stretch">
                    <HStack justify="space-between">
                      {renderScoreCircle(analysis.insights.hostAnalysis.score, 'Host Score')}
                      <VStack>
                        <Badge 
                          colorScheme={analysis.insights.hostAnalysis.trustLevel === 'high' ? 'green' : 
                                      analysis.insights.hostAnalysis.trustLevel === 'medium' ? 'yellow' : 'red'}
                          fontSize="md"
                          px={3}
                          py={1}
                        >
                          {analysis.insights.hostAnalysis.trustLevel.toUpperCase()} TRUST
                        </Badge>
                        {listing.host.isSuperhost && (
                          <Badge colorScheme="purple" fontSize="sm">
                            ⭐ SUPERHOST
                          </Badge>
                        )}
                      </VStack>
                    </HStack>
                    <Text>{analysis.insights.hostAnalysis.details}</Text>
                  </VStack>
                )}

                {currentTab === 'reviews' && (
                  <VStack gap={4} align="stretch">
                    <HStack justify="space-between">
                      {renderScoreCircle(analysis.insights.reviewAnalysis.score, 'Review Score')}
                      <Badge 
                        colorScheme={analysis.insights.reviewAnalysis.credibility === 'high' ? 'green' : 
                                    analysis.insights.reviewAnalysis.credibility === 'medium' ? 'yellow' : 'red'}
                        fontSize="md"
                        px={3}
                        py={1}
                      >
                        {analysis.insights.reviewAnalysis.credibility.toUpperCase()} CREDIBILITY
                      </Badge>
                    </HStack>
                    <Text>{analysis.insights.reviewAnalysis.summary}</Text>
                    
                    <Box p={3} bg="yellow.50" borderRadius="md">
                      <HStack>
                        <Icon as={Star} color="yellow.500" />
                        <Text fontSize="sm">
                          <strong>{listing.rating}/5</strong> from <strong>{listing.reviewsCount}</strong> reviews
                        </Text>
                      </HStack>
                    </Box>
                  </VStack>
                )}
              </Box>
            </VStack>
          )}
        </Box>

        {/* Footer */}
        <Box p={4} borderTop="1px" borderColor="gray.200">
          <HStack justify="space-between">
            <Button 
              variant="outline"
              onClick={() => window.open(listing.url, '_blank')}
            >
              <Icon as={ExternalLink} mr={2} />
              View on Airbnb
            </Button>
            <Button colorScheme="blue" onClick={onClose}>
              Close Analysis
            </Button>
          </HStack>
        </Box>
      </Box>
    </Box>
  );
}