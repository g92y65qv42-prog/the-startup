import { LazyExoticComponent, ComponentType } from 'react'

export interface PanelDefinition {
  id: string
  displayName: string
  defaultLayout: { w: number; h: number }
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
  backgroundRequired: boolean
  component: LazyExoticComponent<ComponentType>
}
