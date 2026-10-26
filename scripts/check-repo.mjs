import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

/**
 * Repo hygiene guard: heavy artifacts and local-only folders must not be tracked
 * (neither in the index nor anywhere in history). Run via `npm run repo:check`.
 */

const MAX_FILE_BYTES = 2 * 1024 * 1024;

const FORBIDDEN_PATTERNS = [
  { re: /(^|\/)node_modules\//i, why: 'зависимости не храним в репозитории' },
  { re: /(^|\/)resources\/bin\//i, why: 'ffmpeg/ffprobe скачиваются через npm run fetch:ffmpeg' },
  { re: /(^|\/)(release|dist|dist-electron|out)\//i, why: 'сборочные артефакты' },
  { re: /(^|\/)tests\/fixtures\/videos\//i, why: 'фикстуры создаются через npm run fixtures:gen' },
  { re: /(^|\/)docs\//i, why: 'локальные отчёты и документация вне гита' },
  { re: /(^|\/)(test-results|playwright-report|blob-report)\//i, why: 'отчёты прогонов' },
  { re: /\.exe$/i, why: 'исполняемые бинарники' },
  { re: /\.(db|db-wal|db-shm|db-journal|db\.bak)$/i, why: 'локальная база и бэкапы' },
  { re: /(^|\/)\.env(\.|$)/i, why: 'секреты окружения' },
];

function git(args) {
  return execFileSync('git', args, { cwd: process.cwd(), maxBuffer: 256 * 1024 * 1024 });
}

function listTracked() {
  const raw = git(['ls-files', '-z']).toString('utf8');
  return raw.split('\0').filter(Boolean);
}

function historyObjects() {
  const listing = git(['rev-list', '--objects', '--all']).toString('utf8');
  if (listing.trim() === '') return [];
  const batch = execFileSync(
    'git',
    ['cat-file', '--batch-check=%(objecttype) %(objectsize) %(rest)'],
    { cwd: process.cwd(), input: Buffer.from(listing, 'utf8'), maxBuffer: 256 * 1024 * 1024 },
  ).toString('utf8');

  const rows = [];
  for (const line of batch.split('\n')) {
    if (!line) continue;
    const [type, size, ...rest] = line.split(' ');
    if (type !== 'blob') continue;
    rows.push({ size: Number(size), path: rest.join(' ') });
  }
  return rows;
}

function checkPaths(entries, sourceLabel, problems) {
  for (const { path, size } of entries) {
    for (const rule of FORBIDDEN_PATTERNS) {
      if (rule.re.test(path)) {
        problems.push(`${sourceLabel}: ${path} (${rule.why})`);
        break;
      }
    }
    if (size !== undefined && size > MAX_FILE_BYTES) {
      problems.push(`${sourceLabel}: ${path} — ${(size / 1024 / 1024).toFixed(1)} МБ (лимит 2 МБ)`);
    }
  }
}

function main() {
  let tracked;
  try {
    tracked = listTracked();
  } catch {
    console.error('repo:check: git не найден или каталог не является репозиторием');
    process.exit(1);
  }

  const problems = [];

  const indexed = tracked.map((path) => {
    let size;
    try {
      size = fs.statSync(path).size;
    } catch {
      size = undefined;
    }
    return { path, size };
  });
  checkPaths(indexed, 'индекс', problems);

  const history = historyObjects().filter((row) => row.path);
  checkPaths(history, 'история', problems);

  const unique = [...new Set(problems)];
  if (unique.length > 0) {
    console.error('repo:check: найдены проблемы:');
    for (const p of unique) console.error(`  - ${p}`);
    console.error('Уберите файлы из индекса (git rm --cached) и добавьте их в .gitignore.');
    process.exit(1);
  }

  console.log(`repo:check: OK — ${tracked.length} файлов в индексе, тяжёлых и локальных артефактов нет`);
}

main();
