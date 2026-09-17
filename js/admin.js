/**
 * 大正酔いどれクエスト - バックオフィス管理システムロジック
 */

class YoidoreAdminApp {
  constructor() {
    this.adminPin = 'yoidore2026'; // 初期管理者パスワード
    this.api = window.questApi;
    this.stores = [];
    this.users = [];
    this.visits = [];
    this.coupons = [];
    this.tiers = [];
    this.heroTitles = [];
    this.seasons = [];
    this.selectedSeasonId = 2;
    this.activeTab = 'dashboard';
    this.activeLogSubTab = 'users';

    this.init();
  }

  async init() {
    this.checkAuthSession();
    this.setupEventListeners();
  }

  /* ------------------------------------------------------------------------
   * 認証制御
   * ------------------------------------------------------------------------ */
  checkAuthSession() {
    const isAuth = sessionStorage.getItem('yoidore_admin_auth');
    if (isAuth === 'true') {
      this.showAdminApp();
    } else {
      document.getElementById('auth-lock-modal').style.display = 'flex';
      document.getElementById('admin-app').style.display = 'none';
    }
  }

  handleLogin() {
    const inputPin = document.getElementById('admin-pin').value.trim();
    if (inputPin === this.adminPin) {
      sessionStorage.setItem('yoidore_admin_auth', 'true');
      document.getElementById('auth-error').style.display = 'none';
      this.showAdminApp();
    } else {
      document.getElementById('auth-error').style.display = 'block';
    }
  }

  handleLogout() {
    if (confirm('管理画面からログアウトしますか？')) {
      sessionStorage.removeItem('yoidore_admin_auth');
      window.location.reload();
    }
  }

  showAdminApp() {
    document.getElementById('auth-lock-modal').style.display = 'none';
    document.getElementById('admin-app').style.display = 'flex';
    this.loadAllData();
  }

