import { shell } from 'electron'
import { createServer } from 'http'
import { createHash, randomBytes } from 'crypto'
import { request as httpsRequest } from 'https'
import { getDb } from '../db'
import { getToken, setToken, deleteToken } from '../keychain'
import type { OutlookMessage, OutlookMessages } from '../../../src/shared/ipc-channels'

// ---- PKCE helpers ----

function generatePKCE() {
  const verifier = randomBytes(64).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

// ---- Config (Client ID only — no secret for public PKCE clients) ----

export function getMicrosoftConfig(): { clientId: string } | null {
  const db = getDb()
  const row = db
    .prepare('SELECT client_id FROM integration_config WHERE provider = ?')
    .get('microsoft') as { client_id: string } | undefined
  if (!row?.client_id) return null
  return { clientId: row.client_id }
}

export function saveMicrosoftConfig(clientId: string): void {
  const db = getDb()
  db.prepare(`
    INSERT OR REPLACE INTO integration_config (provider, client_id)
    VALUES ('microsoft', ?)
  `).run(clientId)
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
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
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

const TOKEN_ENDPOINT = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'

async function refreshMicrosoftToken(): Promise<string> {
  const config = getMicrosoftConfig()
  if (!config) throw new Error('Microsoft not configured')
  const refreshToken = await getToken('microsoft-refresh-token')
  if (!refreshToken) throw new Error('Microsoft not connected — please reconnect')

  const tokens = await httpsPost(TOKEN_ENDPOINT, {
    refresh_token: refreshToken,
    client_id: config.clientId,
    grant_type: 'refresh_token',
    scope: 'openid email profile Mail.Read offline_access',
  })

  if (tokens.error) throw new Error(`Microsoft token refresh failed: ${tokens.error}`)

  const expiry = Date.now() + (tokens.expires_in as number) * 1000
  await setToken('microsoft-access-token', tokens.access_token as string)
  await setToken('microsoft-token-expiry', String(expiry))
  if (tokens.refresh_token) {
    await setToken('microsoft-refresh-token', tokens.refresh_token as string)
  }
  return tokens.access_token as string
}

async function getValidToken(): Promise<string> {
  const expiryStr = await getToken('microsoft-token-expiry')
  const expiry = expiryStr ? parseInt(expiryStr, 10) : 0

  if (expiry - Date.now() > 5 * 60 * 1000) {
    const token = await getToken('microsoft-access-token')
    if (token) return token
  }

  return refreshMicrosoftToken()
}

// ---- Public API ----

export async function isMicrosoftConnected(): Promise<boolean> {
  const token = await getToken('microsoft-refresh-token')
  return token != null
}

export async function connectMicrosoft(): Promise<void> {
  const config = getMicrosoftConfig()
  if (!config) throw new Error('Save your Microsoft Client ID before connecting')

  const { verifier, challenge } = generatePKCE()

  const port = await new Promise<number>((resolve, reject) => {
    const srv = createServer()
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address() as { port: number }
      srv.close(() => resolve(addr.port))
    })
    srv.on('error', reject)
  })

  const redirectUri = `http://localhost:${port}`

  const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize')
  authUrl.searchParams.set('client_id', config.clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', 'openid email profile Mail.Read offline_access')
  authUrl.searchParams.set('code_challenge', challenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  authUrl.searchParams.set('response_mode', 'query')

  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost:${port}`)
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')
      const errorDesc = url.searchParams.get('error_description')
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<html><body style="font-family:sans-serif;padding:40px"><h2>✓ Connected!</h2><p>You can close this tab.</p></body></html>')
      server.close()
      if (code) resolve(code)
      else reject(new Error(errorDesc ?? error ?? 'No authorization code received'))
    })
    server.listen(port, '127.0.0.1')
    server.on('error', reject)
    shell.openExternal(authUrl.toString())
  })

  const tokens = await httpsPost(TOKEN_ENDPOINT, {
    code,
    client_id: config.clientId,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: verifier,
    scope: 'openid email profile Mail.Read offline_access',
  })

  if (tokens.error) throw new Error(`Microsoft auth failed: ${tokens.error} — ${tokens.error_description ?? ''}`)

  const expiry = Date.now() + (tokens.expires_in as number) * 1000
  await setToken('microsoft-access-token', tokens.access_token as string)
  await setToken('microsoft-refresh-token', tokens.refresh_token as string)
  await setToken('microsoft-token-expiry', String(expiry))
}

export async function disconnectMicrosoft(): Promise<void> {
  await deleteToken('microsoft-access-token')
  await deleteToken('microsoft-refresh-token')
  await deleteToken('microsoft-token-expiry')
}

// ---- Microsoft Graph (Outlook) ----

type RawMessage = {
  id: string
  subject?: string
  from?: { emailAddress?: { name?: string; address?: string } }
  bodyPreview?: string
  receivedDateTime?: string
  isRead?: boolean
  flag?: { flagStatus?: string }
  webLink?: string
}

function mapMessage(raw: RawMessage, flagged = false): OutlookMessage {
  return {
    id: raw.id,
    subject: raw.subject ?? '(no subject)',
    fromName: raw.from?.emailAddress?.name ?? '',
    fromEmail: raw.from?.emailAddress?.address ?? '',
    preview: raw.bodyPreview ?? '',
    receivedAt: raw.receivedDateTime ?? '',
    isRead: raw.isRead ?? false,
    isFlagged: flagged || raw.flag?.flagStatus === 'flagged',
    webLink: raw.webLink ?? '',
  }
}

const MSG_SELECT = '$select=id,subject,from,bodyPreview,receivedDateTime,isRead,flag,webLink'

export async function listOutlookMessages(): Promise<OutlookMessages> {
  const token = await getValidToken()

  const [inboxData, flaggedData] = await Promise.all([
    httpsGet(
      `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?${MSG_SELECT}&$top=20&$orderby=receivedDateTime+desc`,
      token
    ),
    httpsGet(
      `https://graph.microsoft.com/v1.0/me/messages?${MSG_SELECT}&$filter=flag/flagStatus eq 'flagged'&$top=10&$orderby=receivedDateTime+desc`,
      token
    ),
  ])

  if (inboxData.error) throw new Error((inboxData.error as Record<string, unknown>).message as string)
  if (flaggedData.error) throw new Error((flaggedData.error as Record<string, unknown>).message as string)

  return {
    inbox: ((inboxData.value as RawMessage[]) ?? []).map(m => mapMessage(m)),
    flagged: ((flaggedData.value as RawMessage[]) ?? []).map(m => mapMessage(m, true)),
  }
}
