import React from 'react'
import { PanelWrapper } from '../_base/PanelWrapper'

export default function ScienceNewsPanel() {
  return (
    <PanelWrapper panelId="science-news" title="Science News">
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <div style={{ fontSize: 32 }}>🔭</div>
        <p style={{ fontSize: 13, color: 'rgba(235,235,245,0.5)', textAlign: 'center' }}>
          Science news feed
        </p>
        <p style={{ fontSize: 12, color: 'rgba(235,235,245,0.3)', textAlign: 'center' }}>
          RSS aggregation coming in Phase 2
        </p>
      </div>
    </PanelWrapper>
  )
}
