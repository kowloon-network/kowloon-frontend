// ThemeForm -- create or edit a site Theme. Used by AdminThemeEditPage for
// both /admin/themes/new and /admin/themes/:id/edit.

import { useState } from 'react'
import { HexColorPicker, HexColorInput } from 'react-colorful'
import Modal from '../../ui/Modal'

// DaisyUI v5 color tokens, grouped and plain-language labeled for admins who
// don't know CSS. The raw token name is still shown as a small hint underneath
// each field for anyone who does want to cross-reference it against the CSS.
const TOKEN_GROUPS = [
  {
    title: 'Backgrounds & Text',
    tokens: [
      { key: 'base-100', label: 'Page Background', hint: 'The main background behind all content' },
      { key: 'base-200', label: 'Card Background', hint: 'Cards, panels, and hover states' },
      { key: 'base-300', label: 'Borders & Dividers', hint: 'Lines between sections and around boxes' },
      { key: 'base-content', label: 'Body Text', hint: 'The default text color' },
    ],
  },
  {
    title: 'Primary Color',
    tokens: [
      { key: 'primary', label: 'Primary Color', hint: 'Buttons, links, and highlights' },
      { key: 'primary-content', label: 'Text on Primary', hint: 'Text and icons shown on the primary color' },
    ],
  },
  {
    title: 'Secondary Color',
    tokens: [
      { key: 'secondary', label: 'Secondary Color', hint: 'Sidebar and secondary buttons' },
      { key: 'secondary-content', label: 'Text on Secondary', hint: 'Text and icons shown on the secondary color' },
    ],
  },
  {
    title: 'Accent Color',
    tokens: [
      { key: 'accent', label: 'Accent Color', hint: 'Extra highlights and decorative touches' },
      { key: 'accent-content', label: 'Text on Accent', hint: 'Text and icons shown on the accent color' },
    ],
  },
  {
    title: 'Dark Surface',
    tokens: [
      { key: 'neutral', label: 'Dark Surface', hint: 'Dark menus and panels' },
      { key: 'neutral-content', label: 'Text on Dark Surface', hint: 'Text and icons on dark panels' },
    ],
  },
  {
    title: 'Status Colors',
    tokens: [
      { key: 'info', label: 'Info Color', hint: 'Informational messages' },
      { key: 'info-content', label: 'Text on Info', hint: '' },
      { key: 'success', label: 'Success Color', hint: 'Confirmations and successful actions' },
      { key: 'success-content', label: 'Text on Success', hint: '' },
      { key: 'warning', label: 'Warning Color', hint: 'Warnings and caution messages' },
      { key: 'warning-content', label: 'Text on Warning', hint: '' },
      { key: 'error', label: 'Error Color', hint: 'Errors and destructive actions' },
      { key: 'error-content', label: 'Text on Error', hint: '' },
    ],
  },
]

const COLOR_TOKENS = TOKEN_GROUPS.flatMap((g) => g.tokens.map((t) => t.key))

const POST_COLOR_FIELDS = [
  { key: 'note', label: 'Note Posts' },
  { key: 'article', label: 'Article Posts' },
  { key: 'media', label: 'Media Posts' },
  { key: 'link', label: 'Link Posts' },
  { key: 'event', label: 'Event Posts' },
]
const POST_COLOR_KEYS = POST_COLOR_FIELDS.map((f) => f.key)

const BLANK_COLORS = Object.fromEntries(COLOR_TOKENS.map((t) => [t, '']))
const BLANK_POST_COLORS = Object.fromEntries(POST_COLOR_KEYS.map((k) => [k, '#888888']))

const BLANK_THEME = {
  id: '', name: '', description: '', colorScheme: 'light',
  colors: { ...BLANK_COLORS },
  postColors: { ...BLANK_POST_COLORS },
}

// <input type="color"> only accepts a plain #rrggbb value -- fall back to a
// neutral gray when the stored value is an oklch(...) string (or anything
// else it can't parse) so the picker still opens instead of silently no-oping.
const HEX_RE = /^#[0-9a-f]{6}$/i
const swatchValue = (v) => (HEX_RE.test(v) ? v : '#888888')

