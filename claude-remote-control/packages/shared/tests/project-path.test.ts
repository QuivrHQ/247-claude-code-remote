import { describe, it, expect } from 'vitest';
import { decodeProjectSlug, isSafeProjectPath, projectSlug } from '../src/project-path.js';

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
  it('returns plain single-segment projects unchanged', () => {
    expect(projectSlug('my-app')).toBe('my-app');
    expect(projectSlug('247-claude-code-remote')).toBe('247-claude-code-remote');
  });

  it('joins nested segments with a double underscore', () => {
    expect(projectSlug('group/app')).toBe('group__app');
    expect(projectSlug('a/b/c')).toBe('a__b__c');
  });

  it('returns an empty string for the root project', () => {
    expect(projectSlug('')).toBe('');
  });

  it('escapes characters that are unsafe in tmux names and session API paths', () => {
    expect(projectSlug('my app')).toBe('my_20app');
    expect(projectSlug('my.app')).toBe('my_2eapp');
    expect(projectSlug('a"; rm -rf ~; "')).toBe('a_22_3b_20rm_20-rf_20_7e_3b_20_22');
  });

  it('escapes underscores so they cannot be mistaken for path separators', () => {
    expect(projectSlug('my_app')).toBe('my_5fapp');
    expect(projectSlug('group__app')).toBe('group_5f_5fapp');
  });

  it('never produces the "--" project/label separator', () => {
    expect(projectSlug('my--app')).toBe('my_2d_2dapp');
    expect(projectSlug('-lead')).toBe('_2dlead');
    expect(projectSlug('trail-')).toBe('trail_2d');
    expect(projectSlug('a/-b/c-')).not.toContain('--');
  });

  it('encodes non-ASCII names as UTF-8 byte escapes', () => {
    expect(projectSlug('Идеи')).toBe('_d0_98_d0_b4_d0_b5_d0_b8');
  });

  it('only emits letters, digits, underscores and hyphens', () => {
    const slug = projectSlug('Идеи/my app/x.y_z--w');
    expect(slug).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(slug).not.toContain('--');
  });

  it('is injective: distinct projects never share a slug', () => {
    const projects = ['group/app', 'group__app', 'group_app', 'group app', 'group-app', 'group.app'];
    const slugs = projects.map(projectSlug);
    expect(new Set(slugs).size).toBe(projects.length);
  });
});

describe('decodeProjectSlug', () => {
  it.each([
    'my-app',
    'group/app',
    'a/b/c',
    'my app',
    'my.app',
    'my_app',
    'group__app',
    'my--app',
    '-lead',
    'trail-',
    'Идеи/Мой проект',
    'tab\tname',
    'emoji-🚀',
    "quote'\"back\\slash",
  ])('round-trips %j', (project) => {
    expect(decodeProjectSlug(projectSlug(project))).toBe(project);
  });

  it('decodes legacy names that only flattened path separators', () => {
    expect(decodeProjectSlug('AI__Project__AI-expert')).toBe('AI/Project/AI-expert');
  });

  it('returns input that is not a valid slug unchanged', () => {
    expect(decodeProjectSlug('my_ab')).toBe('my_ab');
    expect(decodeProjectSlug('plain_name')).toBe('plain_name');
  });
});
