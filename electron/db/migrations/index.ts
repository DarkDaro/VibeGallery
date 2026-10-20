import type Database from 'better-sqlite3';

export interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

import { baseline } from './001_baseline';
import { mainSchema } from './002_main_schema';

/** Migrations are ordered by version. Each new change to the schema is a new interview record. */
export const MIGRATIONS: Migration[] = [baseline, mainSchema];
