import React from 'react'

export function TopBar() {
  return (
    <div
      style={{
        height: 44,
        background: '#1C1C1E',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 80, // leave room for traffic lights
        paddingRight: 16,
        WebkitAppRegion: 'drag' as never,
        flexShrink: 0,
        zIndex: 10
      }}
    >
      <span style={{
        fontSize: 13,
        fontWeight: 600,
        color: 'rgba(235,235,245,0.5)',
        letterSpacing: '0.02em',
        WebkitAppRegion: 'drag' as never
      }}>
        KB Dashboard
      </span>
    </div>
  )
}
