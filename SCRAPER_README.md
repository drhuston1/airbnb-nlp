# Web Scraper Implementation Guide

## Overview

This project now includes a robust web scraper that can extract property listings from multiple platforms (Airbnb, Booking.com, and VRBO) without requiring API keys. The scraper automatically falls back when the MCP server is unavailable.

## Features

✅ **Multi-platform support**: Airbnb, Booking.com, and VRBO  
✅ **Automatic fallback**: Uses scraper when MCP server fails  
✅ **Rate limiting**: Built-in delays to avoid detection  
✅ **Error handling**: Comprehensive retry logic  
✅ **Data normalization**: Consistent output format across platforms  
✅ **Resource optimization**: Blocks unnecessary resources for faster scraping  

## Architecture

### API Endpoints

1. **`/api/scraper`** - Direct scraper endpoint
2. **`/api/unified-search`** - Unified search with automatic fallback
3. **`/api/scraper-utils`** - Utility functions and classes

### Scraper Flow

```
User Request → Unified Search → Try MCP Server → If fails → Web Scraper → Results
```

## Usage

### Direct Scraper API

```bash
POST /api/scraper
Content-Type: application/json

{
  "platform": "airbnb",  // or "booking" or "vrbo"
  "location": "Malibu, CA",
  "adults": 2,
  "children": 0,
  "checkin": "2024-08-01",  // optional
  "checkout": "2024-08-07", // optional
  "page": 1
}
```

### Unified Search API (Recommended)

```bash
POST /api/unified-search
Content-Type: application/json

{
  "query": "Luxury beachfront villa in Malibu",
  "location": "Malibu, CA",
  "adults": 2,
  "platforms": ["airbnb", "booking", "vrbo"]  // will use scraper for booking and vrbo
}
```

## Configuration

### Environment Variables

- `MCP_SERVER_URL` - External MCP server URL (optional, defaults to Railway instance)

### Scraper Settings

The scraper includes several built-in optimizations:

- **Rate limiting**: 2-4 second delays between requests
- **Resource blocking**: Images, CSS, fonts blocked for speed
- **User agent rotation**: Appears as regular browser
- **Retry logic**: 2 retries with exponential backoff
- **Timeout handling**: 30-second page load timeout

## Deployment

### Vercel Deployment

1. **Build the project**:
```bash
npm run build
```

2. **Deploy to Vercel**:
```bash
vercel --prod
```

3. **Test the scraper**:
```bash
curl -X POST https://your-app.vercel.app/api/scraper \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "airbnb",
    "location": "Miami, FL",
    "adults": 2
  }'
```

### Memory and Performance

The scraper is optimized for Vercel's serverless environment:

- **Memory usage**: ~128MB per instance
- **Execution time**: 15-30 seconds per request
- **Concurrent requests**: Limited by Vercel plan
- **Resource optimization**: Blocks unnecessary content

## Error Handling

The scraper includes comprehensive error handling:

```typescript
// Automatic fallback from MCP to scraper
MCP Server → (timeout/error) → Web Scraper → Results

// Retry logic for failed requests
Request → (fail) → Wait → Retry → (fail) → Wait → Retry → Final Result

// Graceful degradation
No results found → Return empty array with proper metadata
```

## Limitations and Considerations

### Vercel Limitations

- **10-second timeout** on Hobby plan (upgrade to Pro for 60 seconds)
- **Memory limits** vary by plan
- **Concurrent executions** limited by plan

### Legal and Ethical

- **Respect robots.txt**: The scraper ignores robots.txt for legitimate research
- **Rate limiting**: Built-in delays to be respectful
- **Data usage**: Only extract publicly available information
- **Terms of service**: Review platform ToS for compliance

### Technical Limitations

- **Dynamic content**: Some listings may require JavaScript execution
- **Captchas**: May encounter anti-bot measures (especially VRBO)
- **Layout changes**: Platform updates may require scraper updates
- **IP blocking**: Use rotating proxies if necessary

### Platform-Specific Notes

#### VRBO
- **Slower loading**: VRBO pages take longer to load than Airbnb
- **Different selectors**: Uses different DOM structure than other platforms
- **Vacation focus**: Primarily vacation rentals (houses, condos)
- **Higher prices**: Generally targets longer stays and larger groups
- **No superhost**: VRBO doesn't have a superhost equivalent

#### Booking.com
- **Mixed inventory**: Includes hotels and vacation rentals
- **10-point rating**: Ratings converted to 5-point scale
- **International focus**: Better coverage outside the US

#### Airbnb
- **MCP fallback**: Uses fast MCP server first, scraper as backup
- **Superhost badges**: Includes superhost status
- **Rich amenities**: Better amenity detection

## Monitoring and Debugging

### Logs

The scraper provides detailed logging:

```javascript
console.log('Navigating to Airbnb URL:', searchUrl)
console.log('Platform search results:', results)
console.warn('No listings found on page')
console.error('Scraper error:', error)
```

### Health Checks

Monitor scraper health through:

- **Response times**: Should be < 30 seconds
- **Success rates**: Monitor error rates
- **Result quality**: Check for empty results

### Debugging Common Issues

1. **No results returned**:
   - Check if selectors are still valid
   - Verify the search URL format
   - Look for CAPTCHA or blocking

2. **Timeout errors**:
   - Increase timeout values
   - Upgrade Vercel plan
   - Optimize resource blocking

3. **Memory errors**:
   - Check browser instance cleanup
   - Monitor memory usage
   - Upgrade Vercel plan

## Future Enhancements

Potential improvements for the scraper:

1. **Proxy rotation**: Add proxy support for better reliability
2. **CAPTCHA solving**: Integrate CAPTCHA solving services
3. **More platforms**: Add support for HomeAway, Expedia, etc.
4. **Caching**: Add Redis caching for frequent searches
5. **Parallel processing**: Scrape multiple pages simultaneously
6. **Machine learning**: Use ML for better data extraction

## Testing

### Local Testing

```bash
# Install dependencies
npm install

# Run the test script
node test-scraper.js
```

### Production Testing

```bash
# Test Airbnb scraper
curl -X POST https://your-app.vercel.app/api/scraper \
  -H "Content-Type: application/json" \
  -d '{"platform": "airbnb", "location": "New York, NY", "adults": 2}'

# Test Booking.com scraper
curl -X POST https://your-app.vercel.app/api/scraper \
  -H "Content-Type: application/json" \
  -d '{"platform": "booking", "location": "Paris, France", "adults": 2}'

# Test VRBO scraper
curl -X POST https://your-app.vercel.app/api/scraper \
  -H "Content-Type: application/json" \
  -d '{"platform": "vrbo", "location": "Orlando, FL", "adults": 4, "children": 2}'

# Test unified search with fallback
curl -X POST https://your-app.vercel.app/api/unified-search \
  -H "Content-Type: application/json" \
  -d '{"query": "Beach house", "location": "Malibu, CA", "platforms": ["airbnb", "booking", "vrbo"]}'
```

## Support

If you encounter issues:

1. Check Vercel function logs
2. Verify the selectors are still valid
3. Test with different locations
4. Review error messages for specific issues

The scraper is designed to be robust and handle various edge cases, but web scraping inherently involves some fragility as websites change their structure.