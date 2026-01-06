'use client';

import { Button } from '@/components/ui/button';
import { StatusBadge, type SessionStatus } from '@/components/ui/status-badge';
import { formatTimeAgo } from '@/lib/time';
import { Trash2 } from 'lucide-react';

interface SessionInfo {
  name: string;
  project: string;
  createdAt: number;
  status: SessionStatus;
  statusSource?: 'hook' | 'tmux';
  lastActivity?: string;
  lastEvent?: string;
}

interface SessionRowProps {
  session: SessionInfo;
  onConnect: () => void;
  onKill: () => void;
}

export function SessionRow({ session, onConnect, onKill }: SessionRowProps) {
  const timeAgo = formatTimeAgo(new Date(session.createdAt));

  return (
    <div
      role="listitem"
      className="flex items-center gap-3 p-3 bg-background/50 rounded-lg hover:bg-background transition group"
    >
      {/* Status Indicator */}
      <StatusBadge status={session.status} />

      {/* Hook Status Indicator */}
      <span
        title={session.statusSource === 'hook' ? 'Hooks actifs' : 'Fallback tmux'}
        aria-label={session.statusSource === 'hook' ? 'Hooks active' : 'Using tmux fallback'}
        className={session.statusSource === 'hook' ? 'text-green-400' : 'text-muted-foreground'}
      >
        {session.statusSource === 'hook' ? '⚡' : '○'}
      </span>

      {/* Project Name & Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{session.project}</p>
        <p className="text-xs text-muted-foreground truncate">
          {timeAgo}
          {session.lastActivity && ` · ${session.lastActivity.slice(0, 30)}...`}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          onClick={onConnect}
          size="sm"
          className="bg-blue-600 hover:bg-blue-700"
          aria-label={`Connect to ${session.project} session`}
        >
          Connect
        </Button>
        <Button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Kill session "${session.name}"?`)) {
              onKill();
            }
          }}
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/20 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label={`Kill session ${session.name}`}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
