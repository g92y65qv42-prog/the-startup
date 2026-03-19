import { StateCreator } from 'zustand'
import { NewsItem, NewsFeed } from '@shared/ipc-channels'

export interface NewsSlice {
  newsItems: NewsItem[]
  newsFeeds: NewsFeed[]
  setNewsItems: (items: NewsItem[]) => void
  setNewsFeeds: (feeds: NewsFeed[]) => void
  addNewsFeed: (feed: NewsFeed) => void
  removeNewsFeed: (id: string) => void
}

export const createNewsSlice: StateCreator<NewsSlice> = (set) => ({
  newsItems: [],
  newsFeeds: [],
  setNewsItems: (newsItems) => set({ newsItems }),
  setNewsFeeds: (newsFeeds) => set({ newsFeeds }),
  addNewsFeed: (feed) => set(s => ({ newsFeeds: [...s.newsFeeds, feed] })),
  removeNewsFeed: (id) => set(s => ({ newsFeeds: s.newsFeeds.filter(f => f.id !== id) })),
})
