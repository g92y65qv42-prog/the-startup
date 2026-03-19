import React, { Suspense, useCallback, useRef } from 'react'
import GridLayout, { Layout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { useStore } from '@/store'
import { useIPC } from '@/hooks/useIPC'
import { IPC } from '@shared/ipc-channels'
import { PANEL_MAP, PANEL_REGISTRY } from '@/panels/registry'

const COLS = 12
const ROW_HEIGHT = 100
const MARGIN: [number, number] = [12, 12]

export function GridContainer({ width }: { width: number }) {
  const { invoke } = useIPC()
  const workspaces = useStore(s => s.workspaces)
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId)
  const updateLayouts = useStore(s => s.updateLayouts)
  const getActiveWorkspace = useStore(s => s.getActiveWorkspace)

  const activeWorkspace = getActiveWorkspace()
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleLayoutChange = useCallback((layout: Layout[]) => {
    updateLayouts(layout)
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => {
      invoke(IPC.LAYOUT_SAVE, activeWorkspaceId, layout)
    }, 500)
  }, [activeWorkspaceId, invoke, updateLayouts])

  if (!activeWorkspace) return null

  const { panelVisibility, panelLayouts } = activeWorkspace

  // Background-required panels that are hidden: stay mounted (CSS hidden) so state (timers, recording) continues
  const hiddenBackgroundPanels = PANEL_REGISTRY.filter(
    p => p.backgroundRequired && !panelVisibility[p.id]
  )

  // Build visible layouts; panels toggled back on that lost their entry get a default placement
  const layoutMap = new Map(panelLayouts.map(l => [l.i, l]))
  const visibleLayouts = PANEL_REGISTRY
    .filter(p => panelVisibility[p.id])
    .map(p => layoutMap.get(p.id) ?? { i: p.id, x: 0, y: Infinity, ...p.defaultLayout })

  return (
    <div style={{ position: 'relative', flex: 1, overflow: 'auto' }}>
      {/* Hidden background panels: always mounted out-of-flow so their state persists */}
      {hiddenBackgroundPanels.map(panel => {
        const PanelComponent = panel.component
        return (
          <div
            key={panel.id}
            style={{ display: 'none', position: 'absolute', pointerEvents: 'none' }}
            aria-hidden
          >
            <Suspense fallback={null}>
              <PanelComponent />
            </Suspense>
          </div>
        )
      })}

      {/* Main grid */}
      <GridLayout
        className="layout"
        layout={visibleLayouts}
        cols={COLS}
        rowHeight={ROW_HEIGHT}
        width={width}
        margin={MARGIN}
        containerPadding={[16, 16]}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".panel-drag-handle"
        resizeHandles={['se']}
        isResizable
        isDraggable
      >
        {visibleLayouts.map(l => {
          const panel = PANEL_MAP[l.i]
          if (!panel) return null
          const PanelComponent = panel.component

          return (
            <div key={l.i} data-panel-id={l.i}>
              <Suspense fallback={
                <div style={{
                  height: '100%', background: '#2C2C2E', borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(235,235,245,0.3)', fontSize: 13
                }}>
                  Loading…
                </div>
              }>
                <PanelComponent />
              </Suspense>
            </div>
          )
        })}
      </GridLayout>
    </div>
  )
}
