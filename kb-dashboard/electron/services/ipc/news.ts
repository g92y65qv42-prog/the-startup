import { ipcMain } from 'electron'
import { randomUUID, createHash } from 'crypto'
import { get as httpsGet } from 'https'
import { get as httpGet } from 'http'
import { getDb } from '../db'
import { IPC, NewsItem, NewsFeed } from '../../../src/shared/ipc-channels'

const DEFAULT_FEEDS: Array<{ url: string; label: string }> = [
  { url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss', label: 'NASA' },
  { url: 'https://rss.arxiv.org/rss/cs.AI', label: 'arXiv cs.AI' },
  { url: 'https://rss.arxiv.org/rss/physics', label: 'arXiv Physics' },
  { url: 'https://feeds.arstechnica.com/arstechnica/science', label: 'Ars Technica Science' },
]

// ---- HTTP fetch ----

function fetchUrl(url: string, redirects = 5): Promise<string> {
  return new Promise((resolve, reject) => {
    if (redirects <= 0) { reject(new Error('Too many redirects')); return }
    const fn = url.startsWith('https') ? httpsGet : httpGet
    const req = fn(url, { headers: { 'User-Agent': 'KB-Dashboard/1.0' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location, redirects - 1).then(resolve).catch(reject)
        return
      }
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('timeout')) })
  })
}

// ---- XML parser ----

function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
}

function getTagText(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const m = xml.match(re)
  if (!m) return null
  return decodeEntities(stripCdata(m[1]).replace(/<[^>]+>/g, '').trim()) || null
}

function getLink(block: string): string | null {
  // Atom: <link href="..." /> or <link rel="alternate" href="..." />
  const atomHref = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i)
  if (atomHref) return atomHref[1]
  // RSS 2.0: <link>url</link> — content between tags, may be URL or empty
  const rssLink = block.match(/<link[^>]*>([^<\s][^<]*)<\/link>/i)
  if (rssLink) return rssLink[1].trim()
  return null
}

interface ParsedItem {
  title: string | null
  summary: string | null
  url: string | null
  publishedAt: string | null
  source: string
}

function parseFeed(xml: string, source: string): ParsedItem[] {
  const isAtom = /<feed[\s>]/i.test(xml)
  const tag = isAtom ? 'entry' : 'item'
  const re = new RegExp(`<${tag}[\\s>][\\s\\S]*?<\\/${tag}>`, 'gi')
  const results: ParsedItem[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null && results.length < 20) {
    const block = m[0]
    const title = getTagText(block, 'title')
    const rawSummary = getTagText(block, isAtom ? 'summary' : 'description') ??
      getTagText(block, 'content')
    const summary = rawSummary ? rawSummary.slice(0, 300) : null
    const url = getLink(block)
    const publishedAt = isAtom
      ? (getTagText(block, 'published') ?? getTagText(block, 'updated'))
      : getTagText(block, 'pubDate')
    results.push({ title, summary, url, publishedAt, source })
  }
  return results
}

function stableId(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 40)
}

// ---- IPC registration ----

export function registerNewsIpc(): void {
  const db = getDb()

  // Seed default feeds once
  const feedCount = (db.prepare('SELECT COUNT(*) as n FROM news_feeds').get() as { n: number }).n
  if (feedCount === 0) {
    const now = new Date().toISOString()
    const insert = db.prepare(
      'INSERT OR IGNORE INTO news_feeds (id, url, label, enabled, created_at) VALUES (?, ?, ?, 1, ?)'
    )
    for (const f of DEFAULT_FEEDS) {
      insert.run(randomUUID(), f.url, f.label, now)
    }
  }

  ipcMain.handle(IPC.NEWS_LIST, (): NewsItem[] => {
    const rows = db
      .prepare('SELECT * FROM news_items ORDER BY published_at DESC, fetched_at DESC LIMIT 60')
      .all() as Record<string, unknown>[]
    return rows.map(r => ({
      id: r.id as string,
      title: r.title as string,
      summary: r.summary as string | null,
      url: r.url as string | null,
      source: r.source as string | null,
      publishedAt: r.published_at as string | null,
      fetchedAt: r.fetched_at as string,
    }))
  })

  ipcMain.handle(IPC.NEWS_FEEDS_LIST, (): NewsFeed[] => {
    const rows = db.prepare('SELECT * FROM news_feeds ORDER BY created_at ASC').all() as Record<string, unknown>[]
    return rows.map(r => ({
      id: r.id as string,
      url: r.url as string,
      label: r.label as string | null,
      enabled: Boolean(r.enabled),
    }))
  })

  ipcMain.handle(IPC.NEWS_FEED_ADD, (_e, data: { url: string; label?: string }): NewsFeed => {
    const now = new Date().toISOString()
    const id = randomUUID()
    db.prepare(
      'INSERT INTO news_feeds (id, url, label, enabled, created_at) VALUES (?, ?, ?, 1, ?)'
    ).run(id, data.url.trim(), data.label?.trim() || null, now)
    return { id, url: data.url.trim(), label: data.label?.trim() || null, enabled: true }
  })

  ipcMain.handle(IPC.NEWS_FEED_REMOVE, (_e, id: string) => {
    const feed = db.prepare('SELECT label FROM news_feeds WHERE id = ?').get(id) as { label: string | null } | undefined
    db.prepare('DELETE FROM news_feeds WHERE id = ?').run(id)
    if (feed?.label) {
      db.prepare('DELETE FROM news_items WHERE source = ?').run(feed.label)
    }
    return { ok: true }
  })

  ipcMain.handle(IPC.NEWS_REFRESH, async (): Promise<{ count: number; errors: string[] }> => {
    const feeds = db
      .prepare('SELECT * FROM news_feeds WHERE enabled = 1')
      .all() as Array<{ url: string; label: string | null }>

    // Resolve effective source label (never null — fall back to hostname)
    const feedsWithSource = feeds.map(f => ({
      url: f.url,
      source: f.label ?? (() => { try { return new URL(f.url).hostname } catch { return f.url } })(),
    }))

    // Remove cached articles from feeds that are no longer active
    const activeSources = feedsWithSource.map(f => f.source)
    if (activeSources.length > 0) {
      const placeholders = activeSources.map(() => '?').join(', ')
      db.prepare(`DELETE FROM news_items WHERE source NOT IN (${placeholders})`).run(...activeSources)
    } else {
      db.prepare('DELETE FROM news_items').run()
    }

    const now = new Date().toISOString()
    const upsert = db.prepare(`
      INSERT OR REPLACE INTO news_items (id, title, summary, url, source, published_at, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    let count = 0
    const errors: string[] = []

    await Promise.allSettled(
      feedsWithSource.map(async feed => {
        try {
          const xml = await fetchUrl(feed.url)
          const items = parseFeed(xml, feed.source)
          for (const item of items) {
            if (!item.title || !item.url) continue
            upsert.run(stableId(item.url), item.title, item.summary, item.url, item.source, item.publishedAt, now)
            count++
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error(`[news] Failed to fetch ${feed.url}:`, msg)
          errors.push(`${feed.source}: ${msg}`)
        }
      })
    )
    return { count, errors }
  })
}
