// SearchPage — search posts, users, groups, pages.
// Reads ?q= and ?type= from URL; updates on input with debounce.
// User results have inline action buttons (Add to Circle, View Profile, Block, Mute).

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Search, X, Loader, Globe, ArrowRight, FileText, Users2, BookOpen } from 'lucide-react'
import { parseKowloonId, NAVIGABLE_TYPES } from '@kowloon/client'
import { useClient } from '../hooks/useClient'
import { toast } from '../app/toast'
import PostCard from '../components/posts/PostCard'
import CircleIcon from '../components/ui/CircleIcon'
import UserAvatar from '../components/ui/UserAvatar'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import sizedUrl from '../lib/sizedUrl'

const hexMask = {
  WebkitMaskImage: 'url(/hex-mask.svg)',
  maskImage: 'url(/hex-mask.svg)',
  maskSize: 'contain',
  maskRepeat: 'no-repeat',
  maskPosition: 'center',
}

const SEARCH_TYPES = ['all', 'posts', 'users', 'groups', 'pages', 'bookmarks']

// Content types (order shown on the "All" tab). Servers are handled separately.
const CONTENT_TYPES = ['posts', 'users', 'groups', 'pages', 'bookmarks']

const ALL_PREVIEW = 5 // results shown per section on the "All" tab

const itemsOf = (res) => res?.orderedItems ?? res?.items ?? []

// Run a single-type, paginated search via the client's convenience methods.
// Mirrors mobile/app/(tabs)/search.js — each type paginates independently.
function searchByType(client, type, query, page) {
  switch (type) {
    case 'posts':     return client.search.searchPosts({ query, page })
    case 'users':     return client.search.searchUsers({ query, page })
    case 'groups':    return client.search.searchGroups({ query, page })
    case 'pages':     return client.search.searchPages({ query, page })
    case 'bookmarks': return client.search.searchBookmarks({ query, page })
    default:          return Promise.resolve({ orderedItems: [], totalItems: 0 })
  }
}

// Normalize a raw result into the shape the renderers expect (same mapping the
// old combined groupResults() applied, but keyed on the known result type).
function normalizeItem(type, item) {
  switch (type) {
    case 'posts':  return { ...item, name: item.title ?? item.name, actor: item.actor ?? { id: item.actorId } }
    case 'users':  return { ...item, displayName: item.profile?.name ?? item.username ?? item.id }
    case 'groups': return item
    case 'pages':  return { ...item, name: item.title ?? item.name }
    default:       return item // bookmarks, servers
  }
}

const normalizeList = (type, list) => (list || []).map((i) => normalizeItem(type, i))

// ── Add-to-Circle modal ───────────────────────────────────────────────────────

