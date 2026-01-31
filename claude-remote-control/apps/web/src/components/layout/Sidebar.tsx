'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Monitor,
  Globe,
  Cloud,
  Wifi,
  ChevronRight,
  Plus,
  FolderOpen,
  PanelLeftClose,
  PanelLeft,
  Pencil,
  Trash2,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
import { variants, spring, stagger } from '@/lib/animations';
import { StatusDot, type ConnectionStatus } from '@/components/ui/status-indicator';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface SidebarMachine {
  id: string;
  name: string;
  type: 'localhost' | 'tailscale' | 'fly' | 'custom';
  status: ConnectionStatus;
  sessionCount: number;
  url?: string;
  color?: string;
}

export interface SidebarProject {
  name: string;
  path: string;
  activeSessionCount: number;
}

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  machines?: SidebarMachine[];
  projects?: SidebarProject[];
  selectedMachineId?: string | null;
  onSelectMachine?: (id: string) => void;
  onAddMachine?: () => void;
  onSelectProject?: (projectName: string) => void;
  selectedProjectName?: string | null;
  onEditMachine?: (machine: SidebarMachine) => void;
  onRemoveMachine?: (machine: SidebarMachine) => void;
  canRemoveMachine?: (machine: SidebarMachine) => boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// Machine Icon Component
// ═══════════════════════════════════════════════════════════════════════════

function MachineIcon({ type, className }: { type: SidebarMachine['type']; className?: string }) {
  const icons = {
    localhost: Monitor,
    tailscale: Globe,
    fly: Cloud,
    custom: Wifi,
  };
  const Icon = icons[type];
  return <Icon className={className} />;
}

// ═══════════════════════════════════════════════════════════════════════════
// Section Component
// ═══════════════════════════════════════════════════════════════════════════

interface SectionProps {
  title: string;
  children: React.ReactNode;
  collapsed?: boolean;
  defaultExpanded?: boolean;
  action?: React.ReactNode;
}

