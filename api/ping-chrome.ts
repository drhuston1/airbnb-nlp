// Health check endpoint to verify Chrome initialization
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log('🏥 Chrome health check starting...')
    
    // Use Function wrapper to import Chrome modules
    const ChromiumClass = (await (new Function('s', 'return import(s)'))('@sparticuz/chromium-min')).default;
    const puppeteerModule = await (new Function('s', 'return import(s)'))('puppeteer-core');
    
    console.log('✅ Modules imported successfully')
    
    // Use remote executable
    const REMOTE_EXECUTABLE = 
      process.env.CHROMIUM_REMOTE_EXEC_PATH ?? 
      'https://github.com/Sparticuz/chromium/releases/download/v133.0.0/chromium-v133.0.0-pack.tar.br'
    
    const executablePath = await ChromiumClass.executablePath(REMOTE_EXECUTABLE)
    console.log('✅ Executable path resolved:', executablePath)
    
    const browser = await puppeteerModule.launch({
      executablePath,
      args: ChromiumClass.args || [],
      headless: true
    })
    
    const version = await browser.version()
    console.log('✅ Chrome version:', version)
    
    await browser.close()
    
    return res.status(200).json({
      status: 'healthy',
      chrome: {
        version,
        executablePath,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('❌ Chrome health check failed:', error)
    return res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
}