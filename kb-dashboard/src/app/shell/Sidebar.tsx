import React, { useEffect, useState } from 'react'
import { useStore } from '@/store'
import { useIPC } from '@/hooks/useIPC'
import { IPC, IntegrationStatus, IntegrationConfig } from '@shared/ipc-channels'
import { PANEL_REGISTRY } from '@/panels/registry'

const ICONS: Record<string, string> = {
  grid: '⊞',
  book: '📖',
  timer: '⏱',
  flask: '🔬',
  mail: '✉'
}

// ---- Integrations Modal ----

function IntegrationsModal({ onClose }: { onClose: () => void }) {
  const { invoke } = useIPC()
  const status = useStore(s => s.integrationStatus)
  const config = useStore(s => s.integrationConfig)
  const setStatus = useStore(s => s.setIntegrationStatus)
  const setConfig = useStore(s => s.setIntegrationConfig)

  // Google form state
  const [gClientId, setGClientId] = useState(config.google?.clientId ?? '')
  const [gClientSecret, setGClientSecret] = useState(config.google?.clientSecret ?? '')
  const [gConnecting, setGConnecting] = useState(false)
  const [gError, setGError] = useState<string | null>(null)

  // Microsoft form state
  const [mClientId, setMClientId] = useState(config.microsoft?.clientId ?? '')
  const [mConnecting, setMConnecting] = useState(false)
  const [mError, setMError] = useState<string | null>(null)

  async function saveAndConnectGoogle() {
    if (!gClientId.trim() || !gClientSecret.trim()) {
      setGError('Both Client ID and Client Secret are required')
      return
    }
    setGConnecting(true)
    setGError(null)
    try {
      await invoke(IPC.INTEGRATION_SET_CONFIG, {
        provider: 'google', clientId: gClientId.trim(), clientSecret: gClientSecret.trim()
      })
      setConfig({ ...config, google: { clientId: gClientId.trim(), clientSecret: gClientSecret.trim() } })
      await invoke(IPC.INTEGRATION_CONNECT_GOOGLE)
      const s = await invoke<IntegrationStatus>(IPC.INTEGRATION_STATUS)
      setStatus(s)
    } catch (err) {
      setGError((err as Error).message)
    } finally {
      setGConnecting(false)
    }
  }

  async function disconnectGoogle() {
    await invoke(IPC.INTEGRATION_DISCONNECT, 'google')
    const s = await invoke<IntegrationStatus>(IPC.INTEGRATION_STATUS)
    setStatus(s)
  }

  async function saveAndConnectMicrosoft() {
    if (!mClientId.trim()) {
      setMError('Client ID is required')
      return
    }
    setMConnecting(true)
    setMError(null)
    try {
      await invoke(IPC.INTEGRATION_SET_CONFIG, { provider: 'microsoft', clientId: mClientId.trim() })
      setConfig({ ...config, microsoft: { clientId: mClientId.trim() } })
      await invoke(IPC.INTEGRATION_CONNECT_MICROSOFT)
      const s = await invoke<IntegrationStatus>(IPC.INTEGRATION_STATUS)
      setStatus(s)
    } catch (err) {
      setMError((err as Error).message)
    } finally {
      setMConnecting(false)
    }
  }

  async function disconnectMicrosoft() {
    await invoke(IPC.INTEGRATION_DISCONNECT, 'microsoft')
    const s = await invoke<IntegrationStatus>(IPC.INTEGRATION_STATUS)
    setStatus(s)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(28,28,30,0.7)', backdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#2C2C2E', borderRadius: 16, padding: 24,
          width: 380, border: '1px solid rgba(255,255,255,0.08)',
          maxHeight: '80vh', overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ fontSize: 17, fontWeight: 600, color: '#fff', margin: '0 0 20px' }}>
          Integrations
        </h2>

        {/* Google */}
        <section style={{ marginBottom: 24 }}>
          <div className="flex items-center gap-2 mb-3">
            <span style={{ fontSize: 20 }}>🔵</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>Google</span>
            {status.google && (
              <span style={{
                marginLeft: 'auto', fontSize: 11, color: '#32D74B',
                background: 'rgba(50,215,75,0.1)', borderRadius: 6, padding: '2px 8px',
              }}>
                Connected
              </span>
            )}
          </div>
          <p style={{ fontSize: 11, color: 'rgba(235,235,245,0.4)', margin: '0 0 12px', lineHeight: 1.5 }}>
            Enables Google Calendar and Google Docs panels. Register a{' '}
            <span style={{ color: '#0A84FF' }}>Desktop application</span> in{' '}
            Google Cloud Console → APIs & Services → Credentials.
          </p>

          {!status.google ? (
            <div className="flex flex-col gap-2">
              <input
                placeholder="Client ID (ends with .apps.googleusercontent.com)"
                value={gClientId}
                onChange={e => setGClientId(e.target.value)}
                style={inputStyle}
              />
              <input
                type="password"
                placeholder="Client Secret"
                value={gClientSecret}
                onChange={e => setGClientSecret(e.target.value)}
                style={inputStyle}
              />
              {gError && (
                <p style={{ fontSize: 11, color: '#FF453A', margin: 0 }}>{gError}</p>
              )}
              <button
                onClick={saveAndConnectGoogle}
                disabled={gConnecting}
                style={{ ...btnStyle('#0A84FF'), opacity: gConnecting ? 0.5 : 1 }}
              >
                {gConnecting ? 'Opening browser…' : 'Save & Connect'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 12, color: 'rgba(235,235,245,0.5)', flex: 1 }}>
                Calendar + Docs access granted
              </span>
              <button onClick={disconnectGoogle} style={btnStyle('rgba(255,69,58,0.2)')}>
                Disconnect
              </button>
            </div>
          )}
        </section>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 0 24px' }} />

        {/* Microsoft / Outlook */}
        <section style={{ marginBottom: 8 }}>
          <div className="flex items-center gap-2 mb-3">
            <span style={{ fontSize: 20 }}>🟦</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>Microsoft</span>
            {status.microsoft && (
              <span style={{
                marginLeft: 'auto', fontSize: 11, color: '#32D74B',
                background: 'rgba(50,215,75,0.1)', borderRadius: 6, padding: '2px 8px',
              }}>
                Connected
              </span>
            )}
          </div>
          <p style={{ fontSize: 11, color: 'rgba(235,235,245,0.4)', margin: '0 0 12px', lineHeight: 1.5 }}>
            Enables Outlook email panel. Register an app in{' '}
            <span style={{ color: '#0A84FF' }}>Azure Portal</span> → App registrations.
            Set platform to <em>Mobile and desktop applications</em> with redirect{' '}
            <code style={{ fontSize: 10, background: 'rgba(255,255,255,0.08)', padding: '1px 4px', borderRadius: 3 }}>
              http://localhost
            </code>.
            No Client Secret needed.
          </p>

          {!status.microsoft ? (
            <div className="flex flex-col gap-2">
              <input
                placeholder="Application (Client) ID"
                value={mClientId}
                onChange={e => setMClientId(e.target.value)}
                style={inputStyle}
              />
              {mError && (
                <p style={{ fontSize: 11, color: '#FF453A', margin: 0 }}>{mError}</p>
              )}
              <button
                onClick={saveAndConnectMicrosoft}
                disabled={mConnecting}
                style={{ ...btnStyle('#0078D4'), opacity: mConnecting ? 0.5 : 1 }}
              >
                {mConnecting ? 'Opening browser…' : 'Save & Connect'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 12, color: 'rgba(235,235,245,0.5)', flex: 1 }}>
                Outlook mail access granted
              </span>
              <button onClick={disconnectMicrosoft} style={btnStyle('rgba(255,69,58,0.2)')}>
                Disconnect
              </button>
            </div>
          )}
        </section>

        <button
          onClick={onClose}
          style={{
            marginTop: 20, width: '100%', padding: '8px',
            background: 'rgba(255,255,255,0.08)', border: 'none',
            borderRadius: 8, color: '#fff', fontSize: 14, cursor: 'pointer',
          }}
        >
          Done
        </button>
      </div>
    </div>
  )
}

