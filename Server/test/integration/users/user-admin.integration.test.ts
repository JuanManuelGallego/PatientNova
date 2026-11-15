import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { createTestToken, createTestUser } from '../helpers.js';

type SeededUser = Awaited<ReturnType<typeof createTestUser>>;

let superAdmin: SeededUser;
let target: SeededUser;

const bearer = (user: SeededUser) => ({ Authorization: `Bearer ${createTestToken(user)}` });
const row = (id: string) => prisma.user.findUniqueOrThrow({ where: { id } });

beforeEach(async () => {
  superAdmin = await createTestUser({ role: 'SUPER_ADMIN', email: `super-${Date.now()}@test.local` });
  target = await createTestUser({ role: 'ADMIN' });
});

describe('super-admin user endpoints (integration)', () => {
  it('updates role, status and email of another user', async () => {
    const before = await row(target.id);
    const res = await request(app)
      .patch(`/v1/users/${target.id}`)
      .set(bearer(superAdmin))
      .send({ role: 'SUPER_ADMIN', status: 'INACTIVE', email: 'New.Mail@Test.local' });
    expect(res.status).toBe(200);

    const after = await row(target.id);
    expect(after.role).toBe('SUPER_ADMIN');
    expect(after.status).toBe('INACTIVE');
    expect(after.email).toBe('new.mail@test.local');
    expect(after.refreshTokenVersion).toBe(before.refreshTokenVersion + 1);
  });

  it('does not bump the token version for a profile-only edit', async () => {
    const before = await row(target.id);
    const res = await request(app)
      .patch(`/v1/users/${target.id}`)
      .set(bearer(superAdmin))
      .send({ displayName: 'Dra. X' });
    expect(res.status).toBe(200);
    const after = await row(target.id);
    expect(after.displayName).toBe('Dra. X');
    expect(after.refreshTokenVersion).toBe(before.refreshTokenVersion);
  });

  it("refuses another user's email in any case", async () => {
    const res = await request(app)
      .patch(`/v1/users/${target.id}`)
      .set(bearer(superAdmin))
      .send({ email: superAdmin.email.toUpperCase() });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/user with email .* already exists/i);
    expect((await row(target.id)).email).toBe(target.email);
  });

  it('refuses demoting or deactivating yourself', async () => {
    for (const body of [{ role: 'ADMIN' }, { status: 'INACTIVE' }]) {
      const res = await request(app).patch(`/v1/users/${superAdmin.id}`).set(bearer(superAdmin)).send(body);
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('You cannot remove your own super admin access');
    }
    const after = await row(superAdmin.id);
    expect(after.role).toBe('SUPER_ADMIN');
    expect(after.status).toBe('ACTIVE');

    const ok = await request(app)
      .patch(`/v1/users/${superAdmin.id}`)
      .set(bearer(superAdmin))
      .send({ role: 'SUPER_ADMIN', displayName: 'Yo' });
    expect(ok.status).toBe(200);
  });

  it('refuses deleting yourself', async () => {
    const res = await request(app).post(`/v1/users/${superAdmin.id}/delete`).set(bearer(superAdmin));
    expect(res.status).toBe(409);
    expect((await row(superAdmin.id)).isDeleted).toBe(false);
  });

  it('deleting another user revokes their sessions', async () => {
    const before = await row(target.id);
    const res = await request(app).post(`/v1/users/${target.id}/delete`).set(bearer(superAdmin));
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(target.id);
    expect(res.body.data).not.toHaveProperty('passwordHash');
    const after = await row(target.id);
    expect(after.isDeleted).toBe(true);
    expect(after.refreshTokenVersion).toBe(before.refreshTokenVersion + 1);
  });

  it('restore responds without secrets', async () => {
    await request(app).post(`/v1/users/${target.id}/delete`).set(bearer(superAdmin)).expect(200);
    const res = await request(app).post(`/v1/users/${target.id}/restore`).set(bearer(superAdmin));
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(target.id);
    expect(res.body.data).not.toHaveProperty('passwordHash');
    expect((await row(target.id)).isDeleted).toBe(false);
  });

  it('lists deleted users with their flag', async () => {
    await request(app).post(`/v1/users/${target.id}/delete`).set(bearer(superAdmin)).expect(200);

    const all = await request(app).get('/v1/users?includeDeleted=true').set(bearer(superAdmin));
    expect(all.status).toBe(200);
    const rows = all.body.data as Array<Record<string, unknown>>;
    expect(rows.find((r) => r.id === target.id)?.isDeleted).toBe(true);
    expect(rows.find((r) => r.id === superAdmin.id)?.isDeleted).toBe(false);
    for (const r of rows) expect(r).not.toHaveProperty('avatar');
    for (const r of rows) {
      expect(r).not.toHaveProperty('accountNumber');
      expect(r).not.toHaveProperty('bankingKey');
    }

    const live = await request(app).get('/v1/users').set(bearer(superAdmin));
    expect((live.body.data as Array<{ id: string }>).some((r) => r.id === target.id)).toBe(false);
  });

  it("a demoted super admin's live token cannot restore their own role", async () => {
    const b = await createTestUser({ role: 'SUPER_ADMIN', email: `b-${Date.now()}@test.local` });
    const staleToken = { Authorization: `Bearer ${createTestToken(b)}` };
    await request(app).patch(`/v1/users/${b.id}`).set(bearer(superAdmin)).send({ role: 'ADMIN' }).expect(200);

    await request(app).patch(`/v1/users/${b.id}`).set(staleToken).send({ role: 'SUPER_ADMIN' }).expect(403);
    expect((await row(b.id)).role).toBe('ADMIN');
  });

  it("a deleted super admin's live token cannot restore their account", async () => {
    const b = await createTestUser({ role: 'SUPER_ADMIN', email: `b-${Date.now()}@test.local` });
    const staleToken = { Authorization: `Bearer ${createTestToken(b)}` };
    await request(app).post(`/v1/users/${b.id}/delete`).set(bearer(superAdmin)).expect(200);

    await request(app).post(`/v1/users/${b.id}/restore`).set(staleToken).expect(403);
    expect((await row(b.id)).isDeleted).toBe(true);
  });

  it("a deactivated super admin's live token cannot act", async () => {
    const b = await createTestUser({ role: 'SUPER_ADMIN', email: `b-${Date.now()}@test.local` });
    const staleToken = { Authorization: `Bearer ${createTestToken(b)}` };
    await prisma.user.update({ where: { id: b.id }, data: { status: 'INACTIVE' } });

    await request(app).get('/v1/users').set(staleToken).expect(403);
  });

  it('audits a role change', async () => {
    await request(app)
      .patch(`/v1/users/${target.id}`)
      .set(bearer(superAdmin))
      .send({ role: 'SUPER_ADMIN', status: 'INACTIVE', email: 'New.Mail@Test.local' })
      .expect(200);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entityType: 'USER', actionType: 'UPDATE', entityId: target.id },
      orderBy: { eventTimeUtc: 'desc' },
    });
    expect(audit.affectedFields).toEqual(expect.arrayContaining(['role', 'status', 'email']));
  });

  it('forbids ADMIN', async () => {
    const res = await request(app).get('/v1/users').set(bearer(target));
    expect(res.status).toBe(403);
  });
});
