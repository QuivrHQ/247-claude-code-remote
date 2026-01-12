'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Lock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FlyioLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const FLYIO_TOKENS_URL = 'https://fly.io/user/personal_access_tokens';
const PROVISIONING_URL = process.env.NEXT_PUBLIC_PROVISIONING_URL;

type Status = 'idle' | 'loading' | 'success' | 'error';

export function FlyioLinkModal({ open, onOpenChange, onSuccess }: FlyioLinkModalProps) {
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleConnect = async () => {
    if (!token.trim() || !PROVISIONING_URL) return;

    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await fetch(`${PROVISIONING_URL}/api/flyio/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ token: token.trim() }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to connect Fly.io');
      }

      setStatus('success');
      setTimeout(() => {
        onOpenChange(false);
        onSuccess?.();
      }, 1500);
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Connection failed');
    }
  };

  const handleClose = () => {
    if (status === 'loading') return;
    setToken('');
    setStatus('idle');
    setErrorMessage('');
    onOpenChange(false);
  };

  const isValidToken =
    token.trim().startsWith('fo1_') ||
    token.trim().startsWith('fm1_') ||
    token.trim().startsWith('fm2_');

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-4"
          >
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a10] shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                <div className="flex items-center gap-3">
                  {/* Fly.io Logo */}
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
                    <svg
                      className="h-5 w-5 text-purple-400"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="font-semibold text-white">Connect Fly.io</h2>
                    <p className="text-xs text-white/50">BYOC - Bring Your Own Cloud</p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  disabled={status === 'loading'}
                  className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <div className="space-y-5 px-6 py-5">
                {/* Info Banner */}
                <div className="rounded-xl bg-purple-500/10 p-4">
                  <p className="text-sm text-purple-200">
                    Your cloud agent will run in <span className="font-medium">your</span> Fly.io
                    org. You pay Fly.io directly. We never see your data.
                  </p>
                </div>

                {/* Steps */}
                <div className="space-y-4">
                  {/* Step 1 */}
                  <div className="flex gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-xs font-medium text-orange-400">
                      1
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-white/80">
                        Go to Fly.io and create a Personal Access Token
                      </p>
                      <a
                        href={FLYIO_TOKENS_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-purple-400 transition-colors hover:text-purple-300"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open Fly.io Tokens Page
                      </a>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-xs font-medium text-orange-400">
                      2
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-white/80">
                        Create a token with{' '}
                        <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">read</code> and{' '}
                        <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">write</code>{' '}
                        scopes
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-xs font-medium text-orange-400">
                      3
                    </div>
                    <div className="flex-1">
                      <p className="mb-2 text-sm text-white/80">Paste your token here:</p>
                      <input
                        type="password"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="fo1_xxxxxxxxxxxxxxxxxxxxxxxx"
                        disabled={status === 'loading' || status === 'success'}
                        className={cn(
                          'w-full rounded-lg border bg-white/5 px-4 py-3 font-mono text-sm text-white placeholder:text-white/30',
                          'focus:outline-none focus:ring-1',
                          status === 'error'
                            ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20'
                            : 'border-white/10 focus:border-purple-500/50 focus:ring-purple-500/20',
                          'disabled:opacity-50'
                        )}
                      />
                      {status === 'error' && errorMessage && (
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
                          <AlertCircle className="h-3 w-3" />
                          {errorMessage}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Connect Button */}
                <button
                  onClick={handleConnect}
                  disabled={!isValidToken || status === 'loading' || status === 'success'}
                  className={cn(
                    'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all',
                    status === 'success'
                      ? 'bg-green-500 text-white'
                      : 'bg-gradient-to-r from-purple-500 to-violet-500 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40',
                    'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none'
                  )}
                >
                  {status === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}
                  {status === 'success' && <CheckCircle2 className="h-4 w-4" />}
                  {status === 'loading'
                    ? 'Connecting...'
                    : status === 'success'
                      ? 'Connected!'
                      : 'Connect Fly.io'}
                </button>

                {/* Security Note */}
                <div className="flex items-center justify-center gap-1.5 text-xs text-white/40">
                  <Lock className="h-3 w-3" />
                  <span>Token encrypted. Stored securely. Never shared.</span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
