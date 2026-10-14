import { describe, it, expect } from 'vitest';
import { resolveSessionLabel } from '@/components/NewSessionModal/sessionLabel';

const NONE: ReadonlySet<string> = new Set();

describe('resolveSessionLabel', () => {
  it('treats blank input as no custom name', () => {
    expect(resolveSessionLabel('', 'my-app', NONE)).toEqual({ status: 'empty' });
    expect(resolveSessionLabel('   ', 'my-app', NONE)).toEqual({ status: 'empty' });
  });

  it('returns the sanitized label and full session name', () => {
    expect(resolveSessionLabel('API refactor', 'my-app', NONE)).toEqual({
      status: 'valid',
      label: 'API-refactor',
      sessionName: 'my-app--API-refactor',
    });
  });

  it('transliterates Russian input', () => {
    expect(resolveSessionLabel('мой проект', 'my-app', NONE)).toMatchObject({
      status: 'valid',
      sessionName: 'my-app--moy-proekt',
    });
  });

  it('uses "root" as the prefix for the terminal-at-root project', () => {
    expect(resolveSessionLabel('scratch', '', NONE)).toMatchObject({
      status: 'valid',
      sessionName: 'root--scratch',
    });
  });

  it('rejects input that sanitizes to nothing', () => {
    expect(resolveSessionLabel('!!!', 'my-app', NONE)).toMatchObject({ status: 'invalid' });
  });

  it('rejects the reserved "new" label', () => {
    expect(resolveSessionLabel('New', 'my-app', NONE)).toMatchObject({ status: 'invalid' });
  });

  it('rejects a name that is already used on the machine', () => {
    const taken = new Set(['my-app--api']);
    expect(resolveSessionLabel('api', 'my-app', taken)).toMatchObject({
      status: 'invalid',
      error: expect.stringContaining('already exists'),
    });
  });

  it('allows the same label in a different project', () => {
    const taken = new Set(['other--api']);
    expect(resolveSessionLabel('api', 'my-app', taken)).toMatchObject({ status: 'valid' });
  });
});
