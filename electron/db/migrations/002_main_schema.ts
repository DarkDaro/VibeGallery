/**
 * Main library schema. Version 2.
 * Circular check for collections and uniqueness of paths are handled in repositories,
 * the schemas reflect the master-prompt as closely as possible.
 */
import type Database from 'better-sqlite3';

import type { Migration } from './index';

export const mainSchema: Migration = {
  version: 2,
  name: 'main library schema + FTS5',
  up(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS source_roots (
        id         INTEGER PRIMARY KEY,
        path       TEXT NOT NULL UNIQUE COLLATE NOCASE,
        enabled    INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS videos (
        id               INTEGER PRIMARY KEY,
        path             TEXT NOT NULL UNIQUE COLLATE NOCASE,
        source_root_id   INTEGER REFERENCES source_roots(id) ON DELETE SET NULL,
        folder           TEXT NOT NULL,
        filename         TEXT NOT NULL,
        ext              TEXT NOT NULL,
        size_bytes       INTEGER NOT NULL DEFAULT 0,
        duration_ms      INTEGER NOT NULL DEFAULT 0,
        width            INTEGER NOT NULL DEFAULT 0,
        height           INTEGER NOT NULL DEFAULT 0,
        bitrate_kbps     INTEGER NOT NULL DEFAULT 0,
        codec            TEXT NOT NULL DEFAULT '',
        mtime_ms         INTEGER NOT NULL DEFAULT 0,
        added_at         INTEGER NOT NULL,
        modified_at      INTEGER NOT NULL,
        thumbnail_path   TEXT,
        hash_partial     TEXT,
        hash_full        TEXT,
        status           TEXT NOT NULL DEFAULT 'ok'
                         CHECK (status IN ('ok','unreadable','missing','offline','excluded')),
        excluded         INTEGER NOT NULL DEFAULT 0,
        favorite         INTEGER NOT NULL DEFAULT 0,
        rating           INTEGER NOT NULL DEFAULT 0,
        watched          INTEGER NOT NULL DEFAULT 0,
        last_position_ms INTEGER NOT NULL DEFAULT 0,
        last_played_at   INTEGER,
        play_count       INTEGER NOT NULL DEFAULT 0,
        notes            TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS scan_errors (
        id             INTEGER PRIMARY KEY,
        source_root_id INTEGER REFERENCES source_roots(id) ON DELETE CASCADE,
        path           TEXT NOT NULL,
        error_code     TEXT NOT NULL,
        message        TEXT NOT NULL,
        occurred_at    INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_scan_errors_root ON scan_errors(source_root_id);

      CREATE TABLE IF NOT EXISTS tags (
        id    INTEGER PRIMARY KEY,
        name  TEXT NOT NULL UNIQUE COLLATE NOCASE,
        color TEXT NOT NULL DEFAULT '#7f7f7f'
      );

      CREATE TABLE IF NOT EXISTS video_tags (
        video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
        tag_id   INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (video_id, tag_id)
      );
      CREATE INDEX IF NOT EXISTS idx_video_tags_tag ON video_tags(tag_id);

      CREATE TABLE IF NOT EXISTS collections (
        id        INTEGER PRIMARY KEY,
        name      TEXT NOT NULL,
        parent_id INTEGER REFERENCES collections(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_collections_parent ON collections(parent_id);

      CREATE TABLE IF NOT EXISTS collection_videos (
        collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
        video_id      INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
        PRIMARY KEY (collection_id, video_id)
      );
      CREATE INDEX IF NOT EXISTS idx_collection_videos_video ON collection_videos(video_id);

      CREATE TABLE IF NOT EXISTS playlists (
        id         INTEGER PRIMARY KEY,
        name       TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS playlist_videos (
        playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
        video_id    INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
        position    INTEGER NOT NULL,
        UNIQUE (playlist_id, position)
      );
      CREATE INDEX IF NOT EXISTS idx_playlist_videos_video ON playlist_videos(video_id);

      CREATE TABLE IF NOT EXISTS smart_filters (
        id         INTEGER PRIMARY KEY,
        name       TEXT NOT NULL,
        query      TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS duplicate_groups (
        id                        INTEGER PRIMARY KEY,
        signature                 TEXT NOT NULL,
        recommended_keep_video_id INTEGER REFERENCES videos(id) ON DELETE SET NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_duplicate_groups_sig ON duplicate_groups(signature);

      CREATE TABLE IF NOT EXISTS duplicate_members (
        group_id INTEGER NOT NULL REFERENCES duplicate_groups(id) ON DELETE CASCADE,
        video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
        role     TEXT,
        PRIMARY KEY (group_id, video_id)
      );
      CREATE INDEX IF NOT EXISTS idx_duplicate_members_video ON duplicate_members(video_id);

      CREATE TABLE IF NOT EXISTS exclusions (
        id   INTEGER PRIMARY KEY,
        path TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('path','folder','pattern'))
      );

      CREATE INDEX IF NOT EXISTS idx_videos_size       ON videos(size_bytes);
      CREATE INDEX IF NOT EXISTS idx_videos_duration   ON videos(duration_ms);
      CREATE INDEX IF NOT EXISTS idx_videos_added_at   ON videos(added_at);
      CREATE INDEX IF NOT EXISTS idx_videos_modified   ON videos(modified_at);
      CREATE INDEX IF NOT EXISTS idx_videos_status     ON videos(status);
      CREATE INDEX IF NOT EXISTS idx_videos_source     ON videos(source_root_id);
      CREATE INDEX IF NOT EXISTS idx_videos_folder     ON videos(folder);

      CREATE VIRTUAL TABLE IF NOT EXISTS videos_fts USING fts5(
        video_id UNINDEXED, filename, tags_text, notes, collection_names
      );
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS videos_fts_ai AFTER INSERT ON videos BEGIN
        INSERT INTO videos_fts(video_id, filename, tags_text, notes, collection_names)
        VALUES (new.id, new.filename, '', new.notes, '');
      END;

      CREATE TRIGGER IF NOT EXISTS videos_fts_ad AFTER DELETE ON videos BEGIN
        DELETE FROM videos_fts WHERE video_id = old.id;
      END;

      CREATE TRIGGER IF NOT EXISTS videos_fts_au AFTER UPDATE ON videos BEGIN
        UPDATE videos_fts
        SET filename = new.filename, notes = new.notes
        WHERE video_id = new.id;
      END;

      CREATE TRIGGER IF NOT EXISTS video_tags_fts_ai AFTER INSERT ON video_tags BEGIN
        UPDATE videos_fts SET tags_text = (
          SELECT group_concat(t.name, ' ')
          FROM video_tags vt JOIN tags t ON t.id = vt.tag_id
          WHERE vt.video_id = NEW.video_id
        ) WHERE video_id = NEW.video_id;
      END;

      CREATE TRIGGER IF NOT EXISTS video_tags_fts_ad AFTER DELETE ON video_tags BEGIN
        UPDATE videos_fts SET tags_text = (
          SELECT group_concat(t.name, ' ')
          FROM video_tags vt JOIN tags t ON t.id = vt.tag_id
          WHERE vt.video_id = OLD.video_id
        ) WHERE video_id = OLD.video_id;
      END;

      CREATE TRIGGER IF NOT EXISTS collection_videos_fts_ai AFTER INSERT ON collection_videos BEGIN
        UPDATE videos_fts SET collection_names = (
          SELECT group_concat(c.name, ' ')
          FROM collection_videos cv JOIN collections c ON c.id = cv.collection_id
          WHERE cv.video_id = NEW.video_id
        ) WHERE video_id = NEW.video_id;
      END;

      CREATE TRIGGER IF NOT EXISTS collection_videos_fts_ad AFTER DELETE ON collection_videos BEGIN
        UPDATE videos_fts SET collection_names = (
          SELECT group_concat(c.name, ' ')
          FROM collection_videos cv JOIN collections c ON c.id = cv.collection_id
          WHERE cv.video_id = OLD.video_id
        ) WHERE video_id = OLD.video_id;
      END;
    `);
  },
};
