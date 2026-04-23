import { useMemo, useState, useEffect, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { X, List, Hash, Type, Clock, BookOpen, Pilcrow, MessageCircle, Send, Sparkles, Sparkle, Bot,
  Globe,
  Database,
  Cloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Layers,
  ArrowRight,
  Wand2,
  Edit3,
  Check,
  Languages,
  MoreHorizontal,
  ChevronDown,
  Settings as SettingsIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SidebarPanelProps {
  editor: Editor;
  activePanel: string | null;
  onClose: () => void;
  theme: string;
  setTheme: (t: string) => void;
  layoutFormat: 'letter' | 'a4';
  setLayoutFormat: (l: 'letter' | 'a4') => void;
  aiWorker?: Worker | null;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface HeadingItem {
  level: number;
  text: string;
  pos: number;
}

export default function SidebarPanel({ editor, activePanel, onClose, theme, setTheme, layoutFormat, setLayoutFormat, aiWorker }: SidebarPanelProps) {
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I am your assistant. How can I help you refine your document today?' }
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // AI Config State
  const [aiConfig, setAiConfig] = useState<any>(null);
  const [isAiTesting, setIsAiTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const PRESETS: Record<string, any> = {
    lmstudio: { baseUrl: 'http://localhost:1234/v1', provider: 'lmstudio' },
    ollama: { baseUrl: 'http://localhost:11434/v1', provider: 'ollama' },
    openai: { baseUrl: 'https://api.openai.com/v1', provider: 'openai' },
    custom: { baseUrl: 'http://localhost:1234/v1', provider: 'custom' }
  };

  useEffect(() => {
    if (activePanel === 'settings') {
      loadAiSettings();
    }
  }, [activePanel]);

  const loadAiSettings = async () => {
    const config = await (window as any).api.getAIConfig();
    setAiConfig(config);
  };

  const handleProviderChange = (p: string) => {
    setAiConfig({ ...aiConfig, ...PRESETS[p], provider: p });
    setTestResult(null);
  };

  const handleSaveAiConfig = async () => {
    await (window as any).api.saveAIConfig(aiConfig);
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    setIsAiTesting(true);
    setTestResult(null);
    const ok = await (window as any).api.testAIConnection(aiConfig);
    setIsAiTesting(false);
    setTestResult(ok ? 'success' : 'error');
  };

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Listen to IPC stream responses dynamically for this component's chats
  useEffect(() => {
    if (!(window as any).api?.onAIChatChunk) return;

    const cleanup = (window as any).api.onAIChatChunk((text: string) => {
      setMessages(prev => {
        const newMsg = [...prev];
        const last = newMsg[newMsg.length - 1];
        if (last && last.role === 'assistant' && last.content === '...') {
          last.content = text;
        } else if (last && last.role === 'assistant') {
          last.content = text;
        } else {
          newMsg.push({ role: 'assistant', content: text });
        }
        return newMsg;
      });
    });

    return cleanup;
  }, []);

  const handleQuickAction = (action: string) => {
    const prompts: Record<string, string> = {
      rewrite: 'Rewrite the current selection to flow better and sound more professional.',
      proofread: 'Proofread the entire document for grammar, spelling, and tone consistency.',
      summarize: 'Provide a concise summary of the main points in this document.',
      expand: 'Expand on the current selection with more depth and professional analysis.'
    };
    const prompt = prompts[action];
    if (prompt) {
      setChatInput('');
      handleSendMessage(null, prompt);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, overrideInput?: string) => {
    if (e) e.preventDefault();
    const input = overrideInput || chatInput;
    if (!input.trim() || isGenerating) return;

    if (!overrideInput) setChatInput('');
    const newMessages: Message[] = [...messages, { role: 'user', content: input }];
    setMessages([...newMessages, { role: 'assistant', content: '...' }]);

    // Post to IPC Backend where the AI server handles inference
    const response = await (window as any).api.processAIChat(newMessages, editor.getHTML());

    if (response?.success) {
      setIsGenerating(false);
    } else {
      setIsGenerating(false);
      setMessages(prev => {
        const newMsg = [...prev];
        const last = newMsg[newMsg.length - 1];
        if (last && last.role === 'assistant' && last.content === '...') {
          last.content = `[Engine Error]: ${response?.error || 'AI Connection failed.'}`;
        }
        return newMsg;
      });
    }
  };
  const headings = useMemo<HeadingItem[]>(() => {
    if (!editor) return [];
    const items: HeadingItem[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        items.push({ level: node.attrs.level, text: node.textContent, pos });
      }
    });
    return items;
  }, [editor, editor?.state.doc]);

  const stats = useMemo(() => {
    if (!editor) return { words: 0, chars: 0, charsNoSpaces: 0, paragraphs: 0, sentences: 0, readTime: 0 };
    const text = editor.getText();
    const words = text.split(/\s+/).filter(w => w.length > 0).length;
    const chars = text.length;
    const charsNoSpaces = text.replace(/\s/g, '').length;
    let paragraphs = 0;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'paragraph' && node.textContent.trim().length > 0) paragraphs++;
    });
    const sentences = (text.match(/[.!?]+/g) || []).length;
    const readTime = Math.max(1, Math.ceil(words / 238));
    return { words, chars, charsNoSpaces, paragraphs, sentences, readTime };
  }, [editor, editor?.state.doc]);

  const pageCount = useMemo(() => {
    if (!editor) return 1;
    const pm = document.querySelector('.ProseMirror') as HTMLElement;
    if (!pm) return 1;
    return Math.max(1, Math.ceil(pm.scrollHeight / 864));
  }, [editor, editor?.state.doc]);

  if (!activePanel) return null;

  const panelTitle = {
    pages: 'Pages',
    outline: 'Outline',
    stats: 'Statistics',
    settings: 'Preferences',
    ai: 'AI Assistant',
  }[activePanel] || '';

  return (
    <AnimatePresence>
      <motion.div
        key={activePanel}
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 260, opacity: 1 }}
        exit={{ width: 0, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        className="shrink-0 border-r border-glass-border bg-[var(--bg-panel)] backdrop-blur-sm overflow-hidden flex flex-col h-full transition-colors duration-300"
      >
        {/* Panel Header */}
        <div className="h-10 flex items-center justify-between px-3 border-b border-white/5 shrink-0">
          <span className="text-xs font-semibold text-[var(--text-secondary)] tracking-wide">{panelTitle}</span>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3">

          {/* ===== PAGES PANEL ===== */}
          {activePanel === 'pages' && (
            <div className="flex flex-col gap-3">
              {Array.from({ length: pageCount }).map((_, i) => (
                <button key={i}
                  className="group relative bg-[var(--bg-sheet)] rounded-lg ring-1 ring-white/[0.06] hover:ring-accent/30 transition-all overflow-hidden"
                  onClick={() => {
                    const pages = document.querySelectorAll('.page-sheet');
                    pages[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}>
                  <div className="aspect-[8.5/11] w-full flex items-center justify-center">
                    <span className="text-[10px] text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition">Page {i + 1}</span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-5 bg-gradient-to-t from-black/40 to-transparent flex items-end justify-center pb-1">
                    <span className="text-[9px] text-gray-400">{i + 1}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ===== OUTLINE PANEL ===== */}
          {activePanel === 'outline' && (
            <div className="flex flex-col gap-0.5">
              {headings.length === 0 ? (
                <div className="text-xs text-[var(--text-muted)] text-center py-8 flex flex-col items-center gap-2">
                  <List size={20} className="text-[var(--text-muted)] opacity-50" />
                  <span>No headings found.</span>
                  <span className="text-[10px] opacity-70">Add headings to build your document outline.</span>
                </div>
              ) : (
                headings.map((h, i) => (
                  <button key={i}
                    onClick={() => {
                      editor.chain().focus().setTextSelection(h.pos + 1).run();
                      setTimeout(() => {
                        const { node } = editor.view.domAtPos(h.pos + 1);
                        (node as HTMLElement)?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
                      }, 50);
                    }}
                    className="text-left px-2 py-1.5 rounded hover:bg-white/[0.06] transition text-xs group flex items-center gap-2"
                    style={{ paddingLeft: `${(h.level - 1) * 12 + 8}px` }}>
                    <Hash size={10} className="text-[var(--text-muted)] group-hover:text-accent/60 shrink-0 transition" />
                    <span className={`truncate ${h.level === 1 ? 'text-[var(--text-main)] font-medium' : h.level === 2 ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'} group-hover:text-[var(--text-main)] transition`}>
                      {h.text || 'Untitled'}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* ===== STATS PANEL ===== */}
          {activePanel === 'stats' && (
            <div className="flex flex-col gap-4">
              {/* Hero stat */}
              <div className="bg-gradient-to-br from-accent/10 to-accent/[0.03] rounded-xl p-4 border border-accent/10">
                <div className="flex items-center gap-2 mb-1">
                  <Type size={14} className="text-accent" />
                  <span className="text-[10px] text-accent/80 uppercase tracking-widest font-semibold">Words</span>
                </div>
                <span className="text-3xl font-bold text-[var(--text-main)] tracking-tight">{stats.words.toLocaleString()}</span>
                <div className="flex items-center gap-1.5 mt-2 text-[11px] text-[var(--text-muted)]">
                  <Clock size={11} />
                  <span>{stats.readTime} min read</span>
                </div>
              </div>

              {/* Stat cards grid */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: Hash, label: 'Characters', value: stats.chars.toLocaleString(), sub: `${stats.charsNoSpaces.toLocaleString()} no spaces` },
                  { icon: Pilcrow, label: 'Paragraphs', value: stats.paragraphs.toLocaleString(), sub: null },
                  { icon: MessageCircle, label: 'Sentences', value: stats.sentences.toLocaleString(), sub: null },
                  { icon: BookOpen, label: 'Pages', value: pageCount.toString(), sub: 'US Letter' },
                ].map(({ icon: Icon, label, value, sub }) => (
                  <div key={label} className="bg-white/[0.025] rounded-xl p-3 border border-white/[0.04] hover:border-white/[0.08] transition group">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Icon size={12} className="text-[var(--text-muted)] group-hover:text-accent/60 transition" />
                      <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{label}</span>
                    </div>
                    <div className="text-xl font-semibold text-[var(--text-secondary)]">{value}</div>
                    {sub && <div className="text-[10px] text-[var(--text-muted)] mt-0.5 opacity-60">{sub}</div>}
                  </div>
                ))}
              </div>

              {/* Reading level indicator */}
              <div className="bg-white/[0.025] rounded-xl p-3 border border-white/[0.04]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Avg. Words per Sentence</span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-xl font-semibold text-[var(--text-secondary)]">
                    {stats.sentences > 0 ? Math.round(stats.words / stats.sentences) : '—'}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] pb-0.5">
                    {stats.sentences > 0
                      ? (stats.words / stats.sentences <= 15 ? 'Easy to read' : stats.words / stats.sentences <= 25 ? 'Moderate' : 'Complex')
                      : ''}
                  </span>
                </div>
                {stats.sentences > 0 && (
                  <div className="mt-2 h-1.5 bg-[var(--bg-app)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (stats.words / stats.sentences / 30) * 100)}%`,
                        background: stats.words / stats.sentences <= 15
                          ? 'linear-gradient(90deg, #4ade80, #22c55e)'
                          : stats.words / stats.sentences <= 25
                            ? 'linear-gradient(90deg, #facc15, #f59e0b)'
                            : 'linear-gradient(90deg, #f87171, #ef4444)',
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== SETTINGS PANEL ===== */}
          {activePanel === 'settings' && (
            <div className="flex flex-col gap-6">
              <div>
                <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block mb-3 font-medium">Appearance</label>
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-3 gap-1.5 bg-[var(--bg-app)] p-1 rounded-xl border border-white/5">
                    {[
                      { id: 'light', label: 'Light' },
                      { id: 'dark', label: 'Dark' },
                      { id: 'system', label: 'System' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTheme(t.id)}
                        className={`py-1.5 rounded-lg text-[11px] transition-all font-medium ${theme === t.id
                            ? 'bg-[var(--accent)] text-white shadow-lg'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/5'
                          }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block mb-3 font-medium">Editor Layout</label>
                <div className="bg-[var(--bg-app)] p-1 rounded-xl border border-white/5 flex gap-1">
                  <button 
                    onClick={() => setLayoutFormat?.('letter')}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                      layoutFormat === 'letter' ? 'bg-[var(--accent)] text-white shadow-md' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5'
                    }`}
                  >
                    Letter
                  </button>
                  <button 
                    onClick={() => setLayoutFormat?.('a4')}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                      layoutFormat === 'a4' ? 'bg-emerald-600 text-white shadow-md' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5'
                    }`}
                  >
                    A4
                  </button>
                </div>
              </div>

              <div className="border-t border-white/5 pt-6">
                <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block mb-3 font-medium">AI Configuration</label>
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-4 gap-1 p-1 bg-[var(--bg-app)] rounded-xl border border-white/5">
                    {['lmstudio', 'ollama', 'openai', 'custom'].map((p) => (
                      <button
                        key={p}
                        onClick={() => handleProviderChange(p)}
                        className={`py-1.5 rounded-lg text-[9px] uppercase font-bold transition-all ${aiConfig?.provider === p
                            ? 'bg-accent text-white shadow-lg'
                            : 'text-[var(--text-muted)] hover:text-white hover:bg-white/5'
                          }`}
                      >
                        {p === 'lmstudio' ? 'LM' : p === 'ollama' ? 'OL' : p === 'openai' ? 'OAI' : 'CST'}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <div className="bg-[var(--bg-app)] rounded-lg p-2 border border-white/5">
                      <label className="text-[9px] text-[var(--text-muted)] uppercase font-bold block mb-1">Base URL</label>
                      <input
                        type="text"
                        value={aiConfig?.baseUrl || ''}
                        onChange={(e) => setAiConfig({ ...aiConfig, baseUrl: e.target.value })}
                        className="w-full bg-transparent text-xs text-[var(--text-secondary)] focus:outline-none"
                        placeholder="http://localhost:1234/v1"
                      />
                    </div>

                    {(aiConfig?.provider === 'openai' || aiConfig?.provider === 'custom') && (
                       <div className="bg-[var(--bg-app)] rounded-lg p-2 border border-white/5">
                        <label className="text-[9px] text-[var(--text-muted)] uppercase font-bold block mb-1">API Key</label>
                        <input
                          type="password"
                          value={aiConfig?.apiKey || ''}
                          onChange={(e) => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
                          className="w-full bg-transparent text-xs text-[var(--text-secondary)] focus:outline-none"
                          placeholder="sk-..."
                        />
                      </div>
                    )}

                    <div className="bg-[var(--bg-app)] rounded-lg p-2 border border-white/5">
                      <label className="text-[9px] text-[var(--text-muted)] uppercase font-bold block mb-1">Model Name</label>
                      <input
                        type="text"
                        value={aiConfig?.modelName || ''}
                        onChange={(e) => setAiConfig({ ...aiConfig, modelName: e.target.value })}
                        className="w-full bg-transparent text-xs text-[var(--text-secondary)] focus:outline-none"
                        placeholder="default"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={handleTestConnection}
                      disabled={isAiTesting}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all border ${
                        testResult === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                        testResult === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                        'bg-white/[0.03] border-white/5 text-[var(--text-secondary)] hover:bg-white/10'
                      }`}
                    >
                      {isAiTesting ? <RefreshCw size={12} className="animate-spin" /> : 
                       testResult === 'success' ? <CheckCircle2 size={12} /> :
                       testResult === 'error' ? <AlertCircle size={12} /> :
                       <SettingsIcon size={12} />}
                      {isAiTesting ? 'Testing...' : testResult === 'success' ? 'Online' : testResult === 'error' ? 'Offline' : 'Test Connection'}
                    </button>
                    
                    <button
                      onClick={handleSaveAiConfig}
                      className="bg-accent hover:bg-accent/80 text-white font-bold py-2 px-4 rounded-xl text-[10px] shadow-lg shadow-accent/20 transition-all"
                    >
                      Save Configuration
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===== AI ASSISTANT PANEL ===== */}
          {activePanel === 'ai' && (
            <div className="flex flex-col h-full -mx-3 -mt-3 relative bg-[var(--bg-panel)] transition-colors duration-500">
              
              {/* Message Feed */}
              <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 flex flex-col gap-6 custom-scrollbar scroll-smooth">
                {messages.map((msg, i) => (
                  <MessageBubble 
                    key={i} 
                    msg={msg} 
                    isLast={i === messages.length - 1}
                    onApply={(action, content) => {
                      if (action === 'UPDATE' || action === 'INSERT') {
                        editor.chain().focus().insertContent(content).run();
                      }
                    }}
                  />
                ))}
                {isGenerating && messages[messages.length - 1]?.role !== 'assistant' && (
                  <MessageBubble msg={{ role: 'assistant', content: '...' }} isLast />
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Agentic Input Area - Liquid Glass */}
              <div className="absolute bottom-4 left-4 right-4 z-20">
                <div className="liquid-glass rounded-2xl p-1.5 shadow-xl border-white/10 hover:border-white/20 transition-all group ring-1 ring-black/10">
                  <div className="relative">
                    <textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Ask the Agent..."
                      className="w-full bg-transparent border-none px-4 py-3 pr-12 text-[13px] text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-0 transition-all resize-none min-h-[48px] max-h-32"
                      rows={1}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!chatInput.trim() || isGenerating}
                      className={`absolute right-2 bottom-2 p-2 rounded-[14px] transition-all
                        ${chatInput.trim() && !isGenerating
                          ? 'bg-accent text-white shadow-lg scale-100 hover:scale-105 active:scale-95'
                          : 'text-[var(--text-muted)] opacity-20 scale-90 cursor-not-allowed'}`}
                    >
                      {isGenerating ? <RefreshCw size={14} className="animate-spin text-accent" /> : <Send size={16} strokeWidth={2.5} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Message Bubble Component with Action Detection
 */
function MessageBubble({ msg, onApply, isLast }: { msg: Message, onApply?: (action: string, content: string) => void, isLast?: boolean }) {
  const isUser = msg.role === 'user';
  const [showThought, setShowThought] = useState(false);
  
  // Native Gemma 4 Tag Parser
  const parts = useMemo(() => {
    if (isUser) return [{ type: 'text', content: msg.content }];
    
    // Support both <thought> and <action type="..."> tags
    const tagRegex = /(?:<thought>([\s\S]*?)<\/thought>)|(?:<action\s+type="([^"]+)">([\s\S]*?)<\/action>)/g;
    const items: { type: 'text' | 'thought' | 'action', content: string, action?: string }[] = [];
    let lastIndex = 0;
    let match;

    const content = msg.content.replace(/\[TOOL_REQUEST\]\s*/g, '');

    while ((match = tagRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        items.push({ type: 'text', content: content.substring(lastIndex, match.index) });
      }
      
      if (match[1]) { // <thought> match
        items.push({ type: 'thought', content: match[1].trim() });
      } else { // <action> match
        items.push({ type: 'action', action: match[2], content: match[3].trim() });
      }
      lastIndex = tagRegex.lastIndex;
    }

    if (lastIndex < content.length) {
      items.push({ type: 'text', content: content.substring(lastIndex) });
    }

    // Thinking stream indicator
    if (content === '...') {
      return [{ type: 'thinking', content: '' }];
    }

    return items;
  }, [msg.content, isUser]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}
    >
      <div className="flex flex-col gap-3 w-full">
        {parts.map((part, idx) => (
          part.type === 'action' ? (
            <ActionCard key={idx} action={part.action!} content={part.content} onApply={onApply} />
          ) : part.type === 'thought' ? (
            <div key={idx} className="flex flex-col gap-1 w-full opacity-60 hover:opacity-100 transition-opacity">
               <button 
                onClick={() => setShowThought(!showThought)}
                className="flex items-center gap-1.5 group w-fit"
               >
                 <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                 <span className="text-[10px] font-bold uppercase tracking-wider text-accent flex items-center gap-1">
                   {showThought ? 'Hide Reasoning' : 'Show Reasoning'}
                   <ChevronDown size={10} className={`transition-transform ${showThought ? 'rotate-180' : ''}`} />
                 </span>
               </button>
               <AnimatePresence>
                 {showThought && (
                   <motion.div 
                     initial={{ height: 0, opacity: 0 }}
                     animate={{ height: 'auto', opacity: 1 }}
                     exit={{ height: 0, opacity: 0 }}
                     className="overflow-hidden"
                   >
                     <div className="text-[11px] leading-relaxed text-[var(--text-muted)] italic pl-3 border-l border-white/5 py-1">
                       {part.content}
                     </div>
                   </motion.div>
                 )}
               </AnimatePresence>
            </div>
          ) : part.type === 'thinking' ? (
            <div key={idx} className="flex items-center gap-2 h-8 px-4 bg-white/5 w-fit rounded-full border border-white/5">
              <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 rounded-full bg-accent" />
              <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-accent" />
              <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-accent" />
            </div>
          ) : (
            part.content.trim() && (
              <div key={idx} className={`max-w-[88%] px-4 py-3 rounded-[20px] text-[13px] leading-[1.7] relative border
                ${isUser 
                  ? 'bg-accent text-white border-accent/20 self-end rounded-tr-none shadow-lg shadow-accent/5' 
                  : 'bg-[var(--bg-sheet)] border-white/5 text-[var(--text-secondary)] rounded-tl-none self-start shadow-sm flex flex-col'}`}>
                {
                  isUser ? part.content : (
                    part.content.split('\n').map((line, i) => {
                      if (!line.trim()) return <div key={i} className="h-2" />; // Paragraph spacing
                      
                      const isListItem = line.trim().match(/^[-*]\s(.*)/) || line.trim().match(/^(\d+\.)\s(.*)/);
                      
                      let html = line
                        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-[var(--text-main)]">$1</strong>')
                        .replace(/\*(.*?)\*/g, '<em class="italic opacity-90">$1</em>')
                        .replace(/`(.*?)`/g, '<code class="bg-black/20 text-accent px-1.5 py-0.5 rounded-md text-[11px] font-mono border border-white/5">$1</code>');
                      
                      if (isListItem) {
                        return (
                          <div key={i} className="flex gap-2.5 mb-1.5 mt-0.5 pl-1">
                            <span className="text-accent/60 font-bold shrink-0">{isListItem[1] || '•'}</span>
                            <span dangerouslySetInnerHTML={{ __html: isListItem[2] || html.replace(/^[-*]\s/, '') }} />
                          </div>
                        );
                      }
                      
                      // Heading check
                      const isHeading = line.match(/^(#{1,3})\s(.*)/);
                      if (isHeading) {
                        return (
                           <div key={i} className="font-bold text-[var(--text-main)] mt-3 mb-1.5 border-b border-white/5 pb-1" dangerouslySetInnerHTML={{ __html: html.replace(/^(#{1,3})\s/, '') }} />
                        );
                      }
                      
                      return <div key={i} className="mb-1.5" dangerouslySetInnerHTML={{ __html: html }} />;
                    })
                  )
                }
              </div>
            )
          )
        ))}
      </div>
    </motion.div>
  );
}

/**
 * Interactive Action Card for Agent Edits
 */
function ActionCard({ action, content, onApply }: { action: string, content: string, onApply?: (a: string, c: string) => void }) {
  const [applied, setApplied] = useState(false);

  return (
    <motion.div 
      initial={{ x: -10, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="w-full self-start flex flex-col group overflow-hidden border border-white/5 rounded-2xl bg-white/[0.03] backdrop-blur-md"
    >
      <div className="flex items-center justify-between px-4 py-3 bg-white/[0.02] border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center border border-accent/20">
            <Layers size={12} className="text-accent" />
          </div>
          <span className="text-[11px] font-bold text-[var(--text-secondary)] tracking-tight">Proposed Change</span>
        </div>
      </div>
      
      <div className="p-4 text-[12px] leading-relaxed text-[var(--text-secondary)] opacity-90 max-h-80 overflow-y-auto custom-scrollbar prose-mini">
        <div 
          className="rendered-preview"
          dangerouslySetInnerHTML={{ __html: content }} 
        />
      </div>

      <div className="px-4 py-3 bg-black/10 flex justify-end">
        <button
          onClick={() => {
            onApply?.(action, content);
            setApplied(true);
          }}
          disabled={applied}
          className={`group flex items-center gap-2 px-5 h-10 rounded-xl text-[11px] font-bold transition-all
            ${applied 
              ? 'bg-green-500/10 text-green-500 cursor-default ring-1 ring-green-500/20' 
              : 'bg-accent text-white hover:brightness-110 shadow-lg shadow-accent/20'}`}
        >
          {applied ? <CheckCircle2 size={14} /> : <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />}
          {applied ? 'Applied' : 'Confirm Update'}
        </button>
      </div>
    </motion.div>
  );
}
