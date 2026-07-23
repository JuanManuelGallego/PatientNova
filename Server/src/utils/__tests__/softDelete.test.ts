import { describe, it, expect, vi, beforeEach } from 'vitest';
import { softDelete, restore } from '../softDelete.js';

function mockModel() {
  return {
    update: vi.fn().mockResolvedValue({ id: '1', isDeleted: true, deletedAt: new Date() }),
  };
}

describe('softDelete', () => {
  let model: ReturnType<typeof mockModel>;

  beforeEach(() => {
    model = mockModel();
  });

  it('sets isDeleted=true and deletedAt with id and userId in where', async () => {
    await softDelete(model as any, 'rec-1', 'user-1');
    expect(model.update).toHaveBeenCalledWith({
      where: { id: 'rec-1', userId: 'user-1' },
      data: { isDeleted: true, deletedAt: expect.any(Date) },
    });
  });

  it('omits userId from where when not provided', async () => {
    await softDelete(model as any, 'rec-1');
    expect(model.update).toHaveBeenCalledWith({
      where: { id: 'rec-1' },
      data: { isDeleted: true, deletedAt: expect.any(Date) },
    });
  });

  it('passes include option when provided', async () => {
    const include = { patient: true };
    await softDelete(model as any, 'rec-1', 'user-1', include);
    expect(model.update).toHaveBeenCalledWith({
      where: { id: 'rec-1', userId: 'user-1' },
      data: { isDeleted: true, deletedAt: expect.any(Date) },
      include,
    });
  });

  it('passes include without userId', async () => {
    const include = { patient: true };
    await softDelete(model as any, 'rec-1', undefined, include);
    expect(model.update).toHaveBeenCalledWith({
      where: { id: 'rec-1' },
      data: { isDeleted: true, deletedAt: expect.any(Date) },
      include,
    });
  });

  it('does not pass include when omitted', async () => {
    await softDelete(model as any, 'rec-1', 'user-1');
    const call = model.update.mock.calls[0]![0];
    expect(call).not.toHaveProperty('include');
  });

  it('returns the result from model.update', async () => {
    const expected = { id: 'rec-1', isDeleted: true };
    model.update.mockResolvedValue(expected);
    const result = await softDelete(model as any, 'rec-1', 'user-1');
    expect(result).toBe(expected);
  });

  it('propagates errors from model.update', async () => {
    model.update.mockRejectedValue(new Error('DB error'));
    await expect(softDelete(model as any, 'rec-1', 'user-1')).rejects.toThrow('DB error');
  });
});

describe('restore', () => {
  let model: ReturnType<typeof mockModel>;

  beforeEach(() => {
    model = mockModel();
  });

  it('sets isDeleted=false and deletedAt=null', async () => {
    await restore(model as any, 'rec-1');
    expect(model.update).toHaveBeenCalledWith({
      where: { id: 'rec-1' },
      data: { isDeleted: false, deletedAt: null },
    });
  });

  it('passes include option when provided', async () => {
    const include = { patient: true };
    await restore(model as any, 'rec-1','user-1', include);
    expect(model.update).toHaveBeenCalledWith({
      where: { id: 'rec-1', userId: 'user-1' },
      data: { isDeleted: false, deletedAt: null },
      include,
    });
  });

  it('does not pass include when omitted', async () => {
    await restore(model as any, 'rec-1');
    const call = model.update.mock.calls[0]![0];
    expect(call).not.toHaveProperty('include');
  });

  it('returns the result from model.update', async () => {
    const expected = { id: 'rec-1', isDeleted: false };
    model.update.mockResolvedValue(expected);
    const result = await restore(model as any, 'rec-1');
    expect(result).toBe(expected);
  });

  it('propagates errors from model.update', async () => {
    model.update.mockRejectedValue(new Error('DB error'));
    await expect(restore(model as any, 'rec-1')).rejects.toThrow('DB error');
  });
});
