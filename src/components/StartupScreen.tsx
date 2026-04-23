import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  XCircle, 
  RefreshCw, 
  ArrowRight,
  Globe,
  Database,
  Cloud,
  Settings,
  Activity
} from 'lucide-react';

interface AIConfig {
    provider: 'lmstudio' | 'ollama' | 'openai' | 'custom';
    baseUrl: string;
    apiKey: string;
    modelName: string;
    isConfigured: boolean;
}

const PRESETS: Record<string, Partial<AIConfig>> = {
    lmstudio: { baseUrl: 'http://localhost:1234/v1', provider: 'lmstudio' },
    ollama: { baseUrl: 'http://localhost:11434/v1', provider: 'ollama' },
    openai: { baseUrl: 'https://api.openai.com/v1', provider: 'openai' },
    custom: { baseUrl: '', provider: 'custom' }
};

interface StartupScreenProps {
  onComplete: () => void;
}

export default function StartupScreen({ onComplete }: StartupScreenProps) {
  const [stage, setStage] = useState<'checking' | 'setup' | 'verifying' | 'failed'>('checking');
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [status, setStatus] = useState('Checking system status...');
  const [progress, setProgress] = useState(10);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkConfig();
  }, []);

  const checkConfig = async () => {
    try {
      if (!(window as any).api?.getAIConfig) {
        setTimeout(checkConfig, 100);
        return;
      }

      const savedConfig = await (window as any).api.getAIConfig();
      setConfig(savedConfig);
      
      if (!savedConfig.isConfigured) {
        setStage('setup');
      } else {
        verifyConnection(savedConfig);
      }
    } catch (err) {
      setError('Failed to load application manifest.');
      setStage('failed');
    }
  };

  const verifyConnection = async (targetConfig: AIConfig) => {
    setStage('verifying');
    setStatus(`Verifying ${targetConfig.provider}...`);
    setProgress(30);
    
    const timer = setInterval(() => {
        setProgress(p => p < 90 ? p + 5 : p);
    }, 150);

    const isAlive = await (window as any).api.testAIConnection(targetConfig);
    clearInterval(timer);

    if (isAlive) {
      setProgress(100);
      setStatus('Ready');
      setTimeout(() => onComplete(), 400);
    } else {
      setError(`Unable to connect to ${targetConfig.provider.toUpperCase()} at ${targetConfig.baseUrl}. Ensure the service is running.`);
      setStage('failed');
    }
  };

  const handleProviderSelect = (p: string) => {
    if (!config) return;
    const preset = PRESETS[p];
    setConfig({
        ...config,
        ...preset,
        provider: p as any
    });
  };

  const handleSave = async () => {
    if (!config) return;
    const updated = { ...config, isConfigured: true };
    await (window as any).api.saveAIConfig(updated);
    verifyConnection(updated);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--bg-app)] select-none font-sans"
    >
      <div className="w-[420px] flex flex-col items-center">
        {/* Minimalist Logo - No Box */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-12"
        >
          <img src="./logo.png" alt="Seam" className="w-16 h-16 brightness-110 drop-shadow-lg" />
        </motion.div>

        <AnimatePresence mode="wait">
          {stage === 'setup' && (
            <motion.div 
              key="setup"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full flex flex-col gap-6"
            >
              <div className="text-center">
                <h2 className="text-xl font-medium text-[var(--text-main)] mb-1">AI Configuration</h2>
                <p className="text-[var(--text-muted)] text-[13px]">Select a provider to interface with Seam.</p>
              </div>

              {/* Liquid Glass Card */}
              <div className="liquid-glass rounded-[28px] p-8 shadow-2xl">
                <div className="grid grid-cols-2 gap-2.5 mb-8">
                  {[
                    { id: 'lmstudio', label: 'LM Studio', icon: Database },
                    { id: 'ollama', label: 'Ollama', icon: Activity },
                    { id: 'openai', label: 'OpenAI', icon: Cloud },
                    { id: 'custom', label: 'Custom', icon: Settings }
                  ].map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleProviderSelect(p.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-all border ${
                        config?.provider === p.id 
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)]' 
                          : 'bg-white/[0.04] border-white/5 text-[var(--text-muted)] hover:bg-white/[0.08] hover:text-[var(--text-secondary)]'
                      }`}
                    >
                      <p.icon size={15} strokeWidth={2.5} />
                      <span className="text-[12px] font-semibold">{p.label}</span>
                    </button>
                  ))}
                </div>

                <div className="space-y-5 mb-8">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold ml-1 block">Endpoint URL</label>
                    <input 
                      type="text" 
                      value={config?.baseUrl || ''} 
                      onChange={(e) => setConfig(prev => prev ? {...prev, baseUrl: e.target.value} : null)}
                      className="w-full bg-black/10 border border-white/5 rounded-xl px-4 py-3.5 text-xs focus:outline-none focus:border-[var(--accent)]/50 transition-all text-[var(--text-secondary)]"
                      placeholder="http://localhost:1234/v1"
                    />
                  </div>
                  
                  <AnimatePresence>
                    {(config?.provider === 'openai' || config?.provider === 'custom') && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }} 
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-2 overflow-hidden"
                      >
                        <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold ml-1 block">API Key</label>
                        <input 
                          type="password" 
                          value={config?.apiKey || ''} 
                          onChange={(e) => setConfig(prev => prev ? {...prev, apiKey: e.target.value} : null)}
                          className="w-full bg-black/10 border border-white/5 rounded-xl px-4 py-3.5 text-xs focus:outline-none focus:border-[var(--accent)]/50 transition-all text-[var(--text-secondary)]"
                          placeholder="sk-..."
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button 
                  onClick={handleSave}
                  className="w-full bg-[var(--accent)] hover:brightness-110 text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 transition-all"
                >
                  Confirm
                  <ArrowRight size={18} />
                </button>
              </div>
            </motion.div>
          )}

          {(stage === 'checking' || stage === 'verifying') && (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center w-full px-16"
            >
              <div className="flex items-center justify-center gap-3 text-[var(--text-muted)] text-[11px] uppercase tracking-widest mb-6 font-bold">
                 <RefreshCw size={12} className="animate-spin opacity-40" />
                 {status}
              </div>
              
              <div className="w-full h-[3px] bg-white/[0.05] rounded-full overflow-hidden relative">
                <motion.div 
                  initial={{ width: "0%" }}
                  animate={{ width: `${progress}%` }}
                  className="absolute inset-y-0 left-0 bg-[var(--accent)]"
                />
              </div>
            </motion.div>
          )}

          {stage === 'failed' && (
             <motion.div 
                key="failed"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full"
             >
                <div className="liquid-glass border-red-500/20 rounded-[32px] p-10 text-center">
                  <XCircle size={28} className="text-red-500/60 mx-auto mb-4" />
                  <h2 className="text-lg font-medium text-[var(--text-main)] mb-2">Connection Failed</h2>
                  <p className="text-[var(--text-muted)] text-sm leading-relaxed mb-10 px-4">
                    {error}
                  </p>
                  
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setStage('setup')}
                      className="flex-1 bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 py-3 rounded-xl text-xs font-semibold transition-all px-4"
                    >
                      Settings
                    </button>
                    <button 
                      onClick={() => config && verifyConnection(config)}
                      className="flex-1 bg-[var(--accent)] hover:brightness-110 py-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2"
                    >
                      <RefreshCw size={14} />
                      Retry
                    </button>
                  </div>
                </div>
             </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}




