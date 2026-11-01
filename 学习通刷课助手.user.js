// ==UserScript==
// @name         学习通刷课助手
// @namespace    cx-auto-study
// @version      1.0.11
// @description  学习通任务点自动完成:视频/音频静音连播、智能进度条拖动、同节多标签页遍历、弹题与测验自动答题(内置TTF字形解密 + 多平台AI作答)、二次弹窗安全确认、任务点完成检测与保底重试
// @author       cx-auto-study contributors
// @license      MIT
// @homepageURL  https://github.com/DaRin1403/xuexitong-autostudy
// @supportURL   https://github.com/DaRin1403/xuexitong-autostudy/issues
// @match        *://*.chaoxing.com/*
// @run-at       document-end
// @grant        GM_getValue
// @grant        GM_info
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @connect      api.tikuhai.com
// @connect      cx.icodef.com
// @connect      tk.enncy.cn
// @connect      api.muketool.com
// @connect      api.deepseek.com
// @connect      api.siliconflow.cn
// @connect      api.minimaxi.com
// @connect      open.bigmodel.cn
// @connect      dashscope.aliyuncs.com
// @connect      api.moonshot.cn
// @connect      api.openai.com
// @connect      www.forestpolice.org
// @connect      cdn.jsdelivr.net
// @connect      *
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  /* ==================== AI 平台预设 ==================== */
  const PROVIDERS = {
    deepseek: { name: 'DeepSeek', url: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-chat' },
    siliconflow: { name: '硅基流动', url: 'https://api.siliconflow.cn/v1/chat/completions', model: 'deepseek-ai/DeepSeek-V3' },
    minimax: { name: 'MiniMax', url: 'https://api.minimaxi.com/v1/chat/completions', model: 'MiniMax-Text-01' },
    zhipu: { name: '智谱 AI', url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', model: 'glm-4-plus' },
    qwen: { name: '通义千问', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', model: 'qwen-plus' },
    kimi: { name: 'Kimi', url: 'https://api.moonshot.cn/v1/chat/completions', model: 'moonshot-v1-8k' },
    openai: { name: 'OpenAI', url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
    custom: { name: '自定义', url: '', model: '' }
  };

  function inferProviderFromUrl(url) {
    const u = String(url || '').trim();
    for (const [k, v] of Object.entries(PROVIDERS)) {
      if (k !== 'custom' && v.url && u.startsWith(v.url.replace(/\/chat\/completions$/, ''))) return k;
    }
    return u ? 'custom' : 'deepseek';
  }

  /* ==================== 配置 ==================== */
  const DEFAULT_CONFIG = {
    speed: 2,                  // 视频倍速(默认 2x 最快;1 = 原速最安全)
    dragVideoProgress: false,  // 拖动视频进度条(仅对完成条件为时长>90%且未禁拖拽的视频生效)
    autoVideo: true,           // 自动处理视频任务
    autoAudio: true,           // 自动处理音频任务
    autoWork: true,            // 自动做章节测验
    autoSubmit: true,          // 作答覆盖率达标自动提交测验
    autoJump: true,            // 本章完成后自动切下一章(含同小节多标签页遍历)
    answerIntervalMin: 0,      // 每题最小间隔(秒,0=最快)
    answerIntervalMax: 0,      // 每题最大间隔(秒,0=最快)
    submitDelayMin: 0,         // 提交前最小延迟(秒,0=最快)
    submitDelayMax: 0,         // 提交前最大延迟(秒,0=最快)
    minAccuracy: 0.6,          // 最低作答覆盖率,低于则暂存不提交
    quizDelayMin: 0,           // 弹题作答前等待(秒,0=最快)
    quizDelayMax: 0,
    dailyLimitMinutes: 0,      // 每日刷课时长上限(分钟),0 = 不限
    deliberateErrorRate: 0,    // 故意答错率 0~0.2(0=不故意错)
    aiEnabled: false,          // 启用 AI 答题(需填 key)
    aiProvider: 'deepseek',    // 当前选择的 AI 平台
    aiKey: '',                 // 个人 API Key:点面板 ⚙ 填写(只存本机)
    aiUrl: 'https://api.deepseek.com/v1/chat/completions',
    aiModel: 'deepseek-chat',
    useTiku: false,            // 免费题库站(默认关闭,纯 AI 答题)
    reportUrl: '',             // 状态上报地址(调试用,留空=关闭)
  };

  function loadConfig() {
    try {
      const saved = (typeof GM_getValue !== 'undefined')
        ? GM_getValue('cxConfig', null)
        : JSON.parse(localStorage.getItem('cxConfig') || 'null');
      if (saved && typeof saved === 'object') {
        const cfg = Object.assign({}, DEFAULT_CONFIG, saved);
        if (!saved.aiProvider || !PROVIDERS[saved.aiProvider]) {
          cfg.aiProvider = inferProviderFromUrl(cfg.aiUrl);
        }
        return cfg;
      }
    } catch (e) { /* ignore */ }
    return Object.assign({}, DEFAULT_CONFIG);
  }
  function saveConfig(cfg) {
    try {
      if (typeof GM_setValue !== 'undefined') GM_setValue('cxConfig', cfg);
      else localStorage.setItem('cxConfig', JSON.stringify(cfg));
    } catch (e) { /* ignore */ }
  }
  let CONFIG = loadConfig();
  try {
    const MIG = 'cxMigV105';
    const done = (typeof GM_getValue !== 'undefined') ? GM_getValue(MIG, false) : localStorage.getItem(MIG);
    if (!done) {
      CONFIG.dailyLimitMinutes = 0;
      CONFIG.speed = 2;
      saveConfig(CONFIG);
      if (typeof GM_setValue !== 'undefined') GM_setValue(MIG, true);
      else localStorage.setItem(MIG, '1');
    }
  } catch (e) { /* ignore */ }
  if (CONFIG.speed > 2) { CONFIG.speed = 2; }

  /* 题目收集器 */
  let COLLECTED = [];
  try {
    COLLECTED = (typeof GM_getValue !== 'undefined')
      ? GM_getValue('cxQuestions', [])
      : JSON.parse(localStorage.getItem('cxQuestions') || '[]');
    if (!Array.isArray(COLLECTED)) COLLECTED = [];
  } catch (e) { COLLECTED = []; }
  function recordQuestion(q, answer) {
    try {
      COLLECTED.push({ q: q.question, t: String(q.type), o: (q.options || []).join('§'), a: (answer || []).join('|') });
      if (COLLECTED.length > 5000) COLLECTED = COLLECTED.slice(-5000);
      if (typeof GM_setValue !== 'undefined') GM_setValue('cxQuestions', COLLECTED);
      else localStorage.setItem('cxQuestions', JSON.stringify(COLLECTED));
    } catch (e) { /* ignore */ }
  }
  function exportQuestions() {
    if (!COLLECTED.length) { log('📋 还没有收集到题目(做完学习检测/弹题后自动收集)', 'warn'); return; }
    const data = JSON.stringify(COLLECTED);
    const done = () => log(`📋 已导出 ${COLLECTED.length} 道题,全选复制发给 AI 助手`, 'ok');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(data).then(done).catch(() => { showExportBox(data); });
      } else showExportBox(data);
    } catch (e) { showExportBox(data); }
  }
  function showExportBox(data) {
    const ta = document.createElement('textarea');
    ta.value = data;
    ta.style.cssText = 'position:fixed;left:16px;bottom:16px;width:460px;height:220px;z-index:2147483647;background:rgba(255,255,255,0.95);color:#3b3b43;border:1px solid rgba(255,255,255,0.6);border-radius:8px;padding:8px;font:12px monospace;box-shadow:0 8px 32px rgba(160,60,120,0.22)';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    ta.addEventListener('blur', () => { try { ta.remove(); } catch (e) {} });
    log('📋 题目数据已生成在左下角文本框,全选(Ctrl+A)复制后发给 AI 助手', 'ok');
  }

  /* ==================== 工具函数 ==================== */
  const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));
  const randomSleep = (min, max) => sleep(Math.floor(Math.random() * (max - min + 1)) + min);

  function waitElementLoaded(win, selector, timeoutMs = 60000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const timer = setInterval(() => {
        try {
          if (win.document.querySelector(selector)) { clearInterval(timer); resolve(); return; }
        } catch (e) { /* iframe 未就绪 */ }
        if (Date.now() - start > timeoutMs) { clearInterval(timer); reject(new Error('等待元素超时: ' + selector)); }
      }, 200);
    });
  }

  function waitIframeLoaded(iframe, timeoutMs = 60000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const timer = setInterval(() => {
        try {
          if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') { clearInterval(timer); resolve(); return; }
        } catch (e) { /* ignore */ }
        if (Date.now() - start > timeoutMs) { clearInterval(timer); reject(new Error('iframe 加载超时')); }
      }, 200);
    });
  }

  function clean(html) {
    if (html == null) return '';
    return String(html)
      .replace(/<((?!img|sub|sup|br)[^>]+)>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .trim();
  }
  const cl = (str) => String(str).replace(/^【.*?】\s*/, '').replace(/\s*[（(]\d+(\.\d+)?分[）)]$/, '');

  function cxFetch(url, { method = 'GET', data = null, headers = {}, timeout = 10000 } = {}) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== 'undefined') {
        GM_xmlhttpRequest({
          method, url, data, headers, timeout,
          onload: (res) => resolve(res.responseText),
          onerror: (err) => reject(err),
          ontimeout: () => reject(new Error('timeout'))
        });
      } else {
        fetch(url, { method, headers, body: data }).then((r) => r.text()).then(resolve).catch(reject);
      }
    });
  }

  /* ==================== 日志面板 ==================== */
  let logPanel = null;
  let logLines = [];

  function setStatus(text, isWarn = false) {
    const el = document.getElementById('cxStatus');
    if (el) {
      el.textContent = text;
      el.style.color = isWarn ? '#dc2626' : '#15803d';
      el.style.fontWeight = isWarn ? '700' : '400';
    }
    const btn = document.getElementById('cxRunBtn');
    if (btn) btn.textContent = (text.startsWith('工作中') && !PAUSED) ? '⏸' : '▶';
  }

  function log(msg, level = 'info') {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    const line = `[${time}] ${msg}`;
    const color = level === 'ok' ? '#7ee787' : level === 'warn' ? '#f0b72f' : level === 'err' ? '#f85149' : '#58a6ff';
    console.log(`%c[刷课助手] ${line}`, `color:${color}`);
    if (logPanel) {
      logLines.push({ line, level });
      if (logLines.length > 60) logLines.shift();
      const logsEl = document.getElementById('cxLogs');
      if (logsEl) {
        logsEl.innerHTML = logLines.map((l) => `<div class="${l.level}">${l.line}</div>`).join('');
        logsEl.scrollTop = logsEl.scrollHeight;
      }
    }
    scheduleReport();
  }

  let lastReportAt = 0;
  let reportTimer = null;
  function scriptVersion() {
    try { if (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version) return GM_info.script.version; } catch (e) { /* ignore */ }
    return '1.0.11';
  }
  function buildSnapshot() {
    const v = document.querySelector('video');
    const jobs = Array.from(document.querySelectorAll('.ans-job-icon'));
    const statusEl = document.getElementById('cxStatus');
    return {
      at: Date.now(),
      time: new Date().toLocaleString('zh-CN'),
      version: scriptVersion(),
      url: location.href,
      title: document.title,
      status: statusEl ? statusEl.textContent : '',
      config: {
        speed: CONFIG.speed, dragVideoProgress: CONFIG.dragVideoProgress,
        aiEnabled: CONFIG.aiEnabled, aiProvider: CONFIG.aiProvider, aiModel: CONFIG.aiModel,
        useTiku: CONFIG.useTiku, dailyLimitMinutes: CONFIG.dailyLimitMinutes,
        autoSubmit: CONFIG.autoSubmit, autoJump: CONFIG.autoJump,
        minAccuracy: CONFIG.minAccuracy, deliberateErrorRate: CONFIG.deliberateErrorRate,
        answerIntervalMin: CONFIG.answerIntervalMin, submitDelayMin: CONFIG.submitDelayMin
      },
      video: v ? {
        cur: Math.round(v.currentTime), dur: Math.round(v.duration) || null,
        rate: v.playbackRate, paused: v.paused, muted: v.muted
      } : null,
      jobsOld: jobs.length ? {
        total: jobs.length,
        finished: jobs.filter((e) => e.classList.contains('ans-job-finished')).length
      } : null,
      cards: document.querySelectorAll('mooc-ans, .knowledge-card').length,
      frames: Array.from(document.querySelectorAll('iframe')).map((f) => (f.src || '').slice(0, 120)).slice(0, 12),
      quiz: {
        TiMu: document.querySelectorAll('.TiMu').length,
        questionLi: document.querySelectorAll('.questionLi').length,
        fontEnc: document.querySelectorAll('.font-cxsecret').length,
        checked: document.querySelectorAll('input[type=radio]:checked, input[type=checkbox]:checked').length
      },
      logs: logLines.slice(-25).map((l) => l.line)
    };
  }
  function pushReport(force) {
    const url = (CONFIG.reportUrl || '').trim();
    if (!url) return;
    const now = Date.now();
    if (!force && now - lastReportAt < 4000) return;
    lastReportAt = now;
    try {
      GM_xmlhttpRequest({
        method: 'POST',
        url: url,
        data: JSON.stringify(buildSnapshot()),
        headers: { 'Content-Type': 'application/json' },
        timeout: 4000,
        onerror: () => {},
        ontimeout: () => {}
      });
    } catch (e) { /* ignore */ }
  }
  function scheduleReport() {
    if (reportTimer) return;
    reportTimer = setTimeout(() => { reportTimer = null; pushReport(true); }, 800);
  }
  function startReporterHeartbeat() {
    if (!(CONFIG.reportUrl || '').trim()) return;
    pushReport(true);
    setInterval(() => pushReport(false), 10000);
  }

  function initPanel() {
    if (logPanel && document.getElementById('cx-panel')) return;
    if (!document.body) {
      window.addEventListener('DOMContentLoaded', initPanel, { once: true });
      return;
    }
    logPanel = document.createElement('div');
    logPanel.id = 'cx-panel';
    logPanel.innerHTML =
      '<div id="cxTitle" title="按住此处可拖动面板">📚 学习通刷课助手 <span id="cxStatus">待机</span><span id="cxRunBtn" title="开始/停止挂机">▶</span><span id="cxToggleBtn" title="展开/收起日志">▼</span><span id="cxCfgBtn" title="配置">⚙</span></div>' +
      '<div id="cxLogs"></div>';
    const style = document.createElement('style');
    style.textContent =
      '#cx-panel{position:fixed;right:16px;bottom:16px;width:370px;max-height:290px;overflow:hidden;background:linear-gradient(rgba(252,232,243,0.97),rgba(248,224,238,0.94));color:#3b3b43;border:1px solid rgba(255,255,255,0.6);border-radius:12px;font:12px/1.6 "Microsoft YaHei",sans-serif;z-index:2147483647;box-shadow:inset 0 1px 0 rgba(255,255,255,0.85),0 8px 32px rgba(160,60,120,0.22);backdrop-filter:blur(14px) saturate(160%)}' +
      '#cxTitle{padding:8px 12px;font-weight:600;cursor:move;display:flex;gap:8px;align-items:center;color:#3b3b43;background:linear-gradient(rgba(238,161,195,0.82),rgba(228,146,184,0.68));border-bottom:1px solid rgba(255,255,255,0.6);box-shadow:inset 0 1px 0 rgba(255,255,255,0.85);user-select:none}' +
      '#cxStatus{color:#15803d;font-weight:400}' +
      '#cxRunBtn,#cxToggleBtn,#cxCfgBtn{cursor:pointer;font-size:13px;color:#fff;background:linear-gradient(rgba(238,120,180,0.72),rgba(224,100,165,0.55));border:1px solid rgba(255,255,255,0.55);border-radius:8px;padding:2px 8px;line-height:1.4;box-shadow:0 3px 10px rgba(200,110,155,0.3);transition:box-shadow .15s}' +
      '#cxRunBtn:hover,#cxToggleBtn:hover,#cxCfgBtn:hover{background:linear-gradient(rgba(236,90,163,0.95),rgba(224,80,152,0.85))}' +
      '#cxRunBtn:active,#cxToggleBtn:active,#cxCfgBtn:active{background:linear-gradient(rgba(0,0,0,0.12),rgba(0,0,0,0.12)),linear-gradient(rgba(236,90,163,0.95),rgba(224,80,152,0.85));box-shadow:inset 0 2px 4px rgba(150,30,90,0.3)}' +
      '#cxCfgBtn{margin-left:auto}' +
      '#cxLogs{padding:0 12px 8px;overflow-y:auto;max-height:230px}' +
      '#cxLogs div{color:#6b6670;margin:2px 0;border-left:3px solid rgba(228,146,184,0.5);padding-left:6px;word-break:break-all}' +
      '#cxLogs div.ok{border-color:#16a34a;color:#15803d}' +
      '#cxLogs div.warn{border-color:#d97706;color:#b45309}' +
      '#cxLogs div.err{border-color:#dc2626;color:#dc2626;font-weight:600;background:rgba(254,226,226,0.65);border-radius:4px;padding:2px 6px}' +
      '#cxCfgPanel{position:fixed;right:16px;bottom:8px;width:400px;max-height:82vh;overflow-y:auto;background:linear-gradient(rgba(252,228,240,0.95),rgba(247,215,232,0.9));color:#3b3b43;border:1px solid rgba(255,255,255,0.6);border-radius:12px;padding:12px;z-index:2147483647;font:13px/1.5 "Microsoft YaHei";box-shadow:inset 0 1px 0 rgba(255,255,255,0.85),0 8px 32px rgba(160,60,120,0.22);backdrop-filter:blur(14px) saturate(160%)}' +
      '#cxCfgPanel .field{margin:10px 0;border-bottom:1px solid rgba(255,255,255,0.5);padding-bottom:10px}' +
      '#cxCfgPanel .label{font-weight:600;margin-bottom:4px}' +
      '#cxCfgPanel .hint{font-size:11px;color:#9a949c;margin-top:4px;line-height:1.5}' +
      '#cxCfgPanel input{width:100%;box-sizing:border-box;background:rgba(255,255,255,0.75);color:#3b3b43;border:1px solid rgba(255,255,255,0.6);border-radius:8px;padding:5px 8px}' +
      '#cxCfgPanel input:focus{outline:none;border-color:#ec4899}' +
      '#cxCfgPanel input[type=checkbox]{width:16px;height:16px;accent-color:#ec4899}' +
      '#cxCfgPanel select{width:100%;box-sizing:border-box;background:rgba(255,255,255,0.75);color:#3b3b43;border:1px solid rgba(255,255,255,0.6);border-radius:8px;padding:5px 8px}' +
      '#cxCfgPanel select:focus{outline:none;border-color:#ec4899}' +
      '#cxCfgPanel .btns{display:flex;justify-content:flex-end;gap:8px;margin-top:4px}' +
      '#cxCfgPanel button{background:linear-gradient(rgba(238,120,180,0.72),rgba(224,100,165,0.55));border:1px solid rgba(255,255,255,0.55);color:#fff;border-radius:8px;padding:6px 14px;cursor:pointer;font-size:13px;box-shadow:0 3px 10px rgba(200,110,155,0.3)}' +
      '#cxCfgPanel button:hover{background:linear-gradient(rgba(236,90,163,0.95),rgba(224,80,152,0.85))}' +
      '#cxCfgPanel button:active{background:linear-gradient(rgba(0,0,0,0.12),rgba(0,0,0,0.12)),linear-gradient(rgba(236,90,163,0.95),rgba(224,80,152,0.85));box-shadow:inset 0 2px 4px rgba(150,30,90,0.3)}' +
      '#cxCfgPanel button#cfgClose{background:transparent;color:#3b3b43;border:1px solid transparent;box-shadow:none}' +
      '#cxCfgPanel button#cfgClose:hover{background:linear-gradient(rgba(240,155,196,0.4),rgba(228,145,184,0.32));border-color:rgba(255,255,255,0.6)}' +
      '#cxCfgPanel button#cfgClose:active{background:linear-gradient(rgba(0,0,0,0.12),rgba(0,0,0,0.12)),linear-gradient(rgba(240,155,196,0.4),rgba(228,145,184,0.32))}';
    (document.head || document.documentElement).appendChild(style);
    document.body.appendChild(logPanel);
    log('刷课助手 v' + scriptVersion() + ' 已加载');
    document.getElementById('cxCfgBtn').addEventListener('click', showConfigUI);
    document.getElementById('cxRunBtn').addEventListener('click', togglePause);
    document.getElementById('cxToggleBtn').addEventListener('click', () => {
      const logsEl = document.getElementById('cxLogs');
      const hidden = logsEl.style.display === 'none';
      logsEl.style.display = hidden ? '' : 'none';
      document.getElementById('cxToggleBtn').textContent = hidden ? '▼' : '▲';
    });
    const titleEl = document.getElementById('cxTitle');
    titleEl.addEventListener('mousedown', (e) => {
      if (e.target.closest('#cxRunBtn, #cxToggleBtn, #cxCfgBtn')) return;
      e.preventDefault();
      const rect = logPanel.getBoundingClientRect();
      const startX = e.clientX;
      const startY = e.clientY;
      logPanel.style.left = rect.left + 'px';
      logPanel.style.top = rect.top + 'px';
      logPanel.style.right = 'auto';
      logPanel.style.bottom = 'auto';
      const onMove = (ev) => {
        logPanel.style.left = (rect.left + ev.clientX - startX) + 'px';
        logPanel.style.top = (rect.top + ev.clientY - startY) + 'px';
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    if (logLines.length <= 1) {
      logLines.push({ line: '💡 打开课程章节页即自动开始挂机(支持同小节多标签页遍历)', level: 'info' });
      logLines.push({ line: '⚙ 设置 | 「▶/⏸」控制挂机 | ▼ 展开收起日志', level: 'info' });
      logLines.push({ line: '🤖 自动做题:请点 ⚙ → 勾选 AI 答题并选择平台填写 API Key', level: 'warn' });
    }
    const initLogs = document.getElementById('cxLogs');
    if (initLogs) initLogs.innerHTML = logLines.map((l) => `<div class="${l.level}">${l.line}</div>`).join('');
  }

  let PAUSED = false;
  function togglePause() {
    PAUSED = !PAUSED;
    setStatus(PAUSED ? '已暂停' : '工作中');
    log(PAUSED ? '⏸ 已暂停挂机(当前任务完成后不再继续,点「▶」恢复)' : '▶ 已恢复挂机', PAUSED ? 'warn' : 'ok');
  }

  let aiFailCount = 0;
  let aiCooldownUntil = 0;
  let aiCooldownWarned = false;
  let aiKeyWarned = false;

  function showConfigUI() {
    const existing = document.getElementById('cxCfgPanel');
    if (existing) { existing.remove(); return; }
    const curProvider = (CONFIG.aiProvider && PROVIDERS[CONFIG.aiProvider]) ? CONFIG.aiProvider : inferProviderFromUrl(CONFIG.aiUrl);
    const curProviderName = (PROVIDERS[curProvider] && PROVIDERS[curProvider].name) || 'DeepSeek';
    const panel = document.createElement('div');
    panel.id = 'cxCfgPanel';
    panel.innerHTML =
      '<div class="field"><div class="label">🎬 视频倍速</div>' +
        '<input id="cfgSpeed" type="number" step="0.25" min="1" max="2" value="' + CONFIG.speed + '">' +
        '<div class="hint">默认 2x(最快);1 = 原速最安全,2x 被检测风险最高,自行权衡</div></div>' +
      '<div class="field"><div class="label">⏩ 拖动视频进度条</div>' +
        '<input id="cfgDrag" type="checkbox" ' + (CONFIG.dragVideoProgress ? 'checked' : '') + '>' +
        '<div class="hint">开启后,当且仅当视频任务点完成条件为「时长 ≥ 90%」且未注明「不可拖拽」时,先播放前 10% 内片刻,再随机跳至 90% 以上继续播完;若任务点未完成会自动回退为稳妥倍速重播</div></div>' +
      '<div class="field"><div class="label" id="cfgAILabel">🤖 AI 答题(' + curProviderName + ')</div>' +
        '<input id="cfgAI" type="checkbox" ' + (CONFIG.aiEnabled ? 'checked' : '') + '>' +
        '<div class="hint">开启后,题目交给所选大模型自动作答。需在下方选择平台并填写 API Key</div></div>' +
      '<div class="field"><div class="label">🔑 AI Key</div>' +
        '<input id="cfgAIKey" type="password" placeholder="sk-..." value="' + CONFIG.aiKey + '">' +
        '<div class="hint">到所选平台的官网注册并创建 API Key。只保存在你本机浏览器,不会上传</div></div>' +
      '<div class="field"><div class="label">🏢 AI 平台</div>' +
        '<select id="cfgProvider">' +
        '<option value="deepseek">DeepSeek(推荐)</option>' +
        '<option value="siliconflow">硅基流动(注册送额度)</option>' +
        '<option value="minimax">MiniMax</option>' +
        '<option value="zhipu">智谱 AI</option>' +
        '<option value="qwen">通义千问</option>' +
        '<option value="kimi">Kimi(月之暗面)</option>' +
        '<option value="openai">OpenAI 官方</option>' +
        '<option value="custom">其他 / 自定义</option>' +
        '</select>' +
        '<div class="hint">选好平台后,下面的模型名和接口地址会自动填好,你只需填 Key。选"其他/自定义"时手动填下面两格</div></div>' +
      '<div class="field"><div class="label">🧠 AI 模型</div>' +
        '<input id="cfgAIModel" type="text" list="cxModelList" value="' + CONFIG.aiModel + '">' +
        '<datalist id="cxModelList"></datalist>' +
        '<button id="cfgFetchModels" type="button" style="margin-top:6px">📋 自动获取模型列表</button>' +
        '<div class="hint">先填好上方 Key 和接口地址,再点按钮:自动拉取该平台的可用模型,点输入框即可选择</div></div>' +
      '<div class="field"><div class="label">🌐 AI 接口地址</div>' +
        '<input id="cfgAIUrl" type="text" value="' + CONFIG.aiUrl + '">' +
        '<div class="hint">OpenAI 兼容接口地址(以 /chat/completions 结尾)</div></div>' +
      '<div class="field"><div class="label">🎭 故意答错率(%)</div>' +
        '<input id="cfgErrRate" type="number" step="1" min="0" max="20" value="' + Math.round(CONFIG.deliberateErrorRate * 100) + '">' +
        '<div class="hint">拟人化:真人不会全对。填 8 = 8% 概率故意答错(判断题反着点、单选题点错项);填 0 关闭;多选不受影响</div></div>' +
      '<div class="field"><div class="label">⏱ 每日刷课上限(分钟)</div>' +
        '<input id="cfgDaily" type="number" step="30" min="0" max="1440" value="' + CONFIG.dailyLimitMinutes + '">' +
        '<div class="hint">0 = 不限时长(当前默认);设正数则刷满该时长自动停止,第二天恢复</div></div>' +
      '<div class="field"><div class="label">📤 自动提交测验</div>' +
        '<input id="cfgSubmit" type="checkbox" ' + (CONFIG.autoSubmit ? 'checked' : '') + '>' +
        '<div class="hint">作答覆盖率 ≥ 60% 且无未做完题目提示时自动提交并确认弹窗;若提示还有未做完题目则自动取消交卷</div></div>' +
      '<div class="field"><div class="label">📖 自动切章(含同节多标签页)</div>' +
        '<input id="cfgJump" type="checkbox" ' + (CONFIG.autoJump ? 'checked' : '') + '>' +
        '<div class="hint">自动依次遍历同一小节内的多个顶部标签页(如「1 内容」「2 作业」),全部完成后自动进入下一章继续刷</div></div>' +
      '<div class="field"><div class="label">📡 状态上报地址(调试用)</div>' +
        '<input id="cfgReport" type="text" placeholder="http://127.0.0.1:8790/report" value="' + CONFIG.reportUrl + '">' +
        '<div class="hint">留空 = 关闭</div></div>' +
      '<div class="field"><div class="label">📋 导出已收集题目</div>' +
        '<button id="cfgExport" type="button">复制题目数据</button>' +
        '<div class="hint">把做过的所有题目(题干+选项+答案)复制到剪贴板</div></div>' +
      '<div class="btns"><button id="cfgClose">关闭</button><button id="cfgSave">保存</button></div>';
    document.body.appendChild(panel);

    const providerSelect = document.getElementById('cfgProvider');
    providerSelect.value = curProvider;

    providerSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      const p = PROVIDERS[val] || PROVIDERS.custom;
      if (val !== 'custom') {
        document.getElementById('cfgAIUrl').value = p.url;
        document.getElementById('cfgAIModel').value = p.model;
      }
      const lbl = document.getElementById('cfgAILabel');
      if (lbl) lbl.textContent = '🤖 AI 答题(' + (p.name || '自定义') + ')';
    });

    document.getElementById('cfgSave').addEventListener('click', () => {
      CONFIG.speed = parseFloat(document.getElementById('cfgSpeed').value) || 1;
      if (CONFIG.speed < 1) CONFIG.speed = 1;
      if (CONFIG.speed > 2) CONFIG.speed = 2;
      CONFIG.dragVideoProgress = document.getElementById('cfgDrag').checked;
      CONFIG.aiEnabled = document.getElementById('cfgAI').checked;
      CONFIG.aiProvider = document.getElementById('cfgProvider').value || 'deepseek';
      CONFIG.aiKey = document.getElementById('cfgAIKey').value.trim();
      const defP = PROVIDERS[CONFIG.aiProvider] || PROVIDERS.deepseek;
      CONFIG.aiModel = document.getElementById('cfgAIModel').value.trim() || defP.model || 'deepseek-chat';
      CONFIG.aiUrl = document.getElementById('cfgAIUrl').value.trim() || defP.url || 'https://api.deepseek.com/v1/chat/completions';
      CONFIG.deliberateErrorRate = (parseFloat(document.getElementById('cfgErrRate').value) || 0) / 100;
      CONFIG.dailyLimitMinutes = parseFloat(document.getElementById('cfgDaily').value) || 0;
      CONFIG.autoSubmit = document.getElementById('cfgSubmit').checked;
      CONFIG.autoJump = document.getElementById('cfgJump').checked;
      CONFIG.reportUrl = document.getElementById('cfgReport').value.trim();
      saveConfig(CONFIG);
      aiFailCount = 0;
      aiCooldownUntil = 0;
      aiCooldownWarned = false;
      aiKeyWarned = false;
      const pName = (PROVIDERS[CONFIG.aiProvider] && PROVIDERS[CONFIG.aiProvider].name) || CONFIG.aiProvider;
      log(`配置已保存(倍速 ${CONFIG.speed}x, 拖进度 ${CONFIG.dragVideoProgress ? '开' : '关'}, AI ${CONFIG.aiEnabled ? '开 [' + pName + ' / ' + CONFIG.aiModel + ']' : '关'})`, 'ok');
      panel.remove();
    });
    document.getElementById('cfgClose').addEventListener('click', () => panel.remove());
    document.getElementById('cfgExport').addEventListener('click', exportQuestions);

    document.getElementById('cfgFetchModels').addEventListener('click', async () => {
      const base = document.getElementById('cfgAIUrl').value.trim();
      const key = document.getElementById('cfgAIKey').value.trim();
      const btn = document.getElementById('cfgFetchModels');
      if (!base) { log('请先填写 AI 接口地址', 'warn'); return; }
      const modelsUrl = base.replace(/\/chat\/completions\/?$/, '/models');
      btn.disabled = true;
      const old = btn.textContent;
      btn.textContent = '拉取中...';
      try {
        const text = await cxFetch(modelsUrl, { method: 'GET', headers: { 'Authorization': 'Bearer ' + key }, timeout: 15000 });
        const obj = JSON.parse(text);
        const list = (obj.data || []).map((m) => m.id).filter(Boolean);
        if (list.length) {
          const dl = document.getElementById('cxModelList');
          dl.innerHTML = list.map((id) => '<option value="' + String(id).replace(/"/g, '') + '"></option>').join('');
          log('✅ 已拉取 ' + list.length + ' 个模型:点输入框右侧箭头选择', 'ok');
        } else {
          log('该平台未返回模型列表,请手动填写', 'warn');
        }
      } catch (e) {
        log('拉取失败(该平台可能不支持 /models 接口),请手动填写模型名', 'warn');
      }
      btn.disabled = false;
      btn.textContent = old;
    });
  }

  /* ==================== 答案通道 ==================== */
  async function channelTikuHai(q) {
    try {
      const res = JSON.parse(await cxFetch('http://api.tikuhai.com/search', {
        method: 'POST',
        data: JSON.stringify({ question: q.question, type: q.type }),
        headers: { 'Content-Type': 'application/json' }
      }));
      if (res.code === -1) return { form: '题库海', answer: String(res.msg || '').split('#') };
      const a = (res.data && res.data.answer) || res.msg || '';
      return { form: '题库海', answer: String(a).split('#') };
    } catch (e) { return { form: '题库海', answer: [] }; }
  }
  async function channelYizhi(q) {
    try {
      const ip = Array.from({ length: 4 }, () => Math.floor(255 * Math.random())).join('.');
      const res = JSON.parse(await cxFetch('http://cx.icodef.com/wyn-nb?v=4', {
        method: 'POST',
        data: JSON.stringify({ question: q.question }),
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip, 'X-Real-IP': ip }
      }));
      if (res.code !== 1) return { form: '一之题库', answer: [] };
      let data = String(res.data || '').replace(/javascript:void\(0\);/g, '').replace(/\n/g, '').trim();
      if (/(叛逆|公众号|李恒雅|一之)/.test(data)) return { form: '一之题库', answer: [] };
      return { form: '一之题库', answer: data.split('#') };
    } catch (e) { return { form: '一之题库', answer: [] }; }
  }
  async function channelYanxi(q) {
    try {
      const res = JSON.parse(await cxFetch('https://tk.enncy.cn/query', {
        method: 'POST',
        data: JSON.stringify({ title: q.question }),
        headers: { 'Content-Type': 'application/json' }
      }));
      if (res.code !== 1) return { form: '言溪题库', answer: [] };
      return { form: '言溪题库', answer: String(res.data.answer || '').split('#') };
    } catch (e) { return { form: '言溪题库', answer: [] }; }
  }
  async function channelMuketool(q) {
    try {
      const res = JSON.parse(await cxFetch('https://api.muketool.com/cx/v2/query', {
        method: 'POST',
        data: JSON.stringify({ question: q.question, type: parseInt(q.type, 10) || 0 }),
        headers: { 'Content-Type': 'application/json' }
      }));
      if (res.code !== 1) return { form: '木课工具', answer: [] };
      return { form: '木课工具', answer: String(res.data || '').split('#') };
    } catch (e) { return { form: '木课工具', answer: [] }; }
  }

  function channelAI(q) {
    return new Promise((resolve) => {
      if (Date.now() < aiCooldownUntil) {
        if (!aiCooldownWarned) {
          aiCooldownWarned = true;
          log('AI 通道冷却中(连续失败后暂停 10 分钟),重新点 ⚙ 保存配置可立即重置', 'warn');
        }
        resolve({ form: 'AI(冷却中)', answer: [] });
        return;
      }
      const prompt = buildAIPrompt(q);
      const data = JSON.stringify({
        model: CONFIG.aiModel,
        messages: [
          { role: 'system', content: '你是答题助手。回复的第一个字符必须是最终答案,严禁输出思考过程、解释、重复题目或任何多余内容。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 1024
      });
      const done = (answer, errLog) => {
        if (errLog) {
          aiFailCount++;
          log(`AI 请求失败(${aiFailCount}/3) [${CONFIG.aiModel}]: ${errLog}`, 'err');
          if (aiFailCount >= 3) {
            aiCooldownUntil = Date.now() + 10 * 60 * 1000;
            aiCooldownWarned = false;
            aiFailCount = 0;
            log('AI 通道连续失败 3 次,暂停 10 分钟(在 ⚙ 中修改并保存配置可立即解除冷却)', 'warn');
          }
        } else {
          aiFailCount = 0;
          aiCooldownUntil = 0;
          aiCooldownWarned = false;
        }
        resolve({ form: 'AI', answer });
      };
      try {
        GM_xmlhttpRequest({
          method: 'POST',
          url: CONFIG.aiUrl,
          data,
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CONFIG.aiKey },
          timeout: 30000,
          onload: (res) => {
            try {
              if (res.status !== 200) {
                done([], `HTTP ${res.status}: ${String(res.responseText).slice(0, 180)}`);
                return;
              }
              const obj = JSON.parse(res.responseText);
              let content = ((obj.choices && obj.choices[0] && obj.choices[0].message && obj.choices[0].message.content) || '').trim();
              if (!content) {
                const rc = ((obj.choices && obj.choices[0] && obj.choices[0].message && obj.choices[0].message.reasoning_content) || '').trim();
                content = rc.slice(-300);
              }
              if (!content) { done([], '返回内容为空'); return; }
              done(parseAIAnswer(q.type, content));
            } catch (e) {
              done([], '解析失败: ' + (e.message || e));
            }
          },
          onerror: (err) => { done([], '网络或跨域错误(' + (err && err.error ? err.error : '请检查接口地址与Key') + ')'); },
          ontimeout: () => { done([], '请求超时(30s)'); }
        });
      } catch (e) {
        done([], '调用异常: ' + (e.message || e));
      }
    });
  }

  function buildAIPrompt(q) {
    const opts = (q.options || []).map((o, i) => `${String.fromCharCode(65 + i)}.${o}`).join(' ');
    const base = '你是一位专业的学习辅导老师,知识面广。规则:你的回复必须以最终答案开头(第一个字符就是答案),只输出答案本身,不要任何解释、思考或多余文字。';
    switch (String(q.type)) {
      case '3': return `${base}\n判断题。题目:${q.question}\n只输出"正确"或"错误"。`;
      case '1': return `${base}\n多选题。题目:${q.question}\n选项:${opts}\n只输出所有正确选项的字母组合(如 ABD)。`;
      case '2': return `${base}\n填空题。题目:${q.question}\n直接输出答案,多个空用 | 分隔。`;
      case '0': return `${base}\n单选题。题目:${q.question}\n选项:${opts}\n只输出正确选项的字母(如 C)。`;
      default: return `${base}\n简答题。题目:${q.question}\n输出完整答案:若题目要求字数(例如"不少于800字""800字以上"),必须写够该字数;直接给正文,不要"以下是""简答如下"之类的开场白,也不要写提纲。`;
    }
  }

  function parseAIAnswer(type, content) {
    content = String(content).trim();
    switch (String(type)) {
      case '3': return [/正确|对|√|true|是/i.test(content) ? '正确' : '错误'];
      case '1': { const m = content.match(/[A-Ha-h]{1,8}/); return m ? m[0].toUpperCase().split('') : [content]; }
      case '0': { const m = content.match(/[A-Ha-h]/); return m ? [m[0].toUpperCase()] : [content]; }
      case '2': return content.split('|').map((s) => s.trim()).filter(Boolean);
      default: return [content];
    }
  }

  function filterAnswers(arr) {
    return (arr || []).map(String).map(clean)
      .filter((a) => a && a !== '暂无答案' && a !== '略' && !/(付费|购买|卡密|升级|公众号|扫码|微信)/.test(a));
  }

  async function getAnswers(q) {
    if (CONFIG.aiEnabled && CONFIG.aiKey) {
      const r = await channelAI(q);
      const ans = filterAnswers(r.answer);
      if (ans.length) {
        log(`[AI] 查到答案: ${ans.join(' / ')}`, 'ok');
        return ans;
      }
    } else if (!aiKeyWarned) {
      aiKeyWarned = true;
      log('⚠ 未启用 AI 答题:点面板 ⚙ → 勾选「AI 答题」并填写 API Key,否则无法自动做题', 'warn');
    }
    const results = CONFIG.useTiku
      ? await Promise.all([channelTikuHai(q), channelYizhi(q), channelYanxi(q), channelMuketool(q)])
      : [];
    for (const r of results) {
      const ans = filterAnswers(r.answer);
      if (ans.length) {
        log(`[${r.form}] 查到答案: ${ans.join(' / ')}`, 'ok');
        return ans;
      }
    }
    log('未查到答案' + ((!CONFIG.aiEnabled || !CONFIG.aiKey) ? '(原因:AI 答题未启用或未填 Key,请点 ⚙ 配置)' : ''), 'warn');
    return [];
  }

  /* ==================== 题目提取 ==================== */
  function extractQuizQuestion(el) {
    try {
      const label = el.querySelector('.clearfix .fontLabel');
      const titleEl = label || el.querySelector('.Zy_TItle');
      const text = cl(clean(titleEl ? titleEl.innerHTML : ''));
      if (!text) return null;
      const typeInput = el.querySelector('input[name^=answertype]');
      const type = typeInput ? typeInput.value : '0';
      let options = Array.from(el.querySelectorAll('ul li .after')).map((o) => clean(o.innerHTML)).filter(Boolean);
      if (!options.length) options = Array.from(el.querySelectorAll('ul li')).map((o) => clean(o.innerHTML)).filter(Boolean);
      if (!options.length) options = Array.from(el.querySelectorAll('.answerBg, .num_option, .after')).map((o) => clean(o.innerHTML)).filter(Boolean);
      return { question: text, options, type };
    } catch (e) { return null; }
  }

  function extractWorkQuestion(el) {
    try {
      const mark = el.querySelector('.mark_name');
      let html = mark ? mark.innerHTML : '';
      const idx = html.indexOf('</span>');
      const text = cl(clean(idx >= 0 ? html.substring(idx + 7) : html));
      if (!text) return null;
      const typeInput = el.querySelector('input[name^=answertype]');
      const type = typeInput ? typeInput.value : '0';
      const options = Array.from(el.querySelectorAll('.answer_p')).map((o) => clean(o.innerHTML));
      return { question: text, options, type };
    } catch (e) { return null; }
  }

  /* ==================== 自动作答 ==================== */
  function matchAnswer(answerArr, options) {
    const idx = [];
    const opts = (options || []).map((o) => cl(clean(String(o))));
    for (const raw of answerArr) {
      const a = cl(clean(String(raw)));
      if (!a) continue;
      const letters = /^[A-Ha-h]+$/.test(a) ? a.toUpperCase().split('') : [];
      for (let i = 0; i < opts.length; i++) {
        if (idx.includes(i)) continue;
        const letter = String.fromCharCode(65 + i);
        const opt = opts[i];
        if (!opt) continue;
        if (letters.includes(letter)) { idx.push(i); continue; }
        if (a.startsWith(letter + '.') || a.startsWith(letter + '、') || a.startsWith(letter + ':') || a.startsWith(letter + ')')) { idx.push(i); continue; }
        if (a.length >= 2 && (opt.includes(a) || a.includes(opt))) { idx.push(i); continue; }
        if (opt === a) idx.push(i);
      }
    }
    return idx;
  }

  function clearCurrent(el) {
    el.querySelectorAll('input[type=radio], input[type=checkbox]').forEach((inp) => {
      if (inp.checked) { try { inp.click(); } catch (e) { /* ignore */ } }
    });
  }

  function isNodeSelected(node) {
    if (!node) return false;
    const inp = node.matches && node.matches('input') ? node : node.querySelector('input[type=radio], input[type=checkbox]');
    if (inp && inp.checked) return true;
    if (node.getAttribute && node.getAttribute('aria-checked') === 'true') return true;
    if (node.querySelector && node.querySelector('[aria-checked="true"]')) return true;
    const cls = [node.className || '']
      .concat(Array.from(node.querySelectorAll ? node.querySelectorAll('*') : []).map((n) => n.className || ''))
      .join(' ');
    return /(^|\s)(Hover|cur|active|checked|is-checked|selected|ans-opt-checked|choosed|check_answer)(\s|$)/i.test(cls);
  }

  function classifyBoolOption(node, index, total) {
    const inp = node.querySelector ? node.querySelector('input') : null;
    const rawVals = [
      inp ? inp.value : '',
      node.getAttribute ? node.getAttribute('data-value') : '',
      node.getAttribute ? node.getAttribute('value') : '',
      node.getAttribute ? node.getAttribute('aria-label') : ''
    ].map((s) => String(s || '').trim());

    for (const v of rawVals) {
      if (/^(true|正确|对|√|t|是|ri)$/i.test(v)) return 'true';
      if (/^(false|错误|错|×|x|f|否|wr)$/i.test(v)) return 'false';
    }
    const text = clean(node.textContent || '').replace(/^[A-Ha-h][、.．:)\s]+/, '').trim();
    if (/^(true|正确|对|√|是)$/i.test(text) || /\btrue\b|正确|√/i.test(text)) return 'true';
    if (/^(false|错误|错|×|x|否)$/i.test(text) || /\bfalse\b|错误|×/i.test(text)) return 'false';
    if (total === 2) return index === 0 ? 'true' : 'false';
    return null;
  }

  function clickOptionNode(node) {
    if (!node) return;
    const inp = node.querySelector ? node.querySelector('input[type=radio], input[type=checkbox], input') : null;
    const inner = node.querySelector ? node.querySelector('.after, .answerBg, .num_option, label, a, span') : null;
    try { if (inp) inp.click(); } catch (e) { /* ignore */ }
    try { if (inner && !isNodeSelected(node)) inner.click(); } catch (e) { /* ignore */ }
    try { if (!isNodeSelected(node)) node.click(); } catch (e) { /* ignore */ }
  }

  function setQuizAnswer(answerArr, q, el, win) {
    const $$ = (sel) => Array.from(el.querySelectorAll(sel));
    switch (String(q.type)) {
      case '0':
      case '1': {
        let idx = matchAnswer(answerArr, q.options);
        if (!idx.length) return false;
        if (String(q.type) === '0' && CONFIG.deliberateErrorRate > 0 && Math.random() < CONFIG.deliberateErrorRate && q.options && q.options.length > 1) {
          const wrongIdx = [];
          for (let i = 0; i < q.options.length; i++) if (!idx.includes(i)) wrongIdx.push(i);
          if (wrongIdx.length) {
            idx = [wrongIdx[Math.floor(Math.random() * wrongIdx.length)]];
            log('🎭 拟人模式:本题故意答错(配置概率)', 'info');
          }
        }
        clearCurrent(el);
        const lis = $$('ul li');
        if (lis.length) {
          let hit = false;
          lis.forEach((li, i) => {
            if (idx.includes(i)) {
              clickOptionNode(li);
              if (isNodeSelected(li)) hit = true;
            }
          });
          return hit || idx.length > 0;
        }
        const inputs = $$('input[type=radio], input[type=checkbox]');
        if (inputs.length) {
          idx.forEach((i) => { const inp = inputs[i]; if (inp) { try { inp.click(); } catch (e) { /* ignore */ } } });
          return true;
        }
        const optEls = $$('.answerBg, .num_option, .after, .ans-opt');
        if (optEls.length) {
          idx.forEach((i) => { const o = optEls[i]; if (o) { try { o.click(); } catch (e) { /* ignore */ } } });
          return true;
        }
        return false;
      }
      case '3': {
        const ans = String(answerArr[0] || '');
        const isTrue = /(^|[,|#])(True|true|正确|对|√|T|是)([,|#]|$)/.test(ans);
        const isFalse = /(^|[,|#])(False|false|错误|错|×|F|否)([,|#]|$)/.test(ans);
        if (!isTrue && !isFalse) return false;
        let wantTrue = isTrue, wantFalse = isFalse;
        if (CONFIG.deliberateErrorRate > 0 && Math.random() < CONFIG.deliberateErrorRate) {
          wantTrue = isFalse; wantFalse = isTrue;
          log('🎭 拟人模式:本题故意答错(配置概率)', 'info');
        }
        const targetKind = wantTrue ? 'true' : 'false';
        clearCurrent(el);

        let candidates = $$('ul li');
        if (!candidates.length) candidates = $$('.answerBg, .num_option, .ans-opt, label');
        if (!candidates.length) return false;

        let selected = false;
        candidates.forEach((node, idx) => {
          const kind = classifyBoolOption(node, idx, candidates.length);
          if (kind === targetKind) {
            clickOptionNode(node);
            if (isNodeSelected(node)) selected = true;
          }
        });
        if (!selected) {
          const anyChecked = el.querySelector('input[type=radio]:checked, input[type=checkbox]:checked, [aria-checked="true"], .Hover, .cur, .active, .is-checked, .check_answer');
          selected = !!anyChecked;
        }
        return selected;
      }
      case '2':
      case '4':
      case '5':
      case '6':
      case '7':
      case '9': {
        return fillTextAnswer(el, answerArr, win);
      }
      default:
        return false;
    }
  }

  /* ===== 文本类(填空/简答)填写 ===== */
  function textValueOf(node) {
    try {
      if (!node) return '';
      if (typeof node.value === 'string' && node.value) return node.value;
      return (node.innerText || node.textContent || '').replace(/\s+/g, '');
    } catch (e) { return ''; }
  }
  function isRichHost(node, frame) {
    try {
      if (node && node.isContentEditable) return true;
      const tag = frame ? (frame.className || '') + ' ' + (frame.id || '') : '';
      return /edui|ueditor|cke|ql-editor|w-e-text/i.test(tag);
    } catch (e) { return false; }
  }
  function collectTextTargets(el) {
    const rich = [];
    const plain = [];
    const seen = new Set();
    const pushRich = (doc, node) => {
      if (!node || seen.has(node)) return;
      seen.add(node);
      rich.push({ kind: 'rich', doc, node });
    };
    const scanFrames = (root) => Array.from(root.querySelectorAll('iframe')).forEach((f) => {
      try {
        const doc = f.contentDocument;
        if (!doc || !doc.body) return;
        if (isRichHost(doc.body, f)) pushRich(doc, doc.body);
      } catch (e) { /* ignore */ }
    });
    scanFrames(el);
    Array.from(el.querySelectorAll('[contenteditable="true"], [contenteditable=""]')).forEach((n) => pushRich(n.ownerDocument, n));
    if (!rich.length) {
      scanFrames(document);
      Array.from(document.querySelectorAll('[contenteditable="true"], .edui-body, .ql-editor, .w-e-text, .cke_editable')).forEach((n) => pushRich(n.ownerDocument, n));
    }
    const pushPlain = (n) => plain.push({
      kind: (n.tagName || '').toLowerCase() === 'textarea' ? 'textarea' : 'input',
      doc: n.ownerDocument,
      node: n,
      hidden: n.offsetParent === null
    });
    Array.from(el.querySelectorAll('textarea')).forEach(pushPlain);
    Array.from(el.querySelectorAll('input[type=text], input:not([type])')).forEach(pushPlain);
    if (!plain.length) {
      Array.from(document.querySelectorAll('textarea')).forEach(pushPlain);
      Array.from(document.querySelectorAll('.questionLi input[type=text], .TiMu input[type=text]')).forEach(pushPlain);
    }
    return { rich, plain };
  }
  function writeRich(t, text) {
    const { doc, node } = t;
    try { if (node.focus) node.focus(); } catch (e) { /* ignore */ }
    try {
      if (doc && doc.execCommand) {
        const sel = doc.getSelection ? doc.getSelection() : doc.defaultView.getSelection();
        const range = doc.createRange();
        range.selectNodeContents(node);
        sel.removeAllRanges();
        sel.addRange(range);
        doc.execCommand('delete', false, null);
        doc.execCommand('insertText', false, text);
      }
    } catch (e) { /* ignore */ }
    if (textValueOf(node).length < Math.min(6, text.length)) {
      try { node.textContent = text; } catch (e) { /* ignore */ }
    }
    try {
      node.dispatchEvent(new Event('input', { bubbles: true }));
      node.dispatchEvent(new Event('change', { bubbles: true }));
      node.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    } catch (e) { /* ignore */ }
  }
  function stripTags(s) { return String(s || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ''); }
  function tryUE(win, text, need) {
    try {
      const UE = win && win.UE;
      if (!UE || !UE.instants) return false;
      return Object.keys(UE.instants).some((k) => {
        const ed = UE.instants[k];
        if (!ed || typeof ed.setContent !== 'function') return false;
        if (typeof ed.getContent === 'function') {
          const cur = stripTags(ed.getContent());
          if (cur.length >= need(text) && cur.indexOf(text.slice(0, 6)) >= 0) return true;
        }
        ed.setContent(text);
        return typeof ed.getContent === 'function' && stripTags(ed.getContent()).length >= need(text);
      });
    } catch (e) { return false; }
  }
  function setPlain(t, val) {
    try {
      t.node.value = val;
      t.node.dispatchEvent(new Event('input', { bubbles: true }));
      t.node.dispatchEvent(new Event('change', { bubbles: true }));
      t.node.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    } catch (e) { /* ignore */ }
    return textValueOf(t.node).length >= Math.min(6, val.length);
  }
  function fillTextAnswer(el, answerArr, win) {
    const texts = (answerArr || []).map((a) => cl(clean(String(a == null ? '' : a)).replace(/^第.空[:：]?/, ''))).filter(Boolean);
    if (!texts.length) return false;
    const need = (t) => Math.min(6, t.length);
    if (tryUE(win, texts[0], need)) return true;
    const { rich, plain } = collectTextTargets(el);
    for (const t of rich) {
      writeRich(t, texts[0]);
      if (textValueOf(t.node).length >= need(texts[0])) return true;
    }
    const vis = plain.filter((t) => !t.hidden);
    if (vis.length > 1 && texts.length > 1) {
      let filled = 0;
      vis.forEach((t, i) => { if (setPlain(t, texts[i] != null ? texts[i] : texts[0])) filled++; });
      if (filled) return true;
    }
    for (const t of vis) {
      if (setPlain(t, texts[0])) return true;
    }
    for (const t of plain.filter((x) => x.hidden)) {
      setPlain(t, texts[0]);
      try {
        const name = t.node.getAttribute && t.node.getAttribute('name');
        if (name && win && win.UE && typeof win.UE.getEditor === 'function') {
          const ed = win.UE.getEditor(name);
          if (ed && typeof ed.setContent === 'function') {
            ed.setContent(texts[0]);
            if (stripTags(ed.getContent && ed.getContent()).length >= need(texts[0])) return true;
          }
        }
      } catch (e) { /* ignore */ }
    }
    return false;
  }

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const cs = el.ownerDocument.defaultView.getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
  }

  function clickButtonByText(win, texts) {
    const nodes = win.document.querySelectorAll('button, .btn, a, .el-button, .jb_btn, input[type=button], input[type=submit], span');
    for (const n of nodes) {
      if (!isVisible(n)) continue;
      const t = (n.textContent || n.value || '').trim();
      for (const kw of texts) {
        if (t && (t === kw || (t.length <= 10 && t.includes(kw)))) {
          try { n.click(); } catch (e) { /* ignore */ }
          return true;
        }
      }
    }
    return false;
  }

 /* ==================== 字体加密解密 (TTF 码点筛查 + 网格化视觉大模型 OCR) ==================== */
  // 极简 TTF cmap 解析器:仅用于精准筛出 gid !== 0 的真加密字,普通文字(gid === 0)直接保持不变
  const MiniTypr = {
    readUshort(buff, p) { return (buff[p] << 8) | buff[p + 1]; },
    readShort(buff, p) { const u = (buff[p] << 8) | buff[p + 1]; return (u & 0x8000) ? u - 0x10000 : u; },
    readUint(buff, p) { return ((buff[p] * 16777216) + ((buff[p + 1] << 16) | (buff[p + 2] << 8) | buff[p + 3])); },
    readASCII(buff, p, l) { let s = ''; for (let i = 0; i < l; i++) s += String.fromCharCode(buff[p + i]); return s; },

    parse(buff) {
      const numTables = this.readUshort(buff, 4);
      const tables = {};
      for (let i = 0; i < numTables; i++) {
        const off = 12 + i * 16;
        const tag = this.readASCII(buff, off, 4);
        tables[tag] = { offset: this.readUint(buff, off + 8), length: this.readUint(buff, off + 12) };
      }
      const cmapOff = tables.cmap.offset;
      const numSub = this.readUshort(buff, cmapOff + 2);
      const subtables = [];
      for (let i = 0; i < numSub; i++) {
        const pid = this.readUshort(buff, cmapOff + 4 + i * 8);
        const eid = this.readUshort(buff, cmapOff + 6 + i * 8);
        const subOff = cmapOff + this.readUint(buff, cmapOff + 8 + i * 8);
        const fmt = this.readUshort(buff, subOff);
        subtables.push({ pid, eid, subOff, fmt });
      }
      const bestSub = subtables.find((s) => s.fmt === 12) || subtables.find((s) => s.fmt === 4 && (s.pid === 3 || s.pid === 0)) || subtables[0];
      return { buff, cmapSub: bestSub };
    },

    codeToGlyph(font, code) {
      if (!font || !font.cmapSub) return 0;
      const { buff } = font;
      const { subOff, fmt } = font.cmapSub;
      if (fmt === 4) {
        const segCount = this.readUshort(buff, subOff + 6) >> 1;
        const endCountOff = subOff + 14;
        const startCountOff = endCountOff + segCount * 2 + 2;
        const idDeltaOff = startCountOff + segCount * 2;
        const idRangeOffsetOff = idDeltaOff + segCount * 2;
        for (let i = 0; i < segCount; i++) {
          const end = this.readUshort(buff, endCountOff + i * 2);
          if (code <= end) {
            const start = this.readUshort(buff, startCountOff + i * 2);
            if (code < start) return 0;
            const idDelta = this.readShort(buff, idDeltaOff + i * 2);
            const idRangeOffset = this.readUshort(buff, idRangeOffsetOff + i * 2);
            if (idRangeOffset === 0) return (code + idDelta) & 0xFFFF;
            const glyphAddr = idRangeOffsetOff + i * 2 + idRangeOffset + (code - start) * 2;
            const gid = this.readUshort(buff, glyphAddr);
            return gid === 0 ? 0 : (gid + idDelta) & 0xFFFF;
          }
        }
        return 0;
      } else if (fmt === 12) {
        const nGroups = this.readUint(buff, subOff + 12);
        for (let i = 0; i < nGroups; i++) {
          const gOff = subOff + 16 + i * 12;
          const start = this.readUint(buff, gOff);
          const end = this.readUint(buff, gOff + 4);
          if (code >= start && code <= end) return this.readUint(buff, gOff + 8) + (code - start);
        }
      }
      return 0;
    }
  };

  function base64ToUint8Array(base64) {
    const data = window.atob(base64);
    const buff = new Uint8Array(data.length);
    for (let i = 0; i < data.length; ++i) buff[i] = data.charCodeAt(i);
    return buff;
  }

  // 网格化视觉大模型识字:每批最多 24 字,按 8 列带编号方格绘制,彻底避免超宽图片压缩与漏字错位
  async function recognizeBatchViaVisionAI(charsBatch, fontName) {
    const resMap = new Map();
    const cols = Math.min(8, charsBatch.length);
    const rows = Math.ceil(charsBatch.length / cols);
    const cellW = 72, cellH = 82;
    const canvas = document.createElement('canvas');
    canvas.width = cols * cellW;
    canvas.height = rows * cellH;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    charsBatch.forEach((ch, idx) => {
      const c = idx % cols;
      const r = Math.floor(idx / cols);
      const x = c * cellW, y = r * cellH;
      // 绘制浅灰边框防止字符粘连
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);
      // 左上角绘制序号 (1..N)
      ctx.fillStyle = '#6b7280';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(String(idx + 1), x + 4, y + 3);
      // 中央绘制加密字体渲染出的真实汉字
      ctx.fillStyle = '#000000';
      ctx.font = `38px "${fontName}"`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch, x + cellW / 2, y + cellH / 2 + 8);
    });

    const dataUrl = canvas.toDataURL('image/png');
    const promptText =
      `图片中有 ${charsBatch.length} 个带编号的方格(编号 1 到 ${charsBatch.length})，每个方格中央有 1 个汉字或字符。\n` +
      `请按编号顺序输出每个方格中的字符，格式严格为：1:字 2:字 3:字 ...（用空格分隔，不要输出任何解释或多余内容）。`;

    const payload = JSON.stringify({
      model: CONFIG.aiModel,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: promptText },
          { type: 'image_url', image_url: { url: dataUrl } }
        ]
      }],
      temperature: 0.1,
      max_tokens: 1024
    });

    const respText = await cxFetch(CONFIG.aiUrl, {
      method: 'POST',
      data: payload,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CONFIG.aiKey },
      timeout: 25000
    });
    const obj = JSON.parse(respText);
    const out = ((obj.choices && obj.choices[0] && obj.choices[0].message && obj.choices[0].message.content) || '').trim();
    if (!out) return resMap;

    // 优先解析 "1:字 2:字" 编号映射(即使个别字漏认也不会影响后续编号对齐)
    const pairRegex = /(\d+)\s*[:：.、]\s*([^\s\d:：.、])/g;
    let match;
    while ((match = pairRegex.exec(out)) !== null) {
      const idx = parseInt(match[1], 10) - 1;
      const val = match[2];
      if (idx >= 0 && idx < charsBatch.length && val) {
        resMap.set(charsBatch[idx], val);
      }
    }

    // 兜底:若模型直接连续输出了纯字符
    if (resMap.size < charsBatch.length * 0.5) {
      const pure = out.replace(/[\d:：.、\s,，;；]/g, '');
      if (pure.length === charsBatch.length) {
        charsBatch.forEach((ch, i) => resMap.set(ch, pure[i]));
      }
    }
    return resMap;
  }

  async function recognizeGlyphsViaVisionAI(unresolvedChars, b64) {
    const totalMap = new Map();
    if (!CONFIG.aiEnabled || !CONFIG.aiKey || !unresolvedChars.length) return totalMap;
    try {
      const fontName = 'cxfontdec_' + Date.now();
      const ff = new FontFace(fontName, 'url(data:font/ttf;base64,' + b64 + ')');
      document.fonts.add(ff);
      await ff.load();
      await sleep(0.15);

      // 每 24 个字符分一批识别,确保极高准确率
      const batchSize = 24;
      for (let i = 0; i < unresolvedChars.length; i += batchSize) {
        const batch = unresolvedChars.slice(i, i + batchSize);
        let batchMap = await recognizeBatchViaVisionAI(batch, fontName);
        // 若单批未能全部识别,自动重试一次该批次
        if (batchMap.size < batch.length) {
          const retryChars = batch.filter((c) => !batchMap.has(c));
          if (retryChars.length > 0) {
            const retryMap = await recognizeBatchViaVisionAI(retryChars, fontName);
            for (const [k, v] of retryMap) batchMap.set(k, v);
          }
        }
        for (const [k, v] of batchMap) totalMap.set(k, v);
      }
      if (totalMap.size > 0) {
        const preview = Array.from(totalMap.values()).join('');
        log(`👁 视觉模型成功识别 ${totalMap.size}/${unresolvedChars.length} 个加密字: ${preview}`, 'ok');
      }
    } catch (e) {
      log('⚠ 视觉模型识字调用异常: ' + (e.message || e), 'warn');
    }
    return totalMap;
  }

  function extractFontBase64(win) {
    const styles = win.document.querySelectorAll('style');
    for (const st of styles) {
      const t = st.textContent || '';
      if (t.includes('font-cxsecret') || t.includes('cxsecret')) {
        const m = t.match(/base64,([\w\W]+?)'/);
        if (m) return m[1];
        const m2 = t.match(/base64,([\w\W]+?)"/);
        if (m2) return m2[1];
      }
    }
    return null;
  }

  async function decodeFont(win) {
    const els = Array.from(win.document.querySelectorAll('.font-cxsecret'));
    if (!els.length) return true;
    const b64 = extractFontBase64(win);
    if (!b64) {
      log('⚠ 未找到 font-cxsecret 字体定义', 'warn');
      return false;
    }

    let font = null;
    try {
      font = MiniTypr.parse(base64ToUint8Array(b64));
    } catch (e) {
      log('⚠ TTF 二进制解析异常: ' + (e.message || e), 'warn');
    }

    const uniqueChars = new Set();
    els.forEach((el) => {
      for (const ch of String(el.textContent || '')) {
        if (ch.trim()) uniqueChars.add(ch);
      }
    });

    const encryptedChars = [];
    let normalCount = 0;

    if (font) {
      for (const ch of uniqueChars) {
        const gid = MiniTypr.codeToGlyph(font, ch.charCodeAt(0));
        if (!gid) normalCount++;
        else encryptedChars.push(ch);
      }
    } else {
      uniqueChars.forEach((ch) => encryptedChars.push(ch));
    }

    if (encryptedChars.length === 0) {
      els.forEach((el) => el.classList.remove('font-cxsecret'));
      log(`🔓 字体检查完成:无实际加密字(${normalCount} 个普通字保持不变)`, 'ok');
      return true;
    }

    const resolved = await recognizeGlyphsViaVisionAI(encryptedChars, b64);
    const unresolvedFinal = encryptedChars.filter((c) => !resolved.has(c));

    els.forEach((el) => {
      let html = el.innerHTML;
      for (const [srcCh, dstCh] of resolved) {
        html = html.split(srcCh).join(dstCh);
      }
      for (const uCh of unresolvedFinal) {
        html = html.split(uCh).join('[?]');
      }
      el.innerHTML = html;
      el.classList.remove('font-cxsecret');
    });

    if (unresolvedFinal.length > 0) {
      const ratio = resolved.size / encryptedChars.length;
      if (CONFIG.aiEnabled && CONFIG.aiKey && (ratio >= 0.8 || unresolvedFinal.length <= 6)) {
        log(`⚠ 字体解密还原 ${resolved.size}/${encryptedChars.length} 字(剩余 ${unresolvedFinal.length} 字标为 [?]),启用 AI 上下文推理继续作答`, 'warn');
        return true;
      }
      log(`⚠ 字体解密不完整:仅还原 ${resolved.size}/${encryptedChars.length} 个加密字(其余 ${normalCount} 个普通字不变),已中止自动提交`, 'warn');
      return false;
    }

    log(`🔓 字体解密 100% 完成:精准还原 ${resolved.size}/${encryptedChars.length} 个加密字(其余 ${normalCount} 个普通字保持不变)`, 'ok');
    return true;
  }

  /* ==================== 视频弹题处理 ==================== */
  const QUIZ_SELECTORS = ['.TiMu', '.topic-item', '.ans-videoquiz', '.ans-topic', '#subtitle .TiMu', '.el-dialog .TiMu', '.popContent .TiMu', '.maskDiv .TiMu'];

  function heuristicFindQuiz(win) {
    let best = null;
    let bestLen = Infinity;
    let nodes;
    try { nodes = win.document.querySelectorAll('div, section, form, fieldset, ul'); } catch (e) { return null; }
    for (const el of nodes) {
      if (!isVisible(el)) continue;
      const t = String(el.textContent || '').trim();
      if (t.length < 8 || t.length > 900) continue;
      const nInputs = el.querySelectorAll('input[type=radio], input[type=checkbox]').length;
      const nLis = el.querySelectorAll('li').length;
      const optCount = nInputs || nLis;
      if (optCount < 2 || optCount > 8) continue;
      if (!/[?？]|（\s*）|\(\s*\)|__+/.test(t)) continue;
      if (t.length < bestLen) { bestLen = t.length; best = el; }
    }
    return best;
  }

  function extractHeuristicQuestion(el) {
    try {
      const optNodes = Array.from(el.querySelectorAll('li'));
      const opts = optNodes.map((li) => clean(li.textContent))
        .filter((t) => t && t.length < 80 && !/(提交|继续学习|回看|确定|下一题|上一题|提交中)/.test(t));
      let type = '0';
      const norm = (t) => String(t).replace(/^[A-Ha-h][、.．:)\s]+/, '').trim();
      if (opts.length === 2 && /^(正确|对|√|True|true|错误|错|×|False|false)$/.test(norm(opts[0])) && /^(正确|对|√|True|true|错误|错|×|False|false)$/.test(norm(opts[1]))) type = '3';
      let text = String(el.textContent || '');
      for (const o of opts) text = text.split(o).join('');
      text = cl(clean(text)).replace(/[（(]\s*[)）]\s*$/, '').slice(0, 300);
      if (!text) return null;
      return { question: text, options: opts, type };
    } catch (e) { return null; }
  }

  function setHeuristicAnswer(answerArr, q, el) {
    try {
      if (String(q.type) === '3') {
        const ans = String(answerArr[0] || '');
        let wantTrue = /正确|对|√|True|true|T|是/.test(ans);
        let wantFalse = /错误|错|×|False|false|F|否/.test(ans);
        if (!wantTrue && !wantFalse) return false;
        if (CONFIG.deliberateErrorRate > 0 && Math.random() < CONFIG.deliberateErrorRate) {
          const t = wantTrue; wantTrue = wantFalse; wantFalse = t;
          log('🎭 拟人模式:本题故意答错(配置概率)', 'info');
        }
        const normOpt = (t) => String(t).replace(/^[A-Ha-h][、.．:)\s]+/, '').trim();
        const nodes = Array.from(el.querySelectorAll('li, label, .option, div, span, a'))
          .filter((n) => /^(正确|对|√|True|true|错误|错|×|False|false)$/.test(normOpt(clean(n.textContent))));
        for (const n of nodes) {
          const t = normOpt(clean(n.textContent));
          const isTrueOpt = /^(正确|对|√|True|true)$/.test(t);
          if ((wantTrue && isTrueOpt) || (wantFalse && !isTrueOpt)) {
            clickOptionNode(n);
          }
        }
        return nodes.length > 0;
      }
      let idx = matchAnswer(answerArr, q.options || []);
      if (!idx.length) return false;
      if (CONFIG.deliberateErrorRate > 0 && Math.random() < CONFIG.deliberateErrorRate && (q.options || []).length > 1) {
        const wrongIdx = [];
        for (let i = 0; i < q.options.length; i++) if (!idx.includes(i)) wrongIdx.push(i);
        if (wrongIdx.length) {
          idx = [wrongIdx[Math.floor(Math.random() * wrongIdx.length)]];
          log('🎭 拟人模式:本题故意答错(配置概率)', 'info');
        }
      }
      const lis = Array.from(el.querySelectorAll('li'));
      if (!lis.length) return false;
      lis.forEach((li, i) => {
        if (idx.includes(i)) clickOptionNode(li);
      });
      return true;
    } catch (e) { return false; }
  }

  function wasHandledRecently(el) {
    return !!el.__cxHandledAt && (Date.now() - el.__cxHandledAt < 60000);
  }

  async function tryPopupQuiz(wins, player) {
    for (const win of wins) {
      if (!win || !win.document) continue;
      let container = null;
      for (const sel of QUIZ_SELECTORS) {
        let els;
        try { els = win.document.querySelectorAll(sel); } catch (e) { continue; }
        for (const el of els) {
          if (wasHandledRecently(el)) continue;
          if (isVisible(el)) { container = el; break; }
        }
        if (container) break;
      }
      if (!container) container = heuristicFindQuiz(win);
      if (!container || wasHandledRecently(container)) continue;
      container.__cxHandledAt = Date.now();
      let q = extractQuizQuestion(container);
      const fromHeuristic = !q || !q.question;
      if (fromHeuristic) q = extractHeuristicQuestion(container);
      if (!q || !q.question) continue;
      log(`❓ 检测到视频弹题${fromHeuristic ? '(启发式)' : ''}: ${q.question.slice(0, 40)}...`, 'warn');
      await sleep(0.2);
      const answers = await getAnswers(q);
      const ok = setHeuristicAnswer(answers, q, container);
      recordQuestion(q, answers);
      log(ok ? '弹题已作答,继续播放' : '弹题未能作答,尝试直接继续', ok ? 'ok' : 'warn');
      await sleep(0.3);
      if (!clickButtonByText(win, ['继续学习'])) {
        clickButtonByText(win, ['确定', '提交', '下一题', '关闭', '继续', '我知道了']);
      }
      try { if (player) player.play(); } catch (e) { /* ignore */ }
      return true;
    }
    return false;
  }

  /* ==================== 每日刷课时长统计 ==================== */
  function getTodayStats() {
    try {
      const s = (typeof GM_getValue !== 'undefined')
        ? GM_getValue('cxDaily', null)
        : JSON.parse(localStorage.getItem('cxDaily') || 'null');
      const today = new Date().toDateString();
      if (s && s.date === today) return s;
      return { date: today, minutes: 0 };
    } catch (e) { return { date: new Date().toDateString(), minutes: 0 }; }
  }
  function saveTodayStats(s) {
    try {
      if (typeof GM_setValue !== 'undefined') GM_setValue('cxDaily', s);
      else localStorage.setItem('cxDaily', JSON.stringify(s));
    } catch (e) { /* ignore */ }
  }
  let dailyLimitReached = false;

  /* ==================== 任务点完成检测与视频条件检测 ==================== */
  // 检测单个任务点是否已被学习通标记为完成
  function isTaskFinished(parentEl, iframe) {
    try {
      if (parentEl) {
        if (parentEl.classList && parentEl.classList.contains('ans-job-finished')) return true;
        const icon = parentEl.querySelector('.ans-job-icon');
        if (icon && (icon.classList.contains('ans-job-finished') || /已完成/.test(icon.getAttribute('title') || '') || /已完成/.test(icon.textContent || ''))) return true;
      }
      if (iframe && iframe.contentWindow) {
        const w = iframe.contentWindow;
        if (typeof w.isUnFinishJob === 'function' && !w.isUnFinishJob()) return true;
        const innerF = w.document && w.document.querySelector('iframe');
        if (innerF && innerF.contentWindow) {
          const iw = innerF.contentWindow;
          if (iw.document && !iw.document.querySelector('button, .btnBlue, .jb_btn') && /已完成|成绩|重做|查看详情/.test(iw.document.body ? iw.document.body.textContent : '')) {
            return true;
          }
        }
      }
    } catch (e) { /* ignore */ }
    return false;
  }

  // 检测视频任务点的完成条件是否允许拖拽进度条(仅限「观看时长需 ≥ 总时长的 90%」且无「不可拖拽」字样)
  function canDragThisVideo(iframe, parentEl, cardsWin) {
    if (!CONFIG.dragVideoProgress) return false;
    try {
      const texts = [];
      if (parentEl) texts.push(parentEl.textContent || '');
      if (parentEl && parentEl.parentElement) texts.push(parentEl.parentElement.textContent || '');
      if (iframe && iframe.contentDocument && iframe.contentDocument.body) {
        texts.push(iframe.contentDocument.body.textContent || '');
      }
      if (cardsWin && cardsWin.document) {
        const condNodes = cardsWin.document.querySelectorAll('.ans-job-ct, .ans-cc, [class*="condition"], [class*="job"]');
        condNodes.forEach((n) => texts.push(n.textContent || ''));
      }
      const combined = texts.join(' ').replace(/\s+/g, ' ');
      // 如果明确包含不可拖拽/禁止拖拽/不能拖拽,直接禁止
      if (/不可拖拽|禁止拖拽|不能拖拽|不可快进|禁止快进/.test(combined)) {
        log('🔒 检测到「当前视频不可拖拽」限制,保持稳妥倍速播放', 'info');
        return false;
      }
      // 检查播放器底层属性 enableFastForward
      if (iframe) {
        const dataAttr = iframe.getAttribute('data') || '';
        if (/"enableFastForward"\s*:\s*0/.test(dataAttr)) {
          log('🔒 播放器属性禁止快进拖拽,保持稳妥倍速播放', 'info');
          return false;
        }
      }
      // 匹配完成条件 90%
      if (/90\s*%/.test(combined)) {
        log('⏩ 检测到完成条件为「时长 ≥ 90%」且允许拖拽,启用进度条跳跃策略', 'ok');
        return true;
      }
    } catch (e) { /* ignore */ }
    return false;
  }

  /* ==================== 任务点处理 ==================== */
 // 绕过「观看时不可离开或将页面最小化」检测:屏蔽失焦、最小化、鼠标移出窗口导致的自动暂停
  function enableBackgroundPlay(targetWin) {
    if (!targetWin || targetWin.__cxBgHooked) return;
    targetWin.__cxBgHooked = true;
    try {
      const doc = targetWin.document;
      Object.defineProperty(doc, 'hidden', { configurable: true, get: () => false });
      Object.defineProperty(doc, 'visibilityState', { configurable: true, get: () => 'visible' });
      Object.defineProperty(doc, 'webkitHidden', { configurable: true, get: () => false });
      doc.hasFocus = () => true;
      targetWin.hasFocus = () => true;
      const blockEvents = ['visibilitychange', 'webkitvisibilitychange', 'blur', 'focusout', 'mouseleave', 'mouseout', 'pagehide'];
      for (const ev of blockEvents) {
        targetWin.addEventListener(ev, (e) => { e.stopImmediatePropagation(); e.stopPropagation(); }, true);
        doc.addEventListener(ev, (e) => { e.stopImmediatePropagation(); e.stopPropagation(); }, true);
      }
      if (doc.body) {
        doc.body.addEventListener('mouseout', (e) => { e.stopImmediatePropagation(); e.stopPropagation(); }, true);
        doc.body.addEventListener('mouseleave', (e) => { e.stopImmediatePropagation(); e.stopPropagation(); }, true);
      }
    } catch (e) { /* ignore */ }
  }

  async function videoTask(iframe, outerWin, parentEl = null, forceSafeMode = false) {
    if (CONFIG.dailyLimitMinutes > 0) {
      const st = getTodayStats();
      if (st.minutes >= CONFIG.dailyLimitMinutes) {
        dailyLimitReached = true;
        log(`⏹ 今日刷课已达上限 ${CONFIG.dailyLimitMinutes} 分钟,自动停止(明天自动恢复)`, 'warn');
        return;
      }
      log(`⏱ 今日已刷约 ${st.minutes} 分钟 / 上限 ${CONFIG.dailyLimitMinutes} 分钟`);
    }
    await waitIframeLoaded(iframe);
    const win = iframe.contentWindow;
    // 对顶层窗口、章节卡片窗口、视频播放器窗口同时注入防离开/防最小化保护
    enableBackgroundPlay(window);
    enableBackgroundPlay(outerWin);
    enableBackgroundPlay(win);
    await waitElementLoaded(win, '#video_html5_api', 90000);
    let player = null;
    try { player = win.videojs('video_html5_api'); } catch (e) { /* ignore */ }
    if (!player) { log('无法获取播放器对象,跳过', 'err'); return; }

    // 若是保底重播模式,先将视频进度重置回 0
    if (forceSafeMode) {
      try { player.currentTime(0); } catch (e) { /* ignore */ }
    }

    try { player.muted(true); } catch (e) { /* ignore */ }
    try { player.playbackRate(CONFIG.speed); } catch (e) { /* ignore */ }
    try { player.play(); } catch (e) { /* ignore */ }

    const allowDrag = !forceSafeMode && canDragThisVideo(iframe, parentEl, outerWin);
    log(`▶ 开始播放视频(静音, ${CONFIG.speed}x 倍速${allowDrag ? ', 智能跳进度已就绪' : ''}${forceSafeMode ? ', 保底完整重播' : ''})`, 'ok');

    let dragAttempted = false;
    const playStartAt = Date.now();

    await new Promise((resolve) => {
      let finished = false;
      let timer = null;
      let quizBusy = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearInterval(timer);
        resolve();
      };
      timer = setInterval(async () => {
        if (quizBusy) return;
        quizBusy = true;
        try {
          if (player.paused()) {
            await tryPopupQuiz([win, outerWin, window], player);
          }
          // 若用户手动切换了章节导致当前视频 iframe 已脱离页面或已暂停,立即静默退出
          if (PAUSED || !iframe.isConnected || !win || !win.document) {
            finish();
            return;
          }
          if (typeof win.isUnFinishJob === 'function' && !win.isUnFinishJob()) {
            log('学习通报告本视频任务点已完成', 'ok');
            finish();
            return;
          }
          if (player.paused()) {
            try { player.play(); } catch (e) { /* ignore */ }
          }

          // 条件性拖动视频进度条:在前 10% 内正常播放满 6 秒后,随机跳到 90.5% ~ 93.5%
          if (allowDrag && !dragAttempted) {
            const dur = typeof player.duration === 'function' ? player.duration() : 0;
            const cur = typeof player.currentTime === 'function' ? player.currentTime() : 0;
            if (dur > 30 && cur > 0 && (Date.now() - playStartAt >= 6000 || cur >= dur * 0.03)) {
              dragAttempted = true;
              if (cur < dur * 0.85) {
                const targetRatio = 0.905 + Math.random() * 0.03; // 90.5% ~ 93.5%
                const targetSec = Math.floor(dur * targetRatio);
                log(`⏩ 从前 10% (${Math.round((cur / dur) * 100)}%) 随机拖动进度条至 ${(targetRatio * 100).toFixed(1)}% (${targetSec}s / ${Math.round(dur)}s)...`, 'info');
                try { player.currentTime(targetSec); } catch (e) { /* ignore */ }
                await sleep(1.8);
                const afterCur = typeof player.currentTime === 'function' ? player.currentTime() : 0;
                if (afterCur < dur * 0.85) {
                  log('⚠ 进度条被平台拉回,已自动回退为稳妥倍速播放策略', 'warn');
                } else {
                  log(`✓ 进度条成功跳至 ${Math.round((afterCur / dur) * 100)}%,按 ${CONFIG.speed}x 继续播放至结束`, 'ok');
                }
                try { player.playbackRate(CONFIG.speed); player.play(); } catch (e) { /* ignore */ }
              }
            }
          }
        } catch (e) { /* ignore */ }
        quizBusy = false;
      }, 2000);
      try { player.on('ended', () => { log('视频播放结束', 'ok'); finish(); }); } catch (e) { /* ignore */ }
    });

    try {
      const dur = typeof player.duration === 'function' ? player.duration() : 0;
      if (dur > 0) {
        const st = getTodayStats();
        st.minutes += Math.round(dur / 60);
        saveTodayStats(st);
        log(`⏱ 今日累计刷课约 ${st.minutes} 分钟`, 'info');
      }
    } catch (e) { /* ignore */ }
  }

  async function audioTask(iframe) {
    await waitIframeLoaded(iframe);
    const win = iframe.contentWindow;
    await waitElementLoaded(win, '#audio_html5_api', 90000);
    const audio = win.document.getElementById('audio_html5_api');
    audio.muted = true;
    audio.volume = 0;
    try { audio.play().catch(() => {}); } catch (e) { /* ignore */ }
    log('♪ 开始播放音频(静音)', 'ok');
    await new Promise((resolve) => {
      const timer = setInterval(() => {
        if (audio.ended) { clearInterval(timer); resolve(); return; }
        if (audio.paused) { try { audio.play().catch(() => {}); } catch (e) { /* ignore */ } }
      }, 2000);
      audio.addEventListener('ended', () => { clearInterval(timer); resolve(); });
    });
    log('✓ 音频任务播放结束');
  }

  async function pdfTask(iframe) {
    await waitIframeLoaded(iframe);
    const win = iframe.contentWindow;
    try {
      const pan = win.document.querySelector('#panView');
      if (pan && pan.contentWindow) {
        const pw = pan.contentWindow;
        pw.scrollTo(0, pw.document.body.scrollHeight);
        await sleep(1);
        pw.scrollTo(0, pw.document.body.scrollHeight);
      } else {
        win.scrollTo(0, win.document.body.scrollHeight);
      }
    } catch (e) { /* ignore */ }
    await sleep(1.5);
    log('✓ 文档任务处理完成');
  }

  async function imageTask(iframe) {
    await waitIframeLoaded(iframe);
    const win = iframe.contentWindow;
    try {
      win.scrollTo(0, win.document.body.scrollHeight);
      await sleep(0.5);
      win.scrollTo(0, 0);
    } catch (e) { /* ignore */ }
    log('🖼 图片任务:已打开并停留查看...', 'ok');
    await randomSleep(5, 8);
    log('✓ 图片任务处理完成');
  }

  /* ==================== 章节测验二次确认弹窗处理 (区分图2与图3) ==================== */
  async function handleSubmitConfirmModal(wins, workWin) {
    await sleep(1.5);
    for (const w of wins) {
      if (!w || !w.document) continue;
      let modals = [];
      try {
        modals = Array.from(w.document.querySelectorAll('.popDiv, .maskDiv, .el-dialog, .el-message-box, .layui-layer, .ans-modal, [role="dialog"], div'));
      } catch (e) { continue; }

      for (const m of modals) {
        if (!isVisible(m)) continue;
        const txt = clean(m.textContent || '');
        if (txt.length < 4 || txt.length > 300) continue;
        if (!/确认提交|确定提交|是否提交/.test(txt)) continue;

        // 筛选最小外层弹窗容器(同时含文本与提交/取消按钮)
        const btns = Array.from(m.querySelectorAll('a, button, span, div, input[type=button]')).filter((b) => {
          if (!isVisible(b)) return false;
          const bt = (b.textContent || b.value || '').trim();
          return /^(提交|确定|确认|取消)$/.test(bt);
        });
        if (!btns.length) continue;

        // 图3情形:包含“您还有未做完的...”等提示 → 严禁提交,自动点取消并暂存
        if (/还有.*未做完|未做完的|未完成|还有.*未答|未作答/.test(txt)) {
          log(`⚠ 弹窗警告:「${txt.replace(/提示|\s+/g, ' ').trim()}」——检测到未做完题目,禁止交卷!`, 'err');
          const cancelBtn = btns.find((b) => /^(取消)$/.test((b.textContent || b.value || '').trim()));
          if (cancelBtn) { try { cancelBtn.click(); } catch (e) {} }
          try { if (workWin && typeof workWin.noSubmit === 'function') workWin.noSubmit(); } catch (e) {}
          return 'aborted_unfinished';
        }

        // 图2情形:正常“确认提交？” → 点击“提交”/“确定”
        const confirmBtn = btns.find((b) => /^(提交|确定|确认)$/.test((b.textContent || b.value || '').trim()));
        if (confirmBtn) {
          log('📤 检测到交卷确认弹窗(全部题目已作答),自动点击「提交」', 'ok');
          try { confirmBtn.click(); } catch (e) {}
          await sleep(1);
          try { if (workWin && typeof workWin.submitCheckTimes === 'function') workWin.submitCheckTimes(); } catch (e) {}
          return 'confirmed';
        }
      }
    }
    // 兜底:部分老版本直接调用 submitCheckTimes
    try { if (workWin && typeof workWin.submitCheckTimes === 'function') workWin.submitCheckTimes(); } catch (e) {}
    return 'fallback';
  }

  async function workTask(iframe, cardsWin = null) {
    await waitIframeLoaded(iframe);
    const outerWin = iframe.contentWindow;
    let innerIframe = null;
    try { innerIframe = outerWin.document.querySelector('iframe'); } catch (e) { /* ignore */ }
    if (!innerIframe) { log('测验内层 iframe 未找到,跳过', 'warn'); return; }
    await waitIframeLoaded(innerIframe);
    const win = innerIframe.contentWindow;
    await waitElementLoaded(win, '.TiMu, .questionLi', 30000);
    if (win.document.querySelector('.font-cxsecret')) {
      log('🔐 测验检测到字体加密,正在自动解密...', 'warn');
      const decOk = await decodeFont(win);
      if (!decOk) {
        log('⚠ 字体解密未完全成功,跳过自动作答(暂存不乱提交)', 'warn');
        try { win.alert = () => {}; if (typeof win.noSubmit === 'function') win.noSubmit(); } catch (e) { /* ignore */ }
        return;
      }
    }
    let els = Array.from(win.document.querySelectorAll('.TiMu'));
    let workStyle = false;
    if (!els.length) {
      els = Array.from(win.document.querySelectorAll('.questionLi'));
      workStyle = true;
    }
    if (!els.length) { log('未找到题目', 'warn'); return; }
    log(`📝 章节测验${workStyle ? '(作业结构)' : ''},共 ${els.length} 题`, 'ok');
    const tasks = [];
    for (const el of els) {
      const q = workStyle ? extractWorkQuestion(el) : extractQuizQuestion(el);
      if (q) tasks.push({ q, el });
    }
    let okCount = 0;
    for (let i = 0; i < tasks.length; i++) {
      const { q, el } = tasks[i];
      await randomSleep(CONFIG.answerIntervalMin, CONFIG.answerIntervalMax);
      const answers = await getAnswers(q);
      const ok = setQuizAnswer(answers, q, el, win);
      recordQuestion(q, answers);
      if (ok) okCount++;
      log(`第 ${i + 1}/${tasks.length} 题(类型 ${q.type}) ${ok ? '✓ 已作答' : '✗ 无答案或未选中'}`, ok ? 'ok' : 'warn');
    }
    const coverage = tasks.length ? okCount / tasks.length : 0;
    // 若有任何题目未能成功选中作答,直接暂存不点提交(双重保险防漏答交卷)
    if (okCount < tasks.length) {
      log(`⚠ 还有 ${tasks.length - okCount} 道题未完成作答,为防漏题交卷已自动暂存`, 'warn');
      try { win.alert = () => {}; if (typeof win.noSubmit === 'function') win.noSubmit(); } catch (e) { /* ignore */ }
      return;
    }
    if (CONFIG.autoSubmit && coverage >= CONFIG.minAccuracy) {
      await randomSleep(CONFIG.submitDelayMin, CONFIG.submitDelayMax);
      log(`作答覆盖率 ${Math.round(coverage * 100)}%,正在触发提交...`, 'ok');
      let submitted = false;
      // 先点击页面上的“提交”按钮以弹出确认框(图2/图3),若无按钮再调函数
      submitted = clickButtonByText(win, ['提交', '交卷', '确认提交']);
      if (!submitted) {
        try {
          if (typeof win.btnBlueSubmit === 'function') { win.btnBlueSubmit(); submitted = true; }
          else if (typeof win.submitWork === 'function') { win.submitWork(); submitted = true; }
        } catch (e) { /* ignore */ }
      }
      if (submitted) {
        const res = await handleSubmitConfirmModal([win, outerWin, cardsWin, window], win);
        if (res === 'aborted_unfinished') {
          log('已取消交卷并暂存答案', 'warn');
        } else {
          await sleep(2);
          log('✓ 测验已确认提交', 'ok');
        }
      } else {
        log('未找到提交入口,请手动提交', 'warn');
      }
    } else {
      log(`作答覆盖率 ${Math.round(coverage * 100)}% 低于阈值 ${Math.round(CONFIG.minAccuracy * 100)}%,暂存不提交`, 'warn');
      try { win.alert = () => {}; if (typeof win.noSubmit === 'function') win.noSubmit(); } catch (e) { /* ignore */ }
    }
  }

  async function homeworkTask() {
    initPanel();
    await waitElementLoaded(window, '.questionLi', 30000);
    if (window.document.querySelector('.font-cxsecret')) {
      log('🔐 作业检测到字体加密,正在自动解密...', 'warn');
      const decOk = await decodeFont(window);
      if (!decOk) {
        log('⚠ 作业字体解密不完整,停止自动填写以免填入乱码答案', 'warn');
        return;
      }
    }
    const els = Array.from(document.querySelectorAll('.questionLi'));
    if (!els.length) { log('未找到作业题目', 'warn'); return; }
    log(`📝 作业页,共 ${els.length} 题(填写后不会自动交卷,请检查后手动提交)`, 'ok');
    let okCount = 0;
    for (let i = 0; i < els.length; i++) {
      await randomSleep(CONFIG.answerIntervalMin, CONFIG.answerIntervalMax);
      const q = extractWorkQuestion(els[i]);
      if (!q) continue;
      const answers = await getAnswers(q);
      const ok = setQuizAnswer(answers, q, els[i], window);
      if (ok) okCount++;
      const size = (answers || []).join('').length;
      log(`第 ${i + 1}/${els.length} 题 ${ok ? `✓ 已作答(回读校验通过, ${size} 字)` : `✗ 写入失败或无可匹配答案(收到 ${size} 字)`}`, ok ? 'ok' : 'warn');
    }
    log(`作业填写完成(${okCount}/${els.length}),请人工检查后手动提交`);
  }

  /* ==================== 同小节多标签页(如「1 内容」「2 作业」)识别与切换 ==================== */
  function isTabActive(el) {
    if (!el) return false;
    const cls = (el.className || '') + ' ' + (el.parentElement ? el.parentElement.className || '' : '');
    if (/(^|\s)(active|cur|current|on|selected|ans-tab-active|prev_cur)(\s|$)/i.test(cls)) return true;
    try {
      const cs = el.ownerDocument.defaultView.getComputedStyle(el);
      const bg = cs.backgroundColor || '';
      // 图1激活态为蓝色胶囊按钮(rgb(58, 139, 255) 等高亮背景)
      const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (m) {
        const r = Number(m[1]), g = Number(m[2]), b = Number(m[3]);
        if (b > 180 && r < 120) return true;
      }
    } catch (e) { /* ignore */ }
    return false;
  }

  // 在顶层 document 和章节 cardsWin 中查找同小节的顶部卡片标签组
  function findNextSubTab(cardsWin) {
    const docs = [document];
    if (cardsWin && cardsWin.document) docs.push(cardsWin.document);

    for (const doc of docs) {
      // 1) 标准学习通顶部卡片选择器
      const stdSelectors = [
        '.prev_ul li',
        '#prev_tab li',
        '.tabtags span',
        '.tabtags li',
        '.ans-cc-tab li',
        '.card_tab li'
      ];
      for (const sel of stdSelectors) {
        const list = Array.from(doc.querySelectorAll(sel)).filter(isVisible);
        if (list.length >= 2) {
          const curIdx = list.findIndex(isTabActive);
          if (curIdx >= 0 && curIdx + 1 < list.length) {
            return list[curIdx + 1];
          }
        }
      }

      // 2) 启发式匹配图1样式的「1 内容」「2 作业」同级标签组
      const candidates = Array.from(doc.querySelectorAll('li, span, a, div, button')).filter((el) => {
        if (!isVisible(el)) return false;
        if (el.children.length > 3) return false;
        const t = (el.textContent || '').trim();
        return /^\d+\s*\S+$/.test(t) && t.length <= 15;
      });
      for (const c of candidates) {
        const parent = c.parentElement;
        if (!parent) continue;
        const siblings = Array.from(parent.children).filter((s) => {
          if (!isVisible(s)) return false;
          const st = (s.textContent || '').trim();
          return /^\d+\s*\S+$/.test(st) && st.length <= 15;
        });
        if (siblings.length >= 2) {
          const curIdx = siblings.findIndex(isTabActive);
          if (curIdx >= 0 && curIdx + 1 < siblings.length) {
            return siblings[curIdx + 1];
          }
        }
      }
    }
    return null;
  }

  /* ==================== 章节主循环与保底重试 ==================== */
  let running = false;
  let lastIframeUrl = '';

  function clickByText(win, texts) {
    const nodes = win.document.querySelectorAll('button, a, div, span, li');
    for (const n of nodes) {
      const t = (n.textContent || '').trim();
      if (!t || t.length > 20) continue;
      for (const kw of texts) {
        if (t === kw || (t.includes(kw) && !n.querySelector('input'))) {
          try { n.click(); } catch (e) { /* ignore */ }
          return true;
        }
      }
    }
    return false;
  }

  // 切下一节:点击后自动检测并确认「当前章节还有任务点未完成，是否去完成？」弹窗中的「下一节」按钮
  async function clickNextSection(cardsWin = null) {
    let clicked = false;
    const next = document.querySelector('.nextChapter');
    if (next && isVisible(next)) {
      try { next.click(); clicked = true; } catch (e) { /* ignore */ }
    } else {
      const nodes = Array.from(document.querySelectorAll('button, a, div, span'));
      for (const n of nodes) {
        if (!isVisible(n)) continue;
        const t = (n.textContent || '').trim();
        if (t === '下一节' || t === '下一章') {
          try { n.click(); clicked = true; break; } catch (e) { /* ignore */ }
        }
      }
    }
    if (!clicked) return false;

    // 延迟检测是否弹出「当前章节还有任务点未完成，是否去完成？ [去学习] [下一节]」拦截弹窗
    for (const delay of [0.8, 1.0]) {
      await sleep(delay);
      const wins = [window];
      if (cardsWin) wins.push(cardsWin);
      for (const w of wins) {
        if (!w || !w.document) continue;
        const dialogs = Array.from(w.document.querySelectorAll('.popDiv, .maskDiv, .el-dialog, .el-message-box, .layui-layer, [role="dialog"], div')).filter((el) => {
          if (!isVisible(el)) return false;
          const txt = (el.textContent || '').trim();
          return txt.length > 6 && txt.length < 250 && /还有任务点未完成|是否去完成|未完成任务点/.test(txt);
        });
        for (const dlg of dialogs) {
          const btns = Array.from(dlg.querySelectorAll('a, button, span, div, input[type=button]')).filter(isVisible);
          const forceNextBtn = btns.find((b) => /^(下一节|下一章|继续|确定)$/.test((b.textContent || b.value || '').trim()));
          if (forceNextBtn) {
            log('⏭ 检测到「还有任务点未完成」拦截弹窗,自动点击「下一节」强制跳转', 'warn');
            try { forceNextBtn.click(); } catch (e) { /* ignore */ }
            return true;
          }
        }
      }
    }
    return true;
  }

  async function topLevelQuiz() {
    if (document.querySelector('.font-cxsecret')) {
      await decodeFont(window);
    }
    const els = Array.from(document.querySelectorAll('.TiMu'));
    if (els.length) {
      log(`📝 检测到顶层测验(共 ${els.length} 题)`, 'ok');
      let okCount = 0;
      for (let i = 0; i < els.length; i++) {
        await randomSleep(CONFIG.answerIntervalMin, CONFIG.answerIntervalMax);
        const q = extractQuizQuestion(els[i]);
        if (!q) continue;
        const answers = await getAnswers(q);
        const ok = setQuizAnswer(answers, q, els[i], window);
        if (ok) okCount++;
        log(`第 ${i + 1}/${els.length} 题 ${ok ? '✓ 已作答' : '✗ 无答案'}`, ok ? 'ok' : 'warn');
      }
      log(`顶层测验作答完成(${okCount}/${els.length}),请留意提交按钮`, 'ok');
      return;
    }
    const container = heuristicFindQuiz(window);
    if (container) {
      const q = extractHeuristicQuestion(container);
      if (q && q.question) {
        log(`❓ 检测到顶层弹题: ${q.question.slice(0, 40)}...`, 'warn');
        const answers = await getAnswers(q);
        const ok = setHeuristicAnswer(answers, q, container);
        log(ok ? '弹题已作答' : '弹题未能作答', ok ? 'ok' : 'warn');
        await sleep(0.3);
        clickButtonByText(window, ['继续学习', '确定', '提交', '下一题', '关闭', '继续', '我知道了']);
      }
    }
  }

  // 执行单个任务点并附带「完成状态检测 + 保底重试一次 + 失败红字警告跳过」
  // 检查当前任务所属的章节卡片上下文是否仍然存活(未被人手切章或销毁)
  function isCardContextAlive(cardsWin, startUrl, node = null) {
    try {
      if (PAUSED || dailyLimitReached) return false;
      const topFrame = document.querySelector('#iframe');
      if (!topFrame || topFrame.contentWindow !== cardsWin) return false;
      if (!cardsWin || cardsWin.closed || !cardsWin.document) return false;
      if (startUrl && cardsWin.location.href !== startUrl) return false;
      if (node && !node.isConnected) return false;
      return true;
    } catch (e) {
      return false;
    }
  }

  // 执行单个任务点并附带「完成状态检测 + 保底重试一次 + 失败红字警告跳过」
  async function runSingleJobWithVerify(icon, cardsWin, startUrl) {
    if (!isCardContextAlive(cardsWin, startUrl, icon)) return;
    const parent = icon.parentElement;
    if (isTaskFinished(parent, null)) return;
    const iframe = parent ? parent.querySelector('iframe') : null;
    if (!iframe) { log('任务点无 iframe,跳过', 'warn'); return; }

    let info = {};
    try { info = JSON.parse(iframe.getAttribute('data') || '{}'); } catch (e) { /* ignore */ }
    const src = iframe.src || '';
    const taskName = info.name || info.title || src.slice(-36) || '未知任务点';

    const executeTaskOnce = async (isRetry) => {
      if (src.includes('/ananas/modules/video/index.html')) {
        if (!CONFIG.autoVideo) { log('视频任务已跳过(配置关闭)'); return 'skipped'; }
        await videoTask(iframe, cardsWin, parent, isRetry);
        return 'ran';
      } else if (src.includes('/ananas/modules/audio/index.html')) {
        if (!CONFIG.autoAudio) { log('音频任务已跳过(配置关闭)'); return 'skipped'; }
        await audioTask(iframe);
        return 'ran';
      } else if (src.includes('/ananas/modules/work/index.html')) {
        if (!CONFIG.autoWork) { log('测验任务已跳过(配置关闭)'); return 'skipped'; }
        await workTask(iframe, cardsWin);
        return 'ran';
      } else if (src.includes('/ananas/modules/pdf/index.html')) {
        await pdfTask(iframe);
        return 'ran';
      } else if (src.includes('/ananas/modules/img/') || src.includes('/ananas/modules/image/') || src.includes('/ananas/modules/picture/') || /img.*index\.html/.test(src)) {
        await imageTask(iframe);
        return 'ran';
      } else {
        log('未知任务类型: ' + src, 'warn');
        return 'skipped';
      }
    };

    log(`开始任务点: ${taskName}`);
    try {
      const st = await executeTaskOnce(false);
      if (st === 'skipped') return;
    } catch (e) {
      if (!isCardContextAlive(cardsWin, startUrl, iframe)) return;
      log(`任务执行异常: ${e.message}`, 'err');
    }

    // 若在任务执行期间用户手动切换了章节或暂停,直接静默退出,不触发保底重试与报错
    if (!isCardContextAlive(cardsWin, startUrl, iframe)) {
      log(`ℹ 检测到章节已手动切换或暂停,中止旧任务「${taskName}」`, 'info');
      return;
    }

    // 等待 2.5 秒让学习通更新 DOM 任务点完成状态
    await sleep(2.5);
    if (!isCardContextAlive(cardsWin, startUrl, iframe)) return;
    if (isTaskFinished(parent, iframe)) {
      log(`✓ 任务点已完成确认: ${taskName}`, 'ok');
      return;
    }

    // 第一次未完成 → 启动保底策略重试一次(视频强制关闭进度条拖动,从头按倍速完整播完)
    log(`⚠ 任务点「${taskName}」尚未标记完成,启动保底策略重新尝试一次...`, 'warn');
    try {
      await executeTaskOnce(true);
    } catch (e) {
      if (!isCardContextAlive(cardsWin, startUrl, iframe)) return;
      log(`保底重试异常: ${e.message}`, 'err');
    }

    await sleep(2.5);
    if (!isCardContextAlive(cardsWin, startUrl, iframe)) return;
    if (isTaskFinished(parent, iframe)) {
      log(`✓ 保底重试成功,任务点已完成: ${taskName}`, 'ok');
    } else {
      setStatus('工作中(有未完成警告)', true);
      log(`❌ [未完成警告] 任务点「${taskName}」保底重试后仍未完成!请人工检查,已跳过并继续运行`, 'err');
    }
  }

  // 扫描并执行当前激活卡片标签页内的所有任务点
  async function newChapterLoop(cardsWin, startUrl = '') {
    log('🧭 检测到无传统任务点图标,尝试新版卡片或问卷/文本页适配...', 'info');
    const limitHit = () => {
      try {
        const txt = String(document.body ? document.body.textContent : '') + ' ' + String(cardsWin.document.body ? cardsWin.document.body.textContent : '');
        return txt.includes('今日视频任务点完成数已达上限');
      } catch (e) { return false; }
    };
    if (limitHit()) {
      log('⏹ 平台提示:今日视频任务点已达上限,跳过视频任务(明天恢复),只处理学习检测', 'warn');
    }

    await topLevelQuiz();
    if (!isCardContextAlive(cardsWin, startUrl)) return;

    // 1) 检查是否有新版「学习检测 / 学习测验」标签
    if (CONFIG.autoWork) {
      const tabClicked = clickByText(cardsWin, ['学习检测', '学习测验']);
      if (tabClicked) {
        await sleep(2);
        let workFrame = null;
        for (let i = 0; i < 15 && !workFrame; i++) {
          if (!isCardContextAlive(cardsWin, startUrl)) return;
          const fs = Array.from(cardsWin.document.querySelectorAll('iframe'));
          workFrame = fs.find((f) => /\/ananas\/modules\/work\//.test(String(f.src || ''))) || null;
          if (!workFrame) await sleep(1);
        }
        if (workFrame) {
          await workTask(workFrame, cardsWin);
          log('✓ 学习检测处理结束', 'ok');
        } else {
          await topLevelQuiz();
        }
      }
    }

    // 2) 检查是否存在视频/图片/文档模块 iframe(最多等待 3 秒,避免在问卷/纯文本页空等 20 秒)
    let allFrames = [];
    for (let i = 0; i < 3; i++) {
      if (!isCardContextAlive(cardsWin, startUrl)) return;
      try { allFrames = Array.from(cardsWin.document.querySelectorAll('iframe')); } catch (e) { allFrames = []; }
      if (allFrames.length > 0) break;
      await sleep(1);
    }

    if (!allFrames.length) {
      log('ℹ 当前小节无内嵌任务模块(如评估问卷/导读页),直接跳过', 'ok');
      return;
    }

    // 3) 视频模块处理
    if (!limitHit() && CONFIG.autoVideo) {
      const videoFrame = allFrames.find((f) => /\/ananas\/modules\/video\//.test(String(f.src || '')));
      if (videoFrame) {
        await videoTask(videoFrame, cardsWin, videoFrame.parentElement, false);
        if (!isCardContextAlive(cardsWin, startUrl, videoFrame)) return;
        await sleep(2.5);
        if (!isTaskFinished(videoFrame.parentElement, videoFrame)) {
          log('⚠ 视频任务点尚未标记完成,启动保底策略完整重播一次...', 'warn');
          await videoTask(videoFrame, cardsWin, videoFrame.parentElement, true);
          if (!isCardContextAlive(cardsWin, startUrl, videoFrame)) return;
          await sleep(2.5);
          if (!isTaskFinished(videoFrame.parentElement, videoFrame)) {
            setStatus('工作中(有未完成警告)', true);
            log('❌ [未完成警告] 当前小节视频任务点重试后仍未完成!已跳过并继续运行', 'err');
          }
        }
      }
    }

    // 4) 图片与 PDF 模块处理
    const imgFrame = allFrames.find((f) => /\/ananas\/modules\/(img|image|picture)\//.test(String(f.src || '')));
    if (imgFrame && isCardContextAlive(cardsWin, startUrl)) await imageTask(imgFrame);

    const pdfFrame = allFrames.find((f) => /\/ananas\/modules\/pdf\//.test(String(f.src || '')));
    if (pdfFrame && isCardContextAlive(cardsWin, startUrl)) await pdfTask(pdfFrame);
  }

  // 扫描并执行当前激活卡片标签页内的所有任务点
  async function processCurrentCardTab() {
    await waitElementLoaded(window, '#iframe', 30000);
    const cardsIframe = document.querySelector('#iframe');
    await waitIframeLoaded(cardsIframe);
    let cardsWin = null;
    let startUrl = '';
    try {
      cardsWin = cardsIframe.contentWindow;
      startUrl = cardsWin.location.href;
    } catch (e) {
      log('章节 iframe 无法访问(跨域),请确认页面域名与脚本匹配', 'err');
      return null;
    }
    try { if (typeof window.scroll2Job === 'function') window.scroll2Job(); } catch (e) { /* ignore */ }
    const icons = cardsWin.document.querySelectorAll('.ans-job-icon');
    if (!icons.length) {
      log('当前卡片未找到传统任务点图标,尝试新版知识卡片模式处理...', 'info');
      await newChapterLoop(cardsWin, startUrl);
      return cardsWin;
    }
    for (const icon of Array.from(icons)) {
      if (!isCardContextAlive(cardsWin, startUrl, icon)) {
        return cardsWin;
      }
      await runSingleJobWithVerify(icon, cardsWin, startUrl);
      await sleep(0.5);
    }
    if (isCardContextAlive(cardsWin, startUrl)) {
      log(`当前卡片扫描结束(共 ${icons.length} 个任务点)`, 'ok');
    }
    return cardsWin;
  }

  // 完整章节循环:自动遍历同小节内多个顶部标签页(如「1 内容」「2 作业」),全部完成后再切下一节
  async function chapterLoop() {
    let tabGuard = 0;
    let lastCardsWin = null;
    while (tabGuard < 10) {
      tabGuard++;
      if (PAUSED || dailyLimitReached) return false;
      lastCardsWin = await processCurrentCardTab();
      if (PAUSED || dailyLimitReached) return false;

      // 记录当前已处理完的卡片 URL
      try {
        const curF = document.querySelector('#iframe');
        if (curF && curF.contentWindow) lastIframeUrl = curF.contentWindow.location.href;
      } catch (e) { /* ignore */ }

      // 检查同一小节顶部是否还有下一个未遍历的标签页(如「2 作业」)
      const nextSubTab = findNextSubTab(lastCardsWin);
      if (nextSubTab) {
        const tabTitle = (nextSubTab.textContent || '').trim() || `第 ${tabGuard + 1} 标签页`;
        log(`→ 切换同小节顶部标签页: 「${tabTitle}」`, 'ok');
        try { nextSubTab.click(); } catch (e) { /* ignore */ }
        await sleep(3);
        continue;
      }
      break;
    }

    if (CONFIG.autoJump && !PAUSED && !dailyLimitReached) {
      await sleep(0.5);
      if (await clickNextSection(lastCardsWin)) {
        log('→ 本小节全部标签页已处理完毕,切换到下一章/下一节', 'ok');
        return true; 
      } else {
        log('未找到下一章按钮(可能已是最后一章)', 'warn');
      }
    }
    return false;
  }

  function startWatch() {
    initPanel();
    enableBackgroundPlay(window);
    log('挂机引擎已启动,开始扫描任务点...', 'ok');
    setInterval(async () => {
      try {
        if (PAUSED || running) return;
        const f = document.querySelector('#iframe');
        if (!f || !f.contentWindow) return;
        let url = '';
        try { url = f.contentWindow.location.href; } catch (e) { return; }
        if (!url || url === 'about:blank') return;
        if (url !== lastIframeUrl) {
          lastIframeUrl = url;
          running = true;
          setStatus('工作中');
          let jumpedToNext = false;
          try {
            jumpedToNext = await chapterLoop();
          } catch (e) {
            log('主循环异常: ' + e.message, 'err');
          }
          if (jumpedToNext) {      
            await sleep(2);
            lastIframeUrl = '';
          }
          running = false;
          if (!PAUSED && !jumpedToNext) setStatus('待机');
        }
      } catch (e) { /* ignore */ }
    }, 2500);
  }

  /* ==================== 路由 ==================== */
  (function main() {
    startReporterHeartbeat();
    const path = location.pathname;
    const isChapterPage = /\/mycourse\/studentstudy/.test(path);
    const isHomeworkPage = /\/work\/(doHomeWorkNew|dowork)/.test(path);

    if (isChapterPage) {
      initPanel();
      if (!location.href.includes('mooc2=1')) {
        log('检测到旧版章节页,正在切换到新版(mooc2)...', 'warn');
        location.href += (location.href.includes('?') ? '&' : '?') + 'mooc2=1';
        return;
      }
      startWatch();
    } else if (isHomeworkPage) {
      initPanel();
      homeworkTask();
    } else {
      console.log('[刷课助手] 当前页面不支持自动任务,请在课程章节学习页使用。');
    }
  })();
})();
