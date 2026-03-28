# KB Dashboard — Product Specification

**Version:** 1.0
**Date:** 2026-03-14
**Status:** Draft

---

## 1. Overview

KB Dashboard is a macOS desktop dashboard app with a dark iMac aesthetic. It provides a customizable panel grid showing tasks, calendar, deadlines, grades, audio transcription, science news, and a Pomodoro timer — all in a single persistent window. External integrations (Email, Google Docs, Moodle) are connected once and run locally with credentials stored in the macOS Keychain.

**Not included:** AI assistant, KPI widgets.

---

## 2. Design Language

| Token | Value |
|-------|-------|
| Background | `#1C1C1E` |
| Panel surface | `#2C2C2E` |
| Accent | `#0A84FF` |
| Font stack | `"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif` |
| Border radius | `12px` (panels), `16px` (modals/popovers) |
| Modal backdrop | `backdrop-filter: blur(20px) saturate(180%)` + `rgba(28,28,30,0.7)` (frosted glass) |
| Sidebar width | `220px` expanded / `52px` collapsed (icon only) |
| Panel gap | `12px` |
| Typography scale | SF Pro sizes: 11px (caption), 13px (body), 15px (subhead), 17px (headline), 22px (title) |

All interactive elements use `transition: all 0.15s ease` for responsiveness without feeling sluggish.

---

## 3. Technology Stack

### 3.1 App Shell

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Desktop shell | **Electron 30+** | Proven ecosystem, easy web-based integrations, native macOS API access via Node.js |
| Frontend | **React 18 + Vite** | Component-per-panel architecture, fast HMR in development |
| Styling | **Tailwind CSS v4** + CSS variables for design tokens | Utility-first with design system tokens |
| State | **Zustand** | Lightweight, slice-based, no boilerplate |
| Panel grid | **react-grid-layout** | Battle-tested responsive grid with col/row span, drag-reorder, resize |
| Database | **better-sqlite3** (main process) | Synchronous, embedded, no server |
| Credentials | **keytar** (macOS Keychain) | Secure OAuth token storage |
| Build | **electron-vite** | Unified Vite config for main + preload + renderer |
| Packaging | **electron-builder** | macOS `.dmg` + auto-update |

### 3.2 Electron Process Architecture

**Security model: `contextIsolation: true`, `nodeIntegration: false`**

The renderer process (React) never has direct Node.js access. All OS operations go through a typed IPC bridge defined in `preload.ts`. This is required because future integration panels may embed external web content (Moodle, Gmail) via `BrowserView`.

```
Renderer (React UI)
  ↓  window.electronAPI.invoke('tasks:get')
Preload (IPC bridge)
  ↓  ipcRenderer.invoke('tasks:get')
Main Process (Node.js)
  ↓  better-sqlite3 / keytar / fs
OS / Keychain / Disk
```

All IPC channels are defined in a shared `src/shared/ipc-channels.ts` type file consumed by both main and renderer, ensuring compile-time type safety.

---

## 4. Project Structure

