'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Terminal } from '@/components/Terminal';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, AlertTriangle, Monitor } from 'lucide-react';
import Link from 'next/link';

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
  status: string;
}

export default function TerminalPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const machineId = params.machineId as string;

  const urlProject = searchParams.get('project');
  const urlSession = searchParams.get('session');

  const [machine, setMachine] = useState<Machine | null>(null);
  const [projects, setProjects] = useState<string[]>([]);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>(urlProject || '');
  const [selectedSession, setSelectedSession] = useState<string>(urlSession || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const agentUrl = machine?.config?.agentUrl || 'localhost:4678';

  useEffect(() => {
    fetch(`/api/machines/${machineId}`)
      .then((r) => {
        if (!r.ok) throw new Error('Machine not found');
        return r.json();
      })
      .then((data) => {
        setMachine(data);
        if (!urlProject && data.config?.projects?.length > 0) {
          setSelectedProject(data.config.projects[0]);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [machineId, urlProject]);

  useEffect(() => {
    if (!machine) return;

    const url = machine.config?.agentUrl || 'localhost:4678';
    const protocol = url.includes('localhost') ? 'http' : 'https';

    fetch(`${protocol}://${url}/api/projects`)
      .then((r) => r.json())
      .then((p: string[]) => {
        setProjects(p);
        if (!selectedProject && p.length > 0) {
          setSelectedProject(p[0]);
        }
      })
      .catch(console.error);

    fetch(`${protocol}://${url}/api/sessions`)
      .then((r) => r.json())
      .then((s: SessionInfo[]) => setSessions(s))
      .catch(() => setSessions([]));
  }, [machine, selectedProject]);

  if (loading) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <header className="bg-card border-b border-border">
          <div className="px-4 py-3 flex items-center gap-4 border-b border-border/50">
            <Skeleton className="h-6 w-16" />
            <div className="h-5 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Skeleton className="w-8 h-8 rounded-lg" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="flex-1" />
            <Skeleton className="h-7 w-24 rounded-full" />
          </div>
          <div className="px-4 py-2.5 flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-8 w-44 rounded-md" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-8 w-44 rounded-md" />
            </div>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <Skeleton className="h-4 w-48 mx-auto" />
            <Skeleton className="h-4 w-32 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !machine) {
    return (
      <div className="h-screen flex items-center justify-center bg-background p-4">
        <Card className="p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Machine not found</h2>
          <p className="text-muted-foreground mb-4">
            {error || 'The machine you are looking for does not exist or is unavailable.'}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="bg-card border-b border-border">
        {/* Top row: Navigation & Machine info */}
        <div className="px-4 py-3 flex items-center gap-4 border-b border-border/50">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors flex items-center gap-2 px-2 py-1 rounded-md -ml-2"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back</span>
          </Link>

          <div className="h-5 w-px bg-border" aria-hidden="true" />

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Monitor className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">{machine.name}</h1>
              <p className="text-xs text-muted-foreground font-mono">{agentUrl}</p>
            </div>
          </div>

          <div className="flex-1" />

          {/* Connection status */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-full">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-green-400">Connected</span>
          </div>
        </div>

        {/* Bottom row: Project & Session selectors */}
        <div className="px-4 py-2.5 flex items-center gap-6 bg-card/50">
          <div className="flex items-center gap-2">
            <label
              htmlFor="project-select"
              className="text-sm font-medium text-muted-foreground"
            >
              Project:
            </label>
            <select
              id="project-select"
              value={selectedProject}
              onChange={(e) => {
                setSelectedProject(e.target.value);
                setSelectedSession('');
              }}
              className="bg-secondary hover:bg-secondary/80 text-foreground px-3 py-1.5 rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-ring transition-colors min-w-[180px]"
            >
              {projects.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor="session-select"
              className="text-sm font-medium text-muted-foreground"
            >
              Session:
            </label>
            <select
              id="session-select"
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="bg-secondary hover:bg-secondary/80 text-foreground px-3 py-1.5 rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-ring transition-colors min-w-[180px]"
            >
              <option value="">+ New session</option>
              {sessions.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.project} ({s.status})
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {selectedProject && (
        <Terminal
          agentUrl={agentUrl}
          project={selectedProject}
          sessionName={selectedSession || undefined}
        />
      )}
    </div>
  );
}
