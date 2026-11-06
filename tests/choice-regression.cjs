const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const source = fs.readFileSync(path.join(__dirname, '..', '学习通刷课助手.user.js'), 'utf8');
const route = source.indexOf('  /* ==================== 路由 ==================== */');
if (route < 0) throw new Error('Cannot locate userscript route');
const instrumented = source.slice(0, route) + '\nwindow.testApi = { OCS_FONT, decodeFont, fontChecks, applyDecodedText, extractQuizQuestion, extractWorkQuestion, setQuizAnswer, answerNow, exportDiagnostics, scanQuestionFrames, solveElement, initPanel, log, setAnswers(fn) { getAnswers = fn; }, setConfig(cfg) { Object.assign(CONFIG, cfg); } };\n})();';
async function runTests() {
  const { applyDecodedText, extractQuizQuestion, extractWorkQuestion, setQuizAnswer } = window.testApi;
  const results = [];
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const fixture = (html) => { const el = document.createElement('div'); el.innerHTML = html; document.body.append(el); return el; };
  const test = (name, fn) => { try { fn(); results.push('PASS ' + name); } catch (e) { results.push('FAIL ' + name + ': ' + e.message); } };
  const quiz = (type, work = false) => fixture(`<input name="answertype1" value="${type}"><div class="${work ? 'mark_name' : 'Zy_TItle'}">题干</div><ul>${['甲', '乙', '丙'].map((t, i) => `<li><input type="${type === '1' ? 'checkbox' : 'radio'}" name="answer${Math.random()}" value="${i}"><span class="${work ? 'answer_p' : 'after'}">${t}</span></li>`).join('')}</ul>`);
  test('decode preserves nodes, listeners, images, line breaks and nested markup', () => {
    const el = fixture('<div class="font-cxsecret">甲<span class="font-cxsecret">乙</span><input type="radio"><img src="data:,"><br></div>');
    const input = el.querySelector('input'); let clicks = 0; input.addEventListener('click', () => clicks++);
    applyDecodedText([...el.querySelectorAll('.font-cxsecret')], new Map([['甲', '乙'], ['乙', '丙']]));
    assert(el.textContent === '乙丙', 'mapping cascaded or nested node processed twice');
    assert(el.querySelector('input') === input && el.querySelector('img') && el.querySelector('br'), 'DOM replaced');
    input.click(); assert(clicks === 1, 'listener lost');
    assert(!el.querySelector('.font-cxsecret'), 'encrypted class retained');
  });
  test('old quiz selects B once and rerun is idempotent', () => {
    const el = quiz('0'); let clicks = 0;
    el.querySelectorAll('input[type=radio]').forEach((n) => { n.name = 'single-old'; n.addEventListener('click', () => clicks++); });
    const q = extractQuizQuestion(el);
    assert(setQuizAnswer(['B'], q, el, window), 'selection failed');
    assert(el.querySelectorAll('input[type=radio]')[1].checked, 'wrong option');
    assert(setQuizAnswer(['B'], q, el, window) && clicks === 1, 'duplicate clicks');
    assert(setQuizAnswer(['C'], q, el, window), 'old radio not replaced');
  });
  test('work answer_p mapping ignores unrelated li', () => {
    const el = quiz('0', true); const extra = document.createElement('li'); extra.textContent = '说明'; el.prepend(extra);
    el.querySelectorAll('input[type=radio]').forEach((n) => n.name = 'single-work');
    const q = extractWorkQuestion(el);
    assert(q.options.join(',') === '甲,乙,丙', 'option index mismatch');
    assert(setQuizAnswer(['B'], q, el, window) && el.querySelectorAll('input[type=radio]')[1].checked, 'wrong work option');
  });
  test('multi choice replaces stale selection and remains selected on rerun', () => {
    const el = quiz('1'); const inputs = [...el.querySelectorAll('input[type=checkbox]')]; inputs[0].checked = true;
    const q = extractQuizQuestion(el);
    assert(setQuizAnswer(['BC'], q, el, window), 'multi selection failed');
    assert(!inputs[0].checked && inputs[1].checked && inputs[2].checked, 'wrong multi state');
    assert(setQuizAnswer(['BC'], q, el, window), 'rerun cleared selection');
  });
  test('custom row handler receives one click', () => {
    const el = fixture('<input name="answertype1" value="0"><div class="Zy_TItle">题干</div><ul><li><input type="radio"><div class="answerBg"><span class="after">甲</span></div></li></ul>');
    const row = el.querySelector('li'); let clicks = 0;
    row.addEventListener('click', () => { clicks++; row.querySelector('input').checked = true; });
    assert(setQuizAnswer(['A'], extractQuizQuestion(el), el, window) && clicks === 1, 'double click');
  });
  test('decorative container falls back to native input only when necessary', () => {
    const el = fixture('<div class="Zy_TItle">题干</div><ul><li><div class="answerBg"></div><input type="radio"><span class="after">甲</span></li></ul>');
    let clicks = 0; el.querySelector('input').addEventListener('click', () => clicks++);
    assert(setQuizAnswer(['A'], extractQuizQuestion(el), el, window) && clicks === 1, 'native fallback failed');
  });
  test('missing and disabled controls are not reported as success', () => {
    const el = quiz('0'); el.querySelectorAll('input[type=radio]')[1].disabled = true;
    assert(!setQuizAnswer(['B'], extractQuizQuestion(el), el, window), 'disabled control counted');
    const noInput = fixture('<div class="Zy_TItle">题干</div><ul><li><span class="after">甲</span></li></ul>');
    assert(!setQuizAnswer(['A'], extractQuizQuestion(noInput), noInput, window), 'unverified click counted');
  });
  test('ambiguous single answer is rejected', () => {
    const el = quiz('0'); assert(!setQuizAnswer(['AB'], extractQuizQuestion(el), el, window), 'ambiguous single accepted');
  });
  test('empty text does not shift remaining option indexes', () => {
    const el = quiz('0'); el.querySelector('.after').textContent = '';
    el.querySelectorAll('input[type=radio]').forEach((n) => n.name = 'single-empty');
    assert(setQuizAnswer(['B'], extractQuizQuestion(el), el, window) && el.querySelectorAll('input[type=radio]')[1].checked, 'index shifted');
  });
  const testAsync = async (name, fn) => { try { await fn(); results.push('PASS ' + name); } catch (e) { results.push('FAIL ' + name + ': ' + e.message); } };
  await testAsync('OCS recognizes scrambled real glyphs with the official offline reference table', async () => {
    const style = document.createElement('style'); style.id = 'fixture-font';
    style.textContent = '@font-face{font-family:font-cxsecret;src:url("data:font/otf;base64,' + window.fontFixture + '")}';
    document.head.append(style);
    const el = fixture('<div class="font-cxsecret">奣<span class="font-cxsecret">奦奪奯</span><input type="radio"><img src="data:,"></div>');
    const input = el.querySelector('input'); let clicks = 0; input.addEventListener('click', () => clicks++);
    assert(await window.testApi.decodeFont(window), 'decryption failed');
    assert(el.textContent === '精神文化', 'wrong mapping: ' + el.textContent);
    assert(el.querySelector('input') === input && el.querySelector('img'), 'controls destroyed'); input.click();
    assert(clicks === 1 && !el.querySelector('.font-cxsecret'), 'listener lost or font marker retained');
    const report = window.testApi.fontChecks.get(document);
    assert(report.method === 'ocs-bitmap-frb2' && report.changedCharacters === 4 && report.details.length === 4, 'missing OCS diagnostic');
    el.remove();
  });
  await testAsync('OCS reuses a document font mapping for newly rendered encrypted text', async () => {
    const original = window.testApi.OCS_FONT.crackFont;
    window.testApi.OCS_FONT.crackFont = () => { throw new Error('cached glyph should not be recognized twice'); };
    const el = fixture('<div class="font-cxsecret">奪奯</div>');
    try { assert(await window.testApi.decodeFont(window), 'incremental decryption failed'); assert(el.textContent === '文化', 'cache mapping incorrect'); }
    finally { window.testApi.OCS_FONT.crackFont = original; el.remove(); document.getElementById('fixture-font').remove(); }
  });
  await testAsync('failed font decoding preserves the font marker and blocks API queries', async () => {
    const el = quiz('0'); el.querySelector('.Zy_TItle').classList.add('font-cxsecret');
    let requests = 0; window.testApi.setAnswers(async () => { requests++; return ['B']; });
    assert(!await window.testApi.decodeFont(window), 'missing font reported as decoded');
    const q = extractQuizQuestion(el); const result = await window.testApi.solveElement(q, el, window);
    assert(!result.ok && !requests && el.querySelector('.font-cxsecret'), 'encrypted question sent to AI or marker removed');
    el.remove();
  });
  test('non-native before-after options select and verify through their original handlers', () => {
    const el = fixture('<div class="Zy_TItle">题干</div><ul><li class="before-after"><span class="num_option">A</span><span class="after">甲</span></li><li class="before-after"><span class="num_option">B</span><span class="after">乙</span></li></ul>');
    el.querySelectorAll('li').forEach((li) => li.onclick = () => { el.querySelectorAll('li').forEach((row) => row.classList.remove('check_answer')); li.classList.add('check_answer'); });
    assert(setQuizAnswer(['B'], extractQuizQuestion(el), el, window), 'custom single selection failed');
    assert(el.querySelectorAll('li')[1].classList.contains('check_answer'), 'wrong non-native option');
  });
  await testAsync('answer now finds nested frame without waiting for video and does not submit', async () => {
    document.body.replaceChildren();
    const video = document.createElement('video'); document.body.append(video);
    const frame = document.createElement('iframe'); document.body.append(frame);
    const style = frame.contentDocument.createElement('style');
    style.textContent = '@font-face{font-family:font-cxsecret;src:url("data:font/otf;base64,' + window.fontFixture + '")}';
    frame.contentDocument.head.append(style);
    frame.contentDocument.body.innerHTML = '<div class="questionLi"><input name="answertype1" value="0"><div class="mark_name font-cxsecret">奣奦</div><ul><li><input type="radio" name="nested"><span class="answer_p font-cxsecret">奪奯</span></li><li><input type="radio" name="nested"><span class="answer_p font-cxsecret">奣奦</span></li></ul></div>';
    let requests = 0, submits = 0;
    window.testApi.setAnswers(async (q) => {
      requests++;
      assert(q.question === '精神' && q.options.join(',') === '文化,精神', 'AI received encrypted text');
      return ['B'];
    });
    window.btnBlueSubmit = frame.contentWindow.btnBlueSubmit = () => submits++;
    window.testApi.initPanel();
    const button = document.getElementById('cxAnswerNow'); assert(button && document.getElementById('cxDiagnose'), 'buttons missing');
    await window.testApi.answerNow();
    assert(requests === 1 && frame.contentDocument.querySelectorAll('input[type=radio]')[1].checked, 'nested question not answered');
    assert(video.currentTime === 0 && submits === 0 && !button.disabled, 'manual action changed video, submitted, or button stayed disabled');
  });
  await testAsync('parallel requests for same question share one API call', async () => {
    const el = quiz('0'); el.querySelectorAll('input[type=radio]').forEach((n) => n.name = 'shared');
    const q = extractQuizQuestion(el); let requests = 0;
    window.testApi.setAnswers(async () => { requests++; await Promise.resolve(); return ['B']; });
    const outcomes = await Promise.all([window.testApi.solveElement(q, el, window), window.testApi.solveElement(q, el, window)]);
    assert(requests === 1 && outcomes.every((o) => o.ok), 'concurrent API calls or writes');
  });
  await testAsync('diagnostic export includes answers and state but excludes API key', async () => {
    window.testApi.setConfig({ aiEnabled: true, aiKey: 'secret-test-key' });
    let captured;
    const create = URL.createObjectURL, revoke = URL.revokeObjectURL, click = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = (blob) => { captured = blob; return 'blob:diagnostic-test'; };
    URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = () => {};
    try {
      window.testApi.exportDiagnostics();
      const text = await captured.text(); const data = JSON.parse(text);
      assert(!text.includes('secret-test-key') && data.checks.length >= 2, 'missing checks or exposed key');
      assert(data.checks.at(-1).after.options[1].checked && data.checks.at(-1).answers[0] === 'B', 'missing state or answer');
    } finally { URL.createObjectURL = create; URL.revokeObjectURL = revoke; HTMLAnchorElement.prototype.click = click; }
  });
  test('question text in logs is rendered as text', () => {
    window.testApi.log('<img id="injected-log-node" src=x>');
    assert(!document.getElementById('injected-log-node'), 'HTML injected through log');
  });
  const out = document.createElement('pre'); out.id = 'result'; out.textContent = results.join('\n'); document.body.replaceChildren(out);
}
const browser = process.env.TEST_BROWSER || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
if (!browser) throw new Error('Set TEST_BROWSER to a Chromium executable');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cx-regression-'));
try {
  const html = path.join(temp, 'test.html');
  const fixtureBase64 = fs.readFileSync(path.join(__dirname, 'fixtures/encrypted-source-han.otf')).toString('base64');
  fs.writeFileSync(html, '<!doctype html><meta charset="utf-8"><body><script>window.fontFixture=' + JSON.stringify(fixtureBase64) + ';\n' + instrumented.replace(/<\/script/gi, '<\\/script') + '\n(' + runTests.toString() + ')();</script>');
  const run = spawnSync(browser, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--virtual-time-budget=15000', '--user-data-dir=' + path.join(temp, 'profile'), '--dump-dom', require('node:url').pathToFileURL(html).href], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  const match = (run.stdout || '').match(/<pre id="result">([\s\S]*?)<\/pre>/);
  if (!match) throw new Error('Browser did not return results: ' + (run.error || run.stderr || run.stdout));
  console.log(match[1]);
  if (match[1].includes('FAIL ')) process.exitCode = 1;
} finally {
  // Only remove the unique test directory created by mkdtemp above.
  fs.rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
