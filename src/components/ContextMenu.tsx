import { useState, useEffect, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { NodeSelection } from 'prosemirror-state';
import { DOMSerializer } from 'prosemirror-model';
import { WandSparkles, MessageSquareText, Check, ArrowRight, Undo2, AlignLeft, AlignCenter, AlignRight, Crop, Trash2, Scissors, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ContextMenuProps {
  editor: Editor;
  aiWorker?: Worker | null;
}

interface MenuPosition {
  x: number;
  y: number;
}

export default function ContextMenu({ editor, aiWorker }: ContextMenuProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ x: 0, y: 0 });
  const [processing, setProcessing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const editorEl = document.querySelector('.ProseMirror');
      if (!editorEl || !editorEl.contains(e.target as Node)) return;
      
      // If we clicked on an image or its container, ensure it's selected
      const target = e.target as HTMLElement;
      const resizableImage = target.closest('.resizable-image-container');
      if (resizableImage) {
        // We need to find the position of this node in the editor
        const pos = editor.view.posAtDOM(resizableImage, 0);
        if (pos >= 0) {
          editor.chain().setNodeSelection(pos).run();
        }
      }

      e.preventDefault();
      setPosition({ x: e.clientX, y: e.clientY });
      setVisible(true);
    };

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setVisible(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisible(false);
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // After render, measure menu and reposition if it overflows viewport
  useEffect(() => {
    if (!visible || !menuRef.current) return;

    requestAnimationFrame(() => {
      if (!menuRef.current) return;
      const rect = menuRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let x = position.x;
      let y = position.y;

      if (x + rect.width > vw - 8) x = Math.max(8, x - rect.width);
      if (y + rect.height > vh - 8) y = Math.max(8, y - rect.height);

      if (x !== position.x || y !== position.y) {
        setPosition({ x, y });
      }
    });
  }, [visible]);

  const getSelectedText = (): string => {
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to);
  };

  const handleAIAction = async (action: string) => {
    const text = isImageMode ? 'this image' : getSelectedText();
    if (!text && action !== 'grammar-full' && !isImageMode) { setVisible(false); return; }

    const { from, to } = editor.state.selection;
    setProcessing(true);

    try {
      // Map legacy action IDs to new Router IDs
      const actionMap: Record<string, string> = {
        'summarize': 'SUMMARIZE',
        'rewrite': 'IMPROVE_FLOW',
        'fix-grammar': 'FIX_GRAMMAR',
        'simplify': 'SIMPLIFY',
        'expand': 'EXPAND',
        'describe-image': 'CUSTOM'
      };

      // Get the image source if we are in image mode
      let imageBase64 = '';
      if (isImageMode && editor.state.selection instanceof NodeSelection && editor.state.selection.node.type.name === 'resizableImage') {
        const src = editor.state.selection.node.attrs.src;
        if (src.startsWith('data:')) {
          imageBase64 = src;
        } else if ((window as any).api?.getImageBase64) {
          try {
            imageBase64 = await (window as any).api.getImageBase64(src);
          } catch (e) {
            console.warn('Failed to convert image to base64 for AI vision:', e);
            imageBase64 = src; // fallback
          }
        }
      }

      const toolId = actionMap[action] || 'CUSTOM';
      const promptText = toolId === 'CUSTOM' && action === 'describe-image' 
        ? `[TOOL_REQUEST:CUSTOM] Describe this image vividly in one strong paragraph.\n\nCRITICAL INSTRUCTION: Output ONLY the description. DO NOT include any conversational preamble or pleasantries.`
        : `[TOOL_REQUEST:${toolId}]\n\nTARGET_TEXT_TO_PROCESS:\n"${text}"\n\nCRITICAL INSTRUCTION: Output ONLY the processed text. DO NOT include any conversational preamble, explanation, or context.`;

      const promptContent = imageBase64
        ? [
            { type: 'text', text: promptText },
            { type: 'image_url', image_url: { url: imageBase64 } }
          ]
        : promptText;

      const response = await (window as any).api.processAIChat(
        [{ role: 'user', content: promptContent }],
        undefined, // Omit global context for strictly scoped target edits
        true // silentMode: true for writing tools
      );

      if (response?.success) {
        // Dispatch event to Editor.tsx to handle the Review Flow
        window.dispatchEvent(new CustomEvent('seam-ai-proposal', { 
          detail: { from, to, content: response.result, toolId } 
        }));
      }
    } catch (e) {
      console.error('AI action failed:', e);
    } finally {
      setProcessing(false);
      setVisible(false);
    }
  };

  const handleAlign = (align: string) => {
    editor.chain().focus().updateAttributes('resizableImage', { align }).run();
    setVisible(false);
  };

  const handleToggleCrop = () => {
    // We need to tell the image node to enter crop mode. 
    // Since isCropping is local to the node, we use a command or attribute.
    // For now, let's just trigger a custom event or rely on the image toolbar's logic if I kept it.
    // Actually, I'll add 'isCropping' to the node attributes.
    const attrs = editor.getAttributes('resizableImage');
    editor.chain().focus().updateAttributes('resizableImage', { isCropping: !attrs.isCropping }).run();
    setVisible(false);
  };

  const handleManualClipboard = async (action: 'copy' | 'cut') => {
    const { state } = editor;
    const { selection } = state;

    try {
      // 1. Get the slice (the selected content)
      const slice = selection.content();
      
      // 2. Serialize to HTML
      const div = document.createElement('div');
      div.className = 'ProseMirror';
      const fragment = DOMSerializer.fromSchema(state.schema).serializeFragment(slice.content);
      div.appendChild(fragment);
      const html = div.innerHTML;

      // 3. Serialize to Text
      const text = state.doc.textBetween(selection.from, selection.to, '\n') || (isImageMode ? '[Image]' : '');

      // 4. Handle Native Image Data (Electron specific)
      let imageBase64: string | undefined = undefined;
      const api = (window as any).api;

      if (isImageMode && api?.getImageBase64) {
        // Find the image node in the selection
        let src: string | null = null;
        if (selection instanceof NodeSelection && selection.node.type.name === 'resizableImage') {
          src = selection.node.attrs.src;
        }

        if (src) {
          try {
            imageBase64 = await api.getImageBase64(src);
          } catch (e) {
            console.warn('Failed to get native image data for clipboard:', e);
          }
        }
      }

      // 5. Write to clipboard
      if (api?.clipboardWrite) {
        // Native Electron way (handles multi-format perfectly)
        await api.clipboardWrite({ html, text, imageBase64 });
      } else {
        // Fallback to web API
        const clipboardData: Record<string, Blob> = {
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        };
        await navigator.clipboard.write([
          new ClipboardItem(clipboardData)
        ]);
      }

      // 6. If cut, delete the selection
      if (action === 'cut') {
        editor.chain().focus().deleteSelection().run();
      }

      setVisible(false);
    } catch (err) {
      console.error('Clipboard action failed:', err);
      // Last resort fallback
      const text = state.doc.textBetween(selection.from, selection.to, '\n') || (isImageMode ? '[Image]' : '');
      await navigator.clipboard.writeText(text);
      if (action === 'cut') {
        editor.chain().focus().deleteSelection().run();
      }
      setVisible(false);
    }
  };

  const handleManualPaste = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (item.types.includes('text/html')) {
          const blob = await item.getType('text/html');
          const html = await blob.text();
          editor.chain().focus().insertContent(html).run();
          setVisible(false);
          return;
        }
      }
      // Fallback to text
      const text = await navigator.clipboard.readText();
      editor.chain().focus().insertContent(text).run();
      setVisible(false);
    } catch (err) {
      console.error('Manual paste failed:', err);
      // Last resort fallback
      const text = await navigator.clipboard.readText();
      editor.chain().focus().insertContent(text).run();
      setVisible(false);
    }
  };

  const isImageMode = editor.isActive('resizableImage') || (editor.state.selection instanceof NodeSelection && editor.state.selection.node.type.name === 'resizableImage');

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.12, ease: 'easeOut' }}
        className="fixed z-[9999] w-56 rounded-lg shadow-2xl border border-[var(--border-glass)] bg-[var(--bg-panel)]/98 backdrop-blur-xl py-1 text-xs transition-colors duration-300"
        style={{ left: position.x, top: position.y }}
      >
        {processing ? (
          <div className="flex items-center gap-2 px-3 py-4 text-accent justify-center">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
              <WandSparkles size={14} />
            </motion.div>
            <span>Processing…</span>
          </div>
        ) : (
          <>
            {isImageMode ? (
              <>
                <button onClick={() => handleAIAction('describe-image')} className="w-full text-left px-3 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)] flex items-center gap-2 transition">
                  <WandSparkles size={13} className="text-accent/70" /> Describe Image
                </button>
                
                <div className="h-px bg-[var(--border-glass)] my-1" />
                
                <div className="flex items-center gap-1 px-2 mb-1">
                  <button onClick={() => handleAlign('left')} className="p-1.5 flex-1 hover:bg-[var(--hover-bg)] rounded-md transition flex justify-center text-[var(--text-muted)] hover:text-[var(--text-main)]"><AlignLeft size={14}/></button>
                  <button onClick={() => handleAlign('center')} className="p-1.5 flex-1 hover:bg-[var(--hover-bg)] rounded-md transition flex justify-center text-[var(--text-muted)] hover:text-[var(--text-main)]"><AlignCenter size={14}/></button>
                  <button onClick={() => handleAlign('right')} className="p-1.5 flex-1 hover:bg-[var(--hover-bg)] rounded-md transition flex justify-center text-[var(--text-muted)] hover:text-[var(--text-main)]"><AlignRight size={14}/></button>
                </div>

                <button onClick={handleToggleCrop} className="w-full text-left px-3 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)] flex items-center gap-2 transition">
                  <Crop size={13} className="text-[var(--text-muted)]" /> Toggle Crop Mode
                </button>

                <div className="h-px bg-[var(--border-glass)] my-1" />

                <button onClick={() => handleManualClipboard('cut')} className="w-full text-left px-3 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)] flex items-center justify-between transition group/item">
                  <span className="flex items-center gap-2"><Scissors size={13} className="text-[var(--text-muted)] group-hover/item:text-accent transition" /> Cut Image</span>
                  <span className="text-[var(--text-muted)] text-[10px]">Ctrl+X</span>
                </button>
                <button onClick={() => handleManualClipboard('copy')} className="w-full text-left px-3 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)] flex items-center justify-between transition group/item">
                  <span className="flex items-center gap-2"><Copy size={13} className="text-[var(--text-muted)] group-hover/item:text-accent transition" /> Copy Image</span>
                  <span className="text-[var(--text-muted)] text-[10px]">Ctrl+C</span>
                </button>
              </>
            ) : (
              <>
                <button onClick={() => handleAIAction('fix-grammar')} className="w-full text-left px-3 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)] flex items-center gap-2 transition">
                  <Check size={13} className="text-accent/70" /> Fix Grammar & Spelling
                </button>
                <button onClick={() => handleAIAction('rewrite')} className="w-full text-left px-3 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)] flex items-center gap-2 transition">
                  <WandSparkles size={13} className="text-accent/70" /> Rewrite Selection
                </button>
                <button onClick={() => handleAIAction('simplify')} className="w-full text-left px-3 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)] flex items-center gap-2 transition">
                  <MessageSquareText size={13} className="text-accent/70" /> Simplify
                </button>
                <button onClick={() => handleAIAction('expand')} className="w-full text-left px-3 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)] flex items-center gap-2 transition">
                  <ArrowRight size={13} className="text-accent/70" /> Expand & Elaborate
                </button>
              </>
            )}

            <div className="h-px bg-[var(--border-glass)] my-1" />

            {isImageMode ? (
               <button onClick={() => { editor.chain().focus().deleteSelection().run(); setVisible(false); }} className="w-full text-left px-3 py-1.5 text-[var(--text-secondary)] hover:bg-red-500/10 hover:text-red-400 flex items-center gap-2 transition">
                <Trash2 size={13} /> Remove Image
              </button>
            ) : (
              <>
                <button onClick={() => { editor.chain().focus().undo().run(); setVisible(false); }} disabled={!editor.can().undo()} className="w-full text-left px-3 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)] flex items-center justify-between transition disabled:opacity-30">
                  <span className="flex items-center gap-2"><Undo2 size={13} /> Undo</span>
                  <span className="text-[var(--text-muted)] text-[10px]">Ctrl+Z</span>
                </button>
                <button onClick={() => handleManualClipboard('cut')} className="w-full text-left px-3 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)] flex items-center justify-between transition">
                  <span>Cut</span><span className="text-[var(--text-muted)] text-[10px]">Ctrl+X</span>
                </button>
                <button onClick={() => handleManualClipboard('copy')} className="w-full text-left px-3 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)] flex items-center justify-between transition">
                  <span>Copy</span><span className="text-[var(--text-muted)] text-[10px]">Ctrl+C</span>
                </button>
              </>
            )}
            <button onClick={handleManualPaste} className="w-full text-left px-3 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)] flex items-center justify-between transition">
              <span>Paste</span><span className="text-[var(--text-muted)] text-[10px]">Ctrl+V</span>
            </button>

            <div className="h-px bg-[var(--border-glass)] my-1" />

            <button onClick={() => { editor.chain().focus().selectAll().run(); setVisible(false); }} className="w-full text-left px-3 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)] flex items-center justify-between transition">
              <span>Select All</span><span className="text-[var(--text-muted)] text-[10px]">Ctrl+A</span>
            </button>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
