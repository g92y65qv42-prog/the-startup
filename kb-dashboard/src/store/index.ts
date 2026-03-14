import { create } from 'zustand'
import { createPanelsSlice, PanelsSlice } from './panels.slice'
import { createTasksSlice, TasksSlice } from './tasks.slice'
import { createPomodoroSlice, PomodoroSlice } from './pomodoro.slice'
import { createGradesSlice, GradesSlice } from './grades.slice'

export type AppStore = PanelsSlice & TasksSlice & PomodoroSlice & GradesSlice

export const useStore = create<AppStore>()((...a) => ({
  ...createPanelsSlice(...a),
  ...createTasksSlice(...a),
  ...createPomodoroSlice(...a),
  ...createGradesSlice(...a)
}))
