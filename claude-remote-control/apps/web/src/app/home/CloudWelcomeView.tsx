'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  LogOut,
  ChevronDown,
  Cloud,
  Rocket,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Unplug,
} from 'lucide-react';
import { FlyioLinkModal } from '@/components/FlyioLinkModal';
import {
  AgentConnectionSettings,
  type saveAgentConnection,
} from '@/components/AgentConnectionSettings';
import type { FlyioStatus } from '@/hooks/useFlyioStatus';

interface CloudWelcomeViewProps {
  user: {
    name: string | null;
    email: string | null;
    image: string | null;
  };
  flyioStatus: FlyioStatus | null;
  flyioLoading?: boolean;
  onSignOut: () => void;
  onConnectionSaved: (connection: ReturnType<typeof saveAgentConnection>) => void;
  onFlyioConnected: () => void;
  onFlyioDisconnect?: () => void;
  onLaunchAgent?: () => void;
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

export function CloudWelcomeView({
  user,
  flyioStatus,
  flyioLoading,
  onSignOut,
  onConnectionSaved,
  onFlyioConnected,
  onFlyioDisconnect,
  onLaunchAgent,
}: CloudWelcomeViewProps) {
  const [flyioModalOpen, setFlyioModalOpen] = useState(false);
  const [localModalOpen, setLocalModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const displayName = user.name || user.email?.split('@')[0] || 'User';
  const isConnected = flyioStatus?.connected === true;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0a0a10] selection:bg-orange-500/20">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-purple-500/10 blur-[120px]"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-32 -right-32 h-[600px] w-[600px] rounded-full bg-orange-500/10 blur-[150px]"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.4, 0.2, 0.4],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Header with User Menu */}
      <header className="relative z-20 border-b border-white/5 bg-black/20 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-500">
              <span className="text-sm font-bold text-white">247</span>
            </div>
            <span className="font-semibold text-white">Cloud</span>
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 transition-colors hover:bg-white/10"
            >
              {user.image ? (
                <img src={user.image} alt={displayName} className="h-6 w-6 rounded-full" />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500/20 text-xs font-medium text-purple-400">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-sm text-white">{displayName}</span>
              <ChevronDown className="h-4 w-4 text-white/50" />
            </button>

            {/* Dropdown */}
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute right-0 top-full z-20 mt-2 w-48 overflow-hidden rounded-xl border border-white/10 bg-[#0a0a10] shadow-xl"
                >
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onSignOut();
                    }}
                    className="flex w-full items-center gap-2 px-4 py-3 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </motion.div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-2xl px-6 py-16 lg:py-24">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center"
        >
          {/* Welcome Message */}
          <motion.div variants={itemVariants} className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.3 }}
              className="mb-6 inline-flex items-center justify-center rounded-full bg-green-500/10 p-4"
            >
              <Rocket className="h-8 w-8 text-green-400" />
            </motion.div>
            <h1 className="text-3xl font-bold text-white sm:text-4xl">Welcome, {displayName}!</h1>
            <p className="mt-3 text-lg text-white/60">One more step to launch your cloud agent.</p>
          </motion.div>

          {/* Main Card - Connect Fly.io or Launch Agent */}
          <motion.div
            variants={itemVariants}
            className={`mt-10 w-full overflow-hidden rounded-2xl border p-6 shadow-lg ${
              isConnected
                ? 'border-green-500/20 bg-green-500/5 shadow-green-500/10'
                : 'border-purple-500/20 bg-purple-500/5 shadow-purple-500/10'
            }`}
          >
            {flyioLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
              </div>
            ) : isConnected ? (
              /* Connected State - Show Launch Agent */
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-500/10">
                  <CheckCircle2 className="h-6 w-6 text-green-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-white">Fly.io Connected</h2>
                    <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-400">
                      Ready
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-white/50">
                    Connected to{' '}
                    <span className="font-medium text-white/70">
                      {flyioStatus?.orgName || 'your organization'}
                    </span>
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <span className="rounded-full bg-green-500/10 px-3 py-1 text-xs text-green-300">
                      ~$5/month
                    </span>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/50">
                      Scale to zero
                    </span>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/50">
                      Your infrastructure
                    </span>
                  </div>

                  <button
                    onClick={onLaunchAgent}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-green-500/25 transition-all hover:shadow-green-500/40"
                  >
                    <Rocket className="h-4 w-4" />
                    Launch Cloud Agent
                  </button>

                  {/* Disconnect option */}
                  <button
                    onClick={onFlyioDisconnect}
                    className="mt-3 flex w-full items-center justify-center gap-2 text-xs text-white/40 transition-colors hover:text-white/60"
                  >
                    <Unplug className="h-3 w-3" />
                    Disconnect Fly.io
                  </button>
                </div>
              </div>
            ) : (
              /* Not Connected - Show Connect Button */
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-500/10">
                  <Cloud className="h-6 w-6 text-purple-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-white">Connect your Fly.io account</h2>
                  <p className="mt-1 text-sm text-white/50">
                    Your agent will run in your own Fly.io organization. You pay Fly.io directly and
                    maintain full control of your data.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <span className="rounded-full bg-purple-500/10 px-3 py-1 text-xs text-purple-300">
                      ~$5/month
                    </span>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/50">
                      Scale to zero
                    </span>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/50">
                      Your infrastructure
                    </span>
                  </div>

                  <button
                    onClick={() => setFlyioModalOpen(true)}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-violet-500 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-purple-500/40"
                  >
                    Connect Fly.io
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>

          {/* Alternative - Local Agent */}
          <motion.div variants={itemVariants} className="mt-6 text-center">
            <p className="text-sm text-white/40">
              Or{' '}
              <button
                onClick={() => setLocalModalOpen(true)}
                className="text-white/60 underline underline-offset-2 transition-colors hover:text-white"
              >
                connect a local agent
              </button>{' '}
              instead
            </p>
          </motion.div>
        </motion.div>
      </div>

      {/* Modals */}
      <FlyioLinkModal
        open={flyioModalOpen}
        onOpenChange={setFlyioModalOpen}
        onSuccess={onFlyioConnected}
      />

      <AgentConnectionSettings
        open={localModalOpen}
        onOpenChange={setLocalModalOpen}
        onSave={onConnectionSaved}
      />
    </main>
  );
}
