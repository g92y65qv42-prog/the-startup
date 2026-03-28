import React, { useEffect, useState } from 'react'
import { PanelWrapper } from '../_base/PanelWrapper'
import { useStore } from '@/store'
import { useIPC } from '@/hooks/useIPC'
import { IPC, GoogleCalendarEvent } from '@shared/ipc-channels'

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  if (diffMs < 0) return 'Now'
  const mins = Math.floor(diffMs / 60000)
  if (mins < 60) return `in ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `in ${hrs}h`
  const days = Math.floor(hrs / 24)
  return `in ${days}d`
}

function formatEventTime(start: string, end: string, allDay: boolean): string {
  if (allDay) return 'All day'
  const s = new Date(start)
  const e = new Date(end)
  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const datePart = s.toLocaleDateString([], { month: 'short', day: 'numeric' })
  if (s.toDateString() === new Date().toDateString()) return `Today ${fmt(s)} – ${fmt(e)}`
  return `${datePart} ${fmt(s)} – ${fmt(e)}`
}

function EventCard({ event, onOpen }: { event: GoogleCalendarEvent; onOpen: (url: string) => void }) {
  const color = event.color ?? '#0A84FF'
  return (
    <div
      style={{
        display: 'flex', gap: 10, padding: '8px 10px',
        background: 'rgba(255,255,255,0.04)', borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.04)',
        cursor: event.htmlLink ? 'pointer' : 'default',
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
      onClick={() => event.htmlLink && onOpen(event.htmlLink)}
    >
      <div style={{ width: 3, borderRadius: 2, background: color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 13, fontWeight: 500, color: '#EBEBF5',
          margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {event.title}
        </p>
        <p style={{ fontSize: 11, color: 'rgba(235,235,245,0.4)', margin: '2px 0 0' }}>
          {formatEventTime(event.start, event.end, event.allDay)}
        </p>
      </div>
      <span style={{ fontSize: 10, color: 'rgba(235,235,245,0.3)', flexShrink: 0, alignSelf: 'center' }}>
        {event.allDay ? '' : timeAgo(event.start)}
      </span>
    </div>
  )
}

export default function CalendarPanel() {
  const { invoke } = useIPC()
  const connected = useStore(s => s.integrationStatus.google)

  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const monthName = today.toLocaleString('default', { month: 'long' })
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? null : i - firstDay + 1
  )

  const [events, setEvents] = useState<GoogleCalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Days in this month that have events
  const eventDays = new Set(
    events
      .filter(e => !e.allDay)
      .map(e => new Date(e.start).getDate())
  )

  useEffect(() => {
    if (!connected) return
    setLoading(true)
    setError(null)
    invoke<GoogleCalendarEvent[]>(IPC.GOOGLE_CALENDAR_LIST)
      .then(setEvents)
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false))
  }, [connected])

  function handleOpen(url: string) {
    invoke(IPC.OPEN_EXTERNAL, url)
  }

  return (
    <PanelWrapper panelId="calendar" title="Calendar">
      <div className="flex flex-col h-full" style={{ gap: 12 }}>
        {/* Month grid */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
              {monthName} {year}
            </span>
            {connected && (
              <span style={{ fontSize: 10, color: 'rgba(235,235,245,0.3)' }}>Google Calendar</span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
              <div key={d} style={{ fontSize: 11, color: 'rgba(235,235,245,0.3)', textAlign: 'center', padding: '2px 0' }}>
                {d}
              </div>
            ))}
            {cells.map((day, i) => {
              const isToday = day === today.getDate()
              const hasEvent = day ? eventDays.has(day) : false
              return (
                <div key={i} style={{
                  aspectRatio: '1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 6, fontSize: 12, position: 'relative',
                  background: isToday ? '#0A84FF' : 'transparent',
                  color: day ? (isToday ? '#fff' : 'rgba(235,235,245,0.8)') : 'transparent',
                  cursor: day ? 'default' : 'default',
                }}>
                  {day ?? ''}
                  {hasEvent && !isToday && (
                    <span style={{
                      position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)',
                      width: 4, height: 4, borderRadius: '50%', background: '#0A84FF',
                    }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Events list */}
        <div className="flex flex-col flex-1" style={{ minHeight: 0 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(235,235,245,0.4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Upcoming
          </p>

          {!connected && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: 'rgba(235,235,245,0.3)', fontSize: 12 }}>
              Connect Google Calendar in Integrations ↙
            </div>
          )}

          {connected && loading && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: 'rgba(235,235,245,0.3)', fontSize: 12 }}>
              Loading events…
            </div>
          )}

          {connected && error && (
            <div style={{
              fontSize: 11, color: '#FF453A', background: 'rgba(255,69,58,0.1)',
              borderRadius: 6, padding: '6px 8px',
            }}>
              {error}
            </div>
          )}

          {connected && !loading && !error && events.length === 0 && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: 'rgba(235,235,245,0.3)', fontSize: 12 }}>
              No upcoming events
            </div>
          )}

          <div className="flex flex-col gap-1.5 overflow-y-auto flex-1" style={{ minHeight: 0 }}>
            {events.map(event => (
              <EventCard key={event.id} event={event} onOpen={handleOpen} />
            ))}
          </div>
        </div>
      </div>
    </PanelWrapper>
  )
}
