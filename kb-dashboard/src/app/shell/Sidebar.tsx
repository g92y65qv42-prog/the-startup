import React, { useState } from 'react'
import { useStore } from '@/store'
import { useIPC } from '@/hooks/useIPC'
import { IPC } from '@shared/ipc-channels'
import { PANEL_REGISTRY } from '@/panels/registry'

const ICONS: Record<string, string> = {
  grid: '⊞',
  book: '📖',
  timer: '⏱',
  flask: '🔬',
  mail: '✉'
}

export function Sidebar() {
  const { invoke } = useIPC()
  const workspaces = useStore(s => s.workspaces)
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId)
  const setActiveWorkspace = useStore(s => s.setActiveWorkspace)
  const setPanelVisibility = useStore(s => s.setPanelVisibility)
  const getActiveWorkspace = useStore(s => s.getActiveWorkspace)
  const [collapsed, setCollapsed] = useState(false)
  const [showCustomize, setShowCustomize] = useState(false)

  const activeWorkspace = getActiveWorkspace()

  function handleWorkspaceClick(id: string) {
    setActiveWorkspace(id)
  }

  return (
    <>
      <div style={{
        width: collapsed ? 52 : 220,
        minWidth: collapsed ? 52 : 220,
        background: '#1C1C1E',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease, min-width 0.2s ease',
        overflow: 'hidden',
        flexShrink: 0
      }}>
        {/* Workspace list */}
        <div style={{ flex: 1, paddingTop: 8, overflowY: 'auto' }}>
          {workspaces.map(ws => {
            const active = ws.id === activeWorkspaceId
            return (
              <button
                key={ws.id}
                onClick={() => handleWorkspaceClick(ws.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: collapsed ? '8px 14px' : '8px 12px',
                  background: active ? 'rgba(10,132,255,0.15)' : 'transparent',
                  border: 'none',
                  borderRadius: 8,
                  margin: '1px 6px',
                  width: 'calc(100% - 12px)',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                  textAlign: 'left'
                }}
              >
                <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1 }}>
                  {ICONS[ws.icon] ?? '■'}
                </span>
                {!collapsed && (
                  <span style={{
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    color: active ? '#0A84FF' : 'rgba(235,235,245,0.8)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {ws.name}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Bottom actions */}
        <div style={{ padding: '8px 6px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <button
            onClick={() => setShowCustomize(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '7px 12px',
              background: 'transparent', border: 'none', borderRadius: 8,
              cursor: 'pointer', textAlign: 'left'
            }}
          >
            <span style={{ fontSize: 16 }}>⚙</span>
            {!collapsed && <span style={{ fontSize: 13, color: 'rgba(235,235,245,0.5)' }}>Customize</span>}
          </button>

          <button
            onClick={() => setCollapsed(c => !c)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '7px 12px',
              background: 'transparent', border: 'none', borderRadius: 8,
              cursor: 'pointer', textAlign: 'left'
            }}
          >
            <span style={{ fontSize: 14 }}>{collapsed ? '→' : '←'}</span>
            {!collapsed && <span style={{ fontSize: 13, color: 'rgba(235,235,245,0.5)' }}>Collapse</span>}
          </button>
        </div>
      </div>

      {/* Customize modal */}
      {showCustomize && activeWorkspace && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(28,28,30,0.7)',
            backdropFilter: 'blur(20px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          onClick={() => setShowCustomize(false)}
        >
          <div
            style={{
              background: '#2C2C2E', borderRadius: 16, padding: 24,
              width: 320, border: '1px solid rgba(255,255,255,0.08)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 17, fontWeight: 600, color: '#fff', margin: '0 0 16px' }}>
              Panels — {activeWorkspace.name}
            </h2>
            <div className="flex flex-col gap-2">
              {PANEL_REGISTRY.map(panel => {
                const visible = activeWorkspace.panelVisibility[panel.id] ?? false
                return (
                  <div key={panel.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 0'
                  }}>
                    <span style={{ fontSize: 14, color: '#fff' }}>{panel.displayName}</span>
                    <button
                      onClick={() => {
                        setPanelVisibility(panel.id, !visible)
                        const updated = { ...activeWorkspace, panelVisibility: { ...activeWorkspace.panelVisibility, [panel.id]: !visible } }
                        invoke(IPC.WORKSPACE_SAVE, updated)
                      }}
                      style={{
                        background: visible ? '#0A84FF' : 'rgba(255,255,255,0.1)',
                        border: 'none', borderRadius: 12,
                        width: 44, height: 24, cursor: 'pointer',
                        position: 'relative', transition: 'background 0.2s'
                      }}
                    >
                      <span style={{
                        position: 'absolute', top: 2,
                        left: visible ? 22 : 2,
                        width: 20, height: 20, borderRadius: '50%',
                        background: '#fff', transition: 'left 0.2s'
                      }} />
                    </button>
                  </div>
                )
              })}
            </div>
            <button
              onClick={() => setShowCustomize(false)}
              style={{
                marginTop: 20, width: '100%', padding: '8px',
                background: 'rgba(255,255,255,0.08)', border: 'none',
                borderRadius: 8, color: '#fff', fontSize: 14, cursor: 'pointer'
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  )
}
