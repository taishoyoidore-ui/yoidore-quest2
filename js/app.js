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

  resetFilters() {
    this.filters = {
      area: 'ALL',
      category: 'ALL',
      type: 'ALL',
      openToday: false,
      searchQuery: ''
    };
    this.lastStoresScrollY = 0;
  }

  /* ------------------------------------------------------------------------
   * 画面遷移とメッセージ更新
   * ------------------------------------------------------------------------ */
  navigateTo(view, extraData = null) {
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

    // ボトムナビのハイライト更新
    document.querySelectorAll('.nav-item').forEach(nav => {
      nav.classList.remove('active');
      if (nav.dataset.targetView === view) {
        nav.classList.add('active');
      }
    });

    this.render();

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
      this.typeMessage('案内所へようこそ！大正の「オモロイらしい店」を探すコマンドを選択して下さい。');
    } else {
      const msgEl = document.getElementById('rpg-message-text');
      if (msgEl) {
        msgEl.textContent = '「ガイドブックを開く」ボタンを押してください。';
      }
    }

    container.innerHTML = `
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
              <span class="command-label">酔いどれタイプから探す</span>
            </div>
            <span class="command-badge">4タイプ</span>
          </li>
          <li class="command-item" data-action="today">
            <div class="command-item-left">
              <span class="command-cursor">▶</span>
              <span class="command-label">今日営業のお店</span>
            </div>
            <span class="command-badge text-green">営業中 ${STORES_DATA.filter(s => s.isOpenToday).length}店舗</span>
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
   * 3.4 店舗タイプ一覧
   * ------------------------------------------------------------------------ */
  renderTypeView(container) {
    this.typeMessage('目的に合わせた『酔いどれタイプ』を選択してください。');

    // 正式に規定された4つの酔いどれタイプ（案1）と説明文
    const OFFICIAL_TYPES = [
      { type: 'サク飲み', desc: 'サクッと1杯飲んで次のお店へ' },
      { type: 'しっかりご飯', desc: 'しっかりご飯・名物料理でお腹を満たす' },
      { type: 'ひと休み', desc: 'ドリンクや軽食でほっと一息つく' },
      { type: '遊べる・エンタメ', desc: 'ゲーム・ダーツ・会話や体験を楽しむ' }
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
          <span class="header-badge">スタイル</span>
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
    const areaOptions = ['ALL', ...AREAS_LIST].map(a => 
      `<option value="${a}" ${this.filters.area === a ? 'selected' : ''}>${a === 'ALL' ? '全エリア' : a}</option>`
    ).join('');

    const catOptions = ['ALL', ...CATEGORIES_LIST].map(c => 
      `<option value="${c}" ${this.filters.category === c ? 'selected' : ''}>${c === 'ALL' ? '全種類' : c}</option>`
    ).join('');

    const OFFICIAL_TYPE_NAMES = ['サク飲み', 'しっかりご飯', 'ひと休み', '遊べる・エンタメ'];
    const allTypes = Array.from(new Set([...OFFICIAL_TYPE_NAMES, ...TYPES_LIST]));
    const typeOptions = ['ALL', ...allTypes].map(t => 
      `<option value="${t}" ${this.filters.type === t ? 'selected' : ''}>${t === 'ALL' ? '全酔いどれタイプ' : t}</option>`
    ).join('');

    container.innerHTML = `
      <div class="rpg-window">
        <div class="rpg-window-header">
          <span>▶ 絞り込み条件</span>
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

      <div id="stores-card-list-container" class="store-card-list">
        <!-- JSで動的レンダリング -->
      </div>
    `;

    // 店舗カード一覧の部分更新関数（入力欄などのDOMを破棄しない）
    const updateStoreList = () => {
      let filtered = STORES_DATA.filter(store => {
        if (this.filters.area !== 'ALL' && store.area !== this.filters.area) return false;
        if (this.filters.category !== 'ALL' && store.category !== this.filters.category) return false;
        if (this.filters.type !== 'ALL' && store.type !== this.filters.type) return false;
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

      const cardsHtml = filtered.length > 0 ? filtered.map(store => `
        <div class="store-card" data-id="${store.id}">
          <div class="store-card-top-flex">
            <div class="store-card-info-block">
              <div class="store-card-header-row">
                <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                  ${store.area ? `<span class="tag tag-area">${store.area}</span>` : ''}
                  ${store.category ? `<span class="tag">${store.category}</span>` : ''}
                  ${store.type ? `<span class="tag tag-type">${store.type}</span>` : ''}
                </div>
                <span class="store-status-badge ${store.isOpenToday ? 'status-open' : 'status-closed'}">
                  ${store.isOpenToday ? '営業中' : '営業時間外'}
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
                  ${store.yoidoreSet.price > 0 ? `<span class="store-price">¥${store.yoidoreSet.price.toLocaleString()}</span>` : ''}
                </div>
                <div class="preview-title">${store.yoidoreSet.title}</div>
              </div>
            ` : ''}

            ${store.isQuestActive ? `
              <div class="store-quest-preview">
                <div class="preview-header">
                  <span class="preview-label">⚔️ 店舗クエスト:</span>
                  <span class="quest-price-badge">${store.quest.price > 0 ? `¥${store.quest.price.toLocaleString()}` : '🟢 無料'}</span>
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
    };

    // 初回レンダリング
    updateStoreList();

    // ドロップダウン選択チェンジイベント
    const onFilterChange = () => {
      this.playSelectSE();
      this.filters.area = document.getElementById('filter-area').value;
      this.filters.category = document.getElementById('filter-category').value;
      this.filters.type = document.getElementById('filter-type').value;
      this.lastStoresScrollY = 0;
      updateStoreList();
    };

    document.getElementById('filter-area').addEventListener('change', onFilterChange);
    document.getElementById('filter-category').addEventListener('change', onFilterChange);
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
        chip.textContent = this.filters.openToday ? '✓ 今日営業のみ' : '今日営業のみ';
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

    container.innerHTML = `
      <div class="detail-section">
        <!-- 1. 店舗基本情報枠 -->
        <div class="rpg-window gold-border">
          <div class="detail-header-flex">
            <div class="detail-title-block">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
                <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                  ${store.area ? `<span class="tag tag-area">${store.area}</span>` : ''}
                  ${store.category ? `<span class="tag">${store.category}</span>` : ''}
                  ${store.type ? `<span class="tag tag-type">${store.type}</span>` : ''}
                </div>
                <span class="store-status-badge ${store.isOpenToday ? 'status-open' : 'status-closed'}">
                  ${store.isOpenToday ? '現在営業中' : '現在営業時間外'}
                </span>
              </div>
              <h2 class="detail-store-name" style="margin-top:10px;">${store.name}</h2>
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
                <td class="text-yellow" style="font-weight:bold;">${store.yoidoreSet.title}</td>
              </tr>
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
                    <strong class="text-yellow" style="font-size:17px;">¥${store.yoidoreSet.price.toLocaleString()}</strong>
                    <span style="font-size:13px; color:var(--text-dim); margin-left:6px;">(税込・${store.yoidoreSet.charge === '不要' ? 'チャージ不要' : 'チャージ込'})</span>
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
                    <strong class="text-yellow" style="font-size:17px;">¥${store.quest.price.toLocaleString()}</strong>
                    <span style="font-size:13px; color:var(--text-dim); margin-left:6px;">(税込・${store.quest.charge === '込' ? 'チャージ込' : 'チャージ不要'})</span>
                  ` : `
                    <span class="quest-fee-badge">🟢 無料</span>
                    <span style="font-size:13px; color:var(--text-dim); margin-left:6px;">(${store.quest.charge === '込' ? 'チャージ込' : 'チャージ不要'})</span>
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

        <!-- 1つ前の画面（検索結果）へ戻るボタン -->
        <button class="back-btn back-to-stores-smart" type="button" style="margin-top: 14px;">
          ◀ 1つ前の画面へ戻る
        </button>
      </div>
    `;

    container.querySelectorAll('.external-link-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.playSelectSE();
      });
    });

    container.querySelector('.back-to-stores-smart').addEventListener('click', () => {
      this.playSelectSE();
      this.navigateTo('stores');
    });
  }
}

// ドム読み込み完了時にアプリ起動
document.addEventListener('DOMContentLoaded', () => {
  window.app = new YoidoreQuestApp();
});