```
kb-dashboard/
├── electron/
│   ├── main.ts                  # App lifecycle, window creation, IPC registration
│   ├── preload.ts               # Typed IPC bridge exposed to renderer
│   └── services/
│       ├── db.ts                # SQLite connection + migrations
│       ├── keychain.ts          # keytar wrapper (get/set/delete tokens)
│       ├── ipc/
│       │   ├── tasks.ts         # IPC handlers for task CRUD
│       │   ├── events.ts        # IPC handlers for calendar events
│       │   ├── grades.ts
│       │   ├── panels.ts        # Layout persistence
│       │   ├── integrations.ts  # OAuth flow initiation
│       │   └── transcription.ts
│       └── integrations/
│           ├── google.ts        # Google OAuth + Calendar/Gmail/Docs API
│           └── moodle.ts        # Moodle REST API
│
├── src/
│   ├── main.tsx                 # React entry
│   ├── app/
│   │   ├── App.tsx              # Shell layout (sidebar + grid area)
│   │   └── shell/
│   │       ├── Sidebar.tsx
│   │       ├── TopBar.tsx       # Window chrome: traffic lights + title
│   │       └── GridContainer.tsx
│   │
│   ├── panels/                  # One directory per panel
│   │   ├── _base/
│   │   │   ├── PanelWrapper.tsx # Shared chrome: title bar, drag handle, hide button
│   │   │   └── panel.types.ts   # PanelDefinition interface
│   │   ├── tasks/
│   │   ├── calendar/
│   │   ├── deadlines/
│   │   ├── grades/
│   │   ├── pomodoro/
│   │   ├── science-news/
│   │   ├── audio-transcription/
│   │   ├── email/
│   │   └── docs/
│   │
│   ├── store/
│   │   ├── index.ts             # Zustand root (combine slices)
│   │   ├── tasks.slice.ts
│   │   ├── calendar.slice.ts
│   │   ├── grades.slice.ts
│   │   ├── pomodoro.slice.ts
│   │   ├── panels.slice.ts      # Grid layout + visibility
│   │   └── integrations.slice.ts
│   │
│   ├── hooks/
│   │   └── useIPC.ts            # Typed wrapper around window.electronAPI
│   │
│   └── shared/
│       ├── ipc-channels.ts      # Shared channel names + payload types
│       └── design-tokens.ts     # JS-accessible design constants
│
├── resources/
│   └── icons/                   # macOS .icns
│
├── electron.vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 5. Panel System

### 5.1 Grid Mechanics

Uses **react-grid-layout** with a **12-column grid**, 100px row height, 12px gap.

Each panel has a `PanelDefinition`:

```typescript
interface PanelDefinition {
  id: string                    // e.g. 'pomodoro'
  displayName: string
  defaultLayout: { w: number; h: number }  // e.g. { w: 3, h: 2 }
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
  backgroundRequired: boolean   // true = stays mounted when hidden
  component: React.LazyExoticComponent<any>
}
```

All panels are lazy-loaded (`React.lazy`) to minimize startup time.

**Layout persistence:** The grid layout array (`{i, x, y, w, h}[]`) is serialized to SQLite in the `panel_layouts` table whenever the user drops a panel or resizes it (debounced 500ms).

### 5.2 Panel Visibility and Hidden State

Sidebar filter selection sets a visibility map `Record<PanelId, boolean>` in Zustand.

- **`backgroundRequired: true`** panels (Pomodoro timer, Audio Transcription) are **always mounted** in the React tree. When hidden, they receive `display: none` via CSS. Their state (timer counting, recording in progress) continues uninterrupted.
- **`backgroundRequired: false`** panels (News Feed, Grades, Email, Docs) are **unmounted** when hidden. This frees memory and network polling. State is restored from SQLite on re-mount.

Hidden panels are removed from react-grid-layout's layout array when filtered out so they don't leave gaps. Their last-known `{x, y, w, h}` is persisted and restored when they become visible again.

### 5.3 Panel Chrome

Every panel is wrapped in `PanelWrapper`, which provides:
- Drag handle (top bar with `cursor: grab`)
- Panel title (SF Pro 13px semibold, `#EBEBF5` at 60% opacity)
- Hide button (appears on hover: `×`, triggers sidebar filter toggle)
- Resize handle (bottom-right corner)
- `background: #2C2C2E`, `border-radius: 12px`, `border: 1px solid rgba(255,255,255,0.06)`

---

## 6. Sidebar Navigation

The sidebar contains **named filter presets** (workspaces) that show/hide relevant panels on the same grid. The grid is always the container — the sidebar changes which panels are visible, not which page is shown.

### 6.1 Default Sidebar Items

| Item | Icon | Panels Shown |
|------|------|-------------|
| Overview | grid-2x2 | All panels |
| Study | book | Tasks, Calendar, Deadlines, Grades, Pomodoro |
| Focus | timer | Pomodoro, Tasks |
| Research | flask | Science News, Audio Transcription, Docs |
| Comms | mail | Email, Calendar, Moodle |

Custom workspaces can be added. Each workspace stores a snapshot of `Record<PanelId, boolean>`.

### 6.2 Individual Panel Toggles

A "Customize" button at the sidebar bottom opens a modal listing all installed panels with toggle switches. This directly updates the active workspace's visibility map.

