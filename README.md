# Whispers Webapp

React + TypeScript + Vite frontend for the Whispers realtime chat UI.

## Supported Targets

- desktop
- mobile

UI changes should be checked against both targets separately.

## Repository Shape

- `src/app/*`: app orchestration, providers, app shell layout, and app-level hooks/utils
- `src/features/*`: feature-local components, hooks, and styles
- `src/shared/*`: backend helpers, adapters, config, types, and pure utilities
- `src/test/setup.tsx`: shared Vitest and Testing Library setup

## Prerequisites

- Node.js and npm
- `openssl` on your PATH for local HTTPS certificate generation

## Local Development

Install dependencies and start the Vite dev server:

```bash
npm install
npm run dev
```

The dev server binds to `0.0.0.0` and runs over HTTPS so browser microphone APIs remain available for audio calling.

## Backend Integration

The app defaults to the current browser origin for its WebSocket entrypoint:

- WebSocket: `/ws/user`
- REST: `/chats`, `/messages`, `/users`

WebRTC 1-on-1 calls also default their ICE host to the current app hostname, which keeps local browser-to-browser calling aligned with the machine serving the app instead of a hard-coded LAN address.

In local development and preview, Vite proxies those routes to the backend origin configured by `VITE_BACKEND_ORIGIN`.

Default backend origin:

```bash
http://localhost:8080
```

Override it when needed:

```bash
VITE_BACKEND_ORIGIN=http://192.168.0.25:8080 npm run dev
```

`VITE_BACKEND_ORIGIN` may be provided as either an HTTP(S) origin or a WS(S) URL. The Vite config normalizes WebSocket values to the matching HTTP origin for proxying.

Optional WebRTC overrides:

- `VITE_WEBRTC_STUN_URLS`: comma-separated STUN URLs
- `VITE_WEBRTC_TURN_URLS`: comma-separated TURN URLs
- `VITE_WEBRTC_TURN_USERNAME`: TURN username override
- `VITE_WEBRTC_TURN_CREDENTIAL`: TURN credential override

If these are unset, the app uses `stun:<current-host>:3478` plus `turn:<current-host>:3478` defaults for local coturn-style setups, and the peer connection is allowed to use direct candidates instead of requiring TURN relay only.

## HTTPS Development Certificate

`npm run dev` and `npm run preview` both ensure a local self-signed certificate exists in `.devcert/`.

Default certificate hosts:

- `localhost`
- `127.0.0.1`

For LAN or mobile testing, include your machine IP before starting the server:

```bash
VITE_DEV_CERT_HOSTS=localhost,127.0.0.1,192.168.0.10 npm run dev
```

If the configured host list changes, the certificate is regenerated automatically. Trust the generated certificate locally before testing audio calling from another device or browser.

## Available Scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run test
npm run test:run
```

`npm run test` starts Vitest in watch mode. `npm run test:run` is the non-interactive run used for CI and Codex validation.

## Checks

Run these from the repo root as the normal baseline:

```bash
npm run lint
npm run test:run
```

Add `npm run build` when a change touches shared UI, Vite/configuration, proxy behavior, certificates, or other production-path behavior.
