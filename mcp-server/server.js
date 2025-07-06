/**
 * MCP Airbnb Server - Uses OpenBNB MCP Server for real Airbnb search
 */

const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3001;

// Railway environment detection
const isRailwayEnv = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
if (isRailwayEnv) {
  console.log('Running in Railway environment');
}

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
    const { query, location, adults = 1, children = 0, infants = 0, pets = 0, checkin, checkout, minPrice, maxPrice, page = 1 } = req.body;

    // Support both natural language query and structured parameters
    if (!query && !location) {
      return res.status(400).json({ error: 'Query or location is required' });
    }

    console.log('Searching Airbnb for:', { query, location, adults, children, infants, pets, page });

    // Convert page number to cursor for MCP
    // Page 1 = no cursor, Page 2+ = use cursor from pagination
    let cursor = null;
    if (page > 1) {
      // For now, we'll use a simple calculation - in a real app, you'd store the cursors
      const cursors = [
        null, // page 1
        "eyJzZWN0aW9uX29mZnNldCI6MCwiaXRlbXNfb2Zmc2V0IjoxOCwidmVyc2lvbiI6MX0=", // page 2
        "eyJzZWN0aW9uX29mZnNldCI6MCwiaXRlbXNfb2Zmc2V0IjozNiwidmVyc2lvbiI6MX0=", // page 3
        "eyJzZWN0aW9uX29mZnNldCI6MCwiaXRlbXNfb2Zmc2V0Ijo1NCwidmVyc2lvbiI6MX0=", // page 4
      ];
      cursor = cursors[page - 1] || cursors[cursors.length - 1];
    }

    // Call the actual MCP function directly
    const searchParams = query ? 
      { query, ...(cursor && { cursor }), ignoreRobotsText: true } :
      {
        location,
        adults,
        children,
        infants,
        pets,
        ...(cursor && { cursor }),
        ...(checkin && { checkin }),
        ...(checkout && { checkout }),
        ...(minPrice && { minPrice }),
        ...(maxPrice && { maxPrice }),
        ignoreRobotsText: true
      };
    
    const result = await callMCPAirbnbSearch(searchParams);

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
    // Try different function names that might be available
    const functionNames = [
      'mcp__openbnb-airbnb__airbnb_search',
      'airbnb_search',
      'search'
    ];
    
    let result = null;
    let lastError = null;
    
    for (const funcName of functionNames) {
      try {
        console.log(`Trying MCP function: ${funcName}`);
        result = await callOpenBNBMCP(funcName, params);
        console.log(`Success with function: ${funcName}`);
        break;
      } catch (error) {
        console.log(`Failed with function ${funcName}:`, error.message);
        lastError = error;
      }
    }
    
    if (!result) {
      throw lastError || new Error('All MCP function attempts failed');
    }
    
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
  
  let client = null;
  
  try {
    // Use dynamic import for ES modules
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
    
    // Create a client connection to the OpenBNB MCP server
    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['@openbnb/mcp-server-airbnb']
    });
    
    client = new Client({
      name: 'airbnb-search-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });
    
    // Connect and call tool
    await client.connect(transport);
    console.log('Connected to MCP server');
    
    // Try to list tools first to find correct name
    let toolToUse = functionName;
    
    try {
      const tools = await client.listTools();
      console.log('Available MCP tools:', JSON.stringify(tools, null, 2));
      
      const availableToolNames = tools.tools?.map(tool => tool.name) || [];
      console.log('Available tool names:', availableToolNames);
      
      const searchTool = availableToolNames.find(name => 
        name.includes('search') || name.includes('airbnb')
      ) || availableToolNames[0];
      
      if (searchTool) {
        toolToUse = searchTool;
        console.log(`Using discovered tool: ${searchTool}`);
      }
    } catch (listError) {
      console.log('Could not list tools, using provided function name:', functionName);
    }
    
    // Call the tool
    const result = await client.callTool({
      name: toolToUse,
      arguments: params
    });
    
    console.log('MCP tool call result:', JSON.stringify(result, null, 2));
    
    // Handle error responses
    if (result.isError || (result.content && result.content[0] && result.content[0].text && result.content[0].text.startsWith('Error:'))) {
      const errorMsg = result.content?.[0]?.text || 'Unknown MCP error';
      throw new Error(`MCP tool error: ${errorMsg}`);
    }
    
    // Handle different response formats
    if (result.content && result.content[0] && result.content[0].text) {
      try {
        return JSON.parse(result.content[0].text);
      } catch (parseError) {
        console.log('Response is not JSON, returning as-is:', result.content[0].text);
        return { searchResults: [], searchUrl: '', message: result.content[0].text };
      }
    } else {
      return result;
    }
    
  } catch (error) {
    console.error('MCP SDK error:', error);
    throw new Error(`MCP SDK error: ${error.message}`);
  } finally {
    if (client) {
      try {
        await client.close();
      } catch (closeError) {
        console.error('Error closing MCP client:', closeError);
      }
    }
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


app.listen(PORT, '0.0.0.0', () => {
  console.log(`MCP Airbnb Server running on port ${PORT}`);
  console.log('Ready to receive MCP Airbnb search requests');
  console.log(`Health check: http://localhost:${PORT}/`);
  
  if (isRailwayEnv) {
    console.log('Successfully deployed to Railway!');
  }
});

module.exports = app;