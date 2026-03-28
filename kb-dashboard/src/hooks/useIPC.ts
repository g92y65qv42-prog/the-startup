import { IpcChannel } from '@shared/ipc-channels'

declare global {
  interface Window {
    electronAPI: {
      invoke: <T = unknown>(channel: IpcChannel, ...args: unknown[]) => Promise<T>
    }
  }
}

export function useIPC() {
  return {
    invoke: <T = unknown>(channel: IpcChannel, ...args: unknown[]): Promise<T> => {
      return window.electronAPI.invoke<T>(channel, ...args)
    }
  }
}
