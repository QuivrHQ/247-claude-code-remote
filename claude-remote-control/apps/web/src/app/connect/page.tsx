'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, AlertTriangle, Server, Sparkles, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { authClient } from '@/lib/auth-client';

interface AgentInfo {
  machineId: string;
  machineName: string;
  agentUrl: string;
  valid: boolean;
  error?: string;
}

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

function ConnectContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [status, setStatus] = useState<'loading' | 'ready' | 'connecting' | 'success' | 'error'>(
    'loading'
  );
  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const token = searchParams.get('token');
  const code = searchParams.get('code');

  // Check authentication status on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const session = await authClient.getSession();
        setIsAuthenticated(!!session?.data?.user);
      } catch {
        setIsAuthenticated(false);
      }
    }
    checkAuth();
  }, []);

  // Validate token or code on mount
  useEffect(() => {
    async function validatePairing() {
      if (!token && !code) {
        setStatus('error');
        setErrorMessage('No pairing token or code provided');
        return;
      }

      try {
        const res = await fetch('/api/pair/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, code }),
        });

        const data = await res.json();

        if (!res.ok || !data.valid) {
          setStatus('error');
          setErrorMessage(data.error || 'Invalid or expired pairing token');
          return;
        }

        setAgentInfo(data);
        setStatus('ready');
      } catch {
        setStatus('error');
        setErrorMessage('Failed to validate pairing token');
      }
    }

    validatePairing();
  }, [token, code]);

  // Handle connection confirmation
  const handleConfirm = async () => {
    if (!agentInfo) return;

    // Check if user is authenticated
    if (!isAuthenticated) {
      // Redirect to auth with return URL
      const returnUrl = encodeURIComponent(window.location.href);
      router.push(`/auth/sign-in?returnTo=${returnUrl}`);
      return;
    }

    setStatus('connecting');

    try {
      // Create the connection via API
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: agentInfo.agentUrl,
          name: agentInfo.machineName,
          method: agentInfo.agentUrl.includes('.ts.net') ? 'tailscale' : 'custom',
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to save connection');
      }

      setStatus('success');

      // Redirect to home after a short delay
      setTimeout(() => {
        router.push('/?connected=true');
      }, 1500);
    } catch {
      setStatus('error');
      setErrorMessage('Failed to save connection. Please try again.');
    }
  };

  // Handle cancel
  const handleCancel = () => {
    router.push('/');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0a0a10] to-[#1a1a2e] p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl backdrop-blur-sm"
      >
        {/* Success overlay */}
        <AnimatePresence>
          {status === 'success' && (
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
                Redirecting to dashboard...
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading state */}
        {status === 'loading' && (
          <div className="flex flex-col items-center py-12">
            <Loader2 className="mb-4 h-12 w-12 animate-spin text-orange-500" />
            <p className="text-white/60">Validating pairing request...</p>
          </div>
        )}

        {/* Error state */}
        {status === 'error' && (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
              <AlertTriangle className="h-10 w-10 text-red-400" />
            </div>
            <h2 className="mb-2 text-xl font-semibold text-white">Pairing Failed</h2>
            <p className="mb-8 text-white/50">{errorMessage}</p>
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 rounded-xl bg-white/5 px-6 py-3 text-sm font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </button>
          </div>
        )}

        {/* Ready state - show agent info and confirm */}
        {(status === 'ready' || status === 'connecting') && agentInfo && (
          <>
            <div className="mb-8 text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/20">
                <Server className="h-10 w-10 text-white" />
              </div>
              <h2 className="mb-2 text-2xl font-bold text-white">Connect Agent</h2>
              <p className="text-white/50">Add this agent to your dashboard</p>
            </div>

            <div className="mb-8 space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <div>
                <label className="mb-1 block text-xs text-white/40">Machine Name</label>
                <p className="text-lg font-medium text-white">{agentInfo.machineName}</p>
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/40">Agent URL</label>
                <p className="font-mono text-sm text-orange-400">{agentInfo.agentUrl}</p>
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/40">Machine ID</label>
                <p className="font-mono text-xs text-white/50">{agentInfo.machineId}</p>
              </div>
            </div>

            {!isAuthenticated && (
              <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
                  <div className="text-sm">
                    <p className="mb-1 font-medium text-amber-400">Sign in required</p>
                    <p className="text-white/50">
                      You&apos;ll be redirected to sign in before completing the connection.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                disabled={status === 'connecting'}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={status === 'connecting'}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all',
                  'bg-gradient-to-r from-orange-500 to-amber-500 text-white',
                  'hover:shadow-lg hover:shadow-orange-500/20',
                  status === 'connecting' && 'cursor-wait opacity-75'
                )}
              >
                {status === 'connecting' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {isAuthenticated ? 'Connect' : 'Sign in & Connect'}
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

export default function ConnectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0a0a10] to-[#1a1a2e]">
          <Loader2 className="h-12 w-12 animate-spin text-orange-500" />
        </div>
      }
    >
      <ConnectContent />
    </Suspense>
  );
}
