import React, { useEffect, useRef } from 'react'
import { PanelWrapper } from '../_base/PanelWrapper'
import { useStore, AppStore } from '@/store'
import { useIPC } from '@/hooks/useIPC'
import { IPC, PomodoroConfig } from '@shared/ipc-channels'

function pad(n: number) { return String(n).padStart(2, '0') }

function formatTime(seconds: number) {
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`
}

const STATE_LABELS = {
  idle: 'Ready',
  work: 'Focus',
  short_break: 'Short Break',
  long_break: 'Long Break'
}

const STATE_COLORS = {
  idle: '#0A84FF',
  work: '#0A84FF',
  short_break: '#32D74B',
  long_break: '#32D74B'
}

export default function PomodoroPanel() {
  const { invoke } = useIPC()
  const state = useStore(s => s.pomodoroState)
  const secondsLeft = useStore(s => s.pomodoroSecondsLeft)
  const config = useStore(s => s.pomodoroConfig)
  const sessionCount = useStore(s => s.pomodoroSessionCount)
  const setPomodoroConfig = useStore(s => s.setPomodoroConfig)
  const setPomodoroState = useStore(s => s.setPomodoroState)
  const setPomodoroSecondsLeft = useStore(s => s.setPomodoroSecondsLeft)
  const tickPomodoro = useStore(s => s.tickPomodoro)
  const setPomodoroSessionCount = useStore(s => s.setPomodoroSessionCount)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load config on mount
  useEffect(() => {
    invoke<PomodoroConfig>(IPC.POMODORO_GET_CONFIG).then(setPomodoroConfig)
  }, [])

  // Tick
  useEffect(() => {
    if (state === 'work' || state === 'short_break' || state === 'long_break') {
      intervalRef.current = setInterval(() => {
        tickPomodoro()
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [state])

  // Timer complete
  useEffect(() => {
    if (secondsLeft === 0 && state !== 'idle') {
      handleTimerComplete()
    }
  }, [secondsLeft])

  function handleTimerComplete() {
    if (state === 'work') {
      const newCount = sessionCount + 1
      setPomodoroSessionCount(newCount)
      const isLongBreak = newCount % config.sessionsBeforeLongBreak === 0
      if (isLongBreak) {
        setPomodoroState('long_break')
        setPomodoroSecondsLeft(config.longBreak)
      } else {
        setPomodoroState('short_break')
        setPomodoroSecondsLeft(config.shortBreak)
      }
      new Notification('Time for a break!', { body: 'Great work. Take a rest.' })
    } else {
      setPomodoroState('idle')
      setPomodoroSecondsLeft(config.workDuration)
      new Notification('Break over!', { body: "Let's focus." })
    }
  }

  function handleStart() {
    setPomodoroState('work')
    setPomodoroSecondsLeft(config.workDuration)
  }

  function handleStop() {
    setPomodoroState('idle')
    setPomodoroSecondsLeft(config.workDuration)
    if (intervalRef.current) clearInterval(intervalRef.current)
  }

  const total = state === 'work' ? config.workDuration
    : state === 'short_break' ? config.shortBreak
    : state === 'long_break' ? config.longBreak
    : config.workDuration

  const progress = total > 0 ? (total - secondsLeft) / total : 0
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - progress)
  const color = STATE_COLORS[state]

  return (
    <PanelWrapper panelId="pomodoro" title="Pomodoro">
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div style={{ position: 'relative', width: 128, height: 128 }}>
          <svg width={128} height={128} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={64} cy={64} r={radius} fill="none"
              stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
            <circle cx={64} cy={64} r={radius} fill="none"
              stroke={color} strokeWidth={6}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center'
          }}>
            <span style={{ fontSize: 26, fontWeight: 600, color: '#fff', letterSpacing: '-0.02em' }}>
              {formatTime(secondsLeft)}
            </span>
            <span style={{ fontSize: 11, color: 'rgba(235,235,245,0.4)', marginTop: 2 }}>
              {STATE_LABELS[state]}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          {state === 'idle' ? (
            <button onClick={handleStart} style={btnStyle('#0A84FF')}>Start</button>
          ) : (
            <button onClick={handleStop} style={btnStyle('rgba(255,255,255,0.1)')}>Stop</button>
          )}
        </div>

        <div style={{ fontSize: 12, color: 'rgba(235,235,245,0.4)' }}>
          {sessionCount} session{sessionCount !== 1 ? 's' : ''} today
        </div>
      </div>
    </PanelWrapper>
  )
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    background: bg,
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    padding: '6px 20px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer'
  }
}
