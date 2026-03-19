import React, { useEffect, useRef, useState } from 'react'
import { PanelWrapper } from '../_base/PanelWrapper'
import { useStore } from '@/store'
import { useIPC } from '@/hooks/useIPC'
import { IPC, Transcription } from '@shared/ipc-channels'

type RecordingState = 'idle' | 'recording' | 'transcribing'

function formatDuration(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ---- API Key Modal ----

function ApiKeyModal({ onSave, onClose }: { onSave: (key: string) => void; onClose: () => void }) {
  const [key, setKey] = useState('')

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(28,28,30,0.85)', backdropFilter: 'blur(20px) saturate(180%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 12,
    }}>
      <div style={{ width: '85%', maxWidth: 320 }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: '#EBEBF5', marginBottom: 4 }}>
          OpenAI API Key
        </p>
        <p style={{ fontSize: 11, color: 'rgba(235,235,245,0.4)', marginBottom: 12 }}>
          Required for Whisper transcription. Stored securely in macOS Keychain.
        </p>
        <input
          type="password"
          placeholder="sk-..."
          value={key}
          onChange={e => setKey(e.target.value)}
          style={inputStyle}
          autoFocus
        />
        <div className="flex gap-2 mt-3">
          <button onClick={onClose} style={btnStyle('rgba(255,255,255,0.1)')}>Cancel</button>
          <button
            onClick={() => key.trim() && onSave(key.trim())}
            disabled={!key.trim()}
            style={{ ...btnStyle('#0A84FF'), opacity: key.trim() ? 1 : 0.4, flex: 1 }}
          >
            Save Key
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Transcript Card ----

