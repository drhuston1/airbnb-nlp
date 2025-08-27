# OpenAI API Setup Instructions

## Required: Add OpenAI API Key to Vercel

The application now uses GPT-4o-mini for location extraction instead of the problematic NER model. You need to add your OpenAI API key to Vercel.

### Step 1: Get OpenAI API Key
1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Copy the key (starts with `sk-`)

### Step 2: Add to Vercel Environment Variables
1. Go to your Vercel dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add a new variable:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: Your OpenAI API key (sk-...)
   - **Environment**: Production, Preview, Development (select all)

### Step 3: Redeploy
1. After adding the environment variable, trigger a new deployment
2. You can do this by pushing a new commit or manually redeploying in Vercel

## Cost Estimate
- GPT-4o-mini is extremely cheap: $0.00015 per 1K input tokens
- Each location extraction costs approximately $0.000025 (2.5 cents per 1000 searches)
- Much more reliable than the NER model

## What This Fixes
- ❌ Old: "Colorado" → "abi Colorado" (wrong!)
- ✅ New: "Colorado" → "Colorado" (correct!)
- ❌ Old: "Malibu" → Returns random Croatia properties
- ✅ New: "Malibu" → Returns actual Malibu properties

## Testing
Once deployed with the API key, test with:
- "Cabin in Colorado for Christmas week 2024"
- "Beach house in Malibu for vacation"
- "Apartment in San Francisco downtown"

All should return accurate location-specific results.