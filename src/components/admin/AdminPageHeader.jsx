// Shared headers for the admin's list / new / edit pages (WordPress-style:
// every managed item type has a list page with a "New X" button at the top,
// and a separate page for creating or editing one item).

import { Link } from 'react-router-dom'
import { Plus, ArrowLeft } from 'lucide-react'

// Top of a list page: the title, and the "New X" button beside it.
export function AdminListHeader({ title, newTo, newLabel, aside }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-base-300 pb-4 mb-6">
      <h1 className="font-display text-4xl sm:text-5xl tracking-wide">{title}</h1>
      <div className="flex items-center gap-3">
        {aside}
        {newTo && (
          <Link
            to={newTo}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest hover:opacity-90 transition-opacity"
          >
            <Plus size={13} /> {newLabel}
          </Link>
        )}
      </div>
    </div>
  )
}

// Wrapper for a New / Edit page: a link back to the list, the title, then
// the form.
export function AdminFormShell({ backTo, backLabel, title, children }) {
  return (
    <div className="max-w-3xl">
      <Link
        to={backTo}
        className="inline-flex items-center gap-1.5 font-ui text-xs uppercase tracking-widest text-base-content/50 hover:text-primary transition-colors mb-3"
      >
        <ArrowLeft size={13} /> {backLabel}
      </Link>
      <h1 className="font-display text-4xl sm:text-5xl tracking-wide border-b-2 border-base-300 pb-4 mb-6">{title}</h1>
      {children}
    </div>
  )
}
