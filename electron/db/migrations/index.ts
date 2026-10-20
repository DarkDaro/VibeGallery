import type Database from 'better-sqlite3';

export interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

import { baseline } from './001_baseline';
import { mainSchema } from './002_main_schema';
import { caseFoldingKeys } from './003_case_folding';

/** Migrations are ordered by version. Each new change to the schema is a new interview record. */
export const MIGRATIONS: Migration[] = [baseline, mainSchema, caseFoldingKeys];
