// Vercel API function that replicates your local MCP server functionality
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method === 'GET') {
    return res.json({ 
      status: 'MCP Airbnb Server Running (Vercel)',
      version: '1.0.0',
      endpoints: ['/api/mcp-airbnb-proxy'],
      mcpToolsAvailable: true
    })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { query, location, adults = 1, children = 0, infants = 0, pets = 0, checkin, checkout, minPrice, maxPrice, page = 1 } = req.body

    // Support both natural language query and structured parameters
    if (!query && !location) {
      return res.status(400).json({ error: 'Query or location is required' })
    }

    console.log('Vercel MCP - Searching Airbnb for:', { query, location, adults, children, infants, pets, page })

    // Convert page number to cursor for MCP
    let cursor = null
    if (page > 1) {
      const cursors = [
        null, // page 1
        "eyJzZWN0aW9uX29mZnNldCI6MCwiaXRlbXNfb2Zmc2V0IjoxOCwidmVyc2lvbiI6MX0=", // page 2
        "eyJzZWN0aW9uX29mZnNldCI6MCwiaXRlbXNfb2Zmc2V0IjozNiwidmVyc2lvbiI6MX0=", // page 3
        "eyJzZWN0aW9uX29mZnNldCI6MCwiaXRlbXNfb2Zmc2V0Ijo1NCwidmVyc2lvbiI6MX0=", // page 4
      ]
      cursor = cursors[page - 1] || cursors[cursors.length - 1]
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
      }
    
    const result = await callOpenBNBMCP(searchParams)
    return res.json(result)

  } catch (error) {
    console.error('Vercel MCP - Airbnb search error:', error)
    res.status(500).json({ 
      error: 'Search failed', 
      details: error instanceof Error ? error.message : 'Unknown error',
      suggestion: 'OpenBNB MCP server integration failed'
    })
  }
}

// Function to call OpenBNB MCP functions
async function callOpenBNBMCP(params: Record<string, unknown>) {
  console.log('Vercel MCP - Calling OpenBNB with params:', params)
  
  let client = null
  
  try {
    // Use dynamic import for ES modules
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js')
    const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js')
    
    // Create a client connection to the OpenBNB MCP server
    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['@openbnb/mcp-server-airbnb']
    })
    
    client = new Client({
      name: 'airbnb-search-client-vercel',
      version: '1.0.0'
    }, {
      capabilities: {}
    })
    
    // Connect and call tool
    await client.connect(transport)
    console.log('Vercel MCP - Connected to OpenBNB server')
    
    // List tools to find correct name
    let toolToUse = 'airbnb_search'
    
    try {
      const tools = await client.listTools()
      console.log('Vercel MCP - Available tools:', tools.tools?.map(t => t.name))
      
      const availableToolNames = tools.tools?.map(tool => tool.name) || []
      const searchTool = availableToolNames.find(name => 
        name.includes('search') || name.includes('airbnb')
      ) || availableToolNames[0]
      
      if (searchTool) {
        toolToUse = searchTool
        console.log(`Vercel MCP - Using tool: ${searchTool}`)
      }
    } catch {
      console.log('Vercel MCP - Could not list tools, using default:', toolToUse)
    }
    
    // Call the tool
    const result = await client.callTool({
      name: toolToUse,
      arguments: params
    })
    
    console.log('Vercel MCP - Tool call successful')
    
    // Handle error responses
    if (result.isError || (result.content && result.content[0] && result.content[0].text && result.content[0].text.startsWith('Error:'))) {
      const errorMsg = result.content?.[0]?.text || 'Unknown MCP error'
      throw new Error(`MCP tool error: ${errorMsg}`)
    }
    
    // Handle different response formats
    if (result.content && result.content[0] && result.content[0].text) {
      try {
        return JSON.parse(result.content[0].text)
      } catch {
        console.log('Vercel MCP - Response is not JSON, returning as-is')
        return { searchResults: [], searchUrl: '', message: result.content[0].text }
      }
    } else {
      return result
    }
    
  } catch (error) {
    console.error('Vercel MCP - SDK error:', error)
    throw new Error(`MCP SDK error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    if (client) {
      try {
        await client.close()
      } catch (closeError) {
        console.error('Vercel MCP - Error closing client:', closeError)
      }
    }
  }
}