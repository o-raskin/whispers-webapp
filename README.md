# Whispers Webapp

React + TypeScript + Vite frontend for the Whispers realtime chat UI.

## Local development

Install dependencies and start the app:

```bash
npm install
npm run dev
```

The dev server now starts over HTTPS so browser microphone APIs remain available for audio calling.

## Backend proxy

In local development, the frontend connects to the same origin by default:

- WebSocket: `/ws/user`
- REST: `/chats`, `/messages`, `/users`

Vite proxies those requests to the backend origin configured by `VITE_BACKEND_ORIGIN`.

Default backend origin:

```bash
http://localhost:8080
```

Override it when needed:

```bash
VITE_BACKEND_ORIGIN=http://192.168.0.25:8080 npm run dev
```

## HTTPS certificate

`npm run dev` generates a local self-signed certificate in `.devcert/` using `openssl`.

Default certificate hosts:

- `localhost`
- `127.0.0.1`

For LAN or mobile testing, include the machine IP in the cert before starting the dev server:

```bash
VITE_DEV_CERT_HOSTS=localhost,127.0.0.1,192.168.0.10 npm run dev
```

If your device or browser warns about the certificate, trust the generated cert locally before testing audio calls.

## Validation

Core checks from the repo root:

```bash
npm run lint
npm run test:run
```
