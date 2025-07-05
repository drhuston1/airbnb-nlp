# MCP Airbnb Server

This is a standalone server that provides HTTP endpoints for the Airbnb MCP functionality. Deploy this to a cloud service to enable real Airbnb search in your app.

## Quick Deploy Options

### Option 1: Railway (Recommended)
1. Go to [Railway.app](https://railway.app)
2. Create new project from GitHub repo
3. Point to the `mcp-server` folder
4. Deploy automatically

### Option 2: Fly.io
```bash
cd mcp-server
flyctl launch
flyctl deploy
```

### Option 3: Render
1. Go to [Render.com](https://render.com)
2. Create new Web Service
3. Connect your GitHub repo
4. Set root directory to `mcp-server`
5. Deploy

## Setup Steps

### 1. Install MCP Dependencies
After deployment, you need to configure the MCP client:

```bash
npm install @modelcontextprotocol/client
```

### 2. Configure MCP Client
Edit `server.js` and uncomment the MCP integration code:

```javascript
const { MCPClient } = require('@modelcontextprotocol/client');
const { StdioServerTransport } = require('@modelcontextprotocol/client/stdio');

const mcpClient = new MCPClient();
const transport = new StdioServerTransport();

await mcpClient.connect(transport);

const result = await mcpClient.callTool({
  name: 'mcp__openbnb-airbnb__airbnb_search',
  arguments: {
    location,
    adults,
    children,
    infants,
    pets,
    ignoreRobotsText: true
  }
});
```

### 3. Update Your Vercel App
Add environment variable to your Vercel deployment:

```bash
MCP_SERVER_URL=https://your-mcp-server.railway.app
```

### 4. Test the Integration
Your app will now use real Airbnb data from the MCP server!

## API Endpoints

- `GET /` - Health check
- `POST /airbnb-search` - Search Airbnb listings
- `POST /airbnb-details` - Get detailed listing information

## Environment Variables

- `PORT` - Server port (default: 3001)
- `MCP_SERVER_TOKEN` - Optional authentication token

## Local Development

```bash
cd mcp-server
npm install
npm run dev
```

Server will run on http://localhost:3001

## Troubleshooting

1. **MCP Client Connection Issues**: Ensure the MCP server is properly configured
2. **CORS Errors**: The server includes CORS middleware for all origins
3. **Deployment Issues**: Check logs in your hosting platform dashboard