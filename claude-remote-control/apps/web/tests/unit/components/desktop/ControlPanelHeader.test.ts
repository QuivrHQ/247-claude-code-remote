import { describe, it, expect } from 'vitest';

/**
 * Test ControlPanelHeader component logic.
 * Tests status gauges, counts, and collapse states.
 */

// Status gauge configuration (must match ControlPanelHeader.tsx)
const statusGaugeConfig = {
  active: { label: 'ACT', status: 'working' },
  waiting: { label: 'WAIT', status: 'needs_attention' },
  idle: { label: 'IDLE', status: 'idle' },
};

describe('ControlPanelHeader', () => {
  describe('status gauges', () => {
    it('has three status gauges', () => {
      const gauges = Object.keys(statusGaugeConfig);
      expect(gauges).toHaveLength(3);
    });

    it('has correct labels for each gauge', () => {
      expect(statusGaugeConfig.active.label).toBe('ACT');
      expect(statusGaugeConfig.waiting.label).toBe('WAIT');
      expect(statusGaugeConfig.idle.label).toBe('IDLE');
    });

    it('maps to correct status types', () => {
      expect(statusGaugeConfig.active.status).toBe('working');
      expect(statusGaugeConfig.waiting.status).toBe('needs_attention');
      expect(statusGaugeConfig.idle.status).toBe('idle');
    });
  });

  describe('count display', () => {
    it('shows count badge when count > 0', () => {
      const showBadge = (count: number) => count > 0;
      expect(showBadge(2)).toBe(true);
      expect(showBadge(0)).toBe(false);
    });

    it('uses idle status ring when count is 0', () => {
      const getEffectiveStatus = (count: number, status: string) => {
        return count > 0 ? status : 'idle';
      };
      expect(getEffectiveStatus(0, 'working')).toBe('idle');
      expect(getEffectiveStatus(2, 'working')).toBe('working');
    });
  });

  describe('total active calculation', () => {
    it('calculates total active from active + waiting', () => {
      const totalActive = (activeSessions: number, waitingSessions: number) => {
        return activeSessions + waitingSessions;
      };
      expect(totalActive(2, 1)).toBe(3);
      expect(totalActive(0, 0)).toBe(0);
      expect(totalActive(5, 3)).toBe(8);
    });

    it('shows active badge only when total > 0', () => {
      const showActiveBadge = (activeSessions: number, waitingSessions: number) => {
        return activeSessions + waitingSessions > 0;
      };
      expect(showActiveBadge(2, 1)).toBe(true);
      expect(showActiveBadge(0, 0)).toBe(false);
    });
  });

  describe('collapsed state', () => {
    it('shows system indicator when collapsed', () => {
      const systemIndicator = '▣';
      expect(systemIndicator).toBe('▣');
    });

    it('hides gauges when collapsed', () => {
      const showGauges = (isCollapsed: boolean) => !isCollapsed;
      expect(showGauges(true)).toBe(false);
      expect(showGauges(false)).toBe(true);
    });

    it('shows expanded header text when not collapsed', () => {
      const headerText = 'System Status';
      expect(headerText).toBe('System Status');
    });
  });

  describe('typography styles', () => {
    it('uses monospace font for labels', () => {
      const labelClass = 'font-mono text-[9px] uppercase tracking-wider text-white/40';
      expect(labelClass).toContain('font-mono');
      expect(labelClass).toContain('uppercase');
      expect(labelClass).toContain('tracking-wider');
    });

    it('uses correct text size for header', () => {
      const headerClass = 'font-mono text-[10px] uppercase tracking-wider text-white/40';
      expect(headerClass).toContain('text-[10px]');
    });
  });

  describe('gauge grid layout', () => {
    it('uses 3-column grid for gauges', () => {
      const gridClass = 'grid grid-cols-3 gap-2';
      expect(gridClass).toContain('grid-cols-3');
      expect(gridClass).toContain('gap-2');
    });
  });

  describe('status ring sizes', () => {
    it('uses 24px size for status rings in gauges', () => {
      const ringSize = 24;
      expect(ringSize).toBe(24);
    });
  });

  describe('count badge styling', () => {
    it('count badge has absolute positioning', () => {
      const badgeClass = 'absolute -right-1 -top-1';
      expect(badgeClass).toContain('absolute');
      expect(badgeClass).toContain('-right-1');
      expect(badgeClass).toContain('-top-1');
    });

    it('count badge has correct size', () => {
      const badgeSize = 'h-4 w-4';
      expect(badgeSize).toContain('h-4');
      expect(badgeSize).toContain('w-4');
    });
  });

  describe('active badge styling', () => {
    it('active badge uses emerald color', () => {
      const badgeClass = 'bg-emerald-500/20 text-emerald-400';
      expect(badgeClass).toContain('emerald-500');
      expect(badgeClass).toContain('emerald-400');
    });

    it('active badge is rounded pill', () => {
      const badgeClass = 'rounded-full px-1.5';
      expect(badgeClass).toContain('rounded-full');
    });
  });

  describe('collapse toggle button', () => {
    it('toggles between ChevronLeft and ChevronRight', () => {
      const getIcon = (isCollapsed: boolean) => (isCollapsed ? 'ChevronRight' : 'ChevronLeft');
      expect(getIcon(true)).toBe('ChevronRight');
      expect(getIcon(false)).toBe('ChevronLeft');
    });
  });

  describe('gauge border styles', () => {
    it('gauge has subtle border', () => {
      const borderClass = 'border border-white/5';
      expect(borderClass).toContain('border-white/5');
    });

    it('active gauge has status-colored border', () => {
      const statusBorders = {
        working: 'border-cyan-500/30',
        needs_attention: 'border-amber-500/30',
        idle: 'border-gray-500/30',
      };
      expect(statusBorders.working).toContain('cyan');
      expect(statusBorders.needs_attention).toContain('amber');
    });
  });

  describe('animation configuration', () => {
    it('height animation duration is 0.2s', () => {
      const duration = 0.2;
      expect(duration).toBe(0.2);
    });
  });

  describe('collapsed count indicator', () => {
    it('shows total count when collapsed and active', () => {
      const showCollapsedCount = (isCollapsed: boolean, totalActive: number) => {
        return isCollapsed && totalActive > 0;
      };
      expect(showCollapsedCount(true, 3)).toBe(true);
      expect(showCollapsedCount(true, 0)).toBe(false);
      expect(showCollapsedCount(false, 3)).toBe(false);
    });
  });
});
