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

    // Bridge streaming lifecycle events onto Socket.IO for live dashboards.
    // Safe to register even if the socket server isn't up yet (emit is a no-op).
    const { streamEvents } = await import('@/lib/streaming/events')
    const { emitCameraStatus } = await import('@/lib/socket/server')
    streamEvents.subscribe((event) => {
      if (event.type === 'camera.online' || event.type === 'camera.offline') {
        emitCameraStatus(event.parkingLotId || '', event.zoneId || '', {
          cameraId: event.cameraId,
          cameraName: event.cameraName || '',
          status: event.type === 'camera.online' ? 'ONLINE' : 'OFFLINE',
        })
      }
    })

    // Bootstrap the decoupled camera health worker when enabled. It runs the
    // CameraHealthService on an interval; can later move to its own process.
    if (process.env.CAMERA_HEALTH_WORKER_ENABLED === 'true') {
      const { startCameraHealthWorker } = await import('@/workers/camera-health')
      startCameraHealthWorker()
    }

    console.log('✅ Server initialized successfully')
  }
}
