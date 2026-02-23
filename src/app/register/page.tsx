'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ParkingSquare, UserPlus, Mail, Loader2 } from 'lucide-react'
import { MicrosoftLoginButton } from '@/components/auth/microsoft-login-button'

function RegisterContent() {
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

      {/* Register Content */}
      <main className="relative flex flex-1 items-center justify-center p-4">
        {/* Background decoration */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 right-0 h-[500px] w-[500px] rounded-full bg-blue-500/5 blur-3xl" />
          <div className="absolute -bottom-40 left-0 h-[400px] w-[400px] rounded-full bg-cyan-500/5 blur-3xl" />
        </div>

        <Card className="w-full max-w-md border-border/50 shadow-xl shadow-black/5 dark:shadow-black/20">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10">
              <UserPlus className="h-8 w-8 text-blue-500" />
            </div>
            <CardTitle className="text-2xl font-bold">Create an Account</CardTitle>
            <CardDescription className="text-base">
              Sparking accounts are managed by organization administrators
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
              <h3 className="font-medium">How to get access</h3>
              <ul className="mt-3 space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                  Contact your organization administrator to request an account
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                  If your organization is new to Sparking, contact our sales team
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                  Existing users can log in with their credentials below
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <MicrosoftLoginButton label="Sign up with Microsoft" />

              <div className="relative my-1">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <Button variant="outline" className="w-full h-10 gap-2 rounded-xl" asChild>
                <a href="mailto:sales@sparking.io">
                  <Mail className="h-4 w-4" />
                  Contact Sales
                </a>
              </Button>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 text-center text-sm text-muted-foreground">
            <div>
              Already have an account?{' '}
              <Link
                href="/login"
                className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Sign in
              </Link>
            </div>
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

function RegisterSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterSkeleton />}>
      <RegisterContent />
    </Suspense>
  )
}
