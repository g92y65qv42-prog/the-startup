import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { getDb } from '../db'
import { IPC, Workspace, PanelLayout } from '../../../src/shared/ipc-channels'

const DEFAULT_WORKSPACES: Omit<Workspace, 'panelLayouts'>[] = [
  {
    id: 'overview',
    name: 'Overview',
    icon: 'grid',
    sortOrder: 0,
    panelVisibility: {
      tasks: true, calendar: true, deadlines: true, grades: true,
      pomodoro: true, 'science-news': true, 'audio-transcription': true,
      email: false, docs: false
    }
  },
  {
    id: 'study',
    name: 'Study',
    icon: 'book',
    sortOrder: 1,
    panelVisibility: {
      tasks: true, calendar: true, deadlines: true, grades: true,
      pomodoro: true, 'science-news': false, 'audio-transcription': false,
      email: false, docs: false
    }
  },
  {
    id: 'focus',
    name: 'Focus',
    icon: 'timer',
    sortOrder: 2,
    panelVisibility: {
      tasks: true, calendar: false, deadlines: false, grades: false,
      pomodoro: true, 'science-news': false, 'audio-transcription': false,
      email: false, docs: false
    }
  },
  {
    id: 'research',
    name: 'Research',
    icon: 'flask',
    sortOrder: 3,
    panelVisibility: {
      tasks: false, calendar: false, deadlines: false, grades: false,
      pomodoro: false, 'science-news': true, 'audio-transcription': true,
      email: false, docs: true
    }
  },
  {
    id: 'comms',
    name: 'Comms',
    icon: 'mail',
    sortOrder: 4,
    panelVisibility: {
      tasks: false, calendar: true, deadlines: true, grades: false,
      pomodoro: false, 'science-news': false, 'audio-transcription': false,
      email: true, docs: false
    }
  }
]

const DEFAULT_LAYOUTS: PanelLayout[] = [
  { i: 'pomodoro', x: 0, y: 0, w: 3, h: 3 },
  { i: 'tasks', x: 3, y: 0, w: 4, h: 4 },
  { i: 'calendar', x: 7, y: 0, w: 5, h: 4 },
  { i: 'deadlines', x: 0, y: 3, w: 3, h: 3 },
  { i: 'grades', x: 3, y: 4, w: 4, h: 4 },
  { i: 'science-news', x: 7, y: 4, w: 5, h: 4 },
  { i: 'audio-transcription', x: 0, y: 6, w: 4, h: 3 },
  { i: 'email', x: 4, y: 8, w: 4, h: 3 },
  { i: 'docs', x: 8, y: 8, w: 4, h: 3 }
]

function seedWorkspaces(db: ReturnType<typeof getDb>): void {
  const count = (db.prepare('SELECT COUNT(*) as n FROM workspaces').get() as { n: number }).n
  if (count > 0) return

  const insert = db.prepare(`
    INSERT INTO workspaces (id, name, icon, sort_order, panel_visibility, panel_layouts)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  for (const ws of DEFAULT_WORKSPACES) {
    insert.run(
      ws.id,
      ws.name,
      ws.icon,
      ws.sortOrder,
      JSON.stringify(ws.panelVisibility),
      JSON.stringify(DEFAULT_LAYOUTS)
    )
  }
}

export function registerLayoutIpc(): void {
  const db = getDb()
  seedWorkspaces(db)

  ipcMain.handle(IPC.WORKSPACE_LIST, (): Workspace[] => {
    const rows = db.prepare('SELECT * FROM workspaces ORDER BY sort_order').all() as Array<{
      id: string; name: string; icon: string; sort_order: number;
      panel_visibility: string; panel_layouts: string
    }>
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      sortOrder: r.sort_order,
      panelVisibility: JSON.parse(r.panel_visibility),
      panelLayouts: JSON.parse(r.panel_layouts)
    }))
  })

  ipcMain.handle(IPC.WORKSPACE_SAVE, (_e, workspace: Workspace) => {
    db.prepare(`
      INSERT INTO workspaces (id, name, icon, sort_order, panel_visibility, panel_layouts)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        icon = excluded.icon,
        sort_order = excluded.sort_order,
        panel_visibility = excluded.panel_visibility,
        panel_layouts = excluded.panel_layouts
    `).run(
      workspace.id,
      workspace.name,
      workspace.icon,
      workspace.sortOrder,
      JSON.stringify(workspace.panelVisibility),
      JSON.stringify(workspace.panelLayouts)
    )
    return { ok: true }
  })

  ipcMain.handle(IPC.LAYOUT_GET, (_e, workspaceId: string): PanelLayout[] => {
    const row = db.prepare('SELECT panel_layouts FROM workspaces WHERE id = ?').get(workspaceId) as
      | { panel_layouts: string }
      | undefined
    if (!row) return DEFAULT_LAYOUTS
    return JSON.parse(row.panel_layouts)
  })

  ipcMain.handle(IPC.LAYOUT_SAVE, (_e, workspaceId: string, layouts: PanelLayout[]) => {
    db.prepare('UPDATE workspaces SET panel_layouts = ? WHERE id = ?').run(
      JSON.stringify(layouts),
      workspaceId
    )
    return { ok: true }
  })
}
