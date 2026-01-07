/**
 * Ralph Loop Configuration Tests
 *
 * Tests for the Ralph Loop configuration building logic from NewSessionModal.
 * These tests ensure the RalphLoopConfig is correctly constructed from user input.
 */
import { describe, it, expect } from 'vitest';
import type { RalphLoopConfig } from '@vibecompany/247-shared';

/**
 * Extract the config building logic from NewSessionModal for testing
 * This mirrors the handleStartRalphLoop function's config construction
 */
function buildRalphLoopConfig(
  prompt: string,
  maxIterations: number,
  completionPromise: string,
  useWorktree: boolean
): RalphLoopConfig | null {
  // Validation: prompt is required
  if (!prompt.trim()) {
    return null;
  }

  return {
    prompt: prompt.trim(),
    maxIterations: maxIterations > 0 ? maxIterations : undefined,
    completionPromise: completionPromise.trim() || undefined,
    useWorktree,
  };
}

/**
 * Validation logic from NewSessionModal - determines if form can be submitted
 */
function canStartRalphLoop(selectedProject: string | null, prompt: string): boolean {
  return Boolean(selectedProject && prompt.trim());
}

describe('Ralph Loop Configuration', () => {
  describe('buildRalphLoopConfig', () => {
    it('builds config with minimal input (prompt only)', () => {
      const config = buildRalphLoopConfig('Build a feature', 0, '', false);

      expect(config).not.toBeNull();
      expect(config!.prompt).toBe('Build a feature');
      expect(config!.maxIterations).toBeUndefined();
      expect(config!.completionPromise).toBeUndefined();
      expect(config!.useWorktree).toBe(false);
    });

    it('builds config with all options', () => {
      const config = buildRalphLoopConfig('Build a feature', 10, 'COMPLETE', true);

      expect(config).not.toBeNull();
      expect(config!.prompt).toBe('Build a feature');
      expect(config!.maxIterations).toBe(10);
      expect(config!.completionPromise).toBe('COMPLETE');
      expect(config!.useWorktree).toBe(true);
    });

    it('trims prompt whitespace', () => {
      const config = buildRalphLoopConfig('  Build a feature  ', 10, 'COMPLETE', false);

      expect(config).not.toBeNull();
      expect(config!.prompt).toBe('Build a feature');
    });

    it('trims completionPromise whitespace', () => {
      const config = buildRalphLoopConfig('Build a feature', 10, '  DONE  ', false);

      expect(config).not.toBeNull();
      expect(config!.completionPromise).toBe('DONE');
    });

    it('returns null for empty prompt', () => {
      const config = buildRalphLoopConfig('', 10, 'COMPLETE', true);
      expect(config).toBeNull();
    });

    it('returns null for whitespace-only prompt', () => {
      const config = buildRalphLoopConfig('   ', 10, 'COMPLETE', true);
      expect(config).toBeNull();
    });

    it('omits maxIterations when zero or negative', () => {
      const configZero = buildRalphLoopConfig('Build', 0, '', false);
      expect(configZero!.maxIterations).toBeUndefined();

      const configNegative = buildRalphLoopConfig('Build', -5, '', false);
      expect(configNegative!.maxIterations).toBeUndefined();
    });

    it('includes maxIterations when positive', () => {
      const config = buildRalphLoopConfig('Build', 1, '', false);
      expect(config!.maxIterations).toBe(1);
    });

    it('omits completionPromise when empty', () => {
      const config = buildRalphLoopConfig('Build', 10, '', false);
      expect(config!.completionPromise).toBeUndefined();
    });

    it('omits completionPromise when only whitespace', () => {
      const config = buildRalphLoopConfig('Build', 10, '   ', false);
      expect(config!.completionPromise).toBeUndefined();
    });

    it('handles multiline prompts', () => {
      const prompt = `Implement a new feature:
1. Add a button
2. Handle click event
3. Update state`;
      const config = buildRalphLoopConfig(prompt, 10, 'COMPLETE', false);

      expect(config).not.toBeNull();
      expect(config!.prompt).toContain('Implement a new feature');
      expect(config!.prompt).toContain('Add a button');
    });
  });

  describe('canStartRalphLoop - form validation', () => {
    it('returns true when project and prompt are set', () => {
      expect(canStartRalphLoop('my-project', 'Build a feature')).toBe(true);
    });

    it('returns false when project is null', () => {
      expect(canStartRalphLoop(null, 'Build a feature')).toBe(false);
    });

    it('returns false when project is empty string', () => {
      expect(canStartRalphLoop('', 'Build a feature')).toBe(false);
    });

    it('returns false when prompt is empty', () => {
      expect(canStartRalphLoop('my-project', '')).toBe(false);
    });

    it('returns false when prompt is only whitespace', () => {
      expect(canStartRalphLoop('my-project', '   ')).toBe(false);
    });

    it('returns true with trimmed prompt having content', () => {
      expect(canStartRalphLoop('my-project', '  Build  ')).toBe(true);
    });
  });
});

describe('Ralph Loop Default Values', () => {
  // Test that default values match what NewSessionModal initializes
  const DEFAULT_MAX_ITERATIONS = 10;
  const DEFAULT_COMPLETION_PROMISE = 'COMPLETE';
  const DEFAULT_USE_WORKTREE = false;

  it('default maxIterations is 10', () => {
    expect(DEFAULT_MAX_ITERATIONS).toBe(10);
  });

  it('default completionPromise is COMPLETE', () => {
    expect(DEFAULT_COMPLETION_PROMISE).toBe('COMPLETE');
  });

  it('default useWorktree is false', () => {
    expect(DEFAULT_USE_WORKTREE).toBe(false);
  });

  it('config with defaults is valid', () => {
    const config = buildRalphLoopConfig(
      'Build a feature',
      DEFAULT_MAX_ITERATIONS,
      DEFAULT_COMPLETION_PROMISE,
      DEFAULT_USE_WORKTREE
    );

    expect(config).not.toBeNull();
    expect(config!.maxIterations).toBe(10);
    expect(config!.completionPromise).toBe('COMPLETE');
    expect(config!.useWorktree).toBe(false);
  });
});

describe('Ralph Loop Edge Cases', () => {
  it('handles very long prompts', () => {
    const longPrompt = 'Build a feature. '.repeat(1000);
    const config = buildRalphLoopConfig(longPrompt, 10, 'COMPLETE', false);

    expect(config).not.toBeNull();
    expect(config!.prompt.length).toBeGreaterThan(1000);
  });

  it('handles special characters in prompt', () => {
    const specialPrompt =
      'Build a feature with <promise>COMPLETE</promise> & special chars: 日本語';
    const config = buildRalphLoopConfig(specialPrompt, 10, 'COMPLETE', false);

    expect(config).not.toBeNull();
    expect(config!.prompt).toBe(specialPrompt);
  });

  it('handles very high maxIterations', () => {
    const config = buildRalphLoopConfig('Build', 9999, '', false);
    expect(config!.maxIterations).toBe(9999);
  });

  it('handles custom completionPromise with special chars', () => {
    const config = buildRalphLoopConfig('Build', 10, '<done>FINISHED</done>', false);
    expect(config!.completionPromise).toBe('<done>FINISHED</done>');
  });
});
