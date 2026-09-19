/**
 * 店舗が「現在、どれクエ提供時間内（曜日・時間）」かを動的に判定する関数
 * @param {Object} store 店舗データ
 * @param {Date} [now=new Date()] 判定基準日時
 * @returns {boolean}
 */
function checkIsOpenToday(store, now = new Date()) {
  if (!store) return false;

  const rawDays = String(store.days || store.conditions?.days || '').trim();
  const rawHours = String(store.hours || store.conditions?.hours || '').trim();

  if (!rawDays || !rawHours) return false;

  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const curDayIndex = now.getDay();
  const curDayName = dayNames[curDayIndex];
  
  const yesterdayIndex = (curDayIndex + 6) % 7;
  const yesterdayName = dayNames[yesterdayIndex];

  // 全角数字・全角コロン等を半角に正規化
  const normalizeStr = (str) => {
    return str
      .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
      .replace(/：/g, ':')
      .replace(/[\s\u3000]+/g, ' ');
  };

  const cleanDays = normalizeStr(rawDays);
  const cleanHours = normalizeStr(rawHours);

  // 1. 曜日リストの解析
  const parseAllowedDays = (daysStr) => {
    if (!daysStr) return [];
    if (daysStr.includes('全て') || daysStr.includes('全日') || daysStr.includes('毎日')) {
      return [...dayNames];
    }
    
    // "月〜金" や "月～金" などの範囲指定の展開
    const rangeMatch = daysStr.match(/([日月火水木金土])\s*[〜～\-–—~]\s*([日月火水木金土])/);
    const rangeDays = [];
    if (rangeMatch) {
      const startIdx = dayNames.indexOf(rangeMatch[1]);
      const endIdx = dayNames.indexOf(rangeMatch[2]);
      if (startIdx !== -1 && endIdx !== -1) {
        let idx = startIdx;
        while (true) {
          rangeDays.push(dayNames[idx]);
          if (idx === endIdx) break;
          idx = (idx + 1) % 7;
        }
      }
    }

    const matchedDays = new Set(rangeDays);
    for (const d of dayNames) {
      const regex = new RegExp(`(?:^|[^日月火水木金土])${d}(?:曜日|曜|(?=[^日月火水木金土]|$))`);
      if (regex.test(daysStr)) {
        matchedDays.add(d);
      }
    }
    return Array.from(matchedDays);
  };

  const allowedDays = parseAllowedDays(cleanDays);
  if (allowedDays.length === 0) return false;

  // 2. 営業時間帯の解析と判定
  // 複数時間帯（カンマ、スラッシュ、改行、読点等で分割）
  const timeSlots = cleanHours.split(/[,、/／\n\r]+/).map(s => s.trim()).filter(Boolean);
  if (timeSlots.length === 0) return false;

  const curMinutes = now.getHours() * 60 + now.getMinutes();

  for (const slot of timeSlots) {
    // 例: "17:00〜23:00", "17時〜23時", "17:00 - 翌2:00", "17:00〜26:00", "17:00-02:00", "15:00:00〜22:30:00"
    const match = slot.match(/(翌)?\s*(\d{1,2})(?::(\d{2})|時(?:(\d{2})分?)?)?(?::\d{2})?\s*[〜～\-–—~]\s*(翌)?\s*(\d{1,2})(?::(\d{2})|時(?:(\d{2})分?)?)?(?::\d{2})?/);
    if (!match) continue;

    let startH = parseInt(match[2], 10);
    const startM = parseInt(match[3] || match[4] || '0', 10);
    const endIsNext = Boolean(match[5]);
    let endH = parseInt(match[6], 10);
    const endM = parseInt(match[7] || match[8] || '0', 10);

    if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) continue;

    if (endH >= 24) {
      endH = endH % 24;
    }

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    const isOvernight = endIsNext || endMinutes <= startMinutes;

    if (!isOvernight) {
      if (allowedDays.includes(curDayName)) {
        if (curMinutes >= startMinutes && curMinutes < endMinutes) {
          return true;
        }
      }
    } else {
      if (curMinutes >= startMinutes) {
        if (allowedDays.includes(curDayName)) {
          return true;
        }
      } else if (curMinutes < endMinutes) {
        if (allowedDays.includes(yesterdayName)) {
          return true;
        }
      }
    }
  }

  return false;
}

// グローバル公開
window.checkIsOpenToday = checkIsOpenToday;

class YoidoreQuestApp {
  constructor() {
    if (window.debugLog) window.debugLog('🚀 YoidoreQuestApp 起動開始');
    this.currentView = 'top';
    this.selectedStore = null;
    this.soundEnabled = true;
    this.audioCtx = null;
    this.isStarted = false;
    this.lastStoresScrollY = 0;
    
    // フィルター状態
    this.filters = {
      area: 'ALL',
      category: 'ALL',
      style: 'ALL',
      type: 'ALL',
      takeout: 'ALL',
      openToday: false,
      searchQuery: ''
    };

    // 初期履歴の登録 (ブラウザバック用 - file://プロトコル等でのSecurityError対策)
    try {
      if (window.history && window.history.replaceState) {
        window.history.replaceState({
          view: 'top',
          selectedStoreId: null,
          filters: { ...this.filters }
        }, '');
      }
    } catch (e) {
      if (window.debugLog) window.debugLog('⚠️ history.replaceStateスキップ: ' + e.message);
    }

    try {
      this.initAudio();
      this.initEvents();
      this.render();
      this.initQuestSystem();
      if (window.debugLog) window.debugLog('✅ アプリ初期化完了');
    } catch (err) {
      alert('【初期化エラー】' + err.message);
      if (window.debugLog) window.debugLog('❌ 初期化エラー: ' + err.stack);
    }
  }

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  getStores() {
    if (window.questApi && window.questApi.stores && window.questApi.stores.length > 0) {
      return window.questApi.stores;
    }
    return [];
  }

  getAreas() {
    const stores = this.getStores();
    if (stores.length > 0) {
      const areas = Array.from(new Set(stores.map(s => s.area))).filter(Boolean);
      if (areas.length > 0) return areas;
    }
    return ['三軒家西', '三軒家東', '駅前', '泉尾', '平尾'];
  }

  getCategories() {
    const stores = this.getStores();
    if (stores.length > 0) {
      const categories = Array.from(new Set(stores.map(s => s.category))).filter(Boolean);
      if (categories.length > 0) return categories;
    }
    return ['おばんざい', '居酒屋', '立ち呑み', '中華', 'カフェ', 'バー', 'BAR', '焼肉', 'バル', '食堂'];
  }

  getStyles() {
    const stores = this.getStores();
    if (stores.length > 0) {
      const styles = Array.from(new Set(stores.map(s => s.style))).filter(Boolean);
      if (styles.length > 0) return styles;
    }
    return ['テーブルあり', '立ち呑み', 'カウンター'];
  }

  getTypes() {
    const stores = this.getStores();
    if (stores.length > 0) {
      const types = Array.from(new Set(stores.map(s => s.type))).filter(Boolean);
      if (types.length > 0) return types;
    }
    return ['腹ごしらえ', 'サク飲み', 'サク呑み', 'ひと休み', '夜遊び', 'テイクアウト'];
  }

  /* ------------------------------------------------------------------------
   * Supabase & LIFF クエストシステム初期化
   * ------------------------------------------------------------------------ */
  async initQuestSystem() {
    if (window.questApi) {
      try {
        await window.questApi.initAuth();
        await window.questApi.getCurrentSeason();
        const stores = await window.questApi.getStores();
        if (stores && stores.length > 0) {
          window.STORES_DATA = stores;
          window.TAISHO_STORES = stores;
          this.render(); // Supabase店舗データで即座に描画！
        }
        await window.questApi.getRewardTiers();
        await window.questApi.getHeroTitles();
        await window.questApi.getUserVisits();
        await window.questApi.getUserCoupons();

        // URLパラメータからのチェックイン検出 (?checkin=store-01 or ?store=store-01)
        const params = new URLSearchParams(window.location.search);
        const checkinStore = params.get('checkin') || (params.get('action') === 'checkin' ? params.get('store') : null);
        if (checkinStore) {
          await this.handleCheckin(checkinStore);
        }
      } catch (e) {
        console.warn('Quest system initialization failed:', e);
      }
      this.render();
    }
  }

  /* ------------------------------------------------------------------------
   * Web Audio API (ファミコン風効果音)
   * ------------------------------------------------------------------------ */
  initAudio() {
    // ユーザーインタラクション時にAudioContextを初期化
    const unlockAudio = () => {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.audioCtx = new AudioContext();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);
  }

