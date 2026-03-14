import React, { useEffect, useState } from 'react'
import { PanelWrapper } from '../_base/PanelWrapper'
import { useStore } from '@/store'
import { useIPC } from '@/hooks/useIPC'
import { IPC, Grade } from '@shared/ipc-channels'

export default function GradesPanel() {
  const { invoke } = useIPC()
  const grades = useStore(s => s.grades)
  const setGrades = useStore(s => s.setGrades)
  const upsertGrade = useStore(s => s.upsertGrade)
  const removeGrade = useStore(s => s.removeGrade)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ course: '', assignment: '', score: '', maxScore: '' })

  useEffect(() => { invoke<Grade[]>(IPC.GRADES_LIST).then(setGrades) }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const grade = await invoke<Grade>(IPC.GRADES_CREATE, {
      course: form.course,
      assignment: form.assignment,
      score: form.score ? parseFloat(form.score) : null,
      maxScore: form.maxScore ? parseFloat(form.maxScore) : null
    })
    upsertGrade(grade)
    setForm({ course: '', assignment: '', score: '', maxScore: '' })
    setAdding(false)
  }

  // Group by course
  const byCourse = grades.reduce<Record<string, Grade[]>>((acc, g) => {
    acc[g.course] = acc[g.course] ?? []
    acc[g.course].push(g)
    return acc
  }, {})

  function courseAvg(grades: Grade[]) {
    const weighted = grades.filter(g => g.score != null && g.maxScore)
    if (!weighted.length) return null
    const total = weighted.reduce((s, g) => s + (g.score! / g.maxScore!) * 100, 0)
    return (total / weighted.length).toFixed(1)
  }

  return (
    <PanelWrapper panelId="grades" title="Grades">
      <div className="flex justify-end mb-2">
        <button onClick={() => setAdding(!adding)} style={addBtnStyle}>
          {adding ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="flex flex-col gap-2 mb-3 p-2 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.04)' }}>
          {(['course', 'assignment', 'score', 'maxScore'] as const).map(field => (
            <input key={field} placeholder={field === 'maxScore' ? 'Max score' : field}
              value={form[field]}
              onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
              style={inputStyle} />
          ))}
          <button type="submit" style={{ ...addBtnStyle, background: '#0A84FF' }}>Save</button>
        </form>
      )}

      <div className="flex flex-col gap-3">
        {Object.entries(byCourse).map(([course, items]) => (
          <div key={course}>
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(235,235,245,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {course}
              </span>
              {courseAvg(items) && (
                <span style={{ fontSize: 12, color: '#0A84FF', fontWeight: 600 }}>{courseAvg(items)}%</span>
              )}
            </div>
            {items.map(g => (
              <div key={g.id} className="flex items-center gap-2 py-1 group">
                <span style={{ flex: 1, fontSize: 13, color: '#fff' }}>{g.assignment}</span>
                {g.score != null && g.maxScore && (
                  <span style={{ fontSize: 13, color: pct(g.score, g.maxScore) >= 90 ? '#32D74B' : pct(g.score, g.maxScore) >= 70 ? '#FF9F0A' : '#FF453A' }}>
                    {g.score}/{g.maxScore}
                  </span>
                )}
                <button onClick={() => invoke(IPC.GRADES_DELETE, g.id).then(() => removeGrade(g.id))}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'none', border: 'none', color: 'rgba(235,235,245,0.4)', cursor: 'pointer', fontSize: 14 }}>×</button>
              </div>
            ))}
          </div>
        ))}
        {grades.length === 0 && (
          <p style={{ color: 'rgba(235,235,245,0.3)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
            No grades yet
          </p>
        )}
      </div>
    </PanelWrapper>
  )
}

const pct = (score: number, max: number) => (score / max) * 100
const addBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8,
  color: '#fff', padding: '4px 10px', fontSize: 12, cursor: 'pointer'
}
const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8, color: '#fff', fontSize: 13, padding: '4px 8px', outline: 'none'
}
