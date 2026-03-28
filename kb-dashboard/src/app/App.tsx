import React, { useEffect, useRef, useState } from 'react'
import { TopBar } from './shell/TopBar'
import { Sidebar } from './shell/Sidebar'
import { GridContainer } from './shell/GridContainer'
import { useStore } from '@/store'
import { useIPC } from '@/hooks/useIPC'
import { IPC, Workspace } from '@shared/ipc-channels'

export function App() {
  const { invoke } = useIPC()
  const setWorkspaces = useStore(s => s.setWorkspaces)
  const gridAreaRef = useRef<HTMLDivElement>(null)
  const [gridWidth, setGridWidth] = useState(1000)

  // Load workspaces on mount
  useEffect(() => {
    invoke<Workspace[]>(IPC.WORKSPACE_LIST).then(ws => {
      setWorkspaces(ws)
    })
  }, [])

  // Track grid area width for react-grid-layout
  useEffect(() => {
    if (!gridAreaRef.current) return
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setGridWidth(entry.contentRect.width)
      }
    })
    observer.observe(gridAreaRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#1C1C1E',
      color: '#fff',
      fontFamily: '"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif',
      overflow: 'hidden'
    }}>
      <TopBar />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />

        <div ref={gridAreaRef} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <GridContainer width={gridWidth} />
        </div>
      </div>
    </div>
  )
}
