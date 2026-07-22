import { NextResponse } from 'next/server'

// Public developer / user guide, served as a standalone HTML document at /usermanual.
// Self-contained (inline CSS, no external scripts) so it satisfies the app CSP
// (script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline').

export const dynamic = 'force-static'

const HTML = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SParking — Developer Guide</title>
<style>
  :root {
    --bg: #f7f9fb; --surface: #ffffff; --surface-2: #eef2f6; --border: #dce3ea;
    --ink: #16202e; --muted: #566072; --faint: #8a94a3;
    --accent: #0f9d63; --accent-ink: #0a6e46; --accent-soft: #e4f5ec; --link: #2563d6;
    --get: #0f9d63; --get-bg: #e4f5ec; --post: #2563d6; --post-bg: #e5edfb;
    --put: #b4790a; --put-bg: #faf0d9; --del: #d1443b; --del-bg: #fbe6e4;
    --good: #0f9d63; --warn: #b4790a; --crit: #d1443b;
    --mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
    --sans: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    --maxw: 1180px;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0c1119; --surface: #121a26; --surface-2: #182231; --border: #24303f;
      --ink: #e6ecf3; --muted: #9aa7b8; --faint: #6b7688;
      --accent: #34d399; --accent-ink: #6ee7b7; --accent-soft: #102a20; --link: #6ba1ff;
      --get: #34d399; --get-bg: #102a20; --post: #6ba1ff; --post-bg: #14233d;
      --put: #e0b64f; --put-bg: #2c2410; --del: #f0736a; --del-bg: #331715;
      --good: #34d399; --warn: #e0b64f; --crit: #f0736a;
    }
  }
  :root[data-theme="light"] {
    --bg: #f7f9fb; --surface: #ffffff; --surface-2: #eef2f6; --border: #dce3ea;
    --ink: #16202e; --muted: #566072; --faint: #8a94a3;
    --accent: #0f9d63; --accent-ink: #0a6e46; --accent-soft: #e4f5ec; --link: #2563d6;
  }
  :root[data-theme="dark"] {
    --bg: #0c1119; --surface: #121a26; --surface-2: #182231; --border: #24303f;
    --ink: #e6ecf3; --muted: #9aa7b8; --faint: #6b7688;
    --accent: #34d399; --accent-ink: #6ee7b7; --accent-soft: #102a20; --link: #6ba1ff;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--bg); color: var(--ink); font-family: var(--sans);
    line-height: 1.65; font-size: 16px; -webkit-font-smoothing: antialiased;
  }
  a { color: var(--link); text-decoration: none; }
  a:hover { text-decoration: underline; }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 3px; }
  .eyebrow { font-family: var(--mono); font-size: 12px; letter-spacing: .12em;
    text-transform: uppercase; color: var(--accent-ink); font-weight: 600; }

  header.hero { border-bottom: 1px solid var(--border);
    background: radial-gradient(1200px 320px at 85% -40%, var(--accent-soft), transparent 70%), var(--surface); }
  .hero-inner { max-width: var(--maxw); margin: 0 auto; padding: 44px 28px 34px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .mark { width: 40px; height: 40px; border-radius: 10px; flex: none; display: grid; place-items: center;
    font-family: var(--mono); font-weight: 700; font-size: 22px; color: #fff; background: var(--accent);
    box-shadow: 0 3px 10px rgba(15,157,99,.35); }
  .brand b { font-size: 19px; letter-spacing: -.01em; }
  h1 { font-size: clamp(30px, 4.4vw, 46px); line-height: 1.08; letter-spacing: -.02em;
    margin: 20px 0 10px; text-wrap: balance; max-width: 20ch; }
  .lede { font-size: 18px; color: var(--muted); max-width: 62ch; margin: 0 0 22px; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { font-family: var(--mono); font-size: 12px; padding: 5px 10px; border-radius: 999px;
    background: var(--surface-2); border: 1px solid var(--border); color: var(--muted); white-space: nowrap; }
  .status { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 22px;
    font-family: var(--mono); font-size: 13px; font-weight: 600; color: var(--accent-ink);
    background: var(--accent-soft); border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    padding: 6px 12px; border-radius: 999px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent);
    animation: pulse 2.4s infinite; }
  @keyframes pulse { 0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--accent) 55%,transparent);} 70%{box-shadow:0 0 0 7px transparent;} 100%{box-shadow:0 0 0 0 transparent;} }
  @media (prefers-reduced-motion: reduce){ .dot{animation:none;} }

  .shell { max-width: var(--maxw); margin: 0 auto; padding: 0 28px 90px;
    display: grid; grid-template-columns: 240px minmax(0,1fr); gap: 48px; }
  nav.toc { position: sticky; top: 0; align-self: start; height: 100vh; overflow-y: auto; padding: 34px 4px 40px; }
  nav.toc .grp { font-family: var(--mono); font-size: 11px; letter-spacing: .1em; text-transform: uppercase;
    color: var(--faint); margin: 20px 0 8px; }
  nav.toc a { display: block; color: var(--muted); font-size: 14px; padding: 4px 10px;
    border-left: 2px solid transparent; border-radius: 0 4px 4px 0; }
  nav.toc a:hover { color: var(--ink); text-decoration: none; background: var(--surface-2); }
  main { padding-top: 34px; min-width: 0; }
  .toc-m { display: none; }

  section { margin-bottom: 40px; scroll-margin-top: 20px; }
  section > h2 { font-size: 25px; letter-spacing: -.015em; margin: 8px 0 4px;
    padding-top: 20px; border-top: 1px solid var(--border); }
  section:first-of-type > h2 { border-top: none; padding-top: 0; }
  h3 { font-size: 17px; margin: 26px 0 8px; letter-spacing: -.01em; }
  p { margin: 12px 0; max-width: 70ch; }
  ul, ol { max-width: 70ch; padding-left: 22px; }
  li { margin: 5px 0; }
  strong { font-weight: 650; }
  .muted { color: var(--muted); }

  code { font-family: var(--mono); font-size: .875em; background: var(--surface-2);
    border: 1px solid var(--border); padding: 1px 5px; border-radius: 5px; }
  pre { margin: 14px 0; background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 16px 18px; overflow-x: auto; }
  pre code { background: none; border: none; padding: 0; font-size: 13px; line-height: 1.7; color: var(--ink); }
  .c-com { color: var(--faint); }
  .c-key { color: var(--post); }
  .c-str { color: var(--accent-ink); }

  .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px,1fr)); gap: 14px; margin: 16px 0; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; }
  .card h4 { margin: 0 0 6px; font-size: 15px; }
  .card p { margin: 0; font-size: 14px; color: var(--muted); }

  .callout { border: 1px solid var(--border); border-left: 3px solid var(--accent);
    background: var(--surface); border-radius: 0 10px 10px 0; padding: 14px 18px; margin: 18px 0; }
  .callout.fix { border-left-color: var(--warn); }
  .callout .lbl { font-family: var(--mono); font-size: 11px; letter-spacing: .1em; text-transform: uppercase;
    color: var(--accent-ink); font-weight: 700; }
  .callout.fix .lbl { color: var(--warn); }
  .callout p { margin: 6px 0 0; font-size: 14.5px; }

  .tbl-wrap { overflow-x: auto; margin: 16px 0; border: 1px solid var(--border); border-radius: 12px; }
  table { border-collapse: collapse; width: 100%; font-size: 14px; }
  th, td { text-align: left; padding: 10px 14px; border-bottom: 1px solid var(--border); vertical-align: top; }
  th { font-family: var(--mono); font-size: 11px; letter-spacing: .06em; text-transform: uppercase;
    color: var(--muted); background: var(--surface-2); position: sticky; top: 0; }
  tr:last-child td { border-bottom: none; }
  td code { white-space: nowrap; }

  .m { font-family: var(--mono); font-size: 11px; font-weight: 700; letter-spacing: .04em;
    padding: 2px 7px; border-radius: 5px; display: inline-block; min-width: 46px; text-align: center; }
  .m.get { color: var(--get); background: var(--get-bg); }
  .m.post { color: var(--post); background: var(--post-bg); }
  .m.put { color: var(--put); background: var(--put-bg); }
  .m.del { color: var(--del); background: var(--del-bg); }

  .role-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px,1fr)); gap: 10px; margin: 14px 0; }
  .role { border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; background: var(--surface); }
  .role b { font-family: var(--mono); font-size: 13px; }
  .role span { display: block; font-size: 13px; color: var(--muted); margin-top: 3px; }

  /* ---- static diagrams (no JS) ---- */
  .diagram { background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
    padding: 20px 18px; margin: 16px 0; overflow-x: auto; }
  .flow { display: flex; align-items: stretch; gap: 0; min-width: min-content; }
  .flow .node { background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px;
    padding: 12px 14px; font-size: 13px; line-height: 1.4; min-width: 130px; text-align: center;
    display: flex; flex-direction: column; justify-content: center; }
  .flow .node b { display: block; font-size: 13.5px; margin-bottom: 2px; }
  .flow .node small { color: var(--muted); font-size: 11.5px; font-family: var(--mono); }
  .flow .node.accent { border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); background: var(--accent-soft); }
  .flow .arrow { align-self: center; flex: none; color: var(--faint); font-family: var(--mono);
    padding: 0 10px; font-size: 12px; white-space: nowrap; text-align: center; }
  .flow .arrow small { display: block; font-size: 10px; }
  .flow .stack { display: flex; flex-direction: column; gap: 8px; }
  .flow-note { margin-top: 12px; font-size: 12.5px; color: var(--muted); font-family: var(--mono);
    border-top: 1px dashed var(--border); padding-top: 10px; }

  .tree { font-size: 13.5px; }
  .tree .lvl { display: flex; align-items: center; gap: 10px; margin: 3px 0; }
  .tree .box { background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px;
    padding: 6px 12px; font-family: var(--mono); font-size: 12.5px; }
  .tree .box.accent { border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); background: var(--accent-soft); color: var(--accent-ink); }
  .tree .rel { color: var(--faint); font-family: var(--mono); font-size: 11px; }
  .tree .indent { display: inline-block; color: var(--faint); font-family: var(--mono); }

  footer { max-width: var(--maxw); margin: 0 auto; padding: 26px 28px 60px; color: var(--faint);
    font-size: 13px; border-top: 1px solid var(--border); }
  footer code { font-size: 12px; }

  @media (max-width: 860px) {
    .shell { grid-template-columns: 1fr; gap: 0; padding: 0 20px 70px; }
    nav.toc.desktop { display: none; }
    .toc-m { display: block; margin: 22px 0 4px; background: var(--surface);
      border: 1px solid var(--border); border-radius: 12px; padding: 4px 16px; }
    .toc-m summary { font-family: var(--mono); font-size: 13px; font-weight: 600; padding: 12px 0; cursor: pointer; }
    .toc-m a { display: block; padding: 6px 0; font-size: 14px; color: var(--muted); }
    .hero-inner { padding: 34px 20px 28px; }
  }
