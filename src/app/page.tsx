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
  CheckCircle2,
  ChevronRight,
} from 'lucide-react'

export default function HomePage() {
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
          <nav className="hidden gap-8 md:flex">
            <Link href="#features" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Features
            </Link>
            <Link href="#technology" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Technology
            </Link>
            <Link href="#pricing" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Pricing
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link href="/dashboard">
              <Button size="sm" className="gap-1.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:brightness-110 border-0">
                Dashboard
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Background decoration */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 right-0 h-[500px] w-[500px] rounded-full bg-blue-500/5 blur-3xl" />
          <div className="absolute -bottom-40 left-0 h-[500px] w-[500px] rounded-full bg-cyan-500/5 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/3 blur-3xl" />
        </div>

        <div className="container flex flex-col items-center justify-center gap-8 py-24 text-center md:py-32 lg:py-40">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/5 px-4 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
            </span>
            Powered by Intel OpenVINO & DL Streamer
          </div>

          <h1 className="max-w-4xl text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            AI-Powered{' '}
            <span className="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
              Smart Parking
            </span>
            <br />
            Management
          </h1>

          <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Transform your parking facility with real-time computer vision detection,
            intelligent allocation, and seamless vehicle tracking. Built for airports,
            malls, cinemas, and commercial complexes.
          </p>

          <div className="flex flex-col gap-4 pt-2 sm:flex-row">
            <Link href="/dashboard">
              <Button size="lg" className="h-12 gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-8 text-base font-semibold text-white shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 hover:brightness-110 border-0">
                Open Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="h-12 rounded-xl px-8 text-base font-semibold">
              Watch Demo
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 pt-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>99.5% Detection Accuracy</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>&lt;100ms Latency</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>Edge-First Architecture</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t bg-muted/20 py-24 lg:py-32">
        <div className="container">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">Features</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Everything You Need for Smart Parking
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              A comprehensive solution combining AI vision, real-time analytics,
              and seamless hardware integration.
            </p>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Camera,
                title: 'AI Vision Detection',
                description: 'Real-time slot-level detection using Intel DL Streamer with YOLOv10/v11 models. Supports 50+ cameras per edge server.',
                color: 'blue',
                gradient: 'from-blue-500/10 to-blue-600/5',
                iconBg: 'bg-blue-500/10',
                iconColor: 'text-blue-500',
              },
              {
                icon: Zap,
                title: 'Smart Allocation',
                description: 'Intelligent slot assignment based on vehicle type, zone preferences, accessibility needs, and EV charging requirements.',
                color: 'emerald',
                gradient: 'from-emerald-500/10 to-emerald-600/5',
                iconBg: 'bg-emerald-500/10',
                iconColor: 'text-emerald-500',
              },
              {
                icon: BarChart3,
                title: 'Real-time Analytics',
                description: 'Live dashboards with occupancy trends, revenue analytics, peak usage patterns, and predictive insights.',
                color: 'violet',
                gradient: 'from-violet-500/10 to-violet-600/5',
                iconBg: 'bg-violet-500/10',
                iconColor: 'text-violet-500',
              },
              {
                icon: Shield,
                title: 'Edge-First Architecture',
                description: '100% operational without internet. Local database ensures zero downtime with automatic cloud sync when connected.',
                color: 'amber',
                gradient: 'from-amber-500/10 to-amber-600/5',
                iconBg: 'bg-amber-500/10',
                iconColor: 'text-amber-500',
              },
              {
                icon: ParkingSquare,
                title: 'Hardware Integration',
                description: 'Seamless integration with boom barriers, LED displays, ticket printers, and EV chargers via RS-485/GPIO.',
                color: 'cyan',
                gradient: 'from-cyan-500/10 to-cyan-600/5',
                iconBg: 'bg-cyan-500/10',
                iconColor: 'text-cyan-500',
              },
              {
                icon: Smartphone,
                title: 'Mobile Apps',
                description: 'Cross-platform iOS/Android apps with QR scanning, navigation, and payments. Operator app for management.',
                color: 'pink',
                gradient: 'from-pink-500/10 to-pink-600/5',
                iconBg: 'bg-pink-500/10',
                iconColor: 'text-pink-500',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group relative rounded-2xl border border-border/50 bg-card p-6 transition-all duration-300 hover:border-border hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20"
              >
                <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${feature.iconBg}`}>
                  <feature.icon className={`h-6 w-6 ${feature.iconColor}`} />
                </div>
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
                <ChevronRight className="absolute right-4 top-6 h-4 w-4 text-muted-foreground/0 transition-all group-hover:text-muted-foreground/50" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Technology Stack */}
      <section id="technology" className="py-24 lg:py-32">
        <div className="container">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">Technology</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Built with Modern Technology
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Enterprise-grade stack designed for performance, reliability, and scalability.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: 'AI',
                title: 'AI/ML Stack',
                description: 'Intel OpenVINO, DL Streamer, YOLOv10/v11, GStreamer',
                gradient: 'from-blue-600 to-blue-400',
              },
              {
                label: 'BE',
                title: 'Backend',
                description: 'Node.js, Express, PostgreSQL, Prisma, Redis, Socket.IO',
                gradient: 'from-emerald-600 to-emerald-400',
              },
              {
                label: 'FE',
                title: 'Frontend',
                description: 'Next.js 15, React, TypeScript, Tailwind CSS, shadcn/ui',
                gradient: 'from-violet-600 to-violet-400',
              },
              {
                label: 'HW',
                title: 'Infrastructure',
                description: 'Docker, Intel Core Ultra/Xeon, NPU/GPU, Nginx',
                gradient: 'from-amber-600 to-amber-400',
              },
            ].map((tech) => (
              <div key={tech.label} className="text-center">
                <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${tech.gradient} text-white shadow-lg`}>
                  <span className="text-lg font-bold">{tech.label}</span>
                </div>
                <h3 className="font-semibold">{tech.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {tech.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="container">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 p-12 text-center text-white shadow-2xl shadow-blue-500/25 md:p-16">
            {/* CTA decorations */}
            <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />

            <div className="relative">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Ready to Transform Your Parking?
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80">
                Get started with Sparking and experience the future of intelligent parking management.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link href="/dashboard">
                  <Button size="lg" className="h-12 gap-2 rounded-xl bg-white px-8 text-base font-semibold text-blue-600 shadow-xl hover:bg-white/90 border-0">
                    Try Dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Button size="lg" variant="outline" className="h-12 rounded-xl border-white/30 bg-white/10 px-8 text-base font-semibold text-white hover:bg-white/20 backdrop-blur-sm">
                  Contact Sales
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 text-white">
              <ParkingSquare className="h-4 w-4" />
            </div>
            <span className="font-semibold">Sparking</span>
          </div>
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Infinititech Partners. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
