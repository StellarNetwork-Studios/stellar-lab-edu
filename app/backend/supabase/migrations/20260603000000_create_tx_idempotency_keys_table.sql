-- Create idempotency keys table for transaction submission deduplication
-- Ensures duplicate submissions with the same key return consistent outcomes

CREATE TABLE IF NOT EXISTS tx_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  transaction_hash TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS tx_idempotency_keys_key_idx ON tx_idempotency_keys (idempotency_key);
CREATE INDEX IF NOT EXISTS tx_idempotency_keys_expires_idx ON tx_idempotency_keys (expires_at);
CREATE INDEX IF NOT EXISTS tx_idempotency_keys_tx_hash_idx ON tx_idempotency_keys (transaction_hash);

COMMENT ON TABLE tx_idempotency_keys IS 'Stores idempotency key results for transaction submissions. Keys expire after 24 hours to prevent infinite storage growth.';
COMMENT ON COLUMN tx_idempotency_keys.idempotency_key IS 'The unique idempotency key provided by the client.';
COMMENT ON COLUMN tx_idempotency_keys.transaction_hash IS 'The Stellar transaction hash that was submitted.';
COMMENT ON COLUMN tx_idempotency_keys.result IS 'The submission result (success/failure details) serialized as JSON.';
COMMENT ON COLUMN tx_idempotency_keys.created_at IS 'When this record was created (timestamp of first submission).';
COMMENT ON COLUMN tx_idempotency_keys.expires_at IS 'When this record should be automatically deleted (24 hours after creation).';
