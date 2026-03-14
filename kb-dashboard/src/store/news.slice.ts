import { StateCreator } from 'zustand'
import { NewsItem } from '@shared/ipc-channels'

export interface NewsSlice {
  newsItems: NewsItem[]
  newsLoading: boolean
  setNews: (items: NewsItem[]) => void
  setNewsLoading: (loading: boolean) => void
}

export const createNewsSlice: StateCreator<NewsSlice> = (set) => ({
  newsItems: [],
  newsLoading: false,
  setNews: (newsItems) => set({ newsItems }),
  setNewsLoading: (newsLoading) => set({ newsLoading })
})
