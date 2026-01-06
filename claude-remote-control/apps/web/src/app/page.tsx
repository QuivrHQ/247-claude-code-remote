'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MachineCard } from '@/components/MachineCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Monitor } from 'lucide-react';

interface Machine {
  id: string;
  name: string;
  status: string;
  tunnelUrl: string | null;
  config?: {
    projects: string[];
    agentUrl?: string;
  };
  lastSeen: string | null;
  createdAt: string;
}

function MachineCardSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-5 h-5" />
        <Skeleton className="w-10 h-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded" />
          <Skeleton className="h-6 w-16 rounded" />
        </div>
      </div>
    </Card>
  );
}

export default function Home() {
  const router = useRouter();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMachines = async () => {
      try {
        const response = await fetch('/api/machines');
        const data = await response.json();
        setMachines(data);
      } catch (err) {
        console.error('Failed to fetch machines:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMachines();

    // Refresh machine list every 30 seconds
    const interval = setInterval(fetchMachines, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleConnect = (machineId: string, project: string, sessionName?: string) => {
    const sessionParam = sessionName ? `&session=${encodeURIComponent(sessionName)}` : '';
    router.push(
      `/terminal/${machineId}?project=${encodeURIComponent(project)}${sessionParam}`
    );
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Claude Remote Control</h1>
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {machines.filter((m) => m.status === 'online').length} / {machines.length} online
          </span>
        </header>

        {loading ? (
          <div className="space-y-4" aria-busy="true" aria-label="Loading machines">
            <MachineCardSkeleton />
            <MachineCardSkeleton />
          </div>
        ) : machines.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
              <Monitor className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-muted-foreground mb-2">No machines registered yet</p>
            <p className="text-sm text-muted-foreground/70">Start an agent to register a machine</p>
          </div>
        ) : (
          <div className="space-y-4" role="list" aria-label="Registered machines">
            {machines.map((machine) => (
              <MachineCard key={machine.id} machine={machine} onConnect={handleConnect} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
