'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Check,
  Globe,
  Home,
  Server,
  ChevronDown,
  AlertTriangle,
  Info,
  Copy,
  Loader2,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { cn, buildWebSocketUrl, stripProtocol } from '@/lib/utils';

interface AgentConnectionSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (url: string) => void;
  onDisconnect?: () => void;
  /** Whether there's an existing connection that can be disconnected */
  hasConnection?: boolean;
}

type ConnectionType = 'local' | 'remote' | null;
type RemoteMethod = 'tailscale' | 'custom';
type TestState = 'idle' | 'testing' | 'success' | 'error';

// Slide-over animation
const slideVariants = {
  hidden: { x: '100%' },
  visible: { x: 0, transition: { type: 'spring', damping: 30, stiffness: 300 } },
  exit: { x: '100%', transition: { duration: 0.2, ease: 'easeIn' } },
};

// Step transition animation
const stepVariants = {
  enter: { x: 50, opacity: 0 },
  center: { x: 0, opacity: 1, transition: { duration: 0.3 } },
  exit: { x: -50, opacity: 0, transition: { duration: 0.2 } },
};

// Confetti component for success celebration
function Confetti() {
  const colors = ['#f97316', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    color: colors[i % colors.length],
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    size: Math.random() * 8 + 4,
  }));

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            backgroundColor: p.color,
            left: `${p.left}%`,
            top: -20,
            width: p.size,
            height: p.size,
          }}
          initial={{ y: -20, opacity: 1, rotate: 0 }}
          animate={{
            y: '100vh',
            opacity: 0,
            rotate: 720,
          }}
          transition={{
            duration: 2,
            delay: p.delay,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
}

// Step indicator component
function StepIndicator({ currentStep }: { currentStep: 1 | 2 }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
          currentStep >= 1 ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/40'
        )}
      >
        1
      </div>
      <div
        className={cn(
          'h-0.5 w-12 rounded-full transition-colors',
          currentStep >= 2 ? 'bg-orange-500' : 'bg-white/10'
        )}
      />
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
          currentStep >= 2 ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/40'
        )}
      >
        2
      </div>
    </div>
  );
}

// Connection type card
function ConnectionTypeCard({
  icon: Icon,
  title,
  description,
  badge,
  badgeColor,
  selected,
  onClick,
}: {
  icon: typeof Home;
  title: string;
  description: string;
  badge: string;
  badgeColor: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex w-full items-start gap-4 rounded-2xl border p-5 text-left transition-all',
        selected
          ? 'border-orange-500/50 bg-orange-500/10 ring-2 ring-orange-500/20'
          : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
      )}
    >
      <div
        className={cn(
          'rounded-xl p-3 transition-all',
          selected
            ? 'bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/20'
            : 'bg-white/10'
        )}
      >
        <Icon className={cn('h-6 w-6', selected ? 'text-white' : 'text-white/60')} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <h3 className="font-semibold text-white">{title}</h3>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
              badgeColor
            )}
          >
            {badge}
          </span>
        </div>
        <p className="text-sm text-white/50">{description}</p>
      </div>
    </button>
  );
}

