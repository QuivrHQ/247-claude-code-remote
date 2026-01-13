'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Monitor,
  Cloud,
  Globe,
  Plus,
  X,
  Activity,
  AlertCircle,
  ChevronDown,
  Zap,
  Wifi,
  WifiOff,
  Settings,
  HelpCircle,
  Maximize2,
  Minimize2,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import React from 'react';

// Types for the multi-agent system
export interface ConnectedAgent {
  id: string;
  name: string;
  url: string;
  method: 'localhost' | 'tailscale' | 'custom' | 'cloud';
  status: 'online' | 'offline' | 'connecting';
  sessionCount?: number;
}

interface MultiAgentHeaderProps {
  agents: ConnectedAgent[];
  totalSessionCount: number;
  needsAttention: number;
  onAddAgent: () => void;
  onDisconnectAgent: (id: string) => void;
  onSelectAgent?: (id: string) => void;
  selectedAgentId?: string;
  onNewSession: () => void;
  onOpenGuide?: () => void;
  onOpenEnvironments?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  isMobile?: boolean;
  onMobileMenuClick?: () => void;
}

// Agent type icons and colors
const agentTypeConfig = {
  localhost: {
    icon: Monitor,
    color: 'emerald',
    label: 'Local',
  },
  tailscale: {
    icon: Globe,
    color: 'blue',
    label: 'Tailscale',
  },
  custom: {
    icon: Wifi,
    color: 'amber',
    label: 'Custom',
  },
  cloud: {
    icon: Cloud,
    color: 'purple',
    label: 'Cloud',
  },
};

const statusConfig = {
  online: {
    color: 'bg-emerald-500',
    pulse: true,
    label: 'Online',
  },
  offline: {
    color: 'bg-red-500/60',
    pulse: false,
    label: 'Offline',
  },
  connecting: {
    color: 'bg-amber-500',
    pulse: true,
    label: 'Connecting',
  },
};

// Individual agent pill component
function AgentPill({
  agent,
  isExpanded,
  onToggle,
  onDisconnect,
  isOnly,
}: {
  agent: ConnectedAgent;
  isExpanded: boolean;
  onToggle: () => void;
  onDisconnect: () => void;
  isOnly: boolean;
}) {
  const config = agentTypeConfig[agent.method];
  const status = statusConfig[agent.status];
  const Icon = config.icon;

  return (
    <motion.div
      layout
      className="relative"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
    >
      <button
        onClick={onToggle}
        className={cn(
          'group relative flex items-center gap-2 rounded-full border px-3 py-1.5 transition-all duration-200',
          isExpanded
            ? 'border-white/20 bg-white/10'
            : 'border-white/5 bg-white/[0.03] hover:border-white/10 hover:bg-white/[0.06]'
        )}
      >
        {/* Status indicator */}
        <span className="relative flex h-2 w-2">
          <span
            className={cn(
              'absolute inline-flex h-full w-full rounded-full opacity-75',
              status.color,
              status.pulse && 'animate-ping'
            )}
          />
          <span className={cn('relative inline-flex h-2 w-2 rounded-full', status.color)} />
        </span>

        {/* Agent icon */}
        <Icon
          className={cn(
            'h-3.5 w-3.5 transition-colors',
            agent.status === 'online' ? 'text-white/70' : 'text-white/40'
          )}
        />

        {/* Agent name */}
        <span
          className={cn(
            'max-w-[120px] truncate text-xs font-medium transition-colors',
            agent.status === 'online' ? 'text-white/80' : 'text-white/40'
          )}
        >
          {agent.name}
        </span>

        {/* Session count badge */}
        {agent.sessionCount !== undefined && agent.sessionCount > 0 && (
          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/50">
            {agent.sessionCount}
          </span>
        )}

        {/* Expand indicator */}
        <ChevronDown
          className={cn(
            'h-3 w-3 text-white/30 transition-transform duration-200',
            isExpanded && 'rotate-180'
          )}
        />
      </button>

      {/* Expanded dropdown */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full z-50 mt-2 min-w-[220px] overflow-hidden rounded-xl border border-white/10 bg-[#12121a] shadow-2xl shadow-black/50"
          >
            {/* Agent details */}
            <div className="border-b border-white/5 p-3">
              <div className="flex items-center gap-2">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor:
                      config.color === 'emerald'
                        ? 'rgba(16, 185, 129, 0.2)'
                        : config.color === 'blue'
                          ? 'rgba(59, 130, 246, 0.2)'
                          : config.color === 'purple'
                            ? 'rgba(168, 85, 247, 0.2)'
                            : 'rgba(245, 158, 11, 0.2)',
                  }}
                >
                  <Icon
                    className="h-4 w-4"
                    style={{
                      color:
                        config.color === 'emerald'
                          ? 'rgb(16, 185, 129)'
                          : config.color === 'blue'
                            ? 'rgb(59, 130, 246)'
                            : config.color === 'purple'
                              ? 'rgb(168, 85, 247)'
                              : 'rgb(245, 158, 11)',
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{agent.name}</p>
                  <p className="truncate font-mono text-[10px] text-white/40">{agent.url}</p>
                </div>
              </div>

              {/* Status row */}
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={cn('h-1.5 w-1.5 rounded-full', status.color)} />
                  <span className="text-xs text-white/50">{status.label}</span>
                </div>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/40">
                  {config.label}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="p-1.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDisconnect();
                }}
                disabled={isOnly}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors',
                  isOnly ? 'cursor-not-allowed text-white/20' : 'text-red-400 hover:bg-red-500/10'
                )}
              >
                <WifiOff className="h-3.5 w-3.5" />
                <span>{isOnly ? 'Cannot disconnect only agent' : 'Disconnect'}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Compact agents display (when many agents)
