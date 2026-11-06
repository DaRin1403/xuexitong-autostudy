  /* ==================== 字体加密解密(OCS 位图特征匹配) ==================== */
  // OCS 5.0 / 06c2af62d2708f5042b913caf4a3cabb251e66a9 (MIT).
/* OCS_LICENSE */
  const OCS_FONT = (() => {
/* OCS_MODULES */
    const embeddedTable = '/* OCS_TABLE_BASE64 */';
    const refTableUrl = 'https://cdn.ocsjs.com/resources/font/font_ref_cx.bin';
    function prepareTable() {
      if (!refTableCache.has(refTableUrl)) {
        const bytes = Uint8Array.from(atob(embeddedTable), (ch) => ch.charCodeAt(0));
        refTableCache.set(refTableUrl, Promise.resolve(parseRefTable(bytes.buffer)));
      }
      return refTableUrl;
    }
    return { crackFont, decryptText, decryptElements, extractFontFromStyle, prepareTable };
  })();
  const fontChecks = new WeakMap();
  const fontStates = new WeakMap();
  const fontJobs = new WeakMap();

  function extractFontBase64(win) {
    for (const style of win.document.querySelectorAll('style')) {
      if (!/cxsecret/i.test(style.textContent || '')) continue;
      const match = style.textContent.match(/base64,([A-Za-z0-9+/=\s]+)(?=["')])/);
      if (match) return match[1].replace(/\s/g, '');
    }
    return null;
  }

  function encryptedRoots(doc) {
    return Array.from(doc.querySelectorAll('.font-cxsecret'))
      .filter((el) => !el.parentElement?.closest('.font-cxsecret'));
  }

  function readableTextNodes(el) {
    const nodes = [], walker = el.ownerDocument.createTreeWalker(el, 4);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.parentElement.closest('script, style, textarea')) nodes.push(node);
    }
    return nodes;
  }

  async function decodeFont(win) {
    const doc = win.document;
    if (fontJobs.has(doc)) return fontJobs.get(doc);
    const job = Promise.resolve().then(() => decodeFontDocument(win));
    fontJobs.set(doc, job);
    try { return await job; } finally { fontJobs.delete(doc); }
  }

  async function decodeFontDocument(win) {
    const doc = win.document, roots = encryptedRoots(doc);
    if (!roots.length) return true;
    const b64 = extractFontBase64(win);
    const diagnostic = { method: 'ocs-bitmap-frb2', build: 'ocs-fontfix-2',
      sourceCommit: '06c2af62d2708f5042b913caf4a3cabb251e66a9',
      roots: roots.length, decodedRoots: 0, totalCharacters: 0,
      mappedCharacters: 0, changedCharacters: 0, missingCharacters: [], lowConfidence: [], details: [] };
    fontChecks.set(doc, diagnostic);
    if (!b64) {
      diagnostic.error = '未找到加密字体定义';
      log('🔐 未找到加密字体定义,保留原字体并跳过加密题目', 'warn'); return false;
    }
    try {
      let state = fontStates.get(doc);
      if (!state || state.b64 !== b64) {
        state = { b64, map: Object.create(null), details: new Map() };
        fontStates.set(doc, state);
      }
      const targets = new Set(roots.flatMap((el) => readableTextNodes(el).flatMap((n) => Array.from(n.nodeValue))));
      const newChars = [...targets].filter((ch) => ch.trim() && !Object.prototype.hasOwnProperty.call(state.map, ch));
      diagnostic.totalCharacters = targets.size;
      if (newChars.length) {
        log(`🔐 OCS 文字解密:正在识别 ${newChars.length} 个新字符...`);
        const buffer = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)).buffer;
        let lastProgress = 0;
        const result = await OCS_FONT.crackFont(buffer, newChars, {
          refTableUrl: OCS_FONT.prepareTable(), useWorker: newChars.length > 20,
          onProgress(done, total) {
            if (Date.now() - lastProgress > 1500 || done === total) {
              log(`OCS 文字识别 ${done}/${total}`); lastProgress = Date.now();
            }
          }
        });
        Object.assign(state.map, result.map);
        for (const detail of result.details) state.details.set(detail.from, detail);
      }
      const resolved = new Map();
      for (const ch of targets) {
        if (!ch.trim()) resolved.set(ch, ch);
        else if (Object.prototype.hasOwnProperty.call(state.map, ch)) resolved.set(ch, state.map[ch]);
        else diagnostic.missingCharacters.push(ch);
      }
      diagnostic.mappedCharacters = resolved.size;
      diagnostic.changedCharacters = [...resolved].filter(([a, b]) => a !== b).length;
      diagnostic.details = [...targets].map((ch) => state.details.get(ch)).filter(Boolean);
      diagnostic.lowConfidence = diagnostic.details.filter((d) => d.margin < 0.08);
      for (const root of roots) {
        const chars = readableTextNodes(root).flatMap((n) => Array.from(n.nodeValue));
        if (chars.some((ch) => !resolved.has(ch))) continue;
        applyDecodedText([root, ...root.querySelectorAll('.font-cxsecret')], resolved);
        diagnostic.decodedRoots++;
      }
      const complete = !doc.querySelector('.font-cxsecret');
      log(`🔓 OCS 解密:${diagnostic.changedCharacters} 个字符已还原,${diagnostic.decodedRoots}/${roots.length} 个区域完成`, complete ? 'ok' : 'warn');
      if (diagnostic.lowConfidence.length) log(`OCS 提示:${diagnostic.lowConfidence.length} 个字符识别置信度较低,请人工核对`, 'warn');
      if (!complete) log('未完整匹配的区域保留原字体;对应题目不会发送给 AI。请导出诊断日志。', 'warn');
      return complete;
    } catch (e) {
      diagnostic.error = String(e.message || e);
      log('OCS 字体解密失败,保留原字体:' + diagnostic.error, 'warn'); return false;
    }
  }

  function hasEncryptedText(el) {
    return !!el.closest('.font-cxsecret') || !!el.querySelector('.font-cxsecret');
  }

  // OCS 的逐字符映射只应用于文本节点;嵌套区域去重,避免重复解码。
  function applyDecodedText(els, resolved) {
    const roots = els.filter((el) => !els.some((other) => other !== el && other.contains(el)));
    const map = Object.fromEntries(resolved);
    for (const el of roots) {
      for (const node of readableTextNodes(el)) node.nodeValue = OCS_FONT.decryptText(node.nodeValue, map);
    }
    for (const el of els) {
      el.classList.remove('font-cxsecret');
      el.style.setProperty('font-family', '"Microsoft YaHei", sans-serif', 'important');
    }
  }
