-- Public limiters use the in-memory store; brute-force-sensitive limits live on domain records.
DROP TABLE IF EXISTS "rate_limit_buckets";
