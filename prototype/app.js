/* Mewse V1 interactive UI prototype. In-memory demo state only; no document I/O. */
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const html = document.documentElement;
  const workspace = $('#workspaceView');
  const library = $('#libraryView');
  const editor = $('#editor');
  const overlay = $('#overlay');
  const panels = $$('.drawer, .floating-panel, .modal');
  const originals = new Map();
  const documents = {
    chapter1: { title: '雨夜来客', chapter: '第一章', location: '第一卷 · 归港', body: '<p>雨是从傍晚开始下的。</p><p>邮局关门以后，沈舟独自坐在窗前，把白天没有分完的信又数了一遍。门外的脚步声停了很久，直到他抬头，那人才收起伞。</p><p>“这里还寄信吗？”来人问。</p><p>桌上的老式台灯闪了一下。沈舟看见他怀里抱着一只木盒，盒角沾着暗红色的泥。</p>' },
    chapter2: { title: '旧灯塔', chapter: '第二章', location: '第一卷 · 归港', body: '<p>灯塔在港口的北面，已经停用十七年。</p><p>沈舟沿着石阶往上走，风从破损的窗框灌进来。墙上还留着父亲用铅笔记下的潮汐高度，最上面的一道，恰好与他的肩齐平。</p><p>“那时候你总说，灯亮着，船就认得回家的路。”</p><p>他没有开灯。远处的海面上，一艘船正缓慢驶过。</p>' },
    chapter3: { title: '没有地址的信', chapter: '第三章', location: '第一卷 · 归港', body: '<p>信封上没有地址，只有一个褪色的蓝色邮戳。</p><p>沈舟把它放在桌上，和母亲留下的那一封并排。两张纸的折痕完全一样，连右下角的水渍都落在相同的位置。</p><p>他终于明白，有人希望他找到这里。</p>' },
    chapter4: { title: '潮汐表', chapter: '第四章', location: '第一卷 · 归港', body: '<p>旧抽屉里藏着一本潮汐表，最后一页被整齐地撕去了。</p><p>沈舟对着灯光举起本子。撕口的纤维里夹着一小片深蓝色蜡纸，上面印着他从未见过的船徽。</p><p>明天凌晨四点，是大潮。</p>' },
    chapter5: { title: '雾中的船鸣', chapter: '第五章', location: '第一卷 · 归港', body: editor.innerHTML },
    chapter6: { title: '离港之前', chapter: '第六章', location: '第二卷 · 远海', body: '<p>出发前的最后一个晚上，沈舟把那枚旧钥匙留在了邮局。</p><p>他知道，有些门一旦打开，就再也回不到从前。</p>' },
    chapter7: { title: '海图背面', chapter: '第七章', location: '第二卷 · 远海', body: '<p>海图背面画着另一条航线，终点不是港口，而是一片没有名字的雾。</p>' },
    outline: { title: '第二卷 · 分章大纲', chapter: '草稿', location: '灵感与草稿', body: '<h2>第二卷 · 远海</h2><h3>核心线索</h3><p>沈舟决定沿父亲留下的海图寻找雾港。沈舟逐渐发现，所谓“归港”并不指向一个真实地点。</p><h3>第五章 · 雾中的船鸣</h3><ul><li>船鸣只在雾天出现，母亲对此避而不谈。</li><li>陌生雨衣人送来没有地址的信。</li><li>章末揭示：信封上的邮戳日期是二十年前。</li></ul><h3>第六章 · 离港之前</h3><p>沈舟与母亲在灯塔发生争执。父亲当年并非失踪，而是主动选择离开。</p>' },
    character: { title: '关于沈舟的过去', chapter: '草稿', location: '灵感与草稿', body: '<h2>关于沈舟的过去</h2><p>十七年前父亲失踪后，沈舟离开家乡。对海的声音既熟悉又抗拒。</p><p>人物习惯：思考时会用拇指摩挲杯壁；不擅长直接表达担心。</p>' },
    fragment: { title: '未命名的片段', chapter: '草稿', location: '灵感与草稿', body: '<p>船鸣响过以后，港口所有的钟都慢了一分钟。</p>' }
  };
  const bookInfo = {
    tide: { title: '雾港来信', doc: 'chapter5' },
    mountain: { title: '山间邮局', doc: 'chapter1' },
    summer: { title: '夏日修补店', doc: 'chapter2' }
  };
  let currentDoc = 'chapter5';
  let activePanel = null;
  let previousFocus = null;
  let saveTimer;
  let toastTimer;
  let matches = [];
  let matchIndex = -1;
  let isSplit = false;
  let typewriterMode = false;
  let savedSelection = null;
  let findOriginal = null;
  let findSignature = '';

  function icon(name, small = false) {
    return `<svg class="icon${small ? ' small' : ''}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  }

  function closePanel(restoreFocus = true) {
    if (activePanel === 'findPanel' && findOriginal !== null) {
      editor.innerHTML = findOriginal;
      originals.set(currentDoc, findOriginal);
      findOriginal = null;
      findSignature = '';
      matches = [];
      countText();
    }
    if (activePanel !== 'findPanel') { findOriginal = null; findSignature = ''; }
    panels.forEach(panel => { panel.hidden = true; });
    $$('.theme-trigger, .publish-trigger').forEach(btn => { btn.classList.remove('active'); btn.setAttribute('aria-expanded', 'false'); });
    overlay.hidden = true;
    activePanel = null;
    if (restoreFocus && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }

  function openPanel(id, options = {}) {
    if (activePanel === id) { closePanel(); return; }
    previousFocus = document.activeElement;
    closePanel(false);
    activePanel = id;
    const panel = document.getElementById(id);
    if (!panel) return;
    panel.hidden = false;
    overlay.hidden = !panel.classList.contains('modal') && !panel.classList.contains('drawer');
    const focusTarget = options.focus ? $(options.focus, panel) : $('input, button, select', panel);
    if (focusTarget && !options.noAutoFocus) setTimeout(() => focusTarget.focus({ preventScroll: true }), 30);
  }

  function toast(message) {
    clearTimeout(toastTimer);
    $('#toastMessage').textContent = message;
    $('#toast').hidden = false;
    toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3500);
  }

  function countText() {
    const text = editor.innerText;
    const effective = text.replace(/\s/g, '').replace(/---/g, '').length;
    const chinese = (text.match(/[\u3400-\u9fff]/g) || []).length;
    $('#wordCount').textContent = effective.toLocaleString('zh-CN');
    $('#detailCount').textContent = effective.toLocaleString('zh-CN');
    $('#chineseCount').textContent = chinese.toLocaleString('zh-CN');
  }

  function markSaving() {
    clearTimeout(saveTimer);
    $('#saveState').innerHTML = `${icon('history', true)}保存中…`;
    saveTimer = setTimeout(() => {
      documents[currentDoc].body = editor.innerHTML;
      documents[currentDoc].title = $('#chapterTitle').value;
      $('#saveState').innerHTML = `${icon('check', true)}已保存`;
      countText();
    }, 650);
  }

  function openDocument(id, target = 'main') {
    if (!documents[id]) return;
    if (target === 'reference') { $('#referenceSelect').value = id; renderReference(); closePanel(); return; }
    closePanel(false);
    documents[currentDoc].body = editor.innerHTML;
    documents[currentDoc].title = $('#chapterTitle').value;
    currentDoc = id;
    const doc = documents[id];
    $('#chapterTitle').value = doc.title;
    $('#chapterName').textContent = doc.chapter;
    $('#chapterLocation').innerHTML = `${doc.location} <span>/</span> ${doc.chapter}`;
    editor.innerHTML = doc.body;
    editor.contentEditable = 'true';
    applyDialogueHighlight();
    originals.set(id, editor.innerHTML);
    $$('.tree-item').forEach(item => {
      const active = item.dataset.doc === id;
      item.classList.toggle('active', active);
      if (active) item.setAttribute('aria-current', 'page'); else item.removeAttribute('aria-current');
    });
    $('#writingScroll').scrollTop = 0;
    if (isSplit && $('#referenceSelect').value === id) renderReference(true);
    closePanel();
    countText();
    markSaving();
    if (window.innerWidth <= 640) workspace.classList.add('sidebar-collapsed');
  }

  function renderReference(preserveScroll = false) {
    const id = $('#referenceSelect').value;
    const body = $('#referenceBody');
    const prevScroll = preserveScroll ? body.scrollTop : 0;
    const doc = documents[id] || documents.outline;
    const sameNote = id === currentDoc ? '<div class="reference-same-note">正在对照同一篇文档，右侧编辑将实时同步到此栏</div>' : '';
    const content = id === currentDoc ? `<h2>${escapeHtml($('#chapterTitle').value)}</h2>${editor.innerHTML}` : doc.body;
    body.innerHTML = sameNote + content;
    if (preserveScroll) body.scrollTop = prevScroll;
  }

  function setSplit(value) {
    isSplit = value;
    workspace.classList.toggle('split-view', value);
    $('#splitButton').classList.toggle('active', value);
    $('#splitButton').setAttribute('aria-pressed', String(value));
    if (value) renderReference();
    toast(value ? '已开启双栏对照，可选择左侧文档' : '已返回单栏写作');
  }

  function toggleFocus(forceOff = false) {
    const enabled = forceOff ? false : !workspace.classList.contains('focus-mode');
    workspace.classList.toggle('focus-mode', enabled);
    if (enabled) {
      closePanel();
      toast('已进入专注模式，按 Esc 退出');
      setTimeout(() => editor.focus({ preventScroll: true }), 50);
    }
  }

  function showActionModal(title, content) {
    $('#actionTitle').textContent = title;
    $('#actionModalBody').innerHTML = content;
    openPanel('actionModal', { focus: 'input' });
  }

  function buildPublishText() {
    const dividerSymbol = $('#dividerSelect').value;
    const dividerText = dividerSymbol === '空行' ? '' : dividerSymbol;
    const indent = $('#publishIndent').checked ? '　　' : '';
    const separator = $('#publishBlank').checked ? '\n\n' : '\n';
    const blocks = $$(':scope > p, :scope > hr', editor).map(el => {
      if (el.tagName === 'HR') return dividerText;
      const line = el.innerText.trim();
      return line ? indent + line : '';
    }).filter((item, idx, arr) => item !== '' || (idx > 0 && arr[idx - 1] !== ''));
    let text = blocks.join(separator);
    if ($('#publishTitleCheck').checked) text = $('#chapterTitle').value + separator + text;
    return text;
  }

  function performCopy() {
    const text = buildPublishText();
    const done = () => toast(`已按发布格式复制，共 ${countPlain(text).toLocaleString('zh-CN')} 字`);
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    else fallbackCopy(text, done);
  }

  function countPlain(text) { return text.replace(/\s/g, '').length; }
  function fallbackCopy(text, done) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(textarea);
    textarea.select();
    try { document.execCommand('copy'); done(); } catch { toast('复制内容已准备好，请使用系统复制快捷键'); }
    textarea.remove();
  }

  function exportChapter(mode = 'pure') {
    const isPublish = mode === 'publish';
    const text = isPublish ? buildPublishText() : `${$('#chapterTitle').value}\n\n${editor.innerText}`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${$('#chapterTitle').value}${isPublish ? '-发布版' : ''}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
    closePanel();
    toast(isPublish ? '已按发布格式导出 .txt，书库中的原稿未改动' : '已导出纯净原稿，书库中的文件未改动');
  }

  function searchBooks(query) {
    const normalized = query.trim();
    if (!normalized) {
      $('#searchResultCount').textContent = '';
      $('#searchResults').innerHTML = ['chapter5', 'outline', 'chapter4'].map(id => searchResultHtml(id, documents[id], '')).join('');
      return;
    }
    const results = Object.entries(documents).filter(([, doc]) => (doc.title + doc.body).toLowerCase().includes(normalized.toLowerCase()));
    $('#searchResultCount').textContent = `${results.length} 个匹配文档`;
    $('#searchResults').innerHTML = results.length ? results.map(([id, doc]) => searchResultHtml(id, doc, normalized)).join('') : '<div class="empty-search"><p>没有找到相关内容</p><span>试试搜索人物、地点或章节标题</span></div>';
  }

  function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
  function searchResultHtml(id, doc, query) {
    const title = query ? escapeHtml(doc.title).replace(new RegExp(escapeRegExp(escapeHtml(query)), 'gi'), match => `<mark>${match}</mark>`) : doc.title;
    return `<button class="search-result" data-doc="${id}"><span class="result-icon">${icon(doc.chapter === '草稿' ? 'bulb' : 'file')}</span><span><strong>${title}</strong><small>${doc.location}</small></span>${icon('arrow', true)}</button>`;
  }
  function escapeRegExp(text) { return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function findMatches(direction = 1) {
    const query = $('#findInput').value;
    if (!query) { $('#matchCount').textContent = '0 / 0'; return; }
    const signature = `${currentDoc}:${query}`;
    if (signature !== findSignature) {
      if (findOriginal !== null) editor.innerHTML = findOriginal;
      else findOriginal = editor.innerHTML;
      findSignature = signature;
      matchIndex = -1;
    }
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    matches = [];
    for (const textNode of nodes) {
      const parent = textNode.parentElement;
      if (!parent || parent.classList.contains('search-match')) continue;
      let offset = textNode.data.toLowerCase().indexOf(query.toLowerCase());
      if (offset === -1) continue;
      try {
        const range = document.createRange();
        range.setStart(textNode, offset);
        range.setEnd(textNode, offset + query.length);
        const mark = document.createElement('mark');
        mark.className = 'search-match';
        range.surroundContents(mark);
        matches.push(mark);
      } catch { /* Ignore a match crossing an element boundary. */ }
    }
    if (!matches.length) { $('#matchCount').textContent = '0 / 0'; return; }
    matchIndex = (matchIndex + direction + matches.length) % matches.length;
    matches.forEach((match, index) => match.classList.toggle('current', index === matchIndex));
    $('#matchCount').textContent = `${matchIndex + 1} / ${matches.length}`;
    matches[matchIndex].scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function replaceMatch(all = false) {
    const query = $('#findInput').value;
    const replacement = $('#replaceInput').value;
    if (!query) { toast('请先输入要查找的内容'); return; }
    const raw = editor.innerText;
    const regex = new RegExp(escapeRegExp(query), all ? 'g' : '');
    const count = (raw.match(new RegExp(escapeRegExp(query), 'g')) || []).length;
    if (!count) { toast('没有找到可替换的内容'); return; }
    editor.innerText = raw.replace(regex, replacement);
    findOriginal = editor.innerHTML;
    originals.set(currentDoc, editor.innerHTML);
    markSaving();
    toast(all ? `已替换 ${count} 处，可通过撤销恢复` : '已替换当前匹配');
  }

  function buildHeatmap() {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < 364; i++) {
      const day = document.createElement('i');
      const level = (i * 17 + Math.floor(i / 7) * 3) % 13;
      const intensity = level < 3 ? 0 : level < 6 ? 1 : level < 9 ? 2 : level < 11 ? 3 : 4;
      day.dataset.level = intensity;
      const words = intensity === 0 ? 0 : 327 + (i * 137) % 2368;
      const date = new Date(2026, 0, i + 1);
      day.title = `${date.getMonth() + 1} 月 ${date.getDate()} 日 · ${words.toLocaleString('zh-CN')} 字`;
      fragment.appendChild(day);
    }
    $('#heatmap').appendChild(fragment);
  }

  function toggleSwitch(button) {
    const enabled = button.getAttribute('aria-checked') !== 'true';
    button.setAttribute('aria-checked', String(enabled));
    if (button.id === 'indentSwitch') html.classList.toggle('no-indent', !enabled);
    if (button.id === 'dialogueSwitch') html.classList.toggle('no-dialogue', !enabled);
    if (button.id === 'typewriterSwitch') {
      typewriterMode = enabled;
      if (enabled) toast('已开启打字机居中滚动');
    }
  }

  function applyDialogueHighlight() {
    $$('p', editor).forEach(p => {
      // Visual-only prototype highlighting: strictly isolated inside each paragraph.
      if (p.querySelector(':not(span.dialogue)')) return;
      const text = p.textContent;
      if (!text.includes('“') && !text.includes('「')) return;
      p.innerHTML = escapeHtml(text).replace(/(“[^”]*”|「[^」]*」)/g, '<span class="dialogue">$1</span>');
    });
  }

  function keepCaretCentered() {
    if (!typewriterMode || !workspace.classList.contains('focus-mode')) return;
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    const rect = range.getClientRects()[0] || range.startContainer?.parentElement?.getBoundingClientRect();
    const scroller = $('#writingScroll');
    if (!rect || !scroller) return;
    const viewRect = scroller.getBoundingClientRect();
    const targetY = viewRect.top + viewRect.height * 0.45;
    const delta = rect.top - targetY;
    if (Math.abs(delta) > 28) scroller.scrollBy({ top: delta, behavior: 'smooth' });
  }

  const actions = {
    library() { closePanel(); workspace.hidden = true; library.hidden = false; $('.skip-link').href = '#libraryTitle'; },
    'open-workspace'(button) { const book = button.closest('[data-book]')?.dataset.book; const info = bookInfo[book] || bookInfo.tide; $('#currentBook').textContent = info.title; closePanel(); library.hidden = true; workspace.hidden = false; $('.skip-link').href = '#editor'; if (info.doc !== currentDoc) openDocument(info.doc); },
    collapse() { workspace.classList.toggle('sidebar-collapsed'); },
    split() { setSplit(!isSplit); },
    focus() { toggleFocus(); },
    search() { openPanel('searchPanel', { focus: '#globalSearch' }); $('#globalSearch').value = ''; searchBooks(''); },
    theme(button) {
      const wasOpen = activePanel === 'themePanel';
      openPanel('themePanel', { focus: '.theme-choice.active' });
      if (wasOpen) return;
      const panel = $('#themePanel');
      if (button && panel) {
        const rect = button.getBoundingClientRect();
        const right = Math.max(10, Math.round(window.innerWidth - rect.right));
        const top = Math.round(rect.bottom + 8);
        panel.style.top = `${top}px`;
        panel.style.right = `${right}px`;
      }
      $$('.theme-trigger').forEach(btn => {
        const isCurrent = btn === button;
        btn.classList.toggle('active', isCurrent);
        btn.setAttribute('aria-expanded', String(isCurrent));
      });
    },
    settings() { openPanel('settingsDrawer'); },
    publish(button) {
      const wasOpen = activePanel === 'publishPanel';
      openPanel('publishPanel');
      if (wasOpen) return;
      const panel = $('#publishPanel');
      if (button && panel) {
        const rect = button.getBoundingClientRect();
        panel.style.top = `${Math.round(rect.bottom + 8)}px`;
        panel.style.right = `${Math.max(10, Math.round(window.innerWidth - rect.right))}px`;
      }
      if (button) {
        button.classList.add('active');
        button.setAttribute('aria-expanded', 'true');
      }
    },
    copy() { performCopy(); closePanel(); },
    snapshot() { openPanel('historyDrawer'); },
    trash() { openPanel('trashDrawer'); },
    find() { savedSelection = window.getSelection()?.rangeCount ? window.getSelection().getRangeAt(0).cloneRange() : null; openPanel('findPanel', { focus: '#findInput' }); },
    wordcount() { countText(); openPanel('wordPanel'); },
    calendar() { openPanel('calendarModal'); },
    conflict() { openPanel('conflictModal'); },
    'toggle-drafts'() { const button = $('[data-action="toggle-drafts"]'); const expanded = button.getAttribute('aria-expanded') !== 'true'; button.setAttribute('aria-expanded', expanded); $('#draftItems').hidden = !expanded; },
    'toggle-volume'() { const button = $('[data-action="toggle-volume"]'); const expanded = button.getAttribute('aria-expanded') !== 'true'; button.setAttribute('aria-expanded', expanded); $('#volumeItems').hidden = !expanded; },
    'toggle-next'() { const button = $('[data-action="toggle-next"]'); const expanded = button.getAttribute('aria-expanded') !== 'true'; button.setAttribute('aria-expanded', expanded); $('#nextVolume').hidden = !expanded; },
    'new-chapter'() {
      showActionModal('新建章节', `<div class="modal-field"><label for="newChapterTitle">章节标题</label><input id="newChapterTitle" placeholder="输入章节标题" maxlength="40"></div><div class="modal-field"><label for="newChapterVolume">所属卷</label><select id="newChapterVolume"><option>第一卷 · 归港</option><option>第二卷 · 远海</option></select></div><div class="modal-actions"><button class="btn btn--secondary" data-close>取消</button><button class="btn btn--primary" data-action="confirm-chapter">新建章节</button></div>`);
    },
    'confirm-chapter'() {
      const title = $('#newChapterTitle').value.trim();
      if (!title) { $('#newChapterTitle').focus(); toast('请输入章节标题'); return; }
      const volumeName = $('#newChapterVolume').value;
      const isSecond = volumeName.includes('第二卷');
      const list = $(isSecond ? '#nextVolume' : '#volumeItems');
      const toggle = $(isSecond ? '[data-action="toggle-next"]' : '[data-action="toggle-volume"]');
      const nextNum = String(list.children.length + (isSecond ? 6 : 1)).padStart(3, '0');
      const id = `chapter${Date.now()}`;
      const label = `${nextNum} ${title}`;
      documents[id] = { title, chapter: '新章节', location: volumeName, body: '<p><br></p>' };
      const button = document.createElement('button');
      button.className = 'tree-item';
      button.dataset.doc = id;
      button.innerHTML = `${icon('file', true)}<span>${escapeHtml(label)}</span>`;
      list.appendChild(button);
      if (isSecond) { toggle.setAttribute('aria-expanded', 'true'); list.hidden = false; }
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = label;
      $('#referenceSelect').appendChild(opt);
      closePanel();
      openDocument(id);
      editor.focus();
      toast('章节已创建，正在自动保存');
    },
    'book-menu'(button) {
      const card = button.closest('[data-book]');
      const slug = card?.dataset.book || 'tide';
      const title = card?.querySelector('h3')?.textContent || '雾港来信';
      const status = card?.querySelector('.status-tag')?.textContent || '连载中';
      showActionModal('作品信息与管理', `<div class="modal-field"><label for="editBookTitle">作品名称（同步对应本地文件夹）</label><input id="editBookTitle" value="${escapeHtml(title)}" maxlength="30"></div><div class="modal-field"><label for="editBookStatus">连载状态</label><select id="editBookStatus"><option${status === '连载中' ? ' selected' : ''}>连载中</option><option${status === '已完结' ? ' selected' : ''}>已完结</option><option${status === '暂停' ? ' selected' : ''}>暂停</option></select></div><div class="modal-actions" style="justify-content:space-between"><button class="text-button danger" data-action="remove-book-confirm" data-target-book="${escapeHtml(slug)}">从书架移除…</button><div style="display:flex;gap:10px"><button class="btn btn--secondary" data-close>取消</button><button class="btn btn--primary" data-action="save-book-info" data-target-book="${escapeHtml(slug)}">保存信息</button></div></div>`);
    },
    'save-book-info'(button) {
      const slug = button.dataset.targetBook;
      const newTitle = $('#editBookTitle')?.value.trim();
      if (!newTitle) { $('#editBookTitle')?.focus(); toast('作品名称不能为空'); return; }
      const newStatus = $('#editBookStatus')?.value || '连载中';
      const card = $(`.book-card[data-book="${slug}"]`);
      if (card) {
        const h3 = card.querySelector('h3');
        if (h3) h3.textContent = newTitle;
        const coverTitle = card.querySelector('.cover-title');
        if (coverTitle) coverTitle.textContent = newTitle;
        const tag = card.querySelector('.status-tag');
        if (tag) {
          tag.textContent = newStatus;
          tag.classList.toggle('status-complete', newStatus === '已完结');
        }
      }
      if (bookInfo[slug]) bookInfo[slug].title = newTitle;
      closePanel();
      toast(`已更新作品《${newTitle}》的信息`);
    },
    'remove-book-confirm'(button) {
      const slug = button.dataset.targetBook;
      const title = $(`.book-card[data-book="${slug}"] h3`)?.textContent || '此作品';
      showActionModal('确认移除作品？', `<p class="modal-description">确定将《${escapeHtml(title)}》从当前书架移除吗？此操作仅从书架列表取消展示，<strong>不会删除本地磁盘上的作品文件夹与文稿</strong>。</p><div class="modal-actions"><button class="btn btn--secondary" data-close>取消</button><button class="btn btn--danger" data-action="confirm-remove-book" data-target-book="${escapeHtml(slug)}">确认移除</button></div>`);
    },
    'confirm-remove-book'() {
      closePanel();
      toast('原型演示：已保护当前书架及本地文稿');
    },
    'new-book'() {
      showActionModal('新建作品', `<div class="modal-field"><label for="newBookTitle">作品名称</label><input id="newBookTitle" placeholder="给新的故事一个名字" maxlength="30"></div><div class="modal-field"><label for="newBookStatus">连载状态</label><select id="newBookStatus"><option>连载中</option><option>已完结</option><option>暂停</option></select></div><div class="modal-actions"><button class="btn btn--secondary" data-close>取消</button><button class="btn btn--primary" data-action="confirm-book">创建作品</button></div>`);
    },
    'confirm-book'() {
      const title = $('#newBookTitle').value.trim();
      if (!title) { $('#newBookTitle').focus(); toast('请输入作品名称'); return; }
      const status = $('#newBookStatus').value;
      const slug = `book_${Date.now()}`;
      const docId = `doc_${slug}`;
      documents[docId] = { title: '第一章', chapter: '第一章', location: '第一卷 · 序幕', body: '<p><br></p>' };
      bookInfo[slug] = { title, doc: docId };
      const card = document.createElement('article');
      card.className = 'book-card';
      card.dataset.book = slug;
      card.innerHTML = `<button class="book-open" data-action="open-workspace" aria-label="打开《${escapeHtml(title)}》"><div class="book-cover cover-mountain"><span class="cover-line"></span><span class="cover-title">${escapeHtml(title)}</span><span class="cover-author">林见夏 · 著</span></div><div class="book-info"><div class="book-title-row"><h3>${escapeHtml(title)}</h3><span class="status-tag${status === '已完结' ? ' status-complete' : ''}">${escapeHtml(status)}</span></div><p>刚刚创建的新作品。</p><div class="book-stats"><span>0 字</span><span>刚刚创建</span></div></div></button><button class="book-more icon-button small-button" data-action="book-menu" aria-label="《${escapeHtml(title)}》作品操作" title="作品信息与移除"><svg class="icon small"><use href="#i-more"/></svg></button>`;
      $('.book-grid').appendChild(card);
      const total = $$('.book-card').length;
      const countSpan = $('.library-meta h2 span');
      if (countSpan) countSpan.textContent = String(total);
      closePanel();
      toast(`作品《${title}》已创建，标准目录已初始化`);
    },
    import() { showActionModal('导入已有作品', `<p class="modal-description">支持规范作品文件夹及含 .txt 稿件的目录。导入时会生成 UTF-8 净化副本，原始文件保持不变。</p><button class="export-option selected" style="width:100%">${icon('upload')}<span><strong>选择作品文件夹</strong><small>选择后可预览目录、章节顺序和编码处理结果</small></span></button><div class="modal-actions"><button class="btn btn--secondary" data-close>取消</button><button class="btn btn--primary" data-action="confirm-import">确认导入</button></div>`); },
    'confirm-import'() { closePanel(); toast('导入预览已准备，原始文件不会被修改'); },
    workspace() { showActionModal('当前书库', `<div class="modal-field"><label for="workspacePath">本地书库目录</label><input id="workspacePath" value="Documents / Mewse" readonly></div><div class="modal-actions"><button class="btn btn--secondary" data-close>关闭</button><button class="btn btn--primary" data-action="switch-workspace">切换书库</button></div>`); },
    'switch-workspace'() { closePanel(); toast('已打开书库选择流程'); },
    export() { showActionModal('导出本章', `<div class="export-options"><button class="export-option" data-action="confirm-export" data-export-mode="pure">${icon('file')}<span><strong>纯净原稿格式 · .txt</strong><small>保留原始段落换行，首行附带章节标题</small></span></button><button class="export-option" data-action="confirm-export" data-export-mode="publish">${icon('upload')}<span><strong>平台发布格式 · .txt</strong><small>沿用当前发布预设，导出不影响原始文件</small></span></button></div>`); },
    'confirm-export'(button) { exportChapter(button?.dataset.exportMode || 'pure'); },
    restore(button) {
      const item = button?.closest('.trash-item');
      const name = item?.querySelector('h3')?.textContent || '文档';
      if (item) item.remove();
      const left = $$('.trash-item').length;
      const footerSpan = $('#trashDrawer .drawer-footer span');
      if (footerSpan) footerSpan.textContent = `共 ${left} 个项目`;
      if (!left) $('.trash-list').innerHTML = '<div class="empty-search"><p>回收站已清空</p><span>软删除的章节与草稿会在这里保留 180 天</span></div>';
      closePanel();
      toast(`已将「${name}」恢复到原位置`);
    },
    'empty-trash'() { showActionModal('清空回收站？', '<p class="modal-description">回收站中的项目将被永久删除，无法恢复。此操作会删除本地磁盘文件。</p><div class="modal-actions"><button class="btn btn--secondary" data-close>保留项目</button><button class="btn btn--primary" data-action="confirm-empty">永久删除</button></div>'); },
    'confirm-empty'() { closePanel(); toast('原型演示：未删除任何文件'); },
    'create-snapshot'() { showActionModal('创建历史快照', `<div class="modal-field"><label for="snapshotNote">快照备注</label><input id="snapshotNote" placeholder="例如：大改结局前" maxlength="40"></div><div class="modal-actions"><button class="btn btn--secondary" data-close>取消</button><button class="btn btn--primary" data-action="confirm-snapshot">保存快照</button></div>`); },
    'confirm-snapshot'() {
      const note = $('#snapshotNote')?.value.trim() || '手动保存的版本';
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const words = $('#wordCount').textContent || '0';
      const item = document.createElement('button');
      item.className = 'snapshot-item';
      item.dataset.action = 'compare';
      item.innerHTML = `<span class="snapshot-marker manual">${icon('book', true)}</span><span><strong>${escapeHtml(note)}</strong><span class="snapshot-meta">手动快照 · ${timeStr}</span></span><span class="snapshot-size">${words} 字</span>`;
      const todayLabel = $('#historyDrawer .list-label');
      if (todayLabel) todayLabel.insertAdjacentElement('afterend', item);
      closePanel();
      toast(`快照已创建：${note}`);
    },
    compare() { showActionModal('对比历史快照', `<p class="modal-description">登灯塔之前 · 今天 10:24<br>恢复前将自动为当前正文创建保护快照。</p><div class="version-grid"><div><span class="version-label">历史版本</span><p>他走到窗边，看见一个穿雨衣的人站在街角。</p></div><div><span class="version-label">当前正文</span><p>他走到窗边，看见一个穿<mark>深色</mark>雨衣的人站在街角。</p></div></div><div class="modal-actions"><button class="btn btn--secondary" data-close>返回快照</button><button class="btn btn--primary" data-action="restore-snapshot">恢复此版本</button></div>`); },
    'restore-snapshot'() { closePanel(); toast('已恢复所选版本，当前正文已自动留存'); },
    'match-prev'() { findMatches(-1); },
    'match-next'() { findMatches(1); },
    replace() { replaceMatch(false); },
    'replace-all'() { replaceMatch(true); }
  };

  document.addEventListener('click', event => {
    const close = event.target.closest('[data-close]');
    if (close) { closePanel(); $('#toast').hidden = true; return; }
    const docButton = event.target.closest('[data-doc]');
    if (docButton) { openDocument(docButton.dataset.doc, docButton.closest('#referencePane') ? 'reference' : 'main'); return; }
    const action = event.target.closest('[data-action]');
    if (action && actions[action.dataset.action]) { actions[action.dataset.action](action); return; }
    const theme = event.target.closest('[data-theme-choice]');
    if (theme) {
      const id = theme.dataset.themeChoice;
      const metaColors = { white: '#f6f7f7', paper: '#f7f7f3', green: '#eff3eb', dark: '#232824' };
      const labels = { white: '纯白', paper: '羊皮纸', green: '淡绿', dark: '暗夜' };
      html.dataset.theme = id;
      const meta = $('meta[name="theme-color"]');
      if (meta && metaColors[id]) meta.content = metaColors[id];
      $$('.theme-choice').forEach(button => button.classList.toggle('active', button === theme));
      $$('.theme-trigger').forEach(btn => { btn.title = `当前主题：${labels[id] || id}（点击切换）`; });
      theme.focus({ preventScroll: true });
      return;
    }
    const conflict = event.target.closest('[data-conflict]');
    if (conflict) { closePanel(); toast({ local: '已保留本地版本', external: '已采用外部版本', draft: '冲突内容已另存到草稿箱' }[conflict.dataset.conflict]); return; }
    if (activePanel) {
      const currentPanel = document.getElementById(activePanel);
      if (currentPanel?.classList.contains('floating-panel') && !currentPanel.contains(event.target)) {
        closePanel(false);
      }
    }
  });

  overlay.addEventListener('click', () => closePanel());
  editor.addEventListener('input', () => {
    originals.set(currentDoc, editor.innerHTML);
    markSaving();
    keepCaretCentered();
    if (isSplit && $('#referenceSelect').value === currentDoc) renderReference(true);
  });
  editor.addEventListener('keyup', keepCaretCentered);
  $('#chapterTitle').addEventListener('input', () => {
    const newTitle = $('#chapterTitle').value.trim() || '无标题';
    documents[currentDoc].title = newTitle;
    const treeSpan = $(`.tree-item[data-doc="${currentDoc}"] > span:first-of-type`);
    if (treeSpan) {
      const prefix = treeSpan.textContent.match(/^(\d{3}\s+)/)?.[1] || '';
      treeSpan.textContent = `${prefix}${newTitle}`;
    }
    if (isSplit && $('#referenceSelect').value === currentDoc) renderReference(true);
    markSaving();
  });
  $('#chapterTitle').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(true); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); } });
  $('#fontSelect').addEventListener('change', event => { const fonts = { serif: "'Noto Serif CJK SC', 'Source Han Serif SC', 'Songti SC', SimSun, serif", sans: "'Microsoft YaHei', 'PingFang SC', sans-serif", kai: "KaiTi, 'STKaiti', serif" }; html.style.setProperty('--editor-font', fonts[event.target.value]); });
  ['fontSize', 'lineHeight', 'paraGap', 'measure'].forEach(id => {
    $(`#${id}`).addEventListener('input', event => {
      const value = event.target.value;
      const settings = { fontSize: ['--font-size', `${value}px`, `${value} px`], lineHeight: ['--line-height', value, value], paraGap: ['--para-gap', `${value}em`, `${value} em`], measure: ['--measure', `${value}px`, `${value} px`] };
      const [property, cssValue, output] = settings[id];
      html.style.setProperty(property, cssValue);
      $(`#${id}Value`).textContent = output;
    });
  });
  $$('.m-switch').forEach(button => button.addEventListener('click', () => toggleSwitch(button)));
  $('#referenceSelect').addEventListener('change', () => renderReference(false));
  window.addEventListener('resize', () => {
    if (window.innerWidth <= 640) workspace.classList.add('sidebar-collapsed');
  });
  $('#globalSearch').addEventListener('input', event => searchBooks(event.target.value));
  $('#findInput').addEventListener('input', () => { matchIndex = -1; findMatches(1); });
  $('#findInput').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); findMatches(event.shiftKey ? -1 : 1); } });
  $('#splitResizer').addEventListener('pointerdown', event => {
    event.preventDefault();
    const bounds = $('#panes').getBoundingClientRect();
    $('#splitResizer').setPointerCapture(event.pointerId);
    const move = moveEvent => { const percent = Math.max(25, Math.min(55, (moveEvent.clientX - bounds.left) / bounds.width * 100)); html.style.setProperty('--split-width', `${percent}%`); };
    const up = () => { $('#splitResizer').removeEventListener('pointermove', move); $('#splitResizer').removeEventListener('pointerup', up); };
    $('#splitResizer').addEventListener('pointermove', move);
    $('#splitResizer').addEventListener('pointerup', up);
  });
  $('#splitResizer').addEventListener('keydown', event => { if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return; event.preventDefault(); const current = parseFloat(getComputedStyle(html).getPropertyValue('--split-width')) || 42; html.style.setProperty('--split-width', `${Math.max(25, Math.min(55, current + (event.key === 'ArrowRight' ? 2 : -2)))}%`); });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (activePanel) { closePanel(); $('#toast').hidden = true; }
      else if (workspace.classList.contains('focus-mode')) { toggleFocus(true); $('#toast').hidden = true; }
      else if (window.innerWidth <= 640 && !workspace.classList.contains('sidebar-collapsed')) workspace.classList.add('sidebar-collapsed');
      else if (!$('#toast').hidden) $('#toast').hidden = true;
      return;
    }
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && event.shiftKey && event.key.toLowerCase() === 'f') { event.preventDefault(); if (!workspace.hidden) actions.search(); }
    else if (modifier && event.key.toLowerCase() === 'f') { event.preventDefault(); if (!workspace.hidden) actions.find(); }
    else if (modifier && event.key.toLowerCase() === 'h') { event.preventDefault(); if (!workspace.hidden) actions.find(); }
    else if (modifier && event.key === '\\') { event.preventDefault(); if (!workspace.hidden) setSplit(!isSplit); }
    else if (event.key === 'F11') { event.preventDefault(); if (!workspace.hidden) toggleFocus(); }
    if (event.key === 'Tab' && activePanel) {
      const panel = document.getElementById(activePanel);
      const focusable = $$('button:not([disabled]), input, select, textarea, [tabindex="0"]', panel).filter(el => !el.hidden && el.getClientRects().length);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });

  buildHeatmap();
  applyDialogueHighlight();
  originals.set(currentDoc, editor.innerHTML);
  countText();
  if (window.innerWidth <= 640) workspace.classList.add('sidebar-collapsed');
})();
