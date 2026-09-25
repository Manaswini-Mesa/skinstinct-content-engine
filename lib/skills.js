import fs from 'fs';
import path from 'path';

const cache = {};
export function loadSkill(name) {
  if (!cache[name]) {
    const p = path.join(process.cwd(), 'skills', name, 'SKILL.md');
    cache[name] = fs.readFileSync(p, 'utf8');
  }
  return cache[name];
}
