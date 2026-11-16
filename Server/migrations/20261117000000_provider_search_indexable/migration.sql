-- Providers opt in to having their public booking page indexed by search engines.
ALTER TABLE "users" ADD COLUMN "searchIndexable" BOOLEAN NOT NULL DEFAULT false;
