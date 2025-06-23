import fs from 'fs';
import path from 'path';

export function loadQueryUsecases(): string[] {
  const dir = path.join(process.cwd(), 'query-usecases');
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
}
