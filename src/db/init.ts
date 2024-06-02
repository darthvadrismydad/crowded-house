import fs from 'fs/promises';
import { psql } from '.';
import { exit } from 'process';

const files = await fs.readdir(import.meta.dir);

const conn = await psql();

const exclude = ['index.ts', import.meta.file];

const toInit = files.filter(f => !exclude.includes(f) || !f.endsWith('.ts')).map(async f => {
  const initScript = await import('./' + f);
  initScript?.default?.init?.()(conn);
  return f;
})

const result = await Promise.allSettled(toInit);

for (const r of result) {
  if (r.status === 'rejected') {
    console.log('failed to init', r);
  } else {
    console.log('initialized', (r as any).value);
  }
}

exit(0);
