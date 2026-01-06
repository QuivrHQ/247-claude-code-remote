'use client';

import { useEffect } from 'react';
import { TerminalSquare, Code } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ActiveTab = 'terminal' | 'editor';

interface EditorTerminalTabsProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  editorEnabled?: boolean;
}

export function EditorTerminalTabs({
  activeTab,
  onTabChange,
  editorEnabled = true,
}: EditorTerminalTabsProps) {
  // Keyboard shortcuts: Option+T for terminal, Option+E for editor
  // Use e.code because Option+key produces special chars on Mac
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && !e.metaKey && !e.ctrlKey) {
        if (e.code === 'KeyT') {
          e.preventDefault();
          onTabChange('terminal');
        } else if (e.code === 'KeyE' && editorEnabled) {
          e.preventDefault();
          onTabChange('editor');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTabChange, editorEnabled]);

  return (
    <div
      className={cn(
        'flex items-center gap-1 px-2 py-1.5',
        'bg-[#0d0d14] border-b border-white/5'
      )}
    >
      {/* Terminal Tab */}
      <button
        onClick={() => onTabChange('terminal')}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-md',
          'text-sm font-medium transition-all',
          activeTab === 'terminal'
            ? 'bg-white/10 text-white'
            : 'text-white/50 hover:text-white/80 hover:bg-white/5'
        )}
      >
        <TerminalSquare className="w-4 h-4" />
        <span>Terminal</span>
        <kbd
          className={cn(
            'ml-1 px-1.5 py-0.5 rounded text-[10px] font-mono',
            activeTab === 'terminal'
              ? 'bg-white/10 text-white/60'
              : 'bg-white/5 text-white/30'
          )}
        >
          ⌥T
        </kbd>
      </button>

      {/* Editor Tab */}
      {editorEnabled && (
        <button
          onClick={() => onTabChange('editor')}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-md',
            'text-sm font-medium transition-all',
            activeTab === 'editor'
              ? 'bg-white/10 text-white'
              : 'text-white/50 hover:text-white/80 hover:bg-white/5'
          )}
        >
          <Code className="w-4 h-4" />
          <span>Editor</span>
          <kbd
            className={cn(
              'ml-1 px-1.5 py-0.5 rounded text-[10px] font-mono',
              activeTab === 'editor'
                ? 'bg-white/10 text-white/60'
                : 'bg-white/5 text-white/30'
            )}
          >
            ⌥E
          </kbd>
        </button>
      )}
    </div>
  );
}
