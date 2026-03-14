import React from 'react'
import { PanelWrapper } from '../_base/PanelWrapper'

export default function CalendarPanel() {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const monthName = today.toLocaleString('default', { month: 'long' })

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? null : i - firstDay + 1
  )

  return (
    <PanelWrapper panelId="calendar" title="Calendar">
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-3">
          <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
            {monthName} {year}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
            <div key={d} style={{ fontSize: 11, color: 'rgba(235,235,245,0.3)', textAlign: 'center', padding: '2px 0' }}>
              {d}
            </div>
          ))}
          {cells.map((day, i) => (
            <div key={i} style={{
              aspectRatio: '1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 6,
              fontSize: 12,
              background: day === today.getDate() ? '#0A84FF' : 'transparent',
              color: day ? (day === today.getDate() ? '#fff' : 'rgba(235,235,245,0.8)') : 'transparent',
              cursor: day ? 'pointer' : 'default'
            }}>
              {day ?? ''}
            </div>
          ))}
        </div>
        <div className="mt-3 flex-1">
          <p style={{ fontSize: 12, color: 'rgba(235,235,245,0.3)', textAlign: 'center' }}>
            Google Calendar integration in Phase 4
          </p>
        </div>
      </div>
    </PanelWrapper>
  )
}
