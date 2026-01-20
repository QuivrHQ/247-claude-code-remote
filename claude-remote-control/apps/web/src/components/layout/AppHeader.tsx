'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  Plus,
  HelpCircle,
  Settings,
  User,
  LogOut,
  ChevronRight,
  Bell,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { spring } from '@/lib/animations';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface AppHeaderProps {
  onSidebarToggle?: () => void;
  sidebarCollapsed?: boolean;
  isMobile?: boolean;
  onMenuClick?: () => void;
  currentMachineName?: string;
  currentProjectName?: string;
  onNewSession?: () => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// User Menu Component
// ═══════════════════════════════════════════════════════════════════════════

function UserMenu() {
  const [open, setOpen] = useState(false);

  // Mock user data
  const user = {
    name: 'Stan',
    email: 'stan@quivr.com',
    initials: 'S',
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'h-8 w-8 rounded-full',
          'bg-gradient-to-br from-orange-500 to-amber-500',
          'flex items-center justify-center',
          'text-xs font-bold text-white',
          'hover:ring-primary/30 hover:ring-offset-background hover:ring-2 hover:ring-offset-2',
          'transition-all duration-150'
        )}
        aria-label={`User menu for ${user.name}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {user.initials}
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
              onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
              role="button"
              tabIndex={-1}
              aria-label="Close menu"
            />

            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={spring.snappy}
              className={cn(
                'absolute right-0 top-full z-50 mt-2',
                'w-56 rounded-xl p-1',
                'bg-surface-2 border border-white/10',
                'shadow-modal'
              )}
            >
              {/* User info */}
              <div className="mb-1 border-b border-white/5 px-3 py-2">
                <div className="font-medium text-white/90">{user.name}</div>
                <div className="text-xs text-white/40">{user.email}</div>
              </div>

              {/* Menu items */}
              <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white/90">
                <User className="h-4 w-4" />
                Profile
              </button>
              <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white/90">
                <Settings className="h-4 w-4" />
                Settings
              </button>
              <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white/90">
                <Bell className="h-4 w-4" />
                Notifications
              </button>

              <div className="my-1 h-px bg-white/5" />

              <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-500/10">
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Icon Button Component
// ═══════════════════════════════════════════════════════════════════════════

interface IconButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  badge?: number;
  className?: string;
}

function IconButton({ icon, label, onClick, badge, className }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative rounded-lg p-2',
        'text-white/50 hover:bg-white/5 hover:text-white/80',
        'transition-all duration-150',
        className
      )}
      title={label}
      aria-label={badge ? `${label} (${badge > 9 ? '9+' : badge} new)` : label}
    >
      <span aria-hidden="true">{icon}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className="bg-primary absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
          aria-hidden="true"
        >
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AppHeader Component
// ═══════════════════════════════════════════════════════════════════════════

export function AppHeader({
  onSidebarToggle: _onSidebarToggle,
  sidebarCollapsed,
  isMobile,
  onMenuClick,
  currentMachineName,
  currentProjectName,
  onNewSession,
  onToggleFullscreen,
  isFullscreen,
}: AppHeaderProps) {
  return (
    <header
      className={cn(
        'flex h-14 items-center justify-between px-4',
        'border-b border-white/5',
        'glass-dark',
        'z-40'
      )}
      role="banner"
      aria-label="Application header"
    >
      {/* Left Section */}
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        {isMobile && (
          <button
            onClick={onMenuClick}
            className="rounded-lg p-2 text-white/70 hover:bg-white/5"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        )}

        {/* Logo (only on mobile or when sidebar collapsed or in fullscreen) */}
        {(isMobile || sidebarCollapsed || isFullscreen) && (
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-500">
              <span className="text-xs font-bold text-white">24</span>
            </div>
            {(isMobile || isFullscreen) && <span className="font-semibold text-white/90">247</span>}
          </div>
        )}
      </div>

      {/* Center - Breadcrumb (desktop only) */}
      {!isMobile && (currentMachineName || currentProjectName) && (
        <div className="flex items-center gap-2 text-sm">
          {currentMachineName && <span className="text-white/50">{currentMachineName}</span>}
          {currentMachineName && currentProjectName && (
            <ChevronRight className="h-4 w-4 text-white/20" />
          )}
          {currentProjectName && (
            <span className="font-medium text-white/70">{currentProjectName}</span>
          )}
        </div>
      )}

      {/* Right Section */}
      <div className="flex items-center gap-2">
        <IconButton icon={<HelpCircle className="h-5 w-5" />} label="Help" />

        {!isMobile && (
          <>
            <IconButton icon={<Bell className="h-5 w-5" />} label="Notifications" badge={2} />
            {onToggleFullscreen && (
              <IconButton
                icon={
                  isFullscreen ? (
                    <Minimize2 className="h-5 w-5" />
                  ) : (
                    <Maximize2 className="h-5 w-5" />
                  )
                }
                label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                onClick={onToggleFullscreen}
              />
            )}
          </>
        )}

        {/* New Session Button */}
        <button
          onClick={onNewSession}
          className={cn(
            'flex items-center gap-2',
            'rounded-lg px-3 py-1.5',
            'bg-primary text-sm font-medium text-white',
            'hover:bg-primary/90 active:scale-[0.98]',
            'transition-all duration-150',
            'shadow-primary/20 shadow-lg'
          )}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Session</span>
        </button>

        {/* User Menu */}
        <UserMenu />
      </div>
    </header>
  );
}
