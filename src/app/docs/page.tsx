'use client'

import { useEffect } from 'react'

export default function ApiDocsPage() {
  useEffect(() => {
    // Load Swagger UI styles and scripts
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css'
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js'
    script.onload = () => {
      // @ts-expect-error - SwaggerUIBundle is loaded via script
      window.SwaggerUIBundle({
        url: '/api/docs',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          // @ts-expect-error - SwaggerUIBundle presets
          window.SwaggerUIBundle.presets.apis,
          // @ts-expect-error - SwaggerUIStandalonePreset
          window.SwaggerUIStandalonePreset
        ],
        layout: 'StandaloneLayout',
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        docExpansion: 'list',
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: true,
        persistAuthorization: true
      })
    }
    document.body.appendChild(script)

    // Load standalone preset
    const presetScript = document.createElement('script')
    presetScript.src = 'https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js'
    document.body.appendChild(presetScript)

    return () => {
      // Cleanup
      link.remove()
      script.remove()
      presetScript.remove()
    }
  }, [])

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gray-900 text-white py-4 px-6">
        <h1 className="text-2xl font-bold">Sparking API Documentation</h1>
        <p className="text-gray-400">AI-Powered Smart Parking Management System</p>
      </div>
      <div id="swagger-ui" />
    </div>
  )
}