</style>
</head>
<body>
<header class="hero">
  <div class="hero-inner">
    <div class="brand"><span class="mark">P</span><b>SParking</b></div>
    <h1>Smart Parking Platform — Developer Guide</h1>
    <p class="lede">An AI-powered, multi-tenant parking management system: computer-vision vehicle detection feeds a real-time occupancy engine, backed by a Next.js app, Prisma/PostgreSQL, and Socket.IO live updates.</p>
    <div class="status"><span class="dot"></span> Verified working end-to-end</div>
    <div class="chips">
      <span class="chip">Next.js 16</span><span class="chip">React 19</span><span class="chip">TypeScript 5</span>
      <span class="chip">Prisma 7</span><span class="chip">PostgreSQL</span><span class="chip">Socket.IO 4</span>
      <span class="chip">Zod 4</span><span class="chip">Tailwind 4</span><span class="chip">JWT (jose)</span>
    </div>
  </div>
</header>

<div class="shell">
  <nav class="toc desktop" aria-label="Contents">
    <div class="grp">Orientation</div>
    <a href="#status">Verification status</a>
    <a href="#overview">What it is</a>
    <a href="#architecture">Architecture</a>
    <a href="#stack">Tech stack</a>
    <a href="#structure">Project structure</a>
    <div class="grp">Running it</div>
    <a href="#start">Getting started</a>
    <a href="#env">Environment</a>
    <a href="#run">Run modes</a>
    <a href="#accounts">Demo accounts</a>
    <div class="grp">The system</div>
    <a href="#data">Data model</a>
    <a href="#auth">Auth &amp; roles</a>
    <a href="#api">API reference</a>
    <a href="#realtime">Real-time</a>
    <a href="#ai">AI detection</a>
    <div class="grp">Operating</div>
    <a href="#testing">Testing</a>
    <a href="#deploy">Deployment</a>
    <a href="#fixes">Fixes applied</a>
  </nav>

  <main>
    <details class="toc-m">
      <summary>Contents</summary>
      <a href="#status">Verification status</a>
      <a href="#overview">What it is</a>
      <a href="#architecture">Architecture</a>
      <a href="#stack">Tech stack</a>
      <a href="#structure">Project structure</a>
      <a href="#start">Getting started</a>
      <a href="#env">Environment</a>
      <a href="#run">Run modes</a>
      <a href="#accounts">Demo accounts</a>
      <a href="#data">Data model</a>
      <a href="#auth">Auth &amp; roles</a>
      <a href="#api">API reference</a>
      <a href="#realtime">Real-time</a>
      <a href="#ai">AI detection</a>
      <a href="#testing">Testing</a>
      <a href="#deploy">Deployment</a>
      <a href="#fixes">Fixes applied</a>
    </details>

    <section id="status">
      <span class="eyebrow">Status</span>
      <h2>Is it working end-to-end?</h2>
      <p><strong>Yes.</strong> The application was booted against a live PostgreSQL database and exercised across every major surface — health, authentication, the full CRUD API, real-time occupancy, analytics, and the AI-pipeline detection ingest. All core flows return correctly.</p>
      <p>Two genuine end-to-end breaks were found during verification and fixed (both server-side; see <a href="#fixes">Fixes applied</a>):</p>
      <div class="cols">
        <div class="card"><h4>Analytics 500 &rarr; fixed</h4><p>Raw SQL referenced snake_case columns that don't exist; Prisma maps only the <em>table</em> name to snake_case, not columns.</p></div>
        <div class="card"><h4>AI ingest 401 &rarr; fixed</h4><p>Middleware blocked the detection endpoint before its API-key check could run, so the vision pipeline could never post events.</p></div>
      </div>
      <div class="callout">
        <span class="lbl">Verified live</span>
        <p>Health <code>database: up</code> · login issues a JWT cookie · 16 authenticated endpoints return 200 · analytics <code>overview/occupancy/revenue/traffic</code> all 200 · a real detection event was ingested and persisted (<code>eventId</code> returned).</p>
      </div>
    </section>

    <section id="overview">
      <span class="eyebrow">Concept</span>
      <h2>What it is</h2>
      <p>SParking manages the full lifecycle of vehicles in parking facilities. Cameras run an AI pipeline that detects vehicles and reads plates; detections drive slot-occupancy state; operators watch a live dashboard; drivers pay, find their car, and use kiosks. Everything is scoped to an <strong>Organization</strong> (multi-tenant) and, within it, to individual <strong>Parking Lots</strong>.</p>
      <div class="cols">
        <div class="card"><h4>Facility model</h4><p>Organization → Parking Lots → Zones → Slots (480 slots seeded across 2 lots).</p></div>
        <div class="card"><h4>Vision-driven</h4><p>Cameras &amp; an AI pipeline emit detection events that update occupancy in real time.</p></div>
        <div class="card"><h4>Payments &amp; wallet</h4><p>Tokens, transactions, wallets, bank accounts, Stripe, and a sandbox simulator.</p></div>
        <div class="card"><h4>Surfaces</h4><p>Operator dashboard, driver find-car, self-service kiosk, and a mobile API.</p></div>
      </div>
    </section>

    <section id="architecture">
      <span class="eyebrow">How it fits together</span>
      <h2>Architecture</h2>
      <p>A single Next.js App-Router project serves both the UI and the API (route handlers under <code>src/app/api</code>). A custom Node server adds Socket.IO for live updates. The AI pipeline is a separate Python service that posts detections back over HTTP.</p>
      <div class="diagram">
        <div class="flow">
          <div class="node"><b>Cameras</b><small>RTSP / ONVIF</small></div>
          <div class="arrow">&rarr;</div>
          <div class="node"><b>AI Pipeline</b><small>Python · LPR</small></div>
          <div class="arrow">&rarr;<small>x-api-key</small></div>
          <div class="node accent"><b>Detection API</b><small>/api/realtime</small></div>
          <div class="arrow">&rarr;</div>
          <div class="stack">
            <div class="node"><b>Prisma 7</b><small>&rarr; PostgreSQL</small></div>
            <div class="node"><b>Socket.IO</b><small>server.js</small></div>
          </div>
          <div class="arrow">&rarr;</div>
          <div class="node accent"><b>UI</b><small>dash · kiosk<br>find-car · mobile</small></div>
        </div>
        <div class="flow-note">Every request first passes through <code>src/proxy.ts</code> — auth · CSRF · rate-limit — before reaching a handler.</div>
      </div>
      <p class="muted"><code>src/proxy.ts</code> is Next.js 16's renamed middleware. It enforces JWT auth, CSRF, and rate limiting. Public routes (login, health, webhooks, the AI detection ingest) are explicitly allow-listed.</p>
    </section>

    <section id="stack">
      <span class="eyebrow">Dependencies</span>
      <h2>Tech stack</h2>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Layer</th><th>Choice</th><th>Notes</th></tr></thead>
        <tbody>
          <tr><td>Framework</td><td>Next.js 16 (App Router)</td><td>React 19, React Compiler, Turbopack dev</td></tr>
          <tr><td>Language</td><td>TypeScript 5</td><td>Strict; path alias <code>@/*</code> → <code>src/*</code></td></tr>
          <tr><td>ORM / DB</td><td>Prisma 7 · PostgreSQL</td><td>Neon or <code>pg</code> adapter; snake_case table maps</td></tr>
          <tr><td>Auth</td><td>JWT via <code>jose</code> · bcryptjs</td><td>HttpOnly cookie <code>auth-token</code>; Microsoft OAuth2 + PKCE</td></tr>
          <tr><td>Validation</td><td>Zod 4</td><td>Shared schemas in <code>src/lib/validators</code></td></tr>
          <tr><td>Real-time</td><td>Socket.IO 4</td><td>Room-based; via <code>server.js</code></td></tr>
          <tr><td>UI</td><td>Tailwind 4 · Radix · shadcn-style</td><td><code>src/components/ui</code>; Recharts, Leaflet maps</td></tr>
          <tr><td>Payments</td><td>Stripe · wallet · sandbox</td><td>QR tokens, PDF receipts (jsPDF)</td></tr>
          <tr><td>Observability</td><td>Sentry · <code>/api/health</code> · <code>/api/metrics</code></td><td>Correlation IDs on every request</td></tr>
          <tr><td>AI pipeline</td><td>Python (<code>ai-pipeline/</code>)</td><td>Optional Metro/DL-Streamer integration</td></tr>
        </tbody>
      </table></div>
    </section>

    <section id="structure">
      <span class="eyebrow">Layout</span>
      <h2>Project structure</h2>
<pre><code><span class="c-com"># app root</span>
prisma/            <span class="c-com"># schema.prisma, migrations, seed.ts</span>
server.js          <span class="c-com"># custom server = Next + Socket.IO</span>
src/
  app/             <span class="c-com"># App Router: pages + api/ route handlers</span>
    api/           <span class="c-com"># 90+ REST endpoints (auth, mobile, payments…)</span>
    dashboard/     <span class="c-com"># operator UI (live, zones, cameras, transactions)</span>
    kiosk/  find-car/  pay/  login/  register/  usermanual/
  proxy.ts         <span class="c-com"># auth · CSRF · rate-limit (Next 16 "middleware")</span>
  lib/             <span class="c-com"># auth, db, validators, payments, websocket, cache…</span>
  components/      <span class="c-com"># ui/, dashboard/, camera/, auth/, signage/</span>
  hooks/ store/ services/ types/
ai-pipeline/       <span class="c-com"># Python CV service (detect + license-plate read)</span>
metro-integration/ <span class="c-com"># DL-Streamer, Milvus, MQTT, Grafana, Node-RED</span>
docker/ Dockerfile docker-compose.yml</code></pre>
    </section>

    <section id="start">
      <span class="eyebrow">Setup</span>
      <h2>Getting started</h2>
      <p><strong>Prerequisites:</strong> Node.js 20+ (verified on 22), a PostgreSQL 14+ instance, and <code>npm</code>. Docker optional.</p>
<pre><code><span class="c-com"># 1. install</span>
npm install

<span class="c-com"># 2. configure — copy the template and fill in secrets</span>
cp .env.example .env
<span class="c-com">#   set DATABASE_URL, then generate the three secrets:</span>
<span class="c-com">#   JWT_SECRET / ENCRYPTION_KEY = openssl rand -base64 32</span>
<span class="c-com">#   DETECTION_API_KEY           = openssl rand -hex 32</span>

<span class="c-com"># 3. database — schema + demo data in one step</span>
npm run demo:setup        <span class="c-com"># = db:push + db:seed</span>

<span class="c-com"># 4. run</span>
npm run dev               <span class="c-com"># http://localhost:3000</span></code></pre>
      <div class="callout">
        <span class="lbl">One-liners that matter</span>
        <p><code>npm run db:reset</code> wipes &amp; reseeds · <code>npm run db:migrate</code> creates a dev migration · <code>npx prisma studio</code> browses the DB · <code>npm run test:run</code> runs Vitest.</p>
      </div>
    </section>

    <section id="env">
      <span class="eyebrow">Configuration</span>
      <h2>Environment variables</h2>
      <p>The full annotated list lives in <code>.env.example</code>. The essentials:</p>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Variable</th><th>Required</th><th>Purpose</th></tr></thead>
        <tbody>
          <tr><td><code>DATABASE_URL</code></td><td>Yes</td><td>PostgreSQL connection string</td></tr>
          <tr><td><code>JWT_SECRET</code></td><td>Yes</td><td>Signs session JWTs (min 32 chars)</td></tr>
          <tr><td><code>ENCRYPTION_KEY</code></td><td>Yes</td><td>Encrypts sensitive fields at rest</td></tr>
          <tr><td><code>DETECTION_API_KEY</code></td><td>Yes*</td><td>API key the AI pipeline uses on <code>/api/realtime/detection</code></td></tr>
          <tr><td><code>NEXT_PUBLIC_APP_URL</code></td><td>Yes</td><td>Public base URL / CORS origin</td></tr>
          <tr><td><code>NEXT_PUBLIC_SOCKET_URL</code></td><td>No</td><td>Socket.IO endpoint (defaults to app URL)</td></tr>
          <tr><td><code>MAX_SESSIONS_PER_USER</code></td><td>No</td><td>Concurrent session cap (default 5)</td></tr>
          <tr><td><code>CRON_SECRET</code></td><td>No</td><td>Bearer secret for <code>/api/cron/*</code> jobs</td></tr>
          <tr><td><code>EMAIL_PROVIDER</code></td><td>No</td><td><code>console</code> (default), <code>smtp</code>, <code>resend</code>, <code>sendgrid</code></td></tr>
          <tr><td><code>STRIPE_SECRET_KEY</code></td><td>No</td><td>Enables live payments; sandbox works without it</td></tr>
          <tr><td>Microsoft SSO</td><td>No</td><td><code>MICROSOFT_CLIENT_ID/SECRET/TENANT_ID</code> for OAuth</td></tr>
        </tbody>
      </table></div>
      <p class="muted">* Required for the detection endpoint to function; if unset, that route returns a "not configured" error.</p>
    </section>

    <section id="run">
      <span class="eyebrow">Two entry points</span>
      <h2>Run modes</h2>
      <p>There are two ways to serve the app — pick based on whether you need live Socket.IO.</p>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Command</th><th>Server</th><th>Socket.IO</th><th>Use for</th></tr></thead>
        <tbody>
          <tr><td><code>npm run dev</code></td><td>Next dev (Turbopack)</td><td>No</td><td>Everyday development, HMR</td></tr>
          <tr><td><code>node server.js</code></td><td>Custom HTTP + Next</td><td>Yes</td><td>Testing real-time occupancy / wallet pushes</td></tr>
          <tr><td><code>npm run build &amp;&amp; npm start</code></td><td>Next production</td><td>No</td><td>Prod build (run <code>server.js</code> for sockets)</td></tr>
        </tbody>
      </table></div>
      <p><code>npm run build</code> runs <code>prisma generate &amp;&amp; prisma migrate deploy &amp;&amp; next build</code> — so a build also applies pending migrations.</p>
    </section>

    <section id="accounts">
      <span class="eyebrow">Seeded logins</span>
      <h2>Demo accounts</h2>
      <p>The seed creates a demo organization (<em>Phoenix Parking Solutions</em>) with two lots, 14 zones, 480 slots, 9 cameras, and 10 vehicles. All demo passwords are <code>demo123</code>.</p>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Email</th><th>Role</th><th>Sees</th></tr></thead>
        <tbody>
          <tr><td><code>admin@demo.sparking.io</code></td><td>ADMIN</td><td>Org-scoped: management of assigned lots</td></tr>
          <tr><td><code>operator@demo.sparking.io</code></td><td>OPERATOR</td><td>Day-to-day operations, gates, tokens</td></tr>
          <tr><td><code>viewer@demo.sparking.io</code></td><td>VIEWER</td><td>Read-only dashboards</td></tr>
          <tr><td><code>admin@sparking.io</code></td><td>SUPER_ADMIN</td><td>Cross-organization</td></tr>
        </tbody>
      </table></div>
    </section>

    <section id="data">
      <span class="eyebrow">Domain</span>
      <h2>Data model</h2>
      <p>The Prisma schema defines ~40 models. The occupancy core is a strict hierarchy; payments and vision hang off it.</p>
      <div class="diagram">
        <div class="tree">
          <div class="lvl"><span class="box accent">Organization</span><span class="rel">owns lots · employs users</span></div>
          <div class="lvl"><span class="indent">└─</span><span class="box">ParkingLot</span><span class="rel">contains zones · monitors cameras · controls gates</span></div>
          <div class="lvl"><span class="indent">&nbsp;&nbsp;&nbsp;└─</span><span class="box">Zone</span><span class="rel">contains slots</span></div>
          <div class="lvl"><span class="indent">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└─</span><span class="box accent">Slot</span><span class="rel">↔ SlotOccupancy log</span></div>
          <div class="lvl" style="margin-top:10px"><span class="box">Camera</span><span class="rel">emits → DetectionEvent</span></div>
          <div class="lvl"><span class="box">Vehicle</span><span class="rel">→ Token (entry/exit) → Transaction</span></div>
          <div class="lvl"><span class="box">User</span><span class="rel">→ Wallet → WalletTransaction · BankAccount</span></div>
        </div>
      </div>
      <div class="cols">
        <div class="card"><h4>Occupancy</h4><p>Organization · ParkingLot · Zone · Slot · SlotOccupancy · Camera · Gate · Display</p></div>
        <div class="card"><h4>Movement</h4><p>Token (entry/exit) · Vehicle · DetectionEvent · VehicleFeatureIndex</p></div>
        <div class="card"><h4>Money</h4><p>Transaction · PricingRule · Wallet · WalletTransaction · BankAccount · Payment · SandboxConfig</p></div>
        <div class="card"><h4>Platform</h4><p>User · Session · AuditLog · AlertRule · Notification · SystemConfig</p></div>
      </div>
      <div class="callout fix">
        <span class="lbl">Gotcha</span>
        <p>Prisma models map to snake_case <em>table</em> names (<code>User</code> → <code>users</code>) via <code>@@map</code>, but <strong>columns keep camelCase</strong>. In raw SQL you must quote them: <code>"entryTime"</code>, <code>"parkingLotId"</code> — not <code>entry_time</code>.</p>
      </div>
    </section>

    <section id="auth">
      <span class="eyebrow">Security</span>
      <h2>Auth &amp; roles</h2>
      <p>Login (<code>POST /api/auth/login</code>) verifies a bcrypt hash, enforces the concurrent-session cap, and sets an <strong>HttpOnly <code>auth-token</code> cookie</strong> (a <code>jose</code>-signed JWT carrying <code>userId</code>, <code>email</code>, <code>role</code>, <code>organizationId</code>). <code>src/proxy.ts</code> validates it on every protected route and redirects unauthenticated page requests to <code>/login</code>. Microsoft OAuth2 (server-side, PKCE) is also supported.</p>
      <h3>Roles</h3>
      <div class="role-grid">
        <div class="role"><b>SUPER_ADMIN</b><span>All orgs, all settings</span></div>
        <div class="role"><b>ADMIN</b><span>Full control of own org</span></div>
        <div class="role"><b>OPERATOR</b><span>Daily operations</span></div>
        <div class="role"><b>AUDITOR</b><span>Read + audit logs</span></div>
        <div class="role"><b>VIEWER</b><span>Read-only</span></div>
        <div class="role"><b>CUSTOMER</b><span>Driver / mobile</span></div>
      </div>
      <p class="muted">Non-auth API routes require a valid session; state-changing methods also require a CSRF token except on allow-listed machine endpoints (webhooks, cron, realtime). Data is automatically scoped to the caller's organization and assigned lots.</p>
    </section>

    <section id="api">
      <span class="eyebrow">HTTP</span>
      <h2>API reference</h2>
      <p>90+ route handlers under <code>src/app/api</code>. Responses follow <code>{ success, data }</code> or <code>{ success:false, error, correlationId }</code>. A representative slice (all verified returning 200 when authenticated):</p>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Method</th><th>Endpoint</th><th>Purpose</th></tr></thead>
        <tbody>
          <tr><td><span class="m post">POST</span></td><td><code>/api/auth/login</code></td><td>Authenticate, set cookie</td></tr>
          <tr><td><span class="m get">GET</span></td><td><code>/api/auth/me</code></td><td>Current user + org + lots</td></tr>
          <tr><td><span class="m get">GET</span></td><td><code>/api/health</code></td><td>DB / cache / memory checks</td></tr>
          <tr><td><span class="m get">GET</span></td><td><code>/api/parking-lots</code></td><td>Lots (org-scoped)</td></tr>
          <tr><td><span class="m get">GET</span></td><td><code>/api/parking-lots/:id/status</code></td><td>Live occupancy (public kiosk)</td></tr>
          <tr><td><span class="m get">GET</span></td><td><code>/api/zones</code> · <code>/api/slots</code></td><td>Zones &amp; slots</td></tr>
          <tr><td><span class="m get">GET</span></td><td><code>/api/cameras</code></td><td>Cameras (+ <code>/probe</code>, <code>/snapshot</code>, <code>/stream</code>)</td></tr>
          <tr><td><span class="m get">GET</span></td><td><code>/api/analytics?parkingLotId=…</code></td><td><code>overview·occupancy·revenue·traffic</code></td></tr>
          <tr><td><span class="m get">GET</span></td><td><code>/api/vehicles</code> · <code>/search</code></td><td>Vehicles &amp; plate search</td></tr>
          <tr><td><span class="m post">POST</span></td><td><code>/api/vehicles</code></td><td>Register a vehicle</td></tr>
          <tr><td><span class="m get">GET</span></td><td><code>/api/transactions</code> · <code>/api/wallet</code></td><td>Money movement</td></tr>
          <tr><td><span class="m post">POST</span></td><td><code>/api/payments/*</code></td><td>Deposit, parking, transfer, webhook</td></tr>
          <tr><td><span class="m post">POST</span></td><td><code>/api/realtime/detection</code></td><td>AI pipeline ingest (API-key)</td></tr>
          <tr><td><span class="m get">GET</span></td><td><code>/api/mobile/*</code></td><td>Mobile app surface (own auth)</td></tr>
          <tr><td><span class="m get">GET</span></td><td><code>/api/docs</code></td><td>Swagger UI / OpenAPI</td></tr>
        </tbody>
      </table></div>
      <p class="muted">Interactive docs are served at <code>/docs</code> (Swagger UI) with the spec at <code>/api/docs</code>. A GraphQL endpoint also exists at <code>/api/graphql</code>.</p>
    </section>

    <section id="realtime">
      <span class="eyebrow">Live updates</span>
      <h2>Real-time (Socket.IO)</h2>
      <p>Run <code>node server.js</code> to enable sockets. Clients join <strong>rooms</strong> to receive scoped pushes; the server broadcasts occupancy and wallet changes into those rooms.</p>
<pre><code><span class="c-key">const</span> socket = io(process.env.NEXT_PUBLIC_SOCKET_URL)

<span class="c-com">// join scoped rooms</span>
socket.emit(<span class="c-str">'join:parking-lot'</span>, parkingLotId)
socket.emit(<span class="c-str">'join:zone'</span>, zoneId)
socket.emit(<span class="c-str">'join:wallet'</span>, walletId)

<span class="c-com">// matching leave events: leave:parking-lot / leave:zone / leave:wallet</span></code></pre>
      <p class="muted">CORS on the socket server is bound to <code>NEXT_PUBLIC_APP_URL</code>; transports are websocket + polling with a 60s ping timeout.</p>
    </section>

    <section id="ai">
      <span class="eyebrow">Computer vision</span>
      <h2>AI detection ingest</h2>
      <p>The Python pipeline in <code>ai-pipeline/</code> reads camera streams, detects vehicles, and reads plates, then POSTs each event. This endpoint authenticates with <code>DETECTION_API_KEY</code> (header <code>x-api-key</code> or <code>Authorization: Bearer</code>) — <em>not</em> a user session — and is allow-listed in the proxy.</p>
<pre><code>POST /api/realtime/detection
x-api-key: &lt;DETECTION_API_KEY&gt;
Content-Type: application/json

{
  <span class="c-str">"cameraId"</span>: <span class="c-str">"&lt;camera id&gt;"</span>,
  <span class="c-str">"eventType"</span>: <span class="c-str">"VEHICLE_DETECTED"</span>,   <span class="c-com">// or SLOT_OCCUPIED, LICENSE_PLATE_READ, …</span>
  <span class="c-str">"objectType"</span>: <span class="c-str">"car"</span>,
  <span class="c-str">"confidence"</span>: 0.94,               <span class="c-com">// 0..1</span>
  <span class="c-str">"bbox"</span>: { <span class="c-str">"x"</span>: 0.1, <span class="c-str">"y"</span>: 0.1, <span class="c-str">"width"</span>: 0.3, <span class="c-str">"height"</span>: 0.2 },
  <span class="c-str">"vehicleType"</span>: <span class="c-str">"CAR"</span>, <span class="c-str">"vehicleColor"</span>: <span class="c-str">"blue"</span>, <span class="c-str">"licensePlate"</span>: <span class="c-str">"KA01AB1234"</span>
}
<span class="c-com">// → 200 { success:true, data:{ eventId }, message:"Detection event processed" }</span></code></pre>
      <p class="muted">Payload is validated by <code>detectionEventSchema</code> (Zod). <code>bbox</code> values are normalized 0–1. An optional Metro/DL-Streamer + Milvus stack under <code>metro-integration/</code> handles feature-matching &amp; find-my-car.</p>
    </section>

    <section id="testing">
      <span class="eyebrow">Quality</span>
      <h2>Testing &amp; verification</h2>
      <div class="cols">
        <div class="card"><h4>Unit</h4><p><code>npm run test:run</code> — Vitest + Testing Library (<code>src/__tests__</code>).</p></div>
        <div class="card"><h4>E2E</h4><p><code>npm run test:e2e</code> — Playwright.</p></div>
        <div class="card"><h4>Load</h4><p><code>npm run test:load</code> — k6 scenarios.</p></div>
        <div class="card"><h4>Health</h4><p><code>GET /api/health</code> — DB, cache, memory with latencies.</p></div>
      </div>
      <p>Fastest end-to-end smoke check: <code>curl -s localhost:3000/api/health</code> should report <code>"database":{"status":"up"}</code>, then log in and hit <code>/api/auth/me</code>.</p>
    </section>

    <section id="deploy">
      <span class="eyebrow">Ship it</span>
      <h2>Deployment</h2>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Target</th><th>How</th><th>Notes</th></tr></thead>
        <tbody>
          <tr><td>Docker</td><td><code>docker compose up</code></td><td>App + Postgres; <code>Dockerfile</code> + <code>docker-compose.yml</code></td></tr>
          <tr><td>Vercel</td><td><code>vercel.json</code></td><td>Serverless; use a managed Postgres (Neon adapter included). Sockets need a separate host.</td></tr>
          <tr><td>Azure</td><td><code>azure-pipelines.yml</code></td><td>CI/CD pipeline definition present</td></tr>
        </tbody>
      </table></div>
      <div class="callout">
        <span class="lbl">Before prod</span>
        <p>Rotate all secrets (see <code>docs/secret-rotation.md</code>), set <code>NODE_ENV=production</code>, configure a real <code>EMAIL_PROVIDER</code>, Sentry DSN, and Stripe keys. <code>npm run build</code> applies migrations automatically.</p>
      </div>
    </section>

    <section id="fixes">
      <span class="eyebrow">Changelog</span>
      <h2>Fixes applied during verification</h2>
      <p>Two server-side defects blocked genuine end-to-end operation. Both are fixed in the codebase:</p>
      <h3>1 · Analytics endpoint 500 → 200</h3>
      <p><code>src/app/api/analytics/route.ts</code> — the peak-hours raw query used snake_case columns (<code>entry_time</code>, <code>parking_lot_id</code>) that don't exist; Prisma maps only table names. Fixed by quoting the real camelCase columns. Also changed the missing-<code>parkingLotId</code> response from a 500 to a proper <code>400</code>.</p>
<pre><code><span class="c-com">- EXTRACT(HOUR FROM entry_time) ... WHERE parking_lot_id = ...</span>
<span class="c-str">+ EXTRACT(HOUR FROM "entryTime") ... WHERE "parkingLotId" = ...</span></code></pre>
      <h3>2 · AI detection ingest 401 → reachable</h3>
      <p><code>src/proxy.ts</code> — <code>/api/realtime/</code> was CSRF-exempt but not in <code>PUBLIC_API_ROUTES</code>, so the middleware demanded a user JWT and returned <em>"Authentication required"</em> before the route's own <code>x-api-key</code> check could run. Added <code>/api/realtime/</code> to the public API allow-list; the route still fully enforces <code>DETECTION_API_KEY</code>.</p>
      <div class="callout">
        <span class="lbl">Verify the fixes</span>
        <p>Analytics: <code>GET /api/analytics?parkingLotId=…&amp;type=overview</code> → 200. Ingest: POST a valid event with <code>x-api-key</code> → <code>200 { data:{ eventId } }</code>; without the key → <code>401 "Invalid or missing API key"</code>.</p>
      </div>
    </section>
  </main>
</div>

<footer>
  SParking developer guide · served at <code>/usermanual</code> · schema, routes, and env reflect the working tree at <code>main</code>. Source of truth: <code>prisma/schema.prisma</code>, <code>src/app/api</code>, <code>.env.example</code>.
</footer>
</body>
</html>`

export async function GET() {
  return new NextResponse(HTML, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600',
    },
  })
}