// The actual picker UI, only ever mounted while the modal is open (see
// ColorPickerModal below) -- that makes `useState(() => swatchValue(value))`
// the right tool for seeding `draft` from the current value: a fresh mount
// on every open naturally re-seeds it, no effect/setState-in-effect needed.
function ColorPickerModalBody({ value, onClose, onPick }) {
  const [draft, setDraft] = useState(() => swatchValue(value))

  return (
    <div className="flex flex-col items-center gap-4">
      <HexColorPicker
        color={draft}
        onChange={setDraft}
        style={{ width: '100%', maxWidth: 260 }}
      />
      <div className="flex items-center gap-2 w-full max-w-[260px]">
        <span
          style={{ background: draft, width: 28, height: 28, flexShrink: 0 }}
          className="border border-base-300"
        />
        <HexColorInput
          color={draft}
          onChange={setDraft}
          prefixed
          className="flex-1 min-w-0 border border-base-300 focus:border-primary bg-base-100 px-2 py-1.5 font-mono text-sm outline-none"
        />
      </div>
      <div className="flex gap-3 w-full max-w-[260px]">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 px-4 py-2 border border-base-300 font-ui text-xs uppercase tracking-widest hover:bg-base-200 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => { onPick(draft); onClose() }}
          className="flex-1 px-4 py-2 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest"
        >
          Use Color
        </button>
      </div>
    </div>
  )
}

// Picker modal: a real spectrum + hue slider (react-colorful), not the
// browser's native <input type="color"> -- Android Chrome's version of that
// is just a fixed row of ~8 preset swatches with no spectrum at all, and
// desktop/iOS pickers vary wildly by OS. This renders identically everywhere.
// Seeds from the current value (falling back to gray for a non-hex value
// like an oklch(...) string, which react-colorful can't parse either) and
// only writes back on "Use Color" -- Cancel discards the draft.
function ColorPickerModal({ open, label, value, onClose, onPick }) {
  return (
    <Modal open={open} onClose={onClose} title={label}>
      {open && <ColorPickerModalBody value={value} onClose={onClose} onPick={onPick} />}
    </Modal>
  )
}

// Color field: a swatch showing the TRUE current color (its background is
// set directly from the value, so oklch(...) renders correctly) that opens
// a ColorPickerModal, plus a text field for exact values. The plain-language
// label leads; the raw CSS token name is a small mono hint underneath.
function ColorInput({ label, hint, token, value, onChange }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  return (
    <div className="flex flex-col gap-1">
      <div>
        <label className="font-ui text-xs text-base-content/80">{label}</label>
        {hint && <p className="font-reading text-[11px] text-base-content/40 italic">{hint}</p>}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          style={{ background: value || '#888888' }}
          title="Pick a color"
          className="w-9 h-9 shrink-0 border border-base-300 cursor-pointer"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#hex or oklch(...)"
          className="flex-1 min-w-0 border border-base-300 focus:border-primary bg-base-100 px-2 py-1.5 font-mono text-[11px] outline-none"
        />
      </div>
      <span className="font-mono text-[10px] text-base-content/30">{token}</span>

      <ColorPickerModal
        open={pickerOpen}
        label={label}
        value={value}
        onClose={() => setPickerOpen(false)}
        onPick={onChange}
      />
    </div>
  )
}

