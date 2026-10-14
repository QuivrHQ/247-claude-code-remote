import { describe, it, expect } from 'vitest';
import { isSafeProjectPath, projectSlug } from '../src/project-path.js';

describe('isSafeProjectPath', () => {
  it.each(['app', 'my-app', 'my.app', 'group/app', 'a/b/c', 'Моя папка'])(
    'accepts %s',
    (value) => {
      expect(isSafeProjectPath(value)).toBe(true);
    }
  );

  it.each([
    ['empty', ''],
    ['absolute path', '/etc'],
    ['parent traversal', '../secret'],
    ['embedded traversal', 'a/../b'],
    ['current dir segment', 'a/./b'],
    ['empty segment', 'a//b'],
    ['trailing slash', 'a/'],
    ['hidden folder', '.git'],
    ['nested hidden folder', 'a/.cache'],
    ['backslash', 'a\\b'],
    ['NUL byte', 'a\0b'],
  ])('rejects %s', (_label, value) => {
    expect(isSafeProjectPath(value)).toBe(false);
  });

  it('rejects paths that are too deep', () => {
    expect(isSafeProjectPath(Array.from({ length: 9 }, () => 'a').join('/'))).toBe(false);
    expect(isSafeProjectPath(Array.from({ length: 8 }, () => 'a').join('/'))).toBe(true);
  });

  it('rejects overly long paths', () => {
    expect(isSafeProjectPath('a'.repeat(513))).toBe(false);
  });
});

describe('projectSlug', () => {
  it('returns single-segment projects unchanged', () => {
    expect(projectSlug('my-app')).toBe('my-app');
  });

  it('joins nested segments with a double underscore', () => {
    expect(projectSlug('group/app')).toBe('group__app');
    expect(projectSlug('a/b/c')).toBe('a__b__c');
  });

  it('returns an empty string for the root project', () => {
    expect(projectSlug('')).toBe('');
  });
});
