import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  ParkingSquare,
  Camera,
  BarChart3,
  Zap,
  Shield,
  Smartphone,
  ArrowRight,
  CheckCircle2
} from 'lucide-react'

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ParkingSquare className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold">Sparking</span>
          </Link>
          <nav className="hidden gap-6 md:flex">
            <Link href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Features
            </Link>
            <Link href="#technology" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Technology
            </Link>
            <Link href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Pricing
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button>Dashboard</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container flex flex-col items-center justify-center gap-8 py-24 text-center md:py-32">
        <div className="inline-flex items-center rounded-full border px-4 py-1.5 text-sm">
          <span className="mr-2 h-2 w-2 rounded-full bg-green-500" />
          Powered by Intel OpenVINO & DL Streamer
        </div>
        <h1 className="max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
          AI-Powered
          <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
            {' '}Smart Parking{' '}
          </span>
          Management
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl">
          Transform your parking facility with real-time computer vision-based slot detection,
          intelligent allocation, and seamless vehicle tracking. Built for airports, malls,
          cinemas, and commercial complexes.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row">
          <Link href="/dashboard">
            <Button size="lg" className="gap-2">
              Open Dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Button size="lg" variant="outline">
            Watch Demo
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-8 pt-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            99.5% Detection Accuracy
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            &lt;100ms Latency
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Edge-First Architecture
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container py-24">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Everything You Need for Smart Parking
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            A comprehensive solution that combines AI vision, real-time analytics,
            and seamless hardware integration.
          </p>
        </div>
        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border bg-card p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
              <Camera className="h-6 w-6 text-blue-500" />
            </div>
            <h3 className="text-xl font-semibold">AI Vision Detection</h3>
            <p className="mt-2 text-muted-foreground">
              Real-time slot-level detection using Intel DL Streamer with YOLOv10/v11 models.
              Supports 50+ cameras per edge server.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
              <Zap className="h-6 w-6 text-green-500" />
            </div>
            <h3 className="text-xl font-semibold">Smart Allocation</h3>
            <p className="mt-2 text-muted-foreground">
              Intelligent slot assignment based on vehicle type, zone preferences,
              accessibility needs, and EV charging requirements.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/10">
              <BarChart3 className="h-6 w-6 text-purple-500" />
            </div>
            <h3 className="text-xl font-semibold">Real-time Analytics</h3>
            <p className="mt-2 text-muted-foreground">
              Live dashboards with occupancy trends, revenue analytics,
              peak usage patterns, and predictive insights.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-orange-500/10">
              <Shield className="h-6 w-6 text-orange-500" />
            </div>
            <h3 className="text-xl font-semibold">Edge-First Architecture</h3>
            <p className="mt-2 text-muted-foreground">
              100% operational without internet. Local database ensures
              zero downtime with automatic cloud sync when connected.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-500/10">
              <ParkingSquare className="h-6 w-6 text-cyan-500" />
            </div>
            <h3 className="text-xl font-semibold">Hardware Integration</h3>
            <p className="mt-2 text-muted-foreground">
              Seamless integration with boom barriers, LED displays,
              ticket printers, and EV chargers via RS-485/GPIO.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-pink-500/10">
              <Smartphone className="h-6 w-6 text-pink-500" />
            </div>
            <h3 className="text-xl font-semibold">Mobile Apps</h3>
            <p className="mt-2 text-muted-foreground">
              Cross-platform iOS/Android apps for users with QR scanning,
              navigation, and payments. Operator app for management.
            </p>
          </div>
        </div>
      </section>

      {/* Technology Stack */}
      <section id="technology" className="border-t bg-muted/30 py-24">
        <div className="container">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Built with Modern Technology
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Enterprise-grade stack designed for performance, reliability, and scalability.
            </p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-4">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
                <span className="text-2xl font-bold text-blue-500">AI</span>
              </div>
              <h3 className="font-semibold">AI/ML Stack</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Intel OpenVINO, DL Streamer, YOLOv10/v11, GStreamer
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                <span className="text-2xl font-bold text-green-500">BE</span>
              </div>
              <h3 className="font-semibold">Backend</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Node.js, Express, PostgreSQL, Prisma, Redis, Socket.IO
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-500/10">
                <span className="text-2xl font-bold text-purple-500">FE</span>
              </div>
              <h3 className="font-semibold">Frontend</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Next.js 15, React, TypeScript, Tailwind CSS, shadcn/ui
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/10">
                <span className="text-2xl font-bold text-orange-500">HW</span>
              </div>
              <h3 className="font-semibold">Infrastructure</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Docker, Intel Core Ultra/Xeon, NPU/GPU, Nginx
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-24">
        <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 p-12 text-center text-white">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to Transform Your Parking?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80">
            Get started with Sparking and experience the future of intelligent parking management.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/dashboard">
              <Button size="lg" variant="secondary" className="gap-2">
                Try Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
              Contact Sales
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2">
            <ParkingSquare className="h-5 w-5" />
            <span className="font-semibold">Sparking</span>
          </div>
          <p className="text-sm text-muted-foreground">
            &copy; 2024 Infinititech Partners. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
