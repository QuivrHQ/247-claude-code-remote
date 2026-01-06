'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Check,
  Wifi,
  Globe,
  Home,
  Server,
  ChevronRight,
  AlertCircle,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'agentConnection';

export interface AgentConnection {
  url: string;
  name?: string;
  method: 'localhost' | 'tailscale' | 'custom';
}

export function loadAgentConnection(): AgentConnection | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function saveAgentConnection(connection: AgentConnection): AgentConnection {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(connection));
  return connection;
}

export function clearAgentConnection(): void {
  localStorage.removeItem(STORAGE_KEY);
}

interface AgentConnectionSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (connection: AgentConnection) => void;
}

const PRESETS = [
  {
    id: 'localhost',
    name: 'Same Computer',
    description: 'Connect to agent running on this computer',
    icon: Home,
    url: 'localhost:4678',
    color: 'from-emerald-500 to-green-500',
    security: 'safe',
    securityLabel: 'Safe (local only)',
  },
  {
    id: 'tailscale',
    name: 'Tailscale Funnel',
    description: 'Secure remote access via Tailscale',
    icon: Wifi,
    url: '', // User needs to provide their Funnel URL
    placeholder: 'machine.tailnet.ts.net',
    color: 'from-blue-500 to-indigo-500',
    security: 'secure',
    securityLabel: 'Best (TLS + auth)',
  },
  {
    id: 'custom',
    name: 'Custom URL',
    description: 'IP address, domain, or tunnel',
    icon: Globe,
    url: '',
    placeholder: '1.2.3.4:4678 or tunnel.domain.com',
    color: 'from-purple-500 to-pink-500',
    security: 'warning',
    securityLabel: 'Add authentication!',
  },
];

