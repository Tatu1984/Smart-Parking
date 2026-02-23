'use client'

import { Button } from '@/components/ui/button'

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

export function MicrosoftLoginButton({ label = 'Sign in with Microsoft' }: MicrosoftLoginButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      asChild
    >
      <a href="/api/auth/microsoft/authorize">
        <MicrosoftLogo className="h-4 w-4" />
        {label}
      </a>
    </Button>
  )
}
