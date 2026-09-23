# Resylix (Vanguard Geo) — Offline Tactical Navigation & Hazard Mesh

[![Live Deployment](https://img.shields.io/badge/Live%20Platform-emergency--dispatch--2.onrender.com-success?style=for-the-badge&logo=render)](https://emergency-dispatch-2.onrender.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![PWA Ready](https://img.shields.io/badge/PWA-Offline%20Ready-orange?style=for-the-badge)](https://emergency-dispatch-2.onrender.com/)

**Resylix (formerly Vanguard Geo)** is a mission-critical, zero-connectivity offline navigation, real-time vehicle-to-vehicle (V2V) hazard mesh dispatch, and disaster response platform engineered for austere, disconnected environments (such as Kerala flood and landslide zones).

- **Official Live Web Application:** [https://emergency-dispatch-2.onrender.com/](https://emergency-dispatch-2.onrender.com/)
- **Sitemap Index:** [https://emergency-dispatch-2.onrender.com/sitemap.xml](https://emergency-dispatch-2.onrender.com/sitemap.xml)
- **Robots Directives:** [https://emergency-dispatch-2.onrender.com/robots.txt](https://emergency-dispatch-2.onrender.com/robots.txt)

---

## Key Features

1. **Deterministic Offline Vector Routing:** Real-road Dijkstra graph routing and OSRM turn-by-turn maneuvers operating 100% offline without cellular or satellite data.
2. **Peer-to-Peer Bluetooth LE Hazard Radar:** Multi-hop daisy-chain mesh gossip protocol relaying roadblock, landslide, and flood warnings between civilian devices and emergency responders.
3. **Dynamic Threat Geofencing & Interception:** Early warning spatial proximity engine with photographic hazard ground truth evidence.
4. **Resylix Tactical Terminal:** Real-time unit dispatch, QR-code waypoint handoff, offline audit logging, and automated evacuation routing.

---

## Deploy to Render

This frontend is deployed as a **Render Static Site** at [https://emergency-dispatch-2.onrender.com/](https://emergency-dispatch-2.onrender.com/). The repository includes [`render.yaml`](render.yaml) with the required configuration:

## Install as an app

Build the project with `npm run build`, then host the `dist` folder over HTTPS. Open the deployed URL in Chrome, Edge, or Safari and choose **Install app** or **Add to Home Screen**. The service worker enables the app shell to continue opening offline after the first online visit.

The same web build works on phones, tablets, Windows, and macOS. Native Android/iOS packages can be added later with a mobile wrapper such as Capacitor.

## Dispatch configuration

Set `VITE_API_BASE_URL` at build time to the HTTPS base URL of the backend authentication and dispatch API. For the terminal login, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (the publishable/anon key only). The current project URL is already the default; only the publishable key is required for local development. Never expose or use a Supabase secret/service-role key in the frontend.

The backend must expose `POST /auth/login` and `POST /auth/register`. Registration accepts `{ "name": "Full name", "username": "email", "password": "..." }`; login accepts `{ "username": "email", "password": "..." }`. Validate credentials server-side, return a short-lived session token after login, and authorize all protected dispatch and notification operations. Registration should assign a restricted default role and enforce email verification/rate limits. Keep provider secrets and audit storage server-side.
- `VITE_EMERGENCY_POLICE`, `VITE_EMERGENCY_FIRE`, `VITE_EMERGENCY_MEDICAL`, and `VITE_EMERGENCY_DISASTER` set call-button placeholders.

The emergency numbers can also be edited locally from the Alerts panel. Configure email, webhook, database, and notification secrets only on the backend; never expose them through `VITE_*` variables.

### Optional Valhalla routing

The app can use a self-hosted [Valhalla](https://github.com/valhalla/valhalla) service for online road-level routes and ETAs. Set `VITE_VALHALLA_URL` to the service base URL at build time. The frontend calls its `/route` endpoint and keeps the bundled Dijkstra router as the automatic offline or fallback route. Do not use the public Valhalla demo server as a production dependency; proxy requests through your own backend when browser CORS or access-control policies require it.

### Optional PMTiles basemap and rerouting

Set `VITE_PMTILES_URL` to a raster PMTiles archive hosted on storage that supports CORS and HTTP range requests. The archive becomes the Leaflet basemap while incidents, responders, blockages, and routes remain application overlays. When both PMTiles and Valhalla are configured, an active blockage triggers a fresh Valhalla route request for the online route; when offline or unavailable, the bundled Dijkstra route remains the fallback. PMTiles is a basemap format, not a routing engine. For true offline map packs, download a regional archive into the native app or browser storage rather than relying only on a remote URL.

Create a `.env.local` file:

```env
VITE_SUPABASE_URL=https://yvoykxyksxtcupwwnovb.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Supabase's built-in email service has a low email rate limit. For local testing, either wait for the limit to reset, create users directly in **Authentication → Users**, or disable **Confirm email** under **Authentication → Providers → Email**. For production, configure a custom SMTP provider instead of disabling confirmation.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
