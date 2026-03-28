import React, { useEffect, useState } from 'react'
import { PanelWrapper } from '../_base/PanelWrapper'
import { useStore } from '@/store'
import { useIPC } from '@/hooks/useIPC'
import { IPC, Task } from '@shared/ipc-channels'

type Filter = 'all' | 'today' | 'upcoming' | 'done'

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function filterTasks(tasks: Task[], filter: Filter): Task[] {
  const today = todayStr()
  switch (filter) {
    case 'today':
      return tasks.filter(t => !t.done && t.dueDate && t.dueDate.slice(0, 10) <= today)
    case 'upcoming':
      return tasks.filter(t => !t.done && t.dueDate && t.dueDate.slice(0, 10) > today)
    case 'done':
      return tasks.filter(t => t.done)
    default:
      return tasks.filter(t => !t.done)
  }
}

function isOverdue(task: Task): boolean {
  if (!task.dueDate || task.done) return false
  return task.dueDate.slice(0, 10) < todayStr()
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'done', label: 'Done' },
]

export default function TasksPanel() {
  const { invoke } = useIPC()
  const tasks = useStore(s => s.tasks)
  const setTasks = useStore(s => s.setTasks)
  const upsertTask = useStore(s => s.upsertTask)
  const removeTask = useStore(s => s.removeTask)

  const [input, setInput] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    invoke<Task[]>(IPC.TASKS_LIST).then(setTasks)
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    const task = await invoke<Task>(IPC.TASKS_CREATE, {
      title: input.trim(),
      dueDate: dueDate || null,
    })
    upsertTask(task)
    setInput('')
    setDueDate('')
  }

  async function toggleDone(task: Task) {
    const updated = await invoke<Task>(IPC.TASKS_UPDATE, { id: task.id, done: !task.done })
    upsertTask(updated)
  }

  const visible = filterTasks(tasks, filter)

  return (
    <PanelWrapper panelId="tasks" title="Tasks">
      {/* Add form */}
      <form onSubmit={handleAdd} className="flex gap-2 mb-3">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Add task…"
          style={inputStyle}
          className="flex-1"
        />
        <input
          type="date"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          style={{ ...inputStyle, width: 130, colorScheme: 'dark' }}
        />
        <button type="submit" style={addBtnStyle}>Add</button>
      </form>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-3">
        {FILTERS.map(f => {
          const count = filterTasks(tasks, f.id).length
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                background: filter === f.id ? '#0A84FF' : 'rgba(255,255,255,0.06)',
                border: 'none', borderRadius: 6,
                color: filter === f.id ? '#fff' : 'rgba(235,235,245,0.5)',
                fontSize: 12, fontWeight: filter === f.id ? 600 : 400,
                padding: '3px 10px', cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {f.label}
              {count > 0 && (
                <span style={{
                  marginLeft: 5,
                  fontSize: 10,
                  color: filter === f.id ? 'rgba(255,255,255,0.7)' : 'rgba(235,235,245,0.4)',
                }}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Task list */}
      <ul className="flex flex-col gap-1.5 overflow-y-auto" style={{ flex: 1 }}>
        {visible.map(task => (
          <li
            key={task.id}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 group"
            style={{ background: 'rgba(255,255,255,0.03)' }}
          >
            <input
              type="checkbox"
              checked={task.done}
              onChange={() => toggleDone(task)}
              style={{ accentColor: '#0A84FF', width: 14, height: 14, cursor: 'pointer', flexShrink: 0 }}
            />
            <span style={{
              fontSize: 13,
              color: task.done
                ? 'rgba(235,235,245,0.3)'
                : isOverdue(task) ? '#FF453A' : '#fff',
              textDecoration: task.done ? 'line-through' : 'none',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {task.title}
            </span>
            {task.dueDate && (
              <span style={{
                fontSize: 11,
                color: isOverdue(task) ? '#FF453A' : 'rgba(235,235,245,0.4)',
                flexShrink: 0,
              }}>
                {new Date(task.dueDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            )}
            <button
              onClick={() => invoke(IPC.TASKS_DELETE, task.id).then(() => removeTask(task.id))}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'none', border: 'none', color: 'rgba(235,235,245,0.4)', cursor: 'pointer', fontSize: 14, flexShrink: 0 }}
            >
              ×
            </button>
          </li>
        ))}
        {visible.length === 0 && (
          <li style={{ color: 'rgba(235,235,245,0.3)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
            {filter === 'done' ? 'Nothing completed yet' : 'No tasks here'}
          </li>
        )}
      </ul>
    </PanelWrapper>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8, color: '#fff',
  fontSize: 13, padding: '4px 10px',
  outline: 'none',
}

const addBtnStyle: React.CSSProperties = {
  background: '#0A84FF', border: 'none', borderRadius: 8,
  color: '#fff', padding: '4px 12px',
  fontSize: 13, cursor: 'pointer', flexShrink: 0,
}