### 6.3 Sidebar Collapse

The sidebar collapses to 52px showing only icons. The panel grid expands to fill the freed space. `localStorage` persists collapse state between sessions.

---

## 7. Data Architecture

### 7.1 Storage Locations

| Data | Location | Format |
|------|----------|--------|
| Tasks, events, grades, transcriptions | `~/Library/Application Support/KB Dashboard/db.sqlite` | SQLite via better-sqlite3 |
| Grid layouts, workspaces, preferences | Same SQLite DB | |
| OAuth access tokens + refresh tokens | macOS Keychain via keytar | Service: `com.kb-dashboard`, account: `google` / `moodle` |
| App settings (window bounds, sidebar state) | `~/Library/Application Support/KB Dashboard/settings.json` | JSON |

### 7.2 Database Schema

```sql
-- Tasks
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  done INTEGER DEFAULT 0,
  due_date TEXT,           -- ISO8601
  pomodoro_id TEXT,        -- FK to pomodoro sessions
  source TEXT DEFAULT 'local',  -- 'local' | 'moodle' | 'google'
  source_id TEXT,          -- External ID for sync dedup
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Calendar events
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  start TEXT NOT NULL,     -- ISO8601
  end TEXT NOT NULL,
  all_day INTEGER DEFAULT 0,
  source TEXT DEFAULT 'local',
  source_id TEXT,
  color TEXT,
  created_at TEXT NOT NULL
);

-- Grades
CREATE TABLE grades (
  id TEXT PRIMARY KEY,
  course TEXT NOT NULL,
  assignment TEXT NOT NULL,
  score REAL,
  max_score REAL,
  weight REAL,             -- percentage weight in course
  due_date TEXT,
  source TEXT DEFAULT 'local',
  source_id TEXT
);

-- Pomodoro sessions
CREATE TABLE pomodoro_sessions (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  state TEXT NOT NULL,     -- 'work' | 'short_break' | 'long_break' | 'stopped'
  duration_seconds INTEGER NOT NULL,
  started_at TEXT,
  completed_at TEXT
);

-- Pomodoro config (single row)
CREATE TABLE pomodoro_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  work_duration INTEGER DEFAULT 1500,       -- seconds
  short_break INTEGER DEFAULT 300,
  long_break INTEGER DEFAULT 1200,
  sessions_before_long_break INTEGER DEFAULT 4
);

-- Audio transcriptions
CREATE TABLE transcriptions (
  id TEXT PRIMARY KEY,
  title TEXT,
  audio_path TEXT,         -- path to .m4a in app data dir
  transcript TEXT,
  duration_seconds INTEGER,
  created_at TEXT NOT NULL
);

-- Panel layouts per workspace
CREATE TABLE panel_layouts (
  workspace_id TEXT NOT NULL,
  panel_id TEXT NOT NULL,
  x INTEGER, y INTEGER, w INTEGER, h INTEGER,
  visible INTEGER DEFAULT 1,
  PRIMARY KEY (workspace_id, panel_id)
);

-- Workspaces
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- Science news cache
CREATE TABLE news_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  url TEXT,
  source TEXT,
  published_at TEXT,
  fetched_at TEXT NOT NULL
);
```

---

## 8. Panel Specifications

### 8.1 Task Manager
- Flat list of tasks with checkbox, title, optional due date
- Quick-add input at top (press Enter to create)
- Filter tabs: All / Today / Upcoming / Done
- Tasks with `source = 'moodle'` show a Moodle badge and are read-only (no edit, no delete)
- Overdue tasks highlight title in `#FF453A`
- Default size: 4×4

### 8.2 Calendar
- Month/week toggle
- Local events + Google Calendar events (color-coded by source)
- Click day to quick-add event
- Moodle deadlines appear as read-only events
- Default size: 5×4

### 8.3 Deadline Tracker
- Sorted list of upcoming deadlines (tasks + events with due dates)
- Days-remaining badge: green (>7d), yellow (3–7d), red (<3d), pulsing red (overdue)
- Sources: local tasks, Moodle assignments, Google Calendar events
- Default size: 3×3

