import { describe, expect, it } from 'vitest';
import { verifyRestore } from '../../../src/utils/prisma/verify-restore.js';
import { createTestPatient, createTestUser } from '../helpers.js';

describe('verifyRestore', () => {
  it('counts the patients it could read and decrypt', async () => {
    const user = await createTestUser();
    await createTestPatient(user.id);
    await createTestPatient(user.id);

    expect(await verifyRestore()).toEqual({ read: 2, decrypted: 2 });
  });

  it('reads at most the sample size', async () => {
    const user = await createTestUser();
    await createTestPatient(user.id);
    await createTestPatient(user.id);

    expect(await verifyRestore(1)).toEqual({ read: 1, decrypted: 1 });
  });
});
