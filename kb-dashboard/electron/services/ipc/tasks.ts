import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { getDb } from '../db'
import { IPC, Task } from '../../../src/shared/ipc-channels'

function rowToTask(r: Record<string, unknown>): Task {
  return {
    id: r.id as string,
    title: r.title as string,
    done: Boolean(r.done),
    dueDate: r.due_date as string | null,
    pomodoroId: r.pomodoro_id as string | null,
    source: r.source as Task['source'],
    sourceId: r.source_id as string | null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string
  }
}

export function registerTasksIpc(): void {
  const db = getDb()

  ipcMain.handle(IPC.TASKS_LIST, (): Task[] => {
    const rows = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all() as Record<string, unknown>[]
    return rows.map(rowToTask)
  })

  ipcMain.handle(IPC.TASKS_CREATE, (_e, data: Partial<Task>): Task => {
    const now = new Date().toISOString()
    const task: Task = {
      id: randomUUID(),
      title: data.title ?? '',
      done: false,
      dueDate: data.dueDate ?? null,
      pomodoroId: null,
      source: 'local',
      sourceId: null,
      createdAt: now,
      updatedAt: now
    }
    db.prepare(`
      INSERT INTO tasks (id, title, done, due_date, pomodoro_id, source, source_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(task.id, task.title, 0, task.dueDate, null, 'local', null, now, now)
    return task
  })

  ipcMain.handle(IPC.TASKS_UPDATE, (_e, data: Partial<Task> & { id: string }): Task => {
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(data.id) as Record<string, unknown>
    if (!existing) throw new Error(`Task ${data.id} not found`)

    const now = new Date().toISOString()
    db.prepare(`
      UPDATE tasks SET
        title = ?, done = ?, due_date = ?, updated_at = ?
      WHERE id = ?
    `).run(
      data.title ?? existing.title,
      data.done !== undefined ? (data.done ? 1 : 0) : existing.done,
      data.dueDate !== undefined ? data.dueDate : existing.due_date,
      now,
      data.id
    )
    return rowToTask({ ...existing, ...data, updated_at: now })
  })

  ipcMain.handle(IPC.TASKS_DELETE, (_e, id: string) => {
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
    return { ok: true }
  })
}
