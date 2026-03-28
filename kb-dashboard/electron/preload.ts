import { contextBridge, ipcRenderer } from 'electron'
import { IPC, IpcChannel } from '../src/shared/ipc-channels'

// Typed IPC bridge exposed to renderer as window.electronAPI
const api = {
  invoke: <T = unknown>(channel: IpcChannel, ...args: unknown[]): Promise<T> => {
    const allowed = Object.values(IPC) as string[]
    if (!allowed.includes(channel)) {
      throw new Error(`IPC channel "${channel}" is not whitelisted`)
    }
    return ipcRenderer.invoke(channel, ...args)
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type ElectronAPI = typeof api
