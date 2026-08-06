BEGIN;

ALTER TABLE cw_card_variants ADD COLUMN IF NOT EXISTS edition TEXT;
ALTER TABLE cw_card_variants ADD COLUMN IF NOT EXISTS treatment TEXT;
ALTER TABLE cw_card_variants ADD COLUMN IF NOT EXISTS promo BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE cw_collection_cards ADD COLUMN IF NOT EXISTS card_id TEXT;
ALTER TABLE cw_collection_cards ADD COLUMN IF NOT EXISTS variant_id TEXT;
ALTER TABLE cw_collection_cards ADD COLUMN IF NOT EXISTS language_code TEXT;
ALTER TABLE cw_collection_cards ADD COLUMN IF NOT EXISTS finish TEXT;
ALTER TABLE cw_collection_cards ADD COLUMN IF NOT EXISTS edition TEXT;
ALTER TABLE cw_collection_cards ADD COLUMN IF NOT EXISTS condition TEXT;
ALTER TABLE cw_collection_cards ADD COLUMN IF NOT EXISTS grading_provider TEXT;
ALTER TABLE cw_collection_cards ADD COLUMN IF NOT EXISTS grade TEXT;
ALTER TABLE cw_collection_cards ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;
ALTER TABLE cw_collection_cards ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(12,2);
ALTER TABLE cw_collection_cards ADD COLUMN IF NOT EXISTS sale_value NUMERIC(12,2);
ALTER TABLE cw_collection_cards ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'EUR';

UPDATE cw_collection_cards
SET card_id = NULLIF(COALESCE(payload->>'cardId', payload->>'catalogId', payload->>'sourceId'), ''),
    variant_id = NULLIF(payload->>'variantId', ''),
    language_code = LOWER(COALESCE(NULLIF(payload->>'language', ''), NULLIF(payload->>'languageGuess', ''), NULLIF(payload->>'languageCode', ''), 'unknown')),
    finish = CASE LOWER(COALESCE(payload->>'finish', 'normal'))
      WHEN 'holo' THEN 'holo' WHEN 'reverse_holo' THEN 'reverse_holo' WHEN 'reverse holo' THEN 'reverse_holo'
      WHEN 'other' THEN 'other' ELSE 'normal' END,
    edition = CASE
      WHEN LOWER(COALESCE(payload->>'promo', 'false')) IN ('true','1','yes') THEN 'promo'
      WHEN LOWER(COALESCE(payload->>'firstEdition', 'false')) IN ('true','1','yes') THEN 'first_edition'
      WHEN LOWER(COALESCE(payload->>'edition', '')) IN ('promo','first_edition','unlimited','other') THEN LOWER(payload->>'edition')
      ELSE 'unlimited' END,
    condition = CASE LOWER(REPLACE(COALESCE(payload->>'condition', ''), ' ', '_'))
      WHEN 'near_mint' THEN 'near_mint' WHEN 'excellent' THEN 'excellent' WHEN 'good' THEN 'good'
      WHEN 'played' THEN 'played' WHEN 'poor' THEN 'poor' ELSE 'ungraded' END,
    grading_provider = NULLIF(payload->>'gradingProvider', ''),
    grade = NULLIF(payload->>'grade', ''),
    quantity = GREATEST(1, LEAST(999999, CASE
      WHEN COALESCE(payload->>'quantity', '') ~ '^\d+$' THEN (payload->>'quantity')::integer
      ELSE 1 END)),
    purchase_price = CASE WHEN COALESCE(payload->>'purchasePrice', '') ~ '^\d+([.,]\d{1,2})?$' THEN REPLACE(payload->>'purchasePrice', ',', '.')::numeric ELSE NULL END,
    sale_value = CASE WHEN COALESCE(payload->>'saleValue', payload->>'price', '') ~ '^\d+([.,]\d{1,2})?$' THEN REPLACE(COALESCE(payload->>'saleValue', payload->>'price'), ',', '.')::numeric ELSE NULL END,
    currency = UPPER(LEFT(COALESCE(NULLIF(payload->>'currency', ''), 'EUR'), 3));

UPDATE cw_collection_cards
SET variant_id = LOWER(REGEXP_REPLACE(CONCAT_WS(':',
      COALESCE(NULLIF(card_id, ''), 'unconfirmed'),
      COALESCE(NULLIF(language_code, ''), 'unknown'),
      COALESCE(NULLIF(finish, ''), 'normal'),
      COALESCE(NULLIF(edition, ''), 'unlimited'),
      CASE UPPER(COALESCE(payload->>'cardVersion', ''))
        WHEN 'V1' THEN 'standard_special'
        WHEN 'V2' THEN 'illustration_rare'
        WHEN 'V3' THEN 'special_illustration_rare'
        WHEN 'V4' THEN 'secret_rare'
        ELSE COALESCE(NULLIF(payload->>'treatment', ''), 'standard') END,
      COALESCE(NULLIF(grading_provider, ''), 'raw'),
      COALESCE(NULLIF(grade, ''), 'ungraded')
    ), '[^a-zA-Z0-9:_-]', '_', 'g'))
WHERE variant_id IS NULL OR variant_id = '';

CREATE INDEX IF NOT EXISTS cw_collection_cards_user_variant_idx ON cw_collection_cards (user_id, variant_id);

COMMIT;