function AgentsCompactView({
  agents,
  onExpand,
}: {
  agents: ConnectedAgent[];
  onExpand: () => void;
}) {
  const onlineCount = agents.filter((a) => a.status === 'online').length;
  const totalCount = agents.length;

  return (
    <button
      onClick={onExpand}
      className="flex items-center gap-2 rounded-full border border-white/5 bg-white/[0.03] px-3 py-1.5 transition-all hover:border-white/10 hover:bg-white/[0.06]"
    >
      {/* Stacked status indicators */}
      <div className="flex -space-x-1">
        {agents.slice(0, 3).map((agent, i) => (
          <span
            key={agent.id}
            className={cn(
              'flex h-4 w-4 items-center justify-center rounded-full border-2 border-[#0a0a10]',
              agent.status === 'online' ? 'bg-emerald-500' : 'bg-white/20'
            )}
            style={{ zIndex: 3 - i }}
          >
            {React.createElement(agentTypeConfig[agent.method].icon, {
              className: 'h-2 w-2 text-white',
            })}
          </span>
        ))}
        {agents.length > 3 && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-[#0a0a10] bg-white/10 text-[8px] font-bold text-white/60">
            +{agents.length - 3}
          </span>
        )}
      </div>

      <span className="text-xs text-white/60">
        <span className="font-medium text-white/80">{onlineCount}</span>
        <span className="text-white/40">/{totalCount}</span>
        <span className="ml-1 text-white/40">agents</span>
      </span>

      <ChevronDown className="h-3 w-3 text-white/30" />
    </button>
  );
}

