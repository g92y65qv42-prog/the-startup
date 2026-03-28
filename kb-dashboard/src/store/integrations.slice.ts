import { StateCreator } from 'zustand'
import { IntegrationStatus, IntegrationConfig } from '@shared/ipc-channels'

export interface IntegrationsSlice {
  integrationStatus: IntegrationStatus
  integrationConfig: IntegrationConfig
  setIntegrationStatus: (status: IntegrationStatus) => void
  setIntegrationConfig: (config: IntegrationConfig) => void
}

export const createIntegrationsSlice: StateCreator<IntegrationsSlice> = (set) => ({
  integrationStatus: { google: false, microsoft: false },
  integrationConfig: { google: null, microsoft: null },
  setIntegrationStatus: (integrationStatus) => set({ integrationStatus }),
  setIntegrationConfig: (integrationConfig) => set({ integrationConfig }),
})
