import React, { useEffect, useState } from 'react'
import { PanelWrapper } from '../_base/PanelWrapper'
import { useStore } from '@/store'
import { useIPC } from '@/hooks/useIPC'
import { IPC, Task } from '@shared/ipc-channels'

export default function TasksPanel() {
  const { invoke } = useIPC()
  const tasks = useStore(s => s.tasks)
  const setTasks = useStore(s => s.setTasks)
  const upsertTask = useStore(s => s.upsertTask)
  const removeTask = useStore(s => s.removeTask)
  const [input, setInput] = useState('')

  useEffect(() => {
    invoke<Task[]>(IPC.TASKS_LIST).then(setTasks)
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    const task = await invoke<Task>(IPC.TASKS_CREATE, { title: input.trim() })
    upsertTask(task)
    setInput('')
  }

  async function toggleDone(task: Task) {
    const updated = await invoke<Task>(IPC.TASKS_UPDATE, { id: task.id, done: !task.done })
    upsertTask(updated)
  }

  return (
    <PanelWrapper panelId="tasks" title="Tasks">
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

      <ul className="flex flex-col gap-1.5">
        {tasks.map(task => (
          <li
            key={task.id}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 group"
            style={{ background: 'rgba(255,255,255,0.03)' }}
          >
            <input
              type="checkbox"
              checked={task.done}
              onChange={() => toggleDone(task)}
              style={{ accentColor: '#0A84FF', width: 14, height: 14, cursor: 'pointer' }}
            />
            <span
              style={{
                fontSize: 13,
                color: task.done ? 'rgba(235,235,245,0.3)' : '#fff',
                textDecoration: task.done ? 'line-through' : 'none',
                flex: 1
              }}
            >
              {task.title}
            </span>
            {task.dueDate && (
              <span style={{ fontSize: 11, color: 'rgba(235,235,245,0.4)' }}>
                {new Date(task.dueDate).toLocaleDateString()}
              </span>
            )}
            <button
              onClick={() => invoke(IPC.TASKS_DELETE, task.id).then(() => removeTask(task.id))}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              style={{
                background: 'none', border: 'none',
                color: 'rgba(235,235,245,0.4)', cursor: 'pointer', fontSize: 14
              }}
            >
              ×
            </button>
          </li>
        ))}
        {tasks.length === 0 && (
          <li style={{ color: 'rgba(235,235,245,0.3)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
            No tasks yet
          </li>
        )}
      </ul>
    </PanelWrapper>
  )
}
