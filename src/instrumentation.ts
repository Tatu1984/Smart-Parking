/**
 * Next.js Instrumentation
 * Runs once when the server starts
 * Used for environment validation and initialization
 */

export async function register() {
  // Only run on server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnvironment } = await import('@/lib/config/env')

    console.log('🚀 Starting Smart Parking Server...')
    console.log(`   Environment: ${process.env.NODE_ENV}`)
    console.log(`   Node Version: ${process.version}`)

    // Validate environment variables
    validateEnvironment()

    console.log('✅ Server initialized successfully')
  }
}