function Section({ title, children, collapsed, defaultExpanded = true, action }: SectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (collapsed) {
    return <div className="py-2">{children}</div>;
  }

  return (
    <div className="py-1">
      {/* Section Header */}
      <div
        className={cn(
          'flex w-full items-center justify-between',
          'px-3 py-2 text-xs font-semibold uppercase tracking-wider',
          'text-foreground-subtle hover:text-foreground-muted',
          'transition-colors duration-150'
        )}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 hover:text-foreground-muted"
        >
          <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={spring.snappy}>
            <ChevronRight className="h-3 w-3" />
          </motion.div>
          <span>{title}</span>
        </button>
        {action}
      </div>

      {/* Section Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={variants.collapse}
            transition={spring.gentle}
            className="overflow-hidden"
          >
            <motion.div
              variants={stagger.fast}
              initial="initial"
              animate="animate"
              className="px-2 pb-1"
            >
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Machine Item Component
// ═══════════════════════════════════════════════════════════════════════════

interface MachineItemProps {
  machine: SidebarMachine;
  collapsed?: boolean;
  selected?: boolean;
  onClick?: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
  canRemove?: boolean;
}

function MachineItem({
  machine,
  collapsed,
  selected,
  onClick,
  onEdit,
  onRemove,
  canRemove = true,
}: MachineItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  // Detect touch devices to always show actions
  const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window;
  const showActions = isHovered || isTouchDevice;

  const handleRemoveConfirm = async () => {
    if (!onRemove) return;
    setIsRemoving(true);
    try {
      onRemove();
    } finally {
      setIsRemoving(false);
      setShowRemoveConfirm(false);
    }
  };

  if (collapsed) {
    // Collapsed view - just icon with status
    return (
      <motion.button
        variants={variants.fadeInUp}
        onClick={onClick}
        className={cn(
          'relative flex w-full items-center justify-center',
          'rounded-lg p-2 transition-all duration-150',
          'hover:bg-white/5',
          selected && 'bg-primary/10 ring-primary/50 ring-2'
        )}
        title={machine.name}
      >
        <div className="relative">
          <MachineIcon
            type={machine.type}
            className={cn(
              'h-5 w-5',
              machine.status === 'online' ? 'text-white/70' : 'text-white/30'
            )}
          />
          <StatusDot
            status={machine.status}
            size="xs"
            className="absolute -bottom-0.5 -right-0.5"
          />
        </div>
      </motion.button>
    );
  }

  // Expanded view
  return (
    <>
      <motion.div
        variants={variants.fadeInUp}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          'group relative flex w-full items-center gap-3',
          'rounded-lg px-3 py-2 transition-all duration-150',
          'hover:bg-white/5',
          selected && 'bg-primary/10 border-primary border-l-2'
        )}
      >
        {/* Clickable area for selection */}
        <button
          onClick={onClick}
          className="absolute inset-0 z-0"
          aria-label={`Select ${machine.name}`}
        />

        {/* Icon with status */}
        <div className="relative z-10 flex-shrink-0">
          {machine.color ? (
            <div
              className="flex h-5 w-5 items-center justify-center rounded-md"
              style={{ backgroundColor: machine.color }}
            >
              <MachineIcon type={machine.type} className="h-3 w-3 text-white" />
            </div>
          ) : (
            <MachineIcon
              type={machine.type}
              className={cn(
                'h-5 w-5',
                machine.status === 'online' ? 'text-white/70' : 'text-white/30'
              )}
            />
          )}
          <StatusDot
            status={machine.status}
            size="xs"
            className="absolute -bottom-0.5 -right-0.5"
          />
        </div>

        {/* Name and count */}
        <div className="z-10 min-w-0 flex-1 text-left">
          <div className="truncate text-sm font-medium text-white/90">{machine.name}</div>
          <div className="text-xs text-white/40">
            {machine.sessionCount} session{machine.sessionCount !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Action buttons on hover OR Chevron when not hovered */}
        <div className="z-10 flex-shrink-0">
          <AnimatePresence mode="wait">
            {showActions && (onEdit || (onRemove && canRemove)) ? (
              <motion.div
                key="actions"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.1 }}
                className="flex items-center gap-0.5"
              >
                {onEdit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit();
                    }}
                    className="rounded p-1.5 text-white/40 hover:bg-white/10 hover:text-white/80"
                    title="Rename"
                    aria-label="Rename machine"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                {onRemove && canRemove && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowRemoveConfirm(true);
                    }}
                    className="rounded p-1.5 text-white/40 hover:bg-red-500/20 hover:text-red-400"
                    title="Remove"
                    aria-label="Remove machine"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="chevron"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
              >
                <ChevronRight className="h-4 w-4 text-white/20" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={showRemoveConfirm}
        onOpenChange={setShowRemoveConfirm}
        title="Remove machine?"
        description={`This will disconnect "${machine.name}" from your dashboard. You can add it back later.`}
        confirmText="Remove"
        variant="destructive"
        onConfirm={handleRemoveConfirm}
        isLoading={isRemoving}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Project Item Component
// ═══════════════════════════════════════════════════════════════════════════

