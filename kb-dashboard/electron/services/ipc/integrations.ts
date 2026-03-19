import { ipcMain } from 'electron'
import { IPC, IntegrationConfig, IntegrationStatus } from '../../../src/shared/ipc-channels'
import {
  getGoogleConfig, saveGoogleConfig,
  isGoogleConnected, connectGoogle, disconnectGoogle,
  listCalendarEvents, listDocs,
} from '../integrations/google'
import {
  getMicrosoftConfig, saveMicrosoftConfig,
  isMicrosoftConnected, connectMicrosoft, disconnectMicrosoft,
  listOutlookMessages,
} from '../integrations/microsoft'

export function registerIntegrationsIpc(): void {
  // Status: are providers connected?
  ipcMain.handle(IPC.INTEGRATION_STATUS, async (): Promise<IntegrationStatus> => ({
    google: await isGoogleConnected(),
    microsoft: await isMicrosoftConnected(),
  }))

  // Get stored Client ID config (safe to expose — not secret tokens)
  ipcMain.handle(IPC.INTEGRATION_GET_CONFIG, (): IntegrationConfig => {
    const google = getGoogleConfig()
    const microsoft = getMicrosoftConfig()
    return { google, microsoft }
  })

  // Save Client ID / Secret (before connecting)
  ipcMain.handle(
    IPC.INTEGRATION_SET_CONFIG,
    (_e, data: { provider: 'google' | 'microsoft'; clientId: string; clientSecret?: string }) => {
      if (data.provider === 'google') {
        saveGoogleConfig(data.clientId, data.clientSecret ?? '')
      } else {
        saveMicrosoftConfig(data.clientId)
      }
      return { ok: true }
    }
  )

  // OAuth flows — open system browser, complete PKCE, store tokens
  ipcMain.handle(IPC.INTEGRATION_CONNECT_GOOGLE, async () => {
    await connectGoogle()
    return { ok: true }
  })

  ipcMain.handle(IPC.INTEGRATION_CONNECT_MICROSOFT, async () => {
    await connectMicrosoft()
    return { ok: true }
  })

  // Disconnect: wipe tokens from Keychain
  ipcMain.handle(
    IPC.INTEGRATION_DISCONNECT,
    async (_e, provider: 'google' | 'microsoft') => {
      if (provider === 'google') await disconnectGoogle()
      else await disconnectMicrosoft()
      return { ok: true }
    }
  )

  // Data endpoints
  ipcMain.handle(IPC.GOOGLE_CALENDAR_LIST, async () => listCalendarEvents())
  ipcMain.handle(IPC.GOOGLE_DOCS_LIST, async () => listDocs())
  ipcMain.handle(IPC.OUTLOOK_MESSAGES_LIST, async () => listOutlookMessages())
}