// Tailscale guide accordion
function TailscaleGuide() {
  const [expanded, setExpanded] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const steps = [
    { label: 'Install Tailscale', command: 'brew install tailscale' },
    { label: 'Login to your tailnet', command: 'tailscale up' },
    { label: 'Enable Funnel', command: 'tailscale funnel --bg --https=4678 localhost:4678' },
    { label: 'Get your URL', command: 'tailscale funnel status' },
  ];

  return (
    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-blue-400">
          <Info className="h-4 w-4" />
          <span>Setup Tailscale Funnel</span>
        </div>
        <ChevronDown
          className={cn('h-4 w-4 text-blue-400 transition-transform', expanded && 'rotate-180')}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-blue-500/10 p-4 pt-3">
              {steps.map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-[10px] font-medium text-blue-400">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 text-xs text-white/60">{step.label}</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 truncate rounded bg-white/5 px-2 py-1 font-mono text-xs text-white/80">
                        {step.command}
                      </code>
                      <button
                        onClick={() => copyToClipboard(step.command)}
                        className="rounded p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AgentConnectionSettings({
  open,
  onOpenChange,
  onSave,
  onDisconnect,
  hasConnection = false,
}: AgentConnectionSettingsProps) {
  // Step state
  const [step, setStep] = useState<1 | 2>(1);
  const [connectionType, setConnectionType] = useState<ConnectionType>(null);
  const [remoteMethod, setRemoteMethod] = useState<RemoteMethod>('tailscale');

  // Input state
  const [localhostPort, setLocalhostPort] = useState('4678');
  const [customUrl, setCustomUrl] = useState('');

  // Connection testing
  const [testState, setTestState] = useState<TestState>('idle');
  const [showSuccess, setShowSuccess] = useState(false);

  // Load existing connection from localStorage on mount
  useEffect(() => {
    if (open) {
      const existing = localStorage.getItem('agentUrl');
      if (existing) {
        if (existing.startsWith('localhost:')) {
          setConnectionType('local');
          const port = existing.split(':')[1] || '4678';
          setLocalhostPort(port);
        } else {
          setConnectionType('remote');
          setCustomUrl(existing);
        }
        setStep(2);
      } else {
        // Reset for new connection
        setStep(1);
        setConnectionType(null);
        setLocalhostPort('4678');
        setCustomUrl('');
        setTestState('idle');
      }
    }
  }, [open]);

  // Get the current URL based on state
  const getCurrentUrl = useCallback(() => {
    if (connectionType === 'local') {
      return `localhost:${localhostPort}`;
    }
    return customUrl;
  }, [connectionType, localhostPort, customUrl]);

  // Test connection
  const handleTest = async () => {
    const url = getCurrentUrl();
    if (!url) return;

    setTestState('testing');

    try {
      const wsUrl = buildWebSocketUrl(url, '/terminal?project=test&session=test-connection');
      const ws = new WebSocket(wsUrl);

      const timeout = setTimeout(() => {
        ws.close();
        setTestState('error');
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        setTestState('success');
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        setTestState('error');
      };
    } catch {
      setTestState('error');
    }
  };

  // Save connection - only calls callback, parent handles persistence
  const handleSave = () => {
    let url = getCurrentUrl();
    if (!url) return;

    // Strip protocol prefix if user entered one (https://, wss://, etc.)
    url = stripProtocol(url);

    setShowSuccess(true);

    setTimeout(() => {
      setShowSuccess(false);
      onSave?.(url);
      onOpenChange(false);
    }, 1500);
  };

  // Handle disconnect - only calls callback, parent handles persistence
  const handleDisconnect = () => {
    onDisconnect?.();
    onOpenChange(false);
  };

  // Handle type selection and advance to step 2
  const handleTypeSelect = (type: ConnectionType) => {
    setConnectionType(type);
    setStep(2);
    setTestState('idle');
  };

  // Go back to step 1
  const handleBack = () => {
    setStep(1);
    setTestState('idle');
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
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />

          {/* Slide-over panel */}
          <motion.div
            variants={slideVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-[#0a0a10] shadow-2xl sm:max-w-md"
          >
            {/* Success celebration overlay */}
            <AnimatePresence>
              {showSuccess && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0a10]"
                >
                  <Confetti />

                  <motion.div
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{
                      type: 'spring',
                      damping: 15,
                      stiffness: 200,
                      delay: 0.1,
                    }}
                    className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-500 shadow-lg shadow-emerald-500/30"
                  >
                    <Check className="h-12 w-12 text-white" />
                  </motion.div>

                  <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mb-2 text-2xl font-bold text-white"
                  >
                    Connected!
                  </motion.h2>

                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-white/50"
                  >
                    {getCurrentUrl()}
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
              <div className="flex items-center gap-4">
                {step === 2 && (
                  <button
                    onClick={handleBack}
                    className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                )}
                <div>
                  <h2 className="text-lg font-semibold text-white">Connect Agent</h2>
                  <p className="text-sm text-white/40">
                    {step === 1 ? 'Choose connection type' : 'Configure your connection'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <StepIndicator currentStep={step} />
                <button
                  onClick={() => onOpenChange(false)}
                  className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div
                    key="step1"
                    variants={stepVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="space-y-4 p-6"
                  >
                    <p className="mb-6 text-white/60">How will you connect to your agent?</p>

                    <ConnectionTypeCard
                      icon={Home}
                      title="Same Computer"
                      description="Agent running on this device"
                      badge="Safest"
                      badgeColor="bg-emerald-500/20 text-emerald-400"
                      selected={connectionType === 'local'}
                      onClick={() => handleTypeSelect('local')}
                    />

                    <ConnectionTypeCard
                      icon={Globe}
                      title="Remote Access"
                      description="Connect from anywhere via tunnel"
                      badge="Secure"
                      badgeColor="bg-blue-500/20 text-blue-400"
                      selected={connectionType === 'remote'}
                      onClick={() => handleTypeSelect('remote')}
                    />

                    {/* Pairing code divider */}
                    <div className="flex items-center gap-3 pt-4">
                      <div className="h-px flex-1 bg-white/10" />
                      <span className="text-xs text-white/40">or</span>
                      <div className="h-px flex-1 bg-white/10" />
                    </div>

                    {/* Pairing code input */}
                    <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4">
                      <p className="mb-3 text-sm font-medium text-purple-400">
                        Have a pairing code?
                      </p>
                      <p className="mb-4 text-xs text-white/50">
                        Enter the 6-digit code shown on your agent&apos;s pairing page
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="000000"
                          maxLength={6}
                          className={cn(
                            'flex-1 rounded-lg px-4 py-2.5',
                            'border border-white/10 bg-white/5',
                            'text-center font-mono text-lg tracking-widest text-white placeholder:text-white/30',
                            'focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20'
                          )}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const input = e.target as HTMLInputElement;
                              if (input.value.length === 6) {
                                window.location.href = `/connect?code=${input.value}`;
                              }
                            }
                          }}
                          onChange={(e) => {
                            // Only allow digits
                            e.target.value = e.target.value.replace(/\D/g, '');
                          }}
                        />
                        <button
                          onClick={(e) => {
                            const input = (e.target as HTMLElement)
                              .closest('div')
                              ?.querySelector('input') as HTMLInputElement;
                            if (input?.value.length === 6) {
                              window.location.href = `/connect?code=${input.value}`;
                            }
                          }}
                          className={cn(
                            'rounded-lg px-4 py-2.5',
                            'bg-purple-500/20 text-purple-400',
                            'transition-colors hover:bg-purple-500/30'
                          )}
                        >
                          Pair
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 2 && connectionType === 'local' && (
                  <motion.div
                    key="step2-local"
                    variants={stepVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="space-y-6 p-6"
                  >
                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/70">
                        Agent Port
                      </label>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-white/50">localhost:</span>
                        <input
                          type="text"
                          value={localhostPort}
                          onChange={(e) => setLocalhostPort(e.target.value.replace(/\D/g, ''))}
                          placeholder="4678"
                          className={cn(
                            'w-24 rounded-xl px-4 py-2.5',
                            'border border-white/10 bg-white/5',
                            'text-white placeholder:text-white/30',
                            'focus:border-orange-500/50 focus:outline-none focus:ring-2 focus:ring-orange-500/20',
                            'font-mono text-lg'
                          )}
                        />
                      </div>
                    </div>

                    {/* Quick port buttons */}
                    <div>
                      <label className="mb-2 block text-xs text-white/40">Quick select</label>
                      <div className="flex gap-2">
                        {['4678', '4679', '4680'].map((port) => (
                          <button
                            key={port}
                            onClick={() => setLocalhostPort(port)}
                            className={cn(
                              'rounded-lg px-4 py-2 font-mono text-sm transition-all',
                              localhostPort === port
                                ? 'border border-orange-500/30 bg-orange-500/20 text-orange-400'
                                : 'border border-white/10 bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
                            )}
                          >
                            {port}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Current URL display */}
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Server className="h-4 w-4 text-emerald-400" />
                        <span className="font-mono text-emerald-400">{getCurrentUrl()}</span>
                      </div>
                    </div>

                    {/* Test result */}
                    <AnimatePresence>
                      {testState !== 'idle' && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className={cn(
                            'flex items-center gap-2 rounded-xl px-4 py-3 text-sm',
                            testState === 'testing' && 'bg-white/5 text-white/60',
                            testState === 'success' && 'bg-emerald-500/20 text-emerald-400',
                            testState === 'error' && 'bg-red-500/20 text-red-400'
                          )}
                        >
                          {testState === 'testing' && (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Testing connection...</span>
                            </>
                          )}
                          {testState === 'success' && (
                            <>
                              <Check className="h-4 w-4" />
                              <span>Connection successful!</span>
                            </>
                          )}
                          {testState === 'error' && (
                            <>
                              <AlertTriangle className="h-4 w-4" />
                              <span>Could not connect. Is the agent running?</span>
                            </>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {step === 2 && connectionType === 'remote' && (
                  <motion.div
                    key="step2-remote"
                    variants={stepVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="space-y-6 p-6"
                  >
                    {/* Remote method tabs */}
                    <div className="flex gap-2 rounded-xl bg-white/5 p-1">
                      <button
                        onClick={() => setRemoteMethod('tailscale')}
                        className={cn(
                          'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                          remoteMethod === 'tailscale'
                            ? 'bg-white/10 text-white'
                            : 'text-white/50 hover:text-white/70'
                        )}
                      >
                        Tailscale Funnel
                      </button>
                      <button
                        onClick={() => setRemoteMethod('custom')}
                        className={cn(
                          'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                          remoteMethod === 'custom'
                            ? 'bg-white/10 text-white'
                            : 'text-white/50 hover:text-white/70'
                        )}
                      >
                        Custom URL
                      </button>
                    </div>

                    {/* URL input */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/70">
                        Agent URL
                      </label>
                      <input
                        type="text"
                        value={customUrl}
                        onChange={(e) => setCustomUrl(e.target.value)}
                        placeholder={
                          remoteMethod === 'tailscale'
                            ? 'machine.tailnet.ts.net'
                            : '192.168.1.100:4678'
                        }
                        className={cn(
                          'w-full rounded-xl px-4 py-3',
                          'border border-white/10 bg-white/5',
                          'text-white placeholder:text-white/30',
                          'focus:border-orange-500/50 focus:outline-none focus:ring-2 focus:ring-orange-500/20',
                          'font-mono'
                        )}
                      />
                    </div>

                    {/* Tailscale guide */}
                    {remoteMethod === 'tailscale' && <TailscaleGuide />}

                    {/* Security warning for custom URLs */}
                    {remoteMethod === 'custom' && (
                      <div className="flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
                        <div className="text-sm">
                          <p className="mb-1 font-medium text-amber-400">Security Warning</p>
                          <p className="text-white/50">
                            Custom URLs may expose your agent to the internet. Ensure you have
                            proper authentication in place.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Test result */}
                    <AnimatePresence>
                      {testState !== 'idle' && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className={cn(
                            'flex items-center gap-2 rounded-xl px-4 py-3 text-sm',
                            testState === 'testing' && 'bg-white/5 text-white/60',
                            testState === 'success' && 'bg-emerald-500/20 text-emerald-400',
                            testState === 'error' && 'bg-red-500/20 text-red-400'
                          )}
                        >
                          {testState === 'testing' && (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Testing connection...</span>
                            </>
                          )}
                          {testState === 'success' && (
                            <>
                              <Check className="h-4 w-4" />
                              <span>Connection successful!</span>
                            </>
                          )}
                          {testState === 'error' && (
                            <>
                              <AlertTriangle className="h-4 w-4" />
                              <span>Could not connect. Check your URL and try again.</span>
                            </>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            {step === 2 && (
              <div className="flex shrink-0 flex-col gap-3 border-t border-white/5 bg-white/[0.02] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <div className="flex gap-3">
                  <button
                    onClick={handleTest}
                    disabled={testState === 'testing' || !getCurrentUrl()}
                    className={cn(
                      'flex-1 rounded-xl px-4 py-3 text-sm font-medium transition-all',
                      testState === 'testing'
                        ? 'cursor-wait bg-white/5 text-white/30'
                        : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                    )}
                  >
                    {testState === 'testing' ? 'Testing...' : 'Test Connection'}
                  </button>

                  <button
                    onClick={handleSave}
                    disabled={!getCurrentUrl()}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all',
                      'bg-gradient-to-r from-orange-500 to-amber-500 text-white',
                      'hover:shadow-lg hover:shadow-orange-500/20',
                      !getCurrentUrl() && 'cursor-not-allowed opacity-50'
                    )}
                  >
                    <Sparkles className="h-4 w-4" />
                    Connect
                  </button>
                </div>

                {hasConnection ? (
                  <button
                    onClick={handleDisconnect}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-red-400 transition-all hover:bg-red-500/10"
                  >
                    Disconnect Current Agent
                  </button>
                ) : (
                  <p className="text-center text-xs text-white/30">
                    Connection saved locally in your browser
                  </p>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
