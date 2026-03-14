import { StateCreator } from 'zustand'
import { Task } from '@shared/ipc-channels'

export interface TasksSlice {
  tasks: Task[]
  setTasks: (tasks: Task[]) => void
  upsertTask: (task: Task) => void
  removeTask: (id: string) => void
}

export const createTasksSlice: StateCreator<TasksSlice> = (set) => ({
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  upsertTask: (task) =>
    set((s) => ({
      tasks: s.tasks.some(t => t.id === task.id)
        ? s.tasks.map(t => t.id === task.id ? task : t)
        : [task, ...s.tasks]
    })),
  removeTask: (id) => set((s) => ({ tasks: s.tasks.filter(t => t.id !== id) }))
})
