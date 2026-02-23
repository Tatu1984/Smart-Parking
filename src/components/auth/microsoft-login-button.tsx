'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { getMsalConfig, getLoginRequest } from '@/lib/auth/msal-config'

// Microsoft logo SVG component
function MicrosoftLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  )
}

interface MicrosoftLoginButtonProps {
  onError?: (error: string) => void
  label?: string
}

export function MicrosoftLoginButton({ onError, label = 'Sign in with Microsoft' }: MicrosoftLoginButtonProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('from') || '/dashboard'

  const [isLoading, setIsLoading] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const msalRef = useRef<PublicClientApplication | null>(null)

  // Initialize MSAL once on mount
  useEffect(() => {
    const init = async () => {
      try {
        const msalConfig = getMsalConfig()
        const instance = new PublicClientApplication(msalConfig)
        await instance.initialize()
        msalRef.current = instance
        setIsReady(true)
      } catch (err) {
        console.error('MSAL init error:', err)
      }
    }
    init()
  }, [])

  const handleMicrosoftLogin = useCallback(async () => {
    const msalInstance = msalRef.current
    if (!msalInstance) return

    setIsLoading(true)

    try {
      const request = getLoginRequest()

      // Try to acquire token silently first (if user already has a cached session)
      const accounts = msalInstance.getAllAccounts()

      if (accounts.length > 0) {
        try {
          const response = await msalInstance.acquireTokenSilent({
            scopes: request.scopes,
            account: accounts[0],
          })

          if (response?.idToken) {
            // Send token to backend for verification and session creation
            const backendResponse = await fetch('/api/auth/microsoft', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken: response.idToken }),
            })

            const text = await backendResponse.text()
            if (!text) throw new Error('Server returned empty response')

            let data
            try {
              data = JSON.parse(text)
            } catch {
              throw new Error('Invalid response from server')
            }

            if (!backendResponse.ok) {
              throw new Error(data.error || 'Login failed')
            }

            router.push(redirectTo)
            router.refresh()
            return
          }
        } catch (silentError) {
          if (!(silentError instanceof InteractionRequiredAuthError)) {
            throw silentError
          }
          // Silent failed — fall through to redirect
        }
      }

      // No cached session or silent failed — redirect to Microsoft login.
      // After auth, Microsoft redirects back to the app root and
      // MsalRedirectHandler (in root layout) processes the response.
      await msalInstance.loginRedirect(request)
    } catch (error) {
      console.error('Microsoft login error:', error)

      if (error instanceof Error) {
        if (error.message.includes('interaction_in_progress')) {
          onError?.('A login is already in progress. Please try again.')
          return
        }
        onError?.(error.message)
      } else {
        onError?.('An unexpected error occurred during Microsoft login')
      }
    } finally {
      setIsLoading(false)
    }
  }, [router, redirectTo, onError])

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={handleMicrosoftLogin}
      disabled={isLoading || !isReady}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Signing in...
        </>
      ) : (
        <>
          <MicrosoftLogo className="h-4 w-4" />
          {label}
        </>
      )}
    </Button>
  )
}
