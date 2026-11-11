// Apply a drag-to-reorder result locally: give the listed sibling ids
// order 0..n-1, then re-sort the whole list the way the server does
// (order ascending, newest first as the tie-break).
export function applyOrder(items, ids) {
  const pos = new Map(ids.map((id, i) => [id, i]))
  return items
    .map((it) => (pos.has(it.id) ? { ...it, order: pos.get(it.id) } : it))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || new Date(b.createdAt) - new Date(a.createdAt))
}
