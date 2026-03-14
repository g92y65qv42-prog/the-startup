import React, { useEffect, useState } from 'react'
import { PanelWrapper } from '../_base/PanelWrapper'
import { useStore } from '@/store'
import { useIPC } from '@/hooks/useIPC'
import { IPC, Task } from '@shared/ipc-channels'

type FilterTab = 'all' | 'today' | 'upcoming' | 'done'

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'done', label: 'Done' }
]

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
}

function isUpcoming(dateStr: string): boolean {
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  const tomorrow = new Date()
  tomorrow.setHours(0, 0, 0, 0)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return d >= tomorrow
}

function isOverdue(dateStr: string): boolean {
  const d = new Date(dateStr)
  d.setHours(23, 59, 59, 999)
  return d < new Date()
}

function filterTasks(tasks: Task[], tab: FilterTab): Task[] {
  switch (tab) {
    case 'today':
      return tasks.filter(t => !t.done && t.dueDate && isToday(t.dueDate))
    case 'upcoming':
      return tasks.filter(t => !t.done && t.dueDate && isUpcoming(t.dueDate))
    case 'done':
      return tasks.filter(t => t.done)
    default:
      return tasks.filter(t => !t.done)
  }
}

export default function TasksPanel() {
  const { invoke } = useIPC()
  const tasks = useStore(s => s.tasks)
  const setTasks = useStore(s => s.setTasks)
  const upsertTask = useStore(s => s.upsertTask)
  const removeTask = useStore(s => s.removeTask)
  const [input, setInput] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [tab, setTab] = useState<FilterTab>('all')

  useEffect(() => {
    invoke<Task[]>(IPC.TASKS_LIST).then(setTasks)
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    const task = await invoke<Task>(IPC.TASKS_CREATE, {
      title: input.trim(),
      dueDate: dueDate || null
    })
    upsertTask(task)
    setInput('')
    setDueDate('')
  }

  async function toggleDone(task: Task) {
    const updated = await invoke<Task>(IPC.TASKS_UPDATE, { id: task.id, done: !task.done })
    upsertTask(updated)
  }

  const visible = filterTasks(tasks, tab)

  return (
    <PanelWrapper panelId="tasks" title="Tasks">
      <div className="flex gap-1 mb-3">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: tab === t.id ? '#0A84FF' : 'rgba(255,255,255,0.06)',
              border: 'none',
              borderRadius: 6,
              color: tab === t.id ? '#fff' : 'rgba(235,235,245,0.5)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: tab === t.id ? 600 : 400,
              padding: '3px 9px',
              transition: 'all 0.15s ease'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleAdd} className="flex gap-2 mb-3">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Add task…"
          className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#fff',
            fontSize: 13
          }}
        />
        <input
          type="date"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            color: dueDate ? '#fff' : 'rgba(235,235,245,0.3)',
            fontSize: 12,
            padding: '4px 6px',
            outline: 'none',
            width: 120,
            colorScheme: 'dark'
          }}
        />
        <button
          type="submit"
          style={{
            background: '#0A84FF',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            padding: '4px 12px',
            fontSize: 13,
            cursor: 'pointer'
          }}
        >
          Add
        </button>
      </form>

      <ul className="flex flex-col gap-1.5 overflow-y-auto" style={{ flex: 1 }}>
        {visible.map(task => {
          const overdue = !task.done && task.dueDate && isOverdue(task.dueDate)
          return (
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
              <span
                style={{
                  fontSize: 13,
                  color: task.done
                    ? 'rgba(235,235,245,0.3)'
                    : overdue ? '#FF453A' : '#fff',
                  textDecoration: task.done ? 'line-through' : 'none',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {task.title}
              </span>
              {task.source !== 'local' && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'rgba(235,235,245,0.4)',
                  border: '1px solid rgba(235,235,245,0.15)',
                  borderRadius: 4,
                  padding: '0 4px',
                  flexShrink: 0
                }}>
                  {task.source}
                </span>
              )}
              {task.dueDate && (
                <span style={{
                  fontSize: 11,
                  color: overdue ? '#FF453A' : 'rgba(235,235,245,0.4)',
                  flexShrink: 0
                }}>
                  {new Date(task.dueDate).toLocaleDateString()}
                </span>
              )}
              {task.source === 'local' && (
                <button
                  onClick={() => invoke(IPC.TASKS_DELETE, task.id).then(() => removeTask(task.id))}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    background: 'none', border: 'none',
                    color: 'rgba(235,235,245,0.4)', cursor: 'pointer', fontSize: 14,
                    flexShrink: 0
                  }}
                >
                  ×
                </button>
              )}
            </li>
          )
        })}
        {visible.length === 0 && (
          <li style={{ color: 'rgba(235,235,245,0.3)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
            {tab === 'done' ? 'No completed tasks' : 'No tasks'}
          </li>
        )}
      </ul>
    </PanelWrapper>
  )
}
