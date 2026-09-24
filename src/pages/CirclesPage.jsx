// CirclesPage — Browse public/server-visible circles, sortable by date or reacts.

const MOCK_CIRCLES = [
  { id: 'circle:jazz@local', name: 'Jazz & Improvisation', summary: 'From bebop to free jazz — players, listeners, and obsessives welcome.', memberCount: 142, reactCount: 61, actor: { displayName: 'Miles Davis' }, actorId: 'user:miles@local', members: [] },
  { id: 'circle:design@local', name: 'Midcentury Design', summary: 'Eames, Saarinen, Noguchi, and everything in between. Post your finds.', memberCount: 89, reactCount: 34, actor: { displayName: 'Ray Eames' }, actorId: 'user:ray@local', members: [] },
  { id: 'circle:film@local', name: 'Film Noir', summary: 'Hard-boiled cinema, femmes fatales, and perpetual rain. Screenings and discussion.', memberCount: 57, reactCount: 18, actor: { displayName: 'Billy Wilder' }, actorId: 'user:billy@local', members: [] },
  { id: 'circle:print@local', name: 'Letterpress & Print', summary: 'Type nerds, ink lovers, and anyone who thinks movable type was a good idea.', memberCount: 34, reactCount: 8, actor: { displayName: 'Ben Franklin' }, actorId: 'user:ben@local', members: [] },
  { id: 'circle:food@local', name: 'Corner Diner', summary: 'Recipes, dives, and the pursuit of the perfect pie. No fusion.', memberCount: 201, reactCount: 94, actor: { displayName: 'Julia Child' }, actorId: 'user:julia@local', members: [] },
]

import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Ban, VolumeX, Plus } from 'lucide-react'
import { sortByPins } from '@kowloon/client'
import { useClient } from '../hooks/useClient'
import CircleAvatar from '../components/ui/CircleAvatar'
import CopyCircleMenu from '../components/circles/CopyCircleMenu'
import Spinner from '../components/ui/Spinner'
import ErrorState from '../components/ui/ErrorState'
import EmptyState from '../components/ui/EmptyState'

function CircleBrowseCard({ circle, isLoggedIn }) {
  const { t } = useTranslation()

  return (
    <div className="flex items-start gap-4 py-5 border-b border-base-300 group">
      <Link to={`/circles/${encodeURIComponent(circle.id)}`} className="shrink-0 mt-1">
        <CircleAvatar circle={circle} size="lg" />
      </Link>

      <div className="flex flex-col gap-1.5 min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <Link
              to={`/circles/${encodeURIComponent(circle.id)}`}
              className="font-display text-2xl tracking-wide leading-none hover:text-primary transition-colors"
            >
              {circle.name}
            </Link>
            <div className="flex items-center gap-2 font-ui text-xs uppercase tracking-widest text-base-content/60">
              {(circle.actor?.name ?? circle.actor?.displayName) && (
                <>
                  <Link
                    to={`/users/${encodeURIComponent(circle.actorId)}`}
                    className="font-bold hover:text-primary transition-colors"
                  >
                    {circle.actor.name ?? circle.actor.displayName ?? circle.actorId}
                  </Link>
                  <span>·</span>
                </>
              )}
              <span>{circle.memberCount ?? 0} {t('circle.members', { defaultValue: 'members' })}</span>
              {circle.reactCount > 0 && (
                <>
                  <span>·</span>
                  <span>{circle.reactCount} {t('circle.reacts', { defaultValue: 'reacts' })}</span>
                </>
              )}
            </div>
          </div>

          {isLoggedIn && (
            <CopyCircleMenu circle={circle} className="opacity-0 group-hover:opacity-100 focus-within:opacity-100" />
          )}
        </div>

        {circle.summary && (
          <p className="font-reading text-base text-base-content/75 leading-relaxed line-clamp-2">
            {circle.summary}
          </p>
        )}
      </div>
    </div>
  )
}

// Blocked/Muted — personal moderation circles, not browsable/shareable like a
// normal circle. Simpler row: no actor link, no "copy circle" action, just
// name + member count + a link into the same circle detail/edit page (which
// locks metadata editing for type==='System', see CirclePage).
function SystemCircleRow({ circle, kind }) {
  const { t } = useTranslation()
  const isBlocked = kind === 'blocked'
  const Icon = isBlocked ? Ban : VolumeX

  return (
    <Link
      to={`/circles/${encodeURIComponent(circle.id)}`}
      className="flex items-center gap-4 py-4 border-b border-base-300 hover:bg-base-200/50 transition-colors"
    >
      <div className="w-10 h-10 shrink-0 flex items-center justify-center bg-base-300 text-base-content/60">
        <Icon size={18} />
      </div>
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className="font-display text-lg tracking-wide leading-none">
          {isBlocked
            ? t('circles.blocked', { defaultValue: 'Blocked' })
            : t('circles.muted', { defaultValue: 'Muted' })}
        </span>
        <span className="font-ui text-xs uppercase tracking-widest text-base-content/60">
          {circle.memberCount ?? 0} {t('circle.members', { defaultValue: 'members' })}
        </span>
      </div>
    </Link>
  )
}

