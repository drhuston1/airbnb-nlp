# Airbnb Natural Language Search

A React application that allows users to search for Airbnb listings using natural language queries. Built with React, TypeScript, Vite, and Chakra UI, designed for deployment on Vercel.

## Features

- **Natural Language Search**: Type queries like "Find me a cozy apartment in Paris with a kitchen for 2 guests"
- **Modern UI**: Clean, responsive interface built with Chakra UI
- **Real-time Results**: Fast search with loading states and error handling
- **MCP Integration**: Ready for integration with Airbnb MCP server

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **UI Library**: Chakra UI
- **Backend**: Vercel Serverless Functions
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd airbnb-search
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:5173](http://localhost:5173) in your browser

## Deployment

### Deploy to Vercel

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

Or connect your GitHub repository to Vercel for automatic deployments.

### Environment Setup

The application is configured to work with Vercel's serverless functions out of the box. The API endpoints are located in the `/api` directory.

## MCP Server Integration

Currently, the app returns helpful error messages indicating that MCP server setup is required. To enable real Airbnb search:

### Option 1: Deploy Separate MCP Server (Recommended)

1. **Set up MCP Server**: Use the provided `mcp-server-example.js` as a starting point
2. **Deploy to Cloud**: Deploy your MCP server to Railway, Fly.io, or Heroku
3. **Configure Environment**: Set `MCP_SERVER_URL` in your Vercel environment variables
4. **Update API**: Uncomment the fetch code in `/api/search-real.ts`

### Option 2: Direct Integration

Since Vercel serverless functions can't directly access MCP tools, you need a bridge service:

```typescript
// Example deployment setup
const mcpServerUrl = process.env.MCP_SERVER_URL
const response = await fetch(`${mcpServerUrl}/search`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(searchParams)
})
```

### Setting Up Your MCP Server

1. **Install Dependencies**:
```bash
npm install @modelcontextprotocol/client express cors
```

2. **Create MCP Server** (see `mcp-server-example.js`):
```javascript
const searchResult = await mcpClient.callTool({
  name: 'mcp__openbnb-airbnb__airbnb_search',
  arguments: {
    location,
    adults,
    children,
    ignoreRobotsText: true
  }
})
```

3. **Deploy and Connect**: Update your Vercel environment with the MCP server URL

## Natural Language Processing

The application parses natural language queries to extract:

- **Location**: "in Paris", "near Tokyo", "at New York"
- **Guest Count**: "for 2 guests", "4 people", "3 adults"
- **Price Range**: "under $100", "max $200", "between $50-150"
- **Dates**: "from July 1st", "check-in June 15th"
- **Special Requirements**: "pet-friendly", "with kitchen", "has pool"

## API Endpoints

- `POST /api/search-real` - Main search endpoint that processes natural language queries
- Query parameters: `location`, `checkin`, `checkout`, `adults`, `children`, `minPrice`, `maxPrice`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details
