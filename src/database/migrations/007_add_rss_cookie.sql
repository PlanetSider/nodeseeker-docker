ALTER TABLE base_config ADD COLUMN rss_cookie TEXT;
ALTER TABLE base_config ADD COLUMN rss_cookie_expired_notified INTEGER DEFAULT 0;
