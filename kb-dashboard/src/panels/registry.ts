import { lazy } from 'react'
import { PanelDefinition } from './_base/panel.types'

export const PANEL_REGISTRY: PanelDefinition[] = [
  {
    id: 'tasks',
    displayName: 'Tasks',
    defaultLayout: { w: 4, h: 4 },
    minW: 2, minH: 2,
    backgroundRequired: false,
    component: lazy(() => import('./tasks'))
  },
  {
    id: 'calendar',
    displayName: 'Calendar',
    defaultLayout: { w: 5, h: 4 },
    minW: 3, minH: 3,
    backgroundRequired: false,
    component: lazy(() => import('./calendar'))
  },
  {
    id: 'deadlines',
    displayName: 'Deadlines',
    defaultLayout: { w: 3, h: 3 },
    minW: 2, minH: 2,
    backgroundRequired: false,
    component: lazy(() => import('./deadlines'))
  },
  {
    id: 'grades',
    displayName: 'Grades',
    defaultLayout: { w: 4, h: 4 },
    minW: 3, minH: 3,
    backgroundRequired: false,
    component: lazy(() => import('./grades'))
  },
  {
    id: 'pomodoro',
    displayName: 'Pomodoro',
    defaultLayout: { w: 3, h: 3 },
    minW: 2, minH: 2,
    backgroundRequired: true,
    component: lazy(() => import('./pomodoro'))
  },
  {
    id: 'science-news',
    displayName: 'Science News',
    defaultLayout: { w: 4, h: 4 },
    minW: 2, minH: 2,
    backgroundRequired: false,
    component: lazy(() => import('./science-news'))
  },
  {
    id: 'audio-transcription',
    displayName: 'Transcription',
    defaultLayout: { w: 4, h: 3 },
    minW: 3, minH: 2,
    backgroundRequired: true,
    component: lazy(() => import('./audio-transcription'))
  },
  {
    id: 'email',
    displayName: 'Email',
    defaultLayout: { w: 4, h: 3 },
    minW: 2, minH: 2,
    backgroundRequired: false,
    component: lazy(() => import('./email'))
  },
  {
    id: 'docs',
    displayName: 'Docs',
    defaultLayout: { w: 3, h: 3 },
    minW: 2, minH: 2,
    backgroundRequired: false,
    component: lazy(() => import('./docs'))
  }
]

export const PANEL_MAP = Object.fromEntries(PANEL_REGISTRY.map(p => [p.id, p]))
