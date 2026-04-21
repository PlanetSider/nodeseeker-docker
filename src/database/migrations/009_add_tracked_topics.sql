CREATE TABLE IF NOT EXISTS tracked_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL UNIQUE,
  topic_url TEXT NOT NULL,
  title TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  last_checked_at DATETIME DEFAULT NULL,
  last_seen_reply_count INTEGER DEFAULT 0,
  last_seen_reply_key TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tracked_topics_enabled ON tracked_topics(enabled);
CREATE INDEX IF NOT EXISTS idx_tracked_topics_post_id ON tracked_topics(post_id);

CREATE TABLE IF NOT EXISTS topic_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracked_topic_id INTEGER NOT NULL,
  reply_key TEXT NOT NULL,
  reply_author TEXT DEFAULT NULL,
  reply_content TEXT DEFAULT NULL,
  reply_time DATETIME DEFAULT NULL,
  floor_no INTEGER DEFAULT NULL,
  source_url TEXT DEFAULT NULL,
  notified INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tracked_topic_id, reply_key)
);

CREATE INDEX IF NOT EXISTS idx_topic_replies_topic_id ON topic_replies(tracked_topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_replies_notified ON topic_replies(notified);
