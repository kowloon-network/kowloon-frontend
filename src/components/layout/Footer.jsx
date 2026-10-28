// Site footer — legal links.
//
// Deliberately rendered INSIDE the main scroll column rather than as another
// row of the layout's flex/grid. The shell is a fixed-height h-[100svh] grid
// whose columns scroll independently, and its gap-16 is load-bearing for
// alignment (see the grid-replication notes); adding a row would eat vertical
// space from the panes and risk that alignment. Sitting at the end of the
// scrolled content is also the conventional place for a footer.
//
// Links are same-origin: the server serves both the API and the frontend, and
// publishes these as Pages (scripts/seed-legal-pages.js).

import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function Footer() {
  const { t } = useTranslation()
  const year = new Date().getFullYear()

  return (
    <footer className="mt-12 pt-5 border-t border-base-300">
      <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Link
          to="/pages/terms"
          className="font-ui text-xs uppercase tracking-widest text-base-content/50 hover:text-primary transition-colors"
        >
          {t('footer.terms', { defaultValue: 'Terms' })}
        </Link>
        <Link
          to="/pages/privacy"
          className="font-ui text-xs uppercase tracking-widest text-base-content/50 hover:text-primary transition-colors"
        >
          {t('footer.privacy', { defaultValue: 'Privacy' })}
        </Link>
        <Link
          to="/pages/rules"
          className="font-ui text-xs uppercase tracking-widest text-base-content/50 hover:text-primary transition-colors"
        >
          {t('footer.rules', { defaultValue: 'Rules' })}
        </Link>
        <a
          href="https://kowloon.network"
          target="_blank"
          rel="noopener noreferrer"
          className="font-ui text-xs uppercase tracking-widest text-base-content/50 hover:text-primary transition-colors"
        >
          {t('footer.poweredBy', { defaultValue: 'Powered by Kowloon' })}
        </a>
      </nav>
      <p className="font-ui text-[11px] text-base-content/35 mt-3">
        &copy; {year}
      </p>
    </footer>
  )
}
