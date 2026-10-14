import { describe, it, expect } from 'vitest';
import { resolveProjectPath, sessionProject } from '../../src/lib/project-path.js';

const BASE = '/tmp/test-projects';

describe('sessionProject', () => {
  it('prefers the stored project so nested paths survive', () => {
    expect(sessionProject('AI__Project__app--calm-fox-1', 'AI/Project/app')).toBe('AI/Project/app');
  });

  it('keeps an empty stored project for the root terminal', () => {
    expect(sessionProject('root--scratch', '')).toBe('');
  });

  it('falls back to the name prefix when nothing is stored', () => {
    expect(sessionProject('my-app--calm-fox-1', undefined)).toBe('my-app');
    expect(sessionProject('my-app--calm-fox-1', null)).toBe('my-app');
  });

  it('treats the "unknown" placeholder as not stored', () => {
    expect(sessionProject('my-app--calm-fox-1', 'unknown')).toBe('my-app');
  });
});

describe('resolveProjectPath', () => {
  it('resolves a top-level project inside the base path', () => {
    expect(resolveProjectPath(BASE, 'app')).toBe('/tmp/test-projects/app');
  });

  it('resolves nested projects', () => {
    expect(resolveProjectPath(BASE, 'group/app')).toBe('/tmp/test-projects/group/app');
  });

  it('tolerates a trailing slash on the base path', () => {
    expect(resolveProjectPath(`${BASE}/`, 'app')).toBe('/tmp/test-projects/app');
  });

  it.each([
    ['empty', ''],
    ['parent traversal', '../etc'],
    ['embedded traversal', 'app/../../etc'],
    ['absolute path', '/etc/passwd'],
    ['hidden folder', '.ssh'],
    ['backslash', 'app\\..\\..\\etc'],
  ])('rejects %s', (_label, value) => {
    expect(resolveProjectPath(BASE, value)).toBeNull();
  });
});
