# 🚀 Deployment Instructions for Airbnb Search App

## Current Situation
- ✅ **Code is working perfectly** - all API logic tested and confirmed working
- ✅ **MCP server integration working** - Railway server returning 18 results for Malibu
- ❌ **Production domain `chatbnb.vercel.app` hosts a different app** (Clerk authentication app)
- ❌ **Our airbnb-search app is not deployed anywhere**

## Quick Fix: Deploy to New Domain

### Option 1: Deploy to New Vercel Project
```bash
# 1. Login to Vercel
npx vercel login

# 2. Deploy to a new project (will create new domain)
npx vercel --prod

# 3. When prompted:
#    - Project name: "airbnb-search-app" (or your choice)
#    - This will create a NEW domain like: airbnb-search-app.vercel.app
```

### Option 2: Deploy with Specific Project Name
```bash
# Deploy with custom name
npx vercel --prod --name airbnb-natural-search

# This creates: airbnb-natural-search.vercel.app
```

### Option 3: Link to Different Vercel Project
```bash
# Create new Vercel project first, then link
npx vercel link
# Follow prompts to create new project or link to existing one
npx vercel --prod
```

## Environment Variables
The deployment should automatically use the `vercel.json` config:
```json
{
  "env": {
    "MCP_SERVER_URL": "https://airbnb-mcp-production.up.railway.app"
  }
}
```

## Testing the New Deployment

### 1. Test API Endpoint
```bash
curl -X POST https://[YOUR-NEW-DOMAIN].vercel.app/api/unified-search \
  -H "Content-Type: application/json" \
  -d '{"location": "Malibu", "adults": 2, "query": "beach house"}'
```

### 2. Expected Response
```json
{
  "listings": [/* 18 Airbnb listings */],
  "hasMore": true,
  "totalResults": 18,
  "page": 1,
  "sources": [
    {
      "platform": "airbnb",
      "count": 18,
      "status": "success"
    }
  ]
}
```

### 3. Test Frontend
Visit `https://[YOUR-NEW-DOMAIN].vercel.app` and try:
- "Beach house in Malibu for 2 adults"
- "Luxury loft in Austin under $200"

## Why This Will Work

### ✅ Confirmed Working Components
1. **MCP Server**: `https://airbnb-mcp-production.up.railway.app` ✅
2. **API Logic**: `/api/unified-search.ts` tested and working ✅
3. **Data Transformation**: Price/rating extraction working ✅
4. **Frontend**: App.tsx correctly calls `/api/unified-search` ✅

### 🔧 What Just Needs New Deployment
- The entire application just needs to be deployed to a new domain
- All the code is correct and tested
- The MCP integration is fully functional

## Alternative: Fix Current Domain
If you have access to the Vercel project for `chatbnb.vercel.app`:
1. Check what project is deployed there
2. Either redeploy this code to that project
3. Or switch the domain to point to a new project

## Next Steps
1. **Deploy immediately** using Option 1 above
2. **Test the new domain** with the curl command
3. **Verify frontend works** with search queries
4. **Update any hardcoded references** to the old domain (if needed)

The application is ready to go - it just needs a proper deployment!