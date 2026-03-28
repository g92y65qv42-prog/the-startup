import { StateCreator } from 'zustand'
import { Transcription } from '@shared/ipc-channels'

export interface TranscriptionSlice {
  transcriptions: Transcription[]
  setTranscriptions: (items: Transcription[]) => void
  addTranscription: (t: Transcription) => void
  removeTranscription: (id: string) => void
}

export const createTranscriptionSlice: StateCreator<TranscriptionSlice> = (set) => ({
  transcriptions: [],
  setTranscriptions: (transcriptions) => set({ transcriptions }),
  addTranscription: (t) => set(s => ({ transcriptions: [t, ...s.transcriptions] })),
  removeTranscription: (id) => set(s => ({ transcriptions: s.transcriptions.filter(t => t.id !== id) })),
})
