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
    
    const location = await extractLocationWithGPT(query);
    
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

async function extractLocationWithGPT(query: string): Promise<string> {
  try {
    const response = await fetch('/api/extract-location', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      throw new Error(`Location extraction API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      console.error('Location extraction failed:', data.error);
      return 'Unknown';
    }

    const extractedLocation = data.location;
    
    if (!extractedLocation || extractedLocation.toLowerCase() === 'unknown') {
      console.log('GPT could not extract location from:', query);
      return 'Unknown';
    }

    console.log(`GPT extracted location: "${extractedLocation}" from query: "${query}"`);
    return extractedLocation;

  } catch (error) {
    console.error('GPT location extraction failed:', error);
    return 'Unknown';
  }
}

// Pure NER-only extraction - no pattern-based functions

// Clean NER-only extraction - no fallbacks