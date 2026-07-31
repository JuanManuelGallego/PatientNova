import { describe, it, expect } from 'vitest';
import { runInAuditContext, getAuditContext } from '../../../src/audit-log/audit-log-context.js';

describe('audit-log-context', () => {
  it('returns undefined when no context is set', () => {
    expect(getAuditContext()).toBeUndefined();
  });

  it('sets and retrieves audit context', () => {
    const ctx = { actorId: 'user-1', actorDisplayName: 'Test User', ipAddress: '10.0.0.1', userId: 'u-1' };
    runInAuditContext(ctx, () => {
      const stored = getAuditContext();
      expect(stored).toEqual(ctx);
    });
  });

  it('provides context inside async operations', async () => {
    const ctx = { actorId: 'async-user', actorDisplayName: 'Async User' };
    await runInAuditContext(ctx, async () => {
      const stored = getAuditContext();
      expect(stored?.actorId).toBe('async-user');
    });
  });

  it('does not leak context to outer scope', () => {
    const outerCtx = { actorId: 'outer', actorDisplayName: 'Outer' };
    const innerCtx = { actorId: 'inner', actorDisplayName: 'Inner' };

    runInAuditContext(outerCtx, () => {
      expect(getAuditContext()?.actorId).toBe('outer');
      runInAuditContext(innerCtx, () => {
        expect(getAuditContext()?.actorId).toBe('inner');
      });
      expect(getAuditContext()?.actorId).toBe('outer');
    });
  });

  it('restores context after nested runInAuditContext completes', () => {
    const ctx1 = { actorId: 'first', actorDisplayName: 'First' };
    const ctx2 = { actorId: 'second', actorDisplayName: 'Second' };

    runInAuditContext(ctx1, () => {
      expect(getAuditContext()?.actorId).toBe('first');
      runInAuditContext(ctx2, () => {
        expect(getAuditContext()?.actorId).toBe('second');
      });
      expect(getAuditContext()?.actorId).toBe('first');
    });
  });

  it('returns the value from the callback', () => {
    const result = runInAuditContext(
      { actorId: 'user-1', actorDisplayName: 'Test' },
      () => 42,
    );
    expect(result).toBe(42);
  });

  it('returns a promise value from the callback', async () => {
    const result = await runInAuditContext(
      { actorId: 'user-1', actorDisplayName: 'Test' },
      async () => 'hello',
    );
    expect(result).toBe('hello');
  });

  it('propagates errors thrown in the callback', () => {
    expect(() =>
      runInAuditContext(
        { actorId: 'user-1', actorDisplayName: 'Test' },
        () => { throw new Error('boom'); },
      ),
    ).toThrow('boom');
  });

  it('context is available in chained async calls', async () => {
    const ctx = { actorId: 'chained', actorDisplayName: 'Chained', userId: 'u-99' };
    await runInAuditContext(ctx, async () => {
      const step1 = await Promise.resolve().then(() => getAuditContext());
      expect(step1?.actorId).toBe('chained');
      const step2 = await Promise.resolve().then(() => getAuditContext());
      expect(step2?.userId).toBe('u-99');
    });
  });
});