### 8.4 Grades Tracker
- Table: Course / Assignment / Score / Weight / Grade %
- Per-course GPA calculation (weighted average)
- Manual entry only in v1; Moodle grades sync in integration phase
- Default size: 4×4

### 8.5 Pomodoro Timer
- `backgroundRequired: true` — keeps running when panel hidden
- Large circular progress ring (accent color `#0A84FF`)
- State machine: work → short break → work → ... → long break (configurable intervals)
- Optionally links to a task (marks task as worked-on per session)
- macOS `Notification` on work/break transitions
- Session count persisted to SQLite (survives app restart)
- Default size: 3×3

### 8.6 Science News Feed
- RSS/Atom aggregator: default sources = NASA, arXiv (cs.AI, physics), Nature News, Ars Technica Science
- Cards: source badge, headline, 2-line summary, timestamp, "Open" link (system browser)
- Background polling every 30 minutes; cache in SQLite `news_items` table
- User can add/remove RSS feed URLs in panel settings
- Default size: 4×4

### 8.7 Audio Transcription
- `backgroundRequired: true`
- Record button → records system microphone → saves `.m4a` to app data dir
- On stop: sends audio to OpenAI Whisper API (`/v1/audio/transcriptions`)
- OpenAI API key stored in Keychain (`com.kb-dashboard`, account: `openai`)
- Transcript displayed inline; persisted to SQLite
- Transcript list: searchable history of all sessions
- Default size: 4×3

> **v2 consideration:** Local transcription via `whisper.cpp` Node.js binding (~150MB model). Offer as opt-in "offline mode" once v1 cloud path is stable.

### 8.8 Email Panel
- Connects to Gmail via OAuth2 (Google identity scope: `gmail.readonly`)
- Shows last 20 threads: sender, subject, preview, unread badge
- Click → opens thread in system browser (`shell.openExternal`)
- Refreshes every 5 minutes; rate-limited to avoid quota exhaustion
- Default size: 4×3

### 8.9 Google Docs Panel
- Lists recent Drive files (Drive API, `drive.readonly` scope) filtered to Docs/Sheets/Slides
- Shows: file name, last modified, icon by type
- Click → opens in system browser
- Default size: 3×3

---

## 9. Integration Architecture

### 9.1 Google OAuth2

OAuth2 PKCE flow initiated from main process:
1. Main process generates code verifier + challenge
2. Opens system browser to Google auth URL with `redirect_uri=http://localhost:{ephemeral_port}`
3. Main process spins up a one-shot local HTTP server to receive the callback
4. Exchanges code for access + refresh tokens
5. Stores tokens in Keychain; closes local server
6. Renderer is notified via IPC that auth succeeded

Token refresh happens in main process before any API call if `expiry - now < 5 minutes`.

**Scopes requested:**
- `https://www.googleapis.com/auth/calendar.readonly`
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/drive.readonly`

### 9.2 Moodle REST API

Moodle uses token-based auth (not OAuth):
1. User enters Moodle instance URL + username/password in a settings modal
2. Main process calls `POST /login/token.php` to get a user token
3. Token stored in Keychain
4. API calls use `wstoken` query param

Data fetched: assignments (`mod_assign_get_assignments`), grades (`gradereport_user_get_grade_items`), calendar events (`core_calendar_get_calendar_events`).

### 9.3 Sync Strategy

- **Google Calendar / Gmail / Drive:** Pull-only, no write-back. Refresh on panel mount + background polling (configurable interval, default 5min for Calendar, 5min for Gmail, 15min for Drive).
- **Moodle:** Pull-only. Refresh on app launch + every 30 minutes.
- **Conflict model:** External source always wins for items with a `source_id`. Local items are never overwritten.

---

## 10. Inter-Panel Communication

**Model: Zustand store with typed cross-slice reactions via `useEffect` watchers**

Each feature domain has its own Zustand slice. Cross-panel reactions are implemented as watchers in a dedicated `store/reactions.ts` file, initialized once at app startup.

Example reactions:
```typescript
// When pomodoro session completes, increment task's pomodoro_count
subscribeToSlice(pomodoroSlice, 'completedSessionTaskId', (taskId) => {
  if (taskId) tasksSlice.incrementPomodoroCount(taskId)
})

