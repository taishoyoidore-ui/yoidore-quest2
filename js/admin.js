/**
 * 大正酔いどれクエストⅡ - バックオフィス管理画面ロジック
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
    this.activeTab = 'dashboard';
    this.activeLogSubTab = 'users';

    this.init();
  }

  async init() {
    this.checkAuthSession();
    this.setupEventListeners();
  }

  /* ------------------------------------------------------------------------
   * 認証制御 (PINコード / パスワード)
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
      tiers: 'はしご達成特典・開催期限設定',
      logs: '参加者・来店履歴ログ',
      pop: '店頭POP・QRコード一括印刷'
    };
    document.getElementById('page-title').textContent = titles[tabId] || '管理画面';

    // スマホサイドバーを閉じる
    document.getElementById('sidebar').classList.remove('open');

    // 必要に応じたタブ個別描画
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
      // 1. 店舗データ
      this.stores = await this.api.getStores(true);

      // 2. 特典ランクデータ
      this.tiers = await this.api.getRewardTiers(true);

      // 3. ユーザー一覧
      try {
        this.users = await this.api.supabaseFetch('users?select=*&order=created_at.desc');
      } catch (e) {
        this.users = [];
      }

      // 4. 来店ログ一覧
      try {
        this.visits = await this.api.supabaseFetch('visits?select=*&order=visited_at.desc');
      } catch (e) {
        this.visits = [];
      }

      // 5. クーポン発行・消し込み履歴
      try {
        this.coupons = await this.api.supabaseFetch('user_coupons?select=*&order=acquired_at.desc');
      } catch (e) {
        this.coupons = [];
      }

      // 画面反映
      this.renderDashboard();
      this.renderStoresTable();
      this.renderTiersSettings();
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
      topStoresElem.innerHTML = '<div class="empty-state text-muted py-3">まだ来店チェックインデータがありません</div>';
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
      topCouponsElem.innerHTML = '<div class="empty-state text-muted py-3">まだクーポン獲得データがありません</div>';
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
        let text = `<strong>${this.escapeHtml(userName)}</strong> が <strong>${this.escapeHtml(storeName)}</strong> にチェックインしました`;
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

    // エリアフィルター更新
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

    // 各フィールドに値を設定
    document.getElementById('edit-store-id').value = store.id || '';
    document.getElementById('edit-store-name').value = store.name || '';
    document.getElementById('edit-store-area').value = store.area || '';
    document.getElementById('edit-store-category').value = store.category || '';
    document.getElementById('edit-store-style').value = store.style || '';
    document.getElementById('edit-store-type').value = store.yoidore_type || store.type || '';
    document.getElementById('edit-store-takeout').value = store.takeout ? 'true' : 'false';
    document.getElementById('edit-store-catchphrase').value = store.catchphrase || '';
    document.getElementById('edit-store-days').value = store.days || '';
    document.getElementById('edit-store-hours').value = store.hours || '';
    document.getElementById('edit-store-payment').value = store.payment || '';

    document.getElementById('edit-store-set-name').value = store.set_name || '';
    document.getElementById('edit-store-set-price').value = store.set_price || 1000;
    document.getElementById('edit-store-set-content').value = store.set_content || '';
    document.getElementById('edit-store-set-charge').value = store.set_charge || '';
    document.getElementById('edit-store-set-limit').value = store.set_limit || '';
    document.getElementById('edit-store-set-notes').value = store.set_notes || '';

    document.getElementById('edit-store-quest-name').value = store.quest_name || '';
    document.getElementById('edit-store-quest-price').value = store.quest_price || 0;
    document.getElementById('edit-store-quest-content').value = store.quest_content || '';

    document.getElementById('edit-store-map-url').value = store.map_url || '';
    document.getElementById('edit-store-insta-url').value = store.insta_url || '';
    document.getElementById('edit-store-photo-url').value = store.photo_url || '';
    document.getElementById('edit-store-logo-url').value = store.logo_url || '';
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
   * 3. 特典・期限設定
   * ------------------------------------------------------------------------ */
  renderTiersSettings() {
    const listElem = document.getElementById('reward-tiers-list');
    if (this.tiers.length === 0) {
      listElem.innerHTML = '<div class="empty-state text-muted py-3">特典ランクが設定されていません</div>';
      return;
    }

    listElem.innerHTML = this.tiers.map(t => `
      <div class="card mb-3" style="border: 1px solid #cbd5e1;">
        <div class="card-body" style="padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <h4 style="color: #0f172a; margin-bottom: 4px;">🎁 ${this.escapeHtml(t.title)}</h4>
              <p class="text-muted" style="font-size: 0.85rem;">${this.escapeHtml(t.description || '')}</p>
            </div>
            <span class="tag tag-active" style="font-size: 0.85rem;">
              ${t.required_visits} 軒達成 ➔ ${t.selectable_count} 店舗選択
            </span>
          </div>
        </div>
      </div>
    `).join('');

    // イベント期間フォームの初期値
    const period = this.api.config.eventPeriod || {};
    document.getElementById('event-start-date').value = period.startDate || '2026-08-01';
    document.getElementById('event-end-date').value = period.endDate || '2026-08-31';
    document.getElementById('coupon-valid-until').value = '2026-09-30';
  }

  saveEventConfig() {
    const start = document.getElementById('event-start-date').value;
    const end = document.getElementById('event-end-date').value;
    const validUntil = document.getElementById('coupon-valid-until').value;

    this.showToast(`開催期間 (${start}〜${end}) と クーポン期限 (${validUntil}) を保存しました！`);
  }

  /* ------------------------------------------------------------------------
   * 4. 参加者・ログ閲覧 & CSVエクスポート
   * ------------------------------------------------------------------------ */
  renderLogs() {
    // カウントバッジ
    document.getElementById('count-users').textContent = this.users.length;
    document.getElementById('count-visits').textContent = this.visits.length;
    document.getElementById('count-coupons').textContent = this.coupons.length;

    // 1. ユーザーテーブル
    const userTbody = document.getElementById('users-table-body');
    if (this.users.length === 0) {
      userTbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">参加者データがありません</td></tr>';
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
          </tr>
        `;
      }).join('');
    }

    // 2. 来店履歴テーブル
    const visitTbody = document.getElementById('visits-table-body');
    if (this.visits.length === 0) {
      visitTbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">来店履歴がありません</td></tr>';
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
          </tr>
        `;
      }).join('');
    }

    // 3. クーポン履歴テーブル
    const couponTbody = document.getElementById('coupons-table-body');
    if (this.coupons.length === 0) {
      couponTbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">クーポン履歴がありません</td></tr>';
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

  exportCurrentTableToCSV() {
    let filename = `yoidore_${this.activeLogSubTab}_${new Date().toISOString().slice(0, 10)}.csv`;
    let csvContent = '\uFEFF'; // BOM for Excel

    if (this.activeLogSubTab === 'users') {
      csvContent += 'LINE_User_ID,表示名,制覇店舗数,獲得クーポン数,初回日時,最終アクセス\n';
      this.users.forEach(u => {
        const userVisits = this.visits.filter(v => v.user_id === u.line_user_id).length;
        const userCoupons = this.coupons.filter(c => c.user_id === u.line_user_id).length;
        csvContent += `"${u.line_user_id}","${(u.display_name || '').replace(/"/g, '""')}",${userVisits},${userCoupons},"${u.created_at || ''}","${u.last_active_at || ''}"\n`;
      });
    } else if (this.activeLogSubTab === 'visits') {
      csvContent += '来店日時,LINE_User_ID,ユーザー名,店舗ID,店舗名\n';
      this.visits.forEach(v => {
        const store = this.stores.find(s => s.id === v.store_id);
        const user = this.users.find(u => u.line_user_id === v.user_id);
        csvContent += `"${v.visited_at || ''}","${v.user_id}","${(user ? user.display_name : '').replace(/"/g, '""')}","${v.store_id}","${(store ? store.name : '').replace(/"/g, '""')}"\n`;
      });
    } else if (this.activeLogSubTab === 'coupons') {
      csvContent += '獲得日時,LINE_User_ID,ユーザー名,店舗ID,店舗名,状態,利用消し込み日時\n';
      this.coupons.forEach(c => {
        const store = this.stores.find(s => s.id === c.store_id);
        const user = this.users.find(u => u.line_user_id === c.user_id);
        csvContent += `"${c.acquired_at || ''}","${c.user_id}","${(user ? user.display_name : '').replace(/"/g, '""')}","${c.store_id}","${(store ? store.name : '').replace(/"/g, '""')}","${c.status}","${c.used_at || ''}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    this.showToast(`CSVファイル「${filename}」をダウンロードしました`);
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

    stores.forEach(store => {
      const checkinUrl = `https://liff.line.me/${liffId}?checkin=${store.id}`;
      const card = document.createElement('div');
      card.className = 'pop-card';

      card.innerHTML = `
        <div class="pop-event-header">
          <span class="pop-event-badge">大正区はしご酒イベント</span>
          <div class="pop-event-title">🍺 大正酔いどれクエストⅡ ⚔️</div>
        </div>
        <div class="pop-store-name">${this.escapeHtml(store.name)}</div>
        <div class="pop-store-area">${this.escapeHtml(store.area || '')} 【${this.escapeHtml(store.id)}】</div>
        <div class="pop-qr-wrapper" id="pop-qr-${store.id}"></div>
        <div class="pop-guide-text">📱 スマホのカメラでQRを読み取って<br>【来店チェックイン】！</div>
        <div class="pop-sub-guide">※冒険の書にサインが刻まれ、はしご件数が記録されます</div>
      `;

      container.appendChild(card);

      // QRコード描画 (QRCode.js)
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
