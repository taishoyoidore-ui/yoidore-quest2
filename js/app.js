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
    
    // フィルター状態
    this.filters = {
      area: 'ALL',
      category: 'ALL',
      type: 'ALL',
      openToday: false,
      searchQuery: ''
    };

    this.initAudio();
    this.initEvents();
    this.loadXLSXFromDefaultPath();
    this.render();
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
      this.typeMessage('公式案内所へようこそ！大正の町で「酔いどれセット」を探すコマンドを選択してください。');
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
            this.resetFilters();
            this.navigateTo('stores');
          } else {
            this.navigateTo(targetView);
          }
        }
      });
    });
  }

  resetFilters() {
    this.filters = {
      area: 'ALL',
      category: 'ALL',
      type: 'ALL',
      openToday: false,
      searchQuery: ''
    };
  }

  /* ------------------------------------------------------------------------
   * 画面遷移とメッセージ更新
   * ------------------------------------------------------------------------ */
  navigateTo(view, extraData = null) {
    if (view === 'map') {
      window.open('https://maps.app.goo.gl/SqskFzoxuso7NwwL8', '_blank');
      return;
    }

    this.currentView = view;
    if (extraData && extraData.store) {
      this.selectedStore = extraData.store;
    }

    // ボトムナビのハイライト更新
    document.querySelectorAll('.nav-item').forEach(nav => {
      nav.classList.remove('active');
      if (nav.dataset.targetView === view) {
        nav.classList.add('active');
      }
    });

    this.render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    const container = document.getElementById('view-container');
    if (!container) return;

    // 上部画像エリア（ドット絵・バナー）の表示切り替え
    const bannerWrapper = document.getElementById('hero-banner-wrapper');
    if (bannerWrapper) {
      if (this.currentView === 'top') {
        bannerWrapper.innerHTML = `
          <div class="hero-banner-box">
            <img src="assets/banner.png" alt="大正酔いどれクエストⅡ" class="hero-banner-img">
          </div>
        `;
      } else if (this.currentView === 'detail' && this.selectedStore) {
        bannerWrapper.innerHTML = `
          <div class="hero-banner-box">
            <img src="assets/yoidore_set.png" alt="酔いどれセット" class="hero-banner-img">
          </div>
        `;
      } else if (['area', 'category', 'type', 'stores'].includes(this.currentView)) {
        let imageSrc = 'assets/stores_banner.png';
        if (this.currentView === 'area') {
          imageSrc = 'assets/area_banner.png';
        } else if (this.currentView === 'category' || this.currentView === 'type') {
          imageSrc = 'assets/category_banner.png';
        } else if (this.currentView === 'stores') {
          imageSrc = 'assets/stores_banner.png';
        }

        bannerWrapper.innerHTML = `
          <div class="hero-banner-box compact">
            <img src="${imageSrc}" alt="大正酔いどれクエストⅡ" class="hero-banner-img">
          </div>
        `;
      } else {
        bannerWrapper.innerHTML = '';
      }
    }

    container.innerHTML = '';

    switch (this.currentView) {
      case 'top':
        this.renderTopView(container);
        break;
      case 'area':
        this.renderAreaView(container);
        break;
      case 'category':
        this.renderCategoryView(container);
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
      this.typeMessage('公式案内所へようこそ！大正の町で「酔いどれセット」を探すコマンドを選択してください。');
    } else {
      const msgEl = document.getElementById('rpg-message-text');
      if (msgEl) {
        msgEl.textContent = '「ガイドブックを開く」ボタンを押してください。';
      }
    }

    container.innerHTML = `
      <div class="rpg-window gold-border">
        <div class="rpg-window-header">
          <span>▶ コマンドを選択</span>
          <span class="header-badge">酒場案内所</span>
        </div>
        <ul class="command-list">
          <li class="command-item" data-action="area">
            <div class="command-item-left">
              <span class="command-cursor">▶</span>
              <span class="command-label">エリアから探す</span>
            </div>
            <span class="command-badge">5地域</span>
          </li>
          <li class="command-item" data-action="category">
            <div class="command-item-left">
              <span class="command-cursor">▶</span>
              <span class="command-label">店の種類から探す</span>
            </div>
            <span class="command-badge">7ジャンル</span>
          </li>
          <li class="command-item" data-action="type">
            <div class="command-item-left">
              <span class="command-cursor">▶</span>
              <span class="command-label">店舗タイプから探す</span>
            </div>
            <span class="command-badge">はしご/休憩/食事</span>
          </li>
          <li class="command-item" data-action="today">
            <div class="command-item-left">
              <span class="command-cursor">▶</span>
              <span class="command-label">今日営業のお店</span>
            </div>
            <span class="command-badge text-green">営業中</span>
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
            <span class="command-badge">${STORES_DATA.length}店舗</span>
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
        else if (action === 'type') this.navigateTo('type');
        else if (action === 'today') {
          this.resetFilters();
          this.filters.openToday = true;
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
  }

  /* ------------------------------------------------------------------------
   * 3.2 エリア一覧
   * ------------------------------------------------------------------------ */
  renderAreaView(container) {
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
          <span class="header-badge">マップ移動</span>
        </div>
        <ul class="command-list">
          ${areaItems}
        </ul>
      </div>
      <button class="back-btn back-to-top">◀ トップコマンドへ戻る</button>
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

    container.querySelector('.back-to-top').addEventListener('click', () => {
      this.playBackSE();
      this.navigateTo('top');
    });
  }

  /* ------------------------------------------------------------------------
   * 3.3 店の種類一覧
   * ------------------------------------------------------------------------ */
  renderCategoryView(container) {
    this.typeMessage('気になる店の種類（ジャンル）を選択してください。');

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
      <button class="back-btn back-to-top">◀ トップコマンドへ戻る</button>
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

    container.querySelector('.back-to-top').addEventListener('click', () => {
      this.playBackSE();
      this.navigateTo('top');
    });
  }

  /* ------------------------------------------------------------------------
   * 3.4 店舗タイプ一覧
   * ------------------------------------------------------------------------ */
  renderTypeView(container) {
    this.typeMessage('冒険の目的に合わせた店舗タイプを選択してください。');

    const typeItems = TYPES_LIST.map(type => {
      const count = STORES_DATA.filter(s => s.type === type).length;
      let desc = '';
      if (type === 'はしご向け') desc = 'サクッと飲んで次へ行く酒場';
      else if (type === '休憩向け') desc = 'ゆったり寛げるバー・カフェ';
      else if (type === '食事向け') desc = 'しっかりご飯・名物料理を楽しむ';

      return `
        <li class="command-item" data-type="${type}">
          <div class="command-item-left">
            <span class="command-cursor">▶</span>
            <div>
              <div class="command-label">${type}</div>
              <div style="font-size:11px; color:var(--text-dim);">${desc}</div>
            </div>
          </div>
          <span class="command-badge">${count}店舗</span>
        </li>
      `;
    }).join('');

    container.innerHTML = `
      <div class="rpg-window">
        <div class="rpg-window-header">
          <span>▶ 店舗タイプ選択</span>
          <span class="header-badge">スタイル</span>
        </div>
        <ul class="command-list">
          ${typeItems}
        </ul>
      </div>
      <button class="back-btn back-to-top">◀ トップコマンドへ戻る</button>
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

    container.querySelector('.back-to-top').addEventListener('click', () => {
      this.playBackSE();
      this.navigateTo('top');
    });
  }

  /* ------------------------------------------------------------------------
   * 3.7 店舗一覧 (カード形式 & フィルター)
   * ------------------------------------------------------------------------ */
  renderStoresView(container) {
    // フィルタリング処理
    let filtered = STORES_DATA.filter(store => {
      if (this.filters.area !== 'ALL' && store.area !== this.filters.area) return false;
      if (this.filters.category !== 'ALL' && store.category !== this.filters.category) return false;
      if (this.filters.type !== 'ALL' && store.type !== this.filters.type) return false;
      if (this.filters.openToday && !store.isOpenToday) return false;
      if (this.filters.searchQuery) {
        const q = this.filters.searchQuery.toLowerCase();
        return store.name.toLowerCase().includes(q) || 
               store.ruby.toLowerCase().includes(q) ||
               store.catchphrase.toLowerCase().includes(q);
      }
      return true;
    });

    // 五十音順ソート（初期表示順）
    filtered.sort((a, b) => a.ruby.localeCompare(b.ruby, 'ja'));

    this.typeMessage(`条件に一致する店舗が ${filtered.length} 件見つかりました。カードをタップして詳細を確認できます。`);

    const areaOptions = ['ALL', ...AREAS_LIST].map(a => 
      `<option value="${a}" ${this.filters.area === a ? 'selected' : ''}>${a === 'ALL' ? '全エリア' : a}</option>`
    ).join('');

    const catOptions = ['ALL', ...CATEGORIES_LIST].map(c => 
      `<option value="${c}" ${this.filters.category === c ? 'selected' : ''}>${c === 'ALL' ? '全種類' : c}</option>`
    ).join('');

    const typeOptions = ['ALL', ...TYPES_LIST].map(t => 
      `<option value="${t}" ${this.filters.type === t ? 'selected' : ''}>${t === 'ALL' ? '全タイプ' : t}</option>`
    ).join('');

    const cardsHtml = filtered.length > 0 ? filtered.map(store => `
      <div class="store-card" data-id="${store.id}">
        <div class="store-card-header">
          <div class="store-name">
            <span>${store.name}</span>
          </div>
          <span class="store-status-badge ${store.isOpenToday ? 'status-open' : 'status-closed'}">
            ${store.isOpenToday ? '今日営業' : '本日定休'}
          </span>
        </div>

        <div class="store-tags">
          <span class="tag tag-area">${store.area}</span>
          <span class="tag">${store.category}</span>
          <span class="tag tag-type">${store.type}</span>
          ${store.isEventActive ? `<span class="event-active-badge">★ 店舗イベントあり</span>` : ''}
        </div>

        <div class="store-set-preview">
          <span>🍺 ${store.yoidoreSet.title}</span>
          <span class="store-price">¥${store.yoidoreSet.price.toLocaleString()}</span>
        </div>
      </div>
    `).join('') : `
      <div class="rpg-window text-center" style="padding: 20px; color: var(--text-dim);">
        条件に一致する店舗が見つかりませんでした。<br>フィルターを変更してください。
      </div>
    `;

    container.innerHTML = `
      <div class="rpg-window">
        <div class="rpg-window-header">
          <span>▶ 絞り込み条件</span>
          <span class="header-badge">検索フィルター</span>
        </div>
        <div class="filter-box">
          <div class="filter-row">
            <select id="filter-area" class="filter-select">${areaOptions}</select>
            <select id="filter-category" class="filter-select">${catOptions}</select>
          </div>
          <div class="filter-row">
            <select id="filter-type" class="filter-select">${typeOptions}</select>
            <input type="text" id="filter-search" class="search-input" placeholder="店舗名・キーワード検索..." value="${this.filters.searchQuery}">
          </div>
          <div class="filter-chip-group">
            <div class="filter-chip ${this.filters.openToday ? 'active' : ''}" id="chip-open-today">
              ${this.filters.openToday ? '✓ 今日営業のみ' : '今日営業のみ'}
            </div>
          </div>
        </div>
      </div>

      <div class="store-card-list">
        ${cardsHtml}
      </div>

      <button class="back-btn back-to-top">◀ トップコマンドへ戻る</button>
    `;

    // フィルターチェンジイベント
    const updateFiltersAndRender = () => {
      this.playSelectSE();
      this.filters.area = document.getElementById('filter-area').value;
      this.filters.category = document.getElementById('filter-category').value;
      this.filters.type = document.getElementById('filter-type').value;
      this.filters.searchQuery = document.getElementById('filter-search').value;
      this.render();
    };

    document.getElementById('filter-area').addEventListener('change', updateFiltersAndRender);
    document.getElementById('filter-category').addEventListener('change', updateFiltersAndRender);
    document.getElementById('filter-type').addEventListener('change', updateFiltersAndRender);
    
    let searchTimeout;
    document.getElementById('filter-search').addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.filters.searchQuery = e.target.value;
        this.render();
      }, 300);
    });

    document.getElementById('chip-open-today').addEventListener('click', () => {
      this.playSelectSE();
      this.filters.openToday = !this.filters.openToday;
      this.render();
    });

    // カードクリックイベント
    container.querySelectorAll('.store-card').forEach(card => {
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

    container.querySelector('.back-to-top').addEventListener('click', () => {
      this.playBackSE();
      this.navigateTo('top');
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

    this.typeMessage(`「${store.name}」の情報です。酔いどれセットの内容と提供条件を確認してください。`);

    const paymentTagsHtml = store.paymentMethods.map(p => `<span class="payment-tag">${p}</span>`).join('');

    container.innerHTML = `
      <div class="detail-section">
        <div class="rpg-window gold-border">
          <div class="detail-title-block">
            <div style="display:flex; justify-shadow:space-between; align-items:center;">
              <span class="tag tag-area">${store.area}</span>
              <span class="store-status-badge ${store.isOpenToday ? 'status-open' : 'status-closed'}">
                ${store.isOpenToday ? '今日営業中' : '本日定休日'}
              </span>
            </div>
            <h2 class="detail-store-name">${store.name}</h2>
            <div class="detail-catchphrase">"${store.catchphrase}"</div>
          </div>
        </div>

        <!-- 酔いどれセット情報 -->
        <div class="rpg-window">
          <div class="rpg-window-header">
            <span>🍺 酔いどれセット情報</span>
            <span class="header-badge text-green">¥${store.yoidoreSet.price.toLocaleString()}</span>
          </div>
          <table class="info-table">
            <tr>
              <th>セット名</th>
              <td class="text-yellow" style="font-weight:bold;">${store.yoidoreSet.title}</td>
            </tr>
            <tr>
              <th>セット内容</th>
              <td>${store.yoidoreSet.content}</td>
            </tr>
            <tr>
              <th>チャージ等</th>
              <td>
                ${store.yoidoreSet.includeCharge 
                  ? '<span class="text-green">✓ チャージ・つきだし料金含む</span>' 
                  : '<span class="text-red">⚠ チャージ・つきだし別途必要</span>'}
              </td>
            </tr>
          </table>
        </div>

        <!-- 提供条件 -->
        <div class="rpg-window">
          <div class="rpg-window-header">
            <span>📜 セット提供条件</span>
            <span class="header-badge">条件</span>
          </div>
          <table class="info-table">
            <tr>
              <th>提供日/曜日</th>
              <td>${store.conditions.days}</td>
            </tr>
            <tr>
              <th>提供時間</th>
              <td>${store.conditions.hours}</td>
            </tr>
            <tr>
              <th>数量限定</th>
              <td>${store.conditions.limit} ${store.conditions.soldOutEnd ? '（売り切れ次第終了）' : ''}</td>
            </tr>
            <tr>
              <th>注意事項</th>
              <td style="font-size:12px; color:var(--text-dim);">${store.conditions.notes}</td>
            </tr>
          </table>
        </div>

        <!-- 店舗タイプ & イベント -->
        <div class="rpg-window">
          <div class="rpg-window-header">
            <span>🏷 店舗タイプ & イベント</span>
          </div>
          <table class="info-table">
            <tr>
              <th>店舗タイプ</th>
              <td><span class="tag tag-type">${store.type}</span> (${store.category})</td>
            </tr>
            ${store.isEventActive ? `
              <tr>
                <th>店舗イベント</th>
                <td>
                  <div class="event-active-badge" style="margin-bottom:4px;">PARTY QUEST!</div>
                  <div class="text-yellow">${store.eventTitle}</div>
                </td>
              </tr>
            ` : ''}
            <tr>
              <th>支払い方法</th>
              <td><div class="payment-tags">${paymentTagsHtml}</div></td>
            </tr>
          </table>
        </div>

        <!-- 外部リンク -->
        <div class="rpg-window">
          <div style="display:flex; flex-direction:column; gap:8px;">
            <a href="${store.googleMapUrl}" target="_blank" class="external-link-btn">
              <span>📍 Googleマップで場所を確認する</span>
            </a>
            <a href="${store.instagramUrl}" target="_blank" class="external-link-btn" style="background: linear-gradient(180deg, #801848 0%, #380820 100%);">
              <span>📷 店舗Instagramを開く</span>
            </a>
          </div>
        </div>

        <button class="back-btn back-to-stores">◀ 店舗一覧へ戻る</button>
      </div>
    `;

    container.querySelector('.back-to-stores').addEventListener('click', () => {
      this.playBackSE();
      this.navigateTo('stores');
    });
  }
}

// ドム読み込み完了時にアプリ起動
document.addEventListener('DOMContentLoaded', () => {
  window.app = new YoidoreQuestApp();
});
