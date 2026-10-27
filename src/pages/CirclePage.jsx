// CirclePage — circle detail: icon, name, description, creator, members.
// Authorized users see the full page. Owners can edit inline and manage members.

import { useParams, Link, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { setView } from '../app/feedSlice'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Share2, Heart, Pencil, Trash2, X, Check, UserPlus, UserMinus, Loader, Compass } from 'lucide-react'
import { useClient } from '../hooks/useClient'
import UserAvatar from '../components/ui/UserAvatar'
import CircleIcon from '../components/ui/CircleIcon'
import CopyCircleMenu from '../components/circles/CopyCircleMenu'
import AddToDiscoveryModal from '../components/discover/AddToDiscoveryModal'
import Spinner from '../components/ui/Spinner'
import ErrorState from '../components/ui/ErrorState'
import Modal from '../components/ui/Modal'
import PostComposer from '../components/posts/PostComposer'
import sizedUrl from '../lib/sizedUrl'

// A Circle member is either a person ("@user@domain") or a whole server
// ("@domain", one @).
const isServerMember = (id) => typeof id === 'string' && /^@[^@]+$/.test(id)

const hexMask = {
  WebkitMaskImage: 'url(/hex-mask.svg)',
  maskImage: 'url(/hex-mask.svg)',
  maskSize: 'contain',
  maskRepeat: 'no-repeat',
  maskPosition: 'center',
}

// "Private (only you)" self-addresses to the owner's actor ID, not '' — an
// empty `to` is dropped/rejected. Built per-render below so it can use the
// current user's ID (see visibilityOptions).

// ── MemberRow ─────────────────────────────────────────────────────────────────

