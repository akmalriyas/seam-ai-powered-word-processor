
import GlassRibbon from './components/GlassRibbon';
import EditorComponent from './components/Editor';
import ContextMenu from './components/ContextMenu';
import SidebarPanel from './components/SidebarPanel';
import StartupScreen from './components/StartupScreen';
import { LayoutList, FileText, Settings, BarChart3, Sparkles, AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { IntelligenceOverlay } from './extensions/IntelligenceOverlay';
import { useEditor, Extension } from '@tiptap/react';
import { useMemo, useRef, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import StarterKit from '@tiptap/starter-kit';
import { ResizableImage } from './components/ResizableImage';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import FontFamily from '@tiptap/extension-font-family';
import { TextStyle, FontSize, LineHeight } from '@tiptap/extension-text-style';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Plugin } from 'prosemirror-state';

import FindReplaceMenu from './components/FindReplaceMenu';
import { SearchAndReplace } from './extensions/SearchAndReplace';

export type NotificationType = 'success' | 'info' | 'error' | 'warning';

interface Notification {
  id: string;
  message: string;
  type: NotificationType;
}

function App() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [wordCount, setWordCount] = useState(0);
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [layoutFormat, setLayoutFormat] = useState<'letter' | 'a4'>(() => (localStorage.getItem('seam-layout') as 'letter' | 'a4') || 'letter');
  const [theme, setTheme] = useState(() => localStorage.getItem('seam-theme') || 'dark');
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [isAiReady, setIsAiReady] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);

  const notify = (message: string, type: NotificationType = 'info') => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  useEffect(() => {
    localStorage.setItem('seam-layout', layoutFormat);
  }, [layoutFormat]);

  useEffect(() => {
    localStorage.setItem('seam-theme', theme);
    const resolved = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    document.documentElement.setAttribute('data-theme', resolved);
  }, [theme]);

  // Handle system theme changes
  useEffect(() => {
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      document.documentElement.setAttribute('data-theme', media.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, [theme]);

  // Global Ctrl+F / Cmd+F Hijack
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setShowFindReplace(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const togglePanel = (panel: string) => {
    setActivePanel(prev => prev === panel ? null : panel);
  };


  const TabIndent = useMemo(() => Extension.create({
    name: 'tabIndent',
    priority: 1000,
    addKeyboardShortcuts() {
      return {
        Tab: () => {
          if (this.editor.isActive('bulletList') || this.editor.isActive('orderedList')) {
            return this.editor.commands.sinkListItem('listItem');
          }
          return this.editor.commands.insertContent('    ');
        },
        'Shift-Tab': () => {
          if (this.editor.isActive('bulletList') || this.editor.isActive('orderedList')) {
            return this.editor.commands.liftListItem('listItem');
          }
          return true; // Still prevent default if not in list
        },
      };
    },
  }), []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: false,
        underline: false,
      }),
      Underline,
      TextStyle,
      FontFamily.configure({ types: ['textStyle'] }),
      FontSize.configure({ types: ['textStyle'] }),
      LineHeight.configure({ types: ['textStyle'] }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        defaultAlignment: 'left',
      }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'seam-link' } }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Subscript,
      Superscript,
      Highlight.configure({ multicolor: true }),
      IntelligenceOverlay,
      TaskList,
      TaskItem.configure({ nested: true }),
      ResizableImage,
      SearchAndReplace,
      TabIndent,
      Extension.create({
        name: 'imagePaste',
        addProseMirrorPlugins() {
          return [
            new Plugin({
              props: {
                handlePaste: (_, event) => {
                  const items = Array.from(event.clipboardData?.items || []);
                  for (const item of items) {
                    if (item.type.indexOf('image') === 0) {
                      const file = item.getAsFile();
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                          this.editor.commands.setImage({ src: e.target?.result as string });
                        };
                        reader.readAsDataURL(file);
                        return true;
                      }
                    }
                  }
                  const html = event.clipboardData?.getData('text/html');
                  if (html) {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    const img = doc.querySelector('img');
                    if (img && img.src && !img.src.startsWith('data:')) {
                      if ((window as any).api?.getImageBase64) {
                        (window as any).api.getImageBase64(img.src)
                          .then((base64: string) => this.editor.commands.setImage({ src: base64 }));
                      } else {
                        fetch(img.src).then(r => r.blob()).then(blob => {
                          const reader = new FileReader();
                          reader.onload = (e) => this.editor.commands.setImage({ src: e.target?.result as string });
                          reader.readAsDataURL(blob);
                        });
                      }
                      return true;
                    }
                  }
                  return false;
                },
                handleDrop: (_, event) => {
                  const files = Array.from(event.dataTransfer?.files || []);
                  for (const file of files) {
                    if (file.type.indexOf('image') === 0) {
                      const reader = new FileReader();
                      reader.onload = (e) => {
                        this.editor.commands.setImage({ src: e.target?.result as string });
                      };
                      reader.readAsDataURL(file);
                      return true;
                    }
                  }
                  return false;
                }
              }
            })
          ]
        }
      })
    ],
    content: `
      <h1>Project Seam: AI-Native Writing</h1>
      <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
      
      <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
    `,
    onUpdate: ({ editor }) => {
      setWordCount(editor.storage.characterCount?.words?.() || editor.getText().split(/\s+/).filter(w => w.length > 0).length);
    },
  });

  useEffect(() => {
    if (editor) {
      setWordCount(editor.getText().split(/\s+/).filter(w => w.length > 0).length);
    }
  }, [editor]);

  const sidebarButtons = [
    { id: 'pages', icon: FileText, label: 'Pages' },
    { id: 'outline', icon: LayoutList, label: 'Outline' },
    { id: 'stats', icon: BarChart3, label: 'Statistics' },
    { id: 'ai', icon: Sparkles, label: 'Assistant' },
  ];

  return (
    <div className="flex flex-col h-screen w-screen bg-[var(--bg-app)] text-[var(--text-secondary)] font-sans shadow-2xl relative transition-colors">
      <AnimatePresence>
        {!isAiReady && (
          <StartupScreen onComplete={() => setIsAiReady(true)} />
        )}
      </AnimatePresence>

      <GlassRibbon 
        editor={editor} 
        currentFilePath={currentFilePath} 
        setCurrentFilePath={setCurrentFilePath}
        activePanel={activePanel}
        togglePanel={togglePanel}
        notify={notify}
        layoutFormat={layoutFormat}
      />
      <div className="flex flex-1 overflow-hidden relative">
        <FindReplaceMenu 
          editor={editor} 
          isOpen={showFindReplace} 
          onClose={() => setShowFindReplace(false)} 
        />
        {/* Icon Sidebar */}
        <aside className="w-12 shrink-0 border-r border-glass-border flex flex-col items-center py-4 gap-1 bg-[var(--bg-sidebar)]">
          {sidebarButtons.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => togglePanel(id)}
              title={label}
              tabIndex={-1}
              className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${
                activePanel === id
                  ? 'bg-white/10 text-[var(--text-main)] shadow-inner'
                  : 'text-[var(--text-muted)] hover:bg-white/[0.06] hover:text-[var(--text-secondary)]'
              }`}
            >
              <Icon size={18} />
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={() => togglePanel('settings')}
            title="Settings"
            tabIndex={-1}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${
              activePanel === 'settings'
                ? 'bg-white/10 text-[var(--text-main)] shadow-inner'
                : 'text-[var(--text-muted)] hover:bg-white/[0.06] hover:text-[var(--text-secondary)]'
            }`}
          >
            <Settings size={18} />
          </button>
        </aside>

        {/* Expandable Panel */}
        {editor && (
          <SidebarPanel
            editor={editor}
            activePanel={activePanel}
            onClose={() => setActivePanel(null)}
            theme={theme}
            setTheme={(t: string) => setTheme(t)}
            layoutFormat={layoutFormat}
            setLayoutFormat={setLayoutFormat}
            aiWorker={null}
          />
        )}

        {/* Editor Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative flex justify-center custom-scrollbar bg-[var(--bg-app)] py-10 px-4 transition-colors">
          <div className="flex flex-col items-center">
            {editor && <EditorComponent editor={editor} layoutFormat={layoutFormat} />}
          </div>
          {editor && <ContextMenu editor={editor} aiWorker={null} />}
        </main>
      </div>

      {/* Status Bar */}
      <div className="h-8 shrink-0 bg-[var(--bg-status)] border-t border-glass-border flex items-center justify-between px-4 text-[12px] text-[var(--text-muted)] app-status-bar">
        <div className="flex items-center gap-4">
          <span>@akmalriyas</span>
          {currentFilePath && (
            <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
              <FileText size={10} className="text-accent" />
              {currentFilePath.split(/[\\/]/).pop()}
            </span>
          )}
        </div>
        <span>{wordCount} words</span>
      </div>

      <svg className="hidden">
        <defs>
          <filter id="goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="atop"/>
          </filter>
        </defs>
      </svg>

      {/* Notifications Container */}
      <div className="fixed bottom-12 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {notifications.map(n => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 20, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, x: 0, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, x: 10, transition: { duration: 0.2 } }}
              layout
              className="pointer-events-auto liquid-glass border border-white/10 rounded-2xl p-4 pr-6 min-w-[280px] shadow-2xl flex items-center gap-4 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center 
                ${n.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 
                  n.type === 'error' ? 'bg-red-500/20 text-red-400' : 
                  n.type === 'warning' ? 'bg-amber-500/20 text-amber-400' : 
                  'bg-accent/20 text-accent'}`}
              >
                {n.type === 'success' && <CheckCircle2 size={20} />}
                {n.type === 'error' && <AlertCircle size={20} />}
                {n.type === 'warning' && <AlertCircle size={20} />}
                {n.type === 'info' && <Info size={20} />}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] uppercase tracking-widest font-black opacity-30">
                  {n.type === 'info' ? 'Notification' : n.type}
                </span>
                <p className="text-[13px] text-[var(--text-main)] font-medium leading-tight">{n.message}</p>
              </div>
              <button 
                onClick={() => setNotifications(prev => prev.filter(item => item.id !== n.id))}
                className="absolute top-2 right-2 text-[var(--text-muted)] hover:text-[var(--text-main)] p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={12} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default App;