// Create/Edit form. `initial` set = edit; absent = new (seeded from Light).
export default function ThemeForm({ initial, presets, onSave, onCancel }) {
  const isEdit = !!initial?.id
  const lightPreset = presets?.light
  const darkPreset = presets?.dark

  const [form, setForm] = useState(() => {
    if (initial) {
      return {
        ...BLANK_THEME,
        ...initial,
        colors: { ...BLANK_COLORS, ...(initial.colors ?? {}) },
        postColors: { ...BLANK_POST_COLORS, ...(initial.postColors ?? {}) },
      }
    }
    // New theme: start from the site's Light preset so the admin edits real,
    // already-good colors instead of facing a wall of blank fields.
    return {
      ...BLANK_THEME,
      colorScheme: 'light',
      colors: { ...BLANK_COLORS, ...(lightPreset?.colors ?? {}) },
      postColors: { ...BLANK_POST_COLORS, ...(lightPreset?.postColors ?? {}) },
    }
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const setColor = (key, val) =>
    setForm((f) => ({ ...f, colors: { ...f.colors, [key]: val } }))
  const setPostColor = (key, val) =>
    setForm((f) => ({ ...f, postColors: { ...f.postColors, [key]: val } }))

  const applyPreset = (preset, scheme) => {
    if (!preset) return
    setForm((f) => ({
      ...f,
      colorScheme: scheme,
      colors: { ...BLANK_COLORS, ...(preset.colors ?? {}) },
      postColors: { ...BLANK_POST_COLORS, ...(preset.postColors ?? {}) },
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      // Strip empty color strings -- server ignores undefined tokens
      const colors = Object.fromEntries(Object.entries(form.colors).filter(([, v]) => v.trim()))
      const postColors = Object.fromEntries(Object.entries(form.postColors).filter(([, v]) => v.trim()))
      await onSave({ ...form, colors, postColors })
    } catch (err) {
      setError(err?.message || 'Save failed')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">

      {error && <p className="font-ui text-xs text-error">{error}</p>}

      {/* Start from a preset -- fills every field below in one click */}
      {(lightPreset || darkPreset) && (
        <div className="flex flex-col gap-1.5">
          <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">Start From</label>
          <div className="flex gap-2">
            {lightPreset && (
              <button
                type="button"
                onClick={() => applyPreset(lightPreset, 'light')}
                className="px-4 py-2 border-2 border-base-300 hover:border-primary font-ui text-xs uppercase tracking-widest transition-colors"
              >
                Light Theme
              </button>
            )}
            {darkPreset && (
              <button
                type="button"
                onClick={() => applyPreset(darkPreset, 'dark')}
                className="px-4 py-2 border-2 border-base-300 hover:border-primary font-ui text-xs uppercase tracking-widest transition-colors"
              >
                Dark Theme
              </button>
            )}
          </div>
          <p className="font-reading text-xs text-base-content/40 italic">
            Fills in every color below as a starting point -- change any of them afterward.
          </p>
        </div>
      )}

      {/* Basic info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {!isEdit && (
          <div className="flex flex-col gap-1">
            <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">ID *</label>
            <input required value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
              placeholder="my-theme"
              className="border-2 border-base-300 focus:border-primary bg-base-100 px-3 py-2 font-mono text-sm outline-none" />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">Name *</label>
          <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="border-2 border-base-300 focus:border-primary bg-base-100 px-3 py-2 font-ui text-sm outline-none" />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">Description</label>
          <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="border-2 border-base-300 focus:border-primary bg-base-100 px-3 py-2 font-ui text-sm outline-none" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">Color Scheme</label>
          <div className="flex gap-0">
            {['light', 'dark', 'system'].map((s) => (
              <button key={s} type="button" onClick={() => setForm((f) => ({ ...f, colorScheme: s }))}
                className={`px-4 py-2 font-ui text-xs uppercase tracking-widest border-r border-base-300 last:border-r-0 transition-colors ${
                  form.colorScheme === s ? 'bg-secondary text-secondary-content' : 'bg-base-200 text-base-content/60 hover:bg-base-300'
                }`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Color tokens */}
      {form.colorScheme !== 'system' && (
        <>
          <div className="flex flex-col gap-6">
            <h3 className="font-display text-lg tracking-wide border-b border-base-300 pb-1">UI Colors</h3>
            {TOKEN_GROUPS.map((group) => (
              <div key={group.title} className="flex flex-col gap-3">
                <h4 className="font-ui text-xs uppercase tracking-widest text-base-content/50">{group.title}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {group.tokens.map((t) => (
                    <ColorInput
                      key={t.key}
                      token={t.key}
                      label={t.label}
                      hint={t.hint}
                      value={form.colors[t.key] ?? ''}
                      onChange={(v) => setColor(t.key, v)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div>
            <h3 className="font-display text-lg tracking-wide border-b border-base-300 pb-1 mb-1">Post Type Colors</h3>
            <p className="font-reading text-xs text-base-content/40 italic mb-3">
              The accent color shown next to each kind of post in the feed.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {POST_COLOR_FIELDS.map(({ key, label }) => (
                <ColorInput
                  key={key}
                  token={key}
                  label={label}
                  value={form.postColors[key] ?? ''}
                  onChange={(v) => setPostColor(key, v)}
                />
              ))}
            </div>
          </div>
        </>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="px-5 py-2 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest disabled:opacity-50">
          {saving ? 'Saving...' : (isEdit ? 'Save changes' : 'Create theme')}
        </button>
        <button type="button" onClick={onCancel}
          className="px-5 py-2 border border-base-300 font-ui text-xs uppercase tracking-widest hover:bg-base-200 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  )
}