function TranscriptCard({
  item, onDelete,
}: { item: Transcription; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      borderRadius: 10, padding: '10px 12px',
      border: '1px solid rgba(255,255,255,0.04)',
    }}>
      <div className="flex items-center gap-2 mb-1">
        <span style={{ fontSize: 13, fontWeight: 500, color: '#EBEBF5', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.title ?? 'Untitled'}
        </span>
        <span style={{ fontSize: 10, color: 'rgba(235,235,245,0.35)', flexShrink: 0 }}>
          {item.durationSeconds != null ? formatDuration(item.durationSeconds) : ''}
        </span>
        <button
          onClick={() => onDelete(item.id)}
          style={{ background: 'none', border: 'none', color: 'rgba(235,235,245,0.3)', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}
        >
          ×
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span style={{ fontSize: 10, color: 'rgba(235,235,245,0.3)' }}>
          {timeAgo(item.createdAt)}
        </span>
        {item.transcript && (
          <button
            onClick={() => setExpanded(e => !e)}
            style={{ ...chipStyle, fontSize: 10, padding: '1px 6px' }}
          >
            {expanded ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {expanded && item.transcript && (
        <p style={{
          fontSize: 12, color: 'rgba(235,235,245,0.7)', marginTop: 8,
          lineHeight: 1.6, whiteSpace: 'pre-wrap',
          background: 'rgba(0,0,0,0.2)', borderRadius: 6, padding: '8px 10px',
        }}>
          {item.transcript}
        </p>
      )}
    </div>
  )
}

// ---- Main Panel ----

export default function AudioTranscriptionPanel() {
  const { invoke } = useIPC()
  const transcriptions = useStore(s => s.transcriptions)
  const setTranscriptions = useStore(s => s.setTranscriptions)
  const addTranscription = useStore(s => s.addTranscription)
  const removeTranscription = useStore(s => s.removeTranscription)

  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null)
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [search, setSearch] = useState('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Load history + check API key on mount
  useEffect(() => {
    invoke<Transcription[]>(IPC.TRANSCRIPTION_LIST).then(setTranscriptions)
    invoke<string | null>(IPC.KEYCHAIN_GET, 'openai').then(k => setHasApiKey(k != null))
  }, [])

  // Elapsed timer
  useEffect(() => {
    if (recordingState === 'recording') {
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [recordingState])

  async function startRecording() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        await sendForTranscription(blob)
      }

      mediaRecorderRef.current = recorder
      recorder.start(1000)
      setRecordingState('recording')
    } catch (err) {
      setError(`Microphone access denied: ${(err as Error).message}`)
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }

  async function sendForTranscription(blob: Blob) {
    setRecordingState('transcribing')
    setError(null)
    try {
      const arrayBuffer = await blob.arrayBuffer()
      const audioData = Array.from(new Uint8Array(arrayBuffer))
      const result = await invoke<Transcription>(IPC.TRANSCRIPTION_TRANSCRIBE, {
        audioData,
        durationSeconds: elapsed,
      })
      addTranscription(result)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setRecordingState('idle')
    }
  }

  async function handleSaveApiKey(key: string) {
    await invoke(IPC.KEYCHAIN_SET, 'openai', key)
    setHasApiKey(true)
    setShowKeyModal(false)
  }

  async function handleDelete(id: string) {
    await invoke(IPC.TRANSCRIPTION_DELETE, id)
    removeTranscription(id)
  }

  const filtered = search.trim()
    ? transcriptions.filter(t =>
        (t.title ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (t.transcript ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : transcriptions

  const isRecording = recordingState === 'recording'
  const isTranscribing = recordingState === 'transcribing'
  const ringColor = isRecording ? '#FF453A' : '#0A84FF'

  return (
    <PanelWrapper panelId="audio-transcription" title="Transcription">
      <div className="flex flex-col h-full" style={{ position: 'relative' }}>
        {showKeyModal && (
          <ApiKeyModal onSave={handleSaveApiKey} onClose={() => setShowKeyModal(false)} />
        )}

        {/* Controls */}
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isTranscribing || hasApiKey === false}
            style={{
              width: 44, height: 44, borderRadius: '50%',
              border: `2px solid ${ringColor}`, background: 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: isTranscribing ? 'default' : 'pointer',
              opacity: isTranscribing ? 0.4 : 1,
              transition: 'all 0.15s ease',
            }}
          >
            {isRecording ? (
              <div style={{ width: 16, height: 16, borderRadius: 3, background: '#FF453A' }} />
            ) : (
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#FF453A' }} />
            )}
          </button>

          <div className="flex flex-col flex-1">
            {isRecording && (
              <span style={{ fontSize: 22, fontWeight: 600, color: '#FF453A', letterSpacing: '-0.02em' }}>
                {formatDuration(elapsed)}
              </span>
            )}
            {isTranscribing && (
              <span style={{ fontSize: 13, color: 'rgba(235,235,245,0.5)' }}>
                Transcribing…
              </span>
            )}
            {recordingState === 'idle' && (
              <span style={{ fontSize: 13, color: 'rgba(235,235,245,0.5)' }}>
                {hasApiKey ? 'Ready to record' : 'Set API key to start'}
              </span>
            )}
          </div>

          <button
            onClick={() => setShowKeyModal(true)}
            style={{
              ...chipStyle,
              background: hasApiKey ? 'rgba(255,255,255,0.08)' : 'rgba(10,132,255,0.2)',
            }}
          >
            {hasApiKey ? 'Key' : 'Set Key'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            fontSize: 11, color: '#FF453A', marginBottom: 8,
            background: 'rgba(255,69,58,0.1)', borderRadius: 6, padding: '6px 8px',
          }}>
            {error}
          </div>
        )}

        {/* Search */}
        {transcriptions.length > 0 && (
          <input
            placeholder="Search transcripts…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, marginBottom: 8 }}
          />
        )}

        {/* Transcript history */}
        <div className="flex flex-col gap-2 overflow-y-auto flex-1" style={{ minHeight: 0 }}>
          {filtered.length === 0 && transcriptions.length === 0 && recordingState === 'idle' && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(235,235,245,0.3)', fontSize: 13 }}>
              No transcriptions yet — press the record button to start
            </div>
          )}
          {filtered.length === 0 && transcriptions.length > 0 && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: 'rgba(235,235,245,0.3)', fontSize: 12 }}>
              No results for "{search}"
            </div>
          )}
          {filtered.map(t => (
            <TranscriptCard key={t.id} item={t} onDelete={handleDelete} />
          ))}
        </div>
      </div>
    </PanelWrapper>
  )
}

const chipStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  border: 'none', borderRadius: 6,
  color: '#fff', fontSize: 11, fontWeight: 500,
  padding: '3px 10px', cursor: 'pointer',
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 6, color: '#fff', fontSize: 12,
  padding: '6px 8px', outline: 'none', width: '100%',
}

const btnStyle = (bg: string): React.CSSProperties => ({
  background: bg, border: 'none', borderRadius: 8,
  color: '#fff', padding: '6px 14px', fontSize: 13,
  fontWeight: 500, cursor: 'pointer',
})
