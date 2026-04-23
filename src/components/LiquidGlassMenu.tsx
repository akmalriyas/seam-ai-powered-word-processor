import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, Wand2, Check, List, ArrowRight, Minus, Plus } from 'lucide-react';

interface LiquidGlassMenuProps {
  onAction: (action: string, prompt?: string) => void;
  isProcessing: boolean;
}

export default function LiquidGlassMenu({ onAction, isProcessing }: LiquidGlassMenuProps) {
  const [customPrompt, setCustomPrompt] = useState('');

  const submitCustom = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && customPrompt.trim()) {
      onAction('CUSTOM', customPrompt);
      setCustomPrompt('');
    }
  };

  const actions = [
    { id: 'IMPROVE_FLOW', label: 'Improve Flow', icon: Wand2, color: 'text-accent' },
    { id: 'FIX_GRAMMAR', label: 'Fix Grammar', icon: Check, color: 'text-green-400' },
    { id: 'SUMMARIZE', label: 'Summarize', icon: List, color: 'text-blue-400' },
    { id: 'SIMPLIFY', label: 'Simplify', icon: Minus, color: 'text-orange-400' },
    { id: 'EXPAND', label: 'Expand & Elaborate', icon: Plus, color: 'text-purple-400' },
  ];

  return (
    <AnimatePresence mode="wait">
      {isProcessing ? (
        <motion.div 
          key="processing"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="liquid-glass rounded-xl p-4 flex items-center justify-center gap-3 text-[var(--text-main)] text-sm transition-colors duration-300 min-w-[220px]"
        >
          <Loader2 className="animate-spin text-accent" size={18} />
          <span className="font-medium tracking-wide">Seam AI processing...</span>
        </motion.div>
      ) : (
        <motion.div 
          key="menu"
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 10 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="liquid-glass rounded-2xl p-1.5 min-w-[240px] flex flex-col gap-0.5 text-[13px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative transition-colors duration-300 border border-white/10"
        >
          <div className="flex flex-col gap-0.5 p-1">
            {actions.map((action) => (
              <button 
                key={action.id}
                onClick={() => onAction(action.id)}
                className="flex items-center gap-2.5 text-left w-full px-3 py-2 text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-main)] rounded-xl transition-all cursor-pointer group"
              >
                <action.icon size={14} className={`${action.color} opacity-80 group-hover:opacity-100 transition-opacity`}/>
                <span className="font-medium">{action.label}</span>
              </button>
            ))}
          </div>
          
          <div className="h-[1px] bg-white/5 mx-2 my-1"></div>
          
          <div className="p-2 pt-1">
            <div className="relative group">
              <Sparkles size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-accent opacity-50 group-focus-within:opacity-100 transition-opacity" />
              <input 
                type="text" 
                placeholder="Custom Seam AI Prompt..." 
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                onKeyDown={submitCustom}
                className="w-full bg-black/20 border border-white/5 rounded-xl pl-8 pr-3 py-2.5 text-[12px] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-accent/50 transition-all shadow-inner"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
