// Shown for any address the router doesn't know (the catch-all route in
// app/router.jsx). Renders inside PublicLayout so the masthead and
// navigation are still there to get back from.
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function NotFoundPage() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  return (
    <div className="flex flex-col items-center gap-5 py-20 text-center px-4">
      <p className="font-ui text-xs uppercase tracking-widest text-base-content/50">404</p>
      <h1 className="font-display text-3xl tracking-wide">
        {t('notFound.title', { defaultValue: "There's nothing at this address" })}
      </h1>
      <p className="font-reading text-sm text-base-content/70 max-w-prose">
        <span className="font-ui break-all">{pathname}</span>{' '}
        {t('notFound.body', {
          defaultValue: 'may have been mistyped, or what was here has been deleted.',
        })}
      </p>
      <Link
        to="/"
        className="px-6 py-2.5 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest hover:opacity-90"
      >
        {t('notFound.home', { defaultValue: 'Go to the home page' })}
      </Link>
    </div>
  )
}