function MemberRow({ member, isOwner, onRemove, removing }) {
  return (
    <div className="flex items-center gap-3 py-4 border-b border-base-300 last:border-b-0 px-2 group">
      <Link
        to={`/users/${encodeURIComponent(member.id)}`}
        className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity"
      >
        {member.icon
          ? <img loading="lazy" src={sizedUrl(member.icon, 200)} alt={member.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
          : <div className="w-10 h-10 bg-base-300 shrink-0 flex items-center justify-center" style={hexMask}>
              <CircleIcon type="circle" size="sm" />
            </div>
        }
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-ui text-sm font-bold text-base-content truncate">{member.name ?? member.id}</span>
          <span className="font-ui text-xs uppercase tracking-widest text-base-content/55 truncate">{member.id}</span>
        </div>
      </Link>
      {isOwner && (
        <button
          onClick={() => onRemove(member.id)}
          disabled={removing}
          aria-label={`Remove ${member.name ?? member.id}`}
          className="shrink-0 flex items-center gap-1 px-2.5 py-1 border border-error/30 font-ui text-xs uppercase tracking-widest text-error/60 hover:border-error hover:text-error transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-30"
        >
          {removing ? <Loader size={11} className="animate-spin" /> : <UserMinus size={11} />}
        </button>
      )}
    </div>
  )
}

// ── AddMemberRow ──────────────────────────────────────────────────────────────

function AddMemberRow({ circleId, onAdded }) {
  const client = useClient()
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(null)
  const debounceRef = useRef(null)

  // Debounced live type-ahead against /users/search. Suppress partial federated
  // handles (@user@partial) until the domain has a dot — mirrors the mobile app.
  useEffect(() => {
    clearTimeout(debounceRef.current)
    const q = input.trim()
    if (q.length < 2) {
      setResults([])
      setLoading(false)
      setError(null)
      return
    }
    const parts = q.replace(/^@/, '').split('@')
    if (parts.length === 2 && !parts[1].includes('.')) return

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await client.feeds.http.get('/users/search', { params: { q } })
        const items = res?.orderedItems ?? res?.items ?? []
        if (items.length === 0) setError('No users found')
        setResults(items)
      } catch (err) {
        setError(err.message || 'Search failed')
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 350)
    return () => clearTimeout(debounceRef.current)
  }, [input, client])

  const handleAdd = async (user) => {
    setAdding(user.id)
    setError(null)
    try {
      await client.activities.addToCircle({ circleId, memberId: user.id })
      onAdded(user)
      setInput('')
      setResults([])
    } catch (err) {
      setError(err.message || 'Failed to add member')
    } finally {
      setAdding(null)
    }
  }

  return (
    <div className="flex flex-col gap-2 pb-4 border-b-2 border-primary mb-2">
      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('circle.addMemberPlaceholder', { defaultValue: 'Name, @handle, or @user@other.server' })}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck="false"
          className="w-full bg-base-200 border border-base-300 px-3 py-2 pr-9 font-ui text-sm focus:outline-none focus:border-primary"
        />
        {loading && (
          <Loader size={14} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-base-content/50" />
        )}
      </div>

      {error && <p className="font-ui text-xs text-error">{error}</p>}

      {results.length > 0 && (
        <div className="flex flex-col border border-base-300">
          {results.map((user) => (
            <div key={user.id} className="flex items-center gap-3 px-3 py-2 bg-base-200 border-b border-base-300 last:border-b-0">
              {user.icon
                ? <img loading="lazy" src={sizedUrl(user.icon, 200)} alt={user.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                : <div className="w-8 h-8 rounded-full bg-base-300 shrink-0" />
              }
              <div className="flex flex-col gap-0 flex-1 min-w-0">
                <span className="font-ui text-sm font-bold">{user.name}</span>
                <span className="font-ui text-xs tracking-widest text-base-content/55">{user.id}</span>
              </div>
              <button
                onClick={() => handleAdd(user)}
                disabled={!!adding}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest hover:bg-primary/80 transition-colors disabled:opacity-40"
              >
                {adding === user.id ? <Loader size={11} className="animate-spin" /> : <UserPlus size={11} />}
                {t('circle.addMember', { defaultValue: 'Add' })}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CirclePage() {
  const { id } = useParams()
  const client = useClient()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const authUser = useSelector((state) => state.auth.user)
  const { t } = useTranslation()
  const visibilityOptions = [
    { value: '@public', label: 'Public' },
    { value: '@server', label: 'Server only' },
    { value: authUser?.id ?? '', label: 'Private (only you)' },
  ]

  const [circle, setCircle]   = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [removingId, setRemovingId] = useState(null)
  const [confirmUnblock, setConfirmUnblock] = useState(null) // member pending unblock confirmation
  const [sharing, setSharing] = useState(false)
  const [discoveryOpen, setDiscoveryOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [reacted, setReacted] = useState(false)
  const [reactCount, setReactCount] = useState(0)
  const [reacting, setReacting] = useState(false)

  // Edit mode state
  const [editing, setEditing]         = useState(false)
  const [editName, setEditName]       = useState('')
  const [editSummary, setEditSummary] = useState('')
  const [editTo, setEditTo]           = useState('@public')
  const [editIconFile, setEditIconFile] = useState(null)
  const [editIconPreview, setEditIconPreview] = useState(null)
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState(null)
  const iconInputRef = useRef(null)

  const containerRef = useRef(null)
  const [shadowProgress, setShadowProgress] = useState(0)

  const load = useCallback(async () => {
    if (!client) return
    setLoading(true)
    setError(null)
    try {
      const res = await client.feeds.getCircle({ circleId: id })
      const raw = res?.item ?? res
      setCircle(raw)
      setMembers(raw?.members ?? [])
    } catch (err) {
      setError(err.message || 'Failed to load circle.')
    } finally {
      setLoading(false)
    }
  }, [client, id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (circle) setReactCount(circle.reactCount ?? 0)
  }, [circle])

  const handleReact = async () => {
    if (reacting || reacted || !client) return
    setReacting(true)
    try {
      await client.activities.react({ postId: circle.id, emoji: '❤️', name: 'heart' })
      setReacted(true)
      setReactCount((n) => n + 1)
    } catch {}
    setReacting(false)
  }

  // Scroll-driven shadow on sticky header
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let parent = el.parentElement
    while (parent && getComputedStyle(parent).overflowY === 'visible') parent = parent.parentElement
    if (!parent) return
    const handleScroll = () => setShadowProgress(Math.min(parent.scrollTop / 60, 1))
    parent.addEventListener('scroll', handleScroll, { passive: true })
    return () => parent.removeEventListener('scroll', handleScroll)
  }, [])

  // Seed edit fields from circle data
  const startEditing = () => {
    setEditName(circle.name ?? '')
    setEditSummary(circle.summary ?? '')
    setEditTo(circle.to ?? '@public')
    setEditIconFile(null)
    setEditIconPreview(circle.icon ?? null)
    setSaveError(null)
    setEditing(true)
  }

  const cancelEditing = () => {
    if (editIconPreview && editIconPreview !== circle.icon) {
      URL.revokeObjectURL(editIconPreview)
    }
    setEditing(false)
    setEditIconFile(null)
    setEditIconPreview(null)
  }

  const handleIconChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (editIconPreview && editIconPreview !== circle.icon) URL.revokeObjectURL(editIconPreview)
    setEditIconFile(file)
    setEditIconPreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    if (!editName.trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      let iconValue = circle.icon

      if (editIconFile) {
        const uploaded = await client.files.upload({
          file: editIconFile,
          filename: editIconFile.name,
          contentType: editIconFile.type,
          to: '@public',
        })
        if (uploaded?.file?.url) iconValue = uploaded.file.url
      }

      await client.activities.updateCircle({
        circleId: circle.id,
        name: editName.trim(),
        description: editSummary.trim(),
        icon: iconValue,
        to: editTo,
      })

      setCircle((prev) => ({
        ...prev,
        name: editName.trim(),
        summary: editSummary.trim(),
        icon: iconValue,
        to: editTo,
      }))
      setEditing(false)
    } catch (err) {
      setSaveError(err.message || 'Failed to save changes.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(t('circle.confirmDelete', { defaultValue: 'Delete this circle? This cannot be undone.' }))) return
    setDeleting(true)
    try {
      await client.activities.deleteCircle({ circleId: circle.id })
      navigate('/circles', { replace: true })
    } catch (err) {
      setError(err.message || 'Failed to delete circle.')
      setDeleting(false)
    }
  }

  const doRemoveMember = async (memberId) => {
    setRemovingId(memberId)
    try {
      await client.activities.removeFromCircle({ circleId: circle.id, memberId })
      setMembers((prev) => prev.filter((m) => m.id !== memberId))
      setCircle((prev) => ({ ...prev, memberCount: (prev.memberCount ?? members.length) - 1 }))
    } catch {}
    finally { setRemovingId(null) }
  }

  // Removing someone from Blocked = unblocking them — a real, reversible-only-
  // by-re-blocking action, so it gets a confirmation instead of firing on tap
  // like a normal circle's member removal does.
  const handleRemoveMember = (memberId) => {
    if (circle.id === authUser?.blocked) {
      const member = members.find((m) => m.id === memberId)
      setConfirmUnblock(member || { id: memberId })
      return
    }
    doRemoveMember(memberId)
  }

  const confirmUnblockNow = () => {
    if (!confirmUnblock) return
    doRemoveMember(confirmUnblock.id)
    setConfirmUnblock(null)
  }

  const handleMemberAdded = (member) => {
    setMembers((prev) => [...prev, member])
    setCircle((prev) => ({ ...prev, memberCount: (prev.memberCount ?? members.length) + 1 }))
  }

  if (loading) return <Spinner centered />
  if (error)   return <ErrorState message={error} onRetry={load} />
  if (!circle) return null

  const isOwner   = !!(authUser && circle.actorId === authUser.id)
  const isLoggedIn = !!authUser
  // System circles (Following, All Following, Groups, Blocked, Muted) are
  // fixed identity, not user content — name/description/icon are locked and
  // they can never be deleted. Membership and visibility stay fully editable.
  const isSystem = circle.type === 'System'
  // System-managed circles (Blocked/Muted/Groups) skip the friendly finder nudge.
  const isSystemManaged = isSystem && ['Blocked', 'Muted', 'Groups'].includes(circle.name)
  const isBlockedCircle = isSystem && circle.name === 'Blocked'
  const isMutedCircle = isSystem && circle.name === 'Muted'
  const showFinder = isOwner && members.length === 0 && !isSystemManaged
  const currentIcon = editing ? editIconPreview : circle.icon

  return (
    <div ref={containerRef} className="flex flex-col gap-8">

      {/* Sticky header */}
      <div
        className="sticky top-0 bg-base-100 z-10 flex flex-col gap-4 pt-6 pb-6 px-4 border-b-2 border-base-300"
        style={{
          filter: `drop-shadow(${shadowProgress * 8}px ${shadowProgress * 8}px ${shadowProgress * 2}px rgba(0,0,0,${(shadowProgress * 0.35).toFixed(3)}))`,
          transform: `translate(${shadowProgress * -3}px, ${shadowProgress * -3}px)`,
        }}
      >
        <div className="flex items-start gap-4">

          {/* Icon — clickable in edit mode */}
          <button
            type="button"
            onClick={() => editing && !isSystem && iconInputRef.current?.click()}
            className={editing && !isSystem ? 'cursor-pointer opacity-80 hover:opacity-100 transition-opacity shrink-0' : 'shrink-0 cursor-default'}
            aria-label={editing && !isSystem ? t('circle.changeIcon', { defaultValue: 'Change icon' }) : undefined}
          >
            {currentIcon
              ? <img src={sizedUrl(currentIcon, 200)} alt={circle.name} className="w-20 h-20 object-cover" style={hexMask} />
              : <div className="w-20 h-20 bg-secondary flex items-center justify-center" style={hexMask}>
                  <CircleIcon type="circle" size="lg" className="text-secondary-content opacity-70" />
                </div>
            }
          </button>
          <input
            ref={iconInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleIconChange}
          />

          {/* Info */}
          <div className="flex flex-col gap-3 min-w-0 pt-1 flex-1">
            {editing && !isSystem ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="font-display text-4xl leading-none tracking-wide bg-transparent border-b-2 border-primary focus:outline-none w-full"
              />
            ) : (
              <h1 className="font-display text-4xl leading-none tracking-wide">{circle.name}</h1>
            )}

            <div className="flex items-center gap-2 font-ui text-xs uppercase tracking-widest text-base-content/60">
              {circle.actorId && (
                <Link to={`/users/${encodeURIComponent(circle.actorId)}`} className="hover:text-primary transition-colors">
                  {circle.actor?.name ?? circle.actorId}
                </Link>
              )}
              <span>·</span>
              <span>{members.length} {t('circle.members', { defaultValue: 'members' })}</span>
              {reactCount > 0 && (
                <><span>·</span><span>{reactCount} {t('circle.reacts', { defaultValue: 'reacts' })}</span></>
              )}
            </div>

            {editing && !isSystem ? (
              <textarea
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
                rows={3}
                placeholder={t('circle.descriptionPlaceholder', { defaultValue: 'Description (optional)' })}
                className="font-reading text-base bg-base-200 border border-base-300 px-3 py-2 focus:outline-none focus:border-primary resize-none w-full"
              />
            ) : circle.summary ? (
              <p className="font-reading text-base text-base-content/80 leading-relaxed">{circle.summary}</p>
            ) : null}

            {editing ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-3">
                  <label className="font-ui text-xs uppercase tracking-widest text-base-content/60">
                    {t('circle.visibility', { defaultValue: 'Visibility' })}
                  </label>
                  <select
                    value={editTo}
                    onChange={(e) => setEditTo(e.target.value)}
                    className="bg-base-200 border border-base-300 px-3 py-1.5 font-ui text-xs focus:outline-none focus:border-primary"
                  >
                    {visibilityOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                {(isBlockedCircle || isMutedCircle) && editTo === '@public' && (
                  <p className="font-ui text-xs text-base-content/60 max-w-md">
                    {isBlockedCircle
                      ? t('circle.publicBlockedWarning', {
                          defaultValue: "This isn't a display setting — anyone, including the people and servers on this list, will be able to browse who you've blocked. Some people use a public blocklist on purpose, as a community-defense signal. Private by default; you're choosing to share it.",
                        })
                      : t('circle.publicMutedWarning', {
                          defaultValue: "This isn't a display setting — anyone will be able to browse who you've muted. Private by default; you're choosing to share it.",
                        })}
                  </p>
                )}
              </div>
            ) : null}

            {saveError && <p className="font-ui text-xs text-error">{saveError}</p>}

            {!editing && (
              <Link
                to={`/circles/${encodeURIComponent(circle.id)}/posts`}
                className="self-start flex items-center gap-2 px-4 py-2 bg-base-200 hover:bg-base-300 font-ui text-xs uppercase tracking-widest text-base-content/70 hover:text-base-content transition-colors"
              >
                {t('circle.postsLink')}
              </Link>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col items-end gap-2 shrink-0 pt-1">
            {editing ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={!editName.trim() || saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest hover:bg-primary/80 transition-colors disabled:opacity-40"
                >
                  {saving ? <Loader size={12} className="animate-spin" /> : <Check size={12} />}
                  {t('common.save', { defaultValue: 'Save' })}
                </button>
                <button
                  onClick={cancelEditing}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-base-300 font-ui text-xs uppercase tracking-widest text-base-content/60 hover:border-primary hover:text-primary transition-colors"
                >
                  <X size={12} /> {t('common.cancel', { defaultValue: 'Cancel' })}
                </button>
              </>
            ) : (
              <>
                {isLoggedIn && (
                  <CopyCircleMenu circle={{ ...circle, members }} />
                )}
                <button
                  onClick={() => setSharing(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-base-300 font-ui text-xs uppercase tracking-widest text-base-content/60 hover:border-primary hover:text-primary transition-colors"
                >
                  <Share2 size={12} /> {t('circle.share')}
                </button>
                {isLoggedIn && (
                  <button
                    onClick={handleReact}
                    disabled={reacting || reacted}
                    className={`flex items-center gap-1.5 px-3 py-1.5 border font-ui text-xs uppercase tracking-widest transition-colors disabled:cursor-default ${
                      reacted
                        ? 'border-error/40 text-error'
                        : 'border-base-300 text-base-content/60 hover:border-error hover:text-error'
                    }`}
                  >
                    <Heart size={12} fill={reacted ? 'currentColor' : 'none'} />
                    {reactCount > 0 ? reactCount : t('circle.heart', { defaultValue: 'Heart' })}
                  </button>
                )}
                {authUser?.isServerAdmin && (
                  <button
                    onClick={() => setDiscoveryOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-base-300 font-ui text-xs uppercase tracking-widest text-base-content/60 hover:border-primary hover:text-primary transition-colors"
                  >
                    <Compass size={12} /> {t('discovery.addTitle', { defaultValue: 'Add to Discovery' })}
                  </button>
                )}
                {isOwner && (
                  <>
                    <button
                      onClick={startEditing}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-base-300 font-ui text-xs uppercase tracking-widest text-base-content/60 hover:border-primary hover:text-primary transition-colors"
                    >
                      <Pencil size={12} />
                      {isSystem ? t('circle.editVisibility', { defaultValue: 'Edit Visibility' }) : t('common.edit')}
                    </button>
                    {/* System circles (Following, Groups, Blocked, Muted, …) are
                        fixed identity — never deletable, see isSystem above. */}
                    {!isSystem && (
                      <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-error/40 font-ui text-xs uppercase tracking-widest text-error/60 hover:border-error hover:text-error disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <Trash2 size={12} /> {deleting ? t('common.deleting', { defaultValue: 'Deleting…' }) : t('common.delete')}
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </div>

        </div>
      </div>

      {/* Members */}
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-2xl tracking-wide">{t('circle.members')}</h2>

        {isOwner && (
          <AddMemberRow circleId={circle.id} onAdded={handleMemberAdded} />
        )}

        {members.length > 0 ? (
          <div className="flex flex-col border-t border-base-300">
            {members.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                isOwner={isOwner}
                onRemove={handleRemoveMember}
                removing={removingId === member.id}
              />
            ))}
          </div>
        ) : showFinder ? (
          <div className="flex flex-col gap-3 border-t border-base-300 pt-4">
            <p className="font-ui text-sm text-base-content/80 leading-relaxed">
              Add people or communities to your Circles to follow them.
            </p>
            <p className="font-ui text-sm text-base-content/70 leading-relaxed">
              Looking for people and communities to add? Start with your{' '}
              <button
                type="button"
                onClick={() => { dispatch(setView('all')); navigate('/') }}
                className="text-primary font-semibold hover:underline"
              >
                Community Posts
              </button>{' '}
              or <Link to="/discover" className="text-primary font-semibold hover:underline">Discover</Link> new and cool stuff!
            </p>
            <p className="font-ui text-xs text-base-content/55 leading-relaxed">
              Tip: You can add any Kowloon user or even a community to any of your Circles.
            </p>
          </div>
        ) : (
          <p className="font-ui text-sm uppercase tracking-widest text-base-content/45">
            {t('circle.noMembers', { defaultValue: 'No members yet.' })}
          </p>
        )}
      </div>

      {sharing && (
        <PostComposer
          defaultOpen
          initialValues={{
            type: 'Link',
            href: `${window.location.origin}/circles/${encodeURIComponent(circle.id)}`,
            title: circle.name,
            content: circle.summary
              ? circle.summary.split('\n').map((l) => `> ${l}`).join('\n')
              : '',
            featuredImage: circle.icon ?? null,
            target: circle.id,
            to: 'public',
          }}
          onClose={() => setSharing(false)}
          onPostCreated={() => setSharing(false)}
          prompt={t('composer.shareCirclePrompt', { defaultValue: 'Share this circle\u2026' })}
        />
      )}

      {confirmUnblock && (
        <Modal
          open
          title={t('circle.unblockTitle', { defaultValue: 'Unblock?' })}
          onClose={() => setConfirmUnblock(null)}
        >
          <p className="font-reading text-base text-base-content/80 leading-relaxed mb-5">
            {isServerMember(confirmUnblock.id)
              ? t('circle.unblockServerBody', {
                  domain: confirmUnblock.id.slice(1),
                  defaultValue: `Unblock the whole server ${confirmUnblock.id.slice(1)}? Everyone on that server will be able to reach you again.`,
                })
              : t('circle.unblockUserBody', {
                  name: confirmUnblock.name ?? confirmUnblock.id,
                  defaultValue: `Unblock ${confirmUnblock.name ?? confirmUnblock.id}? They'll be able to interact with you again.`,
                })}
          </p>
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => setConfirmUnblock(null)}
              className="px-4 py-2 border border-base-300 font-ui text-xs uppercase tracking-widest text-base-content/60 hover:border-primary hover:text-primary transition-colors"
            >
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </button>
            <button
              onClick={confirmUnblockNow}
              className="px-4 py-2 bg-error text-error-content font-ui text-xs uppercase tracking-widest hover:opacity-90 transition-opacity"
            >
              {t('circle.unblockConfirm', { defaultValue: 'Unblock' })}
            </button>
          </div>
        </Modal>
      )}

      {authUser?.isServerAdmin && (
        <AddToDiscoveryModal
          item={circle}
          refType="Circle"
          open={discoveryOpen}
          onClose={() => setDiscoveryOpen(false)}
        />
      )}

    </div>
  )
}
