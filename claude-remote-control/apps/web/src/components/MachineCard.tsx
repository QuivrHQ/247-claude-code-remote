'use client';

import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { CountBadge, type SessionStatus } from '@/components/ui/status-badge';
import { SessionList } from './SessionList';
import { ChevronRight, Monitor, Zap, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface Machine {
  id: string;
  name: string;
  status: string;
  config?: {
    projects: string[];
    agentUrl?: string;
  };
}

interface SessionInfo {
  name: string;
  project: string;
  createdAt: number;
  status: SessionStatus;
  statusSource?: 'hook' | 'tmux';
  lastActivity?: string;
  lastEvent?: string;
}

interface MachineCardProps {
  machine: Machine;
  onConnect: (machineId: string, project: string, sessionName?: string) => void;
}

export function MachineCard({ machine, onConnect }: MachineCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevSessionsRef = useRef<SessionInfo[]>([]);

  const isOnline = machine.status === 'online';
  const agentUrl = machine.config?.agentUrl || 'localhost:4678';
  const projects = machine.config?.projects || [];

  useEffect(() => {
    if (!expanded || !isOnline) return;

    const fetchSessions = async () => {
      setLoading(true);
      setError(null);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const protocol = agentUrl.includes('localhost') ? 'http' : 'https';
        const response = await fetch(`${protocol}://${agentUrl}/api/sessions`, {
          signal: controller.signal,
        });

        if (!response.ok) throw new Error('Failed to fetch sessions');

        const data = await response.json();
        setSessions(data);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          setError('Agent not responding');
        } else {
          setError('Could not connect to agent');
        }
        setSessions([]);
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    };

    fetchSessions();
    const interval = setInterval(fetchSessions, 10000);
    return () => clearInterval(interval);
  }, [expanded, isOnline, agentUrl]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const prev = prevSessionsRef.current;

    for (const session of sessions) {
      const prevSession = prev.find((s) => s.name === session.name);
      const wasNotActionable = !prevSession || !['permission', 'stopped', 'waiting'].includes(prevSession.status);
      const isActionable = ['permission', 'stopped', 'waiting'].includes(session.status);

      if (wasNotActionable && isActionable) {
        showNotification(session);
      }
    }

    prevSessionsRef.current = [...sessions];
  }, [sessions]);

  function showNotification(session: SessionInfo) {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const body =
      session.status === 'permission'
        ? 'Autorisation requise'
        : session.status === 'waiting'
          ? 'Question posée'
          : 'Tâche terminée';

    new Notification(`${machine.name} - ${session.project}`, {
      body,
      icon: '/favicon.ico',
      tag: `${session.name}-${session.status}`,
    });
  }

  const handleKillSession = async (sessionName: string) => {
    const protocol = agentUrl.includes('localhost') ? 'http' : 'https';

    try {
      const response = await fetch(
        `${protocol}://${agentUrl}/api/sessions/${encodeURIComponent(sessionName)}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        setSessions((prev) => prev.filter((s) => s.name !== sessionName));
        toast.success('Session terminated');
      } else {
        toast.error('Failed to terminate session');
      }
    } catch (err) {
      console.error('Failed to kill session:', err);
      toast.error('Could not connect to agent');
    }
  };

  const runningCount = sessions.filter((s) => s.status === 'running').length;
  const waitingCount = sessions.filter((s) => s.status === 'waiting').length;
  const permissionCount = sessions.filter((s) => s.status === 'permission').length;
  const doneCount = sessions.filter((s) => s.status === 'stopped').length;
  const hooksActive = sessions.some((s) => s.statusSource === 'hook');

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-lg hover:shadow-primary/5">
      {/* Card Header - Clickable to expand */}
      <button
        onClick={() => isOnline && setExpanded(!expanded)}
        disabled={!isOnline}
        aria-expanded={expanded}
        aria-controls={`machine-${machine.id}-sessions`}
        aria-label={`${machine.name}, ${isOnline ? 'online' : 'offline'}${sessions.length > 0 ? `, ${sessions.length} sessions` : ''}`}
        className={`w-full p-4 flex items-center gap-3 text-left transition-all duration-200
          ${isOnline
            ? 'hover:bg-accent/50 active:bg-accent cursor-pointer'
            : 'opacity-50 cursor-not-allowed'
          }`}
      >
        {/* Expand/Collapse Icon */}
        <ChevronRight
          className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
          aria-hidden="true"
        />

        {/* Machine Icon */}
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors
          ${isOnline ? 'bg-primary/10' : 'bg-secondary'}`}>
          <Monitor
            className={`w-5 h-5 ${isOnline ? 'text-primary' : 'text-muted-foreground'}`}
            aria-hidden="true"
          />
        </div>

        {/* Machine Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate">{machine.name}</span>
            <span
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                isOnline
                  ? 'bg-green-500 shadow-sm shadow-green-500/50'
                  : 'bg-destructive'
              }`}
              role="status"
              aria-label={isOnline ? 'Online' : 'Offline'}
            />
          </div>
          <p className="text-sm text-muted-foreground truncate font-mono">{agentUrl}</p>
        </div>

        {/* Session Badges */}
        {isOnline && sessions.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap justify-end" aria-label="Session counts">
            <CountBadge status="running" count={runningCount} />
            <CountBadge status="waiting" count={waitingCount} />
            <CountBadge status="permission" count={permissionCount} />
            <CountBadge status="stopped" count={doneCount} />

            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  {hooksActive ? (
                    <span className="px-2 py-0.5 bg-green-500/15 text-green-300 border border-green-500/40 rounded text-xs font-medium flex items-center gap-1 cursor-help">
                      <Zap className="w-3 h-3" />
                      hooks
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-yellow-500/15 text-yellow-300 border border-yellow-500/40 rounded text-xs font-medium flex items-center gap-1 cursor-help">
                      <AlertTriangle className="w-3 h-3" />
                      no hooks
                    </span>
                  )}
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="font-medium">
                    {hooksActive ? 'Hooks Active' : 'Hooks Not Configured'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {hooksActive
                      ? 'Real-time status updates enabled'
                      : 'Using tmux fallback - status may be delayed'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </button>

      {/* Expanded Session List */}
      {expanded && isOnline && (
        <div
          id={`machine-${machine.id}-sessions`}
          className="border-t border-border bg-background/50"
        >
          <SessionList
            sessions={sessions}
            projects={projects}
            loading={loading}
            error={error}
            onConnect={(project, sessionName) => onConnect(machine.id, project, sessionName)}
            onKill={handleKillSession}
          />
        </div>
      )}
    </Card>
  );
}
