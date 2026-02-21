'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ParkingSquare, ArrowLeft, ShieldAlert } from 'lucide-react'

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/25">
              <ParkingSquare className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">Sparking</span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="relative flex flex-1 items-center justify-center p-4">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 right-0 h-[500px] w-[500px] rounded-full bg-blue-500/5 blur-3xl" />
          <div className="absolute -bottom-40 left-0 h-[400px] w-[400px] rounded-full bg-cyan-500/5 blur-3xl" />
        </div>

        <Card className="w-full max-w-md border-border/50 shadow-xl shadow-black/5 dark:shadow-black/20">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10">
              <ShieldAlert className="h-8 w-8 text-amber-500" />
            </div>
            <CardTitle className="text-2xl font-bold">Password Reset</CardTitle>
            <CardDescription className="text-base">
              Password resets are managed by your organization administrator.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border/50 bg-muted/30 p-4 text-sm text-muted-foreground space-y-2">
              <p>To reset your password, please contact your organization administrator.</p>
              <p>If you signed in with Microsoft, use the <strong>Sign in with Microsoft</strong> button on the login page instead.</p>
            </div>
          </CardContent>
          <CardFooter className="justify-center">
            <Link
              href="/login"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </Link>
          </CardFooter>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Infinititech Partners. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
