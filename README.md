# Airbnb Natural Language Search

A React + Vercel app that searches Airbnb and Booking.com using natural language. The backend provides a single `/api/search` endpoint with LLM tool-calling orchestration and a deterministic fallback.

## Features

- **Natural Language Search**: Type queries like "2BR in Charleston under $200/night for 2 adults"
- **Unified Endpoint**: Single `POST /api/search` handles param extraction and provider calls
- **LLM Tool-Calling**: Orchestrates `extract_params`, `search_airbnb`, `search_booking` (optional)
- **Fallback Parser**: Works without LLM using compromise + regex

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

Set environment variables locally (`.env.local`) and in Vercel:

```
OPENAI_API_KEY=your_openai_api_key   # enables LLM tool-calling
SCRAPINGBEE_API_KEY=your_key         # optional; proxies Airbnb HTTP for reliability
SERPAPI_KEY=your_serpapi_key         # optional; enables Booking.com/Google Hotels
```

## How It Works

1. The frontend posts `{ query, page }` to `/api/search`.
2. The backend tries LLM tool-calling (if `OPENAI_API_KEY` is set):
   - Calls `extract_params` to get location, dates, guests, price.
   - Calls `search_airbnb` (and `search_booking` if configured).
   - Merges, dedupes, and sorts results by trust score, rating, then price.
3. If LLM is not available, the fallback parser extracts params and calls providers directly.

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

## API Endpoint

- `POST /api/search` - unified search
  - Body: `{ query: string, page?: number }`
  - Response: `{ listings: Property[], sources: SourceStatus[], page: number }`
  - Providers: Airbnb (always), Booking (if `SERPAPI_KEY` set)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details
