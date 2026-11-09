// LazyRichTextEditor -- drop-in for RichTextEditor that loads TipTap on first
// render instead of in the main bundle. Same props. Fallback is null, which
// matches RichTextEditor itself (it renders nothing until its editor exists).
import { lazy, Suspense } from 'react'
import { loadRichTextEditor } from './richTextEditorLoader'

const RichTextEditor = lazy(loadRichTextEditor)

export default function LazyRichTextEditor(props) {
  return (
    <Suspense fallback={null}>
      <RichTextEditor {...props} />
    </Suspense>
  )
}
