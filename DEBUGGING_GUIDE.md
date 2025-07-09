# 🔍 Comprehensive Debugging Guide

## What to Look For in Vercel Function Logs

When the scraper runs, you'll now see detailed logging that will help identify exactly where any failures occur:

### 1. Environment Detection Logs
```
🎭 Using Playwright with serverless Chromium
🔍 Environment variables:
  - VERCEL: 1
  - AWS_LAMBDA_FUNCTION_NAME: undefined
  - NODE_ENV: production
  - Platform: linux
  - Architecture: x64
🎯 Environment detection result: SERVERLESS
```

### 2. Chromium Loading Process
```
🌐 Serverless environment detected, attempting @sparticuz/chromium
📦 Loading @sparticuz/chromium module...
✅ Dynamic import function created
✅ @sparticuz/chromium module loaded successfully
✅ Chromium package extracted from module
🚀 Chromium details:
  - Executable path: /tmp/.../chrome
  - Headless mode: true
  - Default args count: 25
  - Default args: --no-sandbox, --disable-setuid-sandbox, ...
🔧 Final launch args count: 30
🚀 Launching Chromium with serverless configuration...
✅ Chromium launched successfully in serverless mode!
```

### 3. Browser Info
```
🎉 Browser initialization completed successfully!
📊 Browser info:
  - Version: 131.0.6778.69
  - Connected: true
```

### 4. Page Creation and Setup
```
📄 Creating new page...
✅ Page created successfully
🔧 Setting page configuration...
  - User agent set
  - Viewport size set
  - Resource blocking configured
🎉 Page setup completed successfully!
```

### 5. Scraper Execution Flow
```
🚀 Scraper API request started at: 2025-01-09T21:30:45.123Z
📝 Request parameters:
  - Platform: airbnb
  - Location: Charleston SC
  - Adults: 1
🏠 Initiating Airbnb scraper...
🏠 Starting Airbnb scraper function
⚙️ Initializing scraper manager...
📄 Creating page...
🔗 Built Airbnb URL: https://www.airbnb.com/s/Charleston%20SC?adults=1
🌐 Navigating to Airbnb...
✅ Navigation completed
⏱️ Adding human-like delay...
🔍 Waiting for listings to load...
📋 Listings found: true
```

### 6. Success Results
```
✅ airbnb scraper completed successfully!
📊 Results summary:
  - Properties found: 18
  - Has more pages: true
  - Total duration: 15247ms
  - Images extracted: 54
```

## Common Error Scenarios & What to Look For

### A. ES Module Import Error
**Look for:**
```
❌ Failed to load @sparticuz/chromium:
  - Error type: Error
  - Error message: require() of ES Module ... not supported
  - Error code: ERR_REQUIRE_ESM
```
**Fix:** Our eval-based dynamic import should prevent this

### B. Chrome Executable Not Found
**Look for:**
```
❌ Failed to load @sparticuz/chromium:
  - Error message: Executable doesn't exist at /tmp/.../chrome
```
**Indicates:** @sparticuz/chromium package issue

### C. Fallback to System Chrome
**Look for:**
```
🔄 Attempting fallback to system Chrome...
✅ System Chrome fallback successful
```
**Indicates:** Serverless Chrome failed but fallback worked

### D. Complete Failure
**Look for:**
```
❌ System Chrome fallback also failed:
  - Fallback error: Executable doesn't exist at .../chromium_headless_shell
Both serverless and system Chrome failed
```
**Indicates:** Need different approach

### E. Navigation Issues
**Look for:**
```
⚠️ No listings found on Airbnb page
🔍 Checking page content for debugging...
  - Page title: Access to this page has been denied
  - Current URL: https://www.airbnb.com/err?...
```
**Indicates:** Blocked by anti-bot measures

## Debugging Steps by Error Type

### 1. If Dynamic Import Fails
- Check if `new Function()` approach worked
- Look for "Dynamic import function created" message
- If missing, try different import strategy

### 2. If Chromium Executable Missing
- Verify @sparticuz/chromium version compatibility
- Check if executable path is being generated
- Consider switching to different serverless Chrome package

### 3. If Browser Launch Fails
- Check launch arguments compatibility
- Verify memory/CPU limits in Vercel
- Consider reducing browser arguments

### 4. If Page Navigation Fails
- Check if anti-bot detection is triggered
- Verify URL format and parameters
- Test with simpler page first

### 5. If Selectors Not Found
- Check if page structure changed
- Verify wait timeouts are sufficient
- Test selectors in browser console

## Performance Debugging

### Expected Timings
- **Browser Initialization:** 2-5 seconds
- **Page Creation:** 500ms-1s  
- **Navigation:** 3-8 seconds
- **Selector Wait:** 1-3 seconds
- **Data Extraction:** 1-2 seconds
- **Total Duration:** 15-30 seconds per platform

### Memory Usage
- Monitor for out-of-memory errors
- Check if multiple browser instances are created
- Verify browser cleanup in finally blocks

## Quick Diagnosis Checklist

1. ✅ **Environment Detection** - Shows "SERVERLESS" in logs?
2. ✅ **Module Loading** - Shows "Successfully loaded @sparticuz/chromium"?
3. ✅ **Browser Launch** - Shows "Chromium launched successfully"?
4. ✅ **Page Creation** - Shows "Page setup completed successfully"?
5. ✅ **Navigation** - Shows "Navigation completed"?
6. ✅ **Content Loading** - Shows "Listings found: true"?

Any "❌" or missing step indicates where the failure occurs!

## Emergency Fallbacks

If all else fails, the comprehensive logging will show exactly which component failed, allowing for targeted fixes or alternative approaches.