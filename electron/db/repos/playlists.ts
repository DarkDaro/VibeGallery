import Database from 'better-sqlite3';

import type { PlaylistRow, VideoRow } from '../../../shared/types';

export interface PlaylistsRepo {
  list(): PlaylistRow[];
  get(id: number): PlaylistRow | undefined;
  create(name: string): PlaylistRow;
  rename(id: number, name: string): void;
  /** Removing cascades into playlist_videos (ON DELETE CASCADE). */
  remove(id: number): void;
  videosOf(id: number): VideoRow[];
  /** Adds to the end of the playlist. */
  addVideo(playlistId: number, videoId: number): void;
  removeVideo(playlistId: number, videoId: number): void;
  /** A full permutation of video_id: positions are assigned in the order of the passed array. */
  reorder(playlistId: number, videoIds: number[]): void;
}

export function createPlaylistsRepo(db: Database.Database): PlaylistsRepo {
  const statements = {
    list: db.prepare('SELECT id, name, created_at FROM playlists ORDER BY name COLLATE NOCASE'),
    get: db.prepare('SELECT id, name, created_at FROM playlists WHERE id = ?'),
    insert: db.prepare('INSERT INTO playlists(name, created_at) VALUES (?, ?)'),
    rename: db.prepare('UPDATE playlists SET name = ? WHERE id = ?'),
    remove: db.prepare('DELETE FROM playlists WHERE id = ?'),
    videosOf: db.prepare(`
      SELECT v.* FROM videos v
      JOIN playlist_videos pv ON pv.video_id = v.id
      WHERE pv.playlist_id = ?
      ORDER BY pv.position
    `),
    append: db.prepare('INSERT INTO playlist_videos(playlist_id, video_id, position) VALUES (?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM playlist_videos WHERE playlist_id = ?))'),
    removeVideo: db.prepare('DELETE FROM playlist_videos WHERE playlist_id = ? AND video_id = ?'),
    /** Shift to negative ones frees the occupied UNIQUE positions before the final permutation. */
    shiftOut: db.prepare('UPDATE playlist_videos SET position = -(position + 1000000) WHERE playlist_id = ?'),
    setPosition: db.prepare('UPDATE playlist_videos SET position = ? WHERE playlist_id = ? AND video_id = ?'),
  };

  return {
    list: () => statements.list.all() as PlaylistRow[],
    get: (id) => statements.get.get(id) as PlaylistRow | undefined,
    create(name) {
      const info = statements.insert.run(name, Date.now());
      const id = Number(info.lastInsertRowid);
      return statements.get.get(id) as PlaylistRow;
    },
    rename: (id, name) => statements.rename.run(name, id),
    remove: (id) => statements.remove.run(id),
    videosOf: (id) => statements.videosOf.all(id) as VideoRow[],
    addVideo: (playlistId, videoId) => statements.append.run(playlistId, videoId, playlistId),
    removeVideo: (playlistId, videoId) => statements.removeVideo.run(playlistId, videoId),
    reorder(playlistId, videoIds) {
      const tx = db.transaction(() => {
        statements.shiftOut.run(playlistId);
        videoIds.forEach((videoId, index) => statements.setPosition.run(index + 1, playlistId, videoId));
      });
      tx();
    },
  };
}
