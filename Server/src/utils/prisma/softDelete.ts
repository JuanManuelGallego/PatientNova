interface SoftDeletableModel {
  update: (args: { where: { id: string; userId?: string }; data: Record<string, unknown>; include?: Record<string, unknown> }) => Promise<unknown>;
}

export async function softDelete<M extends SoftDeletableModel>(
  model: M,
  id: string,
  userId?: string,
  include?: Record<string, unknown>,
): Promise<unknown> {
  return model.update({
    where: userId !== undefined ? { id, userId } : { id },
    data: { isDeleted: true, deletedAt: new Date() },
    ...(include && { include }),
  });
}

export async function restore<M extends SoftDeletableModel>(
  model: M,
  id: string,
  userId?: string,
  include?: Record<string, unknown>,
): Promise<unknown> {
  return model.update({
    where: userId !== undefined ? { id, userId } : { id },
    data: { isDeleted: false, deletedAt: null },
    ...(include && { include }),
  });
}
