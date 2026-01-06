'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EditorStatus } from '@claude-remote/shared';

interface EditorProps {
  agentUrl: string;
  project: string;
  onStatusChange?: (status: EditorStatus) => void;
}

export function Editor({ agentUrl, project, onStatusChange }: EditorProps) {
  const [status, setStatus] = useState<EditorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // Build editor URL - direct access to code-server port when available
  const buildEditorUrl = useCallback(() => {
    // If we have the port from status, access code-server directly (works in local dev)
    if (status?.port && agentUrl.includes('localhost')) {
      return `http://127.0.0.1:${status.port}/`;
    }
    // Fallback to proxy (for remote access via tunnel)
    const protocol = agentUrl.includes('localhost') ? 'http' : 'https';
    return `${protocol}://${agentUrl}/editor/${encodeURIComponent(project)}/`;
  }, [agentUrl, project, status?.port]);

  // Fetch editor status
  const fetchStatus = useCallback(async () => {
    try {
      const protocol = agentUrl.includes('localhost') ? 'http' : 'https';
      const response = await fetch(
        `${protocol}://${agentUrl}/api/editor/${encodeURIComponent(project)}/status`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch editor status: ${response.statusText}`);
      }

      const data: EditorStatus = await response.json();
      setStatus(data);
      onStatusChange?.(data);
      setError(null);
      return data;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [agentUrl, project, onStatusChange]);

  // Start editor
  const startEditor = useCallback(async () => {
    setStarting(true);
    setError(null);

    try {
      const protocol = agentUrl.includes('localhost') ? 'http' : 'https';
      const response = await fetch(
        `${protocol}://${agentUrl}/api/editor/${encodeURIComponent(project)}/start`,
        { method: 'POST' }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start editor');
      }

      // Wait a bit for code-server to be ready
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Fetch updated status
      await fetchStatus();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStarting(false);
    }
  }, [agentUrl, project, fetchStatus]);

  // Initial status fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Auto-start editor if not running
  useEffect(() => {
    if (!loading && status && !status.running && !starting && !error) {
      startEditor();
    }
  }, [loading, status, starting, error, startEditor]);

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 bg-[#0a0a10] gap-4">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        <span className="text-white/60 text-sm">Checking editor status...</span>
      </div>
    );
  }

  // Starting state
  if (starting || (status && !status.running)) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 bg-[#0a0a10] gap-4">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        <span className="text-white/60 text-sm">Starting VS Code...</span>
        <span className="text-white/40 text-xs">This may take a few seconds</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 bg-[#0a0a10] gap-4 p-8">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-6 h-6" />
          <span className="font-medium">Failed to load editor</span>
        </div>
        <p className="text-white/40 text-sm text-center max-w-md">{error}</p>
        <button
          onClick={() => {
            setError(null);
            setLoading(true);
            fetchStatus();
          }}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg',
            'bg-white/10 hover:bg-white/15 text-white/80 hover:text-white',
            'transition-colors'
          )}
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  // Editor iframe
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Toolbar */}
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-2',
          'bg-[#0d0d14]/80 backdrop-blur-sm',
          'border-b border-white/5'
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white/60">{project}</span>
          <span className="text-white/20">/</span>
          <span className="text-sm text-emerald-400">VS Code</span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2 text-xs text-white/40">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Running on port {status?.port}</span>
        </div>
      </div>

      {/* VS Code iframe */}
      <iframe
        src={buildEditorUrl()}
        className="flex-1 w-full border-0 bg-[#1e1e1e]"
        title={`VS Code - ${project}`}
        allow="clipboard-read; clipboard-write"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      />
    </div>
  );
}
