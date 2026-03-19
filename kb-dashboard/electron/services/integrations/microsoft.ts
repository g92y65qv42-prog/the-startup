import { ImapFlow } from 'imapflow'
import { getToken, setToken, deleteToken } from '../keychain'
import type { OutlookMessage, OutlookMessages } from '../../../src/shared/ipc-channels'

// ---- IMAP config ----

const IMAP_HOST = 'outlook.office365.com'
const IMAP_PORT = 993

function makeClient(email: string, appPassword: string): ImapFlow {
  return new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: { user: email, pass: appPassword },
    logger: false,
    tls: { servername: IMAP_HOST },
  })
}

// Connect and propagate network errors through the promise (not as uncaught events).
async function connectClient(client: ImapFlow): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onError = (err: Error) => reject(err)
    client.once('error', onError)
    client.connect().then(
      () => { client.off('error', onError); resolve() },
      (err: Error) => { client.off('error', onError); reject(err) }
    )
  })
}

async function safeLogout(client: ImapFlow): Promise<void> {
  try { await client.logout() } catch { /* ignore — connection may already be closed */ }
}

// ---- Credential storage (keychain only — no Azure/DB needed) ----

export async function getMicrosoftConfig(): Promise<{ clientId: string } | null> {
  const email = await getToken('microsoft-email')
  if (!email) return null
  return { clientId: email }
}

export async function saveMicrosoftConfig(email: string, appPassword: string): Promise<void> {
  await setToken('microsoft-email', email.trim())
  await setToken('microsoft-app-password', appPassword.trim().replace(/\s+/g, ''))
}

// ---- Public API ----

export async function isMicrosoftConnected(): Promise<boolean> {
  const email = await getToken('microsoft-email')
  const pw = await getToken('microsoft-app-password')
  return !!(email && pw)
}

export async function connectMicrosoft(): Promise<void> {
  const email = await getToken('microsoft-email')
  const appPassword = await getToken('microsoft-app-password')
  if (!email || !appPassword) throw new Error('Save your Outlook email and app password before connecting')

  const client = makeClient(email, appPassword)
  try {
    await connectClient(client)
  } catch (err) {
    if ((err as { authenticationFailed?: boolean }).authenticationFailed) {
      await disconnectMicrosoft()
      throw new Error('Authentication failed — check your email and app password, then reconnect')
    }
    throw err
  } finally {
    await safeLogout(client)
  }
}

export async function disconnectMicrosoft(): Promise<void> {
  await deleteToken('microsoft-email')
  await deleteToken('microsoft-app-password')
}

// ---- IMAP message fetch ----

type ImapMsg = {
  uid: number
  seq: number
  envelope: {
    subject?: string
    date?: Date
    from?: Array<{ name?: string; mailbox?: string; host?: string }>
  }
  flags: Set<string>
}

function mapMsg(msg: ImapMsg, forceFlagged = false): OutlookMessage {
  const from = msg.envelope?.from?.[0]
  return {
    id: String(msg.uid || msg.seq),
    subject: msg.envelope?.subject ?? '(no subject)',
    fromName: from?.name ?? '',
    fromEmail: from ? `${from.mailbox ?? ''}@${from.host ?? ''}` : '',
    preview: '',
    receivedAt: msg.envelope?.date?.toISOString() ?? '',
    isRead: msg.flags.has('\\Seen'),
    isFlagged: forceFlagged || msg.flags.has('\\Flagged'),
    webLink: '',
  }
}

export async function listOutlookMessages(): Promise<OutlookMessages> {
  const email = await getToken('microsoft-email')
  const appPassword = await getToken('microsoft-app-password')
  if (!email || !appPassword) throw new Error('Microsoft not connected')

  const client = makeClient(email, appPassword)
  try {
    await connectClient(client)
  } catch (err) {
    if ((err as { authenticationFailed?: boolean }).authenticationFailed) {
      await disconnectMicrosoft()
      throw new Error('Authentication failed — check your email and app password, then reconnect')
    }
    throw err
  }

  try {
    const inbox: OutlookMessage[] = []
    const flagged: OutlookMessage[] = []

    const lock = await client.getMailboxLock('INBOX')
    try {
      const total = (client.mailbox as { exists: number }).exists

      if (total > 0) {
        // Fetch last 20 by sequence number — consistent: no uid option anywhere here
        const start = Math.max(1, total - 19)
        for await (const msg of client.fetch(`${start}:${total}`, { envelope: true, flags: true, uid: true })) {
          inbox.push(mapMsg(msg as unknown as ImapMsg))
        }
        inbox.reverse()

        // Search returns sequence numbers by default; fetch with same mode (no uid option)
        const flaggedSeqs = await client.search({ flagged: true })
        if (flaggedSeqs.length > 0) {
          const seqs = flaggedSeqs.slice(-10).join(',')
          for await (const msg of client.fetch(seqs, { envelope: true, flags: true, uid: true })) {
            flagged.push(mapMsg(msg as unknown as ImapMsg, true))
          }
          flagged.reverse()
        }
      }
    } finally {
      lock.release()
    }

    return { inbox, flagged }
  } finally {
    await safeLogout(client)
  }
}
