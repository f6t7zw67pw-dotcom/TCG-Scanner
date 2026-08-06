BEGIN;

CREATE TABLE IF NOT EXISTS cw_collection_cards (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT 'default',
  payload JSONB NOT NULL,
  version BIGINT NOT NULL DEFAULT 1,
  client_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

ALTER TABLE cw_collection_cards ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;
ALTER TABLE cw_collection_cards ADD COLUMN IF NOT EXISTS client_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE cw_collection_cards ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'cw_collection_cards'::regclass
      AND contype = 'p'
      AND array_length(conkey, 1) = 1
  ) THEN
    ALTER TABLE cw_collection_cards DROP CONSTRAINT cw_collection_cards_pkey;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'cw_collection_cards'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE cw_collection_cards ADD PRIMARY KEY (user_id, id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS cw_collection_cards_user_updated_idx
  ON cw_collection_cards (user_id, updated_at DESC);

COMMIT;
