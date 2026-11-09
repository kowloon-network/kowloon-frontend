// PageDetailPage — single server page view.

import { useParams, Link } from 'react-router-dom'
import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Tag, BookOpen } from 'lucide-react'
import { useClient } from '../hooks/useClient'
import UserAvatar from '../components/ui/UserAvatar'
import Timestamp from '../components/ui/Timestamp'
import Spinner from '../components/ui/Spinner'
import ErrorState from '../components/ui/ErrorState'
import SafeHtml from '../components/ui/SafeHtml'

const MOCK_PAGE = {
  id: 'page:about@kwln.org',
  type: 'Page',
  title: 'About This Server',
  slug: 'about',
  summary: 'Who we are, what we do, and why we do it.',
  body: `<p>This server is a home for people who care about design, music, writing, and the pleasures of a well-made thing. We run on <a href="https://github.com/jzellis/kowloon">Kowloon</a>, an open-source federated social platform.</p>
<h2>What We Are</h2>
<p>A small, intentional community. We are not trying to be large. We are trying to be good.</p>
<h2>What We Believe</h2>
<p>That the internet was better when it was made of individual, idiosyncratic places. That you should own your words. That slow is fine.</p>`,
  tags: ['meta', 'community'],
  image: null,
  wordCount: 72,
  actor: { name: 'Server Admin', id: 'user:admin@kwln.org' },
  createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
  updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
}

export default function PageDetailPage() {
  const { id } = useParams()
  const { t } = useTranslation()
  const client = useClient()

  const [page, setPage]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  const load = useCallback(async () => {
    if (!client) {
      setPage(MOCK_PAGE)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await client.feeds.getPage({ pageId: decodeURIComponent(id) })
      setPage(res?.item ?? res)
    } catch (err) {
      setError(err.message || 'Failed to load page.')
    } finally {
      setLoading(false)
    }
  }, [client, id])

  useEffect(() => { load() }, [load])

  if (loading) return <Spinner centered />
  if (error)   return <ErrorState message={error} onRetry={load} />
  if (!page)   return null

  const author = page.actor

  // Resolve image to a displayable URL regardless of whether it's stored as a
  // file ID ("file:xxx@domain") or a domain-absolute URL (".../files/file:xxx").
  // This handles both new records (file IDs) and old records (absolute URLs that
  // may point to the wrong domain in dev).
  const imageSrc = (() => {
    const img = page.image
    if (!img) return null
    if (img.startsWith('file:')) return client?.files?.serveUrl(img) ?? null
    const m = img.match(/\/files\/(file:[^?#]+)/)
    if (m) return client?.files?.serveUrl(decodeURIComponent(m[1])) ?? img
    return img
  })()

  return (
    <article className="flex flex-col gap-8">

      <Link
        to="/pages"
        className="flex items-center gap-1.5 font-ui text-xs uppercase tracking-widest text-base-content/65 hover:text-primary transition-colors self-start"
      >
        <ArrowLeft size={13} />
        {t('pages.allPages', { defaultValue: 'All Pages' })}
      </Link>

      {/* Header */}
      <header className="flex flex-col gap-3 border-b-2 border-base-content pb-6">
        <h1 className="font-display text-5xl tracking-wide leading-none">
          {page.title}
        </h1>

        {/* Featured image — between title and summary/body */}
        {imageSrc && (
          <img
            src={imageSrc}
            alt={page.title}
            className="w-full max-h-72 object-cover"
          />
        )}

        {page.summary && (
          <p className="font-reading text-lg text-base-content/70 leading-relaxed">
            {page.summary}
          </p>
        )}

        <div className="flex items-center justify-between flex-wrap gap-3 mt-1">
          <div className="flex items-center gap-3">
            {author && (
              <>
                <UserAvatar user={author} size="sm" />
                <div className="flex flex-col gap-0.5">
                  <Link
                    to={`/users/${encodeURIComponent(author.id)}`}
                    className="font-ui text-sm font-bold text-base-content hover:text-primary transition-colors"
                  >
                    {author.name ?? author.displayName}
                  </Link>
                  <div className="flex items-center gap-2 font-ui text-xs text-base-content/45 uppercase tracking-widest">
                    {page.updatedAt && page.updatedAt !== page.createdAt ? (
                      <>
                        {t('common.updated', { defaultValue: 'Updated' })}
                        <Timestamp date={page.updatedAt} />
                      </>
                    ) : (
                      <Timestamp date={page.createdAt} />
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {page.wordCount > 0 && (
            <div className="flex items-center gap-1.5 font-ui text-xs uppercase tracking-widest text-base-content/35">
              <BookOpen size={12} />
              {t('pages.wordCount', { count: page.wordCount, defaultValue: `${page.wordCount} words` })}
            </div>
          )}
        </div>

        {page.tags?.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Tag size={11} className="text-base-content/35 shrink-0" />
            {page.tags.map((tag) => (
              <span key={tag} className="font-ui text-[11px] uppercase tracking-widest text-base-content/45">
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Body */}
      {page.body && (
        <SafeHtml
          html={page.body}
          className="prose prose-sm max-w-none text-[13.5px] [&_p]:leading-[1.45] [&_p]:font-[450] font-reading [&_h2]:font-display [&_h2]:text-3xl [&_h2]:tracking-wide [&_h2]:font-normal [&_h3]:font-display [&_h3]:text-2xl [&_h3]:tracking-wide [&_h3]:font-normal [&_a]:text-primary [&_a]:underline"
        />
      )}

    </article>
  )
}
