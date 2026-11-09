// ServerInfo — server description (HTML) and location.
// Icon and name live in the header; this is the supplementary block.

import { useSelector } from 'react-redux'
import { MapPin } from 'lucide-react'
import sizedUrl from '../../lib/sizedUrl'
import SafeHtml from './SafeHtml'

export default function ServerInfo() {
  const server   = useSelector((state) => state.server)
  const location = server.settings?.profile?.location

  if (server.status !== 'succeeded') return null
  if (!server.image && !server.description && !location?.name) return null

  return (
    <div className="flex flex-col gap-3 border-b-2 border-base-300 pb-5">
      {server.image && (
        // Mobile: -mx-6 escapes the drawer's p-6 so the image is flush to the
        // drawer edges. Desktop: pull -1rem left to escape the layout wrapper's
        // px-4 so the hero bleeds to the page's outer left edge; right margin
        // stays at the column boundary so we don't intrude into the gap.
        <div className="-mt-6 -mx-6 lg:ml-[-1rem] lg:mr-[0]">
          <img
            src={sizedUrl(server.image, 400)}
            alt=""
            className="w-full aspect-video object-cover"
          />
        </div>
      )}

      {server.description && (
        <SafeHtml
          html={server.description}
          className="font-reading text-sm text-base-content/80 leading-relaxed"
        />
      )}

      {location?.name && (
        <div className="flex items-center gap-2 font-ui text-xs uppercase tracking-widest text-base-content/55">
          <MapPin size={14} className="shrink-0" />
          <span>{location.name}</span>
        </div>
      )}
    </div>
  )
}
