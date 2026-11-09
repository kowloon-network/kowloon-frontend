// Dynamic import for the TipTap editor (TipTap + ProseMirror + markdown are a
// large slice of the bundle). Shared by LazyRichTextEditor and any caller that
// wants to warm the chunk before the editor is shown (e.g. PostComposer).
export const loadRichTextEditor = () => import('./RichTextEditor')
