# Airbnb Search Application - Sequence Diagrams

## Main Search Flow

```mermaid
sequenceDiagram
    participant U as User
    participant A as App.tsx
    participant CQ as /api/classify-query
    participant AQ as /api/analyze-query
    participant G as Geocoding Service
    participant O as OpenAI API
    participant US as /api/unified-search
    participant AB as Airbnb HTTP API
    participant RA as RefinementAnalyzer

    U->>A: Enter search query
    A->>A: Set loading state
    
    A->>CQ: POST query classification
    CQ->>O: Classify intent (search/travel/refinement)
    O-->>CQ: Classification result
    CQ-->>A: Query type & confidence
    
    alt Query Type: search
        A->>AQ: POST analyze query
        AQ->>O: Extract structured criteria
        O-->>AQ: Parsed location, dates, filters
        AQ->>G: Validate location
        G-->>AQ: Location validation/disambiguation
        AQ-->>A: Enhanced search criteria
        
        opt Location disambiguation needed
            A->>A: Show LocationDisambiguationModal
            U->>A: Select location
            A->>A: Update search context
        end
        
        A->>US: POST unified search
        US->>US: Build Airbnb API parameters
        US->>AB: GET search listings
        AB-->>US: Raw property data
        US->>US: Transform to unified format
        US->>US: Calculate trust scores
        US->>O: Apply semantic filtering
        O-->>US: Filtered results
        US-->>A: Processed listings
        
        A->>RA: Analyze results for refinements
        RA-->>A: Quick filter suggestions
        A->>A: Update results panel & show listings
        
    else Query Type: travel_question
        A->>+/api/travel-assistant: POST travel query
        /api/travel-assistant->>O: Generate travel advice
        O-->>-/api/travel-assistant: Contextual response
        /api/travel-assistant-->>A: Travel advice + follow-ups
        A->>A: Add assistant message with suggestions
    end
    
    A->>A: Update chat history
    A->>A: Store in localStorage
```

## Listing Analysis Flow

```mermaid
sequenceDiagram
    participant U as User
    participant PC as PropertyCard
    participant LAM as ListingAnalysisModal
    participant AL as /api/analyze-listing
    participant GRI as /api/get-review-insights
    participant O as OpenAI API
    participant AB as Airbnb API

    U->>PC: Click "Analyze" button
    PC->>LAM: Open modal with listing data
    LAM->>LAM: Show loading state
    
    LAM->>AL: POST listing analysis request
    AL->>AL: Prepare listing data
    
    par Fetch Reviews
        AL->>GRI: GET review insights
        GRI->>AB: Fetch guest reviews
        AB-->>GRI: Review text data
        GRI-->>AL: Processed reviews
    and Basic Analysis
        AL->>O: Analyze property data
        O-->>AL: Basic property insights
    end
    
    AL->>O: Comprehensive analysis with reviews
    note over O: Amazon-style review themes<br/>Price/Location/Host analysis<br/>Trust scoring
    O-->>AL: Structured analysis results
    AL-->>LAM: Complete analysis data
    
    LAM->>LAM: Render tabbed interface
    LAM->>LAM: Display score visualizations
    LAM->>LAM: Show review themes (Amazon-style)
    
    opt User interactions
        U->>LAM: Click review theme
        LAM->>LAM: Expand theme details
        U->>LAM: Navigate between tabs
        LAM->>LAM: Update active tab
    end
```

## Search Refinement Flow

```mermaid
sequenceDiagram
    participant U as User
    participant A as App.tsx
    participant QF as QuickFilter Component
    parameter DE as DateEditor
    participant RA as RefinementAnalyzer
    participant US as /api/unified-search

    A->>RA: Analyze current results
    RA->>RA: Generate price insights
    RA->>RA: Analyze amenity patterns
    RA->>RA: Calculate property type distribution
    RA-->>A: Refinement suggestions
    
    A->>QF: Render quick filters
    
    alt Price Filter
        U->>QF: Click price range filter
        QF->>A: Update search context
        A->>US: Re-search with new price range
        US-->>A: Filtered results
        
    else Amenity Filter
        U->>QF: Select amenity filter
        QF->>A: Add amenity requirement
        A->>A: Filter current results locally
        
    else Date Change
        U->>DE: Modify check-in/out dates
        DE->>A: Update search context
        A->>US: Re-search with new dates
        US-->>A: Updated availability
        
    else Follow-up Question
        U->>A: Click follow-up suggestion
        A->>A: Process as new search query
        note over A: Triggers main search flow
    end
    
    A->>A: Update results display
    A->>RA: Re-analyze for new refinements
    RA-->>A: Updated suggestions
```

## Image Navigation Flow

```mermaid
sequenceDiagram
    participant U as User
    participant PC as PropertyCard
    participant A as App.tsx

    A->>A: Initialize imageIndexes state
    A->>PC: Render with images array
    
    PC->>PC: Display first image (index 0)
    PC->>PC: Show navigation dots
    
    alt Multiple images available
        U->>PC: Click next/previous button
        PC->>A: Update imageIndexes[listingId]
        A->>A: setState with new index
        A->>PC: Re-render with new image
        
    else Click image dot
        U->>PC: Click specific dot
        PC->>A: Set specific index
        A->>PC: Display selected image
    end
    
    PC->>PC: Update dot indicators
```

## Error Handling Flow

```mermaid
sequenceDiagram
    participant U as User
    participant A as App.tsx
    participant API as API Endpoints
    participant ES as External Services

    A->>API: Make API request
    
    alt Success Path
        API->>ES: Call external service
        ES-->>API: Successful response
        API-->>A: Process and return data
        A->>A: Update UI with results
        
    else Service Timeout
        API->>ES: Call external service
        ES-->>API: Timeout/No response
        API->>API: Log error with context
        API-->>A: Error response with details
        A->>A: Show user-friendly error message
        A->>A: Suggest retry action
        
    else AI Service Failure
        API->>ES: OpenAI API call
        ES-->>API: Rate limit/Service error
        API->>API: Use fallback analysis
        API-->>A: Degraded response
        A->>A: Show results with limited features
        
    else Network Error
        A->>API: Request fails to send
        A->>A: Show network error message
        A->>A: Enable retry button
        U->>A: Click retry
        A->>API: Retry request
    end
```

## State Management Flow

```mermaid
sequenceDiagram
    participant U as User
    participant A as App.tsx
    participant LS as LocalStorage
    participant S as React State

    A->>LS: Load initial state
    LS-->>A: Cached search history
    A->>S: Initialize React state
    
    loop User Interactions
        U->>A: Perform action
        A->>S: Update React state
        
        alt State requires persistence
            A->>LS: Store search history
            A->>LS: Store user preferences
        end
        
        A->>A: Re-render components
    end
    
    A->>S: Cleanup on unmount
```