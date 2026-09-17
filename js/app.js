/**
 * 大正酔いどれクエストⅡ - メインアプリケーションロジック
 */

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
      if (this.filters.openToday) activeTags.push(`<span class="sticky-tag-item text-green">✓ 営業中</span>`);
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
      this.typeMessage('案内所へようこそ！大正の「オモロイらしい店」を探すコマンドを選択して下さい。');
    } else {
      const msgEl = document.getElementById('rpg-message-text');
      if (msgEl) {
        msgEl.textContent = '「ガイドブックを開く」ボタンを押してください。';
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

    const visitedCount = (window.questApi && window.questApi.visits) ? window.questApi.visits.length : 0;
    const couponCount = (window.questApi && window.questApi.userCoupons) ? window.questApi.userCoupons.filter(c => c.status !== 'used').length : 0;

    container.innerHTML = `
      <!-- 開催フェーズ動的告知バナー -->
      ${this.getSeasonBannerHTML()}

      <!-- 冒険の書（クエスト進捗）バナー -->
      <div class="rpg-window" id="top-quest-banner" style="cursor:pointer; border-color:var(--border-gold); background:linear-gradient(180deg,#1c2340 0%,#090d1f 100%); margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:26px;">📜</span>
            <div>
              <div style="font-size:14px; font-weight:bold; color:var(--text-yellow);">冒険の書（街ぶらハシゴ進捗）</div>
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

    this.typeMessage(`『${user.displayName}』の冒険の書です。店舗を巡ってQRコードを読み取ると制覇数が記録されます。`);

    const rewardTiers = (window.questApi && window.questApi.rewardTiers && window.questApi.rewardTiers.length > 0)
      ? window.questApi.rewardTiers 
      : (window.APP_CONFIG?.fallbackRewardTiers || []);
    const userCoupons = (window.questApi && window.questApi.userCoupons) || [];

    // 獲得済み特典ランクの判定 (数値・文字列両対応)
    const claimedTierIds = new Set(userCoupons.map(c => Number(c.reward_tier_id)));

    // 特典宝箱のレンダリング
    const tiersHtml = (rewardTiers.length > 0) ? rewardTiers.map(tier => {
      const isReached = visitedCount >= tier.required_visits;
      const isClaimed = claimedTierIds.has(Number(tier.id));
      const isGoods = tier.reward_type === 'goods';

      let actionHtml = '';
      if (isClaimed) {
        if (isGoods) {
          actionHtml = `<div class="treasure-claimed-badge">✅ グッズ引換券獲得済み（${this.escapeHtml(tier.goods_name || tier.title)}）</div>`;
        } else {
          actionHtml = `<div class="treasure-claimed-badge">✅ 店舗クーポン獲得済み (${tier.selectable_count}店舗選択)</div>`;
        }
      } else if (isReached) {
        if (isGoods) {
          actionHtml = `<button class="treasure-claim-btn" data-tier-id="${tier.id}" data-reward-type="goods">🎁 宝箱を開ける（${this.escapeHtml(tier.goods_name || 'グッズ引換')}を獲得）</button>`;
        } else {
          actionHtml = `<button class="treasure-claim-btn" data-tier-id="${tier.id}" data-reward-type="store_coupon">🎁 宝箱を開ける (${tier.selectable_count}店舗選ぶ)</button>`;
        }
      } else {
        const remaining = tier.required_visits - visitedCount;
        actionHtml = `<div style="font-size:12px; color:var(--text-dim);">🔒 あと <strong class="text-yellow">${remaining}軒</strong> のハシゴ酒で解放！</div>`;
      }

      return `
        <div class="treasure-tier-card ${isReached ? 'unlocked' : ''}">
          <div class="treasure-tier-header">
            <div>
              <span class="treasure-tier-title">🏆 ${this.escapeHtml(tier.title)}</span>
              <span class="tag" style="background:${isGoods ? '#451a03' : '#1e3a8a'}; color:${isGoods ? '#fde68a' : '#bfdbfe'}; border:1px solid ${isGoods ? '#f59e0b' : '#3b82f6'}; font-size:10px; margin-left:6px; padding:2px 6px; border-radius:4px;">
                ${isGoods ? '🎁 グッズ引換' : '🍺 店舗クーポン'}
              </span>
            </div>
            <span style="font-size:18px;">${isClaimed ? '📦' : (isReached ? '✨' : '🔒')}</span>
          </div>
          <div style="font-size:12px; color:var(--text-dim); margin:4px 0 6px 0;">
            <i class="fa-solid fa-beer-mug-empty"></i> 必要制覇数: <strong class="text-yellow">${tier.required_visits}軒</strong>
            ${isGoods ? 
              ` | 🎁 引換品: <strong style="color:#fff;">${this.escapeHtml(tier.goods_name || 'オリジナル記念品')}</strong>` : 
              ` | 🎟️ 特典数: <strong style="color:#fff;">${tier.selectable_count}店舗選択</strong>`
            }
          </div>
          ${isGoods && tier.exchange_location ? `
            <div style="font-size:11px; color:#fde68a; margin-bottom:4px; background:rgba(245,158,11,0.1); padding:4px 8px; border-radius:4px; border:1px dashed #d97706;">
              📍 <strong>引換場所:</strong> ${this.escapeHtml(tier.exchange_location)}
            </div>
          ` : ''}
          ${isGoods && tier.exchange_notice ? `
            <div style="font-size:10px; color:var(--text-dim); margin-bottom:4px;">
              ⚠️ ${this.escapeHtml(tier.exchange_notice)}
            </div>
          ` : ''}
          <div class="treasure-tier-desc">${this.escapeHtml(tier.description || '')}</div>
          <div style="margin-top:8px;">${actionHtml}</div>
        </div>
      `;
    }).join('') : '<div style="padding:15px; text-align:center; color:var(--text-dim); font-size:13px;">特典マイルストーンを設定中または読み込み中です。</div>';

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
        let badge = '<span class="text-yellow" style="font-size:11px;">【引換可能】</span>';
        let actionTxt = '受取画面を表示 ▶';
        if (isUsed) {
          badge = '<span class="text-dim" style="font-size:11px;">【受取済み】</span>';
          actionTxt = '受取済み';
        } else if (isExpired) {
          badge = '<span class="text-danger" style="font-size:11px;">【引換終了】</span>';
          actionTxt = '期限終了';
        }

        return `
          <div class="coupon-ticket ${isUsed ? 'used' : ''}" data-coupon-id="${c.id}" style="border-left: 4px solid #f59e0b;">
            <div class="coupon-ticket-header">
              <span class="coupon-store-name">🎁 ${this.escapeHtml(c.goods_name || c.title || '記念オリジナルグッズ')}</span>
              ${badge}
            </div>
            <div class="coupon-desc-text">📍 受取場所: ${this.escapeHtml(c.exchange_location || '全参加店舗または運営本部')}</div>
            <div class="coupon-footer">
              <span>獲得日: ${new Date(c.acquired_at).toLocaleDateString()}</span>
              <span style="color:var(--text-cyan); font-weight:bold;">${actionTxt}</span>
            </div>
            ${isUsed ? `<div class="coupon-used-stamp">USED</div>` : ''}
          </div>
        `;
      }

      const st = stores.find(s => s.id === c.store_id) || c.stores || {};
      const storeName = st.name || c.stores?.name || c.store_id;
      const storeArea = st.area || c.stores?.area || '';

      let badge = '<span class="text-green" style="font-size:11px;">【利用可能】</span>';
      let actionTxt = 'タップして提示 ▶';
      if (isUsed) {
        badge = '<span class="text-dim" style="font-size:11px;">【使用済み】</span>';
        actionTxt = '使用済み';
      } else if (isExpired) {
        badge = '<span class="text-danger" style="font-size:11px;">【期限終了】</span>';
        actionTxt = '期限終了';
      } else if (!isCouponUsable) {
        badge = `<span class="text-yellow" style="font-size:11px;">【${couponStartDateStr ? couponStartDateStr + '〜' : '後日利用可'}】</span>`;
        actionTxt = '利用前（詳細） ▶';
      }

      return `
        <div class="coupon-ticket ${isUsed ? 'used' : ''}" data-coupon-id="${c.id}">
          <div class="coupon-ticket-header">
            <span class="coupon-store-name">🏪 ${storeName} ${storeArea ? `(${storeArea})` : ''}</span>
            ${badge}
          </div>
          <div class="coupon-desc-text">🍺 酔いどれ勇者の酒場特典（後夜祭・指定期間に提示）</div>
          <div class="coupon-footer">
            <span>獲得日: ${new Date(c.acquired_at).toLocaleDateString()}</span>
            <span style="color:var(--text-cyan); font-weight:bold;">${actionTxt}</span>
          </div>
          ${isUsed ? `<div class="coupon-used-stamp">USED</div>` : ''}
        </div>
      `;
    };

    const couponsHtml = (userCoupons.length > 0)
      ? `
        <div class="rpg-window window-purple" style="margin-bottom:14px;">
          <div class="rpg-window-header header-purple">
            <span>🎟️ 所持クーポン・引換券 (${userCoupons.length}件)</span>
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
          <div style="padding:15px; text-align:center; color:var(--text-dim); font-size:13px;">
            現在所持しているクーポン・引換券はありません。<br>酒場をハシゴして特典宝箱を解放しましょう！
          </div>
        </div>
      `;

    // ハシゴ済み店舗一覧
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
            <span class="quest-progress-title">⚔️ 止まらないハシゴ進捗</span>
            <span class="quest-progress-count">${visitedCount} <span style="font-size:13px; color:var(--text-dim);">/ ${totalStores} 軒</span></span>
          </div>
          <div class="quest-progress-bar-bg">
            <div class="quest-progress-bar-fill" style="width: ${progressPercent}%;"></div>
          </div>
        </div>

        <!-- 3. ハシゴ済み店舗一覧 (進捗の直下) -->
        <div class="rpg-window window-green" style="margin-bottom:14px;">
          <div class="rpg-window-header header-green">
            <span>📜 ハシゴ済みリスト (${visitedCount}軒)</span>
          </div>
          <ul class="command-list" style="margin-top:8px;">
            ${visitedStoresHtml || `<li style="padding:15px; text-align:center; color:var(--text-dim); font-size:13px;">まだハシゴ記録がありません。酒場を巡りましょう！</li>`}
          </ul>
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
          <div style="padding: 10px 4px 6px; font-size: 12px; color: var(--text-dim); line-height: 1.5;">
            ※QRコード印刷前の動作確認・レビュー用機能です。店主サインの受取をシミュレートし、5店舗・10店舗・15店舗達成時の宝箱解放や引換テストが行えます。
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px;">
            <button id="btn-quick-test-5visits" class="command-button" style="background: linear-gradient(180deg, #d97706 0%, #b45309 100%); color: #fff; border: 1px solid #f59e0b; padding: 10px 6px; border-radius: 6px; font-weight: bold; font-size: 12px; cursor: pointer;">
              🍺 +5店舗サイン受取
            </button>
            <button id="btn-quick-test-10visits" class="command-button" style="background: linear-gradient(180deg, #b45309 0%, #78350f 100%); color: #fef08a; border: 1px solid #f59e0b; padding: 10px 6px; border-radius: 6px; font-weight: bold; font-size: 12px; cursor: pointer;">
              🍺 +10店舗サイン受取
            </button>
            <button id="btn-quick-test-15visits" class="command-button" style="background: linear-gradient(180deg, #7c2d12 0%, #451a03 100%); color: #fde047; border: 1px solid #eab308; padding: 10px 6px; border-radius: 6px; font-weight: bold; font-size: 12px; cursor: pointer;">
              🍺 +15店舗サイン受取
            </button>
            <button id="btn-quick-test-reset" class="command-button" style="background: #334155; color: #cbd5e1; border: 1px solid #475569; padding: 10px 6px; border-radius: 6px; font-size: 12px; cursor: pointer;">
              🗑️ 履歴リセット
            </button>
          </div>
        </div>
      </div>
    `;

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

        if (isAlreadyClaimed) {
          return `
            <div class="coupon-select-item" style="opacity:0.5; cursor:not-allowed; background:rgba(0,0,0,0.3);">
              <input type="checkbox" disabled checked />
              <div class="coupon-select-item-info">
                <div class="coupon-select-item-name">🏪 ${s.name} <span style="font-size:11px; color:var(--text-dim);">(${s.area || ''})</span></div>
                <div class="coupon-select-item-desc text-green">✅ クーポン取得済み（1店舗1枚限り）</div>
              </div>
            </div>
          `;
        }

        return `
          <div class="coupon-select-item ${isChecked ? 'selected' : ''}" data-store-id="${s.id}">
            <input type="checkbox" ${isChecked ? 'checked' : ''} />
            <div class="coupon-select-item-info">
              <div class="coupon-select-item-name">🏪 ${s.name} <span style="font-size:11px; color:var(--text-dim);">(${s.area || ''})</span></div>
              <div class="coupon-select-item-desc">🎁 酔いどれ勇者の酒場特典（来店時に提示）</div>
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
          対象店舗の中から <strong>${requiredCount} 店舗</strong> を選択してください。<br>
          <span style="font-size:12px; color:var(--text-cyan);">現在 <span id="select-counter">0</span> / ${requiredCount} 店舗 選択中（※${requiredCount}店舗すべて選ぶと確定できます）</span>
        </div>
        <div class="coupon-select-list" id="modal-stores-list">
          ${renderItems()}
        </div>
        <div style="margin-top:10px; display:flex; gap:8px;">
          <button id="modal-confirm-btn" class="staff-redeem-action-btn" style="background:linear-gradient(180deg,#1e824c 0%,#145a32 100%); border-color:var(--text-green); opacity:0.6; cursor:not-allowed;" disabled>
            あと ${requiredCount} 店舗選択してください (計${requiredCount}店舗)
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
          confirmBtn.textContent = `選択した ${requiredCount} 店舗のクーポンを獲得する！`;
          confirmBtn.style.opacity = '1';
          confirmBtn.style.cursor = 'pointer';
        } else {
          const remaining = requiredCount - selectedSet.size;
          confirmBtn.textContent = `あと ${remaining} 店舗選択してください (計${requiredCount}店舗)`;
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
            alert(`この特典で選択できるのは ${requiredCount} 店舗です。他の店舗に変更したい場合は、先に選択済みの店舗のチェックを外してください。`);
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
        alert(`${requiredCount} 店舗すべて選択してください。`);
        return;
      }
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
    const isGoods = coupon.reward_type === 'goods';
    const storeName = isGoods ? (coupon.goods_name || coupon.title) : (coupon.stores?.name || coupon.store_id);
    const storeArea = isGoods ? '' : (coupon.stores?.area || '');
    const isUsed = coupon.status === 'used';

    const overlay = document.createElement('div');
    overlay.className = 'rpg-modal-overlay';
    overlay.id = 'coupon-redeem-modal';

    let contentHtml = '';
    if (isGoods) {
      contentHtml = `
        <div class="staff-redeem-box">
          <div style="font-size:18px; font-weight:bold; color:var(--text-yellow); margin:10px 0;">
            🎁 ${this.escapeHtml(coupon.goods_name || coupon.title)}
          </div>
          <div style="font-size:12px; color:var(--text-cyan); margin-bottom:8px;">
            📍 引換場所: ${this.escapeHtml(coupon.exchange_location || '全参加店舗または運営本部')}
          </div>
          ${coupon.exchange_notice ? `
            <div style="font-size:11px; color:var(--text-dim); margin-bottom:12px; background:rgba(0,0,0,0.3); padding:8px; border-radius:4px; text-align:left;">
              ℹ️ ${this.escapeHtml(coupon.exchange_notice)}
            </div>
          ` : ''}

          ${isUsed ? `
            <div style="padding:15px; border:2px solid #666; border-radius:6px; background:#111;">
              <div class="coupon-used-stamp" style="position:static; transform:none; display:inline-block; margin-bottom:6px;">USED / 受取済み</div>
              <div style="font-size:12px; color:var(--text-dim);">受取日時: ${new Date(coupon.used_at).toLocaleString()}</div>
            </div>
          ` : `
            <div class="staff-warning-banner">
              ⚠️ 【店舗・運営スタッフ専用操作】<br>
              記念品・グッズお渡し時にスタッフへご提示の上、下のボタンをタップして受取消し込みを行ってください。
            </div>
            <button id="btn-staff-redeem" class="staff-redeem-action-btn" style="background:linear-gradient(180deg,#d97706 0%,#b45309 100%); border-color:#f59e0b;">
              🎁 【スタッフ確認】受取済みにする
            </button>
          `}
        </div>
      `;
    } else {
      contentHtml = `
        <div class="staff-redeem-box">
          <div style="font-size:18px; font-weight:bold; color:var(--text-yellow); margin:10px 0;">
            🏪 ${storeName}
          </div>
          <div style="font-size:13px; color:var(--text-dim); margin-bottom:10px;">エリア: ${storeArea || '-'}</div>
          
          <div style="background:#0f152b; border:2px dashed var(--border-gold); padding:12px; border-radius:6px; margin-bottom:14px; text-align:center;">
            <div style="font-size:12px; color:var(--text-cyan); margin-bottom:4px;">【特典チケット】</div>
            <div style="font-size:16px; font-weight:bold; color:#fff; line-height:1.4;">🍺 酔いどれ勇者の酒場特典</div>
            <div style="font-size:11px; color:var(--text-dim); margin-top:6px;">※本日のサービス内容はスタッフへご確認ください</div>
          </div>

          ${isUsed ? `
            <div style="padding:15px; border:2px solid #666; border-radius:6px; background:#111;">
              <div class="coupon-used-stamp" style="position:static; transform:none; display:inline-block; margin-bottom:6px;">USED / 使用済み</div>
              <div style="font-size:12px; color:var(--text-dim);">利用日時: ${new Date(coupon.used_at).toLocaleString()}</div>
            </div>
          ` : (window.questApi?.currentSeason?.statusInfo?.isExpired ? `
            <div style="padding:14px; border:1px solid #ef4444; border-radius:6px; background:#450a0a; color:#fca5a5; font-size:13px; text-align:center;">
              🔒 <strong>利用期限終了</strong><br>
              今期のクーポン利用期間（〜 ${window.questApi.currentSeason.coupon_valid_until}）が終了したため、ご利用いただけません。
            </div>
          ` : (!window.questApi?.currentSeason?.statusInfo?.isCouponUsable ? `
            <div style="padding:16px; border:1px solid #f59e0b; border-radius:6px; background:rgba(245,158,11,0.15); color:#fde68a; font-size:13px; text-align:center; line-height:1.6;">
              🔒 <strong>クーポン利用期間前</strong><br>
              このクーポンは本開催（ハシゴ酒期間）終了後の<br>
              <strong style="color:var(--text-yellow); font-size:15px; display:block; margin:6px 0;">📅 ${window.questApi?.currentSeason?.statusInfo?.couponStartDateStr || '翌日'} 〜 ${window.questApi?.currentSeason?.coupon_valid_until || ''}</strong>
              の期間に各店舗でご利用いただけます。<br>
              <span style="font-size:11px; color:var(--text-dim);">※本開催期間中はハシゴ酒とサイン集めをお楽しみください！</span>
            </div>
          ` : `
            <div class="staff-warning-banner">
              ⚠️ 【店員専用操作】<br>
              お会計時またはご注文時に、店舗スタッフへご提示の上、下のボタンをタップして消し込みを行ってください。
            </div>
            <button id="btn-staff-redeem" class="staff-redeem-action-btn">
              🍺 【店舗スタッフ確認】使用済みにする
            </button>
          `))}
        </div>
      `;
    }

    overlay.innerHTML = `
      <div class="rpg-modal-window gold-border" style="max-width:400px; width:90%;">
        <div class="rpg-window-header" style="display:flex; justify-content:space-between; align-items:center;">
          <span>${isGoods ? '🎁 記念品・グッズ引換画面' : '🎟️ クーポン提示画面'}</span>
          <button id="redeem-close-btn" style="background:none; border:none; color:#fff; font-size:18px; cursor:pointer;">✕</button>
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
          `【店舗・運営スタッフ確認】\n「${storeName}」を受取済みにしますか？\n（受取後は元に戻せません）` : 
          `【店舗スタッフ確認】\n「${storeName}」のクーポンを使用済みにしますか？`;

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
          <span>📷 店頭QRコード読取</span>
          <button id="qr-modal-close-btn" style="background:none; border:none; color:#fff; font-size:18px; cursor:pointer;">✕</button>
        </div>

        <div style="font-size:12px; color:var(--text-yellow); margin-bottom:8px;">
          卓上POPのQRコードをカメラ枠内にかざしてください
        </div>

        <div class="qr-scanner-box" id="qr-scanner-view-box">
          <div id="qr-reader"></div>
          <div class="qr-scanner-reticle"></div>
        </div>

        <div id="qr-scanner-status-text" style="font-size:11px; color:var(--text-dim); margin-bottom:10px; min-height:16px;">
          カメラを起動中...
        </div>

        <div style="display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; gap:6px;">
            <button id="qr-modal-test-5btn" class="command-button" style="flex:1; background: rgba(217, 119, 6, 0.25); border: 1px dashed #f59e0b; color: #fbbf24; font-size: 11px; padding: 7px 4px; border-radius: 4px; cursor: pointer; font-weight: bold;">
              🧪 +5店舗サイン
            </button>
            <button id="qr-modal-test-10btn" class="command-button" style="flex:1; background: rgba(217, 119, 6, 0.25); border: 1px dashed #f59e0b; color: #fbbf24; font-size: 11px; padding: 7px 4px; border-radius: 4px; cursor: pointer; font-weight: bold;">
              🧪 +10店舗サイン
            </button>
            <button id="qr-modal-test-15btn" class="command-button" style="flex:1; background: rgba(217, 119, 6, 0.25); border: 1px dashed #f59e0b; color: #fbbf24; font-size: 11px; padding: 7px 4px; border-radius: 4px; cursor: pointer; font-weight: bold;">
              🧪 +15店舗サイン
            </button>
          </div>
          <button id="qr-modal-cancel-btn" class="treasure-claim-btn" style="background:#333; border-color:#888; padding:8px; font-size:12px;">
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
      if (!confirm(`【テスト実行】新たに【${count}店舗】の店主サインを記録しますか？`)) return;
      this.playFanfareSE();
      const res = await window.questApi.recordMultipleVisitsForTest(count);
      await closeModal();
      if (res.success) {
        alert(`🎉【テスト成功】新たに${res.count}店舗の店主サインを記録しました！（合計: ${res.totalVisits}軒）\n冒険の書から特典宝箱をご確認ください！`);
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
            alert(`読み取ったQRコードの内容: ${decodedText}\n有効な店舗サイン受取用QRコードではありません。`);
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
   * 店主サイン受取・冒険の書への記録処理 (QRコード読み取り時)
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
   * 店主サイン受取・記録完了モーダル (RPG達成演出)
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
        <div style="font-size:12px; color:var(--text-cyan); font-weight:bold;">【冒険の書 記録完了】</div>
        <h3 style="color:var(--text-yellow); margin:6px 0 10px 0; font-size:18px;">
          『${this.escapeHtml ? this.escapeHtml(storeName) : storeName}』
        </h3>
        ${storeArea ? `<div style="font-size:11px; color:var(--text-dim); margin-bottom:8px;">エリア: ${storeArea}</div>` : ''}

        <div style="background:#0f152b; border:1px solid #33406b; border-radius:6px; padding:10px; margin-bottom:12px;">
          <div style="font-size:13px; color:#fff; font-weight:bold;">
            🏆 現在の制覇数: <span style="color:var(--text-green); font-size:16px;">${res.totalVisits} 軒</span>
          </div>
        </div>

        ${unlockedTier ? `
          <div style="background:linear-gradient(135deg, #78350f 0%, #451a03 100%); border:2px solid var(--border-gold); border-radius:6px; padding:12px; margin-bottom:14px; animation:pulseGold 1.5s infinite;">
            <div style="font-size:18px; margin-bottom:4px;">🎁✨</div>
            <div style="font-size:14px; font-weight:bold; color:var(--text-yellow);">
              【${this.escapeHtml ? this.escapeHtml(unlockedTier.title) : unlockedTier.title}】解放！
            </div>
            <div style="font-size:12px; color:#fed7aa; margin-top:4px;">
              ${unlockedTier.reward_type === 'goods' ? 
                `🎁 記念品・グッズ引換券（${this.escapeHtml ? this.escapeHtml(unlockedTier.goods_name || unlockedTier.title) : (unlockedTier.goods_name || unlockedTier.title)}）を獲得できます！` : 
                `対象店舗からお好きなクーポンを ${unlockedTier.selectable_count} 店舗獲得できます！`
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
   * 重複チェックイン案内モーダル (同一店舗はシーズン中1回のみ)
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
        <p style="font-size:13px; color:#cbd5e1; line-height:1.6; margin-bottom:14px;">
          『<strong>${this.escapeHtml ? this.escapeHtml(storeName) : storeName}</strong>』は<br>
          今シーズンすでに冒険の書に記録されています。<br>
          <span style="font-size:11px; color:var(--text-dim);">※ハシゴ制覇カウントは1店舗につき1回となります</span>
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
    this.typeMessage('探したいエリアを選択してください。エリアごとの酒場が表示されます。');

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

    const stores = this.getStores();
    const stylesList = this.getStyles();
    const styleItems = stylesList.map(style => {
      const count = stores.filter(s => s.style === style).length;
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

    const stores = this.getStores();
    const OFFICIAL_TYPES = [
      { type: 'サク飲み', desc: 'サクッと1杯飲んで次のお店へ' },
      { type: '腹ごしらえ', desc: 'しっかりご飯・名物料理でお腹を満たす' },
      { type: 'ひと休み', desc: 'ドリンクや軽食でほっと一息つく' },
      { type: '夜遊び', desc: 'ゲーム・ダーツ・会話や夜の体験を楽しむ' }
    ];

    const typeItems = OFFICIAL_TYPES.map(item => {
      const count = stores.filter(s => s.type === item.type).length;

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
        `;
      }).join('') : `
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
            const store = this.getStores().find(s => s.id === storeId);
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

        <!-- 6. ハシゴ達成クーポン対象枠 -->
        ${isCouponTarget ? `
          <div class="rpg-window gold-border" style="background:#1a1708;">
            <div class="rpg-window-header">
              <span>🎁 ハシゴ達成クーポン対象店舗</span>
            </div>
            <div style="padding:8px 0;">
              <div style="font-size:14px; color:#fff; line-height:1.4;">
                ${this.escapeHtml((store.couponDescription || 'お好きなワンドリンク または 小鉢1品サービス！').replace(/^【街ぶら達成特典】/, '').trim())}
              </div>
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
