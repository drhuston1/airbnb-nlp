# 🔧 Scraper Testing Mode

## Current Status: MCP DISABLED ✅ + SERVERLESS CHROME ENABLED ✅

The MCP server has been **temporarily disabled** to test the full scraping functionality with images.

**✅ FIXED**: Chrome compatibility issue resolved by switching to Puppeteer + `chrome-aws-lambda` for Vercel serverless functions.

### What's Changed

**Before** (MCP Mode):
- Airbnb: MCP Server (fast, but limited images)
- Booking.com: Web Scraper  
- VRBO: Web Scraper

**Now** (Testing Mode):
- **Airbnb: Web Scraper** 🔧
- Booking.com: Web Scraper
- VRBO: Web Scraper

### How to Test

1. **Deploy to Vercel**:
```bash
vercel --prod
```

2. **Test a search** with all platforms:
```bash
curl -X POST https://your-app.vercel.app/api/unified-search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Beach house with pool",
    "location": "Malibu, CA",
    "adults": 2,
    "platforms": ["airbnb", "booking", "vrbo"]
  }'
```

3. **Check the results**:
   - ✅ All platforms should return results
   - ✅ Images should be included in the response
   - ✅ Platform badges should show correctly
   - ✅ Console should show "🔧 TESTING MODE" message

### What to Look For

#### Image Testing
- **Property images**: Each listing should have `images` array
- **Image URLs**: Should be real image URLs, not placeholders
- **Multiple images**: Some listings should have multiple images
- **Image display**: Images should show in the UI listing cards
- **Fallback placeholders**: When images fail, should show platform logos

#### Performance Testing
- **Response time**: Should be 15-30 seconds per platform
- **Success rate**: Most searches should return results
- **Error handling**: Graceful failure when platforms are unavailable

#### Platform Comparison
- **Airbnb scraper**: Compare with previous MCP results
- **Booking.com**: Hotels + vacation rentals
- **VRBO**: Vacation homes and larger properties

### Expected Response Format

```json
{
  "listings": [
    {
      "id": "airbnb_123",
      "name": "Beautiful Beach House",
      "url": "https://www.airbnb.com/rooms/123",
      "images": [
        "https://a0.muscache.com/im/pictures/...",
        "https://a0.muscache.com/im/pictures/..."
      ],
      "price": {
        "rate": 200,
        "total": 1400,
        "currency": "USD"
      },
      "rating": 4.8,
      "reviewsCount": 127,
      "location": {
        "city": "Malibu, CA",
        "country": "US"
      },
      "host": {
        "name": "Superhost",
        "isSuperhost": true
      },
      "amenities": ["Pool", "WiFi", "Kitchen"],
      "roomType": "Entire place",
      "platform": "airbnb"
    }
  ],
  "hasMore": true,
  "totalResults": 24,
  "page": 1,
  "sources": [
    {
      "platform": "airbnb",
      "count": 8,
      "status": "success"
    },
    {
      "platform": "booking",
      "count": 7,
      "status": "success"
    },
    {
      "platform": "vrbo",
      "count": 9,
      "status": "success"
    }
  ]
}
```

### Recent Fixes Applied

**✅ Chrome Installation Issue Fixed**:
- **Problem**: `Cannot find package '@sparticuz/chromium'` and module resolution issues in Vercel serverless environment
- **Solution**: Switched to `puppeteer-core` + `chrome-aws-lambda` (CommonJS) with compatible versions and environment detection
- **Result**: Chrome now works in serverless Vercel functions with automatic local/serverless detection and CommonJS compatibility

**✅ Function Timeout Extended**:
- **Added**: 60-second timeout for scraper functions in `vercel.json`
- **Reason**: Puppeteer needs more time than the default 10-second limit

**✅ Development vs Production**:
- **Local**: Uses system Chromium via Playwright for development  
- **Vercel**: Uses @sparticuz/chromium for serverless compatibility
- **Auto-detection**: Automatically detects environment and chooses appropriate browser

### Debugging Issues

If you encounter problems:

1. **Check Vercel function logs** for error details
2. **Look for Chrome/Playwright errors** (should be fixed now with @sparticuz/chromium)
3. **Verify platform selectors** are still working
4. **Check environment detection** - should log either "Local environment" or "Serverless environment"
5. **Test individual platforms** separately:

```bash
# Test Airbnb scraper only
curl -X POST https://your-app.vercel.app/api/scraper \
  -H "Content-Type: application/json" \
  -d '{"platform": "airbnb", "location": "Miami, FL", "adults": 2}'

# Test Booking.com scraper only  
curl -X POST https://your-app.vercel.app/api/scraper \
  -H "Content-Type: application/json" \
  -d '{"platform": "booking", "location": "Paris, France", "adults": 2}'

# Test VRBO scraper only
curl -X POST https://your-app.vercel.app/api/scraper \
  -H "Content-Type: application/json" \
  -d '{"platform": "vrbo", "location": "Orlando, FL", "adults": 4}'
```

## How to Re-enable MCP Server

When you're done testing, restore the MCP server by editing `/api/unified-search.ts`:

```typescript
// Change this:
if (platforms.includes('airbnb')) {
  // Temporarily disabled MCP - using scraper for testing
  // searchPromises.push(
  //   callPlatformAPI('/api/mcp-search', searchPayload, 'airbnb')
  // )
  
  // Force use of scraper for Airbnb to test image functionality
  console.log('🔧 TESTING MODE: Using scraper for Airbnb instead of MCP server')
  searchPromises.push(
    callPlatformAPI('/api/scraper', searchPayload, 'airbnb')
  )
}

// Back to this:
if (platforms.includes('airbnb')) {
  searchPromises.push(
    callPlatformAPI('/api/mcp-search', searchPayload, 'airbnb')
  )
}
```

## Testing Checklist

- [ ] All 3 platforms return results
- [ ] Images are present in response JSON
- [ ] Images display in UI listing cards
- [ ] Platform badges show correctly
- [ ] Fallback placeholders work when images fail
- [ ] Response times are acceptable
- [ ] Error handling works gracefully
- [ ] Multiple images show "+X more" overlay
- [ ] Console shows testing mode message

## Known Limitations in Testing Mode

- **Slower than MCP**: Scraping takes longer than MCP API calls
- **Rate limiting**: May hit platform rate limits with frequent testing
- **Captchas**: May encounter anti-bot measures
- **Vercel timeouts**: May need Pro plan for reliable operation

This testing mode lets you fully evaluate the scraper's image functionality before deciding whether to use it as the primary method or as a fallback!