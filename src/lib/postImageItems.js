// Helpers that turn post attachments into PostImages.jsx layout items.
// Kept out of PostImages.jsx so that file only exports components (fast refresh).

// image | video | audio | file, from an attachment's mediaType.
export function attachmentKind(att) {
  const mt = att?.mediaType ?? ''
  if (mt.startsWith('image/')) return 'image'
  if (mt.startsWith('video/')) return 'video'
  if (mt.startsWith('audio/')) return 'audio'
  return 'file'
}

// Attachment (rich object or bare URL string) -> ImageRows item.
export function toLayoutItem(att, kind = attachmentKind(att)) {
  if (typeof att === 'string') return { uri: att, kind }
  return {
    uri: att?.url || att?.href || '',
    kind,
    mediaType: att?.mediaType,
    width: att?.width,
    height: att?.height,
    focus: att?.focus,
    alt: att?.alt || att?.summary || att?.name || '',
  }
}

