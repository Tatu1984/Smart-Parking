# CCTV — Future Architecture

CCTV is one capability of the Smart Parking platform. The streaming layer is
built on interfaces (`src/lib/streaming/providers.ts`) so the features below slot
in without rewriting business logic. This document is the roadmap and the map of
which seams each phase plugs into.

## Phase 1 — LAN streaming (this milestone) ✅

```mermaid
flowchart LR
  CAM["Camera (RTSP)"] --> MTX["MediaMTX"] --> B["Browser (HLS/WebRTC)"]
  APP["Backend"] -->|control API| MTX
  APP -->|status/logs| ADMIN["Admin dashboard"]
```

Backend pulls RTSP into MediaMTX; credential-free HLS/WebRTC to the browser;
health worker + connection logs. Works when the server can reach the camera.

## Phase 2 — Cloud/edge ingest (cameras behind NAT/CGNAT)

The hard problem: cameras sit on private LANs the cloud cannot reach inbound
(NAT, and especially **CGNAT**, make "cloud connects to camera" impossible for a
large fraction of sites). The rule: **the site must reach OUT to us.**

```mermaid
flowchart LR
  subgraph Site["Remote site (NAT/CGNAT)"]
    CAM["Camera (RTSP)"] --> EDGE["Edge agent\n(FFmpeg WHIP publish)"]
  end
  EDGE -->|WHIP outbound| MTX["MediaMTX cluster\n(public / cloud)"]
  MTX --> B["Browsers (fan-out)"]
```

- **Seam:** a new `StreamProvider` implementation (e.g. `EdgeProvider` /
  `CloudStreamProvider`) — the backend, routes, health worker, and UI are
  unchanged; only the provider and ingest mechanism differ.
- **Fan-out** moves off the camera to the cluster (one camera uplink can serve
  one stream; the cluster serves many viewers).
- **Phase 2C hardening:** replace open reader access with **short-lived,
  scoped playback tokens** minted by the backend, so a playback URL is not a
  permanent key.

## Phase 3 — AI analytics

```mermaid
flowchart LR
  MTX["MediaMTX"] --> DET["DetectionProvider"]
  DET --> OBJ["Object detection"]
  DET --> LPR["ANPR / LPR"]
  DET --> OCC["Occupancy / vehicle count"]
  DET --> INT["Intrusion"]
  OBJ & LPR & OCC & INT --> EV["stream events → alerts"]
```

- **Seam:** `DetectionProvider` (interface defined now). Wraps SParking's
  existing `DetectionEvent` model + AI pipeline (DL-Streamer / OpenVINO, Milvus
  vehicle-image search) already present in the repo.
- Detections publish onto the same `events.ts` bus → power alerts and live
  overlays without new plumbing. Ties directly into parking occupancy detection,
  vehicle counting, and ANPR-driven token matching.

## Phase 4 — Recording, playback & archive

```mermaid
flowchart LR
  MTX["MediaMTX"] --> REC["RecordingProvider"]
  REC --> SEG["Segments"] --> TL["Timeline / scrubber"]
  SEG --> ARCH["Cloud archive (lifecycle)"]
```

- **Seam:** `RecordingProvider` (interface defined now). MediaMTX can record
  segments natively; the provider exposes start/stop/list/get so a timeline UI
  and cloud archival policy layer on top.

## Event-based alerts (cross-cutting)

`NotificationProvider` (interface defined now) fronts SParking's existing
`Notification` model / email / Socket.IO. Any phase can raise alerts (camera
offline, intrusion, overstay, occupancy threshold) by emitting a stream event
and letting a notification consumer deliver it.

## Why the abstractions now

Defining `StreamProvider` (implemented), plus `Recording/Detection/Notification`
(interfaces), is a small upfront cost that lets us later swap MediaMTX for a
cloud service (AWS Kinesis Video, Azure Video Indexer) or an on-prem VMS
(Milestone, Nx Witness), and add AI/recording/edge — **without changing the
camera business logic, API routes, or UI.**
