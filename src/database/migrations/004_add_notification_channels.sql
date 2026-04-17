ALTER TABLE base_config ADD COLUMN serverchan_enabled INTEGER DEFAULT 0;
ALTER TABLE base_config ADD COLUMN serverchan_uid TEXT;
ALTER TABLE base_config ADD COLUMN serverchan_sendkey TEXT;
ALTER TABLE base_config ADD COLUMN meow_enabled INTEGER DEFAULT 0;
ALTER TABLE base_config ADD COLUMN meow_endpoint TEXT;
ALTER TABLE base_config ADD COLUMN meow_token TEXT;
