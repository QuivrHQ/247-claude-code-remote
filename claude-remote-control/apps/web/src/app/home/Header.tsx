'use client';

import {
  Monitor,
  Plus,
  Activity,
  AlertCircle,
  Wifi,
  Maximize2,
  Minimize2,
  Zap,
  Menu,
  HelpCircle,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SelectedSession } from './types';

interface HeaderProps {
  agentUrl: string;
  sessionCount: number;
  needsAttention: number;
  selectedSession: SelectedSession | null;
  isFullscreen: boolean;
  onConnectionSettingsClick: () => void;
  onToggleFullscreen: () => void;
  onNewSession: () => void;
  /** Whether in mobile mode */
  isMobile?: boolean;
  /** Callback to open mobile menu */
  onMobileMenuClick?: () => void;
  /** Callback to open Guide panel */
  onOpenGuide?: () => void;
  /** Callback to open Environments panel */
  onOpenEnvironments?: () => void;
}

export function Header({
  agentUrl,
  sessionCount,
  needsAttention,
  selectedSession,
  isFullscreen,
  onConnectionSettingsClick,
  onToggleFullscreen,
  onNewSession,
  isMobile = false,
  onMobileMenuClick,
  onOpenGuide,
  onOpenEnvironments,
}: HeaderProps) {
  if (isFullscreen && selectedSession) {
    return null;
  }

  return (
    <header className="z-40 flex-none border-b border-white/5 bg-[#0a0a10]/80 backdrop-blur-xl">
      <div className={cn('px-4 py-2.5', isMobile && 'px-3')}>
        <div className="flex items-center justify-between">
          {/* Mobile Menu Button + Logo */}
          <div className="flex items-center gap-3">
            {/* Mobile hamburger menu */}
            {isMobile && onMobileMenuClick && (
              <button
                onClick={onMobileMenuClick}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg',
                  'text-white/60 hover:bg-white/5 hover:text-white',
                  'touch-manipulation transition-colors active:scale-95'
                )}
                aria-label="Open navigation menu"
              >
                <Menu className="h-5 w-5" />
                {/* Badge for attention needed */}
                {needsAttention > 0 && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-orange-500" />
                )}
              </button>
            )}

            {/* Logo & Title */}
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex items-center justify-center rounded-lg border border-orange-500/20 bg-gradient-to-br from-orange-500/20 to-amber-500/20',
                  isMobile ? 'h-8 w-8' : 'h-8 w-8'
                )}
              >
                <Zap className="h-4 w-4 text-orange-500" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white">247</h1>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  <p
                    className={cn(
                      'font-mono text-white/40',
                      isMobile ? 'max-w-[100px] truncate text-[9px]' : 'text-[10px]'
                    )}
                  >
                    {agentUrl}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile: Compact stats */}
          {isMobile && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1">
                <Activity className="h-3 w-3 text-white/40" />
                <span className="text-xs font-medium text-white/70">{sessionCount}</span>
              </div>
              {needsAttention > 0 && (
                <div className="flex items-center gap-1 rounded-full bg-orange-500/20 px-2 py-1">
                  <AlertCircle className="h-3 w-3 text-orange-400" />
                  <span className="text-xs font-medium text-orange-400">{needsAttention}</span>
                </div>
              )}
            </div>
          )}

          {/* Desktop: Global Stats */}
          {!isMobile && (
            <div className="hidden items-center gap-6 rounded-full border border-white/5 bg-white/5 px-4 py-1.5 md:flex">
              <div className="flex items-center gap-2 text-xs">
                <Monitor className="h-3.5 w-3.5 text-white/30" />
                <span className="text-white/60">Local Agent</span>
                <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                  Online
                </span>
              </div>
              <div className="h-3 w-px bg-white/10" />
              <div className="flex items-center gap-2 text-xs">
                <Activity className="h-3.5 w-3.5 text-white/30" />
                <span className="font-medium text-white/80">{sessionCount}</span>
                <span className="text-white/30">active sessions</span>
              </div>
              {needsAttention > 0 && (
                <>
                  <div className="h-3 w-px bg-white/10" />
                  <div className="flex items-center gap-2 text-xs">
                    <AlertCircle className="h-3.5 w-3.5 text-orange-400" />
                    <span className="font-medium text-orange-400">
                      {needsAttention} action{needsAttention !== 1 ? 's' : ''} needed
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Guide button - desktop only */}
            {!isMobile && onOpenGuide && (
              <button
                onClick={onOpenGuide}
                className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
                title="Connection Guide"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            )}

            {/* Environments button - desktop only */}
            {!isMobile && onOpenEnvironments && (
              <button
                onClick={onOpenEnvironments}
                className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
                title="Environments"
              >
                <Settings className="h-4 w-4" />
              </button>
            )}

            <button
              onClick={onConnectionSettingsClick}
              className={cn(
                'rounded-lg text-white/40 transition-colors hover:bg-white/5 hover:text-white',
                'touch-manipulation',
                isMobile ? 'min-h-[44px] min-w-[44px] p-2.5' : 'p-2'
              )}
              title="Connection settings"
            >
              <Wifi className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
            </button>

            {selectedSession && !isMobile && (
              <button
                onClick={onToggleFullscreen}
                className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
                title={isFullscreen ? 'Exit fullscreen (⌘F)' : 'Fullscreen (⌘F)'}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>
            )}

            {!isMobile && <div className="mx-1 h-4 w-px bg-white/10" />}

            <button
              onClick={onNewSession}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg font-medium transition-all',
                'bg-white text-black hover:bg-white/90',
                'shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] active:scale-[0.98]',
                'touch-manipulation',
                isMobile ? 'min-h-[44px] px-3 py-2.5 text-sm' : 'px-3 py-1.5 text-sm'
              )}
            >
              <Plus className={isMobile ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
              <span className={isMobile ? 'inline' : 'hidden sm:inline'}>New</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