  playStartSE() {
    if (!this.soundEnabled || !this.audioCtx) return;
    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(523.25, now);       // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
      osc.frequency.setValueAtTime(1046.50, now + 0.24);// C6
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(now + 0.45);
    } catch (e) {}
  }

  startGame() {
    if (window.debugLog) window.debugLog('▶ PUSH STARTがクリックされました');
    try {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.audioCtx = new AudioContext();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    } catch (e) {
      if (window.debugLog) window.debugLog('⚠️ 音声初期化スキップ: ' + e.message);
    }

    this.isStarted = true;
    try {
      this.playStartSE();
    } catch (e) {}

    const overlay = document.getElementById('start-overlay');
    if (overlay) {
      overlay.classList.add('fade-out');
      overlay.style.display = 'none'; // 即時非表示を確実化
      if (window.debugLog) window.debugLog('✨ スタートオーバーレイを非表示にしました');
    }

    this.render();
    setTimeout(() => {
      this.typeMessage('大正のオモロイ酒場を探そう！');
    }, 250);
  }

  playTone(freq, duration, type = 'square') {
    if (!this.soundEnabled || !this.audioCtx) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {}
  }

  playCursorSE() {
    this.playTone(440, 0.05, 'square');
  }

  playSelectSE() {
    this.playTone(880, 0.08, 'square');
  }

  playBackSE() {
    this.playTone(330, 0.08, 'square');
  }

  playFanfareSE() {
    if (!this.soundEnabled || !this.audioCtx) return;
    try {
      const now = this.audioCtx.currentTime;
      const notes = [
        { freq: 523.25, duration: 0.1, delay: 0 },      // C5
        { freq: 523.25, duration: 0.1, delay: 0.12 },   // C5
        { freq: 523.25, duration: 0.1, delay: 0.24 },   // C5
        { freq: 659.25, duration: 0.35, delay: 0.36 },  // E5
        { freq: 587.33, duration: 0.15, delay: 0.72 },  // D5
        { freq: 783.99, duration: 0.6, delay: 0.9 }     // G5
      ];
      notes.forEach(n => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(n.freq, now + n.delay);
        gain.gain.setValueAtTime(0.12, now + n.delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + n.delay + n.duration);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now + n.delay);
        osc.stop(now + n.delay + n.duration);
      });
    } catch (e) {}
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    const btn = document.getElementById('sound-toggle-btn');
    if (btn) {
      btn.textContent = this.soundEnabled ? '🔊 音声 ON' : '🔇 音声 OFF';
    }
    if (this.soundEnabled) this.playSelectSE();
  }

  /* ------------------------------------------------------------------------
   * イベント初期化
   * ------------------------------------------------------------------------ */
  initEvents() {
    // スタートボタン
    const startBtn = document.getElementById('start-game-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        if (window.debugLog) window.debugLog('🖱️ start-game-btn クリックイベント発火');
        this.startGame();
      });
    }

    // サウンド切り替えボタン
    const soundBtn = document.getElementById('sound-toggle-btn');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => this.toggleSound());
    }

    // ヘッダー「◀ もどる」ボタン
    const headerBackBtn = document.getElementById('header-back-btn');
    if (headerBackBtn) {
      headerBackBtn.addEventListener('click', () => {
        if (window.debugLog) window.debugLog('🖱️ ヘッダーもどるボタン クリック');
        this.goBack();
      });
    }

    // スティッキー絞り込みバーのタップで最上部（絞り込みフォーム）へスムーズスクロール
    const stickyBar = document.getElementById('sticky-filter-bar');
    if (stickyBar) {
      stickyBar.addEventListener('click', () => {
        this.playSelectSE();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // ブラウザバック / スワイプ戻りイベント (PopState)
    window.addEventListener('popstate', (e) => {
      this.handlePopState(e);
    });

    // スクロール時のスマート絞り込みバー表示制御
    window.addEventListener('scroll', () => {
      this.updateStickyFilterBar();
    });

    // ナビゲーションバー
    const navItems = document.querySelectorAll('.nav-item');
    if (window.debugLog) window.debugLog('ナビゲーション登録件数: ' + navItems.length);

    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const targetView = item.dataset.targetView;
        if (window.debugLog) window.debugLog('🖱️ ナビクリック: ' + targetView);

        if (targetView === 'qr-scan' || item.id === 'nav-btn-qr-scan') {
          e.preventDefault();
          this.playSelectSE();
          this.openQrScannerModal();
          return;
        }

        if (targetView === 'map' || item.id === 'nav-btn-map') {
          e.preventDefault();
          this.playSelectSE();
          window.open('https://maps.app.goo.gl/SqskFzoxuso7NwwL8', '_blank');
          return;
        }

        e.preventDefault();
        if (targetView) {
          this.playSelectSE();
          if (targetView === 'stores-all') {
            if (this.currentView === 'stores') {
              this.resetFilters();
            }
            this.navigateTo('stores');
          } else {
            this.navigateTo(targetView);
          }
        }
      });
    });
  }

  /* ------------------------------------------------------------------------
   * スティッキースマート絞り込みバーの動的更新
   * ------------------------------------------------------------------------ */
  updateStickyFilterBar() {
    const stickyBar = document.getElementById('sticky-filter-bar');
    if (!stickyBar) return;

    if (this.currentView !== 'stores') {
      stickyBar.classList.add('hidden');
      return;
    }

    // 絞り込み条件ウィンドウが画面上部にスクロールアウトしたかを判定
    const filterWindow = document.getElementById('store-filter-window');
    let shouldShow = false;
    
    if (filterWindow) {
      const rect = filterWindow.getBoundingClientRect();
      // ウィンドウの下端がヘッダー（46px）の下を通過したら表示
      shouldShow = rect.bottom <= 50;
    } else {
      const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
      shouldShow = scrollY > 150;
    }

    if (shouldShow) {
      stickyBar.classList.remove('hidden');
    } else {
      stickyBar.classList.add('hidden');
    }

    // 条件タグのテキスト生成
    const tagsContainer = document.getElementById('sticky-filter-tags');
    if (tagsContainer) {
      const activeTags = [];
      if (this.filters.area !== 'ALL') activeTags.push(`<span class="sticky-tag-item">📍 ${this.filters.area}</span>`);
      if (this.filters.category !== 'ALL') activeTags.push(`<span class="sticky-tag-item">${this.filters.category}</span>`);
      if (this.filters.style !== 'ALL') activeTags.push(`<span class="sticky-tag-item">🪑 ${this.filters.style}</span>`);
      if (this.filters.type !== 'ALL') activeTags.push(`<span class="sticky-tag-item">🍺 ${this.filters.type}</span>`);
      if (this.filters.takeout === 'YES') activeTags.push(`<span class="sticky-tag-item">テイクアウト可</span>`);
      if (this.filters.openToday) activeTags.push(`<span class="sticky-tag-item text-green">✓ どれクエ対応中</span>`);
      if (this.filters.searchQuery) activeTags.push(`<span class="sticky-tag-item">🔎 ${this.filters.searchQuery}</span>`);

      let count = 0;
      count = this.getStores().filter(store => {
        if (this.filters.area !== 'ALL' && store.area !== this.filters.area) return false;
        if (this.filters.category !== 'ALL' && store.category !== this.filters.category) return false;
        if (this.filters.style !== 'ALL' && store.style !== this.filters.style) return false;
        if (this.filters.type !== 'ALL' && store.type !== this.filters.type) return false;
        if (this.filters.takeout === 'YES' && !store.isTakeout) return false;
        if (this.filters.openToday && !store.isOpenToday) return false;
        if (this.filters.searchQuery) {
          const q = this.filters.searchQuery.toLowerCase().trim();
          return store.name.toLowerCase().includes(q) || store.catchphrase.toLowerCase().includes(q);
        }
        return true;
      }).length;

      if (activeTags.length > 0) {
        tagsContainer.innerHTML = `
          <span class="sticky-icon">🔍</span>
          <div style="display:flex; gap:4px; align-items:center; overflow:hidden;">
            ${activeTags.join('')}
            <span style="font-size:12px; color:#ffffff; font-weight:bold; margin-left:4px;">(${count}軒)</span>
          </div>
        `;
      } else {
        tagsContainer.innerHTML = `
          <span class="sticky-icon">🍺</span>
          <span>全酒場一覧 (${count}軒)</span>
        `;
      }
    }
  }

  /* ------------------------------------------------------------------------
   * 1つ前の画面に戻る処理
   * ------------------------------------------------------------------------ */
  goBack() {
    this.playBackSE();
    if (window.history.length > 1) {
      window.history.back();
    } else {
      // 履歴がない場合のフォールバック
      if (this.currentView === 'detail') {
        this.navigateTo('stores');
      } else {
        this.navigateTo('top');
      }
    }
  }

  /* ------------------------------------------------------------------------
   * ブラウザバック・スワイプ戻り時のハンドリング
   * ------------------------------------------------------------------------ */
  handlePopState(e) {
    this.playBackSE();
    if (e.state && e.state.view) {
      if (e.state.filters) {
        this.filters = { ...e.state.filters };
      }
      if (e.state.selectedStoreId && typeof STORES_DATA !== 'undefined') {
        this.selectedStore = STORES_DATA.find(s => s.id === e.state.selectedStoreId) || null;
      }
      this.navigateTo(e.state.view, null, true);
    } else {
      // stateが無い場合はトップ画面へ
      this.navigateTo('top', null, true);
    }
  }

  resetFilters() {
    this.filters = {
      area: 'ALL',
      category: 'ALL',
      style: 'ALL',
      type: 'ALL',
      takeout: 'ALL',
      openToday: false,
      searchQuery: ''
    };
    this.lastStoresScrollY = 0;
    this.updateHistoryFilters();
  }

  /* ------------------------------------------------------------------------
   * 現在の履歴ステートの絞り込み条件を最新に同期
   * ------------------------------------------------------------------------ */
  updateHistoryFilters() {
    try {
      if (window.history && window.history.replaceState) {
        const currentState = window.history.state || {};
        window.history.replaceState({
          ...currentState,
          view: this.currentView,
          selectedStoreId: this.selectedStore ? this.selectedStore.id : null,
          filters: { ...this.filters }
        }, '');
      }
    } catch (e) {
      console.warn('history.replaceState is not supported in this context:', e);
    }
  }

  /* ------------------------------------------------------------------------
   * 画面遷移とメッセージ更新
   * ------------------------------------------------------------------------ */
  navigateTo(view, extraData = null, isPopState = false) {
    if (view === 'map') {
      window.open('https://maps.app.goo.gl/SqskFzoxuso7NwwL8', '_blank');
      return;
    }

    // 店舗一覧画面から別画面（詳細など）へ遷移する際、現在のスクロール位置を保存
    if (this.currentView === 'stores' && view !== 'stores') {
      this.lastStoresScrollY = window.scrollY || window.pageYOffset || (document.documentElement ? document.documentElement.scrollTop : 0) || 0;
    }

    this.currentView = view;
    if (extraData && extraData.store) {
      this.selectedStore = extraData.store;
    }

    // History API に画面状態をプッシュ (popstate による遷移でない場合のみ - file://でのエラー対策)
    try {
      if (!isPopState && window.history && window.history.pushState) {
        window.history.pushState({
          view: view,
          selectedStoreId: this.selectedStore ? this.selectedStore.id : null,
          filters: { ...this.filters }
        }, '');
      }
    } catch (e) {
      console.warn('history.pushState is not supported in this context:', e);
    }

    // ヘッダー「◀ もどる」ボタンの表示/非表示切り替え (トップ画面以外で表示)
    const headerBackBtn = document.getElementById('header-back-btn');
    if (headerBackBtn) {
      if (view === 'top') {
        headerBackBtn.classList.add('hidden');
      } else {
        headerBackBtn.classList.remove('hidden');
      }
    }

    // ボトムナビのハイライト更新
    document.querySelectorAll('.nav-item').forEach(nav => {
      nav.classList.remove('active');
      if (nav.dataset.targetView === view) {
        nav.classList.add('active');
      }
    });

    this.render();
    this.updateStickyFilterBar();

    // 店舗一覧画面に戻ってきた場合は前回のスクロール位置を復元、それ以外は最上部へ
    if (view === 'stores' && this.lastStoresScrollY > 0) {
      const targetY = this.lastStoresScrollY;
      requestAnimationFrame(() => {
        window.scrollTo(0, targetY);
      });
      setTimeout(() => {
        window.scrollTo(0, targetY);
      }, 50);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // メッセージウィンドウのタイピング演出
  typeMessage(text) {
    const msgEl = document.getElementById('rpg-message-text');
    if (!msgEl) return;
    msgEl.textContent = '';
    let i = 0;
    
    // 既存タイマーをクリア
    if (this.msgTimer) clearInterval(this.msgTimer);

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    this.msgTimer = setInterval(() => {
      if (i < text.length) {
        msgEl.textContent += text.charAt(i);
        if (i % 2 === 0) this.playTone(300 + Math.random() * 100, 0.02, 'sine');
        i++;
      } else {
        clearInterval(this.msgTimer);
      }
    }, 25);
  }

  // アプリ共通フッターバージョン表示HTML
  getFooterVersionHTML() {
    const v = (window.APP_CONFIG && window.APP_CONFIG.version) || 'v2026.09.19.04';
    return `
      <div class="app-footer-version">
        <div>大正酔いどれクエストⅡ 公式ガイド</div>
        <div class="version-pill">
          <span>⚙️ app version:</span>
          <strong style="color:#e2e8f0;">${v}</strong>
        </div>
      </div>
    `;
  }

  /* ------------------------------------------------------------------------
   * メインレンダリングルーティン
   * ------------------------------------------------------------------------ */
  render() {
    const stores = this.getStores();
    // 各店舗の今日・現在営業フラグを動的に更新
    if (typeof checkIsOpenToday === 'function' && stores.length > 0) {
      stores.forEach(store => {
        store.isOpenToday = checkIsOpenToday(store);
      });
    }

    const container = document.getElementById('view-container');
    if (!container) return;

    container.innerHTML = '';

    switch (this.currentView) {
      case 'top':
        this.renderTopView(container);
        break;
      case 'quest-book':
        this.renderQuestBookView(container);
        break;
      case 'area':
        this.renderAreaView(container);
        break;
      case 'category':
        this.renderCategoryView(container);
        break;
      case 'style':
        this.renderStyleView(container);
        break;
      case 'type':
        this.renderTypeView(container);
        break;
      case 'stores':
        this.renderStoresView(container);
        break;
      case 'detail':
        this.renderDetailView(container);
        break;
      default:
        this.renderTopView(container);
    }
  }

  /* ------------------------------------------------------------------------
   * 開催ステータス告知バナー生成
   * ------------------------------------------------------------------------ */
  getSeasonBannerHTML() {
    const season = window.questApi?.currentSeason;
    if (!season || !season.statusInfo) return '';
    const info = season.statusInfo;

    if (info.isEventActive) {
      return `
        <div class="season-notice-banner banner-active">
          <div class="season-notice-inner">
            <span class="season-notice-icon">🍺</span>
            <div class="season-notice-text">
              <strong>【${this.escapeHtml ? this.escapeHtml(season.name) : season.name} 開催中！】</strong>
              <div style="font-size:11px; opacity:0.9;">ハシゴ酒で宝箱を解放しよう！ (残り ${info.daysLeft} 日)</div>
            </div>
          </div>
        </div>
      `;
    } else if (info.isCouponActive) {
      return `
        <div class="season-notice-banner banner-warning">
          <div class="season-notice-inner">
            <span class="season-notice-icon">⚠️</span>
            <div class="season-notice-text">
              <strong>【後夜祭・クーポン利用期間中】</strong>
              <div style="font-size:11px; opacity:0.9;">利用期限: ${season.coupon_valid_until} まで！お早めにお使いください</div>
            </div>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="season-notice-banner banner-expired">
          <div class="season-notice-inner">
            <span class="season-notice-icon">🔒</span>
            <div class="season-notice-text">
              <strong>【イベント終了】</strong>
              <div style="font-size:11px; opacity:0.9;">今期のクーポン利用期間は終了いたしました</div>
            </div>
          </div>
        </div>
      `;
    }
  }



  /* ------------------------------------------------------------------------
   * 3.1 トップ画面 (酒場案内所)
   * ------------------------------------------------------------------------ */
  renderTopView(container) {
    if (this.isStarted) {
      this.typeMessage('大正のオモロイ酒場を探そう！');
    } else {
      const msgEl = document.getElementById('rpg-message-text');
      if (msgEl) {
        msgEl.textContent = '「PUSH START」を押してください。';
      }
    }

    const allStores = this.getStores();
    const takeoutCount = allStores.filter(s => s.isTakeout).length;
    const openCount = allStores.filter(s => s.isOpenToday).length;
    const totalCount = allStores.length;
    const areaCount = (typeof AREAS_LIST !== 'undefined' && AREAS_LIST.length > 0) ? AREAS_LIST.length : 5;
    const catCount = (typeof CATEGORIES_LIST !== 'undefined' && CATEGORIES_LIST.length > 0) ? CATEGORIES_LIST.length : 7;
    const styleCount = (typeof STYLES_LIST !== 'undefined' && STYLES_LIST.length > 0) ? STYLES_LIST.length : 3;
    const typeCount = (typeof TYPES_LIST !== 'undefined' && TYPES_LIST.length > 0) ? TYPES_LIST.length : 4;

    const currentSeason = (window.questApi && window.questApi.currentSeason) || {};
    const fallback = window.APP_CONFIG?.fallbackSeasonGuidance || {};
    const overview = currentSeason.overview || fallback.overview || '';
    const guideSteps = (currentSeason.guide_steps && currentSeason.guide_steps.length > 0) ? currentSeason.guide_steps : (fallback.guide_steps || []);
    const rulesNotes = currentSeason.rules_notes || fallback.rules_notes || '';

    container.innerHTML = `
      <!-- 開催フェーズ動的告知バナー -->
      ${this.getSeasonBannerHTML()}

      <!-- 大正酒場 案内所（ギルド）カード -->
      <div class="rpg-window gold-border top-guidance-window">
        <div class="top-guidance-header">
          <div class="top-guidance-title">
            <span>🏛️</span>
            <span>大正酒場 案内所</span>
          </div>
          <span class="tag tag-area">全${totalCount}酒場 参戦中</span>
        </div>

        ${overview ? `
          <div class="top-guidance-overview">
            ${this.escapeHtml(overview).replace(/\n/g, '<br>')}
          </div>
        ` : ''}

        <!-- はしご酒の導き・冒険の心得（アコーディオン） -->
        <div class="guidance-accordion-wrapper">
          <button class="guidance-accordion-btn" id="guidance-accordion-toggle" type="button">
            <span><i class="fa-solid fa-scroll"></i> 📜 はしご酒の導き＆冒険の心得</span>
            <span id="guidance-accordion-icon" style="font-size:12px; color:var(--text-cyan);">詳しく見る ▼</span>
          </button>
          <div id="guidance-accordion-body" class="guidance-accordion-content" style="display:none;">
            ${guideSteps.map((st, idx) => `
              <div class="guide-step-card">
                <div class="guide-step-header">
                  <span>${idx === 0 ? '⚔️' : (idx === 1 ? '📱' : '🎁')}</span>
                  <span>${this.escapeHtml(st.step || `其の${idx+1}`)}【${this.escapeHtml(st.title || '')}】</span>
                </div>
                <div class="guide-step-desc">${this.escapeHtml(st.desc || '')}</div>
              </div>
            `).join('')}

            ${rulesNotes ? `
              <div class="guide-rules-box">
                <div class="guide-rules-title">
                  <i class="fa-solid fa-shield-halved"></i> 冒険の心得（注意事項）
                </div>
                <div class="guide-rules-content">
                  ${this.escapeHtml(rulesNotes).replace(/\n/g, '<br>')}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>

      <div class="rpg-window gold-border">
        <div class="rpg-window-header">
          <span>▶ コマンド選択</span>
        </div>
        <ul class="command-list">
          <li class="command-item" data-action="area">
            <div class="command-item-left">
              <span class="command-cursor">▶</span>
              <span class="command-label">エリアから探す</span>
            </div>
            <span class="command-badge">${areaCount}エリア</span>
          </li>
          <li class="command-item" data-action="category">
            <div class="command-item-left">
              <span class="command-cursor">▶</span>
              <span class="command-label">酒場の種類から探す</span>
            </div>
            <span class="command-badge">${catCount}種類</span>
          </li>
          <li class="command-item" data-action="style">
            <div class="command-item-left">
              <span class="command-cursor">▶</span>
              <span class="command-label">席スタイルから探す</span>
            </div>
            <span class="command-badge">${styleCount}スタイル</span>
          </li>
          <li class="command-item" data-action="type">
            <div class="command-item-left">
              <span class="command-cursor">▶</span>
              <span class="command-label">酔いどれタイプから探す</span>
            </div>
            <span class="command-badge">${typeCount}タイプ</span>
          </li>
          <li class="command-item" data-action="today">
            <div class="command-item-left">
              <span class="command-cursor">▶</span>
              <span class="command-label">どれクエ対応中の酒場</span>
            </div>
            <span class="command-badge text-green">対応中 ${openCount}軒</span>
          </li>
          <li class="command-item" data-action="takeout">
            <div class="command-item-left">
              <span class="command-cursor">▶</span>
              <span class="command-label">テイクアウトOKな酒場</span>
            </div>
            <span class="command-badge">${takeoutCount}軒</span>
          </li>
          <li class="command-item" data-action="map">
            <div class="command-item-left">
              <span class="command-cursor">▶</span>
              <span class="command-label">Googleマップで探す</span>
            </div>
            <span class="command-badge text-yellow">Google MAP</span>
          </li>
          <li class="command-item" data-action="all">
            <div class="command-item-left">
              <span class="command-cursor">▶</span>
              <span class="command-label">全酒場一覧を見る</span>
            </div>
            <span class="command-badge">${totalCount}軒</span>
          </li>
        </ul>
      </div>
      ${this.getFooterVersionHTML()}
    `;

    // コマンドクリックイベント
    container.querySelectorAll('.command-item').forEach(item => {
      item.addEventListener('mouseenter', () => this.playCursorSE());
      item.addEventListener('click', () => {
        this.playSelectSE();
        const action = item.dataset.action;
        if (action === 'area') this.navigateTo('area');
        else if (action === 'category') this.navigateTo('category');
        else if (action === 'style') this.navigateTo('style');
        else if (action === 'type') this.navigateTo('type');
        else if (action === 'today') {
          this.resetFilters();
          this.filters.openToday = true;
          this.navigateTo('stores');
        }
        else if (action === 'takeout') {
          this.resetFilters();
          this.filters.takeout = 'YES';
          this.navigateTo('stores');
        }
        else if (action === 'map') {
          window.open('https://maps.app.goo.gl/SqskFzoxuso7NwwL8', '_blank');
        }
        else if (action === 'all') {
          this.resetFilters();
          this.navigateTo('stores');
        }
      });
    });

    // アコーディオントグルイベント
    const accordionBtn = document.getElementById('guidance-accordion-toggle');
    const accordionBody = document.getElementById('guidance-accordion-body');
    const accordionIcon = document.getElementById('guidance-accordion-icon');
    if (accordionBtn && accordionBody) {
      accordionBtn.addEventListener('click', () => {
        this.playSelectSE();
        const isOpen = accordionBody.style.display !== 'none';
        accordionBody.style.display = isOpen ? 'none' : 'flex';
        if (accordionIcon) {
          accordionIcon.textContent = isOpen ? '詳しく見る ▼' : '閉じる ▲';
        }
      });
    }
  }

  /* ------------------------------------------------------------------------
   * 冒険の書 (Quest Book / Passport) 画面
   * ------------------------------------------------------------------------ */
  renderQuestBookView(container) {
    const user = (window.questApi && window.questApi.currentUser) || {
      displayName: '酔いどれ勇者',
      pictureUrl: 'assets/banner.png'
    };
    const visits = (window.questApi && window.questApi.visits) || [];
    const stores = this.getStores();
    const totalStores = stores.length || 33;
    const visitedCount = visits.length;
    const progressPercent = Math.min(100, Math.round((visitedCount / totalStores) * 100));

    // 称号・レベル計算 (Supabaseマスタ/管理画面設定連動)
    const heroTitles = (window.questApi && window.questApi.heroTitles) || window.APP_CONFIG.fallbackHeroTitles || [];
    const sortedTitles = [...heroTitles].sort((a, b) => (Number(b.min_visits) || 0) - (Number(a.min_visits) || 0));
    const matchedHero = sortedTitles.find(t => visitedCount >= (Number(t.min_visits) || 0)) ||
                        sortedTitles[sortedTitles.length - 1] ||
                        { level: 1, title: '駆け出しの呑兵衛', badge_color: '#94a3b8' };

    const heroTitle = matchedHero.title || '駆け出しの呑兵衛';
    const heroLv = matchedHero.level || 1;
    const heroColor = matchedHero.badge_color || '#facc15';

    this.typeMessage(`『${user.displayName}』の冒険の書です。酒場を巡ってQRコードを読み取ろう！`);

    const rewardTiers = (window.questApi && window.questApi.rewardTiers && window.questApi.rewardTiers.length > 0)
      ? window.questApi.rewardTiers 
      : (window.APP_CONFIG?.fallbackRewardTiers || []);
    const userCoupons = (window.questApi && window.questApi.userCoupons) || [];

    // 獲得済み特典ランクの判定 (数値・文字列両対応)
    const claimedTierIds = new Set(userCoupons.map(c => Number(c.reward_tier_id)));

    // 特典宝箱のレンダリング (案A: RPGクエストカード型)
    const tiersHtml = (rewardTiers.length > 0) ? rewardTiers.map(tier => {
      const isReached = visitedCount >= tier.required_visits;
      const isClaimed = claimedTierIds.has(Number(tier.id));
      const isGoods = tier.reward_type === 'goods';
      const remainingVisits = tier.required_visits - visitedCount;

      let actionHtml = '';
      if (isClaimed) {
        if (isGoods) {
          actionHtml = `<div class="treasure-claimed-badge">グッズ引換券取得済み</div>`;
        } else {
          actionHtml = `<div class="treasure-claimed-badge">特典クーポン取得済み</div>`;
        }
      } else if (isReached) {
        if (isGoods) {
          actionHtml = `<button class="treasure-claim-btn" data-tier-id="${tier.id}" data-reward-type="goods">宝箱を開ける</button>`;
        } else {
          actionHtml = `<button class="treasure-claim-btn" data-tier-id="${tier.id}" data-reward-type="store_coupon">宝箱を開ける</button>`;
        }
      } else {
        actionHtml = `<div style="font-size:14px; color:#e2e8f0; font-weight:bold;">🔒 あと <strong class="text-yellow" style="font-size:16px;">${remainingVisits}軒</strong> のハシゴ酒で解放！</div>`;
      }

      // ステータス表示
      let statusBadge = '';
      if (isClaimed) {
        statusBadge = '<span class="treasure-tier-status status-claimed">📦 獲得済み</span>';
      } else if (isReached) {
        statusBadge = '<span class="treasure-tier-status status-unlocked">✨ 解放可能！</span>';
      } else {
        statusBadge = `<span class="treasure-tier-status status-locked">🔒 あと ${remainingVisits}軒</span>`;
      }

      return `
        <div class="treasure-tier-card ${isReached ? 'unlocked' : ''}">
          <!-- 1. 最上段: 種別バッジ & 状態ステータス -->
          <div class="treasure-tier-topbar">
            <span class="treasure-tier-type-badge ${isGoods ? 'badge-goods' : 'badge-coupon'}">
              ${isGoods ? '🎁 グッズ引換' : '🍺 酒場クーポン'}
            </span>
            ${statusBadge}
          </div>

          <!-- 2. タイトル -->
          <div class="treasure-tier-title-row">
            <h4 class="treasure-tier-title">🏆 ${this.escapeHtml(tier.title)}</h4>
          </div>

          <!-- 3. 条件・引換内容 -->
          <div class="treasure-tier-condition">
            <span>🍺 必要制覇数: <strong class="text-yellow">${tier.required_visits}軒</strong></span>
            ${isGoods ? 
              `<span> | 🎁 <strong style="color:#ffffff;">${this.escapeHtml(tier.goods_name || '記念品')}</strong></span>` : 
              `<span> | 🎟️ <strong style="color:#ffffff;">${tier.selectable_count}酒場選択</strong></span>`
            }
          </div>

          <!-- 4. グッズ時の引換場所・注意事項 (もしあれば) -->
          ${isGoods && tier.exchange_location ? `
            <div class="treasure-tier-location">
              📍 <strong>引換場所:</strong> ${this.escapeHtml(tier.exchange_location)}
            </div>
          ` : ''}
          ${isGoods && tier.exchange_notice ? `
            <div class="treasure-tier-notice">
              ⚠️ ${this.escapeHtml(tier.exchange_notice)}
            </div>
          ` : ''}

          <!-- 5. 説明文 -->
          ${tier.description ? `<div class="treasure-tier-desc">${this.escapeHtml(tier.description)}</div>` : ''}

          <!-- 6. アクションボタン -->
          <div class="treasure-tier-action">${actionHtml}</div>
        </div>
      `;
    }).join('') : '<div style="padding:15px; text-align:center; color:#e2e8f0; font-size:14px;">特典マイルストーンを読み込み中です。</div>';

    // 所持クーポン・引換券一覧のレンダリング
    const activeCoupons = userCoupons.filter(c => c.status !== 'used');
    const usedCoupons = userCoupons.filter(c => c.status === 'used');

    const season = window.questApi?.currentSeason;
    const info = season?.statusInfo;
    const isExpired = info ? info.isExpired : false;
    const isCouponUsable = info ? info.isCouponUsable : true;
    const couponStartDateStr = info?.couponStartDateStr || '';

    const renderCouponCard = (c, isUsed) => {
      const isGoods = c.reward_type === 'goods';
      if (isGoods) {
        let badge = '<span class="text-yellow" style="font-size:12px; font-weight:bold;">【引換可能】</span>';
        if (isUsed) {
          badge = '<span style="color:#94a3b8; font-size:12px;">【受取済み】</span>';
        } else if (isExpired) {
          badge = '<span class="text-danger" style="font-size:12px; font-weight:bold;">【引換終了】</span>';
        }

        return `
          <div class="coupon-ticket ${isUsed ? 'used' : ''}" data-coupon-id="${c.id}" style="border-left: 4px solid #f59e0b;">
            <div class="coupon-ticket-header">
              <span class="coupon-store-name">🎁 ${this.escapeHtml(c.goods_name || c.title || '記念オリジナルグッズ')}</span>
              ${badge}
            </div>
            <div class="coupon-desc-text" style="color:${isUsed ? '#94a3b8' : '#e2e8f0'}; font-size:13px;">📍 受取場所: ${this.escapeHtml(c.exchange_location || '全参加酒場または運営本部')}</div>
            ${isUsed ? `<div class="coupon-used-stamp">USED</div>` : ''}
          </div>
        `;
      }

      const st = stores.find(s => s.id === c.store_id) || c.stores || {};
      const storeName = st.name || c.stores?.name || c.store_id;

      let badge = '<span class="text-green" style="font-size:12px; font-weight:bold;">【利用可能】</span>';
      if (isUsed) {
        badge = '<span style="color:#94a3b8; font-size:12px;">【使用済み】</span>';
      } else if (isExpired) {
        badge = '<span class="text-danger" style="font-size:12px; font-weight:bold;">【期限終了】</span>';
      } else if (!isCouponUsable) {
        badge = `<span class="text-yellow" style="font-size:12px; font-weight:bold;">【${couponStartDateStr ? couponStartDateStr + '〜' : '後日利用可'}】</span>`;
      }

      return `
        <div class="coupon-ticket ${isUsed ? 'used' : ''}" data-coupon-id="${c.id}">
          <div class="coupon-ticket-header">
            <span class="coupon-store-name">🏮 ${storeName}</span>
            ${badge}
          </div>
          <div class="coupon-desc-text" style="color:${isUsed ? '#94a3b8' : '#e2e8f0'}; font-size:13px;">🍺 酒場特典（後夜祭・指定期間に提示）</div>
          ${isUsed ? `<div class="coupon-used-stamp">USED</div>` : ''}
        </div>
      `;
    };

    const couponsHtml = (userCoupons.length > 0)
      ? `
        <div class="rpg-window window-purple" style="margin-bottom:14px;">
          <div class="rpg-window-header header-purple">
            <span>🎟️ 所持クーポン・引換券 (${userCoupons.length}枚)</span>
          </div>
          <div style="margin-top:10px;">
            ${activeCoupons.map(c => renderCouponCard(c, false)).join('')}
            ${usedCoupons.map(c => renderCouponCard(c, true)).join('')}
          </div>
        </div>
      `
      : `
        <div class="rpg-window window-purple" style="margin-bottom:14px;">
          <div class="rpg-window-header header-purple">
            <span>🎟️ 所持クーポン・引換券</span>
          </div>
          <div style="padding:15px; text-align:center; color:#e2e8f0; font-size:14px; line-height:1.6;">
            現在所持しているクーポン・引換券はありません。<br>酒場を巡って特典宝箱を解放しよう！
          </div>
        </div>
      `;

    // 全酒場を連番順（store-01, store-02...）にソート
    const sortedStores = [...stores].sort((a, b) => {
      const numA = parseInt(String(a.id).replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(String(b.id).replace(/\D/g, ''), 10) || 0;
      if (numA !== numB) return numA - numB;
      return (a.name || '').localeCompare(b.name || '', 'ja');
    });

    const visitedMap = new Map();
    visits.forEach(v => {
      visitedMap.set(v.store_id, v);
    });

    // 酒場ロゴコレクション（図鑑風タイルグリッド）の生成
    // ※通し番号や店舗名、日時はタイル上に表示せず、ロゴ画像のみを配置
    const stampGridHtml = sortedStores.map(st => {
      const isVisited = visitedMap.has(st.id);
      const logoUrl = st.logoUrl || st.logo_url || '';
      const initialChar = this.escapeHtml((st.name || '酒').slice(0, 1));

      return `
        <div class="quest-stamp-item ${isVisited ? 'visited' : 'unvisited'}" data-store-id="${st.id}" title="${this.escapeHtml(st.name)}">
          ${logoUrl ? `
            <img src="${logoUrl}" alt="${this.escapeHtml(st.name)}" class="quest-stamp-logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div class="quest-stamp-fallback" style="display:none;">${initialChar}</div>
          ` : `
            <div class="quest-stamp-fallback">${initialChar}</div>
          `}
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="quest-book-container">
        <!-- 開催フェーズ動的告知バナー -->
        ${this.getSeasonBannerHTML()}

        <!-- 1. 勇者ステータス -->
        <div class="hero-status-card">
          <img src="${user.pictureUrl || 'assets/banner.png'}" alt="Avatar" class="hero-avatar" onerror="this.src='assets/banner.png';">
          <div class="hero-info">
            <div class="hero-name">
              <span>${user.displayName}</span>
              <span class="hero-badge text-yellow">Lv.${heroLv}</span>
            </div>
            <div class="hero-title">称号: ${heroTitle}</div>
            <div class="hero-badge-row">
              <span class="hero-badge text-green">制覇: ${visitedCount}軒</span>
              <span class="hero-badge text-cyan">クーポン: ${activeCoupons.length}枚</span>
            </div>
          </div>
        </div>

        <!-- 2. クエスト進捗 -->
        <div class="quest-progress-box" style="margin-bottom:12px;">
          <div class="quest-progress-header">
            <span class="quest-progress-title">⚔️ ハシゴ酒進捗</span>
            <span class="quest-progress-count">${visitedCount} <span style="font-size:14px; color:#e2e8f0;">/ ${totalStores} 軒</span></span>
          </div>
          <div class="quest-progress-bar-bg">
            <div class="quest-progress-bar-fill" style="width: ${progressPercent}%;"></div>
          </div>
        </div>

        <!-- 3. 酒場コレクション (全店舗の図鑑風ロゴタイル) -->
        <div class="rpg-window window-green" style="margin-bottom:14px;">
          <div class="rpg-window-header header-green">
            <span>📜 酒場コレクション (${visitedCount} / ${totalStores}軒)</span>
          </div>
          <div class="quest-stamp-grid">
            ${stampGridHtml || `<div style="padding:15px; text-align:center; color:#e2e8f0; font-size:14px; grid-column: 1 / -1;">酒場マスターを読み込み中です。</div>`}
          </div>
        </div>

        <!-- 4. 特典宝箱一覧 (目標・チャレンジ) -->
        <div class="rpg-window window-gold gold-border" style="margin-bottom:14px;">
          <div class="rpg-window-header header-gold">
            <span>🎁 ハシゴ達成特典・宝箱</span>
          </div>
          <div style="margin-top:10px;">
            ${tiersHtml}
          </div>
        </div>

        <!-- 5. 所持クーポン一覧 (どうぐ袋・持ち物) -->
        ${couponsHtml}

        <!-- 6. 開発・デモ用クイックテスト操作 -->
        <div class="rpg-window" style="margin-top:20px; border:1px dashed #f59e0b; background: rgba(30, 25, 15, 0.7);">
          <div class="rpg-window-header" style="color: #fbbf24;">
            <span>🧪 開発・レビュー用テスト機能</span>
          </div>
          <div style="padding: 10px 4px 6px; font-size: 13px; color: #e2e8f0; line-height: 1.5;">
            ※QR読取の動作確認機能です。酒場サインをシミュレートし、宝箱解放テストが行えます。
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px;">
            <button id="btn-quick-test-5visits" class="command-button" style="background: linear-gradient(180deg, #d97706 0%, #b45309 100%); color: #fff; border: 1px solid #f59e0b; padding: 10px 6px; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer;">
              🍺 +5酒場サイン
            </button>
            <button id="btn-quick-test-10visits" class="command-button" style="background: linear-gradient(180deg, #b45309 0%, #78350f 100%); color: #fef08a; border: 1px solid #f59e0b; padding: 10px 6px; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer;">
              🍺 +10酒場サイン
            </button>
            <button id="btn-quick-test-15visits" class="command-button" style="background: linear-gradient(180deg, #7c2d12 0%, #451a03 100%); color: #fde047; border: 1px solid #eab308; padding: 10px 6px; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer;">
              🍺 +15酒場サイン
            </button>
            <button id="btn-quick-test-reset" class="command-button" style="background: #334155; color: #ffffff; border: 1px solid #475569; padding: 10px 6px; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: bold;">
              🗑️ 履歴リセット
            </button>
          </div>
        </div>
        ${this.getFooterVersionHTML()}
      </div>
    `;

    // 酒場ロゴタイルタップで店舗詳細確認モーダル表示
    container.querySelectorAll('.quest-stamp-item').forEach(tile => {
      tile.addEventListener('click', () => {
        this.playSelectSE();
        const storeId = tile.dataset.storeId;
        const store = stores.find(s => s.id === storeId);
        if (!store) return;
        const visitInfo = visitedMap.get(storeId);
        this.showStoreStampModal(store, visitInfo);
      });
    });

    // 宝箱を開くボタンのイベント
    container.querySelectorAll('.treasure-claim-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        this.playSelectSE();
        const tierId = parseInt(btn.dataset.tierId, 10);
        const tier = rewardTiers.find(t => t.id === tierId);
        if (!tier) return;

        if (tier.reward_type === 'goods') {
          if (!confirm(`🎁 宝箱を開けて『${tier.goods_name || tier.title}』の引換券を獲得しますか？`)) {
            return;
          }
          this.playFanfareSE();
          btn.disabled = true;
          btn.textContent = '獲得中...';
          const res = await window.questApi.claimGoodsReward(tier.id);
          if (res.success) {
            alert(`🎉 おめでとうございます！\n『${tier.goods_name || tier.title}』の引換券を獲得しました！\n\n「所持クーポン・記念品引換券」一覧から受取画面を表示できます。`);
            this.render();
          } else {
            alert(res.message || 'グッズ引換券の獲得に失敗しました。');
            btn.disabled = false;
          }
        } else {
          this.openCouponSelectModal(tier);
        }
      });
    });

    // クーポンタップで消し込みモーダル表示
    container.querySelectorAll('.coupon-ticket').forEach(card => {
      card.addEventListener('click', () => {
        this.playSelectSE();
        const couponId = card.dataset.couponId;
        const coupon = userCoupons.find(c => c.id === couponId);
        if (coupon) {
          this.openRedeemModal(coupon);
        }
      });
    });

    // 共通テストサイン実行関数
    const handleTestVisits = async (count, btnEl) => {
      if (!confirm(`【テスト実行】新たに【${count}店舗】の店主サインを冒険の書に記録しますか？`)) {
        return;
      }
      this.playFanfareSE();
      const origText = btnEl.textContent;
      btnEl.disabled = true;
      btnEl.textContent = '記録中...';
      const res = await window.questApi.recordMultipleVisitsForTest(count);
      if (res.success) {
        alert(`🎉【テスト成功】新たに${res.count}店舗の店主サインを記録しました！\n（現在の制覇数: ${res.totalVisits}軒）\n達成した特典宝箱を開けてみましょう！`);
        this.render();
      } else {
        alert(res.message || 'テスト記録に失敗しました。');
        btnEl.disabled = false;
        btnEl.textContent = origText;
      }
    };

    const test5Btn = container.querySelector('#btn-quick-test-5visits');
    if (test5Btn) {
      test5Btn.addEventListener('click', () => handleTestVisits(5, test5Btn));
    }

    const test10Btn = container.querySelector('#btn-quick-test-10visits');
    if (test10Btn) {
      test10Btn.addEventListener('click', () => handleTestVisits(10, test10Btn));
    }

    const test15Btn = container.querySelector('#btn-quick-test-15visits');
    if (test15Btn) {
      test15Btn.addEventListener('click', () => handleTestVisits(15, test15Btn));
    }

    // テストリセットボタン
    const testResetBtn = container.querySelector('#btn-quick-test-reset');
    if (testResetBtn) {
      testResetBtn.addEventListener('click', async () => {
        if (!confirm('【テストデータ初期化】あなたの来店・サイン記録と所持クーポン・グッズ引換券をすべてリセットしますか？')) {
          return;
        }
        this.playSelectSE();
        testResetBtn.disabled = true;
        testResetBtn.textContent = 'リセット中...';
        const res = await window.questApi.resetUserVisitsAndCouponsForTest();
        if (res.success) {
          alert('✅ 来店・サイン履歴および所持クーポンをリセットしました。');
          this.render();
        } else {
          alert(res.message || 'リセットに失敗しました。');
          testResetBtn.disabled = false;
          testResetBtn.textContent = '🗑️ 履歴リセット';
        }
      });
    }
  }

  /* ------------------------------------------------------------------------
   * 冒険の書: 酒場ロゴタイルタップ時の店舗確認モーダル
   * ------------------------------------------------------------------------ */
  showStoreStampModal(store, visitInfo) {
    const isVisited = !!visitInfo;
    const logoUrl = store.logoUrl || store.logo_url || '';
    const dateStr = (visitInfo && visitInfo.visited_at)
      ? new Date(visitInfo.visited_at).toLocaleString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '';

    const modalId = 'store-stamp-modal-' + Date.now();
    const modalHtml = `
      <div id="${modalId}" class="stamp-modal-overlay">
        <div class="stamp-modal-content">
          <div class="stamp-modal-header">
            <span class="stamp-modal-title">📜 酒場コレクション</span>
            <button class="stamp-modal-close-btn" aria-label="閉じる">&times;</button>
          </div>
          <div class="stamp-modal-body">
            <div class="stamp-modal-logo-box ${isVisited ? 'visited' : ''}">
              ${logoUrl ? `
                <img src="${logoUrl}" alt="${this.escapeHtml(store.name)}" class="stamp-modal-logo-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="quest-stamp-fallback" style="display:none; font-size:24px;">${this.escapeHtml((store.name || '酒').slice(0, 1))}</div>
              ` : `
                <div class="quest-stamp-fallback" style="font-size:24px;">${this.escapeHtml((store.name || '酒').slice(0, 1))}</div>
              `}
            </div>
            <div class="stamp-modal-store-name">${this.escapeHtml(store.name)}</div>
            <div class="stamp-modal-meta">
              📍 ${this.escapeHtml(store.area || '')} ${store.category ? ` / ${this.escapeHtml(store.category)}` : ''}
            </div>
            <div>
              ${isVisited ? `
                <span class="stamp-modal-status-badge status-visited">
                  ✨ 制覇済み (${dateStr})
                </span>
              ` : `
                <span class="stamp-modal-status-badge status-unvisited">
                  🔒 未制覇 (まだサインを受け取っていません)
                </span>
              `}
            </div>
            <div class="stamp-modal-actions">
              <button class="command-button btn-go-detail" style="background: linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%); color: #fff; border: 1px solid #3b82f6; padding: 10px; border-radius: 6px; font-weight: bold; font-size: 14px; cursor: pointer;">
                🏮 酒場詳細を見る
              </button>
              <button class="command-button btn-close-modal" style="background: #334155; color: #fff; border: 1px solid #475569; padding: 8px; border-radius: 6px; font-size: 13px; cursor: pointer;">
                閉じる
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modalEl = document.getElementById(modalId);
    if (!modalEl) return;

    const closeModal = () => {
      this.playBackSE();
      modalEl.remove();
    };

    modalEl.querySelector('.stamp-modal-close-btn').addEventListener('click', closeModal);
    modalEl.querySelector('.btn-close-modal').addEventListener('click', closeModal);
    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) closeModal();
    });

    modalEl.querySelector('.btn-go-detail').addEventListener('click', () => {
      this.playSelectSE();
      modalEl.remove();
      this.navigateTo('detail', { store });
    });
  }

  /* ------------------------------------------------------------------------
   * 特典クーポン選択モーダル (達成条件に応じて店舗を選択)
   * ------------------------------------------------------------------------ */
  openCouponSelectModal(tier) {
    const stores = this.getStores();
    // クーポン対象店舗のみを抽出（デフォルトは全店またはisCouponTarget: true）
    const targetStores = stores.filter(s => s.isCouponTarget !== false);
    const userCoupons = (window.questApi && window.questApi.userCoupons) || [];
    const alreadyClaimedStoreIds = new Set(userCoupons.map(c => c.store_id));

    // 未取得の利用可能店舗数
    const availableStores = targetStores.filter(s => !alreadyClaimedStoreIds.has(s.id));
    const maxSelect = tier.selectable_count || 1;
    const requiredCount = Math.min(maxSelect, availableStores.length);
    let selectedSet = new Set();

    if (requiredCount === 0) {
      alert('すべての対象店舗のクーポンを既に獲得済みです！');
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'rpg-modal-overlay';
    overlay.id = 'coupon-select-modal';

    const renderItems = () => {
      return targetStores.map(s => {
        const isAlreadyClaimed = alreadyClaimedStoreIds.has(s.id);
        const isChecked = selectedSet.has(s.id);
        const logoUrl = s.logoUrl || s.logo_url || '';

        const logoHtml = `
          <div class="coupon-select-item-logo-box">
            ${logoUrl ? `
              <img src="${logoUrl}" alt="${this.escapeHtml(s.name)}" class="coupon-select-item-logo-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
              <span class="coupon-select-item-logo-fallback" style="display:none;">🏪</span>
            ` : `
              <span class="coupon-select-item-logo-fallback">🏪</span>
            `}
          </div>
        `;

        if (isAlreadyClaimed) {
          return `
            <div class="coupon-select-item" style="opacity:0.5; cursor:not-allowed; background:rgba(0,0,0,0.3);">
              <input type="checkbox" disabled checked />
              ${logoHtml}
              <div class="coupon-select-item-info">
                <div class="coupon-select-item-name">${this.escapeHtml(s.name)} <span style="font-size:11px; color:var(--text-dim);">(${this.escapeHtml(s.area || '')})</span></div>
                <div class="coupon-select-item-desc text-green">取得済み</div>
              </div>
            </div>
          `;
        }

        return `
          <div class="coupon-select-item ${isChecked ? 'selected' : ''}" data-store-id="${s.id}">
            <input type="checkbox" ${isChecked ? 'checked' : ''} />
            ${logoHtml}
            <div class="coupon-select-item-info">
              <div class="coupon-select-item-name">${this.escapeHtml(s.name)} <span style="font-size:11px; color:var(--text-dim);">(${this.escapeHtml(s.area || '')})</span></div>
            </div>
          </div>
        `;
      }).join('');
    };

    overlay.innerHTML = `
      <div class="rpg-modal-window gold-border" style="max-width:440px; width:92%; max-height:85vh; display:flex; flex-direction:column;">
        <div class="rpg-window-header" style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:16px;">🎁 クーポンの酒場選択</span>
          <button id="modal-close-btn" style="background:none; border:none; color:#fff; font-size:20px; cursor:pointer;">✕</button>
        </div>
        <div style="padding:10px 0; font-size:14px; color:var(--text-yellow);">
          対象から <strong>${requiredCount} 軒</strong> 選択してください。<br>
          <span style="font-size:13px; color:var(--text-cyan);">選択中: <span id="select-counter" style="font-weight:bold; font-size:15px;">0</span> / ${requiredCount} 軒</span>
        </div>
        <div class="coupon-select-list" id="modal-stores-list">
          ${renderItems()}
        </div>
        <div style="margin-top:10px; display:flex; gap:8px;">
          <button id="modal-confirm-btn" class="staff-redeem-action-btn" style="background:linear-gradient(180deg,#1e824c 0%,#145a32 100%); border-color:var(--text-green); opacity:0.6; cursor:not-allowed;" disabled>
            あと ${requiredCount} 軒選択してください
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const updateCounterAndButton = () => {
      const counterEl = document.getElementById('select-counter');
      const confirmBtn = document.getElementById('modal-confirm-btn');
      if (counterEl) counterEl.textContent = selectedSet.size;
      if (confirmBtn) {
        const isReady = selectedSet.size === requiredCount;
        confirmBtn.disabled = !isReady;
        if (isReady) {
          confirmBtn.textContent = `選択した ${requiredCount} 軒のクーポンを獲得する！`;
          confirmBtn.style.opacity = '1';
          confirmBtn.style.cursor = 'pointer';
        } else {
          const remaining = requiredCount - selectedSet.size;
          confirmBtn.textContent = `あと ${remaining} 軒選択してください (計${requiredCount}軒)`;
          confirmBtn.style.opacity = '0.6';
          confirmBtn.style.cursor = 'not-allowed';
        }
      }
    };

    // アイテム選択ハンドリング
    overlay.querySelectorAll('.coupon-select-item[data-store-id]').forEach(item => {
      item.addEventListener('click', (e) => {
        const storeId = item.dataset.storeId;
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (selectedSet.has(storeId)) {
          selectedSet.delete(storeId);
          item.classList.remove('selected');
          if (checkbox) checkbox.checked = false;
        } else {
          if (selectedSet.size >= requiredCount) {
            alert(`この特典で選択できるのは ${requiredCount} 軒です。変更したい場合は選択済みのチェックを外してください。`);
            return;
          }
          selectedSet.add(storeId);
          item.classList.add('selected');
          if (checkbox) checkbox.checked = true;
        }
        this.playSelectSE();
        updateCounterAndButton();
      });
    });

    // 閉じるボタン
    document.getElementById('modal-close-btn').addEventListener('click', () => {
      this.playBackSE();
      overlay.remove();
    });

    // 確定ボタン
    document.getElementById('modal-confirm-btn').addEventListener('click', async () => {
      if (selectedSet.size !== requiredCount) {
        alert(`${requiredCount} 軒すべて選択してください。`);
        return;
      }
      this.playFanfareSE();
      const storeIds = Array.from(selectedSet);
      const res = await window.questApi.claimCoupons(tier.id, storeIds);
      overlay.remove();
      if (res.success) {
        alert(`🎉 ${storeIds.length}軒のクーポンを獲得しました！所持クーポン一覧からいつでも利用できます。`);
        this.render();
      } else {
        alert(res.message || 'クーポンの獲得に失敗しました。');
      }
    });
  }

  /* ------------------------------------------------------------------------
   * クーポン消し込みモーダル (店舗スタッフ専用)
   * ------------------------------------------------------------------------ */
  openRedeemModal(coupon) {
    const isGoods = coupon.reward_type === 'goods';
    const storeName = isGoods ? (coupon.goods_name || coupon.title) : (coupon.stores?.name || coupon.store_id);
    const isUsed = coupon.status === 'used';

    const overlay = document.createElement('div');
    overlay.className = 'rpg-modal-overlay';
    overlay.id = 'coupon-redeem-modal';

    let contentHtml = '';
    if (isGoods) {
      contentHtml = `
        <div class="staff-redeem-box" style="padding: 12px 6px;">
          <div style="font-size: 20px; font-weight: bold; color: var(--text-yellow); margin: 8px 0 12px;">
            🎁 ${this.escapeHtml(coupon.goods_name || coupon.title)}
          </div>
          <div style="font-size: 13px; color: var(--text-cyan); margin-bottom: 12px; background: rgba(0,0,0,0.4); padding: 8px 12px; border-radius: 6px;">
            📍 <strong>引換場所:</strong> ${this.escapeHtml(coupon.exchange_location || '全参加酒場または運営本部')}
          </div>
          ${coupon.exchange_notice ? `
            <div style="font-size: 13px; color: #fde68a; margin-bottom: 14px; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 6px; text-align: left; line-height: 1.5;">
              ℹ️ ${this.escapeHtml(coupon.exchange_notice)}
            </div>
          ` : ''}

          ${isUsed ? `
            <div style="padding: 16px; border: 2px solid #666; border-radius: 8px; background: #111; margin-top: 10px;">
              <div class="coupon-used-stamp" style="position: static; transform: none; display: inline-block; margin-bottom: 8px; font-size: 16px;">USED / 受取済み</div>
              <div style="font-size: 13px; color: #94a3b8;">受取日時: ${new Date(coupon.used_at).toLocaleString()}</div>
            </div>
          ` : `
            <div class="staff-warning-banner" style="font-size: 14px; line-height: 1.5; padding: 10px 12px; margin-bottom: 16px;">
              ⚠️ <strong>【酒場スタッフ専用】</strong><br>
              記念品お渡し時にご提示の上、受取完了ボタンを押してください。
            </div>
            <button id="btn-staff-redeem" class="staff-redeem-action-btn" style="background: linear-gradient(180deg, #d97706 0%, #b45309 100%); border-color: #f59e0b; padding: 14px; font-size: 17px; font-weight:bold;">
              🎁 【スタッフ確認】受取完了にする
            </button>
          `}
        </div>
      `;
    } else {
      contentHtml = `
        <div class="staff-redeem-box" style="padding: 12px 6px;">
          <div style="font-size: 24px; font-weight: bold; color: var(--text-yellow); margin: 6px 0 14px; line-height: 1.3;">
            🏮 ${storeName}
          </div>
          
          <div style="background: #0f152b; border: 2px dashed var(--border-gold); padding: 16px 12px; border-radius: 8px; margin-bottom: 16px; text-align: center;">
            <div style="font-size: 14px; color: var(--text-cyan); margin-bottom: 6px; font-weight: bold;">【特典チケット】</div>
            <div style="font-size: 20px; font-weight: bold; color: #fff; line-height: 1.4;">🍺 ハシゴ達成・酒場特典チケット</div>
          </div>

          ${isUsed ? `
            <div style="padding: 16px; border: 2px solid #666; border-radius: 8px; background: #111; margin-top: 10px;">
              <div class="coupon-used-stamp" style="position: static; transform: none; display: inline-block; margin-bottom: 8px; font-size: 16px;">USED / 使用済み</div>
              <div style="font-size: 13px; color: #94a3b8;">利用日時: ${new Date(coupon.used_at).toLocaleString()}</div>
            </div>
          ` : (window.questApi?.currentSeason?.statusInfo?.isExpired ? `
            <div style="padding: 16px; border: 1px solid #ef4444; border-radius: 8px; background: #450a0a; color: #fca5a5; font-size: 14px; text-align: center; line-height: 1.5;">
              🔒 <strong>利用期限終了</strong><br>
              クーポンの利用期限は終了いたしました。
            </div>
          ` : (!window.questApi?.currentSeason?.statusInfo?.isCouponUsable ? `
            <div style="padding: 16px 12px; border: 1px solid #f59e0b; border-radius: 8px; background: rgba(245,158,11,0.15); color: #fde68a; font-size: 14px; text-align: center; line-height: 1.6;">
              🔒 <strong>後夜祭期間にご利用いただけます</strong><br>
              <strong style="color: var(--text-yellow); font-size: 17px; display: block; margin: 8px 0;">📅 ${window.questApi?.currentSeason?.statusInfo?.couponStartDateStr || '翌日'} 〜 ${window.questApi?.currentSeason?.coupon_valid_until || ''}</strong>
            </div>
          ` : `
            <div class="staff-warning-banner" style="font-size: 14px; line-height: 1.5; padding: 10px 12px; margin-bottom: 16px;">
              ⚠️ <strong>【酒場スタッフ専用】</strong><br>
              お会計時にご提示の上、下のボタンを押してください。
            </div>
            <button id="btn-staff-redeem" class="staff-redeem-action-btn" style="padding: 14px; font-size: 17px; font-weight:bold;">
              🍺 【スタッフ確認】使用済みにする
            </button>
          `))}
        </div>
      `;
    }

    overlay.innerHTML = `
      <div class="rpg-modal-window gold-border" style="max-width: 480px; width: 95%; max-height: 92vh; overflow-y: auto;">
        <div class="rpg-window-header" style="display:flex; justify-content:space-between; align-items:center; padding: 8px 14px;">
          <span style="font-size: 16px;">${isGoods ? '🎁 記念品・グッズ引換画面' : '🎟️ クーポン提示画面'}</span>
          <button id="redeem-close-btn" style="background:none; border:none; color:#fff; font-size:22px; cursor:pointer; padding: 0 4px;">✕</button>
        </div>
        ${contentHtml}
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('redeem-close-btn').addEventListener('click', () => {
      this.playBackSE();
      overlay.remove();
    });

    const redeemBtn = document.getElementById('btn-staff-redeem');
    if (redeemBtn) {
      redeemBtn.addEventListener('click', async () => {
        const confirmMsg = isGoods ? 
          `【酒場・運営スタッフ確認】\n「${storeName}」を受取済みにしますか？\n（受取後は元に戻せません）` : 
          `【酒場スタッフ確認】\n「${storeName}」のクーポンを使用済みにしますか？`;

        if (!confirm(confirmMsg)) {
          return;
        }
        this.playFanfareSE();
        redeemBtn.disabled = true;
        redeemBtn.textContent = '消し込み中...';
        const res = await window.questApi.redeemCoupon(coupon.id);
        overlay.remove();
        if (res.success) {
          alert(isGoods ? `✅ 「${storeName}」の受取が完了しました！` : `✅ クーポンを「使用済み」に更新しました！ご来店ありがとうございます。`);
          this.render();
        } else {
          alert(res.message || '消し込みに失敗しました。');
        }
      });
    }
  }

  /* ------------------------------------------------------------------------
   * アプリ内蔵 QRコードスキャナーモーダル
   * ------------------------------------------------------------------------ */
  openQrScannerModal() {
    this.playSelectSE();

    // 既存モーダルがあれば削除
    const existingModal = document.getElementById('qr-scanner-modal');
    if (existingModal) existingModal.remove();

    const overlay = document.createElement('div');
    overlay.className = 'rpg-modal-overlay';
    overlay.id = 'qr-scanner-modal';

    overlay.innerHTML = `
      <div class="rpg-modal-window gold-border" style="max-width:380px; width:92%; text-align:center;">
        <div class="rpg-window-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <span style="font-size:16px;">📷 酒場QRコード読取</span>
          <button id="qr-modal-close-btn" style="background:none; border:none; color:#fff; font-size:20px; cursor:pointer;">✕</button>
        </div>

        <div style="font-size:14px; color:var(--text-yellow); margin-bottom:8px; font-weight:bold;">
          📷 卓上POPのQRコードを読み取ろう！
        </div>

        <div class="qr-scanner-box" id="qr-scanner-view-box">
          <div id="qr-reader"></div>
          <div class="qr-scanner-reticle"></div>
        </div>

        <div id="qr-scanner-status-text" style="font-size:13px; color:#e2e8f0; margin-bottom:10px; min-height:16px;">
          カメラを起動中...
        </div>

        <div style="display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; gap:6px;">
            <button id="qr-modal-test-5btn" class="command-button" style="flex:1; background: rgba(217, 119, 6, 0.25); border: 1px dashed #f59e0b; color: #fbbf24; font-size: 12px; padding: 8px 4px; border-radius: 4px; cursor: pointer; font-weight: bold;">
              🧪 +5酒場サイン
            </button>
            <button id="qr-modal-test-10btn" class="command-button" style="flex:1; background: rgba(217, 119, 6, 0.25); border: 1px dashed #f59e0b; color: #fbbf24; font-size: 12px; padding: 8px 4px; border-radius: 4px; cursor: pointer; font-weight: bold;">
              🧪 +10酒場サイン
            </button>
            <button id="qr-modal-test-15btn" class="command-button" style="flex:1; background: rgba(217, 119, 6, 0.25); border: 1px dashed #f59e0b; color: #fbbf24; font-size: 12px; padding: 8px 4px; border-radius: 4px; cursor: pointer; font-weight: bold;">
              🧪 +15酒場サイン
            </button>
          </div>
          <button id="qr-modal-cancel-btn" class="treasure-claim-btn" style="background:#333; border-color:#888; padding:8px; font-size:13px;">
            ✕ キャンセル
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    let html5QrCode = null;
    let isScanned = false;

    const stopCamera = async () => {
      if (html5QrCode) {
        try {
          if (html5QrCode.isScanning) {
            await html5QrCode.stop();
          }
          await html5QrCode.clear();
        } catch (err) {
          console.warn('QRスキャナー停止時エラー:', err);
        }
        html5QrCode = null;
      }
    };

    const closeModal = async () => {
      this.playBackSE();
      await stopCamera();
      overlay.remove();
    };

    document.getElementById('qr-modal-close-btn').addEventListener('click', closeModal);
    document.getElementById('qr-modal-cancel-btn').addEventListener('click', closeModal);

    const handleQrTest = async (count) => {
      if (!confirm(`【テスト実行】新たに【${count}酒場】の酒場サインを記録しますか？`)) return;
      this.playFanfareSE();
      const res = await window.questApi.recordMultipleVisitsForTest(count);
      await closeModal();
      if (res.success) {
        alert(`🎉【テスト成功】新たに${res.count}酒場の酒場サインを記録しました！（合計: ${res.totalVisits}軒）\n冒険の書から特典宝箱をご確認ください！`);
        this.render('quest-book');
      } else {
        alert(res.message || 'テストサイン記録に失敗しました。');
      }
    };

    const q5 = document.getElementById('qr-modal-test-5btn');
    if (q5) q5.addEventListener('click', () => handleQrTest(5));
    const q10 = document.getElementById('qr-modal-test-10btn');
    if (q10) q10.addEventListener('click', () => handleQrTest(10));
    const q15 = document.getElementById('qr-modal-test-15btn');
    if (q15) q15.addEventListener('click', () => handleQrTest(15));

    // スキャナーの初期化
    const initScanner = async () => {
      const statusEl = document.getElementById('qr-scanner-status-text');
      if (typeof Html5Qrcode === 'undefined') {
        if (statusEl) statusEl.textContent = '❌ スキャナーライブラリをロードできませんでした';
        return;
      }

      try {
        html5QrCode = new Html5Qrcode('qr-reader');
        const config = {
          fps: 10,
          qrbox: { width: 200, height: 200 },
          aspectRatio: 1.0
        };

        const onScanSuccess = async (decodedText) => {
          if (isScanned) return;
          isScanned = true;

          this.playSelectSE();

          let storeId = null;
          if (decodedText.startsWith('store-')) {
            storeId = decodedText;
          } else {
            try {
              const url = new URL(decodedText);
              storeId = url.searchParams.get('checkin') || url.searchParams.get('store');
            } catch (e) {
              const match = decodedText.match(/[?&](?:checkin|store)=([^&#]+)/);
              if (match) storeId = decodeURIComponent(match[1]);
            }
          }

          await stopCamera();
          overlay.remove();

          if (storeId) {
            await this.handleCheckin(storeId);
          } else {
            alert(`読み取ったQRコードの内容: ${decodedText}\n有効な酒場サイン受取用QRコードではありません。`);
          }
        };

        // 背面カメラ(facingMode: "environment")を優先起動
        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          onScanSuccess,
          () => {} // フレーム毎のエラーは無視
        );

        if (statusEl) statusEl.textContent = '🔍 QRコードをスキャンしています...';
      } catch (err) {
        console.warn('カメラ起動エラー:', err);
        if (statusEl) {
          statusEl.innerHTML = `<span style="color:#ff6b6b;">⚠️ カメラへのアクセスが許可されていないか、利用できません。</span>`;
        }
      }
    };

    // DOM描画完了後にスキャナー初期化
    setTimeout(initScanner, 200);
  }

  /* ------------------------------------------------------------------------
   * 酒場サイン受取・冒険の書への記録処理 (QRコード読み取り時)
   * ------------------------------------------------------------------------ */
  async handleCheckin(storeId) {
    if (!storeId) return;
    const res = await window.questApi.recordVisit(storeId);
    if (res.success) {
      this.playFanfareSE();
      this.showCheckinSuccessModal(res);
      this.navigateTo('quest-book');
    } else if (res.alreadyVisited) {
      this.playCursorSE();
      this.showAlreadyVisitedModal(res);
      this.navigateTo('quest-book');
    } else {
      alert(res.message || '冒険の書への記録に失敗しました。');
    }
  }

  /* ------------------------------------------------------------------------
   * 酒場サイン受取・記録完了モーダル (RPG達成演出)
   * ------------------------------------------------------------------------ */
  showCheckinSuccessModal(res) {
    const overlay = document.createElement('div');
    overlay.className = 'rpg-modal-overlay';
    overlay.id = 'checkin-success-modal';

    const stores = this.getStores();
    const store = stores.find(s => s.id === res.storeId);
    const storeName = res.storeName || (store ? store.name : res.storeId);
    const storeArea = store ? store.area : '';

    const rewardTiers = window.questApi?.rewardTiers || [];
    const unlockedTier = rewardTiers.find(t => t.required_visits === res.totalVisits);

    overlay.innerHTML = `
      <div class="rpg-modal-window gold-border" style="max-width:380px; width:90%; text-align:center;">
        <div style="font-size:36px; margin-bottom:6px;">⚔️🍺✨</div>
        <div style="font-size:13px; color:var(--text-cyan); font-weight:bold;">【冒険の書 記録完了】</div>
        <h3 style="color:var(--text-yellow); margin:6px 0 10px 0; font-size:18px;">
          『${this.escapeHtml ? this.escapeHtml(storeName) : storeName}』
        </h3>
        ${storeArea ? `<div style="font-size:12px; color:#cbd5e1; margin-bottom:8px;">エリア: ${storeArea}</div>` : ''}

        <div style="background:#0f152b; border:1px solid #33406b; border-radius:6px; padding:10px; margin-bottom:12px;">
          <div style="font-size:14px; color:#fff; font-weight:bold;">
            🏆 現在の制覇数: <span style="color:var(--text-green); font-size:18px;">${res.totalVisits} 軒</span>
          </div>
        </div>

        ${unlockedTier ? `
          <div style="background:linear-gradient(135deg, #78350f 0%, #451a03 100%); border:2px solid var(--border-gold); border-radius:6px; padding:12px; margin-bottom:14px; animation:pulseGold 1.5s infinite;">
            <div style="font-size:18px; margin-bottom:4px;">🎁✨</div>
            <div style="font-size:15px; font-weight:bold; color:var(--text-yellow);">
              【${this.escapeHtml ? this.escapeHtml(unlockedTier.title) : unlockedTier.title}】解放！
            </div>
            <div style="font-size:13px; color:#fed7aa; margin-top:4px;">
              ${unlockedTier.reward_type === 'goods' ? 
                `🎁 記念品・グッズ引換券（${this.escapeHtml(unlockedTier.goods_name || unlockedTier.title)}）を獲得できます！` : 
                `対象酒場からお好きなクーポンを ${unlockedTier.selectable_count} 軒獲得できます！`
              }
            </div>
          </div>
        ` : ''}

        <button id="btn-close-checkin-modal" class="treasure-claim-btn" style="width:100%; font-size:14px; padding:10px;">
          📜 冒険の書を確認する ▶
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('btn-close-checkin-modal').addEventListener('click', () => {
      this.playSelectSE();
      overlay.remove();
    });
  }

  /* ------------------------------------------------------------------------
   * 重複チェックイン案内モーダル (同一酒場はシーズン中1回のみ)
   * ------------------------------------------------------------------------ */
  showAlreadyVisitedModal(res) {
    const overlay = document.createElement('div');
    overlay.className = 'rpg-modal-overlay';
    overlay.id = 'already-visited-modal';

    const stores = this.getStores();
    const store = stores.find(s => s.id === res.storeId);
    const storeName = store ? store.name : res.storeId;

    overlay.innerHTML = `
      <div class="rpg-modal-window" style="max-width:360px; width:90%; text-align:center;">
        <div style="font-size:32px; margin-bottom:6px;">📜✅</div>
        <h3 style="color:var(--text-yellow); margin:6px 0 10px 0; font-size:16px;">
          すでに冒険済みの酒場です
        </h3>
        <p style="font-size:14px; color:#e2e8f0; line-height:1.6; margin-bottom:14px;">
          『<strong>${this.escapeHtml ? this.escapeHtml(storeName) : storeName}</strong>』は<br>
          今シーズンすでに冒険の書に記録されています。<br>
          <span style="font-size:12px; color:#94a3b8;">※ハシゴ制覇カウントは1酒場につき1回となります</span>
        </p>
        <button id="btn-close-already-modal" class="treasure-claim-btn" style="width:100%; font-size:13px; padding:8px; background:#334155; border-color:#64748b;">
          OK (冒険を続ける)
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('btn-close-already-modal').addEventListener('click', () => {
      this.playSelectSE();
      overlay.remove();
    });
  }

  /* ------------------------------------------------------------------------
   * 3.2 エリア一覧
   * ------------------------------------------------------------------------ */
  renderAreaView(container) {
    this.typeMessage('探したいエリアを選択してください。');

    const stores = this.getStores();
    const areas = this.getAreas();
    const areaItems = areas.map(area => {
      const count = stores.filter(s => s.area === area).length;
      return `
        <li class="command-item" data-area="${area}">
          <div class="command-item-left">
            <span class="command-cursor">▶</span>
            <span class="command-label">${area}</span>
          </div>
          <span class="command-badge">${count}軒</span>
        </li>
      `;
    }).join('');

    container.innerHTML = `
      <div class="rpg-window">
        <div class="rpg-window-header">
          <span>▶ エリア選択</span>
          <span class="header-badge">エリア</span>
        </div>
        <ul class="command-list">
          ${areaItems}
        </ul>
      </div>
    `;

    container.querySelectorAll('.command-item').forEach(item => {
      item.addEventListener('mouseenter', () => this.playCursorSE());
      item.addEventListener('click', () => {
        this.playSelectSE();
        this.resetFilters();
        this.filters.area = item.dataset.area;
        this.navigateTo('stores');
      });
    });
  }

  /* ------------------------------------------------------------------------
   * 3.3 酒場の種類一覧
   * ------------------------------------------------------------------------ */
  renderCategoryView(container) {
    this.typeMessage('探したい酒場のジャンルを選択してください。');

    const stores = this.getStores();
    const categories = this.getCategories();
    const categoryItems = categories.map(cat => {
      const count = stores.filter(s => s.category === cat).length;
      return `
        <li class="command-item" data-category="${cat}">
          <div class="command-item-left">
            <span class="command-cursor">▶</span>
            <span class="command-label">${cat}</span>
          </div>
          <span class="command-badge">${count}軒</span>
        </li>
      `;
    }).join('');

    container.innerHTML = `
      <div class="rpg-window">
        <div class="rpg-window-header">
          <span>▶ 酒場の種類</span>
          <span class="header-badge">ジャンル</span>
        </div>
        <ul class="command-list">
          ${categoryItems}
        </ul>
      </div>
    `;

    container.querySelectorAll('.command-item').forEach(item => {
      item.addEventListener('mouseenter', () => this.playCursorSE());
      item.addEventListener('click', () => {
        this.playSelectSE();
        this.resetFilters();
        this.filters.category = item.dataset.category;
        this.navigateTo('stores');
      });
    });
  }

  /* ------------------------------------------------------------------------
   * 3.4 スタイル一覧
   * ------------------------------------------------------------------------ */
  renderStyleView(container) {
    this.typeMessage('席のスタイルを選択してください。');

    const stores = this.getStores();
    const styles = this.getStyles();
    const styleItems = styles.map(style => {
      const count = stores.filter(s => s.style === style).length;
      return `
        <li class="command-item" data-style="${style}">
          <div class="command-item-left">
            <span class="command-cursor">▶</span>
            <span class="command-label">${style}</span>
          </div>
          <span class="command-badge">${count}軒</span>
        </li>
      `;
    }).join('');

    container.innerHTML = `
      <div class="rpg-window">
        <div class="rpg-window-header">
          <span>▶ 席スタイル</span>
          <span class="header-badge">スタイル</span>
        </div>
        <ul class="command-list">
          ${styleItems}
        </ul>
      </div>
    `;

    container.querySelectorAll('.command-item').forEach(item => {
      item.addEventListener('mouseenter', () => this.playCursorSE());
      item.addEventListener('click', () => {
        this.playSelectSE();
        this.resetFilters();
        this.filters.style = item.dataset.style;
        this.navigateTo('stores');
      });
    });
  }

  /* ------------------------------------------------------------------------
   * 3.5 酔いどれタイプ一覧
   * ------------------------------------------------------------------------ */
  renderTypeView(container) {
    this.typeMessage('気分に合わせた呑み方タイプを選択してください。');

    const stores = this.getStores();
    const types = this.getTypes();
    const typeItems = types.map(type => {
      const count = stores.filter(s => s.type === type).length;
      return `
        <li class="command-item" data-type="${type}">
          <div class="command-item-left">
            <span class="command-cursor">▶</span>
            <span class="command-label">${type}</span>
          </div>
          <span class="command-badge">${count}軒</span>
        </li>
      `;
    }).join('');

    container.innerHTML = `
      <div class="rpg-window">
        <div class="rpg-window-header">
          <span>▶ 酔いどれタイプ</span>
          <span class="header-badge">タイプ</span>
        </div>
        <ul class="command-list">
          ${typeItems}
        </ul>
      </div>
    `;

    container.querySelectorAll('.command-item').forEach(item => {
      item.addEventListener('mouseenter', () => this.playCursorSE());
      item.addEventListener('click', () => {
        this.playSelectSE();
        this.resetFilters();
        this.filters.type = item.dataset.type;
        this.navigateTo('stores');
      });
    });
  }

  /* ------------------------------------------------------------------------
   * 3.7 店舗一覧 (カード形式 & フィルター)
   * ------------------------------------------------------------------------ */
  renderStoresView(container) {
    const isFiltered = this.filters.area !== 'ALL' || 
                       this.filters.category !== 'ALL' || 
                       this.filters.style !== 'ALL' || 
                       this.filters.type !== 'ALL' || 
                       this.filters.takeout !== 'ALL' || 
                       this.filters.openToday || 
                       this.filters.searchQuery !== '';

    const areasList = this.getAreas();
    const areaOptions = ['ALL', ...areasList].map(a => 
      `<option value="${a}" ${this.filters.area === a ? 'selected' : ''}>${a === 'ALL' ? '全エリア' : a}</option>`
    ).join('');

    const categoriesList = this.getCategories();
    const catOptions = ['ALL', ...categoriesList].map(c => 
      `<option value="${c}" ${this.filters.category === c ? 'selected' : ''}>${c === 'ALL' ? '全種類' : c}</option>`
    ).join('');

    const stylesList = this.getStyles();
    const styleOptions = ['ALL', ...stylesList].map(s => 
      `<option value="${s}" ${this.filters.style === s ? 'selected' : ''}>${s === 'ALL' ? '全スタイル' : s}</option>`
    ).join('');

    const typesList = this.getTypes();
    const OFFICIAL_TYPE_NAMES = ['サク飲み', '腹ごしらえ', 'ひと休み', '夜遊び'];
    const allTypes = Array.from(new Set([...OFFICIAL_TYPE_NAMES, ...typesList]));
    const typeOptions = ['ALL', ...allTypes].map(t => 
      `<option value="${t}" ${this.filters.type === t ? 'selected' : ''}>${t === 'ALL' ? '全酔いどれタイプ' : t}</option>`
    ).join('');

    container.innerHTML = `
      <div class="rpg-window" id="store-filter-window">
        <div class="rpg-window-header">
          <span>▶ 絞り込み条件</span>
          <div class="filter-header-action">
            <button id="btn-reset-filters" class="filter-reset-btn ${isFiltered ? '' : 'hidden'}" type="button">✖ 条件クリア</button>
          </div>
        </div>
        <div class="filter-box">
          <div class="filter-row">
            <select id="filter-area" class="filter-select">${areaOptions}</select>
            <select id="filter-category" class="filter-select">${catOptions}</select>
          </div>
          <div class="filter-row">
            <select id="filter-style" class="filter-select">${styleOptions}</select>
            <select id="filter-type" class="filter-select">${typeOptions}</select>
          </div>
          <div class="filter-row">
            <input type="text" id="filter-search" class="search-input" placeholder="酒場名・キーワード検索..." value="${this.filters.searchQuery}">
          </div>
          <div class="filter-chip-group">
            <div class="filter-chip ${this.filters.openToday ? 'active' : ''}" id="chip-open-today">
              ${this.filters.openToday ? '✓ どれクエ対応中のみ' : 'どれクエ対象時間内のみ'}
            </div>
            <div class="filter-chip ${this.filters.takeout === 'YES' ? 'active' : ''}" id="chip-takeout">
              ${this.filters.takeout === 'YES' ? '✓ テイクアウト可のみ' : 'テイクアウト可のみ'}
            </div>
          </div>
        </div>
      </div>

      <div id="stores-card-list-container" class="store-card-list">
        <!-- JSで動的レンダリング -->
      </div>
    `;

    // 店舗カード一覧の部分更新関数（入力欄などのDOMを破棄しない）
    const updateStoreList = () => {
      let filtered = this.getStores().filter(store => {
        if (this.filters.area !== 'ALL' && store.area !== this.filters.area) return false;
        if (this.filters.category !== 'ALL' && store.category !== this.filters.category) return false;
        if (this.filters.style !== 'ALL' && store.style !== this.filters.style) return false;
        if (this.filters.type !== 'ALL' && store.type !== this.filters.type) return false;
        if (this.filters.takeout === 'YES' && !store.isTakeout) return false;
        if (this.filters.openToday && !store.isOpenToday) return false;
        if (this.filters.searchQuery) {
          const q = this.filters.searchQuery.toLowerCase().trim();
          return store.name.toLowerCase().includes(q) || 
                 store.catchphrase.toLowerCase().includes(q);
        }
        return true;
      });

      filtered.sort((a, b) => a.id.localeCompare(b.id, 'ja', { numeric: true }));

      this.typeMessage(`条件に一致する酒場が ${filtered.length} 軒見つかりました。`);

      const cardsHtml = filtered.length > 0 ? filtered.map(store => {
        const isVisited = window.questApi && window.questApi.visits.some(v => v.store_id === store.id);
        const isCoupon = Boolean(store.isCouponTarget);
        return `
        <div class="store-card ${isVisited ? 'visited' : ''}" data-id="${store.id}">
          <div class="store-card-top-flex">
            <div class="store-card-info-block">
              <div class="store-card-header-row">
                <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                  ${isVisited ? `<span class="tag" style="background:#155724; color:#d4edda; border-color:#28a745;">✅ 冒険済</span>` : ''}
                  ${isCoupon ? `<span class="tag" style="background:#4d3800; color:#ffeeba; border-color:#ffc107;">🎁 特典対象</span>` : ''}
                  ${store.area ? `<span class="tag tag-area">${store.area}</span>` : ''}
                  ${store.category ? `<span class="tag">${store.category}</span>` : ''}
                  ${store.style ? `<span class="tag tag-style">${store.style}</span>` : ''}
                  ${store.type ? `<span class="tag tag-type">${store.type}</span>` : ''}
                  ${store.isTakeout ? `<span class="tag tag-takeout">${store.takeout}</span>` : ''}
                </div>
                <span class="store-status-badge ${store.isOpenToday ? 'status-open' : 'status-closed'}">
                  ${store.isOpenToday ? 'どれクエ対応中' : 'どれクエ対象時間外'}
                </span>
              </div>

              <div class="store-name" style="margin-top:6px;">
                <span>${store.name}</span>
              </div>
            </div>

            ${(store.logoUrl || store.logo_url) ? `
              <div class="store-card-logo-box">
                <img src="${store.logoUrl || store.logo_url}" alt="${store.name}のロゴ" class="store-card-logo-img" onerror="this.closest('.store-card-logo-box').style.display='none';">
              </div>
            ` : ''}
          </div>

          <div class="store-previews">
            ${store.yoidoreSet && store.yoidoreSet.title ? `
              <div class="store-set-preview">
                <div class="preview-header">
                  <span class="preview-label">🍺 酔いどれセット:</span>
                  ${store.yoidoreSet.price > 0 ? `
                    <span class="store-price">
                      ¥${store.yoidoreSet.price.toLocaleString()}
                      <span style="font-size:11px; color:var(--text-dim); font-weight:normal; margin-left:3px;">(税込${store.yoidoreSet.charge === '込' ? '・チャージ料込' : ''})</span>
                    </span>
                  ` : ''}
                </div>
                <div class="preview-title">${store.yoidoreSet.title}</div>
              </div>
            ` : ''}

            ${store.isQuestActive ? `
              <div class="store-quest-preview">
                <div class="preview-header">
                  <span class="preview-label">⚔️ クエスト:</span>
                  ${store.quest.price > 0 ? `
                    <span class="store-price">
                      ¥${store.quest.price.toLocaleString()}
                      <span style="font-size:11px; color:var(--text-dim); font-weight:normal; margin-left:3px;">(税込${store.quest.charge === '込' ? '・チャージ料込' : ''})</span>
                    </span>
                  ` : `
                    <span style="font-size:14px; color:#00ffaa; font-weight:bold;">
                      🟢 無料
                      ${store.quest.charge === '込' ? `<span style="font-size:11px; color:var(--text-dim); font-weight:normal; margin-left:3px;">(チャージ料込)</span>` : ''}
                    </span>
                  `}
                </div>
                <div class="preview-title">${store.quest.title || store.quest.content}</div>
              </div>
            ` : ''}
          </div>
        </div>
        `;
      }).join('') : `
        <div class="rpg-window text-center" style="padding: 20px; color: var(--text-dim);">
          条件に一致する酒場が見つかりませんでした。<br>フィルターを変更してください。
        </div>
      `;

      const listContainer = document.getElementById('stores-card-list-container');
      if (listContainer) {
        listContainer.innerHTML = cardsHtml;

        listContainer.querySelectorAll('.store-card').forEach(card => {
          card.addEventListener('mouseenter', () => this.playCursorSE());
          card.addEventListener('click', () => {
            this.playSelectSE();
            const storeId = card.dataset.id;
            const store = this.getStores().find(s => s.id === storeId);
            if (store) {
              this.navigateTo('detail', { store });
            }
          });
        });
      }

      // 条件クリアボタンの表示制御
      const currentFiltered = this.filters.area !== 'ALL' || 
                              this.filters.category !== 'ALL' || 
                              this.filters.style !== 'ALL' || 
                              this.filters.type !== 'ALL' || 
                              this.filters.takeout !== 'ALL' || 
                              this.filters.openToday || 
                              Boolean(this.filters.searchQuery && this.filters.searchQuery.trim());
      const resetBtnElem = document.getElementById('btn-reset-filters');
      if (resetBtnElem) {
        resetBtnElem.classList.toggle('hidden', !currentFiltered);
      }

      this.updateStickyFilterBar();
      this.updateHistoryFilters();
    };

    // 初回レンダリング
    updateStoreList();

    // 条件リセットボタン
    const resetBtn = document.getElementById('btn-reset-filters');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.playSelectSE();
        this.resetFilters();
        this.renderStoresView(container);
      });
    }

    // ドロップダウン選択チェンジイベント
    const onFilterChange = () => {
      this.playSelectSE();
      this.filters.area = document.getElementById('filter-area').value;
      this.filters.category = document.getElementById('filter-category').value;
      this.filters.style = document.getElementById('filter-style').value;
      this.filters.type = document.getElementById('filter-type').value;
      this.lastStoresScrollY = 0;
      updateStoreList();
    };

    document.getElementById('filter-area').addEventListener('change', onFilterChange);
    document.getElementById('filter-category').addEventListener('change', onFilterChange);
    document.getElementById('filter-style').addEventListener('change', onFilterChange);
    document.getElementById('filter-type').addEventListener('change', onFilterChange);

    // キーワード検索（IME日本語入力変換対応）
    const searchInput = document.getElementById('filter-search');
    let isComposing = false;

    searchInput.addEventListener('compositionstart', () => {
      isComposing = true;
    });

    searchInput.addEventListener('compositionend', (e) => {
      isComposing = false;
      this.filters.searchQuery = e.target.value;
      this.lastStoresScrollY = 0;
      updateStoreList();
    });

    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      this.filters.searchQuery = e.target.value;
      if (isComposing) return; // 日本語入力・漢字変換中はリアルタイム検索によるカード更新をスキップ
      
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.lastStoresScrollY = 0;
        updateStoreList();
      }, 250);
    });

    // 今日営業のみチップ
    document.getElementById('chip-open-today').addEventListener('click', () => {
      this.playSelectSE();
      this.filters.openToday = !this.filters.openToday;
      const chip = document.getElementById('chip-open-today');
      if (chip) {
        chip.classList.toggle('active', this.filters.openToday);
        chip.textContent = this.filters.openToday ? '✓ どれクエ対応中のみ' : 'どれクエ対象時間内のみ';
      }
      this.lastStoresScrollY = 0;
      updateStoreList();
    });

    // テイクアウト可のみチップ
    document.getElementById('chip-takeout').addEventListener('click', () => {
      this.playSelectSE();
      this.filters.takeout = (this.filters.takeout === 'YES') ? 'ALL' : 'YES';
      const chip = document.getElementById('chip-takeout');
      if (chip) {
        chip.classList.toggle('active', this.filters.takeout === 'YES');
        chip.textContent = (this.filters.takeout === 'YES') ? '✓ テイクアウト可のみ' : 'テイクアウト可のみ';
      }
      this.lastStoresScrollY = 0;
      updateStoreList();
    });
  }

  /* ------------------------------------------------------------------------
   * 3.8 酒場詳細
   * ------------------------------------------------------------------------ */
  renderDetailView(container) {
    const store = this.selectedStore;
    if (!store) {
      this.navigateTo('stores');
      return;
    }

    // 最新日時に基づき「どれクエ対応中」フラグを動的再計算
    store.isOpenToday = checkIsOpenToday(store);

    this.typeMessage(`「${store.name}」の情報です。`);

    const paymentTagsHtml = (store.paymentMethods && store.paymentMethods.length > 0)
      ? store.paymentMethods.map(p => `<span class="payment-tag">${p}</span>`).join('')
      : '';

    const visitRecord = window.questApi && window.questApi.visits.find(v => v.store_id === store.id);
    const isVisited = Boolean(visitRecord);
    const visitedDateStr = visitRecord?.visited_at ? new Date(visitRecord.visited_at).toLocaleString('ja-JP') : '';
    const isCouponTarget = Boolean(store.isCouponTarget);

    container.innerHTML = `
      <div class="detail-section">
        <!-- 1. 酒場基本情報枠 -->
        <div class="rpg-window gold-border">
          <div class="detail-header-flex">
            <div class="detail-title-block">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
                <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                  ${isVisited ? `<span class="tag" style="background:#155724; color:#d4edda; border-color:#28a745;">✅ 冒険済</span>` : ''}
                  ${isCouponTarget ? `<span class="tag" style="background:#4d3800; color:#ffeeba; border-color:#ffc107;">🎁 特典対象</span>` : ''}
                  ${store.area ? `<span class="tag tag-area">${store.area}</span>` : ''}
                  ${store.category ? `<span class="tag">${store.category}</span>` : ''}
                  ${store.style ? `<span class="tag tag-style">${store.style}</span>` : ''}
                  ${store.type ? `<span class="tag tag-type">${store.type}</span>` : ''}
                  ${store.isTakeout ? `<span class="tag tag-takeout">${store.takeout}</span>` : ''}
                </div>
                <span class="store-status-badge ${store.isOpenToday ? 'status-open' : 'status-closed'}">
                  ${store.isOpenToday ? 'どれクエ対応中' : 'どれクエ対象時間外'}
                </span>
              </div>
              <h2 class="detail-store-name" style="margin-top:8px;">${store.name}</h2>
              ${store.catchphrase ? `<div class="detail-catchphrase">"${store.catchphrase}"</div>` : ''}
            </div>

            ${(store.logoUrl || store.logo_url) ? `
              <div class="detail-logo-box">
                <img src="${store.logoUrl || store.logo_url}" alt="${store.name}のロゴ" class="detail-logo-img" onerror="this.closest('.detail-logo-box').style.display='none';">
              </div>
            ` : ''}
          </div>

          ${paymentTagsHtml ? `
            <div style="margin-top:12px; padding-top:10px; border-top:1px dashed var(--border-gold, #8b7333); display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span style="font-size:13px; color:var(--text-yellow, #ffd700); font-weight:bold;">💳 支払い方法:</span>
              <div class="payment-tags" style="display:inline-flex; gap:6px; flex-wrap:wrap;">${paymentTagsHtml}</div>
            </div>
          ` : ''}
        </div>

        <!-- 2. どれクエ対象時間枠 -->
        <div class="rpg-window">
          <div class="rpg-window-header">
            <span>⏰ どれクエ対象時間</span>
          </div>
          <table class="info-table">
            ${store.conditions.days ? `
              <tr>
                <th>提供日</th>
                <td><strong style="color:#ffffff;">${store.conditions.days}</strong></td>
              </tr>
            ` : ''}
            ${store.conditions.hours ? `
              <tr>
                <th>提供時間</th>
                <td>
                  <strong style="color:#ffffff;">${store.conditions.hours}</strong>
                  ${store.conditions.timeNotes ? `
                    <div style="font-size:13px; color:#fde68a; margin-top:4px; line-height:1.4;">
                      💡 ${this.escapeHtml(store.conditions.timeNotes)}
                    </div>
                  ` : ''}
                </td>
              </tr>
            ` : ''}
            ${store.conditions.limit ? `
              <tr>
                <th>限定数</th>
                <td><span style="color:#ffffff;">${store.conditions.limit}</span> ${store.conditions.soldOutEnd ? '<span style="font-size:12px; color:var(--text-yellow);">（売切終了）</span>' : ''}</td>
              </tr>
            ` : ''}
            ${store.takeout ? `
              <tr>
                <th>テイクアウト</th>
                <td><span style="color:#ffffff;">${store.takeout}</span></td>
              </tr>
            ` : ''}
          </table>
        </div>

        <!-- 3. 酔いどれセット情報枠 -->
        ${store.yoidoreSet && store.yoidoreSet.title ? `
          <div class="rpg-window">
            <div class="rpg-window-header">
              <span>🍺 酔いどれセット情報</span>
            </div>
            <table class="info-table">
              <tr>
                <th>セット名</th>
                <td><span class="text-yellow" style="font-size:16px; font-weight:bold;">${store.yoidoreSet.title}</span></td>
              </tr>
              ${store.yoidoreSet.content ? `
                <tr>
                  <th>内容</th>
                  <td style="line-height:1.6; color:#ffffff; font-size:14px;">${store.yoidoreSet.content}</td>
                </tr>
              ` : ''}
              ${store.yoidoreSet.price > 0 ? `
                <tr>
                  <th>金額</th>
                  <td>
                    <div style="display:flex; align-items:baseline; gap:6px; flex-wrap:wrap;">
                      <strong class="text-green" style="font-size:19px;">¥${store.yoidoreSet.price.toLocaleString()}</strong>
                      <span style="font-size:12px; color:#cbd5e1;">(税込)</span>
                      ${store.yoidoreSet.charge ? `
                        <span style="font-size:12px; color:#ffffff; background:rgba(255,255,255,0.15); padding:2px 8px; border-radius:4px;">
                          チャージ: ${store.yoidoreSet.charge === '込' ? '込' : (store.yoidoreSet.charge === '不要' || store.yoidoreSet.charge === '0' || store.yoidoreSet.charge === '無し' ? 'なし' : store.yoidoreSet.charge)}
                        </span>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              ` : ''}
              ${store.yoidoreSet.notes ? `
                <tr>
                  <th>備考</th>
                  <td style="font-size:14px; color:#e2e8f0; line-height:1.5;">${store.yoidoreSet.notes}</td>
                </tr>
              ` : ''}
            </table>
          </div>
        ` : ''}

        <!-- 4. 酒場クエスト情報枠 -->
        ${(store.isQuestActive && store.quest && store.quest.title && store.quest.title !== '？？？？？') ? `
          <div class="rpg-window">
            <div class="rpg-window-header">
              <span>⚔️ 酒場クエスト情報</span>
            </div>
            <table class="info-table">
              <tr>
                <th>クエスト名</th>
                <td><span class="text-yellow" style="font-size:16px; font-weight:bold;">${store.quest.title}</span></td>
              </tr>
              ${store.quest.content ? `
                <tr>
                  <th>内容</th>
                  <td style="line-height:1.6; color:#ffffff; font-size:14px;">${store.quest.content}</td>
                </tr>
              ` : ''}
              <tr>
                <th>料金</th>
                <td>
                  <div style="display:flex; align-items:baseline; gap:6px; flex-wrap:wrap;">
                    ${store.quest.price > 0 ? `
                      <strong class="text-green" style="font-size:19px;">¥${store.quest.price.toLocaleString()}</strong>
                      <span style="font-size:12px; color:#cbd5e1;">(税込)</span>
                    ` : `
                      <span class="quest-fee-badge" style="font-size:12px;">🟢 参加無料</span>
                    `}
                    ${store.quest.charge && store.quest.charge !== '不要' && store.quest.charge !== '0' && store.quest.charge !== '無し' ? `
                      <span style="font-size:12px; color:#ffffff; background:rgba(255,255,255,0.15); padding:2px 8px; border-radius:4px;">
                        チャージ: ${store.quest.charge}
                      </span>
                    ` : ''}
                  </div>
                </td>
              </tr>
              ${store.quest.notes ? `
                <tr>
                  <th>備考</th>
                  <td style="font-size:14px; color:#e2e8f0; line-height:1.5;">${store.quest.notes}</td>
                </tr>
              ` : ''}
            </table>
          </div>
        ` : ''}

        <!-- 5. 酒場写真ギャラリー -->
        ${(store.photoUrl || store.photo_url) ? `
          <div class="rpg-window">
            <div class="rpg-window-header">
              <span>📷 オモロイ人</span>
            </div>
            <div class="detail-photo-box">
              <img src="${store.photoUrl || store.photo_url}" alt="${store.name}のオモロイ人写真" class="detail-photo-img" onerror="this.closest('.rpg-window').style.display='none';">
            </div>
          </div>
        ` : ''}

        <!-- 外部リンク -->
        ${(store.googleMapUrl || store.instagramUrl) ? `
          <div class="rpg-window">
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${store.googleMapUrl ? `
                <a href="${store.googleMapUrl}" target="_blank" class="external-link-btn">
                  <span>📍 Googleマップで酒場へ行く</span>
                </a>
              ` : ''}
              ${store.instagramUrl ? `
                <a href="${store.instagramUrl}" target="_blank" class="external-link-btn" style="background: linear-gradient(180deg, #801848 0%, #380820 100%);">
                  <span>📷 酒場のInstagramを開く</span>
                </a>
              ` : ''}
            </div>
          </div>
        ` : ''}

      </div>
    `;

    container.querySelectorAll('.external-link-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.playSelectSE();
      });
    });
  }
}

window.YoidoreQuestApp = YoidoreQuestApp;

// ドム読み込み完了時にアプリ起動
document.addEventListener('DOMContentLoaded', () => {
  window.app = new YoidoreQuestApp();
});
