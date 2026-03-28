import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { getDb } from '../db'
import { IPC, Grade } from '../../../src/shared/ipc-channels'

function rowToGrade(r: Record<string, unknown>): Grade {
  return {
    id: r.id as string,
    course: r.course as string,
    assignment: r.assignment as string,
    score: r.score as number | null,
    maxScore: r.max_score as number | null,
    weight: r.weight as number | null,
    dueDate: r.due_date as string | null,
    source: r.source as Grade['source'],
    sourceId: r.source_id as string | null
  }
}

export function registerGradesIpc(): void {
  const db = getDb()

  ipcMain.handle(IPC.GRADES_LIST, (): Grade[] => {
    return (db.prepare('SELECT * FROM grades ORDER BY course, due_date').all() as Record<string, unknown>[]).map(rowToGrade)
  })

  ipcMain.handle(IPC.GRADES_CREATE, (_e, data: Partial<Grade>): Grade => {
    const grade: Grade = {
      id: randomUUID(),
      course: data.course ?? '',
      assignment: data.assignment ?? '',
      score: data.score ?? null,
      maxScore: data.maxScore ?? null,
      weight: data.weight ?? null,
      dueDate: data.dueDate ?? null,
      source: 'local',
      sourceId: null
    }
    db.prepare(`
      INSERT INTO grades (id, course, assignment, score, max_score, weight, due_date, source, source_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(grade.id, grade.course, grade.assignment, grade.score, grade.maxScore, grade.weight, grade.dueDate, 'local', null)
    return grade
  })

  ipcMain.handle(IPC.GRADES_UPDATE, (_e, data: Partial<Grade> & { id: string }): Grade => {
    const existing = db.prepare('SELECT * FROM grades WHERE id = ?').get(data.id) as Record<string, unknown>
    if (!existing) throw new Error(`Grade ${data.id} not found`)
    db.prepare(`
      UPDATE grades SET course=?, assignment=?, score=?, max_score=?, weight=?, due_date=? WHERE id=?
    `).run(
      data.course ?? existing.course,
      data.assignment ?? existing.assignment,
      data.score !== undefined ? data.score : existing.score,
      data.maxScore !== undefined ? data.maxScore : existing.max_score,
      data.weight !== undefined ? data.weight : existing.weight,
      data.dueDate !== undefined ? data.dueDate : existing.due_date,
      data.id
    )
    return rowToGrade({ ...existing, ...data })
  })

  ipcMain.handle(IPC.GRADES_DELETE, (_e, id: string) => {
    db.prepare('DELETE FROM grades WHERE id = ?').run(id)
    return { ok: true }
  })
}
