'use client'

import { useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { getMsalConfig, loginRequest } from '@/lib/auth/msal-config'

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
}

export function MicrosoftLoginButton({ onError }: MicrosoftLoginButtonProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('from') || '/dashboard'

  const [isLoading, setIsLoading] = useState(false)

  const handleMicrosoftLogin = useCallback(async () => {
    setIsLoading(true)

    try {
      // Get MSAL config with current origin as redirect URI
      const msalConfig = getMsalConfig()

      // Initialize MSAL instance
      const msalInstance = new PublicClientApplication(msalConfig)
      await msalInstance.initialize()

      // Try to acquire token silently first (if user is already logged in)
      const accounts = msalInstance.getAllAccounts()
      let response

      if (accounts.length > 0) {
        try {
          response = await msalInstance.acquireTokenSilent({
            ...loginRequest,
            account: accounts[0],
          })
        } catch (silentError) {
          if (silentError instanceof InteractionRequiredAuthError) {
            // Silent token acquisition failed, use popup
            response = await msalInstance.loginPopup(loginRequest)
          } else {
            throw silentError
          }
        }
      } else {
        // No cached accounts, use popup login
        response = await msalInstance.loginPopup(loginRequest)
      }

      if (!response?.idToken) {
        throw new Error('No ID token received from Microsoft')
      }

      // Send token to backend for verification and session creation
      const backendResponse = await fetch('/api/auth/microsoft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken: response.idToken }),
      })

      const text = await backendResponse.text()
      if (!text) {
        throw new Error('Server returned empty response')
      }

      let data
      try {
        data = JSON.parse(text)
      } catch {
        throw new Error('Invalid response from server')
      }

      if (!backendResponse.ok) {
        throw new Error(data.error || 'Login failed')
      }

      // Redirect to dashboard
      router.push(redirectTo)
      router.refresh()
    } catch (error) {
      console.error('Microsoft login error:', error)

      // Handle specific MSAL errors
      if (error instanceof Error) {
        if (error.message.includes('user_cancelled')) {
          // User closed the popup, don't show error
          return
        }
        if (error.message.includes('popup_window_error')) {
          onError?.('Popup was blocked. Please allow popups for this site.')
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
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Signing in...
        </>
      ) : (
        <>
          <MicrosoftLogo className="h-4 w-4" />
          Sign in with Microsoft
        </>
      )}
    </Button>
  )
}
