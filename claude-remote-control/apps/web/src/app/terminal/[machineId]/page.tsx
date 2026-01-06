'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Terminal } from '@/components/Terminal';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
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
        <header className="p-4 bg-card flex items-center gap-4 border-b border-border">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-40" />
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
      <header className="p-4 bg-card flex items-center gap-4 border-b border-border">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground transition flex items-center gap-1"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="sr-only sm:not-sr-only">Back</span>
        </Link>

        <h1 className="text-xl font-bold">{machine.name}</h1>

        <label htmlFor="project-select" className="sr-only">Select project</label>
        <select
          id="project-select"
          value={selectedProject}
          onChange={(e) => {
            setSelectedProject(e.target.value);
            setSelectedSession('');
          }}
          className="bg-secondary text-foreground px-3 py-1.5 rounded border border-border focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {projects.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        {sessions.length > 0 && (
          <>
            <span className="text-muted-foreground" aria-hidden="true">|</span>
            <label htmlFor="session-select" className="sr-only">Select session</label>
            <select
              id="session-select"
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="bg-secondary text-foreground px-3 py-1.5 rounded border border-border focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">New session</option>
              {sessions.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.project} ({s.status})
                </option>
              ))}
            </select>
          </>
        )}
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
