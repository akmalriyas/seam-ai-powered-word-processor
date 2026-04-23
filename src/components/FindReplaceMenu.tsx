import { useState, useEffect, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ChevronUp, ChevronDown, Replace, Sparkles, Loader2 } from 'lucide-react';

interface FindReplaceMenuProps {
  editor: Editor | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function FindReplaceMenu({ editor, isOpen, onClose }: FindReplaceMenuProps) {
  const [tab, setTab] = useState<'STANDARD' | 'CONTEXT'>('STANDARD');
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [contextQuery, setContextQuery] = useState('');
  const [isAiSearching, setIsAiSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && tab === 'STANDARD' && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, tab]);

  useEffect(() => {
    if (editor) {
      if (tab === 'STANDARD') {
        editor.commands.setSearchTerm(findText);
      } else {
        // Clear search when in context tab
        editor.commands.setSearchTerm('');
      }
    }
  }, [findText, editor, tab]);

  useEffect(() => {
    if (editor) {
      editor.commands.setReplaceTerm(replaceText);
    }
  }, [replaceText, editor]);

  // Clean up search highlights on unmount or close
  useEffect(() => {
    if (!isOpen && editor) {
      editor.commands.clearSearch();
    }
  }, [isOpen, editor]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter') {
        if (tab === 'STANDARD') {
          if (e.shiftKey) {
            editor?.commands.prevMatch();
          } else {
            editor?.commands.nextMatch();
          }
        } else if (tab === 'CONTEXT') {
          if (contextQuery.trim()) {
            handleContextSearch();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, tab, editor, onClose, contextQuery]);

  const handleContextSearch = async () => {
    if (!editor || !contextQuery.trim() || isAiSearching) return;
    setIsAiSearching(true);
    
    try {
      // Chunk up to 40k chars (roughly 10k tokens)
      const fullText = editor.getText().substring(0, 40000);
      
      const prompt = `[TOOL_REQUEST:CUSTOM] Find the exact chronological quote in the document that matches this concept: "${contextQuery}".
      
TARGET_TEXT_TO_PROCESS:
"""
${fullText}
"""

CRITICAL RULES:
1. Output ONLY the exact matching text block directly pulled verbatim from the text. Make sure it matches character for character.
2. Output a small excerpt (1 to 2 sentences max) that encompasses the concept. Do not output massive paragraphs.
3. If the concept is physically not described in the document, output EXACTLY "NOT_FOUND".
4. NO PREAMBLE or extra symbols, just the verbatim string.`;

      const response = await (window as any).api.processAIChat(
        [{ role: 'user', content: prompt }],
        undefined,
        true // silentMode: true
      );

      if (response?.success && response.result !== 'NOT_FOUND') {
        let quote = response.result.replace(/^["']|["']$/g, '').trim(); // Remove wrapping quotes if AI hallucinated them
        
        // Ensure string is short enough for comfortable native finding
        if (quote.length > 500) quote = quote.substring(0, 200).trim();
        
        setFindText(quote);
        setTab('STANDARD');
      } else {
        // Not found feedback, could be integrated better but alert works functionally for now
        alert("The AI could not confidently locate that concept within the document.");
      }
    } catch (e) {
      console.error("AI Context Search failed:", e);
      alert("Failed to perform AI Context Search. Check your AI settings.");
    } finally {
      setIsAiSearching(false);
    }
  };

  if (!isOpen) return null;

  const results = editor?.storage.searchAndReplace?.results || [];
  const currentIndex = editor?.storage.searchAndReplace?.currentIndex;
  const showCount = results.length > 0;
  const countText = showCount ? `${currentIndex + 1} / ${results.length}` : '0 / 0';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="fixed top-20 right-8 z-[8000] w-80 bg-[var(--bg-panel)]/95 backdrop-blur-3xl border border-[var(--border-glass)] shadow-2xl rounded-2xl overflow-hidden flex flex-col"
      >
        {/* Header Tabs */}
        <div className="flex px-2 pt-2 border-b border-[var(--border-glass)]">
          <button 
            onClick={() => setTab('STANDARD')}
            className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 ${tab === 'STANDARD' ? 'border-accent text-[var(--text-main)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
          >
            Find
          </button>
          <button 
            onClick={() => setTab('CONTEXT')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 ${tab === 'CONTEXT' ? 'border-accent text-accent' : 'border-transparent text-[var(--text-muted)] hover:text-accent/60'}`}
          >
            <Sparkles size={13} className={tab === 'CONTEXT' ? 'text-accent' : ''} /> Context AI
          </button>
          <button onClick={onClose} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5 rounded-lg ml-2 mb-1">
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-3 flex flex-col gap-3">
          {tab === 'STANDARD' ? (
            <>
              {/* Find Row */}
              <div className="relative flex items-center group">
                <Search size={14} className="absolute left-3 text-[var(--text-muted)] group-focus-within:text-accent transition" />
                <input
                  ref={inputRef}
                  value={findText}
                  onChange={(e) => setFindText(e.target.value)}
                  placeholder="Find..."
                  className="w-full bg-[var(--hover-bg)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] text-[13px] rounded-lg pl-9 pr-24 py-2 border border-transparent focus:border-accent/40 focus:bg-[var(--bg-app)] outline-none transition-all"
                />
                
                {/* Result Counter & Nav */}
                <div className="absolute right-2 flex items-center text-[11px] text-[var(--text-muted)] gap-1">
                  <span className="mr-1">{countText}</span>
                  <button onClick={() => editor?.commands.prevMatch()} disabled={!showCount} className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition">
                    <ChevronUp size={14} />
                  </button>
                  <button onClick={() => editor?.commands.nextMatch()} disabled={!showCount} className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition">
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>

              {/* Replace Row */}
              <div className="relative flex items-center group">
                <Replace size={14} className="absolute left-3 text-[var(--text-muted)] group-focus-within:text-accent transition" />
                <input
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  placeholder="Replace with..."
                  className="w-full bg-[var(--hover-bg)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] text-[13px] rounded-lg pl-9 pr-20 py-2 border border-transparent focus:border-accent/40 focus:bg-[var(--bg-app)] outline-none transition-all"
                />
                <button 
                  onClick={() => editor?.commands.replace()}
                  disabled={!showCount}
                  className="absolute right-9 text-[11px] font-bold text-accent px-2 py-1 rounded hover:bg-accent/10 disabled:opacity-30 disabled:hover:bg-transparent transition"
                >
                  Rep
                </button>
                <button 
                  onClick={() => editor?.commands.replaceAll()}
                  disabled={!showCount}
                  className="absolute right-1 text-[11px] font-bold text-accent px-2 py-1 rounded hover:bg-accent/10 disabled:opacity-30 disabled:hover:bg-transparent transition"
                >
                  All
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Context Action Row */}
              <div className="flex flex-col gap-2">
                <p className="text-[11px] text-[var(--text-muted)] leading-tight px-1">
                  Ask Seam to find a specific event or concept. It will read your entire document and highlight the exact quote matching your query.
                </p>
                <div className="relative flex flex-col group mt-1">
                  <textarea
                    autoFocus
                    value={contextQuery}
                    onChange={(e) => setContextQuery(e.target.value)}
                    placeholder="e.g., The part where the cat jumps out the window"
                    className="w-full bg-[var(--hover-bg)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] text-[13px] rounded-xl px-3 py-2.5 border border-transparent focus:border-accent/40 focus:bg-[var(--bg-app)] outline-none min-h-[70px] resize-none transition-all"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleContextSearch();
                      }
                    }}
                  />
                  <button 
                    onClick={handleContextSearch}
                    disabled={isAiSearching || !contextQuery.trim()}
                    className="mt-2 w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 disabled:bg-accent/50 text-white py-2 rounded-xl text-xs font-semibold transition"
                  >
                    {isAiSearching ? (
                      <><Loader2 size={14} className="animate-spin" /> Scanning Semantic Map...</>
                    ) : (
                      <><Sparkles size={14} /> Find Location</>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