// When a task's due_date passes, emit to deadlines slice
subscribeToSlice(tasksSlice, 'tasks', (tasks) => {
  deadlinesSlice.syncFromTasks(tasks)
})
```

This keeps slices independent (no imports between slices) while enabling coordinated behavior.

---

## 11. App Shell Layout

```
┌─────────────────────────────────────────────────────────────┐
│  ● ● ●   KB Dashboard          [search]            [+panel] │  ← TopBar (draggable)
├───────────┬─────────────────────────────────────────────────┤
│           │                                                  │
│  Overview │   ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  Study    │   │  Timer   │  │  Tasks   │  │ Calendar │    │
│  Focus    │   │  3×3     │  │  4×4     │  │  5×4     │    │
│  Research │   └──────────┘  └──────────┘  └──────────┘    │
│  Comms    │                                                  │
│           │   ┌──────────────────────┐  ┌──────────┐       │
│           │   │  Science News        │  │  Grades  │       │
│ ─────── │   │  4×4                 │  │  4×4     │       │
│  ⚙ Prefs  │   └──────────────────────┘  └──────────┘       │
│  + Add    │                                                  │
└───────────┴─────────────────────────────────────────────────┘
```

- **TopBar:** Custom `height: 32px`, `-webkit-app-region: drag` on most of the bar. Traffic light buttons stay in default position. Search field and "+ Panel" button are `no-drag`.
- **Sidebar:** `220px` fixed width, `background: #1C1C1E`, `border-right: 1px solid rgba(255,255,255,0.06)`.
- **Grid area:** Takes remaining width, `overflow-y: auto`, `padding: 16px`.

---

## 12. Settings

Accessible via sidebar "⚙ Preferences" entry or `Cmd+,`.

| Section | Settings |
|---------|---------|
| Appearance | Sidebar collapsed by default, panel gap size |
| Integrations | Connect/disconnect Google, Moodle; view token status |
| Audio | OpenAI API key, default recording device |
| Pomodoro | Work/break durations, notification sound |
| News | RSS feed URLs, refresh interval |
| Data | Export all data (JSON), clear all data |

Settings are stored in `settings.json` (non-sensitive) and Keychain (tokens/API keys).

---

## 13. Phased Build Plan

### Phase 1 — Shell + Grid (MVP scaffolding)
- Electron + Vite + React + Zustand setup
- `contextIsolation` + preload IPC bridge
- Sidebar with hardcoded workspaces
- react-grid-layout panel grid with drag/resize/show/hide
- SQLite connection + migrations
- `PanelWrapper` chrome
- Placeholder panels for all 9 panel types

### Phase 2 — Core Panels (no integrations)
- Task Manager (local only)
- Pomodoro Timer (with background state, notifications)
- Deadline Tracker (from local tasks)
- Grades Tracker (manual entry)
- Science News Feed (RSS)

### Phase 3 — Audio Transcription
- Microphone recording via Web Audio API
- OpenAI Whisper API integration
- Keychain API key storage
- Transcript history in SQLite

### Phase 4 — Google Integration
- OAuth2 PKCE flow
- Google Calendar panel
- Gmail panel
- Google Docs panel

### Phase 5 — Moodle Integration
- Token auth flow
- Moodle assignment sync → tasks
- Moodle grades sync
- Moodle calendar events

### Phase 6 — Polish
- Frosted glass modals
- Panel animation (mount/unmount transitions)
- Keyboard shortcuts (`Cmd+K` command palette, `Cmd+,` settings)
- App icon + macOS dock integration
- Auto-updater (electron-updater)
- DMG packaging

---

## 14. Open Decisions

| Decision | Default chosen | Revisit when |
|----------|---------------|-------------|
| Audio transcription backend | Cloud (OpenAI Whisper API) | v2: add local whisper.cpp opt-in |
| Multi-device sync | None (local only) | User requests it; add iCloud Drive sync |
| Moodle auth method | Username/password → token | Add SSO/SAML if needed by institution |
| News feed AI summarization | None | Out of scope (no AI assistant) |
| Panel plugin system | Hardcoded panel registry | v3: dynamic panel loading from disk |
