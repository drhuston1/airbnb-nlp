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
    
    // Call the OpenBNB MCP server using npx
    // The function name should match what's available in the OpenBNB MCP server
    const result = await callOpenBNBMCP('mcp__openbnb-airbnb__airbnb_search', params);
    
    return result;
    
  } catch (error) {
    console.error('MCP call error:', error);
    throw error;
  }
}

// Function to call OpenBNB MCP functions
function callOpenBNBMCP(functionName, params) {
  return new Promise((resolve, reject) => {
    // Use npx to run the OpenBNB MCP server
    const mcpProcess = spawn('npx', ['@openbnb/mcp-server-airbnb'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let outputData = '';
    let errorData = '';

    // Send the function call request
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: functionName,
        arguments: params
      }
    };

    mcpProcess.stdin.write(JSON.stringify(request) + '\n');
    mcpProcess.stdin.end();

    mcpProcess.stdout.on('data', (data) => {
      outputData += data.toString();
    });

    mcpProcess.stderr.on('data', (data) => {
      errorData += data.toString();
    });

    mcpProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('MCP process error:', errorData);
        reject(new Error(`MCP process exited with code ${code}: ${errorData}`));
        return;
      }

      try {
        // Parse the JSON-RPC response
        const lines = outputData.trim().split('\n');
        const lastLine = lines[lines.length - 1];
        const response = JSON.parse(lastLine);
        
        if (response.error) {
          reject(new Error(`MCP error: ${response.error.message}`));
        } else {
          resolve(response.result);
        }
      } catch (parseError) {
        console.error('Failed to parse MCP response:', outputData);
        reject(new Error(`Failed to parse MCP response: ${parseError.message}`));
      }
    });

    // Set a timeout
    setTimeout(() => {
      mcpProcess.kill();
      reject(new Error('MCP call timeout'));
    }, 30000); // 30 second timeout
  });
}


app.listen(PORT, () => {
  console.log(`MCP Airbnb Server running on port ${PORT}`);
  console.log('Ready to receive MCP Airbnb search requests');
});

module.exports = app;