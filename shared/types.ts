/** Row types for connection to repositories (shared with the renderer for UI phase). */

export type VideoStatus = 'ok' | 'unreadable' | 'missing' | 'offline' | 'excluded';

export interface VideoRow {
  id: number;
  path: string;
  source_root_id: number | null;
  folder: string;
  filename: string;
  ext: string;
  size_bytes: number;
  duration_ms: number;
  width: number;
  height: number;
  bitrate_kbps: number;
  codec: string;
  mtime_ms: number;
  added_at: number;
  modified_at: number;
  thumbnail_path: string | null;
  hash_partial: string | null;
  hash_full: string | null;
  status: VideoStatus;
  excluded: number;
  favorite: number;
  rating: number;
  watched: number;
  last_position_ms: number;
  last_played_at: number | null;
  play_count: number;
  notes: string;
}

export interface TagRow {
  id: number;
  name: string;
  color: string;
}

export interface CollectionRow {
  id: number;
  name: string;
  parent_id: number | null;
}

export interface PlaylistRow {
  id: number;
  name: string;
  created_at: number;
}

export interface SmartFilterRow {
  id: number;
  name: string;
  query: string;
  created_at: number;
}

export interface PlaylistVideoRow {
  playlist_id: number;
  video_id: number;
  position: number;
}

export interface ExclusionRow {
  id: number;
  path: string;
  type: 'path' | 'folder' | 'pattern';
}

export interface SourceRootRow {
  id: number;
  path: string;
  enabled: number;
  created_at: number;
}

export interface ScanErrorRow {
  id: number;
  source_root_id: number;
  path: string;
  error_code: string;
  message: string;
  occurred_at: number;
}

export interface DuplicateGroupRow {
  id: number;
  signature: string;
  recommended_keep_video_id: number | null;
}

export interface DuplicateMemberRow {
  group_id: number;
  video_id: number;
  role: string | null;
}
