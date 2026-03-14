import React from 'react'
import { PanelWrapper } from '../_base/PanelWrapper'

export default function EmailPanel() {
  return (
    <PanelWrapper panelId="email" title="Email">
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <div style={{ fontSize: 32 }}>✉️</div>
        <p style={{ fontSize: 13, color: 'rgba(235,235,245,0.5)', textAlign: 'center' }}>
          Gmail integration
        </p>
        <p style={{ fontSize: 12, color: 'rgba(235,235,245,0.3)', textAlign: 'center' }}>
          Google OAuth coming in Phase 4
        </p>
      </div>
    </PanelWrapper>
  )
}
