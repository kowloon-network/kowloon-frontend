import { useEffect, useState, useRef } from 'react'
import FocusTrap from 'focus-trap-react'
import { Play, Music, X, ChevronLeft, ChevronRight } from 'lucide-react'
import AudioPlayer from './AudioPlayer'

// Width of the dimmed edge-peek strip, and how dim. A narrow, fixed-size
// strip cropped via object-cover — NOT a slice of the real object-contain
// carousel slide. That's deliberate: object-contain images are letterboxed
// to fit the viewport, so on anything but a full-bleed photo (tall/square
// images on a wide screen, landscape on a tablet, etc.) the real image often
// doesn't reach the screen edge at all — a peek anchored to "the edge of the
// real slide" ends up sitting in dead black space, invisible. A fixed-size
// object-cover strip pinned to the true viewport edge is always full of
// (cropped) content, so it's visible regardless of the current photo's own
// aspect ratio / letterboxing.
const EDGE_PEEK_WIDTH = 'w-7 sm:w-10'
const EDGE_PEEK_DIM = 0.45

// Caption bar for the currently-shown image — translucent black bg, bottom of
// the frame. Renders nothing when the attachment has no title (most don't).
function ImageCaption({ item }) {
  if (!item?.name) return null
  return (
    <div
      className="absolute inset-x-0 bottom-0 px-4 py-2.5 pointer-events-none"
      style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0) 100%)' }}
    >
      <span className="font-ui text-sm text-white/90 drop-shadow-sm">{item.name}</span>
    </div>
  )
}