function AddToCircleModal({ user, authUser, client, onClose }) {
  const [circles, setCircles] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(null)

  useEffect(() => {
    client.feeds.getUserCircles({ userId: authUser.id })
      .then((res) => setCircles(res?.orderedItems ?? []))
      .catch(() => setCircles([]))
      .finally(() => setLoading(false))
  }, [authUser.id, client])

  const handleAdd = async (circle) => {
    setAdding(circle.id)
    try {
      await client.activities.addToCircle({ circleId: circle.id, memberId: user.id })
      toast.success(`${user.displayName} added to ${circle.name}`)
      onClose()
    } catch (err) {
      toast.error('Failed to add to circle', { detail: err.message })
      setAdding(null)
    }
  }

  return (
    <Modal open title={`Add ${user.displayName} to Circle`} onClose={onClose}>
      {loading ? (
        <Spinner centered />
      ) : circles.length === 0 ? (
        <p className="font-ui text-sm text-base-content/50 py-2">
          No circles yet. <Link to="/circles/new" className="underline" onClick={onClose}>Create one first.</Link>
        </p>
      ) : (
        <div className="flex flex-col -mx-6">
          {circles.map((circle) => (
            <button
              key={circle.id}
              onClick={() => handleAdd(circle)}
              disabled={!!adding}
              className="flex items-center gap-3 px-6 py-3 text-left hover:bg-base-200 transition-colors border-b border-base-300 last:border-b-0 disabled:opacity-50"
            >
              {adding === circle.id
                ? <Loader size={14} className="animate-spin shrink-0 text-base-content/40" />
                : <CircleIcon type="circle" size="sm" className="shrink-0 opacity-50" />
              }
              <span className="font-ui text-sm">{circle.name}</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}

// ── User result ───────────────────────────────────────────────────────────────

function UserResult({ user, authUser, client }) {
  const isRemote = user.url && !user.url.startsWith(window.location.origin)
  const [circleModalOpen, setCircleModalOpen] = useState(false)

  const handleBlock = async () => {
    try {
      await client.activities.block({ userId: user.id })
      toast.success(`${user.id} blocked`)
    } catch (err) {
      toast.error('Block failed', { detail: err.message })
    }
  }

  const handleMute = async () => {
    try {
      await client.activities.mute({ userId: user.id })
      toast.success(`${user.id} muted`)
    } catch (err) {
      toast.error('Mute failed', { detail: err.message })
    }
  }

  const profileLink = isRemote
    ? <a href={user.url} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 border border-base-300 font-ui text-xs uppercase tracking-widest text-base-content/70 hover:border-primary hover:text-primary transition-colors">View Profile</a>
    : <Link to={`/users/${encodeURIComponent(user.id)}`} className="px-3 py-1.5 border border-base-300 font-ui text-xs uppercase tracking-widest text-base-content/70 hover:border-primary hover:text-primary transition-colors">View Profile</Link>

  return (
    <div className="flex flex-col gap-3 py-4 border-b border-base-300">
      <div className="flex items-start gap-3">
        <UserAvatar user={user} size="md" />
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-ui text-sm font-bold text-base-content">{user.displayName}</span>
          <span className="font-ui text-xs uppercase tracking-widest text-base-content/50">{user.id}</span>
          {user.profile?.description && (
            <p className="font-reading text-sm text-base-content/70 leading-snug mt-0.5 line-clamp-2">
              {user.profile.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 pl-[52px]">
        {authUser && (
          <button
            onClick={() => setCircleModalOpen(true)}
            className="px-3 py-1.5 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest hover:bg-primary/80 transition-colors"
          >
            Add to Circle
          </button>
        )}
        {profileLink}
        {authUser && (
          <>
            <div className="w-px h-4 bg-base-300 mx-1" />
            <button
              onClick={handleMute}
              className="px-3 py-1.5 font-ui text-xs uppercase tracking-widest text-base-content/40 hover:text-base-content transition-colors"
            >
              Mute
            </button>
            <button
              onClick={handleBlock}
              className="px-3 py-1.5 font-ui text-xs uppercase tracking-widest text-error/50 hover:text-error transition-colors"
            >
              Block
            </button>
          </>
        )}
      </div>

      {circleModalOpen && authUser && (
        <AddToCircleModal
          user={user}
          authUser={authUser}
          client={client}
          onClose={() => setCircleModalOpen(false)}
        />
      )}
    </div>
  )
}

// ── Other result renderers ────────────────────────────────────────────────────

function GroupResult({ group }) {
  return (
    <Link
      to={`/groups/${encodeURIComponent(group.id)}`}
      className="flex items-start gap-3 py-4 border-b border-base-300 hover:bg-base-200 px-2 -mx-2 transition-colors"
    >
      {group.icon
        ? <img loading="lazy" src={sizedUrl(group.icon, 200)} alt={group.name} className="w-10 h-10 object-cover shrink-0" style={hexMask} />
        : <div className="w-10 h-10 bg-secondary flex items-center justify-center shrink-0" style={hexMask}>
            <CircleIcon type="group" size="md" className="opacity-70 text-secondary-content" />
          </div>
      }
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="font-display text-xl tracking-wide leading-none">{group.name}</span>
        <span className="font-ui text-xs uppercase tracking-widest text-base-content/55">{group.memberCount} members</span>
        {group.summary && (
          <p className="font-reading text-sm text-base-content/70 leading-snug mt-0.5 line-clamp-2">{group.summary}</p>
        )}
      </div>
    </Link>
  )
}

function BookmarkResult({ bookmark }) {
  const href = bookmark.href ?? bookmark.target
  const inner = (
    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
      <span className="font-ui text-sm font-semibold text-primary truncate">{bookmark.title}</span>
      {bookmark.summary && (
        <p className="font-reading text-sm text-base-content/70 leading-snug line-clamp-2">{bookmark.summary}</p>
      )}
      {bookmark.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {bookmark.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="font-ui text-xs uppercase tracking-widest text-base-content/50 bg-base-300 px-1.5 py-0.5">{tag}</span>
          ))}
        </div>
      )}
    </div>
  )
  return (
    <div className="flex items-start gap-3 py-4 border-b border-base-300">
      {bookmark.image && <img src={sizedUrl(bookmark.image, 200)} alt="" className="w-10 h-10 object-cover shrink-0" />}
      {href
        ? <a href={href} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 hover:opacity-70 transition-opacity">{inner}</a>
        : inner}
    </div>
  )
}

function PageResult({ page }) {
  return (
    <Link
      to={`/pages/${encodeURIComponent(page.id)}`}
      className="flex items-start gap-3 py-4 border-b border-base-300 hover:bg-base-200 px-2 -mx-2 transition-colors"
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="font-display text-xl tracking-wide leading-none">{page.name}</span>
        {page.summary && (
          <p className="font-reading text-sm text-base-content/70 leading-snug mt-0.5 line-clamp-2">{page.summary}</p>
        )}
      </div>
    </Link>
  )
}

function stripHtml(s) {
  return typeof s === 'string' ? s.replace(/<[^>]*>/g, '').trim() : ''
}

// Shown when the query is a bare @domain — a link to that remote server.
function ServerResultCard({ server, domain }) {
  const name = server?.name || domain
  const desc = stripHtml(server?.description)
  return (
    <Link
      to={`/server/${encodeURIComponent(domain)}`}
      className="flex items-center gap-3 py-4 border-b border-base-300 hover:bg-base-200 px-2 -mx-2 transition-colors"
    >
      {server?.icon
        ? <img src={server.icon} alt="" className="w-11 h-11 object-cover shrink-0" style={hexMask} />
        : <div className="w-11 h-11 bg-secondary flex items-center justify-center shrink-0" style={hexMask}>
            <Globe size={20} className="text-secondary-content opacity-70" />
          </div>
      }
      <div className="flex flex-col min-w-0 flex-1">
        <span className="font-display text-xl tracking-wide leading-none">{name}</span>
        <span className="font-ui text-xs uppercase tracking-widest text-base-content/55 mt-0.5">
          {domain}{typeof server?.userCount === 'number' ? ` · ${server.userCount.toLocaleString()} users` : ''}
        </span>
        {desc && <p className="font-reading text-sm text-base-content/70 leading-snug mt-0.5 line-clamp-2">{desc}</p>}
      </div>
    </Link>
  )
}

// Maps a /lookup result's objectType to a route and a display label. Kept
// separate from parseKowloonId's NAVIGABLE_TYPES (which only knows the
// *shape* of an id, not this app's route templates) since the two vary
// independently — a type can be classified as navigable in principle while
// this app specifically hasn't built a page for it.
function goToPathFor(item) {
  const objectType = item?.objectType || item?.type
  switch (objectType) {
    // sanitizeUser() puts the ActivityPub actor URL in `id` and the Kowloon
    // handle (@user@domain) in `handle` — every route in this app addresses
    // users by handle, so `id` would silently link to the wrong thing here.
    case 'User':
    case 'Person':
      return item.handle ? `/users/${encodeURIComponent(item.handle)}` : null
    case 'Post':   return `/posts/${encodeURIComponent(item.id)}`
    case 'Circle': return `/circles/${encodeURIComponent(item.id)}`
    case 'Group':  return `/groups/${encodeURIComponent(item.id)}`
    case 'Page':   return `/pages/${encodeURIComponent(item.id)}`
    default: return null
  }
}

function GoToResultCard({ item }) {
  const objectType = item?.objectType || item?.type
  const path = goToPathFor(item)
  if (!path) return null

  const label =
    objectType === 'User' || objectType === 'Person'
      ? (item.name || item.preferredUsername || item.handle)
      : (item.title || item.name || item.summary || item.id)

  const sub =
    objectType === 'User' || objectType === 'Person' ? item.handle
      : objectType === 'Post'   ? 'Post'
      : objectType === 'Circle' ? 'Circle'
      : objectType === 'Group'  ? 'Group'
      : objectType === 'Page'   ? 'Page'
      : null

  return (
    <Link
      to={path}
      className="flex items-center gap-3 py-4 border-b border-base-300 hover:bg-base-200 px-2 -mx-2 transition-colors"
    >
      {objectType === 'User' || objectType === 'Person' ? (
        <UserAvatar user={{ profile: item.profile, id: item.handle }} size="md" />
      ) : objectType === 'Circle' ? (
        <CircleIcon type="circle" size="md" className="shrink-0 opacity-70" />
      ) : (
        <div className="w-11 h-11 bg-secondary flex items-center justify-center shrink-0" style={hexMask}>
          {objectType === 'Group'
            ? <Users2 size={20} className="text-secondary-content opacity-70" />
            : objectType === 'Page'
            ? <BookOpen size={20} className="text-secondary-content opacity-70" />
            : <FileText size={20} className="text-secondary-content opacity-70" />
          }
        </div>
      )}
      <div className="flex flex-col min-w-0 flex-1">
        <span className="font-display text-xl tracking-wide leading-none truncate">{label}</span>
        {sub && (
          <span className="font-ui text-xs uppercase tracking-widest text-base-content/55 mt-0.5">
            {sub}
          </span>
        )}
      </div>
      <ArrowRight size={16} className="text-base-content/30 shrink-0" />
    </Link>
  )
}

function SectionHeader({ title, count, onSeeAll }) {
  return (
    <div className="flex items-end justify-between border-b-2 border-base-300 pb-2 mb-0 mt-6 first:mt-0">
      <h2 className="font-display text-2xl tracking-wide">
        {title}
        {count > 0 && (
          <span className="ml-2 font-ui text-sm text-base-content/40 normal-case tracking-normal">{count}</span>
        )}
      </h2>
      {onSeeAll && (
        <button
          onClick={onSeeAll}
          className="font-ui text-xs uppercase tracking-widest text-primary hover:text-primary/70 transition-colors pb-1"
        >
          See all
        </button>
      )}
    </div>
  )
}

// Renders a single result of a given type using the type-specific card.
function ResultItem({ type, item, authUser, client }) {
  switch (type) {
    case 'posts':     return <PostCard post={item} />
    case 'users':     return <UserResult user={item} authUser={authUser} client={client} />
    case 'groups':    return <GroupResult group={item} />
    case 'pages':     return <PageResult page={item} />
    case 'bookmarks': return <BookmarkResult bookmark={item} />
    default:          return null
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { t } = useTranslation()
  const client = useClient()
  const authUser = useSelector((state) => state.auth.user)

  const initialQ    = searchParams.get('q') ?? ''
  const initialType = searchParams.get('type') ?? 'all'

  const [query, setQuery]           = useState(initialQ)
  const [type, setType]             = useState(initialType)
  const [inputValue, setInputValue] = useState(initialQ)

  // "All" tab: a first page of each type. Type tabs: one paginated list.
  const [sections, setSections]   = useState({ posts: [], users: [], groups: [], pages: [], bookmarks: [] })
  const [serverMatches, setServerMatches] = useState([]) // partial cached-server hits
  const [list, setList]           = useState([])
  const [page, setPage]           = useState(1)
  const [total, setTotal]         = useState(0)

  const [loading, setLoading]         = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const [serverResult, setServerResult]   = useState(null)
  const [serverLoading, setServerLoading] = useState(false)

  const [goToResult, setGoToResult] = useState(null)
  const [goToLoading, setGoToLoading] = useState(false)
  const [goToError, setGoToError]   = useState(null)

  const q = query.trim()

  // A bare @domain (starts with @, no second @) is a remote-server lookup —
  // mirrors the mobile search. @user@domain has a second @ and is a user search.
  const isServerQuery =
    query.startsWith('@') && !query.slice(1).includes('@') && q.length > 1
  const serverDomain = isServerQuery ? query.slice(1).trim() : ''

  // Everything else parseKowloonId recognizes as a real, navigable id/handle
  // (@user@domain, post:/circle:/group:/page: ids) — Server is excluded since
  // isServerQuery above already owns that case end-to-end, and Bookmark/Reply/
  // React are recognized ids with no standalone destination on this platform,
  // so a card for them would just be a dead end.
  const idMatch = q ? parseKowloonId(q) : { type: 'Unknown' }
  const isGoToQuery =
    !isServerQuery && idMatch.type !== 'Unknown' && NAVIGABLE_TYPES.has(idMatch.type)

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(inputValue)
      setSearchParams(
        inputValue ? { q: inputValue, ...(type !== 'all' ? { type } : {}) } : {},
        { replace: true }
      )
    }, 350)
    return () => clearTimeout(timer)
  }, [inputValue, type, setSearchParams])

  // Primary fetch — re-runs whenever the query or active tab changes.
  useEffect(() => {
    if (!client) return
    if (!q) {
      setSections({ posts: [], users: [], groups: [], pages: [], bookmarks: [] })
      setServerMatches([])
      setList([])
      setTotal(0)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    ;(async () => {
      try {
        if (type === 'all') {
          const [p, u, g, pg, b, s] = await Promise.all([
            searchByType(client, 'posts', q, 1),
            searchByType(client, 'users', q, 1),
            searchByType(client, 'groups', q, 1),
            searchByType(client, 'pages', q, 1),
            searchByType(client, 'bookmarks', q, 1),
            client.search.searchServers({ query: q, page: 1 }).catch(() => ({})),
          ])
          if (cancelled) return
          setSections({
            posts:     normalizeList('posts', itemsOf(p)),
            users:     normalizeList('users', itemsOf(u)),
            groups:    normalizeList('groups', itemsOf(g)),
            pages:     normalizeList('pages', itemsOf(pg)),
            bookmarks: normalizeList('bookmarks', itemsOf(b)),
          })
          setServerMatches(itemsOf(s))
        } else {
          const res = await searchByType(client, type, q, 1)
          if (cancelled) return
          const items = normalizeList(type, itemsOf(res))
          setList(items)
          setTotal(res?.totalItems ?? items.length)
          setPage(1)
        }
      } catch (err) {
        if (cancelled) return
        console.warn('[SearchPage] search failed:', err.message)
        setSections({ posts: [], users: [], groups: [], pages: [], bookmarks: [] })
        setServerMatches([])
        setList([])
        setTotal(0)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [client, q, type])

  const hasMore = type !== 'all' && list.length < total

  const loadMore = useCallback(async () => {
    if (type === 'all' || loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const next = page + 1
      const res = await searchByType(client, type, q, next)
      const more = normalizeList(type, itemsOf(res))
      setList((prev) => {
        const seen = new Set(prev.map((x) => x.id))
        return [...prev, ...more.filter((x) => !seen.has(x.id))]
      })
      setTotal(res?.totalItems ?? total)
      setPage(next)
    } catch {
      // keep what we have; a failed page just stops the "load more"
    } finally {
      setLoadingMore(false)
    }
  }, [client, q, type, page, total, hasMore, loadingMore])

  // Remote-server lookup when the query is a bare @domain.
  useEffect(() => {
    if (!client || !isServerQuery) { setServerResult(null); return }
    let cancelled = false
    setServerLoading(true)
    client.feeds.getServer({ domain: serverDomain })
      .then((res) => { if (!cancelled) setServerResult(res?.server ?? res?.item ?? res ?? null) })
      .catch(() => { if (!cancelled) setServerResult(null) })
      .finally(() => { if (!cancelled) setServerLoading(false) })
    return () => { cancelled = true }
  }, [client, serverDomain, isServerQuery])

  // "Go to" lookup for a recognized id/handle. Runs GET /lookup, which
  // enforces the exact same visibility rules as everywhere else in the app —
  // a 404 here can mean "doesn't exist" or "you can't see it"; the server
  // deliberately doesn't distinguish the two, so neither does this UI.
  useEffect(() => {
    if (!client || !isGoToQuery) { setGoToResult(null); setGoToError(null); return }
    let cancelled = false
    setGoToLoading(true)
    setGoToError(null)
    client.feeds.lookup({ id: q })
      .then((res) => { if (!cancelled) setGoToResult(res?.item ?? null) })
      .catch((err) => {
        if (cancelled) return
        setGoToResult(null)
        setGoToError(
          err?.statusCode === 404
            ? t('search.goToNotFound', { defaultValue: "Nothing found at that ID — it may not exist, or you may not have access to it." })
            : t('search.goToFailed', { defaultValue: 'Could not look that up.' })
        )
      })
      .finally(() => { if (!cancelled) setGoToLoading(false) })
    return () => { cancelled = true }
  }, [client, q, isGoToQuery, t])

  // Partial cached-server matches, minus the exact @domain shown by the live
  // lookup above.
  const partialServers = (serverMatches ?? []).filter(
    (s) => (s?.domain || '').toLowerCase() !== (serverResult?.domain || '').toLowerCase()
  )

  const allEmpty =
    partialServers.length === 0 &&
    CONTENT_TYPES.every((ct) => (sections[ct]?.length ?? 0) === 0)

  const TYPE_LABELS = {
    all:    t('search.all',    { defaultValue: 'All' }),
    posts:  t('search.posts',  { defaultValue: 'Posts' }),
    users:  t('search.users',  { defaultValue: 'Users' }),
    groups: t('search.groups', { defaultValue: 'Groups' }),
    pages:  t('search.pages',  { defaultValue: 'Pages' }),
    bookmarks: t('search.bookmarks', { defaultValue: 'Bookmarks' }),
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Search input */}
      <div className="flex flex-col gap-4 border-b-2 border-base-300 pb-6">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40"
            aria-hidden="true"
          />
          <input
            type="search"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={t('search.placeholder', { defaultValue: 'Search…' })}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck="false"
            aria-label={t('search.placeholder', { defaultValue: 'Search' })}
            className="w-full pl-9 pr-9 py-2.5 bg-base-100 border-2 border-base-300 focus:border-primary outline-none font-ui text-sm text-base-content placeholder:text-base-content/30 transition-colors"
          />
          {inputValue && (
            <button
              type="button"
              onClick={() => { setInputValue(''); setQuery('') }}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-0 flex-wrap">
          {SEARCH_TYPES.map((st) => (
            <button
              key={st}
              onClick={() => setType(st)}
              className={`px-4 py-2 font-ui text-xs uppercase tracking-widest transition-colors border-r border-base-300 last:border-r-0 ${
                type === st
                  ? 'bg-secondary text-secondary-content'
                  : 'bg-base-200 text-base-content/60 hover:bg-base-300'
              }`}
            >
              {TYPE_LABELS[st]}
            </button>
          ))}
        </div>
      </div>

      {/* Remote-server lookup result (bare @domain) */}
      {isServerQuery && (
        <div className="flex flex-col gap-2">
          <p className="font-ui text-[10px] uppercase tracking-widest text-base-content/40">Server</p>
          {serverLoading ? (
            <Spinner />
          ) : serverResult ? (
            <ServerResultCard server={serverResult} domain={serverDomain} />
          ) : (
            <EmptyState message={`No Kowloon server found at ${serverDomain}.`} />
          )}
        </div>
      )}

      {/* "Go to" — the input is a recognized Kowloon id/handle, not free text. */}
      {isGoToQuery && (
        <div className="flex flex-col gap-2">
          <p className="font-ui text-[10px] uppercase tracking-widest text-base-content/40">
            {t('search.goTo', { defaultValue: 'Go to' })}
          </p>
          {goToLoading ? (
            <Spinner />
          ) : goToResult ? (
            <GoToResultCard item={goToResult} />
          ) : (
            <EmptyState message={goToError || t('search.goToNotFound', { defaultValue: 'Nothing found at that ID.' })} />
          )}
        </div>
      )}

      {loading && <Spinner centered />}

      {!loading && !q && (
        <div className="py-16 text-center">
          <Search size={28} className="mx-auto mb-4 text-base-content/20" />
          <p className="font-ui text-sm uppercase tracking-widest text-base-content/40">
            {t('search.prompt', { defaultValue: 'Type to search' })}
          </p>
        </div>
      )}

      {/* "All" tab — a first page of each type, each with a "See all" jump. */}
      {!loading && q && type === 'all' && (
        allEmpty && !isServerQuery && !isGoToQuery ? (
          <EmptyState message={t('search.noResults', { defaultValue: `No results for "${query}"` })} />
        ) : (
          <div className="flex flex-col gap-2">
            {/* Partial cached-server matches — never the exact @domain shown by
                the live lookup above. */}
            {partialServers.length > 0 && (
              <div>
                <SectionHeader title={t('search.servers', { defaultValue: 'Servers' })} count={partialServers.length} />
                {partialServers.map((s) => (
                  <ServerResultCard key={s.domain} server={s} domain={s.domain} />
                ))}
              </div>
            )}

            {CONTENT_TYPES.map((ct) => {
              const items = sections[ct]
              if (!items || items.length === 0) return null
              return (
                <div key={ct}>
                  <SectionHeader
                    title={TYPE_LABELS[ct]}
                    count={items.length}
                    onSeeAll={items.length > ALL_PREVIEW ? () => setType(ct) : undefined}
                  />
                  {items.slice(0, ALL_PREVIEW).map((item) => (
                    <ResultItem key={item.id} type={ct} item={item} authUser={authUser} client={client} />
                  ))}
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Single-type tab — one paginated list with "Load more". */}
      {!loading && q && type !== 'all' && (
        list.length === 0 && !isServerQuery ? (
          <EmptyState message={t('search.noResults', { defaultValue: `No results for "${query}"` })} />
        ) : (
          <div className="flex flex-col gap-2">
            {list.map((item) => (
              <ResultItem key={item.id} type={type} item={item} authUser={authUser} client={client} />
            ))}
            {hasMore && (
              <div className="pt-4 flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-6 py-2.5 border border-base-300 font-ui text-xs uppercase tracking-widest text-base-content/60 hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                >
                  {loadingMore
                    ? t('search.loading', { defaultValue: 'Loading…' })
                    : t('search.loadMore', { defaultValue: 'Load more' })}
                </button>
              </div>
            )}
          </div>
        )
      )}

    </div>
  )
}
