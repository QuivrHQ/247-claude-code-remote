'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MachineCard } from '@/components/MachineCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Monitor, Search, RefreshCw } from 'lucide-react';
import { formatTimeAgo } from '@/lib/time';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchMachines = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setIsRefreshing(true);
    try {
      const response = await fetch('/api/machines');
      const data = await response.json();
      setMachines(data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to fetch machines:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMachines();
    const interval = setInterval(() => fetchMachines(), 30000);
    return () => clearInterval(interval);
  }, [fetchMachines]);

  // Update "time ago" display every 10 seconds
  const [, forceUpdate] = useState({});
  useEffect(() => {
    const interval = setInterval(() => forceUpdate({}), 10000);
    return () => clearInterval(interval);
  }, []);

  const handleConnect = (machineId: string, project: string, sessionName?: string) => {
    const sessionParam = sessionName ? `&session=${encodeURIComponent(sessionName)}` : '';
    router.push(
      `/terminal/${machineId}?project=${encodeURIComponent(project)}${sessionParam}`
    );
  };

  // Filter machines by search query
  const filteredMachines = machines.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onlineCount = machines.filter((m) => m.status === 'online').length;

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold">Claude Remote Control</h1>
            <div className="text-right">
              <p className="text-sm font-medium" aria-live="polite">
                <span className="text-green-400">{onlineCount}</span>
                <span className="text-muted-foreground"> / {machines.length} online</span>
              </p>
              <button
                onClick={() => fetchMachines(true)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 ml-auto"
                aria-label="Refresh machines list"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                Updated {formatTimeAgo(lastRefresh)}
              </button>
            </div>
          </div>

          {/* Search */}
          {machines.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search machines..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-secondary/50 border-border focus:bg-secondary"
                aria-label="Search machines by name"
              />
            </div>
          )}
        </header>

        {/* Content */}
        {loading ? (
          <div className="space-y-4" aria-busy="true" aria-label="Loading machines">
            <MachineCardSkeleton />
            <MachineCardSkeleton />
          </div>
        ) : machines.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
              <Monitor className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-semibold mb-2">No machines registered</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Start a local agent to register your first machine.
            </p>
            <code className="text-xs bg-secondary px-3 py-2 rounded block max-w-xs mx-auto">
              pnpm dev:agent
            </code>
          </Card>
        ) : filteredMachines.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              No machines matching &quot;{searchQuery}&quot;
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="text-sm text-primary hover:underline mt-2"
            >
              Clear search
            </button>
          </Card>
        ) : (
          <div className="space-y-4" role="list" aria-label="Registered machines">
            {filteredMachines.map((machine) => (
              <MachineCard key={machine.id} machine={machine} onConnect={handleConnect} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