export default function MediaLightbox({ items, index, onClose, onNavigate, edgePeek = false }) {
  const item = items[index]
  const mt = item?.mediaType ?? ''
  const touchStart = useRef(null)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [snap, setSnap] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  const zoomScrollRef = useRef(null)
  const closeRef = useRef(null)
  const rootRef = useRef(null)

  // Reset zoom when navigating to a different item.
  useEffect(() => { setZoomed(false) }, [index])

  // Center the image when entering zoom mode (image renders at 200% width).
  useEffect(() => {
    if (zoomed && zoomScrollRef.current) {
      const el = zoomScrollRef.current
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2
      el.scrollTop  = (el.scrollHeight - el.clientHeight) / 2
    }
  }, [zoomed])

  const isImage = mt.startsWith('image/')
  // Run the finger-tracking carousel whenever the current item is an image
  // (so swipes off-of an image always animate). Non-image neighbours render
  // as a typed placeholder during the swipe; the actual media player kicks
  // in after the commit lands on them.
  const canSlide = isImage && items.length > 1
  const prevItem = canSlide ? items[(index - 1 + items.length) % items.length] : null
  const nextItem = canSlide ? items[(index + 1) % items.length] : null

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && items.length > 1) onNavigate(-1)
      else if (e.key === 'ArrowRight' && items.length > 1) onNavigate(1)
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose, onNavigate, items.length])

  // Touch swipe — left swipe = next, right swipe = previous.
  // Images (when there's more than one) get a true finger-tracking carousel
  // animation; video/audio fall back to a simple threshold gesture so they
  // don't fight with the player's own touch handling.
  const onTouchStart = (e) => {
    if (zoomed) return
    touchStart.current = e.touches[0].clientX
    setDragging(true)
  }
  const onTouchMove = (e) => {
    if (zoomed || touchStart.current === null || !canSlide) return
    const dx = e.touches[0].clientX - touchStart.current
    setDragX(dx)
  }
  const onTouchEnd = (e) => {
    if (zoomed) return
    setDragging(false)
    if (touchStart.current === null || items.length <= 1) {
      touchStart.current = null
      return
    }
    const dx = e.changedTouches[0].clientX - touchStart.current
    touchStart.current = null

    if (!canSlide) {
      if (Math.abs(dx) < 50) return
      onNavigate(dx > 0 ? -1 : 1)
      return
    }

    // Image carousel: commit if past threshold, otherwise snap back to 0.
    const width = window.innerWidth
    const threshold = Math.min(80, width * 0.2)
    if (Math.abs(dx) < threshold) {
      setDragX(0)
      return
    }

    // Animate the track off-screen in the swipe direction, then on
    // transition end swap content and reset offset (without animation, via
    // the `snap` flag).
    const direction = dx > 0 ? 1 : -1
    setDragX(direction * width)
    setTimeout(() => {
      setSnap(true)
      setDragX(0)
      onNavigate(-direction)
      requestAnimationFrame(() => setSnap(false))
    }, 250)
  }
  const onTouchCancel = () => {
    setDragging(false)
    touchStart.current = null
    setDragX(0)
  }

  if (!item) return null

  const renderImage = (it) => (
    <img
      src={it.url}
      alt={it.alt || it.summary || it.name || ''}
      className="max-w-[95vw] max-h-[95vh] object-contain pointer-events-none select-none"
      draggable={false}
    />
  )

  // Lightweight static representation for non-image neighbours in the
  // carousel — we don't want to instantiate a video/audio player off-screen.
  // The real player renders when the slide commits.
  const renderCarouselSlide = (it) => {
    if (!it) return null
    const t = it.mediaType ?? ''
    if (t.startsWith('image/')) return renderImage(it)
    if (t.startsWith('video/')) {
      return (
        <div className="flex flex-col items-center gap-3 text-white/60 select-none">
          <Play size={64} />
          {it.name && <span className="font-ui text-xs uppercase tracking-widest">{it.name}</span>}
        </div>
      )
    }
    if (t.startsWith('audio/')) {
      return (
        <div className="flex flex-col items-center gap-3 text-white/60 select-none">
          <Music size={64} />
          {it.name && <span className="font-ui text-xs uppercase tracking-widest">{it.name}</span>}
        </div>
      )
    }
    return null
  }

  const trackTransition = dragging || snap ? 'none' : 'transform 250ms ease-out'

  // Focus trap: focus starts on Close, Tab stays in the lightbox, and focus
  // returns to the thumbnail that opened it. Escape/arrows handled above.
  return (
    <FocusTrap
      focusTrapOptions={{
        escapeDeactivates: false,
        allowOutsideClick: true,
        initialFocus: () => closeRef.current ?? rootRef.current,
        fallbackFocus: () => rootRef.current,
        returnFocusOnDeactivate: true,
      }}
    >
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center touch-pan-y overflow-hidden"
    >
      <button
        ref={closeRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose() }}
        aria-label="Close"
        className="absolute top-4 right-4 z-10 text-white/80 hover:text-white p-2"
      >
        <X size={28} />
      </button>

      {items.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onNavigate(-1) }}
            aria-label="Previous"
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 p-2 text-white bg-black/50 hover:bg-black/80 transition-colors hidden pointer-fine:block"
          >
            <ChevronLeft size={36} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onNavigate(1) }}
            aria-label="Next"
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 p-2 text-white bg-black/50 hover:bg-black/80 transition-colors hidden pointer-fine:block"
          >
            <ChevronRight size={36} />
          </button>
        </>
      )}

      {zoomed && isImage ? (
        // Zoomed view — image at 200% width inside a native scroll container.
        // Native two-finger pinch + pan handle further zoom and movement;
        // tapping the image (no drag) exits zoom.
        <div
          ref={zoomScrollRef}
          onClick={(e) => { e.stopPropagation(); setZoomed(false) }}
          className="absolute inset-0 overflow-auto"
          style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
        >
          <img
            src={item.url}
            alt={item.alt || item.summary || item.name || ''}
            draggable={false}
            className="block select-none cursor-zoom-out"
            style={{ width: '200%', maxWidth: 'none', height: 'auto' }}
          />
        </div>
      ) : canSlide ? (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0"
          style={{
            transform: `translateX(${dragX}px)`,
            transition: trackTransition,
          }}
        >
          <div className="absolute inset-0 -translate-x-full flex items-center justify-center">
            {renderCarouselSlide(prevItem)}
          </div>
          <div
            className="absolute inset-0 flex items-center justify-center cursor-zoom-in"
            onClick={(e) => { e.stopPropagation(); setZoomed(true) }}
          >
            {renderImage(item)}
            <ImageCaption item={item} />
          </div>
          <div className="absolute inset-0 translate-x-full flex items-center justify-center">
            {renderCarouselSlide(nextItem)}
          </div>
        </div>
      ) : (
        <div onClick={(e) => e.stopPropagation()} className="relative max-w-[95vw] max-h-[95vh] flex items-center justify-center">
          {isImage && (
            <img
              src={item.url}
              alt={item.alt || item.summary || item.name || ''}
              onClick={() => setZoomed(true)}
              draggable={false}
              className="max-w-[95vw] max-h-[95vh] object-contain cursor-zoom-in select-none"
            />
          )}
          {isImage && <ImageCaption item={item} />}
          {mt.startsWith('video/') && (
            <video controls autoPlay playsInline className="max-w-[95vw] max-h-[95vh] object-contain bg-black">
              <source src={item.url} type={mt} />
            </video>
          )}
          {mt.startsWith('audio/') && (
            <div className="w-[min(95vw,40rem)]">
              <AudioPlayer src={item.url} className="w-full aspect-video" />
            </div>
          )}
        </div>
      )}

      {/* Dimmed edge peeks — visual cue that there's more to see, pinned to
          the true viewport edge (see EDGE_PEEK_WIDTH comment for why it's a
          fixed cropped strip rather than a slice of the real slide). Bound to
          the live drag offset so it shifts with an active swipe instead of
          sitting static; rendered last so paint order is never in question. */}
      {edgePeek && canSlide && !zoomed && (
        <>
          {prevItem?.mediaType?.startsWith('image/') && (
            <div className={`absolute inset-y-0 left-0 ${EDGE_PEEK_WIDTH} overflow-hidden pointer-events-none`}>
              <img
                src={prevItem.url}
                alt=""
                draggable={false}
                className="absolute inset-y-0 left-0 h-full w-screen object-cover object-left"
                style={{
                  filter: `brightness(${EDGE_PEEK_DIM})`,
                  transform: `translateX(${dragX}px)`,
                  transition: trackTransition,
                }}
              />
            </div>
          )}
          {nextItem?.mediaType?.startsWith('image/') && (
            <div className={`absolute inset-y-0 right-0 ${EDGE_PEEK_WIDTH} overflow-hidden pointer-events-none`}>
              <img
                src={nextItem.url}
                alt=""
                draggable={false}
                className="absolute inset-y-0 right-0 h-full w-screen object-cover object-right"
                style={{
                  filter: `brightness(${EDGE_PEEK_DIM})`,
                  transform: `translateX(${dragX}px)`,
                  transition: trackTransition,
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
    </FocusTrap>
  )
}
