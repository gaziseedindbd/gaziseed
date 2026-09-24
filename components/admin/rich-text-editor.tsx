'use client';

import React from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Heading2, Heading3, Pilcrow } from 'lucide-react';

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
};

const BLOCK_COMMANDS: Record<string, string> = {
  p: 'P',
  h2: 'H2',
  h3: 'H3',
};

function normalizeHtml(html: string) {
  return html
    .replace(/<div>(.*?)<\/div>/gis, '<p>$1</p>')
    .replace(/<div>/gi, '<p>')
    .replace(/<\/div>/gi, '</p>')
    .replace(/<p><br><\/p>/gi, '<p></p>')
    .trim();
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'এখানে আর্টিকেলের কনটেন্ট লিখুন...',
  minHeight = '220px',
}: RichTextEditorProps) {
  const editorRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const nextValue = value || '';
    if (editor.innerHTML !== nextValue) {
      editor.innerHTML = nextValue;
    }
  }, [value]);

  const focusEditor = () => editorRef.current?.focus();

  const runCommand = (command: string, commandValue?: string) => {
    focusEditor();
    document.execCommand(command, false, commandValue);
    const editor = editorRef.current;
    if (editor) onChange(normalizeHtml(editor.innerHTML));
  };

  const setBlock = (tag: keyof typeof BLOCK_COMMANDS) => {
    focusEditor();
    document.execCommand('formatBlock', false, BLOCK_COMMANDS[tag]);
    const editor = editorRef.current;
    if (editor) onChange(normalizeHtml(editor.innerHTML));
  };

  const handleInput = () => {
    const editor = editorRef.current;
    if (editor) onChange(normalizeHtml(editor.innerHTML));
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-input bg-background shadow-sm">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-secondary/40 p-2">
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand('bold')} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-background" title="Bold"><Bold className="h-4 w-4" /></button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand('italic')} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-background" title="Italic"><Italic className="h-4 w-4" /></button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand('underline')} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-background" title="Underline"><Underline className="h-4 w-4" /></button>
        <div className="mx-1 h-6 w-px bg-border" />
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setBlock('h2')} className="flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-black hover:bg-background" title="Heading 2"><Heading2 className="h-4 w-4" /> H2</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setBlock('h3')} className="flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-black hover:bg-background" title="Heading 3"><Heading3 className="h-4 w-4" /> H3</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setBlock('p')} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-background" title="Paragraph"><Pilcrow className="h-4 w-4" /></button>
        <div className="mx-1 h-6 w-px bg-border" />
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand('insertUnorderedList')} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-background" title="Bullet list"><List className="h-4 w-4" /></button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand('insertOrderedList')} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-background" title="Numbered list"><ListOrdered className="h-4 w-4" /></button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        data-placeholder={placeholder}
        style={{ minHeight }}
        className="blog-rich-editor p-4 text-[15px] leading-7 outline-none sm:text-base"
      />
    </div>
  );
}
