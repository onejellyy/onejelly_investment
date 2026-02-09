-- Existing DB upgrade for news_article
-- - Add preview image field
-- - Add economy category field
-- - Keep one_liner column for backward compatibility but force NULL usage in app layer

ALTER TABLE news_article ADD COLUMN preview_image_url TEXT;
ALTER TABLE news_article ADD COLUMN category TEXT NOT NULL DEFAULT 'economy';

UPDATE news_article
SET category = 'economy'
WHERE category IS NULL OR category = '';

UPDATE news_article
SET one_liner = NULL
WHERE one_liner IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_news_category ON news_article(category, published_at DESC);
