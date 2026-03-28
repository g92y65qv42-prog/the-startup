import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { getDb } from '../db'
import { IPC, PomodoroConfig, PomodoroSession } from '../../../src/shared/ipc-channels'

export function registerPomodoroIpc(): void {
  const db = getDb()

  ipcMain.handle(IPC.POMODORO_GET_CONFIG, (): PomodoroConfig => {
    const row = db.prepare('SELECT * FROM pomodoro_config WHERE id = 1').get() as Record<string, number>
    return {
      workDuration: row.work_duration,
      shortBreak: row.short_break,
      longBreak: row.long_break,
      sessionsBeforeLongBreak: row.sessions_before_long_break
    }
  })

  ipcMain.handle(IPC.POMODORO_SAVE_CONFIG, (_e, config: PomodoroConfig) => {
    db.prepare(`
      UPDATE pomodoro_config SET
        work_duration = ?, short_break = ?, long_break = ?, sessions_before_long_break = ?
      WHERE id = 1
    `).run(config.workDuration, config.shortBreak, config.longBreak, config.sessionsBeforeLongBreak)
    return { ok: true }
  })

  ipcMain.handle(IPC.POMODORO_GET_SESSION, (): PomodoroSession | null => {
    const row = db.prepare(`
      SELECT * FROM pomodoro_sessions WHERE completed_at IS NULL ORDER BY started_at DESC LIMIT 1
    `).get() as Record<string, unknown> | undefined
    if (!row) return null
    return {
      id: row.id as string,
      taskId: row.task_id as string | null,
      state: row.state as PomodoroSession['state'],
      durationSeconds: row.duration_seconds as number,
      startedAt: row.started_at as string | null,
      completedAt: row.completed_at as string | null
    }
  })

  ipcMain.handle(IPC.POMODORO_SAVE_SESSION, (_e, session: Partial<PomodoroSession> & { id?: string }) => {
    const id = session.id ?? randomUUID()
    db.prepare(`
      INSERT INTO pomodoro_sessions (id, task_id, state, duration_seconds, started_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        state = excluded.state,
        duration_seconds = excluded.duration_seconds,
        started_at = excluded.started_at,
        completed_at = excluded.completed_at
    `).run(
      id,
      session.taskId ?? null,
      session.state ?? 'stopped',
      session.durationSeconds ?? 0,
      session.startedAt ?? null,
      session.completedAt ?? null
    )
    return { ok: true, id }
  })
}
