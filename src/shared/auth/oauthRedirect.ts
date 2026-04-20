function encodeBase64Url(bytes: Uint8Array) {
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/u, '')
}

function createRandomString(byteLength: number) {
  const bytes = new Uint8Array(byteLength)
  window.crypto.getRandomValues(bytes)
  return encodeBase64Url(bytes)
}

export async function createPkcePair() {
  const codeVerifier = createRandomString(32)
  const verifierBytes = new TextEncoder().encode(codeVerifier)
  const digest = await window.crypto.subtle.digest('SHA-256', verifierBytes)

  return {
    codeVerifier,
    codeChallenge: encodeBase64Url(new Uint8Array(digest)),
  }
}

export function createOAuthState() {
  return createRandomString(24)
}

export function createOidcNonce() {
  return createRandomString(24)
}