// ---- Sidebar ----

export function Sidebar() {
  const { invoke } = useIPC()
  const workspaces = useStore(s => s.workspaces)
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId)
  const setActiveWorkspace = useStore(s => s.setActiveWorkspace)
  const setPanelVisibility = useStore(s => s.setPanelVisibility)
  const getActiveWorkspace = useStore(s => s.getActiveWorkspace)
  const setIntegrationStatus = useStore(s => s.setIntegrationStatus)
  const setIntegrationConfig = useStore(s => s.setIntegrationConfig)
  const integrationStatus = useStore(s => s.integrationStatus)

  const [collapsed, setCollapsed] = useState(false)
  const [showCustomize, setShowCustomize] = useState(false)
  const [showIntegrations, setShowIntegrations] = useState(false)

  const activeWorkspace = getActiveWorkspace()

  // Load integration status + config on mount
  useEffect(() => {
    invoke<IntegrationStatus>(IPC.INTEGRATION_STATUS).then(setIntegrationStatus).catch(() => {})
    invoke<IntegrationConfig>(IPC.INTEGRATION_GET_CONFIG).then(setIntegrationConfig).catch(() => {})
  }, [])

  const connectedCount = [integrationStatus.google, integrationStatus.microsoft].filter(Boolean).length

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
                onClick={() => setActiveWorkspace(ws.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: 'calc(100% - 12px)',
                  padding: collapsed ? '8px 14px' : '8px 12px',
                  background: active ? 'rgba(10,132,255,0.15)' : 'transparent',
                  border: 'none',
                  borderRadius: 8,
                  margin: '1px 6px',
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
          {/* Integrations */}
          <button
            onClick={() => setShowIntegrations(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '7px 12px',
              background: 'transparent', border: 'none', borderRadius: 8,
              cursor: 'pointer', textAlign: 'left', position: 'relative',
            }}
          >
            <span style={{ fontSize: 16, position: 'relative' }}>
              🔗
              {connectedCount > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -4,
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#32D74B', border: '1.5px solid #1C1C1E',
                }} />
              )}
            </span>
            {!collapsed && (
              <span style={{ fontSize: 13, color: 'rgba(235,235,245,0.5)' }}>
                Integrations
              </span>
            )}
          </button>

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

      {/* Integrations modal */}
      {showIntegrations && (
        <IntegrationsModal onClose={() => setShowIntegrations(false)} />
      )}

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

// ---- Styles ----

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, color: '#fff', fontSize: 12,
  padding: '7px 10px', outline: 'none', width: '100%',
}

const btnStyle = (bg: string): React.CSSProperties => ({
  background: bg, border: 'none', borderRadius: 8,
  color: '#fff', padding: '7px 14px', fontSize: 13,
  fontWeight: 500, cursor: 'pointer', width: '100%',
})
