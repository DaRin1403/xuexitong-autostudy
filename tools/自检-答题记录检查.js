#!/usr/bin/env node
/**
 * 答题记录自检工具（通用版，零依赖）
 * ---------------------------------------------------------------
 * 用途：把你「刷题/自测」过程中记录的「题号 → 答案」文本丢进来，
 *       自动检查：有没有漏题、多选题是不是只填了一个、有没有连续多题同答案（点漏高危）。
 *
 * 用法：
 *   node tools/自检-答题记录检查.js 答题记录.txt
 *   node tools/自检-答题记录检查.js 答题记录.txt --total=50 --single=1-15 --multi=16-30 --judge=31-50
 *
 * 记录文件长什么样都行，只要题号和答案挨着。以下写法都能识别：
 *   第12题 → C          12 → C         12. C        12、C
 *   Q12 → CD            第12题答案：CD  12：正确      第12题 C
 *
 * 退出码：0 = 无致命问题；1 = 发现漏题/多选只填一项等问题
 */
'use strict';
const fs = require('fs');

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
if (!file) {
  console.log('用法: node tools/自检-答题记录检查.js <记录文件> [--total=50] [--single=1-15] [--multi=16-30] [--judge=31-50]');
  process.exit(2);
}
const opt = (name, def) => {
  const hit = args.find((a) => a.startsWith('--' + name + '='));
  return hit ? hit.split('=')[1] : def;
};
const range = (s) => {
  if (!s) return null;
  const m = String(s).match(/^(\d+)-(\d+)$/);
  if (!m) return null;
  const lo = +m[1], hi = +m[2];
  const out = [];
  for (let i = lo; i <= hi; i++) out.push(i);
  return out;
};

const SINGLE = range(opt('single', ''));
const MULTI = range(opt('multi', ''));
const JUDGE = range(opt('judge', ''));
const text = fs.readFileSync(file, 'utf8');

// 抓「题号 + 答案」：答案取 A-H 字母串，或 对/错/正确/错误
const RX = [
  /第\s*(\d{1,3})\s*题[^\n]{0,20}?[→➜⇒:：]\s*[*\s]*([A-H]{1,8}|正确|错误|对|错)/g,
  /(?:^|[^A-Za-z0-9])Q\s*(\d{1,3})\s*[→➜⇒:：]\s*[*\s]*([A-H]{1,8}|正确|错误|对|错)/g,
  /(?:^|[^0-9])(\d{1,3})\s*[.、)）:：]\s*([A-H]{1,8}|正确|错误|对|错)(?![A-Za-z0-9])/g,
  /(?:^|[^0-9])(\d{1,3})\s*[→➜⇒]\s*([A-H]{1,8}|正确|错误|对|错)/g,
];
const found = new Map();  // 题号 -> Set(答案)
for (const rx of RX) {
  let m;
  rx.lastIndex = 0;
  while ((m = rx.exec(text)) !== null) {
    const q = parseInt(m[1], 10);
    const a = m[2].toUpperCase().replace(/^正确$/, '对').replace(/^错误$/, '错');
    if (q < 1 || q > 999) continue;
    if (!found.has(q)) found.set(q, new Set());
    found.get(q).add(a);
  }
}
if (!found.size) {
  console.log('❌ 没从文件里识别到任何「题号 + 答案」。请确认记录里题号和答案相邻（例：第12题 → C）。');
  process.exit(1);
}

const nums = [...found.keys()].sort((a, b) => a - b);
const total = parseInt(opt('total', String(nums[nums.length - 1])), 10);
const missing = [];
for (let i = 1; i <= total; i++) if (!found.has(i)) missing.push(i);

const pick = (ans) => {                       // 取这道题最终答案（多条记录取最后出现的字母数最多的那条）
  const arr = [...ans];
  return arr.sort((a, b) => b.replace(/[^A-H]/g, '').length - a.replace(/[^A-H]/g, '').length)[0];
};
const rows = nums.map((q) => ({ q, ans: pick(found.get(q)), all: [...found.get(q)] }));

const problems = [];
// 1) 漏题
if (missing.length) problems.push(`漏题：第 ${missing.join('、')} 题（共 ${missing.length} 题没记录）`);
// 2) 多选题只填了一个字母
if (MULTI) for (const r of rows) {
  if (!MULTI.includes(r.q)) continue;
  const letters = r.ans.replace(/[^A-H]/g, '');
  if (letters.length < 2) problems.push(`第 ${r.q} 题是多选，却只有 1 个选项（${r.ans || '空'}）——多选必须 ≥2 项，单选即错`);
}
// 3) 单选题/判断题给了多个答案
if (SINGLE) for (const r of rows) {
  if (!SINGLE.includes(r.q)) continue;
  if (r.ans.replace(/[^A-H]/g, '').length > 1) problems.push(`第 ${r.q} 题是单选，却给了多个选项（${r.ans}）`);
}
if (JUDGE) for (const r of rows) {
  if (!JUDGE.includes(r.q)) continue;
  if (!/^[对错]$/.test(r.ans)) problems.push(`第 ${r.q} 题是判断题，答案不是 对/错（${r.ans}）`);
}
// 4) 连续同答案（点漏/串位高危）
let run = 1;
for (let i = 1; i < rows.length; i++) {
  if (rows[i].q === rows[i - 1].q + 1 && rows[i].ans === rows[i - 1].ans) {
    run++;
    if (run === 5) {
      const from = rows[i - run + 1].q;
      problems.push(`第 ${from}~${rows[i].q} 题连续 ${run}+ 题答案都是「${rows[i].ans}」——复核这几题在答题卡上是否真的都点上了`);
    }
  } else run = 1;
}
// 5) 同一题出现互相矛盾的答案
for (const r of rows) if (r.all.length > 1) {
  const uniq = [...new Set(r.all.map((x) => x.replace(/[^A-H对错]/g, '')))];
  if (uniq.length > 1) problems.push(`第 ${r.q} 题记录里有互相矛盾的答案：${r.all.join(' / ')}`);
}

console.log('== 自检结果 ==');
console.log(`记录题号 ${nums.length} 个 / 应有 ${total} 题；答案区间 ${nums[0]}~${nums[nums.length - 1]}`);
const line = [];
rows.forEach((r) => line.push(`${r.q}=${r.ans}`));
console.log('速查：' + line.join(' '));
if (problems.length) {
  console.log('\n⚠️ 发现 ' + problems.length + ' 个问题：');
  problems.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
  process.exit(1);
}
console.log('\n✅ 未发现问题（题号连续、题型答案格式正常、无连续同答案疑点）');
