import { useEffect, useRef } from "react";
import { sanitizeRichHtml } from "@/lib/sanitize";
import { marked } from "marked";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Link,
  List,
  ListOrdered,
  Redo2,
  Underline,
  Undo2,
  Strikethrough, Subscript, Superscript, IndentIncrease, IndentDecrease, RemoveFormatting, Unlink,
} from "lucide-react";

export function RichTextEditor({
  value,
  onChange,
  label,
  minHeight = "360px",
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  minHeight?: string;
}) {
  const editor = useRef<HTMLDivElement>(null);
  const selection = useRef<Range | null>(null);
  const emitted = useRef<string | null>(null);
  const emit = () => {
    if (!editor.current) return;
    emitted.current = sanitizeRichHtml(editor.current.innerHTML);
    onChange(emitted.current);
  };
  useEffect(() => {
    const remember = () => {
      const selected = window.getSelection();
      if (selected?.rangeCount && editor.current?.contains(selected.getRangeAt(0).commonAncestorContainer)) selection.current = selected.getRangeAt(0).cloneRange();
    };
    document.addEventListener("selectionchange", remember);
    return () => document.removeEventListener("selectionchange", remember);
  }, []);
  useEffect(() => {
    const el = editor.current;
    if (!el || value === emitted.current) return;
    el.innerHTML = sanitizeRichHtml(marked.parse(value || "", { async: false }));
    selection.current = null;
  }, [value]);
  const run = (command: string, arg?: string) => {
    editor.current?.focus();
    const selected = window.getSelection();
    if (selection.current && editor.current?.contains(selection.current.commonAncestorContainer)) {
      selected?.removeAllRanges(); selected?.addRange(selection.current);
    }
    if (command === "createLink") {
      const url = window.prompt("Link address (https://…, mailto:… or /page)", "https://");
      if (!url) return;
      if (!/^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(url.trim())) return;
      arg = url.trim();
    }
    if (command === "pixelSize" || command === "growFont" || command === "shrinkFont") {
      const node = selected?.anchorNode;
      const element = node?.nodeType === Node.ELEMENT_NODE ? node as Element : node?.parentElement;
      const size = command === "pixelSize" ? Number(arg) : Math.round(parseFloat(element ? getComputedStyle(element).fontSize : "16") + (command === "growFont" ? 2 : -2));
      document.execCommand("fontSize", false, "7");
      editor.current?.querySelectorAll('font[size="7"]').forEach(font => {
        (font as HTMLElement).style.fontSize = `${Math.max(8, Math.min(96, size))}px`;
        font.removeAttribute("size");
      });
    } else document.execCommand(command, false, arg);
    if (selected?.rangeCount) selection.current = selected.getRangeAt(0).cloneRange();
    emit();
  };
  const button = (name: string, command: string, icon: React.ReactNode, arg?: string) => (
    <button
      type="button"
      title={name}
      aria-label={name}
      onMouseDown={(e) => {
        e.preventDefault();
      }}
      onClick={() => run(command, arg)}
      className="h-9 min-w-9 px-2 grid place-items-center hover:bg-background"
    >
      {icon}
    </button>
  );
  return (
    <div>
      <label className="block mb-2 text-xs uppercase tracking-widest">{label}</label>
      <div
        className="sticky top-0 z-10 flex flex-wrap items-center gap-px border bg-section p-1 shadow-sm"
        role="toolbar"
      >
        {button("Undo", "undo", <Undo2 className="h-4 w-4" />)}
        {button("Redo", "redo", <Redo2 className="h-4 w-4" />)}
        <select
          aria-label="Text style"
          defaultValue="p"
          onChange={(e) => run("formatBlock", e.target.value)}
          className="h-9 border bg-background px-2 text-sm"
        >
          <option value="p">Normal text</option>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={`h${n}`}>
              Heading {n}
            </option>
          ))}
          <option value="blockquote">Quotation</option>
        </select>
        <select
          aria-label="Font"
          onChange={(e) => run("fontName", e.target.value)}
          className="h-9 border bg-background px-2 text-sm"
        >
          <option>Arial</option>
          <option>Georgia</option>
          <option>Times New Roman</option>
          <option>Verdana</option>
          <option>Tahoma</option>
          <option>Trebuchet MS</option>
          <option>Courier New</option>
        </select>
        <select
          aria-label="Font size"
          defaultValue="16"
          onChange={(e) => run("pixelSize", e.target.value)}
          className="h-9 border bg-background px-2 text-sm"
        >
          {[8, 10, 12, 13, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72].map(size => <option key={size} value={size}>{size} px</option>)}
        </select>
        {button("Increase font size", "growFont", <span>A+</span>)}
        {button("Decrease font size", "shrinkFont", <span>A−</span>)}
        {button("Bold", "bold", <Bold className="h-4 w-4" />)}
        {button("Italic", "italic", <Italic className="h-4 w-4" />)}
        {button("Underline", "underline", <Underline className="h-4 w-4" />)}
        {button("Strikethrough", "strikeThrough", <Strikethrough className="h-4 w-4" />)}
        {button("Subscript", "subscript", <Subscript className="h-4 w-4" />)}
        {button("Superscript", "superscript", <Superscript className="h-4 w-4" />)}
        <label title="Text colour" className="h-9 w-9 grid place-items-center cursor-pointer">
          <span className="font-bold underline decoration-2">A</span>
          <input
            aria-label="Text colour"
            className="sr-only"
            type="color"
            onChange={(e) => run("foreColor", e.target.value)}
          />
        </label>
        <label className="h-9 px-2 flex items-center gap-1 text-xs">Highlight
          <input aria-label="Highlight colour" type="color" defaultValue="#fff59d" className="h-6 w-6" onChange={e => run("hiliteColor", e.target.value)} />
        </label>
        {button("Bulleted list", "insertUnorderedList", <List className="h-4 w-4" />)}
        {button("Numbered list", "insertOrderedList", <ListOrdered className="h-4 w-4" />)}
        {button("Align left", "justifyLeft", <AlignLeft className="h-4 w-4" />)}
        {button("Align center", "justifyCenter", <AlignCenter className="h-4 w-4" />)}
        {button("Align right", "justifyRight", <AlignRight className="h-4 w-4" />)}
        {button("Justify", "justifyFull", <AlignJustify className="h-4 w-4" />)}
        {button("Increase indent", "indent", <IndentIncrease className="h-4 w-4" />)}
        {button("Decrease indent", "outdent", <IndentDecrease className="h-4 w-4" />)}
        {button("Add link", "createLink", <Link className="h-4 w-4" />)}
        {button("Remove link", "unlink", <Unlink className="h-4 w-4" />)}
        {button("Clear formatting", "removeFormat", <RemoveFormatting className="h-4 w-4" />)}
      </div>
      <div
        ref={editor}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        onInput={emit}
        onPaste={(event) => {
          event.preventDefault();
          const html = event.clipboardData.getData("text/html");
          if (html) document.execCommand("insertHTML", false, sanitizeRichHtml(html));
          else document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
          emit();
        }}
        onDrop={(event) => event.preventDefault()}
        className="prose prose-neutral max-w-none overflow-auto border border-t-0 bg-background p-5 focus:outline-none focus:ring-1 focus:ring-foreground"
        style={{ minHeight }}
      />
    </div>
  );
}
