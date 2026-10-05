import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const read = name => readFileSync(join(dir, name), 'utf8');
const spriteDir = join(dir, 'pilot-assets/game');
const spriteData = Object.fromEntries(readdirSync(spriteDir).filter(name => name.endsWith('.png')).sort().map(file => [
  file.slice(0, -4), `data:image/png;base64,${readFileSync(join(spriteDir, file)).toString('base64')}`
]));
if (Object.keys(spriteData).length !== 44) throw new Error(`素材数量应为 44，实际为 ${Object.keys(spriteData).length}`);
const game = `window.__SPRITE_DATA__=${JSON.stringify(spriteData)};\n${read('game.js')}`;
const html = read('index.html')
  .replace('<link rel="stylesheet" href="style.css">', `<style>\n${read('style.css')}\n</style>`)
  .replace('<script src="farm-logic.js"></script>', `<script>\n${read('farm-logic.js')}\n</script>`)
  .replace('<script src="game.js"></script>', `<script>\n${game}\n</script>`);
if (/\b(?:src|href)="(?:style\.css|farm-logic\.js|game\.js|pilot-assets\/game\/)/.test(html)) throw new Error('有资源未内联');
writeFileSync(join(dir, 'pocket-farm-standalone.html'), html);
console.log('已生成 pocket-farm-standalone.html');
