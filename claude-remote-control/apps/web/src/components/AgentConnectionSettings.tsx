'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Wifi, Globe, Home, Server, ChevronRight, AlertCircle, Info } from 'lucide-react';
import { cn, buildWebSocketUrl } from '@/lib/utils';

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
  const [localhostPort, setLocalhostPort] = useState('4678');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [saved, setSaved] = useState(false);

  // Load existing connection on mount
  useEffect(() => {
    const existing = loadAgentConnection();
    if (existing) {
      setSelectedMethod(existing.method);
      if (existing.method === 'localhost') {
        // Extract port from URL (e.g., "localhost:4679" -> "4679")
        const port = existing.url.split(':')[1] || '4678';
        setLocalhostPort(port);
      } else {
        setCustomUrl(existing.url);
      }
    }
  }, []);

  const currentPreset = PRESETS.find((p) => p.id === selectedMethod);
  const displayUrl = selectedMethod === 'localhost' ? `localhost:${localhostPort}` : customUrl;

  const handleTest = async () => {
    if (!displayUrl) return;

    setTesting(true);
    setTestResult(null);

    try {
      const wsUrl = buildWebSocketUrl(displayUrl, '/terminal?project=test&session=test-connection');

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
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md"
            onClick={() => onOpenChange(false)}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#0a0a10] shadow-2xl ring-1 ring-white/10 sm:max-w-lg sm:rounded-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">Connect Your Agent</h2>
                  <p className="text-sm text-white/40">Choose how to connect to your local agent</p>
                </div>
                <button
                  onClick={() => onOpenChange(false)}
                  className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Presets - scrollable on mobile */}
              <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
                <div className="grid gap-3">
                  {PRESETS.map((preset) => {
                    const Icon = preset.icon;
                    const isSelected = selectedMethod === preset.id;

                    return (
                      <button
                        key={preset.id}
                        onClick={() => setSelectedMethod(preset.id)}
                        className={cn(
                          'flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all',
                          isSelected
                            ? 'border-orange-500/30 bg-orange-500/10'
                            : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                        )}
                      >
                        <div
                          className={cn(
                            'rounded-xl bg-gradient-to-br p-3',
                            preset.color,
                            isSelected ? 'shadow-lg' : 'opacity-70 shadow-md'
                          )}
                        >
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-white">{preset.name}</h3>
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[10px] font-medium',
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
                            'h-5 w-5 transition-transform',
                            isSelected ? 'rotate-90 text-orange-400' : 'text-white/20'
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
                          'flex-1 rounded-xl px-4 py-2.5',
                          'border border-white/10 bg-white/5',
                          'text-white placeholder:text-white/30',
                          'focus:border-orange-500/50 focus:outline-none focus:ring-2 focus:ring-orange-500/20',
                          'font-mono text-sm'
                        )}
                      />
                      <button
                        onClick={handleTest}
                        disabled={testing || !displayUrl}
                        className={cn(
                          'rounded-xl px-4 py-2.5 text-sm font-medium transition-all',
                          testing
                            ? 'cursor-wait bg-white/5 text-white/30'
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
                          'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
                          testResult === 'success'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-red-500/20 text-red-400'
                        )}
                      >
                        {testResult === 'success' ? (
                          <>
                            <Check className="h-4 w-4" />
                            <span>Connection successful!</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-4 w-4" />
                            <span>Could not connect to agent</span>
                          </>
                        )}
                      </motion.div>
                    )}

                    {/* Help text for Tailscale */}
                    {selectedMethod === 'tailscale' && (
                      <div className="flex gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
                        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-400" />
                        <div className="text-sm text-blue-300/80">
                          <p className="mb-1 font-medium">Setup Tailscale Funnel:</p>
                          <ol className="list-inside list-decimal space-y-1 text-white/60">
                            <li>
                              Install:{' '}
                              <code className="rounded bg-white/10 px-1 py-0.5">
                                brew install tailscale
                              </code>
                            </li>
                            <li>
                              Login:{' '}
                              <code className="rounded bg-white/10 px-1 py-0.5">tailscale up</code>
                            </li>
                            <li>
                              Enable:{' '}
                              <code className="rounded bg-white/10 px-1 py-0.5">
                                tailscale funnel --bg --https=4678
                              </code>
                            </li>
                            <li>
                              Find your URL at{' '}
                              <code className="rounded bg-white/10 px-1 py-0.5">
                                tailscale funnel --json
                              </code>
                            </li>
                          </ol>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Localhost Port Input */}
                {selectedMethod === 'localhost' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3"
                  >
                    <label className="text-sm font-medium text-white/70">Port</label>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-white/50">localhost:</span>
                      <input
                        type="text"
                        value={localhostPort}
                        onChange={(e) => setLocalhostPort(e.target.value.replace(/\D/g, ''))}
                        placeholder="4678"
                        className={cn(
                          'w-24 rounded-xl px-3 py-2',
                          'border border-white/10 bg-white/5',
                          'text-white placeholder:text-white/30',
                          'focus:border-orange-500/50 focus:outline-none focus:ring-2 focus:ring-orange-500/20',
                          'font-mono text-sm'
                        )}
                      />
                      <button
                        onClick={handleTest}
                        disabled={testing || !localhostPort}
                        className={cn(
                          'rounded-xl px-4 py-2 text-sm font-medium transition-all',
                          testing
                            ? 'cursor-wait bg-white/5 text-white/30'
                            : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                        )}
                      >
                        {testing ? 'Testing...' : 'Test'}
                      </button>
                    </div>

                    {/* Quick port buttons */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/40">Quick select:</span>
                      {['4678', '4679', '4680'].map((port) => (
                        <button
                          key={port}
                          onClick={() => setLocalhostPort(port)}
                          className={cn(
                            'rounded-lg px-2 py-1 font-mono text-xs transition-all',
                            localhostPort === port
                              ? 'border border-orange-500/30 bg-orange-500/20 text-orange-400'
                              : 'border border-white/10 bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
                          )}
                        >
                          {port}
                        </button>
                      ))}
                    </div>

                    {/* Test Result */}
                    {testResult && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
                          testResult === 'success'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-red-500/20 text-red-400'
                        )}
                      >
                        {testResult === 'success' ? (
                          <>
                            <Check className="h-4 w-4" />
                            <span>Connection successful!</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-4 w-4" />
                            <span>Could not connect to agent</span>
                          </>
                        )}
                      </motion.div>
                    )}

                    {/* Current URL Display */}
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
                      <div className="flex items-center gap-2 text-sm text-emerald-400">
                        <Server className="h-4 w-4" />
                        <span className="font-mono">{displayUrl}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Footer - safe area for iOS */}
              <div className="flex shrink-0 flex-col gap-3 border-t border-white/5 bg-white/5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:pb-4">
                <p className="hidden text-xs text-white/30 sm:block">
                  Connection saved locally in your browser
                </p>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
                  <button
                    onClick={() => onOpenChange(false)}
                    className="rounded-lg px-4 py-2.5 text-sm font-medium text-white/60 transition-all hover:bg-white/5 hover:text-white sm:py-2"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!displayUrl}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all sm:py-2',
                      saved
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20 hover:from-orange-400 hover:to-amber-400',
                      !displayUrl && 'cursor-not-allowed opacity-50'
                    )}
                  >
                    {saved ? (
                      <>
                        <Check className="h-4 w-4" />
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