export default function CirclesPage() {
  const { t } = useTranslation()
  const client = useClient()
  const user = useSelector((state) => state.auth.user)

  // "My Circles" = the owner's own circles; "Browse" = local discovery list.
  const [tab, setTab] = useState(user ? 'mine' : 'browse')

  const [sort, setSort] = useState('date')
  const [circles, setCircles] = useState([])
  const [page, setPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // My circles (owner-scoped)
  const [mine, setMine] = useState([])
  const [mineLoading, setMineLoading] = useState(false)
  const [mineError, setMineError] = useState(null)

  // Blocked/Muted — shown in their own section, not mixed into "My Circles".
  const [blockedCircle, setBlockedCircle] = useState(null)
  const [mutedCircle, setMutedCircle] = useState(null)

  const loadMine = useCallback(async () => {
    if (!client || !user?.id) { setMine([]); setBlockedCircle(null); setMutedCircle(null); return }
    setMineLoading(true)
    setMineError(null)
    try {
      // GET /users/:id/circles only returns type:"Circle" (user-created)
      // rows — System circles (Following, Groups, Blocked, Muted) are never
      // included, so Blocked/Muted are fetched separately by id below.
      const res = await client.feeds.getUserCircles({ userId: user.id })
      const items = res?.orderedItems ?? res?.items ?? []
      const pinned = user?.prefs?.pinnedCircles || []
      setMine(sortByPins(items, pinned))

      const [blockedRes, mutedRes] = await Promise.all([
        user.blocked ? client.feeds.getCircle({ circleId: user.blocked }).catch(() => null) : null,
        user.muted ? client.feeds.getCircle({ circleId: user.muted }).catch(() => null) : null,
      ])
      setBlockedCircle(blockedRes?.item ?? blockedRes ?? null)
      setMutedCircle(mutedRes?.item ?? mutedRes ?? null)
    } catch (err) {
      setMineError(err.message || 'Failed to load your circles.')
    } finally {
      setMineLoading(false)
    }
  }, [client, user?.id, user?.blocked, user?.muted])

  const load = useCallback(async (sortOrder, pageNum) => {
    if (!client) {
      const sorted = [...MOCK_CIRCLES].sort((a, b) =>
        sortOrder === 'reacts' ? b.reactCount - a.reactCount : b.id.localeCompare(a.id)
      )
      setCircles(sorted)
      setTotalItems(sorted.length)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await client.feeds.getCircles({ sort: sortOrder, page: pageNum })
      setCircles(res.orderedItems ?? [])
      setTotalItems(res.totalItems ?? 0)
      setItemsPerPage(res.itemsPerPage ?? 20)
    } catch (err) {
      setError(err.message || 'Failed to load circles.')
    } finally {
      setLoading(false)
    }
  }, [client])

  useEffect(() => {
    if (tab === 'browse') load(sort, page)
  }, [tab, sort, page, load])

  useEffect(() => {
    if (tab === 'mine') loadMine()
  }, [tab, loadMine])

  const handleSort = (newSort) => {
    if (newSort === sort) return
    setSort(newSort)
    setPage(1)
  }

  const totalPages = Math.ceil(totalItems / itemsPerPage)

  return (
    <>
    <div className="flex flex-col gap-6">

      {/* Page header + sort controls */}
      <div className="flex items-end justify-between border-b-2 border-base-300 pb-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl tracking-wide leading-none">
            {t('circles.browse', { defaultValue: 'Circles' })}
          </h1>
          {tab === 'browse' && totalItems > 0 && !loading && (
            <p className="font-ui text-sm uppercase tracking-widest text-base-content/50">
              {totalItems} {t('circles.total', { defaultValue: 'circles' })}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {tab === 'browse' && (
          <div className="flex items-center gap-0 border border-base-300">
          <button
            onClick={() => handleSort('date')}
            className={`px-4 py-2 font-ui text-xs uppercase tracking-widest transition-colors ${
              sort === 'date'
                ? 'bg-secondary text-secondary-content'
                : 'text-base-content/60 hover:text-base-content hover:bg-base-200'
            }`}
          >
            {t('sort.newest', { defaultValue: 'Newest' })}
          </button>
          <button
            onClick={() => handleSort('reacts')}
            className={`px-4 py-2 font-ui text-xs uppercase tracking-widest transition-colors border-l border-base-300 ${
              sort === 'reacts'
                ? 'bg-secondary text-secondary-content'
                : 'text-base-content/60 hover:text-base-content hover:bg-base-200'
            }`}
          >
            {t('sort.popular', { defaultValue: 'Popular' })}
          </button>
        </div>
          )}
        </div>
      </div>

      {user && (
        <Link
          to="/circles/new"
          state={{ to: user?.id }}
          className="flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-content font-ui text-sm uppercase tracking-widest hover:bg-primary/80 transition-colors"
        >
          <Plus size={16} strokeWidth={2.25} />
          {t('circle.create', { defaultValue: 'New Circle' })}
        </Link>
      )}

      {/* My / Browse tabs — logged-in users only */}
      {user && (
        <div className="flex items-center gap-0 border-b border-base-300 -mt-2">
          <button
            onClick={() => setTab('mine')}
            className={`px-5 py-3 font-ui text-xs uppercase tracking-widest transition-colors border-b-2 -mb-px ${
              tab === 'mine'
                ? 'border-primary text-base-content font-bold'
                : 'border-transparent text-base-content/50 hover:text-base-content'
            }`}
          >
            {t('circles.mine', { defaultValue: 'My Circles' })}
          </button>
          <button
            onClick={() => setTab('browse')}
            className={`px-5 py-3 font-ui text-xs uppercase tracking-widest transition-colors border-b-2 -mb-px ${
              tab === 'browse'
                ? 'border-primary text-base-content font-bold'
                : 'border-transparent text-base-content/50 hover:text-base-content'
            }`}
          >
            {t('circles.browseTab', { defaultValue: 'Browse' })}
          </button>
        </div>
      )}

      {/* My Circles */}
      {tab === 'mine' && (
        <>
          {mineLoading && <Spinner centered />}
          {!mineLoading && mineError && <ErrorState message={mineError} onRetry={loadMine} />}
          {!mineLoading && !mineError && mine.length === 0 && (
            <EmptyState message={t('circles.mineEmpty', { defaultValue: 'You haven’t created any circles yet.' })} />
          )}
          {!mineLoading && !mineError && mine.length > 0 && (
            <div className="flex flex-col">
              {mine.map((circle) => (
                <CircleBrowseCard key={circle.id} circle={circle} isLoggedIn={!!user} />
              ))}
            </div>
          )}

          {/* Blocked & Muted — separated from ordinary circles: these are
              personal moderation lists, not something you browse or copy. */}
          {!mineLoading && !mineError && (blockedCircle || mutedCircle) && (
            <div className="flex flex-col mt-8 pt-2 border-t-2 border-base-300">
              <h2 className="font-display text-xl tracking-wide leading-none mb-1 mt-4">
                {t('circles.blockedMuted', { defaultValue: 'Blocked & Muted' })}
              </h2>
              <p className="font-ui text-xs uppercase tracking-widest text-base-content/50 mb-2">
                {t('circles.blockedMutedHint', { defaultValue: 'Manage membership and visibility' })}
              </p>
              <div className="flex flex-col">
                {blockedCircle && <SystemCircleRow circle={blockedCircle} kind="blocked" />}
                {mutedCircle && <SystemCircleRow circle={mutedCircle} kind="muted" />}
              </div>
            </div>
          )}
        </>
      )}

      {/* Browse */}
      {tab === 'browse' && (<>
      {loading && <Spinner centered />}
      {!loading && error && <ErrorState message={error} onRetry={() => load(sort, page)} />}
      {!loading && !error && circles.length === 0 && (
        <EmptyState message={t('circles.empty', { defaultValue: 'No circles found.' })} />
      )}
      {!loading && !error && circles.length > 0 && (
        <div className="flex flex-col">
          {circles.map((circle) => (
            <CircleBrowseCard
              key={circle.id}
              circle={circle}
              isLoggedIn={!!user}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-base-300">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-4 py-2 font-ui text-xs uppercase tracking-widest border border-base-300 text-base-content/60 hover:text-base-content hover:border-base-content transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {t('pagination.prev', { defaultValue: 'Previous' })}
          </button>
          <span className="font-ui text-xs uppercase tracking-widest text-base-content/50">
            {t('pagination.pageOf', { page, total: totalPages, defaultValue: `Page ${page} of ${totalPages}` })}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-4 py-2 font-ui text-xs uppercase tracking-widest border border-base-300 text-base-content/60 hover:text-base-content hover:border-base-content transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {t('pagination.next', { defaultValue: 'Next' })}
          </button>
        </div>
      )}
      </>)}

    </div>

</>
  )
}
