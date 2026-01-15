'use client';

import { FolderOpen, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TabType = 'select' | 'clone';

interface TabButtonsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export function TabButtons({ activeTab, onTabChange }: TabButtonsProps) {
  return (
    <div className="mb-4 flex gap-2">
      <button
        onClick={() => onTabChange('select')}
        className={cn(
          'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
          activeTab === 'select'
            ? 'border border-orange-500/30 bg-orange-500/20 text-orange-400'
            : 'border border-transparent bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
        )}
      >
        <FolderOpen className="h-4 w-4" />
        Select Folder
      </button>
      <button
        onClick={() => onTabChange('clone')}
        className={cn(
          'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
          activeTab === 'clone'
            ? 'border border-orange-500/30 bg-orange-500/20 text-orange-400'
            : 'border border-transparent bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
        )}
      >
        <GitBranch className="h-4 w-4" />
        Clone Repo
      </button>
    </div>
  );
}