interface ProjectItemProps {
  project: SidebarProject;
  collapsed?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

function ProjectItem({ project, collapsed, selected, onClick }: ProjectItemProps) {
  if (collapsed) {
    return (
      <motion.button
        variants={variants.fadeInUp}
        onClick={onClick}
        className={cn(
          'flex w-full items-center justify-center',
          'rounded-lg p-2 transition-all duration-150',
          'hover:bg-white/5',
          selected && 'bg-primary/10 ring-primary/50 ring-2'
        )}
        title={project.name}
      >
        <FolderOpen className={cn('h-5 w-5', selected ? 'text-primary' : 'text-white/50')} />
        {project.activeSessionCount > 0 && (
          <span className="bg-primary absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full text-[8px] font-bold text-white">
            {project.activeSessionCount}
          </span>
        )}
      </motion.button>
    );
  }

  return (
    <motion.button
      variants={variants.fadeInUp}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3',
        'rounded-lg px-3 py-2 transition-all duration-150',
        'hover:bg-white/5 active:scale-[0.98]',
        selected && 'bg-primary/10 border-primary border-l-2'
      )}
    >
      <FolderOpen
        className={cn('h-4 w-4 flex-shrink-0', selected ? 'text-primary' : 'text-white/50')}
      />
      <span
        className={cn(
          'flex-1 truncate text-left text-sm',
          selected ? 'font-medium text-white' : 'text-white/70'
        )}
      >
        {project.name}
      </span>
      {project.activeSessionCount > 0 && (
        <span className="rounded bg-white/5 px-1.5 py-0.5 text-xs text-white/40">
          {project.activeSessionCount}
        </span>
      )}
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Sidebar Component
// ═══════════════════════════════════════════════════════════════════════════

export function Sidebar({
  collapsed = false,
  onToggle,
  machines = [],
  projects = [],
  selectedMachineId,
  onSelectMachine,
  onAddMachine,
  onSelectProject,
  selectedProjectName,
  onEditMachine,
  onRemoveMachine,
  canRemoveMachine,
}: SidebarProps) {
  return (
    <aside
      className={cn('panel flex h-full w-full flex-col', 'transition-all duration-200')}
      aria-label="Sidebar navigation"
    >
      {/* Logo / Collapse Toggle */}
      <div
        className={cn(
          'flex items-center border-b border-white/5',
          collapsed ? 'justify-center p-3' : 'justify-between p-4'
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-orange-500 to-amber-500">
              <span className="text-xs font-bold text-white">24</span>
            </div>
            <span className="font-semibold text-white/90">247</span>
          </div>
        )}

        <button
          onClick={onToggle}
          className={cn(
            'rounded-md p-2 transition-colors',
            'text-white/40 hover:bg-white/5 hover:text-white/70'
          )}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <PanelLeft className="h-4 w-4" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="scrollbar-hide flex-1 overflow-y-auto py-2">
        {/* Machines Section */}
        <Section
          title="Machines"
          collapsed={collapsed}
          action={
            !collapsed &&
            onAddMachine && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddMachine();
                }}
                className="rounded p-1.5 text-white/40 hover:bg-white/5 hover:text-white/70"
                title="Add machine"
                aria-label="Add machine"
              >
                <Plus className="h-3 w-3" aria-hidden="true" />
              </button>
            )
          }
        >
          {machines.length > 0
            ? machines.map((machine) => (
                <MachineItem
                  key={machine.id}
                  machine={machine}
                  collapsed={collapsed}
                  selected={selectedMachineId === machine.id}
                  onClick={() => onSelectMachine?.(machine.id)}
                  onEdit={onEditMachine ? () => onEditMachine(machine) : undefined}
                  onRemove={onRemoveMachine ? () => onRemoveMachine(machine) : undefined}
                  canRemove={canRemoveMachine?.(machine) ?? true}
                />
              ))
            : !collapsed && (
                <div className="px-3 py-4 text-center">
                  <p className="text-xs text-white/30">No machines connected</p>
                  {onAddMachine && (
                    <button
                      onClick={onAddMachine}
                      className="text-primary hover:text-primary/80 mt-2 text-xs"
                    >
                      + Add machine
                    </button>
                  )}
                </div>
              )}
        </Section>

        {/* Divider */}
        {projects.length > 0 && <div className="mx-3 my-2 h-px bg-white/5" />}

        {/* Projects Section */}
        {projects.length > 0 && (
          <Section title="Projects" collapsed={collapsed}>
            {projects.map((project) => (
              <ProjectItem
                key={project.path}
                project={project}
                collapsed={collapsed}
                selected={selectedProjectName === project.name}
                onClick={() => onSelectProject?.(project.name)}
              />
            ))}
          </Section>
        )}
      </div>
    </aside>
  );
}