export function AgentConnectionSettings({
  open,
  onOpenChange,
  onSave,
}: AgentConnectionSettingsProps) {
  const [selectedMethod, setSelectedMethod] = useState<string>('localhost');
  const [customUrl, setCustomUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [saved, setSaved] = useState(false);

  // Load existing connection on mount
  useEffect(() => {
    const existing = loadAgentConnection();
    if (existing) {
      setSelectedMethod(existing.method);
      if (existing.method !== 'localhost') {
        setCustomUrl(existing.url);
      }
    }
  }, []);

  const currentPreset = PRESETS.find((p) => p.id === selectedMethod);
  const displayUrl = selectedMethod === 'localhost' ? 'localhost:4678' : customUrl;

  const handleTest = async () => {
    if (!displayUrl) return;

    setTesting(true);
    setTestResult(null);

    try {
      const protocol = displayUrl.includes('localhost') ? 'ws' : 'wss';
      const wsUrl = `${protocol}://${displayUrl}/terminal?project=test&session=test-connection`;

      const ws = new WebSocket(wsUrl);
      const timeout = setTimeout(() => {
        ws.close();
        setTestResult('error');
        setTesting(false);
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        setTestResult('success');
        setTesting(false);
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        setTestResult('error');
        setTesting(false);
      };
    } catch {
      setTestResult('error');
      setTesting(false);
    }
  };

  const handleSave = () => {
    if (!displayUrl) return;

    const connection: AgentConnection = {
      url: displayUrl,
      name: currentPreset?.name,
      method: selectedMethod as AgentConnection['method'],
    };

    saveAgentConnection(connection);
    onSave?.(connection);
    setSaved(true);

    setTimeout(() => {
      setSaved(false);
      onOpenChange(false);
    }, 1000);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-40"
            onClick={() => onOpenChange(false)}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg bg-[#0a0a10] border border-white/10 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-white/10"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                <div>
                  <h2 className="text-lg font-semibold text-white">Connect Your Agent</h2>
                  <p className="text-sm text-white/40">Choose how to connect to your local agent</p>
                </div>
                <button
                  onClick={() => onOpenChange(false)}
                  className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Presets */}
              <div className="p-6 space-y-4">
                <div className="grid gap-3">
                  {PRESETS.map((preset) => {
                    const Icon = preset.icon;
                    const isSelected = selectedMethod === preset.id;

                    return (
                      <button
                        key={preset.id}
                        onClick={() => setSelectedMethod(preset.id)}
                        className={cn(
                          'w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left',
                          isSelected
                            ? 'bg-orange-500/10 border-orange-500/30'
                            : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                        )}
                      >
                        <div
                          className={cn(
                            'p-3 rounded-xl bg-gradient-to-br',
                            preset.color,
                            isSelected ? 'shadow-lg' : 'shadow-md opacity-70'
                          )}
                        >
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-white">{preset.name}</h3>
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-full text-[10px] font-medium',
                                preset.security === 'safe'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : preset.security === 'secure'
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'bg-amber-500/20 text-amber-400'
                              )}
                            >
                              {preset.securityLabel}
                            </span>
                          </div>
                          <p className="text-sm text-white/50">{preset.description}</p>
                        </div>
                        <ChevronRight
                          className={cn(
                            'w-5 h-5 transition-transform',
                            isSelected ? 'text-orange-400 rotate-90' : 'text-white/20'
                          )}
                        />
                      </button>
                    );
                  })}
                </div>

                {/* Custom URL Input */}
                {selectedMethod !== 'localhost' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2"
                  >
                    <label className="text-sm font-medium text-white/70">Agent URL</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customUrl}
                        onChange={(e) => setCustomUrl(e.target.value)}
                        placeholder={currentPreset?.placeholder}
                        className={cn(
                          'flex-1 px-4 py-2.5 rounded-xl',
                          'bg-white/5 border border-white/10',
                          'text-white placeholder:text-white/30',
                          'focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20',
                          'font-mono text-sm'
                        )}
                      />
                      <button
                        onClick={handleTest}
                        disabled={testing || !displayUrl}
                        className={cn(
                          'px-4 py-2.5 rounded-xl font-medium text-sm transition-all',
                          testing
                            ? 'bg-white/5 text-white/30 cursor-wait'
                            : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                        )}
                      >
                        {testing ? 'Testing...' : 'Test'}
                      </button>
                    </div>

                    {/* Test Result */}
                    {testResult && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
                          testResult === 'success'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-red-500/20 text-red-400'
                        )}
                      >
                        {testResult === 'success' ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Connection successful!</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4" />
                            <span>Could not connect to agent</span>
                          </>
                        )}
                      </motion.div>
                    )}

                    {/* Help text for Tailscale */}
                    {selectedMethod === 'tailscale' && (
                      <div className="flex gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-300/80">
                          <p className="font-medium mb-1">Setup Tailscale Funnel:</p>
                        <ol className="list-decimal list-inside space-y-1 text-white/60">
                          <li>Install: <code className="px-1 py-0.5 bg-white/10 rounded">brew install tailscale</code></li>
                          <li>Login: <code className="px-1 py-0.5 bg-white/10 rounded">tailscale up</code></li>
                          <li>Enable: <code className="px-1 py-0.5 bg-white/10 rounded">tailscale funnel --bg --https=4678</code></li>
                          <li>Find your URL at <code className="px-1 py-0.5 bg-white/10 rounded">tailscale funnel --json</code></li>
                        </ol>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Current URL Display */}
                {displayUrl && selectedMethod === 'localhost' && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <div className="flex items-center gap-2 text-sm text-emerald-400">
                      <Server className="w-4 h-4" />
                      <span className="font-mono">{displayUrl}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-white/5 bg-white/5">
                <p className="text-xs text-white/30">
                  Connection saved locally in your browser
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => onOpenChange(false)}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!displayUrl}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                      saved
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white shadow-lg shadow-orange-500/20',
                      !displayUrl && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {saved ? (
                      <>
                        <Check className="w-4 h-4" />
                        Saved!
                      </>
                    ) : (
                      'Save Connection'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