  /* ------------------------------------------------------------------------
   * イベントリスナー設定
   * ------------------------------------------------------------------------ */
  setupEventListeners() {
    // ナビゲーション切り替え
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = item.dataset.tab;
        this.switchTab(tab);
      });
    });

    // ハッシュ変更監視
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && ['dashboard', 'stores', 'tiers', 'logs', 'pop'].includes(hash)) {
        this.switchTab(hash, false);
      }
    });
  }

  toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open');
  }

  switchTab(tabId, updateHash = true) {
    this.activeTab = tabId;
    if (updateHash) window.location.hash = tabId;

    // ナビUI
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tabId);
    });

    // タブペイン
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `tab-${tabId}`);
    });

    // ヘッダータイトル更新
    const titles = {
      dashboard: 'リアルタイムダッシュボード',
      stores: '店舗マスター管理',
      tiers: 'シーズン・開催設定',
      logs: '参加者・データ管理',
      pop: '店頭POP・QRコード一括印刷'
    };
    document.getElementById('page-title').textContent = titles[tabId] || '管理画面';

    // スマホサイドバーを閉じる
    document.getElementById('sidebar').classList.remove('open');

    // 必要に応じた個別描画
    if (tabId === 'pop') this.renderPopCards();
  }

  /* ------------------------------------------------------------------------
   * 全データ取得 (Supabase)
   * ------------------------------------------------------------------------ */
  async loadAllData() {
    this.showToast('データをSupabaseから読み込み中...', 1500);
    const syncElem = document.getElementById('last-sync-time');
    syncElem.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i> 同期中...';

    try {
      // 1. シーズン情報
      this.seasons = await this.api.getSeasons();
      const currentSeason = await this.api.getCurrentSeason();
      if (currentSeason) {
        this.selectedSeasonId = currentSeason.id;
      }

      // 2. 店舗データ
      this.stores = await this.api.getStores(true);

      // 3. 特典ランクデータ (選択中シーズン)
      this.tiers = await this.api.getRewardTiers(this.selectedSeasonId);

      // 3.5 勇者レベル・称号マスタデータ
      this.heroTitles = await this.api.getHeroTitles();

      // 4. ユーザー一覧
      try {
        this.users = await this.api.supabaseFetch('users?select=*&order=created_at.desc');
      } catch (e) {
        this.users = [];
      }

      // 5. 来店ログ一覧
      try {
        this.visits = await this.api.supabaseFetch(`visits?select=*&order=visited_at.desc`);
      } catch (e) {
        this.visits = [];
      }

      // 6. クーポン発行・消し込み履歴
      try {
        this.coupons = await this.api.supabaseFetch(`user_coupons?select=*&order=acquired_at.desc`);
      } catch (e) {
        this.coupons = [];
      }

      // 画面反映
      this.renderSeasonSelector();
      this.renderStatusBanner();
      this.renderDashboard();
      this.renderStoresTable();
      this.renderSeasonSettings();
      this.renderLogs();
      this.renderPopStoreSelect();

      const now = new Date();
      syncElem.innerHTML = `<i class="fa-solid fa-check text-success"></i> 同期済: ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    } catch (err) {
      console.error('データ取得エラー:', err);
      syncElem.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-danger"></i> 同期失敗';
      this.showToast('データ取得に失敗しました: ' + err.message, 3000);
    }
  }

  async refreshData() {
    await this.loadAllData();
    this.showToast('最新データに更新しました！');
  }

  /* ------------------------------------------------------------------------
   * シーズン切替制御
   * ------------------------------------------------------------------------ */
  renderSeasonSelector() {
    const sel = document.getElementById('season-selector');
    if (!sel) return;
    sel.innerHTML = this.seasons.map(s => `
      <option value="${s.id}" ${s.id === this.selectedSeasonId ? 'selected' : ''}>
        第${s.id}回: ${this.escapeHtml(s.name)}${s.is_active ? ' (現在開催中)' : ''}
      </option>
    `).join('');
  }

  async onSeasonSelectChange(seasonId) {
    this.selectedSeasonId = parseInt(seasonId, 10);
    this.showToast(`第${this.selectedSeasonId}回のデータに切り替え中...`);
    await this.loadAllData();
  }

  renderStatusBanner() {
    const current = this.seasons.find(s => s.id === this.selectedSeasonId) || this.api.currentSeason;
    const banner = document.getElementById('dashboard-status-banner');
    const icon = document.getElementById('banner-icon');
    const title = document.getElementById('banner-title');
    const desc = document.getElementById('banner-desc');
    const timer = document.getElementById('banner-timer');

    if (!banner || !current) return;

    const now = new Date();
    const startDate = new Date(current.start_date);
    const endDate = new Date(current.end_date);
    endDate.setHours(23, 59, 59, 999);
    const validUntil = new Date(current.coupon_valid_until);
    validUntil.setHours(23, 59, 59, 999);

    banner.className = 'status-banner mb-4';

    if (now < startDate) {
      // 開催前
      banner.classList.add('banner-warning');
      icon.textContent = '⏳';
      title.textContent = `【開催前】${current.name}`;
      desc.textContent = `開催予定: ${current.start_date} 〜 ${current.end_date}`;
      const days = Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      timer.textContent = `開幕まであと ${days} 日`;
    } else if (now <= endDate) {
      // 本開催中
      banner.classList.add('banner-active');
      icon.textContent = '🍺';
      title.textContent = `【本開催中】${current.name}`;
      desc.textContent = `はしご酒クエスト開催中！ (〜 ${current.end_date} まで)`;
      const days = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      timer.textContent = `開催終了まであと ${days} 日`;
    } else if (now <= validUntil) {
      // 後夜祭（クーポン利用期間）
      banner.classList.add('banner-warning');
      icon.textContent = '⚠️';
      title.textContent = `【後夜祭・クーポン利用期間】${current.name}`;
      desc.textContent = `本開催は終了しました。クーポンの利用期限は ${current.coupon_valid_until} までです！`;
      const days = Math.max(0, Math.ceil((validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      timer.textContent = `クーポン期限まであと ${days} 日`;
    } else {
      // 終了
      banner.classList.add('banner-expired');
      icon.textContent = '🔒';
      title.textContent = `【期間終了】${current.name}`;
      desc.textContent = `今期のクエストおよびクーポン利用期間はすべて終了いたしました。`;
      timer.textContent = `終了済`;
    }
  }

  /* ------------------------------------------------------------------------
   * 1. ダッシュボード描画
   * ------------------------------------------------------------------------ */
  renderDashboard() {
    // KPI
    document.getElementById('kpi-users-count').textContent = this.users.length.toLocaleString();
    document.getElementById('kpi-visits-count').textContent = this.visits.length.toLocaleString();
    document.getElementById('kpi-coupons-issued').textContent = this.coupons.length.toLocaleString();
    
    const usedCoupons = this.coupons.filter(c => c.status === 'used');
    document.getElementById('kpi-coupons-used').textContent = `${usedCoupons.length.toLocaleString()} 枚`;

    // 来店ランキング TOP 5
    const storeVisitsMap = {};
    this.visits.forEach(v => {
      storeVisitsMap[v.store_id] = (storeVisitsMap[v.store_id] || 0) + 1;
    });

    const sortedStores = Object.entries(storeVisitsMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topStoresElem = document.getElementById('top-stores-ranking');
    if (sortedStores.length === 0) {
      topStoresElem.innerHTML = '<div class="empty-state text-muted py-3">今期の来店・サイン受取データがありません</div>';
    } else {
      topStoresElem.innerHTML = sortedStores.map(([storeId, count], idx) => {
        const store = this.stores.find(s => s.id === storeId);
        const storeName = store ? store.name : storeId;
        return `
          <div class="ranking-item">
            <div style="display: flex; align-items: center;">
              <span class="rank-badge rank-${idx + 1}">${idx + 1}</span>
              <strong style="color: #0f172a;">${this.escapeHtml(storeName)}</strong>
            </div>
            <div>
              <span class="tag tag-area">${store ? store.area : ''}</span>
              <strong style="color: #b45309; margin-left: 8px;">${count} 来店</strong>
            </div>
          </div>
        `;
      }).join('');
    }

    // クーポン人気 TOP 5
    const couponStoreMap = {};
    this.coupons.forEach(c => {
      couponStoreMap[c.store_id] = (couponStoreMap[c.store_id] || 0) + 1;
    });

    const sortedCoupons = Object.entries(couponStoreMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topCouponsElem = document.getElementById('top-coupons-ranking');
    if (sortedCoupons.length === 0) {
      topCouponsElem.innerHTML = '<div class="empty-state text-muted py-3">今期のクーポン獲得データがありません</div>';
    } else {
      topCouponsElem.innerHTML = sortedCoupons.map(([storeId, count], idx) => {
        const store = this.stores.find(s => s.id === storeId);
        const storeName = store ? store.name : storeId;
        return `
          <div class="ranking-item">
            <div style="display: flex; align-items: center;">
              <span class="rank-badge rank-${idx + 1}">${idx + 1}</span>
              <strong style="color: #0f172a;">${this.escapeHtml(storeName)}</strong>
            </div>
            <div>
              <strong style="color: #10b981;">${count} 回選択</strong>
            </div>
          </div>
        `;
      }).join('');
    }

    // リアルタイムアクティビティ速報
    const activityElem = document.getElementById('recent-activity-list');
    const recentVisits = this.visits.slice(0, 5).map(v => ({
      type: 'visit',
      time: new Date(v.visited_at),
      storeId: v.store_id,
      userId: v.user_id
    }));

    const recentCoupons = this.coupons.slice(0, 5).map(c => ({
      type: c.status === 'used' ? 'used' : 'acquired',
      time: new Date(c.used_at || c.acquired_at),
      storeId: c.store_id,
      userId: c.user_id
    }));

    const allActivities = [...recentVisits, ...recentCoupons]
      .sort((a, b) => b.time - a.time)
      .slice(0, 6);

    if (allActivities.length === 0) {
      activityElem.innerHTML = '<div class="empty-state text-muted py-3">まだアクティビティがありません</div>';
    } else {
      activityElem.innerHTML = allActivities.map(act => {
        const store = this.stores.find(s => s.id === act.storeId);
        const storeName = store ? store.name : act.storeId;
        const user = this.users.find(u => u.line_user_id === act.userId);
        const userName = user ? user.display_name : '冒険者';

        let icon = '🍺';
        let text = `<strong>${this.escapeHtml(userName)}</strong> が <strong>${this.escapeHtml(storeName)}</strong> の店主サインを受け取りました`;
        if (act.type === 'acquired') {
          icon = '🎁';
          text = `<strong>${this.escapeHtml(userName)}</strong> が <strong>${this.escapeHtml(storeName)}</strong> のクーポンを獲得しました`;
        } else if (act.type === 'used') {
          icon = '✅';
          text = `<strong>${this.escapeHtml(userName)}</strong> が <strong>${this.escapeHtml(storeName)}</strong> でクーポンを利用（消し込み）しました`;
        }

        const timeStr = `${act.time.getMonth() + 1}/${act.time.getDate()} ${String(act.time.getHours()).padStart(2, '0')}:${String(act.time.getMinutes()).padStart(2, '0')}`;

        return `
          <div class="activity-item">
            <div>
              <span style="font-size: 1.1rem; margin-right: 6px;">${icon}</span>
              ${text}
            </div>
            <div class="activity-time">${timeStr}</div>
          </div>
        `;
      }).join('');
    }
  }

  /* ------------------------------------------------------------------------
   * 2. 店舗マスター管理
   * ------------------------------------------------------------------------ */
  renderStoresTable(filtered = null) {
    const stores = filtered || this.stores;
    const tbody = document.getElementById('store-table-body');

    const areaFilter = document.getElementById('area-filter');
    if (areaFilter.children.length <= 1) {
      const areas = Array.from(new Set(this.stores.map(s => s.area))).filter(Boolean);
      areas.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a;
        opt.textContent = a;
        areaFilter.appendChild(opt);
      });
    }

    if (stores.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">該当する店舗がありません</td></tr>';
      return;
    }

    tbody.innerHTML = stores.map(store => {
      const isCoupon = store.is_coupon_target !== false;
      return `
        <tr>
          <td><code>${this.escapeHtml(store.id)}</code></td>
          <td>
            <div class="table-store-name">${this.escapeHtml(store.name)}</div>
            <small class="text-muted">${this.escapeHtml(store.catchphrase || '')}</small>
          </td>
          <td><span class="tag tag-area">${this.escapeHtml(store.area || '')}</span></td>
          <td>
            <span class="tag tag-category">${this.escapeHtml(store.category || '')}</span>
            <small class="text-muted d-block">${this.escapeHtml(store.style || '')}</small>
          </td>
          <td>
            <div style="font-weight: 500;">${this.escapeHtml(store.set_name || '酔いどれセット')}</div>
            <small style="color: #b45309; font-weight: bold;">¥${(store.set_price || 0).toLocaleString()}</small>
          </td>
          <td>
            <div>${this.escapeHtml(store.quest_name || '-')}</div>
            <small class="text-muted">¥${(store.quest_price || 0).toLocaleString()}</small>
          </td>
          <td style="text-align: center;">
            <button class="btn btn-sm ${isCoupon ? 'btn-primary' : 'btn-secondary'}" onclick="window.adminApp.toggleCouponTarget('${store.id}')" title="クリックで切替">
              ${isCoupon ? '✅ 対象' : '❌ 対象外'}
            </button>
          </td>
          <td style="text-align: center;">
            <button class="btn btn-sm btn-secondary" onclick="window.adminApp.openStoreModal('${store.id}')">
              <i class="fa-solid fa-pen"></i> 編集
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  filterStores() {
    const search = document.getElementById('store-search').value.toLowerCase().trim();
    const area = document.getElementById('area-filter').value;
    const couponTarget = document.getElementById('coupon-target-filter').value;

    const filtered = this.stores.filter(s => {
      const matchSearch = !search || 
        (s.name && s.name.toLowerCase().includes(search)) ||
        (s.area && s.area.toLowerCase().includes(search)) ||
        (s.category && s.category.toLowerCase().includes(search)) ||
        (s.set_content && s.set_content.toLowerCase().includes(search));
      
      const matchArea = !area || s.area === area;
      const matchCoupon = !couponTarget || 
        (couponTarget === 'true' && s.is_coupon_target !== false) ||
        (couponTarget === 'false' && s.is_coupon_target === false);

      return matchSearch && matchArea && matchCoupon;
    });

    this.renderStoresTable(filtered);
  }

  async toggleCouponTarget(storeId) {
    const store = this.stores.find(s => s.id === storeId);
    if (!store) return;

    const newStatus = store.is_coupon_target === false ? true : false;
    store.is_coupon_target = newStatus;

    try {
      await this.api.supabaseFetch(`stores?id=eq.${storeId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_coupon_target: newStatus })
      });
      this.showToast(`${store.name} のクーポン取扱を【${newStatus ? '対象' : '対象外'}】に更新しました`);
      this.renderStoresTable();
    } catch (err) {
      alert('更新に失敗しました: ' + err.message);
    }
  }

  openStoreModal(storeId) {
    const isNew = storeId === 'new';
    document.getElementById('edit-store-mode').value = isNew ? 'new' : 'edit';
    document.getElementById('store-modal-title').textContent = isNew ? '新規店舗の登録' : '店舗情報の編集';
    document.getElementById('edit-store-id').readOnly = !isNew;

    let store = {};
    if (!isNew) {
      store = this.stores.find(s => s.id === storeId) || {};
    } else {
      const maxNum = this.stores.reduce((max, s) => {
        const num = parseInt((s.id || '').replace('store-', ''), 10);
        return isNaN(num) ? max : Math.max(max, num);
      }, 0);
      store = {
        id: `store-${String(maxNum + 1).padStart(2, '0')}`,
        name: '',
        area: '三軒家西',
        category: '居酒屋',
        set_price: 1000,
        quest_price: 0,
        is_coupon_target: true
      };
    }

    const raw = store.raw_data || {};
    const quest = raw.quest || {};
    const yoidoreSet = raw.yoidoreSet || {};
    const conditions = raw.conditions || {};
    const numId = (store.id || '').replace(/\D/g, '').padStart(3, '0');

    document.getElementById('edit-store-id').value = store.id || '';
    document.getElementById('edit-store-name').value = store.name || '';
    document.getElementById('edit-store-area').value = store.area || raw['エリア'] || '';
    document.getElementById('edit-store-category').value = store.category || raw['カテゴリ'] || raw['category'] || '';
    document.getElementById('edit-store-style').value = store.style || raw['スタイル'] || raw['style'] || '';
    document.getElementById('edit-store-type').value = store.yoidore_type || store.type || raw['タイプ'] || raw['酔いどれタイプ'] || raw['type'] || '';
    
    const isTakeout = store.takeout === true || store.takeout === 'テイクアウトOK' || store.takeout === '可能' || store.isTakeout || raw['テイクアウト'] === 'テイクアウトOK' || raw['テイクアウト'] === '可' || raw.isTakeout;
    document.getElementById('edit-store-takeout').value = isTakeout ? 'true' : 'false';

    document.getElementById('edit-store-catchphrase').value = store.catchphrase || raw['キャッチコピー'] || raw['catchphrase'] || '';
    document.getElementById('edit-store-days').value = store.days || conditions.days || raw['提供日'] || '';
    document.getElementById('edit-store-hours').value = store.hours || conditions.hours || raw['提供時間'] || raw['営業時間'] || '';
    document.getElementById('edit-store-payment').value = store.payment || (Array.isArray(raw.paymentMethods) ? raw.paymentMethods.join(', ') : (raw['決済方法'] || ''));

    document.getElementById('edit-store-set-name').value = store.set_name || yoidoreSet.title || raw['酔いどれセット名'] || raw['セット名'] || '';
    document.getElementById('edit-store-set-price').value = store.set_price !== undefined ? store.set_price : (yoidoreSet.price || raw['価格'] || raw['セット価格'] || 1000);
    document.getElementById('edit-store-set-content').value = store.set_content || yoidoreSet.content || raw['セット内容'] || '';
    document.getElementById('edit-store-set-charge').value = store.set_charge || yoidoreSet.charge || raw['チャージ'] || raw['チャージ有無'] || '';
    document.getElementById('edit-store-set-limit').value = store.set_limit || conditions.limit || raw['限定数'] || '';
    document.getElementById('edit-store-set-notes').value = store.set_notes || yoidoreSet.notes || raw['セット備考'] || raw['備考'] || '';

    document.getElementById('edit-store-quest-name').value = store.quest_name || quest.title || raw['クエスト名'] || raw['クエストタイトル'] || '';
    document.getElementById('edit-store-quest-price').value = store.quest_price !== undefined ? store.quest_price : (quest.price || raw['クエスト価格'] || 0);
    document.getElementById('edit-store-quest-content').value = store.quest_content || quest.content || raw['クエスト内容'] || '';

    document.getElementById('edit-store-map-url').value = store.map_url || raw.googleMapUrl || raw['Google Map URL'] || raw['map_url'] || '';
    document.getElementById('edit-store-insta-url').value = store.insta_url || raw.instagramUrl || raw['Instagram URL'] || raw['insta_url'] || '';
    document.getElementById('edit-store-photo-url').value = store.photo_url || store.photoUrl || raw['photoUrl'] || raw['photo'] || (numId ? `photo/${numId}.jpg` : '');
    document.getElementById('edit-store-logo-url').value = store.logo_url || store.logoUrl || raw['logoUrl'] || raw['logo'] || (numId ? `logo/${numId}.png` : '');
    document.getElementById('edit-store-coupon-target').checked = store.is_coupon_target !== false;

    document.getElementById('store-modal').style.display = 'flex';
  }

  closeStoreModal() {
    document.getElementById('store-modal').style.display = 'none';
  }

  async saveStore() {
    const isNew = document.getElementById('edit-store-mode').value === 'new';
    const storeId = document.getElementById('edit-store-id').value.trim();
    if (!storeId) return alert('店舗IDは必須です');

    const storeData = {
      id: storeId,
      name: document.getElementById('edit-store-name').value.trim(),
      area: document.getElementById('edit-store-area').value.trim(),
      category: document.getElementById('edit-store-category').value.trim(),
      style: document.getElementById('edit-store-style').value.trim(),
      yoidore_type: document.getElementById('edit-store-type').value.trim(),
      takeout: document.getElementById('edit-store-takeout').value === 'true',
      catchphrase: document.getElementById('edit-store-catchphrase').value.trim(),
      days: document.getElementById('edit-store-days').value.trim(),
      hours: document.getElementById('edit-store-hours').value.trim(),
      payment: document.getElementById('edit-store-payment').value.trim(),
      set_name: document.getElementById('edit-store-set-name').value.trim(),
      set_price: parseInt(document.getElementById('edit-store-set-price').value, 10) || 0,
      set_content: document.getElementById('edit-store-set-content').value.trim(),
      set_charge: document.getElementById('edit-store-set-charge').value.trim(),
      set_limit: document.getElementById('edit-store-set-limit').value.trim(),
      set_notes: document.getElementById('edit-store-set-notes').value.trim(),
      quest_name: document.getElementById('edit-store-quest-name').value.trim(),
      quest_price: parseInt(document.getElementById('edit-store-quest-price').value, 10) || 0,
      quest_content: document.getElementById('edit-store-quest-content').value.trim(),
      map_url: document.getElementById('edit-store-map-url').value.trim(),
      insta_url: document.getElementById('edit-store-insta-url').value.trim(),
      photo_url: document.getElementById('edit-store-photo-url').value.trim(),
      logo_url: document.getElementById('edit-store-logo-url').value.trim(),
      is_coupon_target: document.getElementById('edit-store-coupon-target').checked
    };

    try {
      this.showToast('Supabaseへ保存中...');
      if (isNew) {
        await this.api.supabaseFetch('stores', {
          method: 'POST',
          body: JSON.stringify(storeData)
        });
      } else {
        await this.api.supabaseFetch(`stores?id=eq.${storeId}`, {
          method: 'PATCH',
          body: JSON.stringify(storeData)
        });
      }

      this.closeStoreModal();
      this.showToast(`店舗「${storeData.name}」のデータを保存しました！`);
      await this.loadAllData();
    } catch (err) {
      alert('保存に失敗しました: ' + err.message);
    }
  }

  /* ------------------------------------------------------------------------
   * 3. シーズン・開催設定
   * ------------------------------------------------------------------------ */
  renderSeasonSettings() {
    // シーズン一覧カード
    const seasonsListElem = document.getElementById('seasons-list');
    if (this.seasons.length === 0) {
      seasonsListElem.innerHTML = '<div class="empty-state text-muted py-3">シーズンデータがありません</div>';
    } else {
      seasonsListElem.innerHTML = this.seasons.map(s => {
        const isCurrent = s.id === this.selectedSeasonId;
        return `
          <div class="season-card ${isCurrent ? 'active' : ''}">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <strong style="font-size: 1.05rem; color: #0f172a;">第${s.id}回: ${this.escapeHtml(s.name)}</strong>
                  ${s.is_active ? '<span class="tag tag-active">開催中</span>' : '<span class="tag tag-area">準備/過去</span>'}
                </div>
                <div class="text-muted" style="font-size: 0.85rem; margin-top: 4px;">
                  📅 開催: ${s.start_date} 〜 ${s.end_date} ｜ 🎟️ クーポン期限: ${s.coupon_valid_until}
                </div>
              </div>
              <div>
                ${!s.is_active ? `
                  <button class="btn btn-sm btn-primary" onclick="window.adminApp.activateSeason(${s.id})">
                    <i class="fa-solid fa-bolt"></i> この回を開催中に切替
                  </button>
                ` : `
                  <span class="text-success" style="font-weight: bold; font-size: 0.85rem;"><i class="fa-solid fa-check"></i> 現在稼働中</span>
                `}
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    // 編集フォーム値
    const current = this.seasons.find(s => s.id === this.selectedSeasonId) || this.api.currentSeason;
    if (current) {
      document.getElementById('edit-season-name').value = current.name || '';
      document.getElementById('edit-season-start').value = current.start_date || '2026-08-01';
      document.getElementById('edit-season-end').value = current.end_date || '2026-08-31';
      document.getElementById('edit-season-valid').value = current.coupon_valid_until || '2026-09-30';
    }

    // 特典一覧のレンダリング
    this.renderRewardTiers();

    // 勇者称号マスタのレンダリング
    this.renderHeroTitles();
  }

  /* ------------------------------------------------------------------------
   * 特典ランク (reward_tiers) CRUD制御
   * ------------------------------------------------------------------------ */
  renderRewardTiers() {
    const tierElem = document.getElementById('reward-tiers-list');
    if (!tierElem) return;

    if (this.tiers.length === 0) {
      tierElem.innerHTML = '<div class="empty-state text-muted py-3" style="grid-column: 1 / -1;">今シーズンの特典マイルストーンが登録されていません。「＋ 特典ランクを新規作成」から追加してください。</div>';
      return;
    }

    tierElem.innerHTML = this.tiers.map(t => {
      const isGoods = t.reward_type === 'goods';
      return `
        <div class="tier-admin-card">
          <div>
            <div class="tier-admin-header">
              <span class="tier-admin-title">🏆 ${this.escapeHtml(t.title)}</span>
              <span class="tag ${isGoods ? 'tag-warning' : 'tag-active'}" style="font-size: 0.75rem;">
                ${isGoods ? '🎁 グッズ引換型' : '🍺 店舗クーポン型'}
              </span>
            </div>
            <div class="tier-admin-meta">
              <span class="tier-meta-badge"><i class="fa-solid fa-beer-mug-empty"></i> 必要: <strong>${t.required_visits}</strong> 軒</span>
              ${isGoods ? 
                `<span class="tier-meta-badge"><i class="fa-solid fa-gift"></i> グッズ: <strong>${this.escapeHtml(t.goods_name || 'オリジナル記念品')}</strong></span>` :
                `<span class="tier-meta-badge"><i class="fa-solid fa-ticket"></i> 獲得: <strong>${t.selectable_count}</strong> 店舗</span>`
              }
            </div>
            ${isGoods && t.exchange_location ? `
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
                <i class="fa-solid fa-location-dot"></i> 引換場所: ${this.escapeHtml(t.exchange_location)}
              </div>
            ` : ''}
            <div class="tier-admin-desc">${this.escapeHtml(t.description || '説明なし')}</div>
          </div>
          <div class="tier-admin-actions">
            <button class="btn btn-sm btn-secondary" onclick="window.adminApp.openTierModal(${t.id})">
              <i class="fa-solid fa-pen"></i> 編集
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="window.adminApp.deleteTier(${t.id}, '${this.escapeHtml(t.title)}')">
              <i class="fa-solid fa-trash"></i> 削除
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  toggleTierTypeUI() {
    const isGoods = document.getElementById('edit-tier-type-goods').checked;
    const couponSettings = document.getElementById('tier-coupon-settings');
    const goodsSettings = document.getElementById('tier-goods-settings');
    if (couponSettings) couponSettings.style.display = isGoods ? 'none' : 'block';
    if (goodsSettings) goodsSettings.style.display = isGoods ? 'block' : 'none';
  }

  openTierModal(tierIdOrMode) {
    const isNew = tierIdOrMode === 'new';
    document.getElementById('tier-modal-title').innerHTML = isNew ? 
      '<i class="fa-solid fa-gift"></i> 新規特典ランクの作成' : 
      '<i class="fa-solid fa-pen-to-square"></i> 特典ランクの編集';

    let tier = {};
    if (!isNew) {
      tier = this.tiers.find(t => t.id === Number(tierIdOrMode)) || {};
    } else {
      const maxVisits = this.tiers.reduce((max, t) => Math.max(max, t.required_visits || 0), 0);
      tier = {
        id: '',
        reward_type: 'store_coupon',
        title: `${maxVisits ? maxVisits + 5 : 5}軒はしご達成特典`,
        required_visits: maxVisits ? maxVisits + 5 : 5,
        selectable_count: 5,
        goods_name: '',
        exchange_location: '',
        exchange_notice: '',
        description: 'クーポン取扱店の中からお好きな店舗を選んで特典チケットを獲得！'
      };
    }

    const isGoods = tier.reward_type === 'goods';
    if (document.getElementById('edit-tier-type-goods')) {
      document.getElementById('edit-tier-type-goods').checked = isGoods;
      document.getElementById('edit-tier-type-coupon').checked = !isGoods;
    }
    this.toggleTierTypeUI();

    document.getElementById('edit-tier-id').value = tier.id || '';
    document.getElementById('edit-tier-title').value = tier.title || '';
    document.getElementById('edit-tier-required').value = tier.required_visits || 5;
    document.getElementById('edit-tier-selectable').value = tier.selectable_count || 5;
    document.getElementById('edit-tier-goods-name').value = tier.goods_name || '';
    document.getElementById('edit-tier-exchange-loc').value = tier.exchange_location || '';
    document.getElementById('edit-tier-exchange-notice').value = tier.exchange_notice || '';
    document.getElementById('edit-tier-desc').value = tier.description || '';

    document.getElementById('tier-modal').style.display = 'flex';
  }

  closeTierModal() {
    document.getElementById('tier-modal').style.display = 'none';
  }

  async saveTierForm() {
    const idVal = document.getElementById('edit-tier-id').value;
    const isGoods = document.getElementById('edit-tier-type-goods').checked;
    const reward_type = isGoods ? 'goods' : 'store_coupon';
    const title = document.getElementById('edit-tier-title').value.trim();
    const required_visits = parseInt(document.getElementById('edit-tier-required').value, 10);
    const selectable_count = parseInt(document.getElementById('edit-tier-selectable').value, 10) || 1;
    const goods_name = document.getElementById('edit-tier-goods-name').value.trim();
    const exchange_location = document.getElementById('edit-tier-exchange-loc').value.trim();
    const exchange_notice = document.getElementById('edit-tier-exchange-notice').value.trim();
    const description = document.getElementById('edit-tier-desc').value.trim();
    const season_id = this.selectedSeasonId;

    if (!title || isNaN(required_visits)) {
      alert('タイトルと必要店舗数は必須です。');
      return;
    }
    if (isGoods && !goods_name) {
      alert('グッズ引換型の場合、グッズ名称は必須です。');
      return;
    }

    const tierData = {
      season_id,
      reward_type,
      title,
      required_visits,
      selectable_count: isGoods ? 1 : selectable_count,
      goods_name: isGoods ? goods_name : null,
      exchange_location: isGoods ? exchange_location : null,
      exchange_notice: isGoods ? exchange_notice : null,
      description
    };

    if (idVal) {
      tierData.id = parseInt(idVal, 10);
    }

    try {
      this.showToast('特典ランクを保存中...');
      await this.api.adminSaveRewardTier(tierData);
      this.closeTierModal();
      this.showToast(`特典「${title}」を保存しました！`);
      await this.loadAllData();
    } catch (err) {
      alert('保存に失敗しました: ' + err.message);
    }
  }

  async deleteTier(tierId, title) {
    if (!confirm(`【確認】特典ランク「${title}」を削除しますか？\n（ユーザーが既に獲得しているクーポンデータへの影響にご注意ください）`)) {
      return;
    }

    try {
      this.showToast('特典ランクを削除中...');
      await this.api.adminDeleteRewardTier(tierId);
      this.showToast(`特典「${title}」を削除しました。`);
      await this.loadAllData();
    } catch (err) {
      alert('削除に失敗しました: ' + err.message);
    }
  }

  /* ------------------------------------------------------------------------
   * 勇者称号・レベル (hero_titles) CRUD制御
   * ------------------------------------------------------------------------ */
  renderHeroTitles() {
    const container = document.getElementById('hero-titles-list');
    if (!container) return;

    if (this.heroTitles.length === 0) {
      container.innerHTML = '<div class="empty-state text-muted py-3">称号マスタが設定されていません。「＋ 新しい称号を追加」から作成してください。</div>';
      return;
    }

    const sortedTitles = [...this.heroTitles].sort((a, b) => (Number(a.min_visits) || 0) - (Number(b.min_visits) || 0));

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 80px;">レベル</th>
            <th style="width: 140px;">必要制覇店舗数</th>
            <th style="width: 200px;">称号名 (バッジ表示)</th>
            <th>説明文</th>
            <th style="width: 120px; text-align: center;">操作</th>
          </tr>
        </thead>
        <tbody>
          ${sortedTitles.map(t => `
            <tr>
              <td><strong style="color: #0f172a;">Lv.${t.level}</strong></td>
              <td><span class="badge" style="background: #e2e8f0; color: #334155;"><strong>${t.min_visits}</strong> 軒以上</span></td>
              <td>
                <span class="hero-title-badge-preview" style="background: ${t.badge_color || '#facc15'}; color: #000; border: 1px solid rgba(0,0,0,0.15);">
                  🎖️ ${this.escapeHtml(t.title)}
                </span>
              </td>
              <td class="text-muted" style="font-size: 0.85rem;">${this.escapeHtml(t.description || '-')}</td>
              <td style="text-align: center;">
                <button class="btn btn-sm btn-secondary" onclick="window.adminApp.openHeroTitleModal(${t.id || t.level})">
                  <i class="fa-solid fa-pen"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="window.adminApp.deleteHeroTitle(${t.id || t.level}, '${this.escapeHtml(t.title)}')">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  openHeroTitleModal(titleIdOrMode) {
    const isNew = titleIdOrMode === 'new';
    document.getElementById('hero-title-modal-title').innerHTML = isNew ? 
      '<i class="fa-solid fa-medal"></i> 新規勇者称号の追加' : 
      '<i class="fa-solid fa-pen-to-square"></i> 勇者称号・レベルの編集';

    let item = {};
    if (!isNew) {
      item = this.heroTitles.find(t => (t.id && t.id === Number(titleIdOrMode)) || t.level === Number(titleIdOrMode)) || {};
    } else {
      const maxLv = this.heroTitles.reduce((max, t) => Math.max(max, t.level || 0), 0);
      const maxMin = this.heroTitles.reduce((max, t) => Math.max(max, t.min_visits || 0), 0);
      item = {
        id: '',
        level: maxLv + 1,
        min_visits: maxMin + 5,
        title: '大正の凄腕勇者',
        badge_color: '#facc15',
        description: '大正の酒場を極めし凄腕の勇者',
        display_order: maxLv + 1
      };
    }

    document.getElementById('edit-title-id').value = item.id || '';
    document.getElementById('edit-title-level').value = item.level || 1;
    document.getElementById('edit-title-min-visits').value = item.min_visits !== undefined ? item.min_visits : 0;
    document.getElementById('edit-title-name').value = item.title || '';
    document.getElementById('edit-title-color').value = item.badge_color || '#facc15';
    document.getElementById('edit-title-color-picker').value = item.badge_color || '#facc15';
    document.getElementById('edit-title-order').value = item.display_order || (item.level || 1);
    document.getElementById('edit-title-desc').value = item.description || '';

    document.getElementById('hero-title-modal').style.display = 'flex';
  }

  closeHeroTitleModal() {
    document.getElementById('hero-title-modal').style.display = 'none';
  }

  async saveHeroTitleForm() {
    const idVal = document.getElementById('edit-title-id').value;
    const level = parseInt(document.getElementById('edit-title-level').value, 10);
    const min_visits = parseInt(document.getElementById('edit-title-min-visits').value, 10);
    const title = document.getElementById('edit-title-name').value.trim();
    const badge_color = document.getElementById('edit-title-color').value.trim();
    const display_order = parseInt(document.getElementById('edit-title-order').value, 10) || level;
    const description = document.getElementById('edit-title-desc').value.trim();

    if (isNaN(level) || isNaN(min_visits) || !title) {
      alert('レベル、必要店舗数、称号名は必須です。');
      return;
    }

    const titleData = {
      level,
      min_visits,
      title,
      badge_color,
      display_order,
      description
    };

    if (idVal) {
      titleData.id = parseInt(idVal, 10);
    }

    try {
      this.showToast('称号マスタを保存中...');
      await this.api.adminSaveHeroTitle(titleData);
      this.closeHeroTitleModal();
      this.showToast(`称号「${title}」を保存しました！`);
      await this.loadAllData();
    } catch (err) {
      alert('保存に失敗しました: ' + err.message);
    }
  }

  async deleteHeroTitle(titleId, title) {
    if (!confirm(`【確認】称号「${title}」をマスタから削除しますか？`)) {
      return;
    }

    try {
      this.showToast('称号を削除中...');
      await this.api.adminDeleteHeroTitle(titleId);
      this.showToast(`称号「${title}」を削除しました。`);
      await this.loadAllData();
    } catch (err) {
      alert('削除に失敗しました: ' + err.message);
    }
  }

  async saveCurrentSeasonDates() {
    const current = this.seasons.find(s => s.id === this.selectedSeasonId) || this.api.currentSeason;
    const name = document.getElementById('edit-season-name').value.trim();
    const start_date = document.getElementById('edit-season-start').value;
    const end_date = document.getElementById('edit-season-end').value;
    const coupon_valid_until = document.getElementById('edit-season-valid').value;

    try {
      this.showToast('開催日程を保存中...');
      await this.api.adminSaveSeason({
        id: current.id,
        name,
        start_date,
        end_date,
        coupon_valid_until,
        is_active: true
      });
      this.showToast(`第${current.id}回の開催日程を保存しました！`);
      await this.loadAllData();
    } catch (err) {
      alert('保存に失敗しました: ' + err.message);
    }
  }

  openSeasonModal() {
    const nextId = (this.seasons.reduce((max, s) => Math.max(max, s.id), 0) || 2) + 1;
    document.getElementById('new-season-id').value = nextId;
    document.getElementById('new-season-name').value = `大正酔いどれクエスト第${nextId}弾`;
    document.getElementById('new-season-start').value = new Date().toISOString().slice(0, 10);
    document.getElementById('new-season-end').value = new Date().toISOString().slice(0, 10);
    document.getElementById('new-season-valid').value = new Date().toISOString().slice(0, 10);
    document.getElementById('new-season-active').checked = false;
    document.getElementById('season-modal').style.display = 'flex';
  }

  closeSeasonModal() {
    document.getElementById('season-modal').style.display = 'none';
  }

  async createSeason() {
    const id = parseInt(document.getElementById('new-season-id').value, 10);
    const name = document.getElementById('new-season-name').value.trim();
    const start_date = document.getElementById('new-season-start').value;
    const end_date = document.getElementById('new-season-end').value;
    const coupon_valid_until = document.getElementById('new-season-valid').value;
    const is_active = document.getElementById('new-season-active').checked;

    const seasonData = { id, name, start_date, end_date, coupon_valid_until, is_active };

    try {
      this.showToast('新規シーズンを作成中...');
      if (is_active) {
        await this.api.adminSetActiveSeason(id);
      }
      await this.api.adminSaveSeason(seasonData);

      this.closeSeasonModal();
      this.showToast(`「${name}」を作成しました！`);
      this.selectedSeasonId = id;
      await this.loadAllData();
    } catch (err) {
      alert('シーズン作成に失敗しました: ' + err.message);
    }
  }

  async activateSeason(seasonId) {
    if (!confirm(`第${seasonId}回を開催中（アクティブ）に切り替えますか？\n（参加者のアプリが第${seasonId}回モードに切り替わります）`)) {
      return;
    }
    try {
      this.showToast('開催シーズンを切り替え中...');
      await this.api.adminSetActiveSeason(seasonId);
      this.selectedSeasonId = seasonId;
      this.showToast(`第${seasonId}回を開催中に切り替えました！`);
      await this.loadAllData();
    } catch (err) {
      alert('切り替えに失敗しました: ' + err.message);
    }
  }

  /* ------------------------------------------------------------------------
   * 4. 参加者・履歴ログ & 削除・復元機能
   * ------------------------------------------------------------------------ */
  renderLogs() {
    document.getElementById('count-users').textContent = this.users.length;
    document.getElementById('count-visits').textContent = this.visits.length;
    document.getElementById('count-coupons').textContent = this.coupons.length;

    // 1. ユーザーテーブル (個別削除ボタン付き)
    const userTbody = document.getElementById('users-table-body');
    if (this.users.length === 0) {
      userTbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">参加者データがありません</td></tr>';
    } else {
      userTbody.innerHTML = this.users.map(u => {
        const userVisits = this.visits.filter(v => v.user_id === u.line_user_id).length;
        const userCoupons = this.coupons.filter(c => c.user_id === u.line_user_id).length;
        const createdStr = u.created_at ? new Date(u.created_at).toLocaleString('ja-JP') : '-';
        const activeStr = u.last_active_at ? new Date(u.last_active_at).toLocaleString('ja-JP') : '-';

        return `
          <tr>
            <td>
              <div style="display: flex; align-items: center; gap: 8px;">
                <img src="${u.picture_url || 'assets/banner.png'}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">
                <strong>${this.escapeHtml(u.display_name || '冒険者')}</strong>
              </div>
            </td>
            <td><code>${this.escapeHtml(u.line_user_id || '')}</code></td>
            <td><strong style="color: #b45309;">${userVisits} 軒制覇</strong></td>
            <td><strong>${userCoupons} 枚</strong></td>
            <td><small class="text-muted">${createdStr}</small></td>
            <td><small class="text-muted">${activeStr}</small></td>
            <td style="text-align: center;">
              <button class="btn btn-sm btn-outline-danger" onclick="window.adminApp.confirmDeleteUser('${u.line_user_id}', '${this.escapeHtml(u.display_name || '')}')">
                <i class="fa-solid fa-trash"></i> 削除
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    // 2. 来店履歴テーブル (個別削除ボタン付き)
    const visitTbody = document.getElementById('visits-table-body');
    if (this.visits.length === 0) {
      visitTbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">今期の来店履歴がありません</td></tr>';
    } else {
      visitTbody.innerHTML = this.visits.map(v => {
        const store = this.stores.find(s => s.id === v.store_id);
        const storeName = store ? store.name : v.store_id;
        const user = this.users.find(u => u.line_user_id === v.user_id);
        const userName = user ? user.display_name : v.user_id;
        const timeStr = v.visited_at ? new Date(v.visited_at).toLocaleString('ja-JP') : '-';

        return `
          <tr>
            <td>${timeStr}</td>
            <td><strong>${this.escapeHtml(userName)}</strong></td>
            <td><code>${this.escapeHtml(v.store_id)}</code></td>
            <td><strong>${this.escapeHtml(storeName)}</strong></td>
            <td style="text-align: center;">
              <button class="btn btn-sm btn-outline-danger" onclick="window.adminApp.confirmDeleteVisit('${v.id}')" title="来店履歴を削除">
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    // 3. クーポン履歴テーブル (状態切替 & 削除ボタン付き)
    const couponTbody = document.getElementById('coupons-table-body');
    if (this.coupons.length === 0) {
      couponTbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">今期のクーポン履歴がありません</td></tr>';
    } else {
      couponTbody.innerHTML = this.coupons.map(c => {
        const store = this.stores.find(s => s.id === c.store_id);
        const storeName = store ? store.name : c.store_id;
        const user = this.users.find(u => u.line_user_id === c.user_id);
        const userName = user ? user.display_name : c.user_id;
        const acqStr = c.acquired_at ? new Date(c.acquired_at).toLocaleString('ja-JP') : '-';
        const usedStr = c.used_at ? new Date(c.used_at).toLocaleString('ja-JP') : '-';
        const isUsed = c.status === 'used';

        return `
          <tr>
            <td>${acqStr}</td>
            <td><strong>${this.escapeHtml(userName)}</strong></td>
            <td><strong>${this.escapeHtml(storeName)}</strong></td>
            <td><span class="tag ${isUsed ? 'tag-active' : 'tag-area'}">${isUsed ? '✅ 利用済' : '未使用'}</span></td>
            <td>${usedStr}</td>
            <td style="text-align: center;">
              <div style="display: flex; gap: 4px; justify-content: center;">
                ${isUsed ? `
                  <button class="btn btn-sm btn-secondary" onclick="window.adminApp.updateCouponStatus('${c.id}', 'active')" title="未使用に戻す">
                    <i class="fa-solid fa-rotate-left"></i> 未使用へ
                  </button>
                ` : `
                  <button class="btn btn-sm btn-secondary" onclick="window.adminApp.updateCouponStatus('${c.id}', 'used')" title="手動で使用済みにする">
                    <i class="fa-solid fa-check"></i> 消込
                  </button>
                `}
                <button class="btn btn-sm btn-outline-danger" onclick="window.adminApp.confirmDeleteCoupon('${c.id}')" title="クーポンを削除">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  switchLogSubTab(subTabId) {
    this.activeLogSubTab = subTabId;
    document.querySelectorAll('.sub-tabs .sub-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.sub === subTabId);
    });
    document.querySelectorAll('.subtab-content').forEach(c => {
      c.classList.toggle('active', c.id === `subtab-${subTabId}`);
    });
  }

  // ユーザー完全削除
  async confirmDeleteUser(userId, displayName) {
    if (!confirm(`⚠️ 警告: ユーザー「${displayName}」を完全に削除しますか？\n\n※このユーザーに紐づくすべての来店記録・獲得クーポンも完全に削除されます。この操作は元に戻せません。`)) {
      return;
    }
    try {
      this.showToast('ユーザーと関連データを削除中...');
      await this.api.adminDeleteUser(userId);
      this.showToast(`ユーザー「${displayName}」を削除しました`);
      await this.loadAllData();
    } catch (err) {
      alert('削除に失敗しました: ' + err.message);
    }
  }

  // 来店履歴削除
  async confirmDeleteVisit(visitId) {
    if (!confirm('この来店・サイン記録を削除しますか？')) return;
    try {
      this.showToast('来店記録を削除中...');
      await this.api.adminDeleteVisit(visitId);
      this.showToast('来店記録を削除しました');
      await this.loadAllData();
    } catch (err) {
      alert('削除に失敗しました: ' + err.message);
    }
  }

  // クーポン削除
  async confirmDeleteCoupon(couponId) {
    if (!confirm('このクーポンデータを削除しますか？')) return;
    try {
      this.showToast('クーポンを削除中...');
      await this.api.adminDeleteCoupon(couponId);
      this.showToast('クーポンを削除しました');
      await this.loadAllData();
    } catch (err) {
      alert('削除に失敗しました: ' + err.message);
    }
  }

  // クーポンステータス変更 (未使用 ⇔ 利用済)
  async updateCouponStatus(couponId, newStatus) {
    try {
      this.showToast('クーポンの状態を更新中...');
      await this.api.adminUpdateCouponStatus(couponId, newStatus);
      this.showToast(`クーポンを【${newStatus === 'used' ? '利用済' : '未使用'}】に変更しました`);
      await this.loadAllData();
    } catch (err) {
      alert('更新に失敗しました: ' + err.message);
    }
  }

  exportCurrentTableToCSV() {
    let filename = `yoidore_season${this.selectedSeasonId}_${this.activeLogSubTab}_${new Date().toISOString().slice(0, 10)}.csv`;
    let csvContent = '\uFEFF';

    if (this.activeLogSubTab === 'users') {
      csvContent += 'LINE_User_ID,表示名,今期制覇店舗数,獲得クーポン数,初回来店日時,最終アクセス\n';
      this.users.forEach(u => {
        const userVisits = this.visits.filter(v => v.user_id === u.line_user_id).length;
        const userCoupons = this.coupons.filter(c => c.user_id === u.line_user_id).length;
        csvContent += `"${u.line_user_id}","${(u.display_name || '').replace(/"/g, '""')}",${userVisits},${userCoupons},"${u.created_at || ''}","${u.last_active_at || ''}"\n`;
      });
    } else if (this.activeLogSubTab === 'visits') {
      csvContent += '来店日時,シーズンID,LINE_User_ID,ユーザー名,店舗ID,店舗名\n';
      this.visits.forEach(v => {
        const store = this.stores.find(s => s.id === v.store_id);
        const user = this.users.find(u => u.line_user_id === v.user_id);
        csvContent += `"${v.visited_at || ''}",${v.season_id || this.selectedSeasonId},"${v.user_id}","${(user ? user.display_name : '').replace(/"/g, '""')}","${v.store_id}","${(store ? store.name : '').replace(/"/g, '""')}"\n`;
      });
    } else if (this.activeLogSubTab === 'coupons') {
      csvContent += '獲得日時,シーズンID,LINE_User_ID,ユーザー名,店舗ID,店舗名,状態,利用消し込み日時\n';
      this.coupons.forEach(c => {
        const store = this.stores.find(s => s.id === c.store_id);
        const user = this.users.find(u => u.line_user_id === c.user_id);
        csvContent += `"${c.acquired_at || ''}",${c.season_id || this.selectedSeasonId},"${c.user_id}","${(user ? user.display_name : '').replace(/"/g, '""')}","${c.store_id}","${(store ? store.name : '').replace(/"/g, '""')}","${c.status}","${c.used_at || ''}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    this.showToast(`CSV「${filename}」をダウンロードしました`);
  }

  /* ------------------------------------------------------------------------
   * 5. 店頭POP・QR一括印刷
   * ------------------------------------------------------------------------ */
  renderPopStoreSelect() {
    const sel = document.getElementById('pop-store-select');
    sel.innerHTML = '<option value="all">全33店舗を表示（一括印刷）</option>';
    this.stores.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.name} (${s.id})`;
      sel.appendChild(opt);
    });
  }

  filterPopCards() {
    const storeId = document.getElementById('pop-store-select').value;
    this.renderPopCards(storeId === 'all' ? null : storeId);
  }

  renderPopCards(targetStoreId = null) {
    const container = document.getElementById('pop-cards-container');
    const stores = targetStoreId ? this.stores.filter(s => s.id === targetStoreId) : this.stores;

    if (stores.length === 0) {
      container.innerHTML = '<div class="empty-state text-muted py-4">店舗データがありません</div>';
      return;
    }

    container.innerHTML = '';
    const liffId = this.api.liffId || '2011637649-WWv6pnTL';
    const currentSeason = this.seasons.find(s => s.id === this.selectedSeasonId) || this.api.currentSeason;
    const seasonTitle = currentSeason ? currentSeason.name : '大正酔いどれクエストⅡ';

    stores.forEach(store => {
      const checkinUrl = `https://liff.line.me/${liffId}?checkin=${store.id}`;
      const card = document.createElement('div');
      card.className = 'pop-card';

      card.innerHTML = `
        <div class="pop-event-header">
          <span class="pop-event-badge">大正区はしご酒イベント</span>
          <div class="pop-event-title">🍺 ${this.escapeHtml(seasonTitle)} ⚔️</div>
        </div>
        <div class="pop-store-name">${this.escapeHtml(store.name)}</div>
        <div class="pop-store-area">${this.escapeHtml(store.area || '')} 【${this.escapeHtml(store.id)}】</div>
        <div class="pop-qr-wrapper" id="pop-qr-${store.id}"></div>
        <div class="pop-guide-text">📱 スマホのカメラでQRを読み取って<br>【店主サインを受け取る】！</div>
        <div class="pop-sub-guide">※冒険の書にサインが刻まれ、はしご件数が記録されます</div>
      `;

      container.appendChild(card);

      const qrElem = document.getElementById(`pop-qr-${store.id}`);
      if (qrElem && window.QRCode) {
        new window.QRCode(qrElem, {
          text: checkinUrl,
          width: 180,
          height: 180,
          colorDark: "#000000",
          colorLight: "#ffffff",
          correctLevel: window.QRCode.CorrectLevel.M
        });
      }
    });
  }

  /* ------------------------------------------------------------------------
   * 共通ユーティリティ
   * ------------------------------------------------------------------------ */
  showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, duration);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  window.adminApp = new YoidoreAdminApp();
});
