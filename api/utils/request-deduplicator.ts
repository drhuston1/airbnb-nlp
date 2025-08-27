// Request Deduplication Utility
// Prevents duplicate API calls during rapid user interactions

interface RequestCacheEntry {
  promise: Promise<any>
  timestamp: number
  hitCount: number
}

interface DeduplicationStats {
  totalRequests: number
  duplicatePrevented: number
  cacheSize: number
  avgResponseTime: number
}

export class RequestDeduplicator {
  private requestCache = new Map<string, RequestCacheEntry>()
  private requestStats = {
    totalRequests: 0,
    duplicatePrevented: 0,
    totalResponseTime: 0
  }
  private readonly cacheTimeout = 5000 // 5 seconds
  private readonly maxCacheSize = 100 // Prevent memory bloat

  /**
   * Deduplicated fetch with connection reuse and caching
   */
  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    const startTime = Date.now()
    const key = this.generateCacheKey(url, options)
    
    this.requestStats.totalRequests++
    
    // Check for existing in-flight request
    const cached = this.requestCache.get(key)
    if (cached && this.isEntryValid(cached)) {
      cached.hitCount++
      this.requestStats.duplicatePrevented++
      console.log(`🔄 Deduplicating request: ${url} (hit #${cached.hitCount}, saved ${Date.now() - startTime}ms)`)
      return cached.promise
    }

    // Clean cache if getting large
    if (this.requestCache.size > this.maxCacheSize * 0.8) {
      this.cleanupCache()
    }

    console.log(`🌐 New request: ${url}`)
    
    // Create new request with optimizations
    const promise = fetch(url, {
      ...options,
      keepalive: true, // Reuse HTTP connections
      // Add compression and caching headers
      headers: {
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'max-age=300', // 5 minute browser cache
        ...options.headers
      }
    }).then(response => {
      const responseTime = Date.now() - startTime
      this.requestStats.totalResponseTime += responseTime
      console.log(`✅ Request completed: ${url} (${responseTime}ms)`)
      return response
    }).finally(() => {
      // Delayed cleanup - keep cache for rapid subsequent requests
      setTimeout(() => {
        this.requestCache.delete(key)
        console.log(`🧹 Cleaned up request cache for: ${url}`)
      }, this.cacheTimeout)
    })

    // Cache the promise
    const entry: RequestCacheEntry = {
      promise,
      timestamp: Date.now(),
      hitCount: 0
    }
    this.requestCache.set(key, entry)

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
        'Accept': 'application/json',
        ...options.headers
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Generate cache key from URL and options
   */
  private generateCacheKey(url: string, options: RequestInit): string {
    // Include method, body, and critical headers in cache key
    const keyData = {
      url,
      method: options.method || 'GET',
      body: options.body,
      // Only include headers that affect response
      criticalHeaders: {
        'content-type': options.headers?.['content-type'] || options.headers?.['Content-Type'],
        'authorization': options.headers?.['authorization'] || options.headers?.['Authorization']
      }
    }
    
    return btoa(JSON.stringify(keyData)).replace(/[+/=]/g, '')
  }

  /**
   * Check if cache entry is still valid
   */
  private isEntryValid(entry: RequestCacheEntry): boolean {
    const age = Date.now() - entry.timestamp
    return age < this.cacheTimeout
  }

  /**
   * Clean up old cache entries
   */
  private cleanupCache(): void {
    const now = Date.now()
    let removedCount = 0

    for (const [key, entry] of this.requestCache.entries()) {
      if (now - entry.timestamp > this.cacheTimeout) {
        this.requestCache.delete(key)
        removedCount++
      }
    }

    // If still too large, remove oldest entries
    if (this.requestCache.size > this.maxCacheSize) {
      const entries = Array.from(this.requestCache.entries())
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
      
      const toRemove = this.requestCache.size - this.maxCacheSize + 10
      for (let i = 0; i < toRemove && i < entries.length; i++) {
        this.requestCache.delete(entries[i][0])
        removedCount++
      }
    }

    if (removedCount > 0) {
      console.log(`🧹 Request cache cleanup: removed ${removedCount} entries, size now: ${this.requestCache.size}`)
    }
  }

  /**
   * Get deduplication statistics
   */
  getStats(): DeduplicationStats {
    return {
      totalRequests: this.requestStats.totalRequests,
      duplicatePrevented: this.requestStats.duplicatePrevented,
      cacheSize: this.requestCache.size,
      avgResponseTime: this.requestStats.totalRequests > 0 
        ? Math.round(this.requestStats.totalResponseTime / this.requestStats.totalRequests)
        : 0
    }
  }

  /**
   * Clear all cached requests (useful for testing)
   */
  clearCache(): void {
    this.requestCache.clear()
    console.log('🗑️ Request cache cleared')
  }

  /**
   * Get detailed cache information for debugging
   */
  getCacheInfo(): Array<{ key: string; age: number; hitCount: number }> {
    const now = Date.now()
    return Array.from(this.requestCache.entries()).map(([key, entry]) => ({
      key: key.substring(0, 50) + '...', // Truncate for readability
      age: now - entry.timestamp,
      hitCount: entry.hitCount
    }))
  }
}

// Export singleton instance for global use
export const requestDeduplicator = new RequestDeduplicator()

// Export types
export type { DeduplicationStats }