import React from 'react'
import { PanelWrapper } from '../_base/PanelWrapper'

export default function AudioTranscriptionPanel() {
  return (
    <PanelWrapper panelId="audio-transcription" title="Transcription">
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <div style={{ fontSize: 32 }}>🎙️</div>
        <p style={{ fontSize: 13, color: 'rgba(235,235,245,0.5)', textAlign: 'center' }}>
          Audio transcription
        </p>
        <p style={{ fontSize: 12, color: 'rgba(235,235,245,0.3)', textAlign: 'center' }}>
          OpenAI Whisper integration coming in Phase 3
        </p>
      </div>
    </PanelWrapper>
  )
}
