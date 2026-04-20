/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_ORIGIN?: string
  readonly VITE_DEV_CERT_HOSTS?: string
  readonly VITE_GOOGLE_OAUTH_CLIENT_ID?: string
  readonly VITE_GOOGLE_OAUTH_SCOPES?: string
  readonly VITE_WEBRTC_STUN_URLS?: string
  readonly VITE_WEBRTC_TURN_URLS?: string
  readonly VITE_WEBRTC_TURN_USERNAME?: string
  readonly VITE_WEBRTC_TURN_CREDENTIAL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
