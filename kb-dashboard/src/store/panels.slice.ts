import { StateCreator } from 'zustand'
import { Layout } from 'react-grid-layout'
import { Workspace } from '@shared/ipc-channels'

export interface PanelsSlice {
  workspaces: Workspace[]
  activeWorkspaceId: string
  setWorkspaces: (ws: Workspace[]) => void
  setActiveWorkspace: (id: string) => void
  updateLayouts: (layouts: Layout[]) => void
  setPanelVisibility: (panelId: string, visible: boolean) => void
  getActiveWorkspace: () => Workspace | undefined
}

export const createPanelsSlice: StateCreator<PanelsSlice> = (set, get) => ({
  workspaces: [],
  activeWorkspaceId: 'overview',

  setWorkspaces: (workspaces) => set({ workspaces }),

  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

  updateLayouts: (layouts) => {
    const { workspaces, activeWorkspaceId } = get()
    const updated = workspaces.map(ws =>
      ws.id === activeWorkspaceId
        ? { ...ws, panelLayouts: layouts.map(l => ({ i: l.i, x: l.x, y: l.y, w: l.w, h: l.h })) }
        : ws
    )
    set({ workspaces: updated })
  },

  setPanelVisibility: (panelId, visible) => {
    const { workspaces, activeWorkspaceId } = get()
    const updated = workspaces.map(ws =>
      ws.id === activeWorkspaceId
        ? { ...ws, panelVisibility: { ...ws.panelVisibility, [panelId]: visible } }
        : ws
    )
    set({ workspaces: updated })
  },

  getActiveWorkspace: () => {
    const { workspaces, activeWorkspaceId } = get()
    return workspaces.find(ws => ws.id === activeWorkspaceId)
  }
})
