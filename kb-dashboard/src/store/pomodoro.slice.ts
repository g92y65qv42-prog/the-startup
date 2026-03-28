import { StateCreator } from 'zustand'
import { PomodoroConfig, PomodoroSession } from '@shared/ipc-channels'

export type PomodoroState = 'idle' | 'work' | 'short_break' | 'long_break'

export interface PomodoroSlice {
  pomodoroConfig: PomodoroConfig
  pomodoroState: PomodoroState
  pomodoroSecondsLeft: number
  pomodoroSessionCount: number
  pomodoroActiveTaskId: string | null
  pomodoroSessionId: string | null
  setPomodoroConfig: (config: PomodoroConfig) => void
  setPomodoroState: (state: PomodoroState) => void
  setPomodoroSecondsLeft: (s: number) => void
  tickPomodoro: () => void
  setPomodoroSessionCount: (n: number) => void
  setPomodoroActiveTask: (taskId: string | null) => void
  setPomodoroSessionId: (id: string | null) => void
}

const DEFAULT_CONFIG: PomodoroConfig = {
  workDuration: 1500,
  shortBreak: 300,
  longBreak: 1200,
  sessionsBeforeLongBreak: 4
}

export const createPomodoroSlice: StateCreator<PomodoroSlice> = (set) => ({
  pomodoroConfig: DEFAULT_CONFIG,
  pomodoroState: 'idle',
  pomodoroSecondsLeft: DEFAULT_CONFIG.workDuration,
  pomodoroSessionCount: 0,
  pomodoroActiveTaskId: null,
  pomodoroSessionId: null,

  setPomodoroConfig: (config) => set({ pomodoroConfig: config }),
  setPomodoroState: (state) => set({ pomodoroState: state }),
  setPomodoroSecondsLeft: (s) => set({ pomodoroSecondsLeft: s }),
  tickPomodoro: () => set((s) => ({ pomodoroSecondsLeft: Math.max(0, s.pomodoroSecondsLeft - 1) })),
  setPomodoroSessionCount: (n) => set({ pomodoroSessionCount: n }),
  setPomodoroActiveTask: (taskId) => set({ pomodoroActiveTaskId: taskId }),
  setPomodoroSessionId: (id) => set({ pomodoroSessionId: id })
})
