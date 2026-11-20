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
  let cloudPushTimer = null;
  let quickSyncTimer = null;
  let activeCompareNote = null;
  let importSource = 'local';

  const syncState = {
    workspacePath: 'Documents / Mewse',
    cloudPath: 'OneDrive / MewseSync',
    status: 'connected', // 'connected' | 'syncing' | 'pending' | 'unlinked' | 'offline' | 'conflict'
    lastSyncedAt: '11:04',
    pendingPush: 0,
    pendingPull: 0,
    conflictCount: 0,
    checkOnOpen: true,
    autoPullOnCloudOnly: false,
    showLogs: false,
    demoScenario: 'normal',
    conflictSource: 'cloud',
    pendingUpdates: [
      {
        book: '雾港来信',
        location: '第一卷 · 归港',
        chapter: '003 没有地址的信',
        time: '云端较新 · 10:42',
        docId: 'chapter3',
        body: '<p>信封上没有地址，只有一个褪色的蓝色邮戳。</p><p>沈舟把它放在桌上，和母亲留下的那一封并排。两张纸的折痕完全一样，连右下角的水渍都落在相同的位置。</p><p>背面用极细的铅笔写着一行几乎看不清的数字：04:15。</p><p>他终于明白，有人希望他找到这里。</p>'
      },
      {
        book: '雾港来信',
        location: '第一卷 · 归港',
        chapter: '004 潮汐表',
        time: '云端较新 · 09:50',
        docId: 'chapter4',
        body: '<p>旧抽屉里藏着一本潮汐表，最后一页被整齐地撕去了。</p><p>沈舟对着灯光举起本子。撕口的纤维里夹着一小片深蓝色蜡纸，上面印着他从未见过的船徽。</p><p>明天凌晨四点一刻，是大潮。</p>'
      },
      {
        book: '山间邮局',
        location: '第一卷 · 山雾',
        chapter: '002 驿站夜雨',
        time: '云端较新 · 昨天 21:18'
      }
    ],
    logs: [
      { label: '已备份 005 雾中的船鸣.txt', time: '11:04' },
      { label: '打开书库检查：两端一致', time: '09:15' },
      { label: '从云端拉取 2 个更新文件', time: '昨天 22:18' }
    ]
  };

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
    $$('.theme-trigger, .publish-trigger, #syncStatus, #librarySyncStatus').forEach(btn => {
      btn.classList.remove('active');
      btn.setAttribute('aria-expanded', 'false');
    });
    overlay.hidden = true;
    activePanel = null;
    if (restoreFocus && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }

  function openPanel(id, options = {}) {
    if (activePanel === id && !options.keepOpen) { closePanel(); return; }
    if (activePanel !== id) previousFocus = document.activeElement;
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

  function currentTimeText() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  function addSyncLog(label) {
    const time = currentTimeText();
    if (syncState.logs[0]?.label === label && syncState.logs[0]?.time === time) return;
    syncState.logs.unshift({ label, time });
    if (syncState.logs.length > 6) syncState.logs.length = 6;
  }

  function addSnapshotItem({ title, metaType, time = currentTimeText(), words = $('#wordCount').textContent || '0', kind = 'manual' }) {
    const list = $('#snapshotList');
    const todayLabel = list?.querySelector('.list-label');
    if (!todayLabel) return;
    const item = document.createElement('button');
    item.className = 'snapshot-item';
    item.dataset.action = 'compare';
    item.dataset.snapshotType = kind;
    const markerClass = kind === 'conflict' ? 'conflict' : kind === 'manual' ? 'manual' : '';
    const iconName = kind === 'conflict' ? 'shield' : kind === 'manual' ? 'book' : 'history';
    const metaHtml = kind === 'conflict'
      ? `<span class="snapshot-badge">${escapeHtml(metaType)}</span> · ${escapeHtml(time)}`
      : `${escapeHtml(metaType)} · ${escapeHtml(time)}`;
    item.innerHTML = `<span class="snapshot-marker ${markerClass}">${icon(iconName, true)}</span><span><strong>${escapeHtml(title)}</strong><span class="snapshot-meta">${metaHtml}</span></span><span class="snapshot-size">${escapeHtml(words)} 字</span>`;
    todayLabel.insertAdjacentElement('afterend', item);
  }

  function getEffectiveSyncMeta() {
    if (!syncState.cloudPath) {
      return {
        state: 'unlinked',
        badge: '未关联',
        libraryText: '未关联云备份',
        tipConnected: '',
        tipTitle: '未连接云端',
        tipDetail: '尚未关联云备份目录，点击设置'
      };
    }
    if (syncState.conflictCount > 0 || syncState.status === 'conflict') {
      return {
        state: 'conflict',
        badge: `${syncState.conflictCount || 1} 处冲突`,
        libraryText: `${syncState.conflictCount || 1} 处版本冲突`,
        tipConnected: '',
        tipTitle: '检测到版本冲突',
        tipDetail: `有 ${syncState.conflictCount || 1} 处双端改动待处理，点击仲裁`
      };
    }
    if (syncState.status === 'offline') {
      return {
        state: 'offline',
        badge: '云目录不可用',
        libraryText: '云目录不可写入',
        tipConnected: '',
        tipTitle: '未连接云端',
        tipDetail: syncState.pendingPush > 0
          ? `本地有 ${syncState.pendingPush} 处修改尚未备份，云目录当前不可写入`
          : '当前关联的云备份目录不可访问'
      };
    }
    if (syncState.status === 'syncing') {
      return {
        state: 'syncing',
        badge: '同步中…',
        libraryText: '正在同步…',
        tipConnected: '正在将本地变更增量同步至云目录…',
        tipTitle: '正在同步',
        tipDetail: '正在校验云端备份目录'
      };
    }
    if (syncState.pendingPull > 0) {
      return {
        state: 'pending',
        badge: `待拉取 ${syncState.pendingPull}`,
        libraryText: `云端有 ${syncState.pendingPull} 项更新`,
        tipConnected: '',
        tipTitle: '发现云端更新',
        tipDetail: `云备份目录有 ${syncState.pendingPull} 个文件较新，点击查看`
      };
    }
    if (syncState.pendingPush > 0) {
      return {
        state: 'pending',
        badge: `待推送 ${syncState.pendingPush}`,
        libraryText: '待备份至云端',
        tipConnected: '',
        tipTitle: '等待备份推送',
        tipDetail: `有 ${syncState.pendingPush} 个本地修改等待写入云目录`
      };
    }
    return {
      state: 'connected',
      badge: '已同步',
      libraryText: '云备份已同步',
      tipConnected: '已连接到云端，本地修改将自动备份',
      tipTitle: '未连接云端',
      tipDetail: '尚未关联云备份目录，点击设置'
    };
  }

  function renderSyncIndicators() {
    const meta = getEffectiveSyncMeta();
    const statusBtn = $('#syncStatus');
    const libBtn = $('#librarySyncStatus');
    const libText = $('#librarySyncText');
    const syncBtn = $('.library-sync-btn');
    const workspacePathEl = $('#libraryWorkspacePath');
    if (workspacePathEl) workspacePathEl.textContent = `/ ${syncState.workspacePath}`;
    if (statusBtn) {
      statusBtn.dataset.sync = meta.state;
      const ariaText = meta.tipConnected || `${meta.tipTitle}：${meta.tipDetail}`;
      statusBtn.setAttribute('aria-label', ariaText);
    }
    if ($('#syncTipConnected') && meta.tipConnected) $('#syncTipConnected').textContent = meta.tipConnected;
    if ($('#syncTipTitle')) $('#syncTipTitle').textContent = meta.tipTitle;
    if ($('#syncTipDetail')) $('#syncTipDetail').textContent = meta.tipDetail;
    if (libBtn) libBtn.dataset.sync = meta.state;
    if (libText) libText.textContent = meta.libraryText;
    if (syncBtn) syncBtn.classList.toggle('is-syncing', meta.state === 'syncing');
    if (activePanel === 'syncPanel') renderSyncPanel();
  }

  function renderSyncPanel() {
    const meta = getEffectiveSyncMeta();
    const badge = $('#syncBadge');
    const badgeText = $('#syncBadgeText');
    if (badge) badge.dataset.sync = meta.state;
    if (badgeText) badgeText.textContent = meta.badge;

    const targetHtml = syncState.cloudPath
      ? `<div class="sync-target-box">
          <div class="sync-target-row">
            ${icon('folder', true)}
            <div class="sync-target-info">
              <div class="sync-target-label">关联的云备份目录</div>
              <div class="sync-target-path">${escapeHtml(syncState.cloudPath)}</div>
              <div class="sync-target-links">
                <button type="button" class="sync-link-btn" data-action="choose-cloud-dir">更换目录</button>
                <button type="button" class="sync-link-btn muted" data-action="unlink-cloud-dir">解除关联</button>
              </div>
            </div>
          </div>
        </div>`
      : `<div class="sync-target-box">
          <div class="sync-target-label">尚未关联云备份目录</div>
          <p class="sync-target-desc">云盘客户端负责系统层上云，Mewse 仅将本地书库增量备份到你指定的云盘映射目录。</p>
          <button type="button" class="btn btn--secondary compact-button" data-action="choose-cloud-dir">选择云盘同步文件夹</button>
        </div>`;

    let alertHtml = '';
    if (meta.state === 'conflict') {
      alertHtml = `<div class="sync-alert sync-alert--warn"><span>检测到 ${syncState.conflictCount || 1} 处双端修改冲突</span><button type="button" class="btn btn--secondary compact-button" data-action="conflict">处理冲突</button></div>`;
    } else if (syncState.pendingPull > 0) {
      alertHtml = `<div class="sync-alert sync-alert--update"><span>云端有 ${syncState.pendingPull} 个更新文件</span><button type="button" class="btn btn--secondary compact-button" data-action="open-cloud-updates">查看更新</button></div>`;
    } else if (meta.state === 'offline') {
      alertHtml = `<div class="sync-alert sync-alert--warn"><span>云目录当前不可写，本地创作可照常保存</span></div>`;
    }

    const logsHtml = syncState.showLogs
      ? `<div class="sync-log-list">${syncState.logs.map(item => `<div class="sync-log-item"><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.time)}</span></div>`).join('')}</div>`
      : '';

    const demoChips = [
      ['normal', '已同步'],
      ['update', '有更新'],
      ['conflict', '双端冲突'],
      ['offline', '不可用']
    ].map(([id, label]) => `<button type="button" class="sync-demo-chip${syncState.demoScenario === id ? ' active' : ''}" data-action="sync-demo" data-scenario="${id}">${label}</button>`).join('');

    $('#syncPanelBody').innerHTML = `
      ${targetHtml}
      <div class="sync-metrics">
        <div class="sync-metric"><span>上次同步</span><strong>${syncState.cloudPath ? escapeHtml(syncState.lastSyncedAt) : '—'}</strong></div>
        <div class="sync-metric"><span>待推送</span><strong>${syncState.pendingPush} 个文件</strong></div>
        <div class="sync-metric"><span>待拉取</span><strong>${syncState.pendingPull} 个文件</strong></div>
      </div>
      ${alertHtml}
      <div class="sync-actions-row">
        <button type="button" class="btn btn--primary" data-action="trigger-sync"${meta.state === 'syncing' ? ' disabled' : ''}>${icon('refresh', true)}${meta.state === 'syncing' ? '正在同步…' : '立即同步'}</button>
        <button type="button" class="btn btn--secondary" data-action="toggle-sync-logs">${syncState.showLogs ? '收起记录' : '同步记录'}</button>
      </div>
      ${logsHtml}
      <div class="sync-settings">
        <label class="check-row"><input class="m-check" type="checkbox" id="syncCheckOnOpen"${syncState.checkOnOpen ? ' checked' : ''}><span>打开书库时检查云端更新</span></label>
        <label class="check-row"><input class="m-check" type="checkbox" id="syncAutoPull"${syncState.autoPullOnCloudOnly ? ' checked' : ''}><span>仅云端有更新时自动拉取</span></label>
        <p class="sync-setting-hint">关闭时将先弹窗列出待更新章节并由你确认，覆盖前自动留存历史快照。</p>
      </div>
      <div class="sync-demo-strip"><span>状态模拟</span>${demoChips}</div>
    `;
  }

  function applySyncScenario(scenario) {
    clearTimeout(quickSyncTimer);
    syncState.demoScenario = scenario;
    if (scenario === 'normal') {
      if (!syncState.cloudPath) syncState.cloudPath = 'OneDrive / MewseSync';
      syncState.status = 'connected';
      syncState.pendingPush = 0;
      syncState.pendingPull = 0;
      syncState.conflictCount = 0;
    } else if (scenario === 'update') {
      if (!syncState.cloudPath) syncState.cloudPath = 'OneDrive / MewseSync';
      syncState.status = 'connected';
      syncState.pendingPush = 0;
      syncState.pendingPull = syncState.pendingUpdates.length || 3;
      if (!syncState.pendingUpdates.length) {
        syncState.pendingUpdates = [
          { book: '雾港来信', location: '第一卷 · 归港', chapter: '003 没有地址的信', time: '云端较新 · 10:42', docId: 'chapter3' },
          { book: '山间邮局', location: '第一卷 · 山雾', chapter: '002 驿站夜雨', time: '云端较新 · 昨天' }
        ];
        syncState.pendingPull = syncState.pendingUpdates.length;
      }
      syncState.conflictCount = 0;
    } else if (scenario === 'conflict') {
      if (!syncState.cloudPath) syncState.cloudPath = 'OneDrive / MewseSync';
      syncState.status = 'conflict';
      syncState.conflictCount = 1;
      syncState.pendingPush = 1;
      syncState.pendingPull = 0;
    } else if (scenario === 'offline') {
      if (!syncState.cloudPath) syncState.cloudPath = 'OneDrive / MewseSync';
      syncState.status = 'offline';
      syncState.pendingPush = Math.max(1, syncState.pendingPush || 2);
      syncState.pendingPull = 0;
      syncState.conflictCount = 0;
    }
    renderSyncIndicators();
  }

  function runManualSync() {
    if (!syncState.cloudPath) {
      actions['choose-cloud-dir']();
      return;
    }
    if (syncState.conflictCount > 0 || syncState.status === 'conflict') {
      toast('存在未处理的版本冲突，请先完成仲裁');
      actions.conflict();
      return;
    }
    if (syncState.pendingPull > 0) {
      actions['open-cloud-updates']();
      return;
    }
    if (syncState.status === 'offline') {
      syncState.status = 'syncing';
      renderSyncIndicators();
      clearTimeout(quickSyncTimer);
      quickSyncTimer = setTimeout(() => {
        syncState.status = 'offline';
        addSyncLog('同步失败：云备份目录当前不可写入');
        renderSyncIndicators();
        toast('云目录当前不可写入，本地修改已保留在待推送队列');
      }, 650);
      return;
    }
    syncState.status = 'syncing';
    renderSyncIndicators();
    clearTimeout(quickSyncTimer);
    quickSyncTimer = setTimeout(() => {
      const pushed = syncState.pendingPush;
      syncState.status = 'connected';
      syncState.pendingPush = 0;
      syncState.lastSyncedAt = currentTimeText();
      syncState.demoScenario = 'normal';
      addSyncLog(pushed > 0 ? `已增量备份 ${pushed} 个修改文件` : '云端检查完成：本地与云目录一致');
      renderSyncIndicators();
      toast(pushed > 0 ? `已同步 ${pushed} 个文件至云备份目录` : '云端备份已是最新状态');
    }, 750);
  }

  function scheduleCloudPush() {
    clearTimeout(cloudPushTimer);
    if (!syncState.cloudPath) return;
    if (syncState.status === 'offline') {
      syncState.pendingPush = Math.max(1, syncState.pendingPush + 1);
      renderSyncIndicators();
      return;
    }
    if (syncState.status === 'conflict' || syncState.conflictCount > 0) return;
    syncState.pendingPush = 1;
    renderSyncIndicators();
    cloudPushTimer = setTimeout(() => {
      if (syncState.status === 'offline' || syncState.status === 'conflict') return;
      syncState.status = 'syncing';
      renderSyncIndicators();
      setTimeout(() => {
        if (syncState.status === 'offline' || syncState.status === 'conflict') return;
        syncState.status = 'connected';
        syncState.pendingPush = 0;
        syncState.lastSyncedAt = currentTimeText();
        addSyncLog(`已备份《${documents[currentDoc].title}》`);
        renderSyncIndicators();
      }, 500);
    }, 900);
  }

  function markSaving(syncToCloud = false) {
    clearTimeout(saveTimer);
    $('#saveState').innerHTML = `${icon('history', true)}保存中…`;
    saveTimer = setTimeout(() => {
      documents[currentDoc].body = editor.innerHTML;
      documents[currentDoc].title = $('#chapterTitle').value;
      $('#saveState').innerHTML = `${icon('check', true)}已保存`;
      countText();
      if (syncToCloud) scheduleCloudPush();
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

  function showActionModal(title, content, options = {}) {
    $('#actionTitle').textContent = title;
    $('#actionModalBody').innerHTML = content;
    $('#actionModal').classList.toggle('wide-modal', Boolean(options.wide));
    openPanel('actionModal', { focus: options.focus || 'input', keepOpen: true });
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
    markSaving(true);
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
    sync(button) {
      const wasOpen = activePanel === 'syncPanel';
      renderSyncPanel();
      openPanel('syncPanel');
      if (wasOpen) return;
      const panel = $('#syncPanel');
      if (panel) {
        if (button?.id === 'librarySyncStatus') {
          const rect = button.getBoundingClientRect();
          const right = Math.max(10, Math.round(window.innerWidth - rect.right));
          panel.style.top = `${Math.round(rect.bottom + 8)}px`;
          panel.style.right = `${right}px`;
          panel.style.bottom = 'auto';
          panel.style.left = 'auto';
        } else {
          panel.style.top = '';
          panel.style.right = '';
          panel.style.bottom = '';
          panel.style.left = '';
        }
      }
      if (button) button.setAttribute('aria-expanded', 'true');
    },
    'quick-sync'() { runManualSync(); },
    'trigger-sync'() { runManualSync(); },
    'toggle-sync-logs'() {
      syncState.showLogs = !syncState.showLogs;
      renderSyncPanel();
    },
    'sync-demo'(button) {
      const scenario = button.dataset.scenario || 'normal';
      applySyncScenario(scenario);
    },
    'choose-cloud-dir'() {
      showActionModal('关联云备份目录', `
        <p class="modal-description">选择一个本地的第三方云盘同步文件夹作为备份与多设备同步目录。软件不上传至自有服务器，始终以本地书库为主读写。</p>
        <div class="export-options" style="margin-bottom:16px">
          <button type="button" class="export-option selected" data-action="pick-cloud-preset" data-path="OneDrive / MewseSync">${icon('cloud')}<span><strong>OneDrive / MewseSync</strong><small>系统层已开启自动同步 · 推荐用于多设备接力</small></span></button>
          <button type="button" class="export-option" data-action="pick-cloud-preset" data-path="iCloud Drive / MewseBackup">${icon('cloud')}<span><strong>iCloud Drive / MewseBackup</strong><small>适用于 macOS / Windows iCloud 云盘同步文件夹</small></span></button>
          <button type="button" class="export-option" data-action="pick-cloud-preset" data-path="坚果云 / Mewse">${icon('folder')}<span><strong>坚果云 / Mewse</strong><small>通过本地同步文件夹自动增量上传</small></span></button>
        </div>
        <div class="modal-field"><label for="cloudDirInput">已选云备份目录路径</label><input id="cloudDirInput" value="${escapeHtml(syncState.cloudPath || 'OneDrive / MewseSync')}"></div>
        <div class="modal-actions"><button class="btn btn--secondary" data-close>取消</button><button class="btn btn--primary" data-action="confirm-cloud-dir">关联此目录</button></div>
      `, { wide: true });
    },
    'pick-cloud-preset'(button) {
      $$('.export-option', $('#actionModalBody')).forEach(el => el.classList.toggle('selected', el === button));
      const input = $('#cloudDirInput');
      if (input && button.dataset.path) input.value = button.dataset.path;
    },
    'confirm-cloud-dir'() {
      const path = $('#cloudDirInput')?.value.trim();
      if (!path) { $('#cloudDirInput')?.focus(); toast('请填写或选择云备份目录路径'); return; }
      syncState.cloudPath = path;
      syncState.status = 'connected';
      syncState.pendingPush = 0;
      syncState.conflictCount = 0;
      syncState.lastSyncedAt = currentTimeText();
      syncState.demoScenario = 'normal';
      addSyncLog(`已关联云目录：${path}`);
      renderSyncIndicators();
      closePanel();
      toast(`已关联云备份目录：${path}`);
    },
    'unlink-cloud-dir'() {
      showActionModal('解除云备份关联？', `
        <p class="modal-description">解除关联后，本地创作将不再自动备份至 <strong>${escapeHtml(syncState.cloudPath)}</strong>。此操作<strong>不会删除</strong>本地书库和云目录中的任何文稿。</p>
        <div class="modal-actions"><button class="btn btn--secondary" data-close>保留关联</button><button class="btn btn--primary" data-action="confirm-unlink-cloud">确认解除</button></div>
      `, { focus: 'button' });
    },
    'confirm-unlink-cloud'() {
      syncState.cloudPath = '';
      syncState.status = 'unlinked';
      syncState.pendingPush = 0;
      syncState.pendingPull = 0;
      syncState.conflictCount = 0;
      addSyncLog('已解除云备份目录关联');
      renderSyncIndicators();
      closePanel();
      toast('已解除云备份目录关联，本地文件不受影响');
    },
    'open-cloud-updates'() {
      const list = $('#cloudUpdateList');
      const items = syncState.pendingUpdates;
      if (list) {
        list.innerHTML = items.map(item => `
          <div class="update-item">
            <div class="update-item-info">
              <strong>${escapeHtml(item.book)} · ${escapeHtml(item.chapter)}</strong>
              <span>${escapeHtml(item.location)}</span>
            </div>
            <span class="update-item-tag">${escapeHtml(item.time)}</span>
          </div>
        `).join('');
      }
      const btn = $('#applyCloudUpdatesBtn');
      if (btn) btn.textContent = `从云端更新 (${items.length})`;
      openPanel('cloudUpdateModal', { focus: '#applyCloudUpdatesBtn' });
    },
    'apply-cloud-updates'() {
      const updates = syncState.pendingUpdates;
      const count = updates.length || syncState.pendingPull || 1;
      updates.forEach(item => {
        if (item.docId && item.body && documents[item.docId]) {
          documents[item.docId].body = item.body;
          if (item.docId === currentDoc) {
            editor.innerHTML = item.body;
            applyDialogueHighlight();
            originals.set(currentDoc, editor.innerHTML);
            countText();
          }
        }
      });
      addSnapshotItem({
        title: '云端更新前本地留存',
        metaType: '保护快照',
        kind: 'auto'
      });
      syncState.pendingUpdates = [];
      syncState.pendingPull = 0;
      syncState.status = 'connected';
      syncState.demoScenario = 'normal';
      syncState.lastSyncedAt = currentTimeText();
      addSyncLog(`从云端更新 ${count} 个文件（已留存本地保护快照）`);
      renderSyncIndicators();
      closePanel();
      toast(`已从云端更新 ${count} 个文件，本地旧版已留存历史快照`);
    },
    calendar() { openPanel('calendarModal'); },
    conflict() {
      const isCloud = syncState.conflictSource !== 'external';
      $('#conflictEyebrow').textContent = isCloud ? '检测到双端分叉 · 005 雾中的船鸣' : '检测到同时修改 · 005 雾中的船鸣';
      $('#conflictRemoteLabel').textContent = isCloud ? `云端备份（${syncState.cloudPath || 'OneDrive'}） · 11:36` : '外部文件 · 11:36';
      openPanel('conflictModal');
    },
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
    import() {
      importSource = 'local';
      const cloudHint = syncState.cloudPath ? `当前云目录：${escapeHtml(syncState.cloudPath)}` : '选定个人云盘同步文件夹';
      showActionModal('导入已有作品', `
        <p class="modal-description">支持从本地文件夹导入规范作品或 .txt 稿件，也可从云端备份目录拉取作品至当前书库。导入全程只读复制，原始文件保持不变。</p>
        <div class="export-options">
          <button type="button" class="export-option selected" data-action="select-import-source" data-source="local">${icon('upload')}<span><strong>选择本地作品文件夹</strong><small>支持规范 Mewse 目录及纯 .txt 章节文件夹，可预览排序与 UTF-8 净化结果</small></span></button>
          <button type="button" class="export-option" data-action="select-import-source" data-source="cloud">${icon('cloud')}<span><strong>从云端备份目录导入作品</strong><small>${cloudHint} · 只读拉取作品至当前书库并纳入同步</small></span></button>
        </div>
        <div class="modal-subfoot">
          <button type="button" class="text-button" data-action="import-cloud-workspace">改为导入整座云端书库<svg class="icon small"><use href="#i-chevron"/></svg></button>
          <div style="display:flex;gap:10px">
            <button type="button" class="btn btn--secondary" data-close>取消</button>
            <button type="button" class="btn btn--primary" id="importNextBtn" data-action="proceed-import">选择本地文件夹</button>
          </div>
        </div>
      `, { wide: true, focus: 'button' });
    },
    'select-import-source'(button) {
      importSource = button.dataset.source === 'cloud' ? 'cloud' : 'local';
      $$('.export-option', $('#actionModalBody')).forEach(el => el.classList.toggle('selected', el === button));
      const nextBtn = $('#importNextBtn');
      if (nextBtn) nextBtn.textContent = importSource === 'cloud' ? '从云端目录选择' : '选择本地文件夹';
    },
    'proceed-import'() {
      if (importSource === 'local') {
        closePanel();
        toast('导入预览已准备，原始文件不会被修改');
        return;
      }
      showActionModal('从云端备份目录导入作品', `
        <p class="modal-description">将从选定云备份目录只读拉取指定作品到当前本地书库，不会改动云端源文件。</p>
        <div class="modal-field"><label for="importBookCloudDir">源云备份目录</label><input id="importBookCloudDir" value="${escapeHtml(syncState.cloudPath || 'OneDrive / MewseSync')}"></div>
        <div class="workspace-preview-box">
          <strong>发现可导入作品：1 部（尚未在当前书架中）</strong>
          《纸船航线》 · 规范 Mewse 作品 · 28,400 字（含 12 章正文、草稿箱及历史快照）
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn--secondary" data-action="import">返回</button>
          <button type="button" class="btn btn--primary" data-action="confirm-cloud-book-import">拉取并导入书架</button>
        </div>
      `, { wide: true });
    },
    'confirm-cloud-book-import'() {
      const cloudDir = $('#importBookCloudDir')?.value.trim() || 'OneDrive / MewseSync';
      const slug = 'paperboat';
      if (!bookInfo[slug]) {
        const docId = 'doc_paperboat';
        documents[docId] = { title: '折纸的人', chapter: '第一章', location: '第一卷 · 岸边', body: '<p>码头尽头停着一艘没有编号的木船。</p><p>他从口袋里掏出一张折了一半的旧车票，轻轻放进纸船里。</p>' };
        bookInfo[slug] = { title: '纸船航线', doc: docId };
        const card = document.createElement('article');
        card.className = 'book-card';
        card.dataset.book = slug;
        card.innerHTML = `<button class="book-open" data-action="open-workspace" aria-label="打开《纸船航线》"><div class="book-cover cover-tide"><span class="cover-line"></span><span class="cover-title">纸船<br>航线</span><span class="cover-author">林见夏 · 著</span></div><div class="book-info"><div class="book-title-row"><h3>纸船航线</h3><span class="status-tag">连载中</span></div><p>从云备份目录拉取的作品。</p><div class="book-stats"><span>28,400 字</span><span>刚刚从云端导入</span></div></div></button><button class="book-more icon-button small-button" data-action="book-menu" aria-label="《纸船航线》作品操作" title="作品信息与移除"><svg class="icon small"><use href="#i-more"/></svg></button>`;
        $('.book-grid')?.appendChild(card);
        const total = $$('.book-card').length;
        const countSpan = $('.library-meta h2 span');
        if (countSpan) countSpan.textContent = String(total);
      }
      addSyncLog(`从云目录（${cloudDir}）导入《纸船航线》`);
      renderSyncIndicators();
      closePanel();
      toast('已从云备份目录导入《纸船航线》，原始文件未改动');
    },
    'confirm-import'() { closePanel(); toast('导入预览已准备，原始文件不会被修改'); },
    workspace() {
      const cloudDesc = syncState.cloudPath ? syncState.cloudPath : '尚未关联云备份目录';
      showActionModal('当前书库与云备份', `
        <div class="workspace-section">
          <div class="workspace-section-head"><strong>本地主书库</strong><button type="button" class="sync-link-btn" data-action="switch-local-workspace">更换目录…</button></div>
          <div class="workspace-path-pill">${escapeHtml(syncState.workspacePath)}</div>
        </div>
        <div class="workspace-section">
          <div class="workspace-section-head"><strong>关联云备份目录</strong><button type="button" class="sync-link-btn" data-action="choose-cloud-dir">${syncState.cloudPath ? '更换关联' : '立即关联'}</button></div>
          <div class="workspace-path-pill">${escapeHtml(cloudDesc)}</div>
        </div>
        <div class="export-options">
          <button type="button" class="export-option" data-action="import-cloud-workspace">${icon('cloud')}<span><strong>从云端备份目录导入书库到本地</strong><small>在新设备安装后，选定云备份目录与本地目标路径，一键拉取全部作品、草稿、快照与统计记录</small></span></button>
          <button type="button" class="export-option" data-action="new-local-workspace">${icon('folder')}<span><strong>新建空白本地书库</strong><small>选择本机新文件夹初始化书库，创建后可按需关联云备份目录</small></span></button>
        </div>
        <div class="modal-subfoot">
          <button type="button" class="text-button" data-action="onboarding-preview">查看首次启动引导界面</button>
          <button type="button" class="btn btn--secondary" data-close>关闭</button>
        </div>
      `, { wide: true, focus: 'button' });
    },
    'switch-local-workspace'() {
      showActionModal('切换本地书库', `
        <p class="modal-description">切换前会自动保存当前未落盘内容并尝试推送待备份队列。若存在未处理的版本冲突，需先完成仲裁。</p>
        <div class="modal-field"><label for="switchWorkspaceInput">选择或输入本地书库路径</label><input id="switchWorkspaceInput" value="${escapeHtml(syncState.workspacePath)}"></div>
        <div class="modal-actions"><button class="btn btn--secondary" data-action="workspace">返回</button><button class="btn btn--primary" data-action="confirm-switch-workspace">挂载此书库</button></div>
      `, { wide: true });
    },
    'confirm-switch-workspace'() {
      const nextPath = $('#switchWorkspaceInput')?.value.trim();
      if (!nextPath) { $('#switchWorkspaceInput')?.focus(); toast('请填写本地书库路径'); return; }
      syncState.workspacePath = nextPath;
      addSyncLog(`已挂载本地书库：${nextPath}`);
      renderSyncIndicators();
      closePanel();
      toast(`已切换至书库：${nextPath}`);
    },
    'new-local-workspace'() {
      showActionModal('新建本地书库', `
        <p class="modal-description">请先指定本机文件夹作为主书库。作品将以纯文本与可读目录结构保存在本机。</p>
        <div class="modal-field"><label for="newLocalWorkspaceInput">本地书库目录</label><input id="newLocalWorkspaceInput" value="Documents / Mewse-New"></div>
        <div class="modal-actions"><button class="btn btn--secondary" data-action="workspace">返回</button><button class="btn btn--primary" data-action="new-local-step2">创建并下一步</button></div>
      `, { wide: true });
    },
    'new-local-step2'() {
      const nextPath = $('#newLocalWorkspaceInput')?.value.trim() || 'Documents / Mewse-New';
      syncState.workspacePath = nextPath;
      renderSyncIndicators();
      showActionModal('是否关联云备份目录？', `
        <p class="modal-description">本地书库 <strong>${escapeHtml(nextPath)}</strong> 已就绪。你可以现在关联一个个人云盘同步目录作为备份桥梁，也可以稍后在底部状态栏随时配置。</p>
        <div class="workspace-cards">
          <button type="button" class="export-option selected" data-action="choose-cloud-dir">${icon('cloud')}<span><strong>立即关联云备份目录</strong><small>支持 OneDrive、iCloud Drive、坚果云等本地同步目录</small></span></button>
        </div>
        <div class="modal-actions"><button class="btn btn--secondary" data-action="skip-cloud-bind">稍后配置</button></div>
      `, { wide: true, focus: 'button' });
    },
    'skip-cloud-bind'() {
      syncState.cloudPath = '';
      syncState.status = 'unlinked';
      renderSyncIndicators();
      closePanel();
      toast('本地书库已创建，可随时点击云朵图标关联备份目录');
    },
    'import-cloud-workspace'() {
      showActionModal('从云端备份目录导入书库', `
        <p class="modal-description">选定云盘同步目录与本机存放路径后，将只读拉取全部作品与结构到本地，并自动建立双向同步基线。</p>
        <div class="modal-field"><label for="importCloudSrc">源云备份目录（只读复制）</label><input id="importCloudSrc" value="${escapeHtml(syncState.cloudPath || 'OneDrive / MewseSync')}"></div>
        <div class="workspace-preview-box">
          <strong>云端目录检查结果：结构合规</strong>
          发现 3 部作品（雾港来信 · 山间邮局 · 夏日修补店），包含草稿箱、历史快照、回收站与码字热力图记录。导入不会改动云目录原文件。
        </div>
        <div class="modal-field"><label for="importLocalDest">本机书库存放目录</label><input id="importLocalDest" value="Documents / Mewse"></div>
        <div class="modal-actions"><button class="btn btn--secondary" data-action="workspace">返回</button><button class="btn btn--primary" data-action="confirm-cloud-import">拉取到本地并进入书架</button></div>
      `, { wide: true });
    },
    'confirm-cloud-import'() {
      const src = $('#importCloudSrc')?.value.trim() || 'OneDrive / MewseSync';
      const dest = $('#importLocalDest')?.value.trim() || 'Documents / Mewse';
      syncState.cloudPath = src;
      syncState.workspacePath = dest;
      syncState.status = 'connected';
      syncState.pendingPush = 0;
      syncState.pendingPull = 0;
      syncState.conflictCount = 0;
      syncState.lastSyncedAt = currentTimeText();
      syncState.demoScenario = 'normal';
      addSyncLog(`从云端导入整库至 ${dest} 并建立同步基线`);
      renderSyncIndicators();
      closePanel();
      actions.library();
      toast(`已从云端导入 3 部作品至 ${dest}，并自动关联云备份目录`);
    },
    'onboarding-preview'() {
      showActionModal('欢迎使用 Mewse（喵织梦）', `
        <p class="modal-description">Mewse 把作品保存为直观可读的本地文件夹，并支持关联个人云盘目录实现多端备份与接力创作。</p>
        <div class="workspace-cards">
          <button type="button" class="export-option selected" data-action="new-local-workspace">${icon('folder')}<span><strong>选择本地文件夹作为主书库</strong><small>本地高速读写，不受网盘文件锁干扰；创建后可按需关联云备份目录</small></span></button>
          <button type="button" class="export-option" data-action="import-cloud-workspace">${icon('cloud')}<span><strong>从云端备份目录导入书库到本地</strong><small>在其他设备继续写作：一键拉取云端完整作品、历史快照与码字记录至本机</small></span></button>
        </div>
        <div class="modal-subfoot"><span>已有最近书库：${escapeHtml(syncState.workspacePath)}</span><button type="button" class="btn btn--primary compact-button" data-close>继续当前书库</button></div>
      `, { wide: true, focus: 'button' });
    },
    'switch-workspace'() { actions.workspace(); },
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
      addSnapshotItem({ title: note, metaType: '手动快照', kind: 'manual' });
      closePanel();
      toast(`快照已创建：${note}`);
    },
    compare(button) {
      const title = button?.querySelector('strong')?.textContent || '登灯塔之前';
      const meta = button?.querySelector('.snapshot-meta')?.textContent || '今天 10:24';
      const isConflict = button?.dataset.snapshotType === 'conflict';
      activeCompareNote = title;
      const intro = isConflict
        ? `${escapeHtml(title)} · ${escapeHtml(meta)}<br>冲突仲裁时由系统自动留存，可直接对比或恢复。恢复前仍会保留当前正文快照。`
        : `${escapeHtml(title)} · ${escapeHtml(meta)}<br>恢复前将自动为当前正文创建保护快照。`;
      showActionModal('对比历史快照', `<p class="modal-description">${intro}</p><div class="version-grid"><div><span class="version-label">历史版本</span><p>他走到窗边，看见一个穿雨衣的人站在街角。</p></div><div><span class="version-label">当前正文</span><p>他走到窗边，看见一个穿<mark>深色</mark>雨衣的人站在街角。</p></div></div><div class="modal-actions"><button class="btn btn--secondary" data-close>返回快照</button><button class="btn btn--primary" data-action="restore-snapshot">恢复此版本</button></div>`, { wide: true, focus: 'button' });
    },
    'restore-snapshot'() {
      addSnapshotItem({ title: '回退前自动保护', metaType: '自动快照', kind: 'auto' });
      const label = activeCompareNote ? `「${activeCompareNote}」` : '所选版本';
      closePanel();
      toast(`已恢复${label}，当前正文已自动留存保护快照`);
    },
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
    if (conflict) {
      const mode = conflict.dataset.conflict;
      if (mode === 'local') {
        addSnapshotItem({
          title: '冲突仲裁留存（云端版）',
          metaType: '云端冲突备份',
          time: '11:36',
          kind: 'conflict'
        });
        addSyncLog('冲突仲裁：保留本地版本，已留存云端快照');
      } else if (mode === 'cloud' || mode === 'external') {
        addSnapshotItem({
          title: '冲突仲裁留存（本地版）',
          metaType: '本地冲突备份',
          kind: 'conflict'
        });
        if (currentDoc === 'chapter5') {
          const remoteHtml = '<p>沈舟是在第三声船鸣响起时醒来的。</p><p>窗外有人叫他的名字，那声音像极了父亲。</p>';
          editor.innerHTML = remoteHtml;
          documents.chapter5.body = remoteHtml;
          originals.set('chapter5', remoteHtml);
          countText();
        }
        addSyncLog('冲突仲裁：采用云端版本，已留存本地快照');
      } else if (mode === 'draft') {
        const draftId = `conflict_${Date.now()}`;
        const draftTitle = `${documents[currentDoc].title}_冲突副本_${currentTimeText().replace(':', '')}`;
        documents[draftId] = {
          title: draftTitle,
          chapter: '草稿',
          location: '灵感与草稿',
          body: '<p>沈舟是在第三声船鸣响起时醒来的。</p><p>窗外有人叫他的名字，那声音像极了父亲。</p>'
        };
        const btn = document.createElement('button');
        btn.className = 'tree-item draft-item';
        btn.dataset.doc = draftId;
        btn.innerHTML = `${icon('file', true)}<span>${escapeHtml(draftTitle)}</span>`;
        $('#draftItems')?.appendChild(btn);
        const opt = document.createElement('option');
        opt.value = draftId;
        opt.textContent = draftTitle;
        $('#referenceSelect')?.appendChild(opt);
        addSyncLog(`冲突仲裁：另存副本至草稿箱`);
      }
      syncState.conflictCount = 0;
      syncState.pendingPush = 0;
      syncState.status = 'connected';
      syncState.demoScenario = 'normal';
      syncState.lastSyncedAt = currentTimeText();
      renderSyncIndicators();
      closePanel();
      toast({
        local: '已保留本地版本，云端版本已自动存为历史快照',
        cloud: '已采用云端版本，本地版本已自动存为历史快照',
        external: '已采用外部版本，本地版本已自动存为历史快照',
        draft: '冲突副本已另存至草稿箱，双份内容均已留存'
      }[mode]);
      return;
    }
    if (activePanel) {
      const currentPanel = document.getElementById(activePanel);
      if (currentPanel?.classList.contains('floating-panel') && !currentPanel.contains(event.target)) {
        closePanel(false);
      }
    }
  });

  overlay.addEventListener('click', () => closePanel());
  $('#syncPanelBody')?.addEventListener('change', event => {
    if (event.target.id === 'syncCheckOnOpen') {
      syncState.checkOnOpen = event.target.checked;
      toast(syncState.checkOnOpen ? '已开启：打开书库时检查云端更新' : '已关闭打开书库自动检测');
    } else if (event.target.id === 'syncAutoPull') {
      syncState.autoPullOnCloudOnly = event.target.checked;
      toast(syncState.autoPullOnCloudOnly ? '已开启：仅云端有更新时自动拉取（覆盖前留存快照）' : '已切换为更新前提示确认');
    }
  });
  editor.addEventListener('input', () => {
    originals.set(currentDoc, editor.innerHTML);
    markSaving(true);
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
    markSaving(true);
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
  renderSyncIndicators();
  if (window.innerWidth <= 640) workspace.classList.add('sidebar-collapsed');
})();
