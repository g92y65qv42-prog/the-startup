import React, { useEffect, useRef, useState } from 'react'
import { PanelWrapper } from '../_base/PanelWrapper'
import { useStore } from '@/store'
import { useIPC } from '@/hooks/useIPC'
import { IPC, Transcription } from '@shared/ipc-channels'

type RecordingState = 'idle' | 'recording' | 'saving'

// Web Speech API types (available in Chromium/Electron)
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}

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
  const [search, setSearch] = useState('')
  const [interimText, setInterimText] = useState('')

  // Refs to avoid stale closures in recognition callbacks
  const isRecordingRef = useRef(false)
  const finalTranscriptRef = useRef('')
  const elapsedRef = useRef(0)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const speechSupported = typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  useEffect(() => {
    invoke<Transcription[]>(IPC.TRANSCRIPTION_LIST).then(setTranscriptions)
  }, [])

  useEffect(() => {
    elapsedRef.current = elapsed
  }, [elapsed])

  function startTimer() {
    setElapsed(0)
    elapsedRef.current = 0
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  async function saveTranscript(text: string, durationSeconds: number) {
    setRecordingState('saving')
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const title = text.trim().slice(0, 60).replace(/\n/g, ' ') || `Recording ${now.slice(0, 10)}`
    const record: Transcription = {
      id, title, audioPath: null,
      transcript: text.trim() || null,
      durationSeconds, createdAt: now,
    }
    await invoke(IPC.TRANSCRIPTION_SAVE, record)
    addTranscription(record)
    setRecordingState('idle')
    setInterimText('')
    finalTranscriptRef.current = ''
  }

  function startRecording() {
    setError(null)
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRec()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    isRecordingRef.current = true
    finalTranscriptRef.current = ''

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalTranscriptRef.current += e.results[i][0].transcript + ' '
        } else {
          interim += e.results[i][0].transcript
        }
      }
      setInterimText(interim)
    }

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'no-speech') return // ignore silence gaps
      setError(`Speech recognition error: ${e.error}`)
      isRecordingRef.current = false
      stopTimer()
      setRecordingState('idle')
      setInterimText('')
    }

    // Auto-restarts when it stops due to silence (continuous mode quirk)
    recognition.onend = () => {
      if (isRecordingRef.current) {
        try { recognition.start() } catch { /* already stopped */ }
      } else {
        stopTimer()
        saveTranscript(finalTranscriptRef.current.trim(), elapsedRef.current)
      }
    }

    recognitionRef.current = recognition
    recognition.start()
    startTimer()
    setRecordingState('recording')
  }

  function stopRecording() {
    isRecordingRef.current = false
    recognitionRef.current?.stop()
    // saveTranscript is called in onend once isRecordingRef is false
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
  const isSaving = recordingState === 'saving'
  const ringColor = isRecording ? '#FF453A' : '#0A84FF'

  return (
    <PanelWrapper panelId="audio-transcription" title="Transcription">
      <div className="flex flex-col h-full">

        {/* Controls */}
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isSaving || !speechSupported}
            style={{
              width: 44, height: 44, borderRadius: '50%',
              border: `2px solid ${ringColor}`, background: 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: (isSaving || !speechSupported) ? 'default' : 'pointer',
              opacity: (isSaving || !speechSupported) ? 0.4 : 1,
              transition: 'all 0.15s ease',
            }}
          >
            {isRecording ? (
              <div style={{ width: 16, height: 16, borderRadius: 3, background: '#FF453A' }} />
            ) : (
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#FF453A' }} />
            )}
          </button>

          <div className="flex flex-col flex-1" style={{ minWidth: 0 }}>
            {isRecording && (
              <span style={{ fontSize: 22, fontWeight: 600, color: '#FF453A', letterSpacing: '-0.02em' }}>
                {formatDuration(elapsed)}
              </span>
            )}
            {isSaving && (
              <span style={{ fontSize: 13, color: 'rgba(235,235,245,0.5)' }}>Saving…</span>
            )}
            {recordingState === 'idle' && (
              <span style={{ fontSize: 13, color: 'rgba(235,235,245,0.5)' }}>
                {speechSupported ? 'Ready to record' : 'Speech API not available'}
              </span>
            )}
            {isRecording && interimText && (
              <span style={{
                fontSize: 11, color: 'rgba(235,235,245,0.4)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {interimText}
              </span>
            )}
          </div>
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
