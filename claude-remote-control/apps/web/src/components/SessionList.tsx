'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SessionRow } from './SessionRow';
import { type SessionStatus } from '@/components/ui/status-badge';
import { Plus } from 'lucide-react';

interface SessionInfo {
  name: string;
  project: string;
  createdAt: number;
  status: SessionStatus;
  statusSource?: 'hook' | 'tmux';
  lastActivity?: string;
  lastEvent?: string;
}

interface SessionListProps {
  sessions: SessionInfo[];
  projects: string[];
  loading: boolean;
  error: string | null;
  onConnect: (project: string, sessionName?: string) => void;
  onKill: (sessionName: string) => void;
}

function SessionSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 bg-background/50 rounded-lg">
      <Skeleton className="h-6 w-20" />
      <Skeleton className="h-4 w-4 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-8 w-20" />
    </div>
  );
}

export function SessionList({
  sessions,
  projects,
  loading,
  error,
  onConnect,
  onKill,
}: SessionListProps) {
  const [newSessionProject, setNewSessionProject] = useState(projects[0] || '');

  if (loading) {
    return (
      <div className="p-4 space-y-3" aria-busy="true" aria-label="Loading sessions">
        <SessionSkeleton />
        <SessionSkeleton />
        <SessionSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center" role="alert">
        <span className="text-destructive">
          <span className="mr-2" aria-hidden="true">⚠</span>
          {error}
        </span>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {/* New Session Row */}
      <div className="flex items-center gap-2 p-3 bg-card rounded-lg border border-dashed border-border">
        <Plus className="w-5 h-5 text-green-500" aria-hidden="true" />
        <label htmlFor="project-select" className="sr-only">
          Select project for new session
        </label>
        <select
          id="project-select"
          value={newSessionProject}
          onChange={(e) => setNewSessionProject(e.target.value)}
          className="flex-1 bg-secondary text-foreground px-3 py-1.5 rounded border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {projects.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <Button
          onClick={() => onConnect(newSessionProject)}
          size="sm"
          className="bg-green-600 hover:bg-green-700"
        >
          New Session
        </Button>
      </div>

      {/* Existing Sessions */}
      {sessions.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-4">
          No active sessions. Create one to get started.
        </p>
      ) : (
        <div role="list" aria-label="Active sessions" className="space-y-2">
          {sessions
            .sort((a, b) => b.createdAt - a.createdAt)
            .map((session) => (
              <SessionRow
                key={session.name}
                session={session}
                onConnect={() => onConnect(session.project, session.name)}
                onKill={() => onKill(session.name)}
              />
            ))}
        </div>
      )}
    </div>
  );
}
