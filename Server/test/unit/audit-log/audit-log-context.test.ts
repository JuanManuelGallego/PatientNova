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

  it('restores outer context after nested runInAuditContext completes', () => {
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
});
