// Enhanced NLP extraction using Hugging Face transformers.js
import { pipeline } from '@xenova/transformers';

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

// Cache the NER pipeline for performance
let nerPipeline: any = null;

async function getNERPipeline() {
  if (!nerPipeline) {
    console.log('Loading NER model...');
    nerPipeline = await pipeline('token-classification', 'Xenova/bert-base-NER');
  }
  return nerPipeline;
}

export async function extractWithTransformers(query: string): Promise<QueryAnalysis> {
  try {
    // Use NER to extract entities
    const ner = await getNERPipeline();
    const entities = await ner(query);
    
    console.log('Transformers NER entities:', entities);
    
    // Extract location from NER results
    const locationEntities = entities
      .filter((entity: any) => 
        entity.entity.includes('LOC') || 
        entity.entity.includes('GPE') || 
        entity.entity.includes('PLACE') ||
        entity.entity.includes('B-LOC') ||
        entity.entity.includes('I-LOC') ||
        entity.entity.includes('B-GPE') ||
        entity.entity.includes('I-GPE')
      );
    
    let location = 'Unknown';
    if (locationEntities.length > 0) {
      // Combine consecutive location tokens
      const locationWords = locationEntities
        .map((entity: any) => entity.word.replace('##', ''))
        .filter((word: string) => word.length > 1);
      
      location = locationWords.join(' ').trim();
      
      // Clean up common NER artifacts
      location = location.replace(/\s+/g, ' ').trim();
    }
    
    // Return only NER-extracted location
    const analysis: QueryAnalysis = {
      location,
      priceRange: {},
      rating: {},
      guests: {},
      amenities: [],
      propertyType: undefined
    };
    
    console.log('Pure NER analysis:', analysis);
    return analysis;
    
  } catch (error) {
    console.error('NER extraction error:', error);
    // Return minimal analysis if NER fails
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

// Pure NER-only extraction - no pattern-based functions

// Clean NER-only extraction - no fallbacks