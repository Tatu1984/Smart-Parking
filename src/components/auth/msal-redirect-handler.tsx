'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { PublicClientApplication } from '@azure/msal-browser'
import { getMsalConfig } from '@/lib/auth/msal-config'

/**
 * Handles MSAL redirect responses on any page.
 * When Microsoft redirects back to the app root with #code=...,
 * this component processes the auth response, sends the token
 * to the backend, and redirects to the dashboard.
 *
 * Place this in the root layout so it runs on every page load.
 */
export function MsalRedirectHandler() {
  const router = useRouter()
  const handledRef = useRef(false)

  useEffect(() => {
    // Only process if URL has auth response params
    if (!window.location.hash.includes('code=') || handledRef.current) return
    handledRef.current = true

    const handleRedirect = async () => {
      try {
        const instance = new PublicClientApplication(getMsalConfig())
        await instance.initialize()
        const response = await instance.handleRedirectPromise()

        if (response?.idToken) {
          const res = await fetch('/api/auth/microsoft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: response.idToken }),
          })

          if (res.ok) {
            router.push('/dashboard')
            router.refresh()
          } else {
            // Auth failed — redirect to login with error
            router.push('/login?error=microsoft_auth_failed')
          }
        }
      } catch (err) {
        console.error('MSAL redirect handler error:', err)
        router.push('/login?error=microsoft_auth_failed')
      }
    }

    handleRedirect()
  }, [router])

  return null
}
