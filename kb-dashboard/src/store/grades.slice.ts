import { StateCreator } from 'zustand'
import { Grade } from '@shared/ipc-channels'

export interface GradesSlice {
  grades: Grade[]
  setGrades: (grades: Grade[]) => void
  upsertGrade: (grade: Grade) => void
  removeGrade: (id: string) => void
}

export const createGradesSlice: StateCreator<GradesSlice> = (set) => ({
  grades: [],
  setGrades: (grades) => set({ grades }),
  upsertGrade: (grade) =>
    set((s) => ({
      grades: s.grades.some(g => g.id === grade.id)
        ? s.grades.map(g => g.id === grade.id ? grade : g)
        : [...s.grades, grade]
    })),
  removeGrade: (id) => set((s) => ({ grades: s.grades.filter(g => g.id !== id) }))
})
