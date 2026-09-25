// RichTextEditor — TipTap WYSIWYG editor with Markdown output.
// Props: content (Markdown string), onChange, maxWords, autoFocus, editorClassName, postType

import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { Markdown } from 'tiptap-markdown'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, List, ListOrdered, Quote, Code,
  Link2, Link2Off, Undo2, Redo2,
} from 'lucide-react'

const countWords = (md) => md.trim().split(/\s+/).filter(Boolean).length

// Toolbar button sets per post type. StarterKit already loads bold, italic,
// strike, heading, bulletList, orderedList, blockquote and codeBlock (plus
// history for undo/redo); Underline + Link are separate extensions loaded
// below — so these are only which BUTTONS show, matching mobile's tentap
// toolbar (bold, italic, underline, strike, headings, lists, blockquote, code,
// link, undo/redo).
const TOOLBAR_BUTTONS = {
  Note:    ['bold', 'italic', 'underline', 'strike', 'bulletList', 'orderedList', 'blockquote', 'link', 'undo', 'redo'],
  Article: ['bold', 'italic', 'underline', 'strike', 'h1', 'h2', 'h3', 'bulletList', 'orderedList', 'blockquote', 'code', 'link', 'undo', 'redo'],
  Media:   ['bold', 'italic', 'underline', 'strike', 'bulletList', 'orderedList', 'blockquote', 'code', 'link', 'undo', 'redo'],
  Event:   ['bold', 'italic', 'underline', 'strike', 'h1', 'h2', 'h3', 'bulletList', 'orderedList', 'blockquote', 'code', 'link', 'undo', 'redo'],
  Link:    ['bold', 'italic', 'underline', 'strike', 'bulletList', 'orderedList', 'blockquote', 'code', 'link', 'undo', 'redo'],
}

const ICON_SIZE = 15

function ToolbarButton({ onClick, active, disabled = false, title, children }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => { e.preventDefault(); if (!disabled) onClick() }}
      className={`px-2.5 py-2 flex items-center justify-center transition-colors ${
        active
          ? 'text-primary'
          : 'text-base-content/60 hover:text-base-content'
      } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  )
}

export default function RichTextEditor({ content = '', onChange, maxWords, autoFocus = false, editorClassName = '', postType = 'Note' }) {
  const { t } = useTranslation()
  const lastValidDoc = useRef(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      Markdown,
    ],
    content,
    autofocus: autoFocus ? 'end' : false,
    onUpdate({ editor }) {
      const md = editor.storage.markdown.getMarkdown()

      if (maxWords && countWords(md) > maxWords) {
        if (lastValidDoc.current) {
          editor.commands.setContent(lastValidDoc.current, false)
        }
        return
      }

      lastValidDoc.current = editor.getJSON()
      onChange?.(md)
    },
  })

  if (!editor) return null

  const buttons = TOOLBAR_BUTTONS[postType] ?? TOOLBAR_BUTTONS.Note
  const has = (b) => buttons.includes(b)

  return (
    <div>
      {/* Toolbar — wraps when the button set is wide so it never overflows. */}
      <div className="flex flex-wrap gap-0 border-b border-base-300">
        {has('undo') && (
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            active={false}
            disabled={!editor.can().undo()}
            title={t('editor.undo', { defaultValue: 'Undo' })}
          >
            <Undo2 size={ICON_SIZE} />
          </ToolbarButton>
        )}
        {has('redo') && (
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            active={false}
            disabled={!editor.can().redo()}
            title={t('editor.redo', { defaultValue: 'Redo' })}
          >
            <Redo2 size={ICON_SIZE} />
          </ToolbarButton>
        )}
        {has('bold') && (
          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title={t('editor.bold', { defaultValue: 'Bold' })}>
            <Bold size={ICON_SIZE} />
          </ToolbarButton>
        )}
        {has('italic') && (
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title={t('editor.italic', { defaultValue: 'Italic' })}>
            <Italic size={ICON_SIZE} />
          </ToolbarButton>
        )}
        {has('underline') && (
          <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title={t('editor.underline', { defaultValue: 'Underline' })}>
            <UnderlineIcon size={ICON_SIZE} />
          </ToolbarButton>
        )}
        {has('strike') && (
          <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title={t('editor.strike', { defaultValue: 'Strikethrough' })}>
            <Strikethrough size={ICON_SIZE} />
          </ToolbarButton>
        )}
        {has('h1') && (
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title={t('editor.heading1', { defaultValue: 'Heading 1' })}>
            <Heading1 size={ICON_SIZE} />
          </ToolbarButton>
        )}
        {has('h2') && (
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title={t('editor.heading2', { defaultValue: 'Heading 2' })}>
            <Heading2 size={ICON_SIZE} />
          </ToolbarButton>
        )}
        {has('h3') && (
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title={t('editor.heading3', { defaultValue: 'Heading 3' })}>
            <Heading3 size={ICON_SIZE} />
          </ToolbarButton>
        )}
        {has('bulletList') && (
          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title={t('editor.bulletList', { defaultValue: 'Bullet list' })}>
            <List size={ICON_SIZE} />
          </ToolbarButton>
        )}
        {has('orderedList') && (
          <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title={t('editor.orderedList', { defaultValue: 'Numbered list' })}>
            <ListOrdered size={ICON_SIZE} />
          </ToolbarButton>
        )}
        {has('blockquote') && (
          <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title={t('editor.blockquote', { defaultValue: 'Blockquote' })}>
            <Quote size={ICON_SIZE} />
          </ToolbarButton>
        )}
        {has('code') && (
          <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title={t('editor.codeBlock', { defaultValue: 'Code block' })}>
            <Code size={ICON_SIZE} />
          </ToolbarButton>
        )}
        {has('link') && (
          <ToolbarButton
            onClick={() => {
              const url = window.prompt(t('editor.enterUrl', { defaultValue: 'Enter URL' }))
              if (url) editor.chain().focus().setLink({ href: url }).run()
            }}
            active={editor.isActive('link')}
            title={t('editor.link', { defaultValue: 'Link' })}
          >
            <Link2 size={ICON_SIZE} />
          </ToolbarButton>
        )}
        {has('link') && editor.isActive('link') && (
          <ToolbarButton onClick={() => editor.chain().focus().unsetLink().run()} active={false} title={t('editor.unlink', { defaultValue: 'Unlink' })}>
            <Link2Off size={ICON_SIZE} />
          </ToolbarButton>
        )}
      </div>

      {/* Editor area */}
      <EditorContent
        editor={editor}
        className={`font-reading text-base-content p-4 prose max-w-none focus:outline-none bg-base-100 ${editorClassName || 'min-h-32'}`}
      />
    </div>
  )
}
