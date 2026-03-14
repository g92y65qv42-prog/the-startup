import React from 'react'
import { PanelWrapper } from '../_base/PanelWrapper'

export default function DocsPanel() {
  return (
    <PanelWrapper panelId="docs" title="Docs">
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <div style={{ fontSize: 32 }}>📄</div>
        <p style={{ fontSize: 13, color: 'rgba(235,235,245,0.5)', textAlign: 'center' }}>
          Google Drive
        </p>
        <p style={{ fontSize: 12, color: 'rgba(235,235,245,0.3)', textAlign: 'center' }}>
          Drive integration coming in Phase 4
        </p>
      </div>
    </PanelWrapper>
  )
}
