'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal as TerminalIcon, Zap, Clock, ArrowRight, RefreshCw } from 'lucide-react';
import { type SessionInfo } from '@/lib/notifications';
import { type SessionStatus, type AttentionReason } from '@claude-remote/shared';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/time';

interface SessionPreviewPopoverProps {
  session: SessionInfo | null;
  position: { x: number; y: number };
  agentUrl: string;
}

interface TerminalSnapshot {
  lines: string[];
  timestamp: number;
}

const statusColors: Record<SessionStatus, string> = {
  init: 'text-purple-400 bg-purple-500/20',
  working: 'text-blue-400 bg-blue-500/20',
  needs_attention: 'text-orange-400 bg-orange-500/20',
  idle: 'text-gray-400 bg-gray-500/20',
};

const statusLabels: Record<SessionStatus, string> = {
  init: 'Starting',
  working: 'Working',
  needs_attention: 'Attention',
  idle: 'Idle',
};

const attentionLabels: Record<AttentionReason, string> = {
  permission: 'Permission',
  input: 'Waiting',
  plan_approval: 'Plan Ready',
  task_complete: 'Done',
};

const REFRESH_INTERVAL = 2000; // Refresh every 2 seconds while hovering

export function SessionPreviewPopover({
  session,
  position,
  agentUrl,
}: SessionPreviewPopoverProps) {
  const [snapshot, setSnapshot] = useState<TerminalSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasSnapshotRef = useRef(false);

  const fetchPreview = useCallback(
    async (sessionName: string, isRefresh = false) => {
      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const protocol = agentUrl.includes('localhost') ? 'http' : 'https';
        const response = await fetch(
          `${protocol}://${agentUrl}/api/sessions/${encodeURIComponent(sessionName)}/preview`,
          {
            signal: controller.signal,
          }
        );

        if (response.ok) {
          const data = await response.json();
          setSnapshot({
            lines: data.lines || [],
            timestamp: Date.now(),
          });
          hasSnapshotRef.current = true;
        }
      } catch (err) {
        // Only set fallback if it's not an abort error and we don't have existing data
        if (err instanceof Error && err.name !== 'AbortError' && !hasSnapshotRef.current) {
          // Keep existing snapshot if we have one, otherwise don't update
        }
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [agentUrl]
  );

  useEffect(() => {
    if (!session) {
      setSnapshot(null);
      hasSnapshotRef.current = false;
      // Clear any pending operations
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      return;
    }

    // Debounce the initial fetch
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    fetchTimeoutRef.current = setTimeout(() => {
      fetchPreview(session.name, false);

      // Set up auto-refresh while hovering
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }

      refreshIntervalRef.current = setInterval(() => {
        fetchPreview(session.name, true);
      }, REFRESH_INTERVAL);
    }, 100);

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [session, fetchPreview]);

  if (!session) return null;

  const status = session.status as SessionStatus;
  const attentionReason = session.attentionReason as AttentionReason | undefined;
  const displayName = session.name.split('--')[1] || session.name;

  // Use attention-specific label if available
  const label = status === 'needs_attention' && attentionReason
    ? attentionLabels[attentionReason]
    : statusLabels[status] || status;

  return (
    <AnimatePresence>
      {session && (
        <motion.div
          initial={{ opacity: 0, x: -8, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -8, scale: 0.96 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            left: position.x,
            top: Math.max(16, Math.min(position.y, window.innerHeight - 320)),
            zIndex: 100,
          }}
          className="pointer-events-none"
        >
          <div
            className={cn(
              'w-96 rounded-xl overflow-hidden',
              'bg-[#0a0a10]/95 backdrop-blur-xl',
              'border border-white/10',
              'shadow-2xl shadow-black/50'
            )}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/5 bg-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TerminalIcon className="w-4 h-4 text-white/50" />
                  <span className="font-medium text-sm text-white">{displayName}</span>
                </div>
                <div className="flex items-center gap-2">
                  {isRefreshing && (
                    <RefreshCw className="w-3 h-3 text-white/30 animate-spin" />
                  )}
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      statusColors[status]
                    )}
                  >
                    {label}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-white/40">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatRelativeTime(session.createdAt)}
                </span>
                <span>{session.project}</span>
                {session.statusSource === 'hook' && (
                  <span className="flex items-center gap-0.5 text-emerald-400/60">
                    <Zap className="w-3 h-3" />
                    Live
                  </span>
                )}
              </div>
            </div>

            {/* Terminal Preview */}
            <div className="p-2">
              <div
                className={cn(
                  'h-48 rounded-lg overflow-hidden',
                  'bg-[#0a0a10] font-mono text-xs leading-relaxed',
                  'p-3 overflow-y-auto',
                  'border border-white/5'
                )}
              >
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="flex items-center gap-2 text-white/30">
                      <div className="w-4 h-4 border-2 border-white/20 border-t-orange-500 rounded-full animate-spin" />
                      <span>Loading preview...</span>
                    </div>
                  </div>
                ) : snapshot?.lines.length ? (
                  <div className="space-y-0.5">
                    {snapshot.lines.map((line, i) => (
                      <div
                        key={i}
                        className="text-white/80 whitespace-pre overflow-hidden text-ellipsis"
                        dangerouslySetInnerHTML={{
                          __html: parseAnsiToHtml(line),
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-white/30">
                    <span>No output yet</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer hint */}
            <div className="px-4 py-2 border-t border-white/5 bg-white/5">
              <div className="flex items-center justify-between text-xs text-white/40">
                <span>Click to connect</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Enhanced ANSI to HTML parser for terminal colors
function parseAnsiToHtml(text: string): string {
  const colorMap: Record<string, string> = {
    '0': '', // reset
    '1': 'font-weight: bold',
    '2': 'opacity: 0.7',
    '3': 'font-style: italic',
    '4': 'text-decoration: underline',
    '30': 'color: #3f3f46',
    '31': 'color: #f87171',
    '32': 'color: #4ade80',
    '33': 'color: #fbbf24',
    '34': 'color: #60a5fa',
    '35': 'color: #c084fc',
    '36': 'color: #22d3ee',
    '37': 'color: #e4e4e7',
    '38': '', // extended color (skip for now)
    '39': '', // default foreground
    '90': 'color: #71717a',
    '91': 'color: #fca5a5',
    '92': 'color: #86efac',
    '93': 'color: #fde047',
    '94': 'color: #93c5fd',
    '95': 'color: #d8b4fe',
    '96': 'color: #67e8f9',
    '97': 'color: #fafafa',
  };

  // Escape HTML
  let result = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Parse ANSI codes
  result = result.replace(/\x1b\[([0-9;]+)m/g, (_, codes) => {
    const codeList = codes.split(';');

    // Handle reset
    if (codeList.includes('0')) {
      return '</span>';
    }

    const styles: string[] = [];
    for (const code of codeList) {
      if (colorMap[code]) {
        styles.push(colorMap[code]);
      }
    }

    if (styles.length > 0) {
      return `<span style="${styles.join('; ')}">`;
    }
    return '';
  });

  // Handle simple reset codes
  result = result.replace(/\x1b\[0m/g, '</span>');

  return result;
}
