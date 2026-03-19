import { shell } from 'electron'
import { createServer } from 'http'
import { createHash, randomBytes } from 'crypto'
import { request as httpsRequest } from 'https'
import { getDb } from '../db'
import { getToken, setToken, deleteToken } from '../keychain'
import type { GoogleCalendarEvent, GoogleDoc } from '../../../src/shared/ipc-channels'

// ---- PKCE helpers ----

function generatePKCE() {
  const verifier = randomBytes(64).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

// ---- Config (stored in SQLite, not secret) ----

export function getGoogleConfig(): { clientId: string; clientSecret: string } | null {
  const db = getDb()
  const row = db
    .prepare('SELECT client_id, client_secret FROM integration_config WHERE provider = ?')
    .get('google') as { client_id: string; client_secret: string } | undefined
  if (!row?.client_id) return null
  return { clientId: row.client_id, clientSecret: row.client_secret ?? '' }
}

export function saveGoogleConfig(clientId: string, clientSecret: string): void {
  const db = getDb()
  db.prepare(`
    INSERT OR REPLACE INTO integration_config (provider, client_id, client_secret)
    VALUES ('google', ?, ?)
  `).run(clientId, clientSecret)
}

// ---- HTTP helpers ----

function httpsPost(url: string, body: Record<string, string>): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const bodyStr = new URLSearchParams(body).toString()
    const u = new URL(url)
    const req = httpsRequest({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) }
        catch { reject(new Error('Invalid JSON from token endpoint')) }
      })
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')) })
    req.write(bodyStr)
    req.end()
  })
}

function httpsGet(url: string, accessToken: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const req = httpsRequest({
      hostname: u.hostname, path: u.pathname + u.search, method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) }
        catch { reject(new Error('Invalid JSON from API')) }
      })
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')) })
    req.end()
  })
}

// ---- Token management ----

async function refreshGoogleToken(): Promise<string> {
  const config = getGoogleConfig()
  if (!config) throw new Error('Google not configured')
  const refreshToken = await getToken('google-refresh-token')
  if (!refreshToken) throw new Error('Google not connected — please reconnect')

  const tokens = await httpsPost('https://oauth2.googleapis.com/token', {
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'refresh_token',
  })

  if (tokens.error) throw new Error(`Google token refresh failed: ${tokens.error}`)

  const expiry = Date.now() + (tokens.expires_in as number) * 1000
  await setToken('google-access-token', tokens.access_token as string)
  await setToken('google-token-expiry', String(expiry))
  return tokens.access_token as string
}

async function getValidToken(): Promise<string> {
  const expiryStr = await getToken('google-token-expiry')
  const expiry = expiryStr ? parseInt(expiryStr, 10) : 0

  // Use cached token if it won't expire in the next 5 minutes
  if (expiry - Date.now() > 5 * 60 * 1000) {
    const token = await getToken('google-access-token')
    if (token) return token
  }

  return refreshGoogleToken()
}

// ---- Public API ----

export async function isGoogleConnected(): Promise<boolean> {
  const token = await getToken('google-refresh-token')
  return token != null
}

export async function connectGoogle(): Promise<void> {
  const config = getGoogleConfig()
  if (!config) throw new Error('Save your Google Client ID and Secret before connecting')

  const { verifier, challenge } = generatePKCE()

  // Find a free ephemeral port
  const port = await new Promise<number>((resolve, reject) => {
    const srv = createServer()
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address() as { port: number }
      srv.close(() => resolve(addr.port))
    })
    srv.on('error', reject)
  })

  const redirectUri = `http://127.0.0.1:${port}`
  const scopes = [
    'openid', 'email', 'profile',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
  ].join(' ')

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', config.clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', scopes)
  authUrl.searchParams.set('code_challenge', challenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')

  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<html><body style="font-family:sans-serif;padding:40px"><h2>✓ Connected!</h2><p>You can close this tab.</p></body></html>')
      server.close()
      if (code) resolve(code)
      else reject(new Error(error ?? 'No authorization code received'))
    })
    server.listen(port, '127.0.0.1')
    server.on('error', reject)
    shell.openExternal(authUrl.toString())
  })

  const tokens = await httpsPost('https://oauth2.googleapis.com/token', {
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: verifier,
  })

  if (tokens.error) throw new Error(`Google auth failed: ${tokens.error} — ${tokens.error_description ?? ''}`)

  const expiry = Date.now() + (tokens.expires_in as number) * 1000
  await setToken('google-access-token', tokens.access_token as string)
  await setToken('google-refresh-token', tokens.refresh_token as string)
  await setToken('google-token-expiry', String(expiry))
}

export async function disconnectGoogle(): Promise<void> {
  await deleteToken('google-access-token')
  await deleteToken('google-refresh-token')
  await deleteToken('google-token-expiry')
}

// ---- Google Calendar ----

const GOOGLE_EVENT_COLORS: Record<string, string> = {
  '1': '#7986cb', '2': '#33b679', '3': '#8e24aa', '4': '#e67c73',
  '5': '#f6c026', '6': '#f5511d', '7': '#039be5', '8': '#616161',
  '9': '#3f51b5', '10': '#0b8043', '11': '#d50000',
}

export async function listCalendarEvents(): Promise<GoogleCalendarEvent[]> {
  const token = await getValidToken()
  const timeMin = encodeURIComponent(new Date().toISOString())
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&timeMin=${timeMin}&maxResults=20`

  const data = await httpsGet(url, token)
  if (data.error) throw new Error((data.error as Record<string, unknown>).message as string)

  type RawEvent = {
    id: string; summary?: string
    start: { dateTime?: string; date?: string }
    end: { dateTime?: string; date?: string }
    colorId?: string; htmlLink?: string
  }

  return ((data.items as RawEvent[]) ?? []).map(item => ({
    id: item.id,
    title: item.summary ?? '(no title)',
    start: item.start.dateTime ?? item.start.date ?? '',
    end: item.end.dateTime ?? item.end.date ?? '',
    allDay: !item.start.dateTime,
    color: item.colorId ? (GOOGLE_EVENT_COLORS[item.colorId] ?? null) : null,
    htmlLink: item.htmlLink ?? null,
  }))
}

// ---- Google Drive (Docs only) ----

export async function listDocs(): Promise<GoogleDoc[]> {
  const token = await getValidToken()
  const q = encodeURIComponent("mimeType='application/vnd.google-apps.document' and trashed=false")
  const fields = encodeURIComponent('files(id,name,modifiedTime,webViewLink)')
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=viewedByMeTime+desc&pageSize=20&fields=${fields}`

  const data = await httpsGet(url, token)
  if (data.error) throw new Error((data.error as Record<string, unknown>).message as string)

  return (data.files as GoogleDoc[]) ?? []
}
