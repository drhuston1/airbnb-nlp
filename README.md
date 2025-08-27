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

## Search Implementation Options

The app is now configured for **Real MCP Integration**. Here are all available options:

### 🔥 Real MCP Integration (Current - Real Airbnb Data!)
- **Endpoint**: `/api/mcp-search`
- **Features**: Actual Airbnb listings via MCP server
- **Pros**: Real data, real prices, real availability
- **Setup**: Deploy the included MCP server (see instructions below)

### 🎯 Demo Mode (Fallback)
- **Endpoint**: `/api/demo-search`
- **Features**: Realistic listings using real location data + market trends
- **Pros**: Works immediately, no API keys needed, realistic results
- **Cons**: Not real Airbnb data

### 🌐 Proxy Services (API Key Required)
Switch to `/api/proxy-search` and configure one of these:

#### Option A: ScrapingBee (Recommended)
```bash
# Add to Vercel environment
SCRAPINGBEE_API_KEY=your_key_here
```
- **Cost**: Free tier: 1,000 requests/month
- **Pros**: Real Airbnb data, reliable
- **Setup**: https://www.scrapingbee.com

#### Option B: RapidAPI Travel APIs
```bash
# Add to Vercel environment  
RAPIDAPI_KEY=your_key_here
```
- **Cost**: Various free tiers
- **Pros**: Multiple travel sites, structured data
- **Setup**: https://rapidapi.com/hub

#### Option C: SerpAPI
```bash
# Add to Vercel environment
SERPAPI_KEY=your_key_here  
```
- **Cost**: Free tier: 100 searches/month
- **Pros**: Google search results
- **Setup**: https://serpapi.com

### 🛠️ Direct Web Scraping
- **Endpoint**: `/api/direct-search` 
- **Pros**: No API costs
- **Cons**: May be blocked, unreliable

### 🔧 MCP Server (Advanced)
- **Endpoint**: `/api/search-real`
- **Setup**: Deploy separate MCP server to cloud
- **Pros**: Full control, can integrate multiple sources
- **Cons**: Requires server deployment

## 🚀 Quick Setup for Real MCP Data

### Step 1: Deploy MCP Server
Choose one of these options:

#### Railway (Easiest)
1. Go to [Railway.app](https://railway.app)
2. Create new project from your GitHub repo
3. Set root directory to `mcp-server`
4. Deploy

#### Fly.io
```bash
cd mcp-server
flyctl launch
flyctl deploy
```

### Step 2: Configure MCP Server
1. Install MCP dependencies in your deployed server:
   ```bash
   npm install @modelcontextprotocol/client
   ```

2. Edit `mcp-server/server.js` and uncomment the MCP integration code

3. Redeploy your server

### Step 3: Update Vercel Environment
Add this environment variable in your Vercel dashboard:
```
MCP_SERVER_URL=https://your-mcp-server.railway.app
```

### Step 4: Deploy and Test
Your app will now return real Airbnb listings! 🎉

## Switching Between Options

Change endpoint in `src/services/airbnbService.ts`:
```typescript
// Current: mcp-search (real data)
// Options: demo-search, proxy-search, direct-search
const response = await fetch('/api/mcp-search', {
```

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
