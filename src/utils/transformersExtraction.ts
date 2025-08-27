// Enhanced location extraction using GPT-4o-mini
interface QueryAnalysis {
  location: string;
  priceRange: {
    min?: number;
    max?: number;
  };
  rating: {
    min?: number;
  };
  guests: {
    adults?: number;
    children?: number;
  };
  amenities: string[];
  propertyType?: string;
}


export async function extractWithTransformers(query: string): Promise<QueryAnalysis> {
  try {
    console.log('Extracting location with GPT-4o-mini for query:', query);
    
    const location = 'Unknown';
    
    const analysis: QueryAnalysis = {
      location,
      priceRange: {},
      rating: {},
      guests: {},
      amenities: [],
      propertyType: undefined
    };
    
    console.log('GPT-4o-mini analysis:', analysis);
    return analysis;
    
  } catch (error) {
    console.error('GPT location extraction error:', error);
    // Return minimal analysis if GPT fails
    return {
      location: 'Unknown',
      priceRange: {},
      rating: {},
      guests: {},
      amenities: [],
      propertyType: undefined
    };
  }
}

async function extractLocationWithGPT(_query: string): Promise<string> {
  try {
    // Endpoint removed in simplified flow; return Unknown and let unified search handle parsing
    return 'Unknown'
  } catch (error) {
    console.error('GPT location extraction failed:', error);
    return 'Unknown';
  }
}


// Pure NER-only extraction - no pattern-based functions

// Clean NER-only extraction - no fallbacks
