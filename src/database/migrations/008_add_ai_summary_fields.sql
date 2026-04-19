ALTER TABLE base_config ADD COLUMN ai_enabled INTEGER DEFAULT 0;
ALTER TABLE base_config ADD COLUMN ai_api_url TEXT;
ALTER TABLE base_config ADD COLUMN ai_api_key TEXT;
ALTER TABLE base_config ADD COLUMN ai_model TEXT;
ALTER TABLE base_config ADD COLUMN ai_prompt TEXT;

ALTER TABLE posts ADD COLUMN source_url TEXT;
ALTER TABLE posts ADD COLUMN article_body TEXT;
ALTER TABLE posts ADD COLUMN ai_summary TEXT;
