import { Configuration, LogLevel, PopupRequest } from '@azure/msal-browser'

// MSAL configuration for Microsoft Entra ID authentication
export const msalConfig: Configuration = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID || '',
    authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID || 'common'}`,
    redirectUri: process.env.NEXT_PUBLIC_AZURE_AD_REDIRECT_URI || 'http://localhost:3000',
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
            // Only log in development
            if (process.env.NODE_ENV === 'development') {
              console.info(message)
            }
            break
          case LogLevel.Verbose:
          case LogLevel.Trace:
            // Skip verbose/trace logs
            break
        }
      },
      logLevel: LogLevel.Warning,
    },
  },
}

// Scopes for OpenID Connect login
export const loginRequest: PopupRequest = {
  scopes: ['openid', 'profile', 'email'],
}

// Check if Microsoft auth is configured
export function isMicrosoftAuthConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID)
}
