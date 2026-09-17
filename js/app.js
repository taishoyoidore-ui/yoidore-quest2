/**
 * 大正酔いどれクエストⅡ - メインアプリケーションロジック
 */

class YoidoreQuestApp {
  constructor() {
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

    // 初期履歴の登録 (ブラウザバック用)
    if (window.history && window.history.replaceState) {
      window.history.replaceState({
        view: 'top',
        selectedStoreId: null,
        filters: { ...this.filters }
      }, '');
    }

    this.initAudio();
    this.initEvents();
    this.loadXLSXFromDefaultPath();
    this.initQuestSystem();
    this.render();
  }

  /* ------------------------------------------------------------------------
   * Supabase & LIFF クエストシステム初期化
   * ------------------------------------------------------------------------ */
  async initQuestSystem() {
    if (window.questApi) {
      try {
        await window.questApi.initAuth();
        const stores = await window.questApi.getStores();
        if (stores && stores.length > 0) {
          if (typeof STORES_DATA !== 'undefined') {
            window.STORES_DATA = stores;
          }
        }
        await window.questApi.getRewardTiers();
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
   * 起動時の自動Excel/CSVデータ読み込み処理
   * ------------------------------------------------------------------------ */
  async loadXLSXFromDefaultPath() {
    // 1. まずSTORES.xlsxの取得を試みる
    try {
      const response = await fetch('STORES.xlsx?t=' + Date.now());
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        if (typeof updateDataFromXLSX === 'function') {
          const success = updateDataFromXLSX(buffer);
          if (success) {
            this.render();
            return;
          }
        }
      }
    } catch (e) {
      console.warn('STORES.xlsxの取得に失敗しました。CSVの読み込みを試みます:', e);
    }

    // 2. フォールバック: STORES.csvの取得
    try {
      const response = await fetch('STORES.csv?t=' + Date.now());
      if (response.ok) {
        const text = await response.text();
        if (typeof updateDataFromCSV === 'function') {
          const success = updateDataFromCSV(text);
          if (success) {
            this.render();
          }
        }
      }
    } catch (e) {
      console.warn('店舗データの読み込みに失敗したため、デフォルトデータを使用します:', e);
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
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    this.isStarted = true;
    this.playStartSE();

    const overlay = document.getElementById('start-overlay');
    if (overlay) {
      overlay.classList.add('fade-out');
      setTimeout(() => {
        overlay.classList.add('hidden');
      }, 400);
    }

    setTimeout(() => {
      this.typeMessage('案内所へようこそ！大正の「オモロイらしい店」を探すコマンドを選択して下さい。');
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
    } catch (e) {
      console.error(e);
    }
  }

  playCursorSE() {
    this.playTone(440, 0.05, 'square');
  }

  playSelectSE() {
    if (!this.soundEnabled || !this.audioCtx) return;
    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.06); // E5
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(now + 0.2);
    } catch (e) {}
  }

  playBackSE() {
    if (!this.soundEnabled || !this.audioCtx) return;
    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(392.00, now); // G4
      osc.frequency.setValueAtTime(261.63, now + 0.08); // C4
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(now + 0.25);
    } catch (e) {}
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
      startBtn.addEventListener('click', () => this.startGame());
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
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const targetView = item.dataset.targetView;
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
              // すでに店舗一覧画面にいる状態でもう一度「店舗一覧」を押した場合は一番上へリセット
              this.resetFilters();
            }
            // 店舗詳細など別画面から「店舗一覧」を押した場合は、前回のスクロール位置・検索条件を維持して戻る
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
      if (this.filters.openToday) activeTags.push(`<span class="sticky-tag-item text-green">✓ 営業中</span>`);
      if (this.filters.searchQuery) activeTags.push(`<span class="sticky-tag-item">🔎 ${this.filters.searchQuery}</span>`);

      let count = 0;
      if (typeof STORES_DATA !== 'undefined') {
        count = STORES_DATA.filter(store => {
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
      }

      if (activeTags.length > 0) {
        tagsContainer.innerHTML = `
          <span class="sticky-icon">🔍</span>
          <div style="display:flex; gap:4px; align-items:center; overflow:hidden;">
            ${activeTags.join('')}
            <span style="font-size:11px; color:var(--text-dim); margin-left:4px;">(${count}件)</span>
          </div>
        `;
      } else {
        tagsContainer.innerHTML = `
          <span class="sticky-icon">🍺</span>
          <span>全店舗一覧 (${count}件)</span>
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
    if (window.history && window.history.replaceState) {
      const currentState = window.history.state || {};
      window.history.replaceState({
        ...currentState,
        view: this.currentView,
        selectedStoreId: this.selectedStore ? this.selectedStore.id : null,
        filters: { ...this.filters }
      }, '');
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
      this.lastStoresScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
    }

    this.currentView = view;
    if (extraData && extraData.store) {
      this.selectedStore = extraData.store;
    }

    // History API に画面状態をプッシュ (popstate による遷移でない場合のみ)
    if (!isPopState && window.history && window.history.pushState) {
      window.history.pushState({
        view: view,
        selectedStoreId: this.selectedStore ? this.selectedStore.id : null,
        filters: { ...this.filters }
      }, '');
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

  /* ------------------------------------------------------------------------
   * メインレンダリングルーティン
   * ------------------------------------------------------------------------ */
  render() {
    // 各店舗の今日・現在営業フラグを動的に更新
    if (typeof checkIsOpenToday === 'function' && typeof STORES_DATA !== 'undefined') {
      STORES_DATA.forEach(store => {
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
   * 3.1 トップ画面 (酒場案内所)
   * ------------------------------------------------------------------------ */
  renderTopView(container) {
    if (this.isStarted) {
      this.typeMessage('案内所へようこそ！大正の「オモロイらしい店」を探すコマンドを選択して下さい。');
    } else {
      const msgEl = document.getElementById('rpg-message-text');
      if (msgEl) {
        msgEl.textContent = '「ガイドブックを開く」ボタンを押してください。';
      }
    }

    const takeoutCount = (typeof STORES_DATA !== 'undefined') ? STORES_DATA.filter(s => s.isTakeout).length : 0;
    const openCount = (typeof STORES_DATA !== 'undefined') ? STORES_DATA.filter(s => s.isOpenToday).length : 0;
    const totalCount = (typeof STORES_DATA !== 'undefined') ? STORES_DATA.length : 0;
    const areaCount = (typeof AREAS_LIST !== 'undefined' && AREAS_LIST.length > 0) ? AREAS_LIST.length : 5;
    const catCount = (typeof CATEGORIES_LIST !== 'undefined' && CATEGORIES_LIST.length > 0) ? CATEGORIES_LIST.length : 7;
    const styleCount = (typeof STYLES_LIST !== 'undefined' && STYLES_LIST.length > 0) ? STYLES_LIST.length : 3;
    const typeCount = (typeof TYPES_LIST !== 'undefined' && TYPES_LIST.length > 0) ? TYPES_LIST.length : 4;

    const visitedCount = (window.questApi && window.questApi.visits) ? window.questApi.visits.length : 0;
    const couponCount = (window.questApi && window.questApi.userCoupons) ? window.questApi.userCoupons.filter(c => c.status !== 'used').length : 0;

    container.innerHTML = `
      <!-- 冒険の書（クエスト進捗）バナー -->
      <div class="rpg-window" id="top-quest-banner" style="cursor:pointer; border-color:var(--border-gold); background:linear-gradient(180deg,#1c2340 0%,#090d1f 100%); margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:26px;">📜</span>
            <div>
              <div style="font-size:14px; font-weight:bold; color:var(--text-yellow);">冒険の書（街ぶらはしご進捗）</div>
              <div style="font-size:12px; color:var(--text-green);">制覇数: ${visitedCount} / ${totalCount} 軒 ${couponCount > 0 ? `| クーポン: ${couponCount}枚` : ''}</div>
            </div>
          </div>
          <span style="font-size:12px; color:var(--text-cyan); font-weight:bold;">開く ▶</span>
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
              <span class="command-label">店の種類から探す</span>
            </div>
            <span class="command-badge">${catCount}種類</span>
          </li>
          <li class="command-item" data-action="style">
            <div class="command-item-left">
              <span class="command-cursor">▶</span>
              <span class="command-label">スタイルから探す</span>
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
              <span class="command-label">どれクエ対応中のお店</span>
            </div>
            <span class="command-badge text-green">対応中 ${openCount}店舗</span>
          </li>
          <li class="command-item" data-action="takeout">
            <div class="command-item-left">
              <span class="command-cursor">▶</span>
              <span class="command-label">テイクアウトOKなお店</span>
            </div>
            <span class="command-badge">${takeoutCount}店舗</span>
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
              <span class="command-label">全店舗一覧を見る</span>
            </div>
            <span class="command-badge">${totalCount}店舗</span>
          </li>
        </ul>
      </div>
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

    const questBanner = document.getElementById('top-quest-banner');
    if (questBanner) {
      questBanner.addEventListener('click', () => {
        this.playSelectSE();
        this.navigateTo('quest-book');
      });
    }
  }

  /* ------------------------------------------------------------------------
   * 冒険の書 (Quest Book / Passport) 画面
   * ------------------------------------------------------------------------ */
  renderQuestBookView(container) {
    const user = (window.questApi && window.questApi.currentUser) || {
      displayName: '酔いどれ勇者タロウ',
      pictureUrl: 'assets/banner.png'
    };
    const visits = (window.questApi && window.questApi.visits) || [];
    const stores = (typeof STORES_DATA !== 'undefined') ? STORES_DATA : [];
    const totalStores = stores.length || 33;
    const visitedCount = visits.length;
    const progressPercent = Math.min(100, Math.round((visitedCount / totalStores) * 100));

    // 称号・レベル計算
    let heroTitle = '駆け出しの呑兵衛';
    let heroLv = 1;
    if (visitedCount >= 10) {
      heroTitle = '大正の伝説マスター';
      heroLv = 5;
    } else if (visitedCount >= 5) {
      heroTitle = '酒場制覇の豪傑';
      heroLv = 4;
    } else if (visitedCount >= 3) {
      heroTitle = 'ほろ酔い冒険者';
      heroLv = 3;
    } else if (visitedCount >= 1) {
      heroTitle = '見習い巡回兵';
      heroLv = 2;
    }

    this.typeMessage(`『${user.displayName}』の冒険の書です。店舗を巡ってQRコードを読み取ると制覇数が記録されます。`);

    const rewardTiers = (window.questApi && window.questApi.rewardTiers) || [];
    const userCoupons = (window.questApi && window.questApi.userCoupons) || [];

    // 獲得済み特典ランクの判定
    const claimedTierIds = new Set(userCoupons.map(c => c.reward_tier_id));

    // 特典宝箱のレンダリング
    const tiersHtml = rewardTiers.map(tier => {
      const isReached = visitedCount >= tier.required_visits;
      const isClaimed = claimedTierIds.has(tier.id);

      let actionHtml = '';
      if (isClaimed) {
        actionHtml = `<div class="treasure-claimed-badge">✅ クーポン獲得済み (${tier.selectable_count}店舗選択)</div>`;
      } else if (isReached) {
        actionHtml = `<button class="treasure-claim-btn" data-tier-id="${tier.id}">🎁 宝箱をあける (${tier.selectable_count}店舗選ぶ)</button>`;
      } else {
        const remaining = tier.required_visits - visitedCount;
        actionHtml = `<div style="font-size:12px; color:var(--text-dim);">🔒 あと <strong class="text-yellow">${remaining}軒</strong> 訪問ではしご達成！</div>`;
      }

      return `
        <div class="treasure-tier-card ${isReached ? 'unlocked' : ''}">
          <div class="treasure-tier-header">
            <span class="treasure-tier-title">🏆 ${tier.title} (必要: ${tier.required_visits}軒)</span>
            <span style="font-size:18px;">${isClaimed ? '📦' : (isReached ? '✨' : '🔒')}</span>
          </div>
          <div class="treasure-tier-desc">${tier.description}</div>
          <div style="margin-top:6px;">${actionHtml}</div>
        </div>
      `;
    }).join('');

    // 所持クーポン一覧のレンダリング
    const activeCoupons = userCoupons.filter(c => c.status !== 'used');
    const usedCoupons = userCoupons.filter(c => c.status === 'used');

    const renderCouponCard = (c, isUsed) => {
      const storeName = c.stores?.name || c.store_id;
      const storeArea = c.stores?.area || '';
      const desc = c.stores?.coupon_description || '街ぶら達成クーポン特典';
      return `
        <div class="coupon-ticket ${isUsed ? 'used' : ''}" data-coupon-id="${c.id}">
          <div class="coupon-ticket-header">
            <span class="coupon-store-name">🏪 ${storeName} ${storeArea ? `(${storeArea})` : ''}</span>
            <span class="text-yellow" style="font-size:11px;">${isUsed ? '【利用済み】' : '【利用可能】'}</span>
          </div>
          <div class="coupon-desc-text">🎁 ${desc}</div>
          <div class="coupon-footer">
            <span>獲得日: ${new Date(c.acquired_at).toLocaleDateString()}</span>
            <span style="color:var(--text-cyan); font-weight:bold;">${isUsed ? '使用済' : 'タップして提示 ▶'}</span>
          </div>
          ${isUsed ? `<div class="coupon-used-stamp">USED</div>` : ''}
        </div>
      `;
    };

    const couponsHtml = (userCoupons.length > 0)
      ? `
        <div class="rpg-window">
          <div class="rpg-window-header">
            <span>🎟️ 所持クーポン一覧 (${userCoupons.length}枚)</span>
          </div>
          <div style="margin-top:10px;">
            ${activeCoupons.map(c => renderCouponCard(c, false)).join('')}
            ${usedCoupons.map(c => renderCouponCard(c, true)).join('')}
          </div>
        </div>
      `
      : `
        <div class="rpg-window">
          <div class="rpg-window-header">
            <span>🎟️ 所持クーポン一覧</span>
          </div>
          <div style="padding:15px; text-align:center; color:var(--text-dim); font-size:13px;">
            現在所持しているクーポンはありません。<br>3軒以上はしごして特典宝箱をアンロックしましょう！
          </div>
        </div>
      `;

    // 訪問済み店舗一覧
    const visitedStoresHtml = visits.map((v, idx) => {
      const st = stores.find(s => s.id === v.store_id);
      const name = st ? st.name : v.store_id;
      const dateStr = v.visited_at ? new Date(v.visited_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
      return `
        <li class="command-item" style="cursor:default; padding:8px 10px;">
          <div class="command-item-left">
            <span style="color:var(--text-green); font-size:14px;">✅ #${idx + 1}</span>
            <span class="command-label" style="font-size:13px;">${name}</span>
          </div>
          <span style="font-size:11px; color:var(--text-dim);">${dateStr}</span>
        </li>
      `;
    }).join('');

    container.innerHTML = `
      <div class="quest-book-container">
        <!-- 勇者ステータス -->
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

        <!-- クエスト進捗 -->
        <div class="quest-progress-box">
          <div class="quest-progress-header">
            <span class="quest-progress-title">⚔️ 街ぶら はしご進捗</span>
            <span class="quest-progress-count">${visitedCount} <span style="font-size:13px; color:var(--text-dim);">/ ${totalStores} 軒</span></span>
          </div>
          <div class="quest-progress-bar-bg">
            <div class="quest-progress-bar-fill" style="width: ${progressPercent}%;"></div>
          </div>
        </div>

        <!-- 特典宝箱一覧 -->
        <div class="rpg-window gold-border" style="margin-bottom:12px;">
          <div class="rpg-window-header">
            <span>🎁 達成特典・宝箱</span>
          </div>
          <div style="margin-top:10px;">
            ${tiersHtml}
          </div>
        </div>

        <!-- クーポン一覧 -->
        ${couponsHtml}

        <!-- 開発・テスト用チェックインシミュレーター -->
        <div class="checkin-sim-box">
          <div class="checkin-sim-title">
            <span>⚙️ 【開発・テスト用】来店チェックイン実行</span>
          </div>
          <p style="font-size:11px; color:var(--text-dim); margin-bottom:8px;">
            ※本番は店頭QRコードスキャンで自動来店されます。テスト時は以下から店舗を選んで来店記録できます。
          </p>
          <div class="checkin-sim-row">
            <select id="sim-store-select" class="checkin-sim-select">
              ${stores.map(s => `<option value="${s.id}">${s.id}: ${s.name} (${s.area})</option>`).join('')}
            </select>
            <button id="sim-checkin-btn" class="checkin-sim-btn">来店記録！</button>
          </div>
        </div>

        <!-- 訪問済み店舗一覧 -->
        <div class="rpg-window" style="margin-top:14px;">
          <div class="rpg-window-header">
            <span>📜 訪問済み酒場リスト (${visitedCount}軒)</span>
          </div>
          <ul class="command-list" style="margin-top:8px;">
            ${visitedStoresHtml || `<li style="padding:15px; text-align:center; color:var(--text-dim); font-size:13px;">まだ訪問記録がありません。酒場を巡りましょう！</li>`}
          </ul>
        </div>
      </div>
    `;

    // 宝箱を開くボタンのイベント
    container.querySelectorAll('.treasure-claim-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.playSelectSE();
        const tierId = parseInt(btn.dataset.tierId, 10);
        const tier = rewardTiers.find(t => t.id === tierId);
        if (tier) {
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

    // シミュレーターチェックインボタン
    const simBtn = document.getElementById('sim-checkin-btn');
    if (simBtn) {
      simBtn.addEventListener('click', async () => {
        const select = document.getElementById('sim-store-select');
        if (select && select.value) {
          await this.handleCheckin(select.value);
        }
      });
    }
  }

  /* ------------------------------------------------------------------------
   * 特典クーポン選択モーダル (達成条件に応じて店舗を選択)
   * ------------------------------------------------------------------------ */
  openCouponSelectModal(tier) {
    const stores = (typeof STORES_DATA !== 'undefined') ? STORES_DATA : [];
    // クーポン対象店舗のみを抽出
    const targetStores = stores.filter(s => s.isCouponTarget);
    const maxSelect = tier.selectable_count || 1;
    let selectedSet = new Set();

    const overlay = document.createElement('div');
    overlay.className = 'rpg-modal-overlay';
    overlay.id = 'coupon-select-modal';

    const renderItems = () => {
      return targetStores.map(s => {
        const isChecked = selectedSet.has(s.id);
        const desc = s.couponDescription || '【街ぶら達成特典】お好きなワンドリンク または 小鉢1品サービス！';
        return `
          <div class="coupon-select-item ${isChecked ? 'selected' : ''}" data-store-id="${s.id}">
            <input type="checkbox" ${isChecked ? 'checked' : ''} />
            <div class="coupon-select-item-info">
              <div class="coupon-select-item-name">🏪 ${s.name} <span style="font-size:11px; color:var(--text-dim);">(${s.area})</span></div>
              <div class="coupon-select-item-desc">🎁 ${desc}</div>
            </div>
          </div>
        `;
      }).join('');
    };

    overlay.innerHTML = `
      <div class="rpg-modal-window gold-border" style="max-width:440px; width:92%; max-height:85vh; display:flex; flex-direction:column;">
        <div class="rpg-window-header" style="display:flex; justify-content:space-between; align-items:center;">
          <span>🎁 クーポン店舗の選択</span>
          <button id="modal-close-btn" style="background:none; border:none; color:#fff; font-size:18px; cursor:pointer;">✕</button>
        </div>
        <div style="padding:10px 0; font-size:13px; color:var(--text-yellow);">
          対象店舗の中から <strong>最大 ${maxSelect} 店舗</strong> を選択してください。<br>
          <span style="font-size:12px; color:var(--text-cyan);">現在 <span id="select-counter">0</span> / ${maxSelect} 店舗 選択中</span>
        </div>
        <div class="coupon-select-list" id="modal-stores-list">
          ${renderItems()}
        </div>
        <div style="margin-top:10px; display:flex; gap:8px;">
          <button id="modal-confirm-btn" class="staff-redeem-action-btn" style="background:linear-gradient(180deg,#1e824c 0%,#145a32 100%); border-color:var(--text-green);" disabled>
            店舗を選択してください (最大${maxSelect}店舗)
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
        confirmBtn.disabled = selectedSet.size === 0;
        confirmBtn.textContent = (selectedSet.size > 0)
          ? `選択した ${selectedSet.size} 店舗のクーポンを獲得する！`
          : `店舗を選択してください (最大${maxSelect}店舗)`;
      }
    };

    // アイテム選択ハンドリング
    overlay.querySelectorAll('.coupon-select-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const storeId = item.dataset.storeId;
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (selectedSet.has(storeId)) {
          selectedSet.delete(storeId);
          item.classList.remove('selected');
          if (checkbox) checkbox.checked = false;
        } else {
          if (selectedSet.size >= maxSelect) {
            alert(`この特典で選択できるのは最大 ${maxSelect} 店舗までです。`);
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
      if (selectedSet.size === 0) return;
      this.playFanfareSE();
      const storeIds = Array.from(selectedSet);
      const res = await window.questApi.claimCoupons(tier.id, storeIds);
      overlay.remove();
      if (res.success) {
        alert(`🎉 ${storeIds.length}店舗のクーポンを獲得しました！所持クーポン一覧からいつでも利用できます。`);
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
    const storeName = coupon.stores?.name || coupon.store_id;
    const storeArea = coupon.stores?.area || '';
    const desc = coupon.stores?.coupon_description || '街ぶら達成クーポン特典';
    const isUsed = coupon.status === 'used';

    const overlay = document.createElement('div');
    overlay.className = 'rpg-modal-overlay';
    overlay.id = 'coupon-redeem-modal';

    overlay.innerHTML = `
      <div class="rpg-modal-window gold-border" style="max-width:400px; width:90%;">
        <div class="rpg-window-header" style="display:flex; justify-content:space-between; align-items:center;">
          <span>🎟️ クーポン提示画面</span>
          <button id="redeem-close-btn" style="background:none; border:none; color:#fff; font-size:18px; cursor:pointer;">✕</button>
        </div>
        <div class="staff-redeem-box">
          <div style="font-size:18px; font-weight:bold; color:var(--text-yellow); margin:10px 0;">
            🏪 ${storeName}
          </div>
          <div style="font-size:13px; color:var(--text-dim); margin-bottom:10px;">エリア: ${storeArea || '-'}</div>
          <div style="background:#0f152b; border:2px dashed var(--border-gold); padding:12px; border-radius:6px; margin-bottom:14px;">
            <div style="font-size:12px; color:var(--text-cyan); margin-bottom:4px;">【特典内容】</div>
            <div style="font-size:15px; font-weight:bold; color:#fff; line-height:1.4;">🎁 ${desc}</div>
          </div>

          ${isUsed ? `
            <div style="padding:15px; border:2px solid #666; border-radius:6px; background:#111;">
              <div class="coupon-used-stamp" style="position:static; transform:none; display:inline-block; margin-bottom:6px;">USED / 利用済み</div>
              <div style="font-size:12px; color:var(--text-dim);">利用日時: ${new Date(coupon.used_at).toLocaleString()}</div>
            </div>
          ` : `
            <div class="staff-warning-banner">
              ⚠️ 【店員専用操作】<br>
              お会計時またはご注文時に、必ず店舗スタッフが下のボタンをタップして消し込みを行ってください。
            </div>
            <button id="btn-staff-redeem" class="staff-redeem-action-btn">
              🍺 【店舗スタッフ】使用済みにする
            </button>
          `}
        </div>
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
        if (!confirm(`【店舗スタッフ確認】\n「${storeName}」のクーポンを使用済みにしますか？`)) {
          return;
        }
        this.playFanfareSE();
        redeemBtn.disabled = true;
        redeemBtn.textContent = '消し込み中...';
        const res = await window.questApi.redeemCoupon(coupon.id);
        overlay.remove();
        if (res.success) {
          alert(`✅ クーポンを「使用済み」に更新しました！ご来店ありがとうございます。`);
          this.render();
        } else {
          alert(res.message || 'クーポンの消し込みに失敗しました。');
        }
      });
    }
  }

  /* ------------------------------------------------------------------------
   * 来店チェックイン処理 (QRコード読み取りまたはシミュレーター)
   * ------------------------------------------------------------------------ */
  async handleCheckin(storeId) {
    if (!storeId) return;
    this.playFanfareSE();
    const res = await window.questApi.checkInStore(storeId);
    if (res.success) {
      alert(`🎉 冒険の書を更新！\n『${res.storeName}』への来店を記録しました！\n（現在の制覇数: ${res.totalVisits}軒）`);
      this.navigateTo('quest-book');
    } else if (res.alreadyVisited) {
      alert(`📜 『${storeId}』はすでに冒険の書に記録済みです！`);
      this.navigateTo('quest-book');
    } else {
      alert(res.message || 'チェックインに失敗しました。');
    }
  }
    this.typeMessage('探したいエリアを選択してください。エリアごとの酒場が表示されます。');

    const areaItems = AREAS_LIST.map(area => {
      const count = STORES_DATA.filter(s => s.area === area).length;
      return `
        <li class="command-item" data-area="${area}">
          <div class="command-item-left">
            <span class="command-cursor">▶</span>
            <span class="command-label">${area}</span>
          </div>
          <span class="command-badge">${count}店舗</span>
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
   * 3.3 店の種類 (カテゴリ) 一覧
   * ------------------------------------------------------------------------ */
  renderCategoryView(container) {
    this.typeMessage('料理やお店のジャンルを選択してください。');

    const categoryItems = CATEGORIES_LIST.map(cat => {
      const count = STORES_DATA.filter(s => s.category === cat).length;
      return `
        <li class="command-item" data-category="${cat}">
          <div class="command-item-left">
            <span class="command-cursor">▶</span>
            <span class="command-label">${cat}</span>
          </div>
          <span class="command-badge">${count}店舗</span>
        </li>
      `;
    }).join('');

    container.innerHTML = `
      <div class="rpg-window">
        <div class="rpg-window-header">
          <span>▶ 店の種類選択</span>
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
   * 3.3.5 スタイル一覧
   * ------------------------------------------------------------------------ */
  renderStyleView(container) {
    this.typeMessage('お店の席や過ごし方の『スタイル』を選択してください。');

    const stylesList = (typeof STYLES_LIST !== 'undefined') ? STYLES_LIST : [];
    const styleItems = stylesList.map(style => {
      const count = STORES_DATA.filter(s => s.style === style).length;
      return `
        <li class="command-item" data-style="${style}">
          <div class="command-item-left">
            <span class="command-cursor">▶</span>
            <span class="command-label">${style}</span>
          </div>
          <span class="command-badge">${count}店舗</span>
        </li>
      `;
    }).join('');

    container.innerHTML = `
      <div class="rpg-window">
        <div class="rpg-window-header">
          <span>▶ スタイル選択</span>
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
   * 3.4 店舗タイプ一覧
   * ------------------------------------------------------------------------ */
  renderTypeView(container) {
    this.typeMessage('目的に合わせた『酔いどれタイプ』を選択してください。');

    const OFFICIAL_TYPES = [
      { type: 'サク飲み', desc: 'サクッと1杯飲んで次のお店へ' },
      { type: '腹ごしらえ', desc: 'しっかりご飯・名物料理でお腹を満たす' },
      { type: 'ひと休み', desc: 'ドリンクや軽食でほっと一息つく' },
      { type: '夜遊び', desc: 'ゲーム・ダーツ・会話や夜の体験を楽しむ' }
    ];

    const typeItems = OFFICIAL_TYPES.map(item => {
      const count = STORES_DATA.filter(s => s.type === item.type).length;

      return `
        <li class="command-item" data-type="${item.type}">
          <div class="command-item-left">
            <span class="command-cursor">▶</span>
            <div>
              <div class="command-label">${item.type}</div>
              <div style="font-size:11px; color:var(--text-dim);">${item.desc}</div>
            </div>
          </div>
          <span class="command-badge">${count}店舗</span>
        </li>
      `;
    }).join('');

    container.innerHTML = `
      <div class="rpg-window">
        <div class="rpg-window-header">
          <span>▶ 酔いどれタイプ選択</span>
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

    const areaOptions = ['ALL', ...AREAS_LIST].map(a => 
      `<option value="${a}" ${this.filters.area === a ? 'selected' : ''}>${a === 'ALL' ? '全エリア' : a}</option>`
    ).join('');

    const catOptions = ['ALL', ...CATEGORIES_LIST].map(c => 
      `<option value="${c}" ${this.filters.category === c ? 'selected' : ''}>${c === 'ALL' ? '全種類' : c}</option>`
    ).join('');

    const stylesList = (typeof STYLES_LIST !== 'undefined') ? STYLES_LIST : [];
    const styleOptions = ['ALL', ...stylesList].map(s => 
      `<option value="${s}" ${this.filters.style === s ? 'selected' : ''}>${s === 'ALL' ? '全スタイル' : s}</option>`
    ).join('');

    const OFFICIAL_TYPE_NAMES = ['サク飲み', '腹ごしらえ', 'ひと休み', '夜遊び'];
    const allTypes = Array.from(new Set([...OFFICIAL_TYPE_NAMES, ...TYPES_LIST]));
    const typeOptions = ['ALL', ...allTypes].map(t => 
      `<option value="${t}" ${this.filters.type === t ? 'selected' : ''}>${t === 'ALL' ? '全酔いどれタイプ' : t}</option>`
    ).join('');

    container.innerHTML = `
      <div class="rpg-window" id="store-filter-window">
        <div class="rpg-window-header">
          <span>▶ 絞り込み条件</span>
          <div class="filter-header-action">
            ${isFiltered ? `<button id="btn-reset-filters" class="filter-reset-btn" type="button">✖ 条件クリア</button>` : ''}
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
            <input type="text" id="filter-search" class="search-input" placeholder="店舗名・キーワード検索..." value="${this.filters.searchQuery}">
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
      let filtered = STORES_DATA.filter(store => {
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

      this.typeMessage(`条件に一致する店舗が ${filtered.length} 件見つかりました。カードをタップして詳細を確認できます。`);

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

            ${store.logoUrl ? `
              <div class="store-card-logo-box">
                <img src="${store.logoUrl}" alt="${store.name}のロゴ" class="store-card-logo-img" onerror="this.closest('.store-card-logo-box').style.display='none';">
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
                  <span class="preview-label">⚔️ 店舗クエスト:</span>
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
      `).join('') : `
        <div class="rpg-window text-center" style="padding: 20px; color: var(--text-dim);">
          条件に一致する店舗が見つかりませんでした。<br>フィルターを変更してください。
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
            const store = STORES_DATA.find(s => s.id === storeId);
            if (store) {
              this.navigateTo('detail', { store });
            }
          });
        });
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
   * 3.8 店舗詳細
   * ------------------------------------------------------------------------ */
  renderDetailView(container) {
    const store = this.selectedStore;
    if (!store) {
      this.navigateTo('stores');
      return;
    }

    this.typeMessage(`「${store.name}」の情報です。どれクエ対象時間とセット内容をご確認ください。`);

    const paymentTagsHtml = (store.paymentMethods && store.paymentMethods.length > 0)
      ? store.paymentMethods.map(p => `<span class="payment-tag">${p}</span>`).join('')
      : '';

    const visitRecord = window.questApi && window.questApi.visits.find(v => v.store_id === store.id);
    const isVisited = Boolean(visitRecord);
    const visitedDateStr = visitRecord?.visited_at ? new Date(visitRecord.visited_at).toLocaleString('ja-JP') : '';
    const isCouponTarget = Boolean(store.isCouponTarget);

    container.innerHTML = `
      <div class="detail-section">
        <!-- 1. 店舗基本情報枠 -->
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
                  ${store.takeout ? `<span class="tag tag-takeout">${store.takeout}</span>` : ''}
                </div>
                <span class="store-status-badge ${store.isOpenToday ? 'status-open' : 'status-closed'}">
                  ${store.isOpenToday ? 'どれクエ対応中' : 'どれクエ対象時間外'}
                </span>
              </div>
              <h2 class="detail-store-name" style="margin-top:8px;">${store.name}</h2>
              ${store.catchphrase ? `<div class="detail-catchphrase">"${store.catchphrase}"</div>` : ''}
            </div>

            ${store.logoUrl ? `
              <div class="detail-logo-box">
                <img src="${store.logoUrl}" alt="${store.name}のロゴ" class="detail-logo-img" onerror="this.closest('.detail-logo-box').style.display='none';">
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

        <!-- 冒険の書 来店記録枠 -->
        <div class="rpg-window" style="border-color:${isVisited ? 'var(--text-green)' : 'var(--border-gold)'}; background:${isVisited ? '#0a1a10' : '#0a0d1a'};">
          <div class="rpg-window-header">
            <span>📜 冒険の書（来店記録）</span>
          </div>
          <div style="padding:8px 0; text-align:center;">
            ${isVisited ? `
              <div style="font-size:15px; color:var(--text-green); font-weight:bold; margin-bottom:4px;">
                ✅ この酒場は冒険の書に記録済みです！
              </div>
              <div style="font-size:12px; color:var(--text-dim);">記録日時: ${visitedDateStr}</div>
            ` : `
              <p style="font-size:12px; color:var(--text-white); margin-bottom:8px;">
                店頭のQRコードを読み取るか、下のボタンを押して来店を記録できます。
              </p>
              <button id="detail-checkin-btn" class="treasure-claim-btn" style="width:100%; font-size:13px; animation:none; background:linear-gradient(180deg,#1e824c 0%,#145a32 100%); border-color:var(--text-green);">
                🍺 この酒場に来店記録する！
              </button>
            `}
          </div>
        </div>

        ${isCouponTarget ? `
          <!-- はしご達成クーポン対象枠 -->
          <div class="rpg-window gold-border" style="background:#1a1708;">
            <div class="rpg-window-header">
              <span>🎁 はしご達成クーポン対象店舗</span>
            </div>
            <div style="padding:8px 0;">
              <div style="font-size:12px; color:var(--text-yellow); font-weight:bold; margin-bottom:4px;">【街ぶら達成時にもらえる特典】</div>
              <div style="font-size:14px; color:#fff; line-height:1.4;">
                ${store.couponDescription || '【街ぶら達成特典】お好きなワンドリンク または 小鉢1品サービス！'}
              </div>
            </div>
          </div>
        ` : ''}

        <!-- 2. どれクエ対象時間枠 (店舗名称枠の直下) -->
        <div class="rpg-window">
          <div class="rpg-window-header">
            <span>⏰ どれクエ対象時間</span>
          </div>
          <table class="info-table">
            ${store.conditions.days ? `
              <tr>
                <th>提供日/曜日</th>
                <td>${store.conditions.days}</td>
              </tr>
            ` : ''}
            ${store.conditions.hours ? `
              <tr>
                <th>提供時間</th>
                <td>${store.conditions.hours}</td>
              </tr>
            ` : ''}
            ${store.conditions.limit ? `
              <tr>
                <th>数量限定</th>
                <td>${store.conditions.limit} ${store.conditions.soldOutEnd ? '（売り切れ次第終了）' : ''}</td>
              </tr>
            ` : ''}
            ${store.takeout ? `
              <tr>
                <th>テイクアウト</th>
                <td>${store.takeout}</td>
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
              ${store.yoidoreSet.title ? `
                <tr>
                  <th>セット名</th>
                  <td class="text-yellow" style="font-weight:bold;">${store.yoidoreSet.title}</td>
                </tr>
              ` : ''}
              ${store.yoidoreSet.content ? `
                <tr>
                  <th>内容</th>
                  <td>${store.yoidoreSet.content}</td>
                </tr>
              ` : ''}
              ${store.yoidoreSet.price > 0 ? `
                <tr>
                  <th>金額</th>
                  <td>
                    <strong class="text-green" style="font-size:17px;">¥${store.yoidoreSet.price.toLocaleString()}</strong>
                    <span style="font-size:13px; color:var(--text-dim); margin-left:6px;">(税込${store.yoidoreSet.charge === '込' ? '・チャージ料込' : ''})</span>
                  </td>
                </tr>
              ` : ''}
              ${store.yoidoreSet.notes ? `
                <tr>
                  <th>備考</th>
                  <td style="font-size:14px; color:var(--text-dim);">${store.yoidoreSet.notes}</td>
                </tr>
              ` : ''}
            </table>
          </div>
        ` : ''}

        <!-- 4. 店舗クエスト情報枠 -->
        ${store.isQuestActive ? `
          <div class="rpg-window">
            <div class="rpg-window-header">
              <span>⚔️ 店舗クエスト情報</span>
            </div>
            <table class="info-table">
              ${store.quest.title ? `
                <tr>
                  <th>クエスト名</th>
                  <td><span class="text-yellow" style="font-weight:bold;">${store.quest.title}</span></td>
                </tr>
              ` : ''}
              ${store.quest.content ? `
                <tr>
                  <th>内容</th>
                  <td>${store.quest.content}</td>
                </tr>
              ` : ''}
              <tr>
                <th>金額</th>
                <td>
                  ${store.quest.price > 0 ? `
                    <strong class="text-green" style="font-size:17px;">¥${store.quest.price.toLocaleString()}</strong>
                    <span style="font-size:13px; color:var(--text-dim); margin-left:6px;">(税込${store.quest.charge === '込' ? '・チャージ料込' : ''})</span>
                  ` : `
                    <span class="quest-fee-badge">🟢 無料</span>
                    ${store.quest.charge === '込' ? `<span style="font-size:13px; color:var(--text-dim); margin-left:6px;">(チャージ料込)</span>` : ''}
                  `}
                </td>
              </tr>
              ${store.quest.notes ? `
                <tr>
                  <th>備考</th>
                  <td style="font-size:14px; color:var(--text-dim);">${store.quest.notes}</td>
                </tr>
              ` : ''}
            </table>
          </div>
        ` : ''}

        <!-- 5. 店舗写真ギャラリー -->
        ${store.photoUrl ? `
          <div class="rpg-window">
            <div class="rpg-window-header">
              <span>📷 オモロイ人</span>
            </div>
            <div class="detail-photo-box">
              <img src="${store.photoUrl}" alt="${store.name}のオモロイ人写真" class="detail-photo-img" onerror="this.closest('.rpg-window').style.display='none';">
            </div>
          </div>
        ` : ''}

        <!-- 外部リンク -->
        ${(store.googleMapUrl || store.instagramUrl) ? `
          <div class="rpg-window">
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${store.googleMapUrl ? `
                <a href="${store.googleMapUrl}" target="_blank" class="external-link-btn">
                  <span>📍 Googleマップで場所を確認する</span>
                </a>
              ` : ''}
              ${store.instagramUrl ? `
                <a href="${store.instagramUrl}" target="_blank" class="external-link-btn" style="background: linear-gradient(180deg, #801848 0%, #380820 100%);">
                  <span>📷 店舗Instagramを開く</span>
                </a>
              ` : ''}
            </div>
          </div>
        ` : ''}

      </div>
    `;

    const detailCheckinBtn = document.getElementById('detail-checkin-btn');
    if (detailCheckinBtn) {
      detailCheckinBtn.addEventListener('click', async () => {
        await this.handleCheckin(store.id);
      });
    }

    container.querySelectorAll('.external-link-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.playSelectSE();
      });
    });
  }
}

// ドム読み込み完了時にアプリ起動
document.addEventListener('DOMContentLoaded', () => {
  window.app = new YoidoreQuestApp();
});
