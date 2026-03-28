import { ipcMain, app } from 'electron'
import { randomUUID } from 'crypto'
import { request as httpsRequest } from 'https'
import { join } from 'path'
import { mkdirSync, writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs'
import { getDb } from '../db'
import { getToken, setToken, deleteToken } from '../keychain'
import { IPC, Transcription } from '../../../src/shared/ipc-channels'

function getAudioDir(): string {
  const dir = join(app.getPath('userData'), 'recordings')
  mkdirSync(dir, { recursive: true })
  return dir
}

// ---- OpenAI Whisper multipart upload ----

function whisperTranscribe(audioPath: string, apiKey: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const fileBuffer = readFileSync(audioPath)
    const fileName = audioPath.split('/').pop() ?? 'audio.webm'
    const boundary = `----KBDash${Date.now()}`

    const parts: Buffer[] = []

    // file field
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: audio/webm\r\n\r\n`
    ))
    parts.push(fileBuffer)
    parts.push(Buffer.from('\r\n'))

    // model field
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`
    ))

    // closing boundary
    parts.push(Buffer.from(`--${boundary}--\r\n`))

    const body = Buffer.concat(parts)

    const req = httpsRequest({
      hostname: 'api.openai.com',
      path: '/v1/audio/transcriptions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8')
        try {
          const json = JSON.parse(raw)
          if (json.error) {
            reject(new Error(json.error.message ?? JSON.stringify(json.error)))
          } else {
            resolve(json.text ?? '')
          }
        } catch {
          reject(new Error(`Invalid API response: ${raw.slice(0, 200)}`))
        }
      })
      res.on('error', reject)
    })

    req.on('error', reject)
    req.setTimeout(120000, () => { req.destroy(); reject(new Error('Whisper API timeout')) })
    req.write(body)
    req.end()
  })
}

// ---- IPC registration ----

export function registerTranscriptionIpc(): void {
  const db = getDb()

  // List all transcriptions
  ipcMain.handle(IPC.TRANSCRIPTION_LIST, (): Transcription[] => {
    const rows = db
      .prepare('SELECT * FROM transcriptions ORDER BY created_at DESC')
      .all() as Record<string, unknown>[]
    return rows.map(r => ({
      id: r.id as string,
      title: r.title as string | null,
      audioPath: r.audio_path as string | null,
      transcript: r.transcript as string | null,
      durationSeconds: r.duration_seconds as number | null,
      createdAt: r.created_at as string,
    }))
  })

  // Save/update a transcription record
  ipcMain.handle(IPC.TRANSCRIPTION_SAVE, (_e, t: Transcription) => {
    db.prepare(`
      INSERT OR REPLACE INTO transcriptions (id, title, audio_path, transcript, duration_seconds, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(t.id, t.title, t.audioPath, t.transcript, t.durationSeconds, t.createdAt)
    return { ok: true }
  })

  // Receive audio data, save to disk, send to Whisper, return transcript
  ipcMain.handle(
    IPC.TRANSCRIPTION_TRANSCRIBE,
    async (_e, data: { audioData: number[]; durationSeconds: number }): Promise<Transcription> => {
      const apiKey = await getToken('openai')
      if (!apiKey) throw new Error('OpenAI API key not configured')

      const id = randomUUID()
      const now = new Date().toISOString()
      const audioDir = getAudioDir()
      const audioPath = join(audioDir, `${id}.webm`)

      // Save audio file
      writeFileSync(audioPath, Buffer.from(data.audioData))

      // Transcribe via Whisper
      let transcript: string
      try {
        transcript = await whisperTranscribe(audioPath, apiKey)
      } catch (err) {
        // Still save the recording even if transcription fails
        const record: Transcription = {
          id, title: `Recording ${now.slice(0, 10)}`, audioPath,
          transcript: null, durationSeconds: data.durationSeconds, createdAt: now,
        }
        db.prepare(`
          INSERT INTO transcriptions (id, title, audio_path, transcript, duration_seconds, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, record.title, audioPath, null, data.durationSeconds, now)
        throw new Error(`Transcription failed: ${(err as Error).message}. Recording saved.`)
      }

      const title = transcript.slice(0, 60).replace(/\n/g, ' ') || `Recording ${now.slice(0, 10)}`
      const record: Transcription = {
        id, title, audioPath, transcript,
        durationSeconds: data.durationSeconds, createdAt: now,
      }
      db.prepare(`
        INSERT INTO transcriptions (id, title, audio_path, transcript, duration_seconds, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, title, audioPath, transcript, data.durationSeconds, now)

      return record
    }
  )

  // Delete a transcription and its audio file
  ipcMain.handle(IPC.TRANSCRIPTION_DELETE, (_e, id: string) => {
    const row = db.prepare('SELECT audio_path FROM transcriptions WHERE id = ?').get(id) as
      | { audio_path: string | null }
      | undefined
    if (row?.audio_path && existsSync(row.audio_path)) {
      try { unlinkSync(row.audio_path) } catch { /* ignore */ }
    }
    db.prepare('DELETE FROM transcriptions WHERE id = ?').run(id)
    return { ok: true }
  })

  // Keychain operations for API keys
  ipcMain.handle(IPC.KEYCHAIN_GET, async (_e, account: string): Promise<string | null> => {
    return getToken(account)
  })

  ipcMain.handle(IPC.KEYCHAIN_SET, async (_e, account: string, value: string) => {
    await setToken(account, value)
    return { ok: true }
  })

  ipcMain.handle(IPC.KEYCHAIN_DELETE, async (_e, account: string) => {
    await deleteToken(account)
    return { ok: true }
  })
}
