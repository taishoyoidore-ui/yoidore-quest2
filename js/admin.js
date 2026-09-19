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
    this.applyVersionBadges();
    this.loadAllData();
  }

  applyVersionBadges() {
    const versionStr = (window.APP_CONFIG && window.APP_CONFIG.version) || 'v2026.09.19.03';
    document.querySelectorAll('.app-version-text').forEach(el => {
      el.textContent = versionStr;
    });
  }

  /* ------------------------------------------------------------------------
   * イベントリスナー設定
   * ------------------------------------------------------------------------ */
  setupEventListeners() {
    this.applyVersionBadges();

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
      if (hash && ['dashboard', 'analytics', 'stores', 'tiers', 'logs', 'pop'].includes(hash)) {
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
      analytics: '店舗・特典別 集計分析',
      stores: '店舗マスター管理',
      tiers: 'シーズン・開催設定',
      logs: '参加者・データ管理',
      pop: '店頭POP・QRコード一括印刷'
    };
    document.getElementById('page-title').textContent = titles[tabId] || '管理画面';

    // スマホサイドバーを閉じる
    document.getElementById('sidebar').classList.remove('open');

    // タブ切り替え時の再描画
    if (tabId === 'dashboard') {
      this.renderStatusBanner();
      this.renderDashboard();
    } else if (tabId === 'analytics') {
      this.renderAnalytics();
    } else if (tabId === 'stores') {
      this.renderStoresTable();
    } else if (tabId === 'tiers') {
      this.renderSeasonSettings();
    } else if (tabId === 'logs') {
      this.renderLogs();
    } else if (tabId === 'pop') {
      this.renderPopCards();
    }
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
      const currentSeason = await this.api.getCurrentSeason();
      this.seasons = await this.api.getSeasons();
      if (!this.selectedSeasonId && currentSeason) {
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
        const rawUsers = await this.api.supabaseFetch('users?select=*&order=created_at.desc');
        this.users = Array.isArray(rawUsers) ? rawUsers.filter(u => !u.line_user_id?.startsWith('__')) : [];
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
      this.renderAnalytics();
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
      desc.textContent = `ハシゴ酒クエスト開催中！ (〜 ${current.end_date} まで)`;
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
   * 1.5 店舗・特典別 集計分析 (Analytics)
   * ------------------------------------------------------------------------ */
  renderAnalytics() {
    // 1. サマリーKPI計算
    const totalVisits = this.visits.length;
    const totalCoupons = this.coupons.length;
    const usedCoupons = this.coupons.filter(c => c.status === 'used').length;
    const usageRate = totalCoupons > 0 ? ((usedCoupons / totalCoupons) * 100).toFixed(1) : '0.0';

    const vElem = document.getElementById('analytics-total-visits');
    if (vElem) vElem.textContent = totalVisits.toLocaleString();
    const cElem = document.getElementById('analytics-total-coupons');
    if (cElem) cElem.textContent = totalCoupons.toLocaleString();
    const uElem = document.getElementById('analytics-total-used');
    if (uElem) uElem.textContent = `${usedCoupons.toLocaleString()} 件`;
    const rElem = document.getElementById('analytics-usage-rate');
    if (rElem) rElem.textContent = `${usageRate}%`;

    // 2. エリアフィルター初期化
    const areaFilter = document.getElementById('analytics-area-filter');
    if (areaFilter && areaFilter.children.length <= 1) {
      const areas = Array.from(new Set(this.stores.map(s => s.area))).filter(Boolean);
      areas.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a;
        opt.textContent = a;
        areaFilter.appendChild(opt);
      });
    }

    // 3. テーブル＆カード描画
    this.renderAnalyticsStoreTable();
    this.renderAnalyticsTierCards();
  }

  renderAnalyticsStoreTable() {
    const tbody = document.getElementById('analytics-stores-tbody');
    const countElem = document.getElementById('analytics-store-count');
    if (!tbody) return;

    const search = (document.getElementById('analytics-store-search')?.value || '').trim().toLowerCase();
    const areaFilter = document.getElementById('analytics-area-filter')?.value || '';
    const sortBy = document.getElementById('analytics-sort-select')?.value || 'visits_desc';

    // 全店舗ごとの実績計算
    const storeStats = this.stores.map(store => {
      const raw = store.raw_data || {};
      const visitsCount = this.visits.filter(v => v.store_id === store.id).length;
      const couponsCount = this.coupons.filter(c => c.store_id === store.id).length;
      const usedCount = this.coupons.filter(c => c.store_id === store.id && c.status === 'used').length;
      const rate = couponsCount > 0 ? ((usedCount / couponsCount) * 100).toFixed(1) : '0.0';

      let planType = raw.plan_type || '';
      if (!planType) {
        if (raw.set_name && raw.quest_name) planType = '両方で参加';
        else if (raw.set_name) planType = '「酔いどれセット」のみ';
        else if (raw.quest_name) planType = '「店舗クエスト」のみ';
        else planType = '-';
      }

      return {
        id: store.id,
        name: store.name,
        area: store.area || '',
        planType,
        isCouponTarget: !!store.is_coupon_target,
        visitsCount,
        couponsCount,
        usedCount,
        rate: parseFloat(rate),
        rateStr: `${rate}%`
      };
    });

    // 絞り込み
    let filtered = storeStats.filter(st => {
      const matchSearch = !search || st.id.toLowerCase().includes(search) || st.name.toLowerCase().includes(search) || st.area.toLowerCase().includes(search);
      const matchArea = !areaFilter || st.area === areaFilter;
      return matchSearch && matchArea;
    });

    // ソート
    filtered.sort((a, b) => {
      if (sortBy === 'visits_desc') return b.visitsCount - a.visitsCount || a.id.localeCompare(b.id, undefined, { numeric: true });
      if (sortBy === 'coupons_desc') return b.couponsCount - a.couponsCount || a.id.localeCompare(b.id, undefined, { numeric: true });
      if (sortBy === 'used_desc') return b.usedCount - a.usedCount || a.id.localeCompare(b.id, undefined, { numeric: true });
      if (sortBy === 'rate_desc') return b.rate - a.rate || b.usedCount - a.usedCount;
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name, 'ja');
      return a.id.localeCompare(b.id, undefined, { numeric: true });
    });

    if (countElem) countElem.textContent = filtered.length;

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">該当する店舗実績がありません</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(st => {
      const planBadge = st.planType.includes('両方') 
        ? '<span class="badge" style="background:#e0f2fe; color:#0369a1; font-size:11px;">両方参加</span>'
        : (st.planType.includes('セット')
          ? '<span class="badge" style="background:#fef3c7; color:#b45309; font-size:11px;">セットのみ</span>'
          : (st.planType.includes('クエスト')
            ? '<span class="badge" style="background:#f3e8ff; color:#7e22ce; font-size:11px;">クエストのみ</span>'
            : `<span class="badge" style="background:#f1f5f9; color:#64748b; font-size:11px;">${this.escapeHtml(st.planType)}</span>`));

      const couponTargetIcon = st.isCouponTarget 
        ? '<span title="特典クーポン対象店舗" style="color:#059669; font-size:12px; margin-left:4px;">🎟️対象</span>' 
        : '';

      return `
        <tr>
          <td><code style="font-size:12px; font-weight:bold;">${this.escapeHtml(st.id)}</code></td>
          <td>
            <strong style="color:#0f172a; font-size:13px;">${this.escapeHtml(st.name)}</strong>
            ${couponTargetIcon}
          </td>
          <td><span class="tag tag-area">${this.escapeHtml(st.area)}</span></td>
          <td>${planBadge}</td>
          <td style="text-align: right; font-weight: bold; color: #b45309; font-size: 14px;">
            ${st.visitsCount} <span style="font-size:11px; font-weight:normal; color:#64748b;">人</span>
          </td>
          <td style="text-align: right; font-weight: bold; color: #0284c7; font-size: 14px;">
            ${st.couponsCount} <span style="font-size:11px; font-weight:normal; color:#64748b;">枚</span>
          </td>
          <td style="text-align: right; font-weight: bold; color: #059669; font-size: 14px;">
            ${st.usedCount} <span style="font-size:11px; font-weight:normal; color:#64748b;">枚</span>
          </td>
          <td style="text-align: right; font-weight: bold; color: ${st.rate > 50 ? '#059669' : '#475569'}; font-size: 13px;">
            ${st.couponsCount > 0 ? st.rateStr : '<span style="color:#94a3b8;">-</span>'}
          </td>
        </tr>
      `;
    }).join('');
  }

  renderAnalyticsTierCards() {
    const grid = document.getElementById('analytics-tiers-grid');
    if (!grid) return;

    const typeFilter = document.getElementById('analytics-tier-type-filter')?.value || 'all';

    let tiers = this.tiers || [];
    if (typeFilter !== 'all') {
      tiers = tiers.filter(t => t.reward_type === typeFilter);
    }

    if (tiers.length === 0) {
      grid.innerHTML = '<div class="empty-state text-muted py-3" style="grid-column: 1/-1;">該当する特典データがありません</div>';
      return;
    }

    grid.innerHTML = tiers.map(tier => {
      const isGoods = tier.reward_type === 'goods';
      const badge = isGoods 
        ? '<span class="badge" style="background:#fef3c7; color:#b45309;"><i class="fa-solid fa-gift"></i> グッズ引換型</span>' 
        : '<span class="badge" style="background:#e0f2fe; color:#0369a1;"><i class="fa-solid fa-ticket"></i> 店舗クーポン型</span>';

      // 当該特典ランクの獲得数・消し込み数
      let tierCoupons = [];
      if (isGoods) {
        tierCoupons = this.coupons.filter(c => c.reward_type === 'goods' && (c.goods_name === tier.goods_name || c.goods_name === tier.title));
      } else {
        tierCoupons = this.coupons.filter(c => c.reward_type !== 'goods');
      }

      const totalClaimed = tierCoupons.length;
      const totalUsed = tierCoupons.filter(c => c.status === 'used').length;
      const remaining = totalClaimed - totalUsed;
      const progressPercent = totalClaimed > 0 ? Math.round((totalUsed / totalClaimed) * 100) : 0;

      return `
        <div style="border:1px solid #e2e8f0; border-radius:8px; padding:16px; background:#ffffff; box-shadow:0 1px 3px rgba(0,0,0,0.05); display:flex; flex-direction:column; justify-content:space-between;">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
              <span class="badge" style="background:#f1f5f9; color:#334155; font-weight:bold;">${tier.required_visits}軒ハシゴ</span>
              ${badge}
            </div>
            <h4 style="margin:0 0 6px 0; font-size:15px; color:#0f172a;">${this.escapeHtml(tier.title)}</h4>
            ${isGoods ? `<div style="font-size:13px; color:#475569; margin-bottom:4px;"><strong>引換品:</strong> ${this.escapeHtml(tier.goods_name || tier.title)}</div>` : ''}
            ${tier.exchange_location ? `<div style="font-size:12px; color:#64748b; margin-bottom:2px;"><i class="fa-solid fa-location-dot"></i> 引換場所: ${this.escapeHtml(tier.exchange_location)}</div>` : ''}
            ${tier.description ? `<div style="font-size:12px; color:#64748b; margin-top:4px;">${this.escapeHtml(tier.description)}</div>` : ''}
          </div>

          <div style="margin-top:14px; padding-top:12px; border-top:1px dashed #e2e8f0;">
            <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px;">
              <span>獲得総数: <strong style="color:#0f172a;">${totalClaimed}</strong> 件</span>
              <span>引換・消込済: <strong style="color:#059669;">${totalUsed}</strong> 件</span>
              <span>未引換残: <strong style="color:#d97706;">${remaining}</strong> 件</span>
            </div>
            <div style="background:#f1f5f9; border-radius:4px; height:8px; overflow:hidden; position:relative;">
              <div style="background:linear-gradient(90deg, #10b981, #059669); height:100%; width:${progressPercent}%; transition:width 0.3s;"></div>
            </div>
            <div style="text-align:right; font-size:11px; color:#64748b; margin-top:4px;">
              消化率: <strong>${progressPercent}%</strong>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  exportAnalyticsStoresToCSV() {
    let csvContent = '\uFEFF店舗ID,店舗名,エリア,参加企画,クーポン取扱対象,サイン受取数(来店数),クーポン獲得数(指名数),クーポン利用数(消込済),利用率\n';
    
    this.stores.forEach(store => {
      const raw = store.raw_data || {};
      const visitsCount = this.visits.filter(v => v.store_id === store.id).length;
      const couponsCount = this.coupons.filter(c => c.store_id === store.id).length;
      const usedCount = this.coupons.filter(c => c.store_id === store.id && c.status === 'used').length;
      const rate = couponsCount > 0 ? ((usedCount / couponsCount) * 100).toFixed(1) + '%' : '0.0%';

      let planType = raw.plan_type || '';
      if (!planType) {
        if (raw.set_name && raw.quest_name) planType = '両方で参加';
        else if (raw.set_name) planType = '「酔いどれセット」のみ';
        else if (raw.quest_name) planType = '「店舗クエスト」のみ';
        else planType = '-';
      }

      csvContent += `"${store.id}","${(store.name || '').replace(/"/g, '""')}","${store.area || ''}","${planType}","${store.is_coupon_target ? '対象' : '非対象'}",${visitsCount},${couponsCount},${usedCount},"${rate}"\n`;
    });

    const filename = `大正酔いどれクエスト_全店舗実績集計_${new Date().toISOString().slice(0, 10)}.csv`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    this.showToast(`CSV「${filename}」を出力しました`);
  }

  exportAnalyticsTiersToCSV() {
    let csvContent = '\uFEFF特典ID,特典名,種別,必要来店数,グッズ名,引換場所,獲得総数,引換消込済数,未引換残数,消化率\n';
    
    (this.tiers || []).forEach(tier => {
      const isGoods = tier.reward_type === 'goods';
      let tierCoupons = [];
      if (isGoods) {
        tierCoupons = this.coupons.filter(c => c.reward_type === 'goods' && (c.goods_name === tier.goods_name || c.goods_name === tier.title));
      } else {
        tierCoupons = this.coupons.filter(c => c.reward_type !== 'goods');
      }

      const totalClaimed = tierCoupons.length;
      const totalUsed = tierCoupons.filter(c => c.status === 'used').length;
      const remaining = totalClaimed - totalUsed;
      const progressPercent = totalClaimed > 0 ? ((totalUsed / totalClaimed) * 100).toFixed(1) + '%' : '0.0%';

      csvContent += `${tier.id},"${(tier.title || '').replace(/"/g, '""')}","${isGoods ? 'グッズ引換型' : '店舗クーポン型'}",${tier.required_visits},"${(tier.goods_name || '').replace(/"/g, '""')}","${(tier.exchange_location || '').replace(/"/g, '""')}",${totalClaimed},${totalUsed},${remaining},"${progressPercent}"\n`;
    });

    const filename = `大正酔いどれクエスト_特典別集計_${new Date().toISOString().slice(0, 10)}.csv`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    this.showToast(`CSV「${filename}」を出力しました`);
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
      const hoursText = store.hours || '17:00〜23:00';
      const timeNotes = store.time_notes || store.conditions?.timeNotes || '';
      const daysText = store.days || '月,火,水,金,土,日';

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
            <div style="font-size: 12px; font-weight: 500;">🕒 ${this.escapeHtml(hoursText)}</div>
            <div style="font-size: 11px; color: #64748b;">📅 ${this.escapeHtml(daysText)}</div>
            ${timeNotes ? `<div style="font-size: 11px; color: #b45309; background: #fef3c7; padding: 2px 5px; border-radius: 3px; margin-top: 2px; display: inline-block;">💡 ${this.escapeHtml(timeNotes)}</div>` : ''}
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
    const updatedRawData = { ...(store.raw_data || {}), is_coupon_target: newStatus };

    try {
      await this.api.supabaseFetch(`stores?id=eq.${storeId}`, {
        method: 'PATCH',
        headers: {
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          is_coupon_target: newStatus,
          raw_data: updatedRawData
        })
      });
      store.raw_data = updatedRawData;
      this.showToast(`${store.name} のクーポン取扱を【${newStatus ? '対象' : '対象外'}】に更新しました`);
      this.renderStoresTable();
    } catch (err) {
      alert('更新に失敗しました: ' + err.message);
    }
  }

  /* ------------------------------------------------------------------------
   * 店舗フォーム補助 (エリア・カテゴリ・曜日・時間・決済)
   * ------------------------------------------------------------------------ */
  onAreaChange(val) {
    const customInput = document.getElementById('edit-store-area-custom');
    if (customInput) {
      customInput.style.display = (val === 'custom') ? 'block' : 'none';
      if (val === 'custom') customInput.focus();
    }
  }

  onCategoryChange(val) {
    const customInput = document.getElementById('edit-store-category-custom');
    if (customInput) {
      customInput.style.display = (val === 'custom') ? 'block' : 'none';
      if (val === 'custom') customInput.focus();
    }
  }

  onStyleChange(val) {
    const customInput = document.getElementById('edit-store-style-custom');
    if (customInput) {
      customInput.style.display = (val === 'custom') ? 'block' : 'none';
      if (val === 'custom') customInput.focus();
    }
  }

  setDayPresets(preset) {
    const checkboxes = document.querySelectorAll('input[name="store-days-check"]');
    const weekdays = ['月', '火', '水', '木', '金'];
    const weekends = ['土', '日', '祝'];

    checkboxes.forEach(cb => {
      if (preset === 'all') {
        cb.checked = true;
      } else if (preset === 'weekday') {
        cb.checked = weekdays.includes(cb.value);
      } else if (preset === 'weekend') {
        cb.checked = weekends.includes(cb.value);
      } else if (preset === 'clear') {
        cb.checked = false;
      }
    });
  }

  openStoreModal(storeIdOrMode) {
    const isNew = storeIdOrMode === 'new';
    document.getElementById('edit-store-mode').value = isNew ? 'new' : 'edit';
    document.getElementById('store-modal-title').innerHTML = isNew ? 
      '<i class="fa-solid fa-store"></i> 新規店舗の登録' : 
      '<i class="fa-solid fa-pen-to-square"></i> 店舗情報の編集';

    const idInput = document.getElementById('edit-store-id');
    idInput.readOnly = !isNew;

    const delBtn = document.getElementById('btn-delete-store');
    if (delBtn) {
      delBtn.style.display = isNew ? 'none' : 'inline-flex';
    }

    let store = {};
    if (!isNew) {
      store = this.stores.find(s => s.id === storeIdOrMode) || {};
    } else {
      const nextNum = (this.stores.reduce((max, s) => {
        const num = parseInt((s.id || '').replace(/\D/g, ''), 10);
        return isNaN(num) ? max : Math.max(max, num);
      }, 0) || 0) + 1;
      const nextId = `store-${String(nextNum).padStart(2, '0')}`;
      store = {
        id: nextId,
        name: '',
        area: '三軒家西',
        category: '居酒屋',
        style: 'テーブルあり',
        yoidore_type: 'サク飲み',
        takeout: 'テイクアウト不可',
        catchphrase: '',
        days: '月,火,水,金,土,日',
        hours: '17:00〜23:00',
        payment: '現金, PayPay, クレジットカード',
        is_coupon_target: true,
        plan_type: '「酔いどれセット」のみで参加',
        badge_sales_count: ''
      };
    }

    const raw = store.raw_data || {};
    const quest = store.quest || raw.quest || {};
    const yoidoreSet = store.yoidoreSet || raw.yoidoreSet || {};
    const conditions = store.conditions || raw.conditions || {};
    const numId = (store.id || '').replace(/\D/g, '').padStart(3, '0');

    document.getElementById('edit-store-id').value = store.id || '';
    document.getElementById('edit-store-name').value = store.name || '';

    // 1. エリア設定
    const knownAreas = ['三軒家西', '三軒家東', '駅前', '泉尾', '平尾'];
    const currentArea = store.area || raw['area'] || raw['エリア'] || '三軒家西';
    const areaSelect = document.getElementById('edit-store-area-select');
    const areaCustom = document.getElementById('edit-store-area-custom');
    if (knownAreas.includes(currentArea)) {
      areaSelect.value = currentArea;
      areaCustom.style.display = 'none';
      areaCustom.value = '';
    } else {
      areaSelect.value = 'custom';
      areaCustom.style.display = 'block';
      areaCustom.value = currentArea;
    }

    // 2. ジャンル/カテゴリ設定
    const knownCategories = [
      '居酒屋', 'おばんざい', '立ち飲み', 'BAR', 'カフェ', '中華',
      '焼肉・ホルモン', '鶏料理', '沖縄料理', '串焼き・鉄板焼き',
      'イタリアン・ワイン', 'スナック', 'ハンバーガー', 'ジビエ肉'
    ];
    const currentCat = store.category || raw['category'] || raw['カテゴリ'] || '居酒屋';
    const catSelect = document.getElementById('edit-store-category-select');
    const catCustom = document.getElementById('edit-store-category-custom');
    if (knownCategories.includes(currentCat)) {
      catSelect.value = currentCat;
      catCustom.style.display = 'none';
      catCustom.value = '';
    } else {
      catSelect.value = 'custom';
      catCustom.style.display = 'block';
      catCustom.value = currentCat;
    }

    // 3. 席スタイル設定
    const knownStyles = ['テーブルあり', 'カウンター', '立ち飲み', 'テイクアウト専門'];
    const currentStyle = store.style || raw['style'] || raw['スタイル'] || 'テーブルあり';
    const normalizedStyle = currentStyle === '立ち呑み' ? '立ち飲み' : currentStyle;
    const styleSelect = document.getElementById('edit-store-style');
    const styleCustom = document.getElementById('edit-store-style-custom');
    if (knownStyles.includes(normalizedStyle)) {
      styleSelect.value = normalizedStyle;
      if (styleCustom) {
        styleCustom.style.display = 'none';
        styleCustom.value = '';
      }
    } else {
      styleSelect.value = 'custom';
      if (styleCustom) {
        styleCustom.style.display = 'block';
        styleCustom.value = currentStyle;
      }
    }

    // 3.5 参加企画設定
    const currentPlan = store.plan_type || raw['plan_type'] || (store.quest_name ? '「酔いどれセット」・「店舗クエスト」両方で参加' : '「酔いどれセット」のみで参加');
    const planSelect = document.getElementById('edit-store-plan-type');
    if (planSelect) {
      if (currentPlan.includes('両方') || currentPlan === '両方') {
        planSelect.value = '「酔いどれセット」・「店舗クエスト」両方で参加';
      } else if (currentPlan.includes('クエスト')) {
        planSelect.value = '「店舗クエスト」のみで参加';
      } else {
        planSelect.value = '「酔いどれセット」のみで参加';
      }
    }

    // 4. 酔いどれタイプ設定
    const currentType = store.yoidore_type || store.type || raw['タイプ'] || raw['酔いどれタイプ'] || raw['type'] || 'サク飲み';
    const normalizedType = currentType === 'サク呑み' ? 'サク飲み' : currentType;
    document.getElementById('edit-store-type').value = 
      ['サク飲み', '腹ごしらえ', 'ひと休み', '夜遊び'].includes(normalizedType) ? normalizedType : 'サク飲み';

    // 5. テイクアウト設定
    let takeoutVal = 'テイクアウト不可';
    const rawTakeout = store.takeout !== undefined ? store.takeout : (raw['テイクアウト'] || (raw['isTakeout'] ? 'テイクアウトOK' : '不可'));
    if (rawTakeout === 'テイクアウト専門' || rawTakeout === '専門') {
      takeoutVal = 'テイクアウト専門';
    } else if (rawTakeout === true || rawTakeout === 'テイクアウトOK' || rawTakeout === '可能' || rawTakeout === '可' || rawTakeout === 'OK') {
      takeoutVal = 'テイクアウトOK';
    }
    document.getElementById('edit-store-takeout').value = takeoutVal;

    document.getElementById('edit-store-catchphrase').value = store.catchphrase || raw['キャッチコピー'] || raw['catchphrase'] || '';

    // 6. 提供日/営業日チェックボックス設定
    const currentDays = String(store.days || conditions.days || raw['提供日'] || '月,火,水,金,土,日');
    const dayCbs = document.querySelectorAll('input[name="store-days-check"]');
    dayCbs.forEach(cb => {
      cb.checked = currentDays.includes(cb.value);
    });

    // 7. 提供時間/営業時間設定
    const currentHours = String(store.hours || conditions.hours || raw['提供時間'] || raw['営業時間'] || '17:00〜23:00');
    const timeMatch = currentHours.match(/(\d{1,2}:\d{2})\s*[-〜~]\s*(?:翌)?(\d{1,2}:\d{2})/);
    if (timeMatch) {
      document.getElementById('edit-store-hours-start').value = timeMatch[1].padStart(5, '0');
      document.getElementById('edit-store-hours-end').value = timeMatch[2].padStart(5, '0');
      document.getElementById('edit-store-hours-nextday').checked = currentHours.includes('翌');
      const cleaned = currentHours.replace(timeMatch[0], '').replace(/翌/, '').replace(/^[()（）\s]+|[()（）\s]+$/g, '').trim();
      document.getElementById('edit-store-hours-custom').value = cleaned;
    } else {
      document.getElementById('edit-store-hours-start').value = '17:00';
      document.getElementById('edit-store-hours-end').value = '23:00';
      document.getElementById('edit-store-hours-nextday').checked = false;
      document.getElementById('edit-store-hours-custom').value = currentHours !== '17:00〜23:00' ? currentHours : '';
    }

    // 提供時間に対する補足
    document.getElementById('edit-store-time-notes').value = store.time_notes || conditions.timeNotes || raw['提供時間に対する補足'] || raw['time_notes'] || raw['時間補足'] || '';

    // 8. 決済方法チェックボックス設定
    const currentPayments = Array.isArray(store.paymentMethods) ? store.paymentMethods : 
      (Array.isArray(raw.paymentMethods) ? raw.paymentMethods : 
        String(store.payment || (raw['決済方法'] ? String(raw['決済方法']) : '現金')).split(/[,、]/).map(p => p.trim()));
    const payCbs = document.querySelectorAll('input[name="store-payment-check"]');
    const otherPayments = [];
    payCbs.forEach(cb => {
      cb.checked = false;
    });
    currentPayments.forEach(p => {
      let matched = false;
      payCbs.forEach(cb => {
        if (cb.value === p || 
            (cb.value === 'クレジットカード' && (p === 'クレカ' || p === 'カード' || p === 'VISA' || p === 'Mastercard')) || 
            (cb.value === '電子マネー・交通系IC' && (p === '電子マネー' || p === '交通系IC' || p === 'ICカード'))) {
          cb.checked = true;
          matched = true;
        }
      });
      if (!matched && p && p !== '-') {
        otherPayments.push(p);
      }
    });
    document.getElementById('edit-store-payment-other').value = otherPayments.join(', ');

    document.getElementById('edit-store-set-name').value = store.set_name || yoidoreSet.title || raw['酔いどれセット名'] || raw['セット名'] || '';
    document.getElementById('edit-store-set-price').value = store.set_price !== undefined ? store.set_price : (yoidoreSet.price || raw['価格'] || raw['セット価格'] || 1000);
    document.getElementById('edit-store-set-content').value = store.set_content || yoidoreSet.content || raw['セット内容'] || '';
    document.getElementById('edit-store-set-charge').value = store.set_charge || yoidoreSet.charge || raw['チャージ'] || raw['チャージ有無'] || '';
    document.getElementById('edit-store-set-limit').value = store.set_limit || conditions.limit || raw['限定数'] || '';
    document.getElementById('edit-store-set-notes').value = store.set_notes || yoidoreSet.notes || raw['セット備考'] || raw['備考'] || '';

    document.getElementById('edit-store-quest-name').value = store.quest_name || quest.title || raw['クエスト名'] || raw['クエストタイトル'] || '';
    document.getElementById('edit-store-quest-price').value = store.quest_price !== undefined ? store.quest_price : (quest.price || raw['クエスト価格'] || 0);
    document.getElementById('edit-store-quest-content').value = store.quest_content || quest.content || raw['クエスト内容'] || '';
    document.getElementById('edit-store-quest-charge').value = store.quest_charge || quest.charge || raw['クエストチャージ'] || '';
    document.getElementById('edit-store-quest-notes').value = store.quest_notes || quest.notes || raw['クエスト備考'] || '';

    document.getElementById('edit-store-map-url').value = store.map_url || store.googleMapUrl || raw.googleMapUrl || raw['Google Map URL'] || raw['map_url'] || '';
    document.getElementById('edit-store-insta-url').value = store.insta_url || store.instagramUrl || raw.instagramUrl || raw['Instagram URL'] || raw['insta_url'] || '';
    document.getElementById('edit-store-photo-url').value = store.photo_url || store.photoUrl || raw['photoUrl'] || raw['photo'] || (numId ? `photo/${numId}.jpg` : '');
    document.getElementById('edit-store-logo-url').value = store.logo_url || store.logoUrl || raw['logoUrl'] || raw['logo'] || (numId ? `logo/${numId}.png` : '');
    document.getElementById('edit-store-badge-sales').value = store.badge_sales_count || raw['badge_sales_count'] || '';
    document.getElementById('edit-store-coupon-target').checked = store.is_coupon_target !== false;

    this.updateMediaPreview();
    document.body.style.overflow = 'hidden';
    document.getElementById('store-modal').style.display = 'flex';
  }

  updateMediaPreview() {
    const photoVal = (document.getElementById('edit-store-photo-url').value || '').trim();
    const logoVal = (document.getElementById('edit-store-logo-url').value || '').trim();
    const mapVal = (document.getElementById('edit-store-map-url').value || '').trim();
    const instaVal = (document.getElementById('edit-store-insta-url').value || '').trim();

    // 写真プレビュー
    const photoBox = document.getElementById('preview-photo-box');
    const photoImg = document.getElementById('preview-photo-img');
    const photoStatus = document.getElementById('preview-photo-status');
    if (photoVal && photoBox && photoImg) {
      photoBox.style.display = 'block';
      photoImg.style.display = 'none';
      if (photoStatus) photoStatus.innerHTML = '<span style="color:#64748b;">⏳ 画像を読み込み中...</span>';
      
      photoImg.onload = () => {
        photoImg.style.display = 'block';
        if (photoStatus) photoStatus.innerHTML = '<span style="color:#15803d;"><i class="fa-solid fa-check"></i> 画像確認OK</span>';
      };
      photoImg.onerror = () => {
        photoImg.style.display = 'none';
        if (photoStatus) photoStatus.innerHTML = `<span style="color:#b45309; background:#fef3c7; padding:2px 6px; border-radius:3px;"><i class="fa-solid fa-triangle-exclamation"></i> 画像ファイル未配置 (<code>${photoVal}</code> を配置すると表示されます)</span>`;
      };
      photoImg.src = photoVal;
    } else if (photoBox) {
      photoBox.style.display = 'none';
      if (photoImg) photoImg.src = '';
    }

    // ロゴプレビュー
    const logoBox = document.getElementById('preview-logo-box');
    const logoImg = document.getElementById('preview-logo-img');
    const logoStatus = document.getElementById('preview-logo-status');
    if (logoVal && logoBox && logoImg) {
      logoBox.style.display = 'block';
      logoImg.style.display = 'none';
      if (logoStatus) logoStatus.innerHTML = '<span style="color:#64748b;">⏳ ロゴを読み込み中...</span>';

      logoImg.onload = () => {
        logoImg.style.display = 'block';
        if (logoStatus) logoStatus.innerHTML = '<span style="color:#15803d;"><i class="fa-solid fa-check"></i> ロゴ確認OK</span>';
      };
      logoImg.onerror = () => {
        logoImg.style.display = 'none';
        if (logoStatus) logoStatus.innerHTML = `<span style="color:#b45309; background:#fef3c7; padding:2px 6px; border-radius:3px;"><i class="fa-solid fa-triangle-exclamation"></i> ロゴファイル未配置 (<code>${logoVal}</code> を配置すると表示されます)</span>`;
      };
      logoImg.src = logoVal;
    } else if (logoBox) {
      logoBox.style.display = 'none';
      if (logoImg) logoImg.src = '';
    }

    // 地図URLテストリンク
    const mapBtn = document.getElementById('btn-check-map');
    if (mapBtn) {
      if (mapVal && mapVal.startsWith('http')) {
        mapBtn.href = mapVal;
        mapBtn.style.display = 'inline-flex';
      } else {
        mapBtn.style.display = 'none';
      }
    }

    // Instagram URLテストリンク
    const instaBtn = document.getElementById('btn-check-insta');
    if (instaBtn) {
      if (instaVal && instaVal.startsWith('http')) {
        instaBtn.href = instaVal;
        instaBtn.style.display = 'inline-flex';
      } else {
        instaBtn.style.display = 'none';
      }
    }
  }

  closeStoreModal() {
    document.body.style.overflow = '';
    document.getElementById('store-modal').style.display = 'none';
  }

  async saveStore() {
    const isNew = document.getElementById('edit-store-mode').value === 'new';
    const storeId = document.getElementById('edit-store-id').value.trim();
    if (!storeId) return alert('店舗IDは必須です');

    // 1. エリア取得
    const areaSelect = document.getElementById('edit-store-area-select').value;
    const area = areaSelect === 'custom' ? (document.getElementById('edit-store-area-custom').value.trim() || '大正') : areaSelect;

    // 2. ジャンル/カテゴリ取得
    const catSelect = document.getElementById('edit-store-category-select').value;
    const category = catSelect === 'custom' ? (document.getElementById('edit-store-category-custom').value.trim() || '居酒屋') : catSelect;

    // 3. 席スタイル取得
    const styleSelect = document.getElementById('edit-store-style').value;
    const style = styleSelect === 'custom' ? (document.getElementById('edit-store-style-custom').value.trim() || 'テーブルあり') : styleSelect;

    // 3.5 参加企画取得
    const planType = document.getElementById('edit-store-plan-type').value;

    // 4. 酔いどれタイプ取得
    const yoidore_type = document.getElementById('edit-store-type').value;

    // 5. テイクアウト取得
    const takeout = document.getElementById('edit-store-takeout').value;

    // 6. 営業日取得
    const selectedDays = [];
    document.querySelectorAll('input[name="store-days-check"]:checked').forEach(cb => {
      selectedDays.push(cb.value);
    });
    const days = selectedDays.length > 0 ? selectedDays.join(',') : '月,火,水,金,土,日';

    // 7. 営業時間取得
    const hStart = document.getElementById('edit-store-hours-start').value;
    const hEnd = document.getElementById('edit-store-hours-end').value;
    const isNextDay = document.getElementById('edit-store-hours-nextday').checked;
    const hCustom = document.getElementById('edit-store-hours-custom').value.trim();
    let hours = `${hStart || '17:00'}〜${isNextDay ? '翌' : ''}${hEnd || '23:00'}`;
    if (hCustom) {
      hours = `${hours} (${hCustom})`;
    }

    // 8. 決済方法取得
    const selectedPayments = [];
    document.querySelectorAll('input[name="store-payment-check"]:checked').forEach(cb => {
      selectedPayments.push(cb.value);
    });
    const pOther = document.getElementById('edit-store-payment-other').value.trim();
    if (pOther) {
      selectedPayments.push(pOther);
    }
    const payment = selectedPayments.length > 0 ? selectedPayments.join(', ') : '現金';

    const name = document.getElementById('edit-store-name').value.trim();
    if (!name) return alert('店舗名を入力してください');

    const catchphrase = document.getElementById('edit-store-catchphrase').value.trim();
    const timeNotes = document.getElementById('edit-store-time-notes').value.trim();
    const setName = document.getElementById('edit-store-set-name').value.trim();
    const setPrice = parseInt(document.getElementById('edit-store-set-price').value, 10) || 0;
    const setContent = document.getElementById('edit-store-set-content').value.trim();
    const setCharge = document.getElementById('edit-store-set-charge').value.trim();
    const setLimit = document.getElementById('edit-store-set-limit').value.trim();
    const setNotes = document.getElementById('edit-store-set-notes').value.trim();
    const questName = document.getElementById('edit-store-quest-name').value.trim();
    const questPrice = parseInt(document.getElementById('edit-store-quest-price').value, 10) || 0;
    const questContent = document.getElementById('edit-store-quest-content').value.trim();
    const questCharge = document.getElementById('edit-store-quest-charge').value.trim();
    const questNotes = document.getElementById('edit-store-quest-notes').value.trim();
    const badgeSalesCount = document.getElementById('edit-store-badge-sales').value.trim();
    const mapUrl = document.getElementById('edit-store-map-url').value.trim();
    const instaUrl = document.getElementById('edit-store-insta-url').value.trim();
    const photoUrl = document.getElementById('edit-store-photo-url').value.trim();
    const logoUrl = document.getElementById('edit-store-logo-url').value.trim();
    const isCouponTarget = document.getElementById('edit-store-coupon-target').checked;
    const displayOrder = parseInt(storeId.replace(/\D/g, ''), 10) || 0;

    const rawData = {
      id: storeId,
      name: name,
      area: area,
      category: category,
      style: style,
      type: yoidore_type,
      takeout: takeout,
      catchphrase: catchphrase,
      days: days,
      hours: hours,
      time_notes: timeNotes,
      payment: payment,
      is_coupon_target: isCouponTarget,
      plan_type: planType,
      set_name: setName,
      set_content: setContent,
      set_price: setPrice,
      set_charge: setCharge,
      set_limit: setLimit,
      set_notes: setNotes,
      quest_name: questName,
      quest_content: questContent,
      quest_price: questPrice,
      quest_charge: questCharge,
      quest_notes: questNotes,
      badge_sales_count: badgeSalesCount,
      map_url: mapUrl,
      insta_url: instaUrl,
      photo_url: photoUrl,
      logo_url: logoUrl
    };

    const storePayload = {
      id: storeId,
      name: name,
      area: area,
      is_coupon_target: isCouponTarget,
      display_order: displayOrder,
      raw_data: rawData
    };

    try {
      this.showToast('Supabaseへ保存中...');

      if (isNew) {
        // 新規登録: POST
        await this.api.supabaseFetch('stores?on_conflict=id', {
          method: 'POST',
          headers: {
            'Prefer': 'resolution=merge-duplicates,return=representation'
          },
          body: JSON.stringify(storePayload)
        });
      } else {
        // 既存更新: PATCH (確実な上書き)
        await this.api.supabaseFetch(`stores?id=eq.${storeId}`, {
          method: 'PATCH',
          headers: {
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(storePayload)
        });
      }

      this.closeStoreModal();
      this.showToast(`🎉 酒場「${name}」のデータをSupabaseに保存しました！`);
      await this.loadAllData();
    } catch (err) {
      alert('保存に失敗しました: ' + err.message);
      console.error(err);
    }
  }

  async deleteStore() {
    const storeId = document.getElementById('edit-store-id').value.trim();
    const name = document.getElementById('edit-store-name').value.trim();
    if (!storeId) return;

    if (!confirm(`本当に酒場「${name || storeId}」を削除しますか？\n（Supabaseのデータベースから完全に削除されます）`)) {
      return;
    }

    try {
      this.showToast(`酒場「${name}」を削除中...`);
      await this.api.supabaseFetch(`stores?id=eq.${storeId}`, {
        method: 'DELETE'
      });
      this.closeStoreModal();
      this.showToast(`酒場「${name}」を削除しました`);
      await this.loadAllData();
    } catch (err) {
      alert('削除に失敗しました: ' + err.message);
      console.error(err);
    }
  }

  /* ------------------------------------------------------------------------
   * Excel / アンケート一括インポート機能
   * ------------------------------------------------------------------------ */
  openExcelImportModal() {
    this.importData = [];
    const fileInput = document.getElementById('import-file-input');
    if (fileInput) fileInput.value = '';
    const resultsArea = document.getElementById('import-results-area');
    if (resultsArea) resultsArea.style.display = 'none';
    const executeBtn = document.getElementById('btn-execute-import');
    if (executeBtn) executeBtn.style.display = 'none';

    document.body.style.overflow = 'hidden';
    document.getElementById('excel-import-modal').style.display = 'flex';

    // ドラッグ＆ドロップイベントバインド
    const dropZone = document.getElementById('import-drop-zone');
    if (dropZone && !dropZone._bound) {
      dropZone._bound = true;
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
      });
      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
      });
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.parseExcelFile(e.dataTransfer.files[0]);
        }
      });
    }
  }

  closeExcelImportModal() {
    document.body.style.overflow = '';
    document.getElementById('excel-import-modal').style.display = 'none';
  }

  handleFileSelected(e) {
    if (e.target.files && e.target.files[0]) {
      this.parseExcelFile(e.target.files[0]);
    }
  }

  async parseExcelFile(file) {
    if (!window.XLSX) {
      alert('Excel解析ライブラリ (SheetJS) が準備できていません。ネットワーク環境をご確認ください。');
      return;
    }

    try {
      this.showToast('ファイルを解析中...');
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      if (rows.length < 2) {
        alert('データ行が見つかりませんでした。有効なアンケート回答ファイルを選択してください。');
        return;
      }

      const headers = rows[0].map(h => String(h || '').trim());
      const dataRows = rows.slice(1);

      // 既存店舗一覧から名前マッチング用ロジックを作成
      const normalizeStoreName = (name) => {
        if (!name) return '';
        let n = String(name).normalize('NFKC').toLowerCase();
        return n.replace(/[\s!！?？~〜\-_・·'"()（）\[\]/／\\]+/g, '');
      };

      const findExistingStore = (excelName) => {
        const normExcel = normalizeStoreName(excelName);
        if (!normExcel) return null;
        // 1. 完全一致
        for (const s of this.stores) {
          const normDB = normalizeStoreName(s.name);
          if (normExcel === normDB) return s;
        }
        // 2. 部分一致
        for (const s of this.stores) {
          const normDB = normalizeStoreName(s.name);
          if (normDB.includes(normExcel) || normExcel.includes(normDB)) return s;
        }
        return null;
      };

      let maxNum = 0;
      this.stores.forEach(s => {
        const num = parseInt((s.id || '').replace(/\D/g, ''), 10);
        if (!isNaN(num)) maxNum = Math.max(maxNum, num);
      });

      this.importData = [];
      let newCounter = maxNum + 1;

      dataRows.forEach((row) => {
        if (row.every(cell => String(cell).trim() === '')) return;

        const rowObj = {};
        headers.forEach((h, colIdx) => {
          rowObj[h] = row[colIdx] !== undefined ? row[colIdx] : '';
        });

        const storeName = String(row[1] || rowObj['店名'] || '').trim();
        if (!storeName) return;

        const participateAns = String(row[2] || rowObj['大正酔いどれクエストⅡに参加されますか？'] || '').trim();
        const isSkip = (participateAns === '参加しない' || storeName.includes('テスト'));

        // 既存店舗検索（正規化＆部分一致）
        const existing = findExistingStore(storeName);
        const storeId = existing ? existing.id : `store-${String(newCounter++).padStart(2, '0')}`;
        // 店舗名は既存があれば正式名称（例: バーガー酒場ハンバーガー・ママ）を優先
        const finalStoreName = existing ? existing.name : storeName;

        // 1. エリア
        let area = String(row[3] || rowObj['エリア'] || rowObj['  エリア  '] || (existing?.area || '三軒家西')).trim();
        if (!['三軒家西', '三軒家東', '駅前', '泉尾', '平尾'].includes(area)) {
          if (area.includes('三軒家西')) area = '三軒家西';
          else if (area.includes('三軒家東')) area = '三軒家東';
          else if (area.includes('駅前')) area = '駅前';
          else if (area.includes('泉尾')) area = '泉尾';
          else if (area.includes('平尾')) area = '平尾';
          else area = existing?.area || '三軒家西';
        }

        // 2. カテゴリ
        let category = String(row[4] || rowObj['カテゴリ'] || existing?.category || '居酒屋').trim();

        // 時刻フォーマット変換（Excelの小数シリアル値 0.5 -> 12:00, 0.625 -> 15:00, 0.708 -> 17:00, 0.937 -> 22:30 等を正確に変換）
        const formatExcelTime = (val, defaultTime = '17:00') => {
          if (val === null || val === undefined || val === '') return defaultTime;
          const num = typeof val === 'number' ? val : (typeof val === 'string' && !val.includes(':') ? parseFloat(val) : NaN);
          if (!isNaN(num) && num >= 0 && num <= 1) {
            const totalMinutes = Math.round(num * 24 * 60);
            const hours = Math.floor(totalMinutes / 60) % 24;
            const mins = totalMinutes % 60;
            return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
          }
          const str = String(val).trim();
          if (str.includes(':')) {
            const parts = str.split(':');
            return `${parts[0].padStart(2, '0')}:${(parts[1] || '00').padStart(2, '0')}`;
          }
          return str || defaultTime;
        };

        // 3. スタイル (表記ゆれ補正 & 詳細保持)
        let style = String(row[5] || rowObj['スタイル'] || existing?.style || 'テーブルあり').trim();
        if (style.includes('テールブ') && !style.includes('カウンター')) style = 'テーブルあり';
        else if (style === 'テールブあり') style = 'テーブルあり';

        // 4. タイプ (表記ゆれ補正)
        let yoidore_type = String(row[6] || rowObj['タイプ'] || existing?.type || 'サク飲み').trim();
        if (yoidore_type.includes('サク')) yoidore_type = 'サク飲み';
        else if (yoidore_type.includes('腹')) yoidore_type = '腹ごしらえ';
        else if (yoidore_type.includes('休')) yoidore_type = 'ひと休み';
        else if (yoidore_type.includes('遊')) yoidore_type = '夜遊び';

        // 5. テイクアウト
        let takeout = String(row[7] || rowObj['テイクアウト'] || (existing?.takeout || 'テイクアウト不可')).trim();
        if (takeout.includes('専門')) takeout = 'テイクアウト専門';
        else if (takeout.includes('OK') || takeout.includes('可') || takeout.includes('可能')) takeout = 'テイクアウトOK';
        else takeout = 'テイクアウト不可';

        // 6. 提供曜日 (「曜日」の「日」に誤爆しないよう厳密に判定)
        let daysRaw = String(row[8] || rowObj['提供曜日'] || '月,火,水,金,土,日').trim();
        let days = '月,火,水,金,土,日';
        if (daysRaw.includes('全て') || daysRaw.includes('全日') || daysRaw.includes('毎日')) {
          days = '月,火,水,木,金,土,日';
        } else {
          const daysList = [];
          ['月', '火', '水', '木', '金', '土', '日', '祝'].forEach(d => {
            if (d === '日') {
              if (/日曜日|日曜|(?:^|[,、\s])日(?:[,、\s]|$)/.test(daysRaw)) daysList.push('日');
            } else {
              if (daysRaw.includes(d)) daysList.push(d);
            }
          });
          days = daysList.length > 0 ? daysList.join(',') : '月,火,水,金,土,日';
        }

        // 7. 提供時間 & 提供時間に対する補足
        const hStart = formatExcelTime(row[9] !== undefined ? row[9] : rowObj['提供時間：開始'], '17:00');
        const hEnd = formatExcelTime(row[10] !== undefined ? row[10] : rowObj['提供時間：終了'], '23:00');
        const timeNote = String(row[11] || rowObj['提供時間に対する補足'] || '').trim();
        const cleanTimeNote = (timeNote && timeNote !== 'None') ? timeNote : '';
        const hours = `${hStart}〜${hEnd}`;

        // 8. 決済方法
        let payment = String(row[12] || rowObj['決済方法'] || (existing?.payment || '現金')).trim();

        // 9. クーポン取扱
        const couponAns = String(row[13] || rowObj['店舗クーポンを希望されますか？'] || '');
        const isCouponTarget = couponAns.includes('希望します') || couponAns.includes('はい') || couponAns === 'true' || Boolean(existing?.is_coupon_target);

        // 10. 参加企画とセット・クエストの抽出
        const planType = String(row[14] || rowObj['「どれクエⅡ」にはどの企画で参加されますか？'] || rowObj['  「どれクエⅡ」にはどの企画で参加されますか？  '] || '両方');
        
        let setName = '', setContent = '', setNotes = '', setPrice = 0, setCharge = '', setLimit = '';
        let questName = '', questContent = '', questNotes = '', questPrice = 0, questCharge = '';

        if (planType.includes('セット」のみ')) {
          setName = String(row[15] || rowObj['  酔いどれセット名  '] || rowObj['酔いどれセット名'] || '').trim();
          setContent = String(row[16] || rowObj['  酔いどれセット内容  '] || rowObj['酔いどれセット内容'] || '').trim();
          setNotes = String(row[17] || rowObj['セット内容備考'] || '').trim();
          setPrice = parseInt(String(row[18] || rowObj['  価格(税込)  '] || rowObj['価格(税込)']).replace(/\D/g, ''), 10) || 1000;
          setCharge = String(row[19] || rowObj['チャージ料(税込)'] || '').trim();
          setLimit = String(row[20] || rowObj['限定数量'] || '').trim();
        } else if (planType.includes('クエスト」のみ')) {
          questName = String(row[21] || rowObj['クエスト名'] || '').trim();
          questContent = String(row[22] || rowObj['クエスト内容/報酬'] || '').trim();
          questPrice = parseInt(String(row[23] || rowObj['クエスト料金(税込)']).replace(/\D/g, ''), 10) || 0;
          questCharge = String(row[24] || rowObj['クエストチャージ料 (税込)'] || '').trim();
          questNotes = String(row[25] || rowObj['クエスト備考'] || '').trim();
        } else {
          // 両方
          setName = String(row[26] || rowObj['酔いどれセット名'] || row[15] || '').trim();
          setContent = String(row[27] || rowObj['  酔いどれセット内容   2'] || row[16] || '').trim();
          setNotes = String(row[28] || rowObj['セット内容備考 2'] || row[17] || '').trim();
          setPrice = parseInt(String(row[29] || rowObj['価格(税込)'] || row[18]).replace(/\D/g, ''), 10) || 1000;
          setCharge = String(row[30] || rowObj['チャージ料(税込) 2'] || row[19] || '').trim();
          setLimit = String(row[31] || rowObj['限定数量 2'] || row[20] || '').trim();

          questName = String(row[32] || rowObj['クエスト名 2'] || row[21] || '').trim();
          questContent = String(row[33] || rowObj['クエスト内容/報酬 2'] || row[22] || '').trim();
          questPrice = parseInt(String(row[34] || rowObj['クエスト料金(税込) 2'] || row[23]).replace(/\D/g, ''), 10) || 0;
          questCharge = String(row[35] || rowObj['クエストチャージ料 (税込) 2'] || row[24] || '').trim();
          questNotes = String(row[36] || rowObj['クエスト備考 2'] || row[25] || '').trim();
        }

        // 11. 参加証(缶バッチ)販売希望数
        const badgeSalesRaw = String(row[37] || rowObj['お客様向け参加証(缶バッチ)\u3000販売希望数は？'] || rowObj['お客様向け参加証(缶バッチ) 販売希望数は？'] || '').trim();

        // 既存店舗から引き継ぐ情報（写真・ロゴ・地図URL・キャッチコピー等）
        const numId = storeId.replace(/\D/g, '').padStart(3, '0');
        const map_url = existing?.map_url || existing?.raw_data?.googleMapUrl || existing?.raw_data?.['Google Map URL'] || '';
        const insta_url = existing?.insta_url || existing?.raw_data?.instagramUrl || existing?.raw_data?.['Instagram URL'] || '';
        const photo_url = existing?.photo_url || existing?.raw_data?.photo || (numId ? `photo/${numId}.jpg` : '');
        const logo_url = existing?.logo_url || existing?.raw_data?.logo || (numId ? `logo/${numId}.png` : '');
        const catchphrase = existing?.catchphrase || existing?.raw_data?.キャッチコピー || existing?.raw_data?.catchphrase || '';

        const item = {
          id: storeId,
          name: finalStoreName,
          isExisting: Boolean(existing),
          isSkip,
          area,
          category,
          style,
          yoidore_type,
          takeout,
          catchphrase,
          days,
          hours,
          time_notes: cleanTimeNote,
          payment,
          is_coupon_target: isCouponTarget,
          planType,
          set_name: setName || existing?.set_name || existing?.raw_data?.酔いどれセット名 || '酔いどれセット',
          set_content: setContent || existing?.set_content || existing?.raw_data?.セット内容 || '',
          set_price: setPrice || existing?.set_price || existing?.raw_data?.['価格(円)'] || 1000,
          set_charge: (setCharge === 'None' || setCharge === '0.0') ? 'なし' : (setCharge || existing?.set_charge || existing?.raw_data?.チャージ || '不要'),
          set_limit: (setLimit === 'None' || setLimit === '0.0') ? '' : (setLimit || existing?.set_limit || existing?.raw_data?.限定数 || ''),
          set_notes: setNotes === 'None' ? '' : (setNotes || existing?.set_notes || existing?.raw_data?.セット備考 || ''),
          quest_name: questName || existing?.quest_name || existing?.raw_data?.クエスト名 || '',
          quest_content: questContent || existing?.quest_content || existing?.raw_data?.クエスト内容 || '',
          quest_price: questPrice || existing?.quest_price || existing?.raw_data?.['クエスト価格(円)'] || 0,
          quest_charge: (questCharge === 'None' || questCharge === '0.0') ? 'なし' : (questCharge || existing?.quest_charge || existing?.raw_data?.クエストチャージ || '不要'),
          quest_notes: questNotes === 'None' ? '' : (questNotes || existing?.quest_notes || existing?.raw_data?.クエスト備考 || ''),
          badge_sales_count: badgeSalesRaw,
          map_url,
          insta_url,
          photo_url,
          logo_url
        };

        this.importData.push(item);
      });

      this.renderImportPreview();
    } catch (err) {
      alert('ファイルの解析中にエラーが発生しました: ' + err.message);
      console.error(err);
    }
  }

  renderImportPreview() {
    const resultsArea = document.getElementById('import-results-area');
    const executeBtn = document.getElementById('btn-execute-import');
    const tbody = document.getElementById('import-preview-body');

    if (!resultsArea || !tbody) return;

    let updateCount = 0;
    let newCount = 0;
    let skipCount = 0;

    this.importData.forEach(item => {
      if (item.isSkip) skipCount++;
      else if (item.isExisting) updateCount++;
      else newCount++;
    });

    document.getElementById('import-count-total').textContent = `総件数: ${this.importData.length}件`;
    document.getElementById('import-count-update').textContent = `既存店舗の上書き: ${updateCount}件`;
    document.getElementById('import-count-new').textContent = `新規店舗の追加: ${newCount}件`;
    document.getElementById('import-count-skip').textContent = `除外(不参加/テスト): ${skipCount}件`;

    tbody.innerHTML = this.importData.map((item, idx) => {
      const statusBadge = item.isSkip ?
        '<span class="badge" style="background:#f1f5f9; color:#64748b;">除外</span>' :
        (item.isExisting ?
          '<span class="badge" style="background:#dcfce7; color:#15803d;">上書き更新</span>' :
          '<span class="badge" style="background:#fef3c7; color:#b45309;">新規追加</span>');

      const timeDisplay = `${item.hours || '-'}${item.time_notes ? `<br><small style="color:#d97706;">💡 ${item.time_notes}</small>` : ''}`;

      return `
        <tr style="${item.isSkip ? 'opacity: 0.5; background: #f8fafc;' : ''}">
          <td>${statusBadge}</td>
          <td><code>${item.id}</code></td>
          <td><strong>${item.name}</strong></td>
          <td><span class="badge badge-area">${item.area}</span> <span class="badge">${item.category}</span></td>
          <td><small>${timeDisplay}</small></td>
          <td><small style="color:#64748b;">${item.planType.includes('両方') ? '両方' : (item.planType.includes('セット') ? 'セットのみ' : 'クエストのみ')}</small></td>
          <td>${item.set_name ? `${item.set_name} (¥${item.set_price.toLocaleString()})` : '-'}</td>
          <td>${item.quest_name || '-'}</td>
          <td style="text-align: center;">${item.is_coupon_target ? '🎁 対象' : '-'}</td>
        </tr>
      `;
    }).join('');

    resultsArea.style.display = 'block';
    if (executeBtn) {
      executeBtn.style.display = (updateCount + newCount > 0) ? 'inline-flex' : 'none';
      executeBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> ${updateCount + newCount}件をSupabaseに反映する`;
    }
  }

  async executeImport() {
    const validItems = this.importData.filter(d => !d.isSkip);
    if (validItems.length === 0) return alert('インポート対象の店舗がありません');

    const confirmMsg = `合計 ${validItems.length} 件の店舗データをSupabaseに反映（上書き・新規登録）します。よろしいですか？`;
    if (!confirm(confirmMsg)) return;

    try {
      this.showToast(`Supabaseへ一括保存中 (0 / ${validItems.length})...`);
      let successCount = 0;

      for (let i = 0; i < validItems.length; i++) {
        const item = validItems[i];
        const displayOrder = parseInt(String(item.id).replace(/\D/g, ''), 10) || (i + 1);

        const rawData = {
          id: item.id,
          name: item.name,
          area: item.area,
          category: item.category,
          style: item.style,
          type: item.yoidore_type,
          takeout: item.takeout,
          catchphrase: item.catchphrase || '',
          days: item.days,
          hours: item.hours,
          time_notes: item.time_notes || '',
          payment: item.payment,
          is_coupon_target: Boolean(item.is_coupon_target),
          plan_type: item.planType || '両方',
          set_name: item.set_name || '酔いどれセット',
          set_content: item.set_content || '',
          set_price: item.set_price || 1000,
          set_charge: item.set_charge || '不要',
          set_limit: item.set_limit || '',
          set_notes: item.set_notes || '',
          quest_name: item.quest_name || '',
          quest_content: item.quest_content || '',
          quest_price: item.quest_price || 0,
          quest_charge: item.quest_charge || '不要',
          quest_notes: item.quest_notes || '',
          badge_sales_count: item.badge_sales_count || '',
          map_url: item.map_url || '',
          insta_url: item.insta_url || '',
          photo_url: item.photo_url || '',
          logo_url: item.logo_url || ''
        };

        const storePayload = {
          id: item.id,
          name: item.name,
          area: item.area,
          is_coupon_target: Boolean(item.is_coupon_target),
          display_order: displayOrder,
          raw_data: rawData
        };

        // on_conflict=id を指定したUPSERT保存で100%確実に上書き・保存
        await this.api.supabaseFetch('stores?on_conflict=id', {
          method: 'POST',
          headers: {
            'Prefer': 'resolution=merge-duplicates,return=representation'
          },
          body: JSON.stringify(storePayload)
        });

        successCount++;
        this.showToast(`Supabaseへ保存中 (${successCount} / ${validItems.length})...`);
      }

      this.closeExcelImportModal();
      this.showToast(`🎉 ${successCount} 軒の酒場アンケート情報をSupabaseへ同期・更新しました！`);
      await this.loadAllData();
    } catch (err) {
      alert('インポート途中でエラーが発生しました: ' + err.message);
      console.error(err);
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
    const fallback = window.APP_CONFIG?.fallbackSeasonGuidance || {};
    if (current) {
      document.getElementById('edit-season-name').value = current.name || '';
      document.getElementById('edit-season-start').value = current.start_date || '2026-08-01';
      document.getElementById('edit-season-end').value = current.end_date || '2026-08-31';
      document.getElementById('edit-season-valid').value = current.coupon_valid_until || '2026-09-30';

      // ガイダンス設定
      const overviewEl = document.getElementById('edit-season-overview');
      if (overviewEl) overviewEl.value = current.overview || fallback.overview || '';

      const steps = (current.guide_steps && current.guide_steps.length >= 3) ? current.guide_steps : (fallback.guide_steps || []);
      const s1Title = document.getElementById('edit-season-step1-title');
      const s1Desc = document.getElementById('edit-season-step1-desc');
      const s2Title = document.getElementById('edit-season-step2-title');
      const s2Desc = document.getElementById('edit-season-step2-desc');
      const s3Title = document.getElementById('edit-season-step3-title');
      const s3Desc = document.getElementById('edit-season-step3-desc');

      if (s1Title) s1Title.value = steps[0]?.title || '酒場へ突入せよ';
      if (s1Desc) s1Desc.value = steps[0]?.desc || '気になる酒場へ赴き「どれクエ参加」を伝え、限定メニューを注文！';
      if (s2Title) s2Title.value = steps[1]?.title || '冒険の書に刻印せよ';
      if (s2Desc) s2Desc.value = steps[1]?.desc || '店内に設置された秘伝のQRコードをカメラで読み取り、制覇スタンプをGET！';
      if (s3Title) s3Title.value = steps[2]?.title || '秘宝の宝箱を開放せよ';
      if (s3Desc) s3Desc.value = steps[2]?.desc || 'ハシゴ軒数を重ねて宝箱を解放！酒場クーポンや限定オリジナルグッズを獲得！';

      const rulesEl = document.getElementById('edit-season-rules');
      if (rulesEl) rulesEl.value = current.rules_notes || fallback.rules_notes || '';
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
    } else {
      tierElem.innerHTML = this.tiers.map(t => {
        const isGoods = t.reward_type === 'goods';
        return `
          <div class="tier-card ${isGoods ? 'tier-goods' : ''}">
            <div class="tier-card-header">
              <span class="tag ${isGoods ? 'tag-warning' : 'tag-active'}" style="font-size: 0.75rem;">
                ${isGoods ? '<i class="fa-solid fa-gift"></i> グッズ引換型' : '<i class="fa-solid fa-ticket"></i> クーポン型'}
              </span>
              <span class="tier-meta-badge"><i class="fa-solid fa-beer-mug-empty"></i> 必要: <strong>${t.required_visits}</strong> 軒</span>
            </div>
            <h4 class="tier-title">${this.escapeHtml(t.title)}</h4>
            <div class="tier-reward-info">
              ${isGoods ? 
                `<span class="tier-meta-badge"><i class="fa-solid fa-gift"></i> グッズ: <strong>${this.escapeHtml(t.goods_name || 'オリジナル記念品')}</strong></span>` :
                `<span class="tier-meta-badge"><i class="fa-solid fa-ticket"></i> 獲得: <strong>${t.selectable_count}</strong> 店舗</span>`
              }
            </div>
            ${isGoods && t.exchange_location ? `
              <div class="tier-location-text">
                📍 <strong>引換:</strong> ${this.escapeHtml(t.exchange_location)}
              </div>
            ` : ''}
            ${t.description ? `<p class="tier-desc">${this.escapeHtml(t.description)}</p>` : ''}
            <div class="tier-actions">
              <button class="btn btn-outline btn-sm" onclick="window.adminApp.openTierModal('edit', ${t.id})">
                <i class="fa-solid fa-pen-to-square"></i> 編集
              </button>
              <button class="btn btn-outline-danger btn-sm" onclick="window.adminApp.deleteTier(${t.id}, '${this.escapeHtml(t.title)}')">
                <i class="fa-solid fa-trash"></i> 削除
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
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
        title: `${maxVisits ? maxVisits + 5 : 5}軒ハシゴ達成特典`,
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

    document.body.style.overflow = 'hidden';
    document.getElementById('tier-modal').style.display = 'flex';
  }

  closeTierModal() {
    document.body.style.overflow = '';
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

    document.body.style.overflow = 'hidden';
    document.getElementById('hero-title-modal').style.display = 'flex';
  }

  closeHeroTitleModal() {
    document.body.style.overflow = '';
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
    const current = (this.seasons && this.seasons.find(s => s.id === this.selectedSeasonId)) || this.api.currentSeason || { id: 2 };
    const name = document.getElementById('edit-season-name').value.trim();
    const start_date = document.getElementById('edit-season-start').value;
    const end_date = document.getElementById('edit-season-end').value;
    const coupon_valid_until = document.getElementById('edit-season-valid').value;

    const overview = document.getElementById('edit-season-overview')?.value.trim() || '';
    const s1Title = document.getElementById('edit-season-step1-title')?.value.trim() || '酒場へ突入せよ';
    const s1Desc = document.getElementById('edit-season-step1-desc')?.value.trim() || '';
    const s2Title = document.getElementById('edit-season-step2-title')?.value.trim() || '冒険の書に刻印せよ';
    const s2Desc = document.getElementById('edit-season-step2-desc')?.value.trim() || '';
    const s3Title = document.getElementById('edit-season-step3-title')?.value.trim() || '秘宝の宝箱を開放せよ';
    const s3Desc = document.getElementById('edit-season-step3-desc')?.value.trim() || '';
    const rules_notes = document.getElementById('edit-season-rules')?.value.trim() || '';

    const guide_steps = [
      { step: '其の一', title: s1Title, desc: s1Desc },
      { step: '其の二', title: s2Title, desc: s2Desc },
      { step: '其の三', title: s3Title, desc: s3Desc }
    ];

    const seasonData = {
      id: current.id || 2,
      name: name || current.name || '大正酔いどれクエストⅡ',
      start_date,
      end_date,
      coupon_valid_until,
      overview,
      guide_steps,
      rules_notes,
      is_active: current.is_active !== undefined ? current.is_active : true
    };

    try {
      this.showToast('開催日程・ガイダンスを保存中...');
      await this.api.adminSaveSeason(seasonData);
      this.selectedSeasonId = seasonData.id;
      this.showToast(`第${seasonData.id}回の開催日程＆ガイダンス設定を保存しました！`);
      await this.loadAllData();
      this.renderSeasonSettings();
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
    document.body.style.overflow = 'hidden';
    document.getElementById('season-modal').style.display = 'flex';
  }

  closeSeasonModal() {
    document.body.style.overflow = '';
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
          <span class="pop-event-badge">大正区ハシゴ酒イベント</span>
          <div class="pop-event-title">🍺 ${this.escapeHtml(seasonTitle)} ⚔️</div>
        </div>
        <div class="pop-store-name">${this.escapeHtml(store.name)}</div>
        <div class="pop-store-area">${this.escapeHtml(store.area || '')} 【${this.escapeHtml(store.id)}】</div>
        <div class="pop-qr-wrapper" id="pop-qr-${store.id}"></div>
        <div class="pop-guide-text">📱 スマホのカメラでQRを読み取って<br>【店主サインを受け取る】！</div>
        <div class="pop-sub-guide">※冒険の書にサインが刻まれ、ハシゴ件数が記録されます</div>
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
