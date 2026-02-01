import { Configuration, LogLevel, PopupRequest } from '@azure/msal-browser'

// Azure AD Configuration
const AZURE_CONFIG = {
  clientId: '614f42e8-a144-4221-b2c6-d63c8da935ea',
  tenantId: '88714d9d-6787-42a3-929c-4242bac15119',
  redirectUri: 'https://sparking.tensparrows.com',
}

// Get MSAL configuration - must be called in browser context
export function getMsalConfig(): Configuration {
  const redirectUri = typeof window !== 'undefined'
    ? window.location.origin
    : AZURE_CONFIG.redirectUri

  return {
    auth: {
      clientId: process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID || AZURE_CONFIG.clientId,
      authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID || AZURE_CONFIG.tenantId}`,
      redirectUri,
      postLogoutRedirectUri: '/',
    },
    cache: {
      cacheLocation: 'sessionStorage',
    },
    system: {
      loggerOptions: {
        loggerCallback: (level, message, containsPii) => {
          if (containsPii) return
          switch (level) {
            case LogLevel.Error:
              console.error(message)
              break
            case LogLevel.Warning:
              console.warn(message)
              break
            case LogLevel.Info:
              if (process.env.NODE_ENV === 'development') {
                console.info(message)
              }
              break
            case LogLevel.Verbose:
            case LogLevel.Trace:
              break
          }
        },
        logLevel: LogLevel.Warning,
      },
    },
  }
}

// Scopes for OpenID Connect login
export const loginRequest: PopupRequest = {
  scopes: ['openid', 'profile', 'email'],
}

// Check if Microsoft auth is configured
export function isMicrosoftAuthConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID || AZURE_CONFIG.clientId)
}
