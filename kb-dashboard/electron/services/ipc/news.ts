import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import Parser from 'rss-parser'
import { getDb } from '../db'
import { IPC, NewsItem } from '../../../src/shared/ipc-channels'

const parser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': 'KB-Dashboard/1.0' }
})

const DEFAULT_FEEDS: Array<{ url: string; label: string }> = [
  { url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss', label: 'NASA' },
  { url: 'https://export.arxiv.org/rss/cs.AI', label: 'arXiv cs.AI' },
  { url: 'https://export.arxiv.org/rss/physics', label: 'arXiv Physics' },
  { url: 'https://www.nature.com/nature.rss', label: 'Nature' },
  { url: 'https://feeds.arstechnica.com/arstechnica/science', label: 'Ars Technica Science' }
]

const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

function rowToNewsItem(r: Record<string, unknown>): NewsItem {
  return {
    id: r.id as string,
    title: r.title as string,
    summary: r.summary as string | null,
    url: r.url as string | null,
    source: r.source as string | null,
    publishedAt: r.published_at as string | null,
    fetchedAt: r.fetched_at as string
  }
}

async function fetchAndCacheFeed(db: ReturnType<typeof getDb>, feed: { url: string; label: string }): Promise<void> {
  try {
    const result = await parser.parseURL(feed.url)
    const now = new Date().toISOString()

    const insert = db.prepare(`
      INSERT OR REPLACE INTO news_items (id, title, summary, url, source, published_at, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    const insertMany = db.transaction((items: typeof result.items) => {
      for (const item of items) {
        const title = item.title?.trim()
        if (!title) continue
        const summary = item.contentSnippet?.trim() || item.summary?.trim() || null
        const url = item.link?.trim() || null
        const publishedAt = item.pubDate ? new Date(item.pubDate).toISOString() : item.isoDate || null
        const id = url ?? `${feed.label}:${title}`
        insert.run(id, title, summary, url, feed.label, publishedAt, now)
      }
    })

    insertMany(result.items)
  } catch (err) {
    console.warn(`[news] Failed to fetch ${feed.label}:`, (err as Error).message)
  }
}

async function refreshFeeds(db: ReturnType<typeof getDb>): Promise<void> {
  await Promise.allSettled(DEFAULT_FEEDS.map(feed => fetchAndCacheFeed(db, feed)))
}

export function registerNewsIpc(): void {
  const db = getDb()

  ipcMain.handle(IPC.NEWS_LIST, (): NewsItem[] => {
    const rows = db.prepare(`
      SELECT * FROM news_items
      ORDER BY COALESCE(published_at, fetched_at) DESC
      LIMIT 100
    `).all() as Record<string, unknown>[]
    return rows.map(rowToNewsItem)
  })

  ipcMain.handle(IPC.NEWS_REFRESH, async (): Promise<{ count: number }> => {
    await refreshFeeds(db)
    const row = db.prepare('SELECT COUNT(*) as count FROM news_items').get() as { count: number }
    return { count: row.count }
  })

  // Auto-refresh stale cache on startup
  const newest = db.prepare('SELECT fetched_at FROM news_items ORDER BY fetched_at DESC LIMIT 1').get() as
    | { fetched_at: string }
    | undefined

  const stale = !newest || Date.now() - new Date(newest.fetched_at).getTime() > CACHE_TTL_MS
  if (stale) {
    refreshFeeds(db).catch(() => {})
  }
}
