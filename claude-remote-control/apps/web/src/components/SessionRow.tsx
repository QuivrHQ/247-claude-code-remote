'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { StatusBadge, type SessionStatus } from '@/components/ui/status-badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { formatTimeAgo } from '@/lib/time';
import { Trash2, Loader2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
  onKill: () => Promise<void> | void;
}

export function SessionRow({ session, onConnect, onKill }: SessionRowProps) {
  const [showKillConfirm, setShowKillConfirm] = useState(false);
  const [isKilling, setIsKilling] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const timeAgo = formatTimeAgo(new Date(session.createdAt));

  const handleKill = async () => {
    setIsKilling(true);
    try {
      await onKill();
      setShowKillConfirm(false);
    } finally {
      setIsKilling(false);
    }
  };

  const handleConnect = () => {
    setIsConnecting(true);
    onConnect();
  };

  return (
    <>
      <div
        role="listitem"
        className="flex items-center gap-3 p-3 bg-background/50 rounded-lg hover:bg-accent/30 transition-colors group"
      >
        {/* Status Indicator */}
        <StatusBadge status={session.status} />

        {/* Hook Status Indicator */}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={`cursor-help ${session.statusSource === 'hook' ? 'text-green-400' : 'text-muted-foreground'}`}
              >
                {session.statusSource === 'hook' ? '⚡' : '○'}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>
                {session.statusSource === 'hook'
                  ? 'Hooks active - real-time status'
                  : 'Using tmux fallback - status may be delayed'}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

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
            onClick={handleConnect}
            disabled={isConnecting}
            size="sm"
            className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 transition-colors"
            aria-label={`Connect to ${session.project} session`}
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
                Connecting...
              </>
            ) : (
              'Connect'
            )}
          </Button>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              setShowKillConfirm(true);
            }}
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/20 opacity-0 group-hover:opacity-100 transition-all"
            aria-label={`Terminate session ${session.name}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={showKillConfirm}
        onOpenChange={setShowKillConfirm}
        title="Terminate session?"
        description={`This will stop the session "${session.name}" for project "${session.project}". This action cannot be undone.`}
        confirmText="Terminate"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleKill}
        isLoading={isKilling}
      />
    </>
  );
}
