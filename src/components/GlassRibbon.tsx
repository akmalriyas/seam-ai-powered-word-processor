import React, { useState, useRef, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import {
  Minus, Square, X, Sparkle, Sparkles, Image as ImageIcon,
  AlignCenter, AlignLeft, AlignRight, Bold, Italic,
  Underline as UnderlineIcon, Strikethrough, Undo, Redo,
  ChevronDown, Send, Check, Plus, Minus as MinusIcon,
  LineChart, Link2, Table2, ListChecks, MinusSquare, Code2,
  Quote, Highlighter, Subscript as SubIcon, Superscript as SupIcon,
  Eraser, FileText, FolderOpen, Save, FileDown, Printer,
  FilePlus, Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type NotificationType = 'success' | 'info' | 'error' | 'warning';

const FONTS = [
  { label: 'Inter', value: 'Inter' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Courier New', value: 'Courier New' },
  { label: 'Verdana', value: 'Verdana' },
  { label: 'Trebuchet MS', value: 'Trebuchet MS' },
  { label: 'Tahoma', value: 'Tahoma' },
  { label: 'Garamond', value: 'Garamond' },
  { label: 'Palatino', value: 'Palatino Linotype' },
];

const HEADING_OPTIONS = [
  { label: 'Normal Text', value: 'paragraph' },
  { label: 'Heading 1', value: 1 },
  { label: 'Heading 2', value: 2 },
  { label: 'Heading 3', value: 3 },
  { label: 'Heading 4', value: 4 },
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];

const LINE_HEIGHTS = [
  { label: '1.0', value: '1' },
  { label: '1.15', value: '1.15' },
  { label: '1.5', value: '1.5' },
  { label: '1.75', value: '1.75' },
  { label: '2.0', value: '2' },
  { label: '2.5', value: '2.5' },
];

type RibbonTab = 'file' | 'write' | 'insert' | 'format';

function RibbonBtn({ icon: Icon, label, onClick, active, disabled, size = 20 }: {
  icon: React.ElementType; label: string; onClick: () => void;
  active?: boolean; disabled?: boolean; size?: number;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg transition-all duration-75 min-w-[56px]
        ${active ? 'bg-accent text-white shadow-lg' : 'text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)]'}
        ${disabled ? 'opacity-30 pointer-events-none' : ''}`}
    >
      <Icon size={size} />
      <span className="text-[10px] font-medium leading-none uppercase tracking-wide">{label}</span>
    </button>
  );
}

function Sep() {
  return <div className="w-px h-10 bg-[var(--border-glass)] mx-2 shrink-0 opacity-40" />;
}

export default function GlassRibbon({ 
  editor, 
  currentFilePath, 
  setCurrentFilePath,
  activePanel,
  togglePanel,
  notify,
  layoutFormat
}: { 
  editor: Editor | null;
  currentFilePath: string | null;
  setCurrentFilePath: (path: string | null) => void;
  activePanel: string | null;
  togglePanel: (panel: string) => void;
  notify: (message: string, type: NotificationType) => void;
  layoutFormat: 'letter' | 'a4';
}) {
  const [activeTab, setActiveTab] = useState<RibbonTab>('write');
  const [fontDropdownOpen, setFontDropdownOpen] = useState(false);
  const [headingDropdownOpen, setHeadingDropdownOpen] = useState(false);
  const [fontSizeDropdownOpen, setFontSizeDropdownOpen] = useState(false);
  const [lineHeightDropdownOpen, setLineHeightDropdownOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fontRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const fontSizeRef = useRef<HTMLDivElement>(null);
  const lineHeightRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Hoisted Functions ───────────────────────────────────────────────────
  // Using function keyword ensures these are hoisted and available immediately
  
  function handleClose() { (window as any).api?.close(); }
  function handleMinimize() { (window as any).api?.minimize(); }
  function handleMaximize() { (window as any).api?.maximize(); }

  function closeAllDropdowns() {
    setFontDropdownOpen(false);
    setHeadingDropdownOpen(false);
    setFontSizeDropdownOpen(false);
    setLineHeightDropdownOpen(false);
  }

  function fileNew() { 
    if (editor) {
      editor.commands.clearContent();
      setCurrentFilePath(null);
    }
  }

  async function fileOpen() {
    const api = (window as any).api;
    if (api?.openProject) {
      const result = await api.openProject();
      if (result?.success && editor) {
        if (result.type === 'seam' && result.content) {
          editor.commands.setContent(result.content);
          setCurrentFilePath(result.filePath);
          notify("Document loaded", "success");
        } else if (result.html) {
          editor.commands.setContent(result.html);
          setCurrentFilePath(null); 
          notify("Imported successfully. Save as .seam to enable auto-save.", "info");
        }
      }
    }
  }

  async function fileSave(forceSaveAs = false) {
    if (!editor) return;
    const api = (window as any).api;
    if (!api?.saveProject) return;

    setIsSaving(true);
    try {
      const result = await api.saveProject(
        editor.getJSON(), 
        forceSaveAs ? undefined : currentFilePath
      );
      if (result?.success && result.filePath) {
        setCurrentFilePath(result.filePath);
        notify(forceSaveAs ? "Created new copy" : "Document saved", "success");
      }
    } catch (err: any) {
      notify(err?.message || "Save failed", "error");
    } finally {
      setTimeout(() => setIsSaving(false), 500);
    }
  }

  async function fileExportDOCX() {
    if (!editor) return;
    const api = (window as any).api;
    if (api?.exportDocx) {
      const result = await api.exportDocx(editor.getHTML());
      if (result?.success) notify("Exported to Word", "success");
    }
  }

  function fileExportHTML() {
    if (!editor) return;
    const html = editor.getHTML();
    notify("Exported to HTML", "success");
    const blob = new Blob([`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Seam Document</title><style>body{font-family:Inter,system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.75;color:#333}h1{border-bottom:1px solid #eee;padding-bottom:8px}img{max-width:100%;border-radius:8px}blockquote{border-left:3px solid #7c8aff;padding-left:16px;color:#666;font-style:italic}code{background:#f4f4f5;padding:2px 6px;border-radius:4px;font-size:13px}pre{background:#f4f4f5;padding:16px;border-radius:8px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px 12px}</style></head><body>${html}</body></html>`], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.html';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function fileExportPDF() {
    const api = (window as any).api;
    if (api?.exportPDF) {
      const result = await api.exportPDF(layoutFormat);
      if (result?.success) notify("Exported to PDF", "success");
    }
  }

  async function filePrint() {
    const api = (window as any).api;
    if (api?.print) {
      const result = await api.print(layoutFormat);
      if (result?.success) notify("Printing...", "info");
    } else {
      window.print();
    }
  }

  const handleImageAdd = () => {
    if (!editor) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editor) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const src = event.target?.result as string;
        editor.chain().focus().setImage({ src }).run();
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const getCurrentFont = (): string => {
    if (!editor) return 'Inter';
    return editor.getAttributes('textStyle').fontFamily || 'Inter';
  };

  const getCurrentFontSize = (): number => {
    if (!editor) return 14;
    const size = editor.getAttributes('textStyle').fontSize;
    return size ? parseInt(size) : 14;
  };

  const getCurrentLineHeight = (): string => {
    if (!editor) return 'Normal';
    const lh = editor.getAttributes('textStyle').lineHeight;
    return lh || 'Normal';
  };

  const getCurrentHeadingLabel = (): string => {
    if (!editor) return 'Normal Text';
    for (let i = 1; i <= 4; i++) {
      if (editor.isActive('heading', { level: i })) return `Heading ${i}`;
    }
    return 'Normal Text';
  };

  const isAlignedLeft = (): boolean => {
    if (!editor) return true;
    return editor.isActive({ textAlign: 'left' }) || (!editor.isActive({ textAlign: 'center' }) && !editor.isActive({ textAlign: 'right' }));
  };

  const changeFontSize = (delta: number) => {
    if (!editor) return;
    const current = getCurrentFontSize();
    const next = Math.max(1, current + delta);
    editor.chain().focus().setFontSize(`${next}px`).run();
  };

  // ─── Hooks ─────────────────────────────────────────────────────────────
  
  const [, forceUpdate] = useState({});

  useEffect(() => {
    if (!editor) return;
    const updateHandler = () => forceUpdate({});
    editor.on('selectionUpdate', updateHandler);
    editor.on('transaction', updateHandler);
    return () => {
      editor.off('selectionUpdate', updateHandler);
      editor.off('transaction', updateHandler);
    };
  }, [editor]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (fontRef.current && !fontRef.current.contains(e.target as Node)) setFontDropdownOpen(false);
      if (headingRef.current && !headingRef.current.contains(e.target as Node)) setHeadingDropdownOpen(false);
      if (fontSizeRef.current && !fontSizeRef.current.contains(e.target as Node)) setFontSizeDropdownOpen(false);
      if (lineHeightRef.current && !lineHeightRef.current.contains(e.target as Node)) setLineHeightDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!editor) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === 's') {
        e.preventDefault();
        fileSave();
      }
      if (ctrl && e.key === 'o') {
        e.preventDefault();
        fileOpen();
      }
      if (ctrl && e.key === 'n') {
        e.preventDefault();
        editor.commands.clearContent();
      }
      if (ctrl && e.key === 'k') {
        e.preventDefault();
        setLinkUrl('');
        setLinkDialogOpen(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editor, currentFilePath, fileSave]);

  const tabs: { id: RibbonTab; label: string }[] = [
    { id: 'file', label: 'File' },
    { id: 'write', label: 'Write' },
    { id: 'insert', label: 'Insert' },
    { id: 'format', label: 'Format' },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="z-50 flex flex-col bg-[var(--bg-ribbon)]/90 backdrop-blur-md border-b border-[var(--border-glass)] shadow-md select-none shrink-0 w-full transition-colors duration-75 app-ribbon">
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

      {/* OS Titlebar */}
      <div className="h-[36px] flex items-center justify-between px-4 w-full border-b border-white/[0.03]" style={{ WebkitAppRegion: 'drag' } as any}>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-md overflow-hidden flex items-center justify-center opacity-95 shadow-lg border border-white/5 bg-black">
            <img src="./logo.png" alt="Seam Logo" className="w-full h-full object-cover mix-blend-screen" style={{ filter: 'contrast(1.1) brightness(1.2)' }} />
          </div>
          <span className="font-bold text-[12px] text-[var(--text-secondary)] tracking-tight">SEAM</span>
          <div className="w-px h-3 bg-[var(--border-glass)] opacity-20 ml-1" />
          <span className="text-[11px] opacity-40 truncate max-w-[400px]">
            {currentFilePath?.split(/[\\/]/).pop() || "Untitled Document"}
          </span>
        </div>
        <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button onClick={handleMinimize} tabIndex={-1} className="w-10 h-[36px] flex items-center justify-center hover:bg-[var(--hover-bg)] text-[var(--text-muted)] transition-colors"><Minus size={16} /></button>
          <button onClick={handleMaximize} tabIndex={-1} className="w-10 h-[36px] flex items-center justify-center hover:bg-[var(--hover-bg)] text-[var(--text-muted)] transition-colors"><Square size={13} /></button>
          <button onClick={handleClose} tabIndex={-1} className="w-12 h-[36px] flex items-center justify-center hover:bg-red-500 hover:text-white text-[var(--text-muted)] transition-colors"><X size={18} /></button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex px-4 gap-1 text-[13px] text-[var(--text-muted)] border-b border-white/5" style={{ WebkitAppRegion: 'no-drag' } as any}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { closeAllDropdowns(); setActiveTab(tab.id); }}
            className={`px-5 py-2 transition-all duration-150 cursor-pointer relative font-medium
              ${activeTab === tab.id
                ? 'text-[var(--text-main)] bg-[var(--toolbar-bg)]'
                : 'hover:bg-[var(--hover-bg)] hover:text-[var(--text-secondary)]'}`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-accent" />
            )}
          </button>
        ))}
      </div>

      {/* Ribbon Content */}
      <div tabIndex={-1} className="flex flex-wrap items-center px-4 h-24 gap-1 text-[var(--text-secondary)] bg-[var(--toolbar-bg)] transition-colors duration-75 shadow-inner">
        {!editor ? (
          <div className="text-xs text-gray-500 flex-1 flex justify-center">Loading Editor...</div>
        ) : activeTab === 'file' ? (
          <div className="flex items-center gap-1">
            <RibbonBtn icon={FilePlus} label="New" onClick={fileNew} />
            <RibbonBtn icon={FolderOpen} label="Open" onClick={fileOpen} />
            <RibbonBtn icon={Save} label={isSaving ? "Saving..." : "Save Project"} onClick={() => fileSave(false)} active={isSaving} />
            <RibbonBtn icon={FileText} label="Save As" onClick={() => fileSave(true)} />
            <Sep />
            <div className="flex flex-col justify-center px-2">
              <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest mb-2 opacity-60">Export Document</span>
              <div className="flex gap-1">
                <RibbonBtn icon={Printer} label="Print" onClick={filePrint} size={18} />
                <RibbonBtn icon={FileDown} label="PDF" onClick={fileExportPDF} size={18} />
                <RibbonBtn icon={FileDown} label="DOCX" onClick={fileExportDOCX} size={18} />
                <RibbonBtn icon={FileDown} label="HTML" onClick={fileExportHTML} size={18} />
              </div>
            </div>
          </div>
        ) : activeTab === 'insert' ? (
          <div className="flex items-center gap-1">
            <RibbonBtn icon={ImageIcon} label="Image" onClick={handleImageAdd} />
            <RibbonBtn icon={Link2} label="Link" onClick={() => { setLinkUrl(''); setLinkDialogOpen(true); }} />
            <Sep />
            <RibbonBtn icon={Table2} label="Table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
            <RibbonBtn icon={ListChecks} label="Tasks" onClick={() => editor.chain().focus().toggleTaskList().run()} />
            <Sep />
            <RibbonBtn icon={MinusSquare} label="Rule" onClick={() => editor.chain().focus().setHorizontalRule().run()} />
            <RibbonBtn icon={Code2} label="Code" onClick={() => editor.chain().focus().toggleCodeBlock().run()} />
            <RibbonBtn icon={Quote} label="Quote" onClick={() => editor.chain().focus().toggleBlockquote().run()} />
          </div>
        ) : activeTab === 'format' ? (
          <div className="flex items-center gap-1">
            <RibbonBtn icon={Bold} label="Bold" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} />
            <RibbonBtn icon={Italic} label="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} />
            <RibbonBtn icon={UnderlineIcon} label="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} />
            <RibbonBtn icon={Strikethrough} label="Strike" onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} />
            <Sep />
            <RibbonBtn icon={SubIcon} label="Sub" onClick={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive('subscript')} />
            <RibbonBtn icon={SupIcon} label="Super" onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive('superscript')} />
            <RibbonBtn icon={Highlighter} label="Highlight" onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()} active={editor.isActive('highlight')} />
            <Sep />
            <RibbonBtn icon={AlignLeft} label="Left" onClick={() => editor.chain().focus().setTextAlign('left').run()} active={isAlignedLeft()} />
            <RibbonBtn icon={AlignCenter} label="Center" onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} />
            <RibbonBtn icon={AlignRight} label="Right" onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} />
            <Sep />
            <RibbonBtn icon={Eraser} label="Clear" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} />
            <div className="flex-1" />
          </div>
        ) : (
          <>
            <div tabIndex={-1} className="flex items-center gap-1 border-r border-[var(--border-glass)] pr-3">
              <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} tabIndex={-1} className="p-2 hover:bg-[var(--hover-bg)] rounded-lg disabled:opacity-30 transition"><Undo size={18} /></button>
              <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} tabIndex={-1} className="p-2 hover:bg-[var(--hover-bg)] rounded-lg disabled:opacity-30 transition"><Redo size={18} /></button>
            </div>
            <div tabIndex={-1} className="relative border-r border-[var(--border-glass)] pr-2" ref={fontRef}>
              <button onClick={() => { closeAllDropdowns(); setFontDropdownOpen(!fontDropdownOpen); }} className="flex items-center bg-[var(--hover-bg)] hover:bg-[var(--border-glass)] transition rounded-lg px-3 py-2 text-[12px] text-[var(--text-secondary)] cursor-pointer min-w-[120px] justify-between gap-2">
                <span className="truncate" style={{ fontFamily: getCurrentFont() }}>{getCurrentFont()}</span>
                <ChevronDown size={14} className={`shrink-0 transition-transform ${fontDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {fontDropdownOpen && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="absolute left-0 top-8 w-48 max-h-64 overflow-y-auto rounded-lg shadow-2xl border border-[var(--border-glass)] bg-[var(--bg-panel)]/95 backdrop-blur-lg z-[100] py-1 custom-scrollbar">
                    {FONTS.map(f => (
                      <button key={f.value} onClick={() => { editor.chain().focus().setFontFamily(f.value).run(); setFontDropdownOpen(false); }} className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-[var(--hover-bg)] transition ${getCurrentFont() === f.value ? 'text-[var(--text-main)] bg-[var(--hover-bg)]' : 'text-[var(--text-muted)]'}`}>
                        <span style={{ fontFamily: f.value }}>{f.label}</span>
                        {getCurrentFont() === f.value && <Check size={12} className="text-accent" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div tabIndex={-1} className="relative flex items-center border-r border-[var(--border-glass)] pr-3" ref={fontSizeRef}>
              <button onClick={() => changeFontSize(-1)} className="p-2 hover:bg-[var(--hover-bg)] rounded-lg transition"><MinusIcon size={14} /></button>
              <button onClick={() => { closeAllDropdowns(); setFontSizeDropdownOpen(!fontSizeDropdownOpen); }} className="bg-[var(--hover-bg)] hover:bg-[var(--border-glass)] transition rounded-lg px-3 py-2 text-[12px] text-[var(--text-secondary)] cursor-pointer min-w-[44px] text-center">{getCurrentFontSize()}</button>
              <button onClick={() => changeFontSize(1)} className="p-2 hover:bg-[var(--hover-bg)] rounded-lg transition"><Plus size={14} /></button>
              <AnimatePresence>
                {fontSizeDropdownOpen && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="absolute left-0 top-8 w-20 max-h-56 overflow-y-auto rounded-lg shadow-2xl border border-[var(--border-glass)] bg-[var(--bg-panel)]/95 backdrop-blur-lg z-[100] py-1 custom-scrollbar">
                    {FONT_SIZES.map(s => (
                      <button key={s} onClick={() => { editor.chain().focus().setFontSize(`${s}px`).run(); setFontSizeDropdownOpen(false); }} className={`w-full text-center px-2 py-1 text-xs hover:bg-[var(--hover-bg)] transition ${getCurrentFontSize() === s ? 'text-[var(--text-main)] bg-[var(--hover-bg)]' : 'text-[var(--text-muted)]'}`}>{s}</button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div tabIndex={-1} className="relative border-r border-[var(--border-glass)] pr-2" ref={headingRef}>
              <button onClick={() => { closeAllDropdowns(); setHeadingDropdownOpen(!headingDropdownOpen); }} className="flex items-center bg-[var(--hover-bg)] hover:bg-[var(--border-glass)] transition rounded-lg px-3 py-2 text-[12px] text-[var(--text-secondary)] cursor-pointer min-w-[110px] justify-between gap-2">
                <span>{getCurrentHeadingLabel()}</span>
                <ChevronDown size={14} className={`shrink-0 transition-transform ${headingDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {headingDropdownOpen && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="absolute left-0 top-8 w-44 rounded-lg shadow-2xl border border-[var(--border-glass)] bg-[var(--bg-panel)]/95 backdrop-blur-lg z-[100] py-1">
                    {HEADING_OPTIONS.map(h => {
                      const isActive = h.value === 'paragraph' ? !editor.isActive('heading') : editor.isActive('heading', { level: h.value });
                      return (
                        <button key={h.label} onClick={() => {
                          if (h.value === 'paragraph') editor.chain().focus().setParagraph().run();
                          else editor.chain().focus().toggleHeading({ level: h.value as 1|2|3|4 }).run();
                          setHeadingDropdownOpen(false);
                        }} className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-[var(--hover-bg)] transition ${isActive ? 'text-[var(--text-main)] bg-[var(--hover-bg)]' : 'text-[var(--text-muted)]'}`}>
                          <span className={h.value === 'paragraph' ? 'text-xs' : 'text-xs font-semibold'}>{h.label}</span>
                          {isActive && <Check size={12} className="text-accent" />}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-1 border-r border-[var(--border-glass)] pr-3">
              <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-2 rounded-lg transition-all duration-75 ${editor.isActive('bold') ? 'bg-accent text-white shadow-lg' : 'text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)]'}`}><Bold size={18} /></button>
              <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-2 rounded-lg transition-all duration-75 ${editor.isActive('italic') ? 'bg-accent text-white shadow-lg' : 'text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)]'}`}><Italic size={18} /></button>
              <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-2 rounded-lg transition-all duration-75 ${editor.isActive('underline') ? 'bg-accent text-white shadow-lg' : 'text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)]'}`}><UnderlineIcon size={18} /></button>
            </div>
            <div className="flex items-center gap-1 border-r border-[var(--border-glass)] pr-3">
              <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={`p-2 rounded-lg transition-all duration-75 ${isAlignedLeft() ? 'bg-accent text-white shadow-lg' : 'text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)]'}`}><AlignLeft size={18} /></button>
              <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={`p-2 rounded-lg transition-all duration-75 ${editor.isActive({ textAlign: 'center' }) ? 'bg-accent text-white shadow-lg' : 'text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)]'}`}><AlignCenter size={18} /></button>
              <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={`p-2 rounded-lg transition-all duration-75 ${editor.isActive({ textAlign: 'right' }) ? 'bg-accent text-white shadow-lg' : 'text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)]'}`}><AlignRight size={18} /></button>
            </div>
            <div tabIndex={-1} className="relative border-r border-[var(--border-glass)] pr-2" ref={lineHeightRef}>
              <button onClick={() => { closeAllDropdowns(); setLineHeightDropdownOpen(!lineHeightDropdownOpen); }} className="flex items-center gap-1 bg-[var(--hover-bg)] hover:bg-[var(--border-glass)] transition rounded px-2 py-1 text-[11px] text-[var(--text-secondary)] cursor-pointer" title="Line Spacing">
                <LineChart size={13} />
                <span>{getCurrentLineHeight()}</span>
                <ChevronDown size={10} className={`transition-transform ${lineHeightDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {lineHeightDropdownOpen && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="absolute left-0 top-8 w-28 rounded-lg shadow-2xl border border-[var(--border-glass)] bg-[var(--bg-panel)]/95 backdrop-blur-lg z-[100] py-1">
                    {LINE_HEIGHTS.map(lh => (
                      <button key={lh.value} onClick={() => { editor.chain().focus().setLineHeight(lh.value).run(); setLineHeightDropdownOpen(false); }} className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-[var(--hover-bg)] transition ${getCurrentLineHeight() === lh.value ? 'text-[var(--text-main)] bg-[var(--hover-bg)]' : 'text-[var(--text-muted)]'}`}>
                        <span>{lh.label}</span>
                        {getCurrentLineHeight() === lh.value && <Check size={12} className="text-accent" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-1 border-r border-[var(--border-glass)] pr-3">
              <button onClick={handleImageAdd} className="p-2 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)] rounded-lg transition" title="Insert Image"><ImageIcon size={18} /></button>
            </div>
            <div className="relative flex items-center border-l border-[var(--border-glass)] pl-2">
              <button onClick={() => togglePanel('ai')} className={`p-2 rounded-lg transition ${activePanel === 'ai' ? 'bg-accent text-white shadow-lg' : 'text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-accent'}`} title="Seam AI Assistant">
                <Sparkle size={20} className={activePanel === 'ai' ? 'fill-white/20' : ''} />
              </button>
            </div>
          </>
        )}
      </div>
      <div className="h-[2px] bg-gradient-to-r from-transparent via-accent/40 to-transparent w-full"></div>

      <AnimatePresence>
        {linkDialogOpen && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[300] w-80 rounded-xl shadow-2xl border border-[var(--border-glass)] p-4 liquid-glass">
            <div className="text-xs font-medium text-[var(--text-main)] mb-2 flex items-center gap-2"><Link2 size={13} className="text-accent" /> Insert Link</div>
            <div className="flex gap-2">
              <input type="url" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && linkUrl.trim()) { editor?.chain().focus().extendMarkRange('link').setLink({ href: linkUrl.trim() }).run(); setLinkDialogOpen(false); } if (e.key === 'Escape') setLinkDialogOpen(false); }} placeholder="https://example.com" autoFocus className="flex-1 bg-[var(--bg-app)] rounded px-3 py-1.5 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] border border-[var(--border-glass)] focus:outline-none focus:border-accent/50 transition-colors" />
              <button onClick={() => { if (linkUrl.trim()) { editor?.chain().focus().extendMarkRange('link').setLink({ href: linkUrl.trim() }).run(); } setLinkDialogOpen(false); }} className="bg-accent/20 hover:bg-accent/40 rounded px-3 py-1.5 text-xs text-accent transition-colors border border-accent/20">Apply</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
