import React from 'react'
import { useStore } from '@/store'

interface Props {
  panelId: string
  title: string
  children: React.ReactNode
  className?: string
}

export function PanelWrapper({ panelId, title, children, className = '' }: Props) {
  const setPanelVisibility = useStore(s => s.setPanelVisibility)

  return (
    <div
      className={`panel-wrapper flex flex-col h-full rounded-[12px] overflow-hidden ${className}`}
      style={{
        background: '#2C2C2E',
        border: '1px solid rgba(255,255,255,0.06)'
      }}
    >
      {/* Drag handle / title bar */}
      <div
        className="panel-drag-handle flex items-center justify-between px-3 shrink-0"
        style={{
          height: 36,
          cursor: 'grab',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          userSelect: 'none'
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'rgba(235,235,245,0.6)',
            letterSpacing: '0.01em'
          }}
        >
          {title}
        </span>

        <button
          className="panel-hide-btn opacity-0 hover:opacity-100 transition-opacity"
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(235,235,245,0.4)',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            padding: '0 2px',
            borderRadius: 4
          }}
          onClick={() => setPanelVisibility(panelId, false)}
          title="Hide panel"
        >
          ×
        </button>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-auto p-3">
        {children}
      </div>
    </div>
  )
}
