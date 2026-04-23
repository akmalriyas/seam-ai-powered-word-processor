import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Editor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { NodeSelection } from 'prosemirror-state';
import LiquidGlassMenu from './LiquidGlassMenu';
import { Sparkles, Check, X, Wand2, ArrowRight, Loader2 } from 'lucide-react';

const MARGIN_Y = 96;  // 1 inch equivalent
const MARGIN_X = 96;

export default function PagedEditor({ editor, layoutFormat }: { editor: Editor, layoutFormat?: 'letter' | 'a4' }) {
  const isA4 = layoutFormat === 'a4';
  const PAGE_WIDTH = isA4 ? 794 : 816;
  const PAGE_HEIGHT = isA4 ? 1123 : 1056;
  const CONTENT_HEIGHT = PAGE_HEIGHT - (MARGIN_Y * 2);

  const [pageCount, setPageCount] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [proposal, setProposal] = useState<{ content: string } | null>(null);
  const [proposalRange, setProposalRange] = useState<{ from: number, to: number } | null>(null);
  const [isSparkling, setIsSparkling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const recalculatePages = useCallback(() => {
    if (!containerRef.current) return;
    const proseMirror = containerRef.current.querySelector('.ProseMirror') as HTMLElement;
    if (!proseMirror) return;

    const contentHeight = proseMirror.scrollHeight;
    const pages = Math.max(1, Math.ceil(contentHeight / CONTENT_HEIGHT));
    if (pages !== pageCount) setPageCount(pages);
  }, [pageCount, CONTENT_HEIGHT]);

  useEffect(() => {
    if (!containerRef.current) return;
    const proseMirror = containerRef.current.querySelector('.ProseMirror') as HTMLElement;
    if (!proseMirror) return;

    const ro = new ResizeObserver(() => recalculatePages());
    ro.observe(proseMirror);

    const mo = new MutationObserver(() => recalculatePages());
    mo.observe(proseMirror, { childList: true, subtree: true, characterData: true });

    recalculatePages();
    return () => { ro.disconnect(); mo.disconnect(); };
  }, [editor, recalculatePages]);

  // Force Tiptap to re-evaluate shouldShow by triggering a focus/selection transaction exactly when the proposal is ready
  useEffect(() => {
    if (proposal && proposalRange && editor) {
      // A tiny delay ensures React has finished mounting internal wrappers before Tippy recalculates its position
      setTimeout(() => {
        if (!editor.isDestroyed) {
           editor.chain().focus().setTextSelection({ from: proposalRange.from, to: proposalRange.to }).run();
        }
      }, 50);
    }
  }, [proposal, proposalRange, editor]);

  // Listen for AI proposals from external menus (e.g. ContextMenu)
  useEffect(() => {
    const handleProposal = (e: any) => {
      const { from, to, content, toolId } = e.detail;
      
      // 1. Just set the range for the overlay, no marks
      setProposalRange({ from, to });

      // 2. Set the tool name for HUD
      if (toolId) setActiveTool(toolId);
      
      setProposal({ content });
    };
    window.addEventListener('seam-ai-proposal', handleProposal);
    return () => window.removeEventListener('seam-ai-proposal', handleProposal);
  }, [editor]);

  const performAIAction = async (action: string, customPrompt?: string) => {
    const selection = editor.view.state.selection;
    if (selection.empty) return;
    
    const { from, to } = selection;
    setIsProcessing(true);
    setProposal(null);
    setProposalRange({ from, to });
    setActiveTool(action);

    try {
      // 1. Apply visual processing overlay via Decoration (purely visual)
      editor.commands.setAIProcessingRange({ from, to });

      const selectionText = editor.state.doc.textBetween(from, to);
      const prompt = customPrompt 
        ? `[TOOL_REQUEST:CUSTOM] ${customPrompt}\n\nTARGET_TEXT_TO_PROCESS:\n"${selectionText}"\n\nCRITICAL INSTRUCTION: Output ONLY the processed text. DO NOT include any conversational preamble, explanation, or context.` 
        : `[TOOL_REQUEST:${action}]\n\nTARGET_TEXT_TO_PROCESS:\n"${selectionText}"\n\nCRITICAL INSTRUCTION: Output ONLY the processed text. DO NOT include any conversational preamble, explanation, or context.`;

      const response = await (window as any).api.processAIChat(
        [{ role: 'user', content: prompt }], 
        undefined, // Omit global context for in-line tools to strictly focus on the selection
        true
      );

      if (response?.success) {
        // == NUCLEAR SANITIZATION V3 ==
        let result = response.result || '';
        
        const deepScrub = (text: string): string => {
          const technicalLabels = /^(html|markdown|text|css|javascript|improved|revised|result|here is|here's|the text|the result|corrected|refined)[:\-\s\*\n]*/i;
          const codeFences = /^(\s*```[a-z]*\n?)/i;
          
          let changed = false;
          let output = text.trim()
            .replace(/<thought>[\s\S]*?<\/thought>/gi, '') // Remove thoughts
            .replace(/<action[^>]*>([\s\S]*?)<\/action>/gi, '$1'); // Extract action
          
          // 1. Remove wrapping code blocks
          if (output.startsWith('```') && output.endsWith('```')) {
            output = output.replace(/^```[a-z]*\n?([\s\S]*?)```$/i, '$1').trim();
            changed = true;
          }
          
          // 2. Remove leading labels
          const labelMatch = output.match(technicalLabels);
          if (labelMatch) {
            output = output.replace(technicalLabels, '').trim();
            changed = true;
          }
          
          // 3. Remove stray fences
          const fenceMatch = output.match(codeFences);
          if (fenceMatch) {
            output = output.replace(codeFences, '').trim();
            changed = true;
          }

          if (changed) return deepScrub(output);
          return output;
        };

        result = deepScrub(result);
        setProposal({ content: result });
      }
    } catch (e) {
      console.error("AI Action Failed:", e);
    } finally {
      setIsProcessing(false);
      setActiveTool(null);
      editor.commands.setAIProcessingRange(null);
    }
  };

  const handleAccept = async () => {
    if (!proposal) return;

    // Retrieve the CURRENT mapped range from the decoration plugin
    const state = editor.state;
    const pluginState = editor.view.state.plugins.find(p => p.key.startsWith('intelligenceOverlay'))?.getState(state);
    
    let targetRange = proposalRange;
    if (pluginState?.processingSet) {
      const found = pluginState.processingSet.find();
      if (found.length > 0) {
        targetRange = { from: found[0].from, to: found[0].to };
      }
    }

    if (!targetRange) return;

    setIsSparkling(true);
    
    // Apply the galaxy-sweep visual overlay (Purely Visual)
    editor.commands.setAISweepRange(targetRange);

    // The sweep animation duration is 1.2s. Replace at peak.
    await new Promise(r => setTimeout(r, 900));

    editor.chain()
      .focus()
      .insertContentAt(targetRange, proposal.content)
      .run();

    setIsSparkling(false);
    setProposal(null);
    setProposalRange(null);
    editor.commands.setAISweepRange(null);
    editor.commands.setAIProcessingRange(null);
  };

  const handleReject = () => {
    setProposal(null);
    setProposalRange(null);
    editor.commands.setAIProcessingRange(null);
    editor.commands.setAISweepRange(null);
  };

  const pageGap = 40;

  return (
    <div className="flex flex-col items-center gap-0" style={{ width: PAGE_WIDTH }}>
      {Array.from({ length: pageCount }).map((_, pageIndex) => (
        <React.Fragment key={pageIndex}>
          {pageIndex > 0 && (
            <div className="w-full flex items-center justify-center" style={{ height: pageGap }}>
              <div className="w-full border-t border-dashed border-white/[0.06]" />
            </div>
          )}
          <div
            className="page-sheet bg-[var(--bg-sheet)] shadow-[0_2px_20px_rgba(0,0,0,0.4)] ring-1 ring-[var(--border-glass)] relative transition-colors duration-300"
            style={{
              width: PAGE_WIDTH,
              minHeight: PAGE_HEIGHT,
              ...(pageIndex > 0 ? { height: PAGE_HEIGHT } : {}),
            }}
          >
            {pageIndex === 0 && (
              <div
                ref={containerRef}
                style={{
                  paddingTop: MARGIN_Y,
                  paddingBottom: MARGIN_Y,
                  paddingLeft: MARGIN_X,
                  paddingRight: MARGIN_X,
                }}
              >
                <div style={{ position: 'relative' }}>
                  <EditorContent editor={editor} className="focus:outline-none" />
                  
                  {/* 1. Selection Writing Tools Menu */}
                  <BubbleMenu 
                    editor={editor} 
                    pluginKey="selectionWritingTools"
                    tippyOptions={{ 
                      appendTo: () => document.body,
                      duration: 150,
                      offset: [0, 10]
                    }}
                    shouldShow={({ editor }) => {
                      const isImageMode = editor.isActive('resizableImage') || (editor.state.selection instanceof NodeSelection && editor.state.selection.node.type.name === 'resizableImage');
                      return !editor.state.selection.empty && !isImageMode && !isProcessing && !proposal;
                    }}
                  >
                    <LiquidGlassMenu
                      onAction={(action, prompt) => performAIAction(action, prompt)}
                      isProcessing={isProcessing}
                    />
                  </BubbleMenu>


                  {/* 2. AI Review & Accept Menu */}
                  <BubbleMenu 
                    editor={editor}
                    pluginKey="aiReviewMenu"
                    shouldShow={() => !!proposal && !isSparkling}
                    tippyOptions={{ 
                      appendTo: () => document.body, 
                      placement: 'top', 
                      duration: 250,
                      offset: [0, 15]
                    }}
                  >
                    <div className="review-bubble flex-col !items-stretch !p-0 min-w-[420px] max-w-[500px] overflow-hidden">
                      <div className="flex items-center justify-between p-3 bg-white/[0.02] border-b border-white/5">
                        <div className="flex items-center gap-2 pl-1">
                          <Sparkles size={14} className="text-accent" />
                          <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">Suggested Revision</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={handleAccept} className="review-btn-accept !py-1.5 !px-4 hover:scale-105 active:scale-95 shadow-lg shadow-accent/20">
                            <Check size={14} /> Keep it
                          </button>
                          <button onClick={handleReject} className="review-btn-reject hover:bg-white/10 transition-colors rounded-lg p-1.5 ml-1">
                            <X size={14} /> 
                          </button>
                        </div>
                      </div>
                      
                      <div className="bg-black/20 p-4 max-h-[400px] overflow-y-auto preview-area custom-scrollbar selection:bg-accent/30 shadow-inner">
                        <div 
                          className="prose-mini text-[13px] leading-relaxed text-[var(--text-secondary)] text-left select-text"
                          dangerouslySetInnerHTML={{ __html: proposal?.content || '' }}
                        />
                      </div>
                    </div>
                  </BubbleMenu>
                </div>
              </div>
            )}

            <div className="absolute bottom-5 left-0 right-0 text-center text-[11px] text-[var(--text-muted)] select-none pointer-events-none">
              {pageIndex + 1}
            </div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
