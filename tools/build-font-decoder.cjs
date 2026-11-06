const fs = require('node:fs');
const path = require('node:path');
const { stripTypeScriptTypes } = require('node:module');
const root = path.resolve(__dirname, '..');
const vendor = path.join(root, 'vendor/ocs-font-decrypt');
const modules = ['ref-table.ts', 'worker.ts', 'bitmap.ts'].map(name => {
  const input = fs.readFileSync(path.join(vendor, name), 'utf8');
  return stripTypeScriptTypes(input, { mode: 'strip' })
    .replace(/^import .* from .*;\r?\n/gm, '')
    .replace(/^export /gm, '')
    .split(/\r?\n/).map(line => line.trimEnd()).join('\n');
}).join('\n');
const decoder = fs.readFileSync(path.join(root, 'src/font-decoder.js'), 'utf8')
  .replace('/* OCS_LICENSE */', () => '/*\n' + fs.readFileSync(path.join(vendor, 'LICENSE'), 'utf8') + '\n*/')
  .replace('/* OCS_MODULES */', () => modules)
  .replace('/* OCS_TABLE_BASE64 */', () => fs.readFileSync(path.join(vendor, 'font_ref_cx.bin')).toString('base64'));
const script = path.join(root, '学习通刷课助手.user.js');
const input = fs.readFileSync(script, 'utf8');
const start = input.indexOf('  /* ==================== 字体加密解密');
const end = input.indexOf('  /* ==================== 视频弹题处理', start);
if (start < 0 || end < 0) throw new Error('Font decoder markers missing');
fs.writeFileSync(script, (input.slice(0, start) + decoder.trimEnd() + '\n\n' + input.slice(end)).trimEnd() + '\n');
console.log('Bundled OCS bitmap decoder and offline reference table');
