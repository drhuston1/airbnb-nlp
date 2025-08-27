// Frontend Request Deduplication Utility
// Prevents duplicate API calls during rapid user interactions (typing, clicking, etc.)
import { useCallback } from 'react'

interface RequestCacheEntry {
  promise: Promise<any>
  timestamp: number
  abortController?: AbortController
}

export class FrontendRequestDeduplicator {
  private requestCache = new Map<string, RequestCacheEntry>()
  private readonly cacheTimeout = 3000 // 3 seconds for frontend
  private stats = {
    totalRequests: 0,
    duplicatesPrevented: 0
  }

  /**
   * Deduplicated fetch for frontend API calls
   */
  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    const key = this.generateCacheKey(url, options)
    this.stats.totalRequests++

    // Check for existing request
    const cached = this.requestCache.get(key)
    if (cached && this.isEntryValid(cached)) {
      this.stats.duplicatesPrevented++
      console.log(`🔄 Prevented duplicate request: ${url}`)
      return cached.promise
    }

    // Cancel any existing request for this key if it's different
    if (cached?.abortController) {
      cached.abortController.abort()
    }

    // Create new abort controller for this request
    const abortController = new AbortController()
    
    console.log(`🌐 New frontend request: ${url}`)
    
    const promise = fetch(url, {
      ...options,
      signal: abortController.signal,
      // Add optimization headers
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache', // Always get fresh data for user interactions
        ...options.headers
      }
    }).finally(() => {
      // Clean up cache after timeout
      setTimeout(() => {
        this.requestCache.delete(key)
      }, this.cacheTimeout)
    })

    // Cache the request
    this.requestCache.set(key, {
      promise,
      timestamp: Date.now(),
      abortController
    })

    return promise
  }

  /**
   * Deduplicated JSON fetch specifically for API calls
   */
  async fetchJson<T = any>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await this.fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Generate cache key for deduplication
   */
  private generateCacheKey(url: string, options: RequestInit): string {
    // For frontend, we care about URL, method, and body
    const keyData = {
      url,
      method: options.method || 'GET',
      body: options.body
    }
    
    return JSON.stringify(keyData)
  }

  /**
   * Check if cache entry is still valid
   */
  private isEntryValid(entry: RequestCacheEntry): boolean {
    const age = Date.now() - entry.timestamp
    return age < this.cacheTimeout
  }

  /**
   * Cancel all pending requests (useful for navigation or component unmount)
   */
  cancelAllRequests(): void {
    for (const entry of this.requestCache.values()) {
      if (entry.abortController) {
        entry.abortController.abort()
      }
    }
    this.requestCache.clear()
    console.log('🚫 Cancelled all pending requests')
  }

  /**
   * Get deduplication statistics
   */
  getStats() {
    return {
      totalRequests: this.stats.totalRequests,
      duplicatesPrevented: this.stats.duplicatesPrevented,
      preventionRate: this.stats.totalRequests > 0 
        ? Math.round((this.stats.duplicatesPrevented / this.stats.totalRequests) * 100)
        : 0,
      activeCacheSize: this.requestCache.size
    }
  }

  /**
   * Clear statistics (useful for testing)
   */
  clearStats(): void {
    this.stats = {
      totalRequests: 0,
      duplicatesPrevented: 0
    }
  }
}

// Export singleton instance
export const frontendDeduplicator = new FrontendRequestDeduplicator()

// Hook for React components to use deduplication
export const useRequestDeduplication = () => {
  const fetchWithDeduplication = useCallback(async <T = any>(url: string, options?: RequestInit): Promise<T> => {
    return frontendDeduplicator.fetchJson<T>(url, options)
  }, [])

  const getStats = useCallback(() => frontendDeduplicator.getStats(), [])

  const cancelRequests = useCallback(() => frontendDeduplicator.cancelAllRequests(), [])

  return {
    fetch: fetchWithDeduplication,
    getStats,
    cancelRequests
  }
}
