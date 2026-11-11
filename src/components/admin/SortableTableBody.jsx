// SortableTableBody -- drag-to-reorder rows for the admin's Pages and
// Bookmarks lists.
//
// Items nest one level (a page under a parent page, a bookmark in a folder),
// so rows are shown as a tree: each top-level item, then its children. An
// item can only be dragged among its siblings -- top-level among top-level,
// a folder's contents within that folder -- because order is stored per
// sibling group. The drop target list is filtered to siblings, so a row
// simply won't land anywhere else.
//
// Dragging uses a grip handle in the first cell (touch-friendly: the rest of
// the row still scrolls the page normally on a phone). Keyboard: focus the
// handle, Space to pick up, arrows to move, Space to drop.

import { useMemo } from 'react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

// Tree order: roots in the order given (the server already sorts by
// order, then newest first), each followed by its children. Children whose
// parent isn't in the list are treated as roots.
function treeOrder(items, parentKey) {
  const ids = new Set(items.map((i) => i.id))
  const parentOf = (i) => (i[parentKey] && ids.has(i[parentKey]) ? i[parentKey] : null)
  const kids = new Map()
  for (const i of items) {
    const p = parentOf(i)
    if (!kids.has(p)) kids.set(p, [])
    kids.get(p).push(i)
  }
  const out = []
  for (const root of kids.get(null) || []) {
    out.push({ item: root, depth: 0, parent: null })
    for (const c of kids.get(root.id) || []) out.push({ item: c, depth: 1, parent: root.id })
  }
  return out
}

function SortableRow({ row, enabled, renderCells, rowClassName }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: row.item.id, disabled: !enabled, data: { parent: row.parent } })
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    position: 'relative',
    zIndex: isDragging ? 10 : undefined,
  }
  const handle = enabled ? (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label="Drag to reorder"
      title="Drag to reorder"
      className="p-1 -ml-1 text-base-content/30 hover:text-base-content cursor-grab active:cursor-grabbing touch-none"
    >
      <GripVertical size={16} />
    </button>
  ) : <span className="inline-block w-[18px]" />
  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`${rowClassName(row.item)} ${isDragging ? 'bg-base-200 shadow-lg' : ''}`}
    >
      {renderCells(row.item, { handle, depth: row.depth })}
    </tr>
  )
}

export default function SortableTableBody({
  items,
  parentKey,
  enabled = true,
  onReorder,          // (siblingIdsInNewOrder) => void
  renderCells,        // (item, { handle, depth }) => <td>s
  rowClassName = () => '',
  empty = null,       // a <tr> to show when there are no items
}) {
  const rows = useMemo(() => treeOrder(items, parentKey), [items, parentKey])
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Only siblings of the dragged row are valid drop targets.
  const siblingsOnly = (args) => {
    const parent = args.active?.data?.current?.parent ?? null
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (c) => (c.data?.current?.parent ?? null) === parent,
      ),
    })
  }

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const parent = active.data?.current?.parent ?? null
    const siblings = rows.filter((r) => r.parent === parent).map((r) => r.item.id)
    const from = siblings.indexOf(active.id)
    const to = siblings.indexOf(over.id)
    if (from < 0 || to < 0) return
    onReorder(arrayMove(siblings, from, to))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={siblingsOnly} onDragEnd={handleDragEnd}>
      <SortableContext items={rows.map((r) => r.item.id)} strategy={verticalListSortingStrategy}>
        <tbody>
          {rows.map((row) => (
            <SortableRow key={row.item.id} row={row} enabled={enabled} renderCells={renderCells} rowClassName={rowClassName} />
          ))}
          {rows.length === 0 && empty}
        </tbody>
      </SortableContext>
    </DndContext>
  )
}
