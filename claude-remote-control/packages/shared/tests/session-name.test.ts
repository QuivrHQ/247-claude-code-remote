import { describe, it, expect } from 'vitest';
import {
  MAX_SESSION_LABEL_LENGTH,
  buildSessionName,
  isValidSessionLabel,
  sanitizeSessionLabel,
} from '../src/session-name.js';

describe('sanitizeSessionLabel', () => {
  it('keeps letters, digits, dashes and underscores', () => {
    expect(sanitizeSessionLabel('api_refactor-2')).toBe('api_refactor-2');
  });

  it('preserves the case of Latin letters', () => {
    expect(sanitizeSessionLabel('MyFeature')).toBe('MyFeature');
  });

  it('turns whitespace into single dashes and trims the ends', () => {
    expect(sanitizeSessionLabel('  api   refactor  ')).toBe('api-refactor');
  });

  it('collapses repeated dashes so the "--" separator stays unambiguous', () => {
    expect(sanitizeSessionLabel('a--b---c')).toBe('a-b-c');
  });

  it('strips characters that are unsafe in tmux session names', () => {
    expect(sanitizeSessionLabel('bad/name:with.chars"$`')).toBe('badnamewithchars');
  });

  it('transliterates Russian input to Latin', () => {
    expect(sanitizeSessionLabel('мой проект')).toBe('moy-proekt');
    expect(sanitizeSessionLabel('Ёжик')).toBe('ezhik');
  });

  it('returns an empty string when nothing usable remains', () => {
    expect(sanitizeSessionLabel('')).toBe('');
    expect(sanitizeSessionLabel('   ')).toBe('');
    expect(sanitizeSessionLabel('!!!')).toBe('');
    expect(sanitizeSessionLabel('日本語')).toBe('');
  });

  it('truncates to the maximum length without leaving a trailing dash', () => {
    const result = sanitizeSessionLabel(`${'a'.repeat(MAX_SESSION_LABEL_LENGTH - 1)} tail`);
    expect(result.length).toBeLessThanOrEqual(MAX_SESSION_LABEL_LENGTH);
    expect(result.endsWith('-')).toBe(false);
  });
});

describe('isValidSessionLabel', () => {
  it('accepts an already clean label', () => {
    expect(isValidSessionLabel('api-refactor')).toBe(true);
  });

  it('rejects empty labels', () => {
    expect(isValidSessionLabel('')).toBe(false);
  });

  it('rejects labels that need sanitizing', () => {
    expect(isValidSessionLabel('has space')).toBe(false);
    expect(isValidSessionLabel('a--b')).toBe(false);
  });

  it('rejects the reserved "new" label in any case', () => {
    expect(isValidSessionLabel('new')).toBe(false);
    expect(isValidSessionLabel('NEW')).toBe(false);
  });
});

describe('buildSessionName', () => {
  it('joins project and label with the session separator', () => {
    expect(buildSessionName('my-app', 'api-refactor')).toBe('my-app--api-refactor');
  });

  it('uses "root" for the terminal-at-root project', () => {
    expect(buildSessionName('', 'scratch')).toBe('root--scratch');
  });

  it('flattens nested project paths so the name stays tmux-safe', () => {
    expect(buildSessionName('group/app', 'api')).toBe('group__app--api');
  });
});
