import React from 'react'
import { PanelWrapper } from '../_base/PanelWrapper'
import { useStore } from '@/store'
import { Task } from '@shared/ipc-channels'

function daysUntil(dateStr: string): number {
  const now = new Date(); now.setHours(0,0,0,0)
  const due = new Date(dateStr); due.setHours(0,0,0,0)
  return Math.round((due.getTime() - now.getTime()) / 86400000)
}

function badgeColor(days: number) {
  if (days < 0) return '#FF453A'
  if (days <= 3) return '#FF453A'
  if (days <= 7) return '#FF9F0A'
  return '#32D74B'
}

export default function DeadlinesPanel() {
  const tasks = useStore(s => s.tasks)

  const deadlines = tasks
    .filter(t => t.dueDate && !t.done)
    .map(t => ({ ...t, days: daysUntil(t.dueDate!) }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 12)

  return (
    <PanelWrapper panelId="deadlines" title="Deadlines">
      <div className="flex flex-col gap-2">
        {deadlines.map(task => (
          <div key={task.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5"
            style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div style={{
              minWidth: 36, height: 20, borderRadius: 6, background: badgeColor(task.days),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, color: '#fff'
            }}>
              {task.days < 0 ? 'OVR' : task.days === 0 ? 'NOW' : `${task.days}d`}
            </div>
            <span style={{ fontSize: 13, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {task.title}
            </span>
          </div>
        ))}
        {deadlines.length === 0 && (
          <p style={{ color: 'rgba(235,235,245,0.3)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
            No upcoming deadlines
          </p>
        )}
      </div>
    </PanelWrapper>
  )
}