// Full agents panel (dropdown when compact view is clicked)
function AgentsPanel({
  agents,
  onClose,
  onDisconnect,
  onAddAgent,
}: {
  agents: ConnectedAgent[];
  onClose: () => void;
  onDisconnect: (id: string) => void;
  onAddAgent: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="absolute left-0 top-full z-50 mt-2 w-[320px] overflow-hidden rounded-2xl border border-white/10 bg-[#12121a]/95 shadow-2xl shadow-black/50 backdrop-blur-xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-semibold text-white">Connected Agents</span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/50">
            {agents.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Agents list */}
      <div className="max-h-[280px] overflow-y-auto p-2">
        <AnimatePresence>
          {agents.map((agent, index) => {
            const config = agentTypeConfig[agent.method];
            const status = statusConfig[agent.status];
            const Icon = config.icon;

            return (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group mb-1 flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-white/5"
              >
                {/* Icon with status ring */}
                <div className="relative">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{
                      backgroundColor:
                        config.color === 'emerald'
                          ? 'rgba(16, 185, 129, 0.15)'
                          : config.color === 'blue'
                            ? 'rgba(59, 130, 246, 0.15)'
                            : config.color === 'purple'
                              ? 'rgba(168, 85, 247, 0.15)'
                              : 'rgba(245, 158, 11, 0.15)',
                    }}
                  >
                    <Icon
                      className="h-4 w-4"
                      style={{
                        color:
                          agent.status === 'online'
                            ? config.color === 'emerald'
                              ? 'rgb(16, 185, 129)'
                              : config.color === 'blue'
                                ? 'rgb(59, 130, 246)'
                                : config.color === 'purple'
                                  ? 'rgb(168, 85, 247)'
                                  : 'rgb(245, 158, 11)'
                            : 'rgba(255, 255, 255, 0.3)',
                      }}
                    />
                  </div>
                  {/* Status dot */}
                  <span
                    className={cn(
                      'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#12121a]',
                      status.color
                    )}
                  />
                </div>

                {/* Agent info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-white/90">{agent.name}</p>
                    {agent.sessionCount !== undefined && agent.sessionCount > 0 && (
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/50">
                        {agent.sessionCount} sessions
                      </span>
                    )}
                  </div>
                  <p className="truncate font-mono text-[10px] text-white/40">{agent.url}</p>
                </div>

                {/* Disconnect button */}
                <button
                  onClick={() => onDisconnect(agent.id)}
                  disabled={agents.length === 1}
                  className={cn(
                    'rounded-lg p-1.5 opacity-0 transition-all group-hover:opacity-100',
                    agents.length === 1
                      ? 'cursor-not-allowed text-white/10'
                      : 'text-white/30 hover:bg-red-500/10 hover:text-red-400'
                  )}
                  title={agents.length === 1 ? 'Cannot disconnect only agent' : 'Disconnect'}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Add agent button */}
      <div className="border-t border-white/5 p-2">
        <button
          onClick={onAddAgent}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500/20 to-amber-500/20 px-4 py-2.5 text-sm font-medium text-orange-400 transition-all hover:from-orange-500/30 hover:to-amber-500/30"
        >
          <Plus className="h-4 w-4" />
          Add Agent
        </button>
      </div>
    </motion.div>
  );
}

export function MultiAgentHeader({
  agents,
  totalSessionCount,
  needsAttention,
  onAddAgent,
  onDisconnectAgent,
  onNewSession,
  onOpenGuide,
  onOpenEnvironments,
  isFullscreen = false,
  onToggleFullscreen,
  isMobile = false,
  onMobileMenuClick,
}: MultiAgentHeaderProps) {
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [showAgentsPanel, setShowAgentsPanel] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setExpandedAgentId(null);
        setShowAgentsPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determine display mode based on agent count
  const useCompactView = agents.length > 3;

  if (isFullscreen) {
    return null;
  }

  return (
    <header
      ref={headerRef}
      className="z-40 flex-none border-b border-white/5 bg-[#0a0a10]/80 backdrop-blur-xl"
    >
      <div className={cn('px-4 py-2.5', isMobile && 'px-3')}>
        <div className="flex items-center justify-between">
          {/* Left: Logo + Agents */}
          <div className="flex items-center gap-4">
            {/* Mobile hamburger menu */}
            {isMobile && onMobileMenuClick && (
              <button
                onClick={onMobileMenuClick}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/5 hover:text-white"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}

            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-orange-500/20 bg-gradient-to-br from-orange-500/20 to-amber-500/20">
                <Zap className="h-4 w-4 text-orange-500" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white">247</h1>
                {!isMobile && agents.length > 0 && (
                  <p className="text-[10px] text-white/30">
                    {agents.filter((a) => a.status === 'online').length} agent
                    {agents.filter((a) => a.status === 'online').length !== 1 ? 's' : ''} connected
                  </p>
                )}
              </div>
            </div>

            {/* Agents display - desktop only */}
            {!isMobile && (
              <div className="relative ml-2 flex items-center gap-2">
                {/* Separator */}
                <div className="h-6 w-px bg-white/10" />

                {agents.length === 0 ? (
                  /* No agents connected */
                  <button
                    onClick={onAddAgent}
                    className="flex items-center gap-2 rounded-full border border-dashed border-white/20 bg-white/[0.02] px-3 py-1.5 text-xs text-white/50 transition-all hover:border-orange-500/30 hover:bg-orange-500/5 hover:text-orange-400"
                  >
                    <Plus className="h-3 w-3" />
                    Connect Agent
                  </button>
                ) : useCompactView ? (
                  /* Compact view for many agents */
                  <div className="relative">
                    <AgentsCompactView
                      agents={agents}
                      onExpand={() => setShowAgentsPanel(!showAgentsPanel)}
                    />
                    <AnimatePresence>
                      {showAgentsPanel && (
                        <AgentsPanel
                          agents={agents}
                          onClose={() => setShowAgentsPanel(false)}
                          onDisconnect={onDisconnectAgent}
                          onAddAgent={() => {
                            setShowAgentsPanel(false);
                            onAddAgent();
                          }}
                        />
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  /* Individual pills for few agents */
                  <>
                    <AnimatePresence mode="popLayout">
                      {agents.map((agent) => (
                        <AgentPill
                          key={agent.id}
                          agent={agent}
                          isExpanded={expandedAgentId === agent.id}
                          onToggle={() =>
                            setExpandedAgentId(expandedAgentId === agent.id ? null : agent.id)
                          }
                          onDisconnect={() => {
                            setExpandedAgentId(null);
                            onDisconnectAgent(agent.id);
                          }}
                          isOnly={agents.length === 1}
                        />
                      ))}
                    </AnimatePresence>

                    {/* Add agent button */}
                    <motion.button
                      layout
                      onClick={onAddAgent}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-white/10 text-white/30 transition-all hover:border-orange-500/30 hover:bg-orange-500/5 hover:text-orange-400"
                      title="Add agent"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </motion.button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Center: Stats - desktop only */}
          {!isMobile && agents.length > 0 && (
            <div className="hidden items-center gap-4 rounded-full border border-white/5 bg-white/[0.02] px-4 py-1.5 md:flex">
              <div className="flex items-center gap-2 text-xs">
                <Activity className="h-3.5 w-3.5 text-white/30" />
                <span className="font-medium text-white/80">{totalSessionCount}</span>
                <span className="text-white/30">sessions</span>
              </div>
              {needsAttention > 0 && (
                <>
                  <div className="h-3 w-px bg-white/10" />
                  <div className="flex items-center gap-2 text-xs">
                    <AlertCircle className="h-3.5 w-3.5 text-orange-400" />
                    <span className="font-medium text-orange-400">{needsAttention}</span>
                    <span className="text-orange-400/60">
                      action{needsAttention !== 1 ? 's' : ''}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Mobile: Compact stats */}
          {isMobile && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1">
                <Activity className="h-3 w-3 text-white/40" />
                <span className="text-xs font-medium text-white/70">{totalSessionCount}</span>
              </div>
              {needsAttention > 0 && (
                <div className="flex items-center gap-1 rounded-full bg-orange-500/20 px-2 py-1">
                  <AlertCircle className="h-3 w-3 text-orange-400" />
                  <span className="text-xs font-medium text-orange-400">{needsAttention}</span>
                </div>
              )}
            </div>
          )}

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Desktop action buttons */}
            {!isMobile && (
              <>
                {onOpenGuide && (
                  <button
                    onClick={onOpenGuide}
                    className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
                    title="Guide"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                )}
                {onOpenEnvironments && (
                  <button
                    onClick={onOpenEnvironments}
                    className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
                    title="Environments"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                )}
                {onToggleFullscreen && (
                  <button
                    onClick={onToggleFullscreen}
                    className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
                    title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                  >
                    {isFullscreen ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </button>
                )}
                <div className="mx-1 h-4 w-px bg-white/10" />
              </>
            )}

            {/* New session button */}
            <button
              onClick={onNewSession}
              disabled={agents.length === 0}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg font-medium transition-all',
                agents.length === 0
                  ? 'cursor-not-allowed bg-white/10 text-white/30'
                  : 'bg-white text-black shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] hover:bg-white/90 active:scale-[0.98]',
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
