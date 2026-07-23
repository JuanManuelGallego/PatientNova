interface SoftDeletableModel {
  update: (args: { where: { id: string }; data: Record<string, unknown>; include?: any }) => Promise<any>;
}

export async function softDelete<M extends SoftDeletableModel>(
  model: M,
  id: string,
  userId: string,
  include?: any,
): Promise<any> {
  return model.update({
    where: { id, userId },
    data: { isDeleted: true, deletedAt: new Date() },
    ...(include && { include }),
  });
}

export async function restore<M extends SoftDeletableModel>(
  model: M,
  id: string,
  include?: any,
): Promise<any> {
  return model.update({
    where: { id },
    data: { isDeleted: false, deletedAt: null },
    ...(include && { include }),
  });
}
