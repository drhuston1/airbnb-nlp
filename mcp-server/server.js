/**
 * MCP Airbnb Server - Uses OpenBNB MCP Server for real Airbnb search
 */

const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'MCP Airbnb Server Running',
    version: '1.0.0',
    endpoints: ['/airbnb-search', '/airbnb-details'],
    mcpToolsAvailable: typeof global.mcpTools !== 'undefined'
  });
});

// Airbnb search endpoint using MCP tools
app.post('/airbnb-search', async (req, res) => {
  try {
    const { location, adults = 1, children = 0, infants = 0, pets = 0, checkin, checkout, minPrice, maxPrice } = req.body;

    if (!location) {
      return res.status(400).json({ error: 'Location is required' });
    }

    console.log('Searching Airbnb for:', { location, adults, children, infants, pets });

    // Call the actual MCP function directly
    const result = await callMCPAirbnbSearch({
      location,
      adults,
      children,
      infants,
      pets,
      ...(checkin && { checkin }),
      ...(checkout && { checkout }),
      ...(minPrice && { minPrice }),
      ...(maxPrice && { maxPrice }),
      ignoreRobotsText: true
    });

    return res.json(result);

  } catch (error) {
    console.error('Airbnb search error:', error);
    res.status(500).json({ 
      error: 'Search failed', 
      details: error.message,
      suggestion: 'Make sure MCP tools are properly configured in this environment'
    });
  }
});

// Function to call the actual OpenBNB MCP server
async function callMCPAirbnbSearch(params) {
  try {
    console.log('Calling OpenBNB MCP server with params:', params);
    
    // Call the real MCP function with proper error handling
    const result = await callOpenBNBMCP('mcp__openbnb-airbnb__airbnb_search', params);
    
    console.log('MCP call completed successfully');
    return result;
    
  } catch (error) {
    console.error('MCP call error:', error);
    throw error;
  }
}

// Function to call OpenBNB MCP functions
async function callOpenBNBMCP(functionName, params) {
  console.log(`Attempting to call MCP function: ${functionName}`);
  console.log('With params:', JSON.stringify(params, null, 2));
  
  try {
    // Use dynamic import for ES modules
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
    
    // Create a client connection to the OpenBNB MCP server
    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['@openbnb/mcp-server-airbnb']
    });
    
    const client = new Client({
      name: 'airbnb-search-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });
    
    // Connect and call the tool
    await client.connect(transport);
    console.log('Connected to MCP server');
    
    try {
      const result = await client.callTool({
        name: functionName,
        arguments: params
      });
      
      console.log('MCP tool call successful:', result);
      await client.close();
      
      // Handle different response formats
      if (result.content && result.content[0] && result.content[0].text) {
        return JSON.parse(result.content[0].text);
      } else {
        return result;
      }
      
    } catch (toolError) {
      console.error('MCP tool call failed:', toolError);
      await client.close();
      throw new Error(`MCP tool call failed: ${toolError.message}`);
    }
    
  } catch (error) {
    console.error('MCP SDK error:', error);
    throw new Error(`MCP SDK error: ${error.message}`);
  }
}

// Generate fallback listings in the expected format
function generateFallbackListings(location, maxPrice = 200) {
  const listings = [];
  const basePrice = Math.min(maxPrice || 200, 50);
  
  for (let i = 0; i < 12; i++) {
    const price = basePrice + Math.floor(Math.random() * 50);
    listings.push({
      id: `listing-${Date.now()}-${i}`,
      url: `https://www.airbnb.com/rooms/listing-${i}`,
      demandStayListing: {
        id: `listing-${i}`,
        description: {
          name: {
            localizedStringWithTranslationPreference: `Beautiful ${['Apartment', 'House', 'Condo', 'Loft', 'Studio'][i % 5]} in ${location}`
          }
        },
        location: {
          coordinate: {
            latitude: 35.6762 + (Math.random() - 0.5) * 0.1,
            longitude: 139.6503 + (Math.random() - 0.5) * 0.1
          }
        }
      },
      badges: i % 3 === 0 ? 'Superhost' : (i % 4 === 0 ? 'Guest favorite' : ''),
      structuredContent: {
        primaryLine: ['Entire apartment', 'Private room', 'Entire house', 'Shared room', 'Hotel room'][i % 5],
        secondaryLine: `${location} Center`
      },
      avgRatingA11yLabel: `${(4.0 + Math.random()).toFixed(1)} out of 5 stars with ${Math.floor(Math.random() * 200) + 10} reviews`,
      structuredDisplayPrice: {
        primaryLine: {
          accessibilityLabel: `$${price} per night`
        },
        explanationData: {
          priceDetails: `$${price} per night`
        }
      }
    });
  }
  
  return listings;
}


app.listen(PORT, () => {
  console.log(`MCP Airbnb Server running on port ${PORT}`);
  console.log('Ready to receive MCP Airbnb search requests');
});

module.exports = app;