// Shared IPC channel names + payload types consumed by both main and renderer.
// Never import Node.js modules here — this file is loaded in both processes.

export const IPC = {
  // Panel layout
  LAYOUT_GET: 'layout:get',
  LAYOUT_SAVE: 'layout:save',
  WORKSPACE_LIST: 'workspace:list',
  WORKSPACE_SAVE: 'workspace:save',

  // Tasks
  TASKS_LIST: 'tasks:list',
  TASKS_CREATE: 'tasks:create',
  TASKS_UPDATE: 'tasks:update',
  TASKS_DELETE: 'tasks:delete',

  // Events (calendar)
  EVENTS_LIST: 'events:list',
  EVENTS_CREATE: 'events:create',
  EVENTS_UPDATE: 'events:update',
  EVENTS_DELETE: 'events:delete',

  // Grades
  GRADES_LIST: 'grades:list',
  GRADES_CREATE: 'grades:create',
  GRADES_UPDATE: 'grades:update',
  GRADES_DELETE: 'grades:delete',

  // Pomodoro
  POMODORO_GET_CONFIG: 'pomodoro:get-config',
  POMODORO_SAVE_CONFIG: 'pomodoro:save-config',
  POMODORO_GET_SESSION: 'pomodoro:get-session',
  POMODORO_SAVE_SESSION: 'pomodoro:save-session',

  // News
  NEWS_LIST: 'news:list',
  NEWS_REFRESH: 'news:refresh',
  NEWS_FEEDS_LIST: 'news:feeds-list',
  NEWS_FEED_ADD: 'news:feed-add',
  NEWS_FEED_REMOVE: 'news:feed-remove',

  // Transcription
  TRANSCRIPTION_LIST: 'transcription:list',
  TRANSCRIPTION_SAVE: 'transcription:save',

  // Integrations
  INTEGRATION_STATUS: 'integration:status',
  INTEGRATION_CONNECT_GOOGLE: 'integration:connect-google',
  INTEGRATION_CONNECT_MOODLE: 'integration:connect-moodle',
  INTEGRATION_DISCONNECT: 'integration:disconnect',

  // Shell
  OPEN_EXTERNAL: 'shell:open-external',
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]

// ---- Payload types ----

export interface Task {
  id: string
  title: string
  done: boolean
  dueDate: string | null
  pomodoroId: string | null
  source: 'local' | 'moodle' | 'google'
  sourceId: string | null
  createdAt: string
  updatedAt: string
}

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  source: 'local' | 'google' | 'moodle'
  sourceId: string | null
  color: string | null
}

export interface Grade {
  id: string
  course: string
  assignment: string
  score: number | null
  maxScore: number | null
  weight: number | null
  dueDate: string | null
  source: 'local' | 'moodle'
  sourceId: string | null
}

export interface PanelLayout {
  i: string
  x: number
  y: number
  w: number
  h: number
}

export interface Workspace {
  id: string
  name: string
  icon: string
  sortOrder: number
  panelVisibility: Record<string, boolean>
  panelLayouts: PanelLayout[]
}

export interface PomodoroConfig {
  workDuration: number
  shortBreak: number
  longBreak: number
  sessionsBeforeLongBreak: number
}

export interface PomodoroSession {
  id: string
  taskId: string | null
  state: 'work' | 'short_break' | 'long_break' | 'stopped'
  durationSeconds: number
  startedAt: string | null
  completedAt: string | null
}

export interface NewsItem {
  id: string
  title: string
  summary: string | null
  url: string | null
  source: string | null
  publishedAt: string | null
  fetchedAt: string
}

export interface NewsFeed {
  id: string
  url: string
  label: string | null
  enabled: boolean
}

export interface Transcription {
  id: string
  title: string | null
  audioPath: string | null
  transcript: string | null
  durationSeconds: number | null
  createdAt: string
}

export interface IntegrationStatus {
  google: boolean
  moodle: boolean
  openai: boolean
}
