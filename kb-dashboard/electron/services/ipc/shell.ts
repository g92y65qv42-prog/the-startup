import { ipcMain, shell } from 'electron'
import { IPC } from '../../../src/shared/ipc-channels'

export function registerShellIpc(): void {
  ipcMain.handle(IPC.OPEN_EXTERNAL, (_e, url: string) => {
    // Only allow http/https URLs to prevent arbitrary protocol execution
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
      throw new Error('Only http/https URLs are allowed')
    }
    shell.openExternal(url)
    return { ok: true }
  })
}
