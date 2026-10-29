/**
 * 大正酔いどれクエスト - バックオフィス管理システムロジック
 */

class YoidoreAdminApp {
  constructor() {
    this.api = window.questApi;
    this.supabaseClient = null;
    this.adminSession = null;
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

    // ページネーション状態管理
    this.storePagination = { page: 1, pageSize: 20 };
    this.userPagination = { page: 1, pageSize: 20 };
    this.lastFilteredStores = [];
    this.lastFilteredUsers = [];

    this.initSupabaseClient();
    this.init();
  }

  initSupabaseClient() {
    if (window.supabase && window.APP_CONFIG?.supabase?.url && window.APP_CONFIG?.supabase?.anonKey) {
      try {
        this.supabaseClient = window.supabase.createClient(
          window.APP_CONFIG.supabase.url,
          window.APP_CONFIG.supabase.anonKey,
          {
            auth: {
              persistSession: true,
              autoRefreshToken: true,
              detectSessionInUrl: true
            }
          }
        );
      } catch (e) {
        console.error('Failed to initialize Supabase client:', e);
      }
    }
  }

  async init() {
    await this.checkAuthSession();
    this.setupEventListeners();
  }

  /* ------------------------------------------------------------------------
   * 認証制御 (Supabase Auth 連携 & ログイン維持)
   * ------------------------------------------------------------------------ */
  async checkAuthSession() {
    if (this.supabaseClient) {
      try {
        const { data: { session }, error } = await this.supabaseClient.auth.getSession();
        if (session && session.user) {
          // 前回「ログイン保持しない」と選択していた場合、ブラウザ再起動で破棄
          if (sessionStorage.getItem('yoidore_admin_session_only') === 'expired') {
            await this.supabaseClient.auth.signOut();
          } else {
            this.adminSession = session;
            if (this.api) {
              this.api.setAdminAccessToken(session.access_token);
            }
            this.showAdminApp();
            return;
          }
        }
      } catch (err) {
        console.warn('Session restoration failed:', err);
      }
    }

    // 未認証の場合はログイン画面を表示
    const lockModal = document.getElementById('auth-lock-modal');
    if (lockModal) lockModal.style.display = 'flex';
    const adminAppEl = document.getElementById('admin-app');
    if (adminAppEl) adminAppEl.style.display = 'none';
  }

  async handleLogin() {
    const emailEl = document.getElementById('admin-email');
    const passwordEl = document.getElementById('admin-password');
    const rememberEl = document.getElementById('admin-remember');
    const errEl = document.getElementById('auth-error');
    const btnEl = document.getElementById('admin-login-btn');

    const email = (emailEl?.value || '').trim();
    const password = passwordEl?.value || '';

    if (!email || !password) {
      if (errEl) {
        errEl.textContent = 'メールアドレスとパスワードを入力してください';
        errEl.style.display = 'block';
      }
      return;
    }

    if (btnEl) {
      btnEl.disabled = true;
      btnEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ログイン中...';
    }
    if (errEl) errEl.style.display = 'none';

    try {
      if (!this.supabaseClient) {
        this.initSupabaseClient();
      }
      if (!this.supabaseClient) {
        throw new Error('Supabase認証サービスが利用できません。ページを再読み込みしてください。');
      }

      const { data, error } = await this.supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw error;
      }

      if (data && data.session) {
        this.adminSession = data.session;
        if (this.api) {
          this.api.setAdminAccessToken(data.session.access_token);
        }

        // ログイン維持フラグ
        if (rememberEl && !rememberEl.checked) {
          window.addEventListener('beforeunload', () => {
            sessionStorage.setItem('yoidore_admin_session_only', 'expired');
          }, { once: true });
        } else {
          sessionStorage.removeItem('yoidore_admin_session_only');
        }

        this.showAdminApp();
      } else {
        throw new Error('セッションの取得に失敗しました');
      }
    } catch (err) {
      console.error('管理者ログインエラー:', err);
      if (errEl) {
        let msg = 'ログインに失敗しました。メールアドレスまたはパスワードをご確認ください。';
        const errMsg = err.message || '';
        if (errMsg.includes('Invalid login credentials')) {
          msg = 'メールアドレスまたはパスワードが正しくありません。';
        } else if (errMsg.includes('Email not confirmed')) {
          msg = 'メールアドレスが認証されていません。Supabase管理画面のUsersにて「Auto Confirm」を有効にして再登録してください。';
        } else if (errMsg) {
          msg = `エラー: ${errMsg}`;
        }
        errEl.textContent = msg;
        errEl.style.display = 'block';
      }
    } finally {
      if (btnEl) {
        btnEl.disabled = false;
        btnEl.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> 管理画面にログイン';
      }
    }
  }

  async handleLogout() {
    if (confirm('管理画面からログアウトしますか？')) {
      try {
        if (this.supabaseClient) {
          await this.supabaseClient.auth.signOut();
        }
      } catch (e) {
        console.warn('SignOut error:', e);
      }
      this.adminSession = null;
      if (this.api) {
        this.api.setAdminAccessToken(null);
      }
      sessionStorage.removeItem('yoidore_admin_session_only');
      window.location.reload();
    }
  }

  showAdminApp() {
    const lockModal = document.getElementById('auth-lock-modal');
    if (lockModal) lockModal.style.display = 'none';
    const adminAppEl = document.getElementById('admin-app');
    if (adminAppEl) adminAppEl.style.display = 'flex';

    // ログイン中の管理者メールアドレスを表示
    const userEmailEl = document.getElementById('admin-user-email');
    if (userEmailEl && this.adminSession?.user?.email) {
      userEmailEl.textContent = this.adminSession.user.email;
      userEmailEl.title = this.adminSession.user.email;
    }

    this.applyVersionBadges();
    this.loadAllData();
  }

  applyVersionBadges() {
    const versionStr = (window.APP_CONFIG && window.APP_CONFIG.version) || 'v2026.10.20.06';
    document.querySelectorAll('.app-version-text').forEach(el => {
      el.textContent = versionStr;
    });
  }

  /* ------------------------------------------------------------------------
   * 価格・料金表示フォーマッター (文字列・範囲・数値を安全に整形)
   * ------------------------------------------------------------------------ */
  formatPrice(price, isQuest = false) {
    if (price === null || price === undefined || price === '') {
      return isQuest ? '無料' : '-';
    }
    const str = String(price).trim();
    if (str === '0' || str === '0円' || str === '無料' || str === 'なし' || str === '不要') {
      return isQuest ? '無料' : '-';
    }
    const cleanNumStr = str.replace(/[,，]/g, '');
    if (/^\d+(\.\d+)?$/.test(cleanNumStr)) {
      const num = Math.round(parseFloat(cleanNumStr));
      return `¥${num.toLocaleString()}`;
    }
    return str;
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

      // 2. 店舗データ (選択中シーズンの企画情報と基本マスタを合成)
      this.stores = await this.api.getStores(this.selectedSeasonId);

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

      // 5. 来店ログ一覧 (選択中シーズンで絞り込み)
      try {
        const rawVisits = await this.api.supabaseFetch(`visits?select=*&order=visited_at.desc`);
        this.visits = Array.isArray(rawVisits) ? rawVisits.filter(v => {
          const vSeason = Number(v.season_id);
          return vSeason === this.selectedSeasonId || (!v.season_id && this.selectedSeasonId === 2);
        }) : [];
      } catch (e) {
        this.visits = [];
      }

      // 6. クーポン発行・消し込み履歴 (選択中シーズンで絞り込み & 特典ランクマスタとの突き合わせ・グッズ判定)
      try {
        const rawCoupons = await this.api.supabaseFetch(`user_coupons?select=*&order=acquired_at.desc`);
        const goodsTiers = (this.tiers || []).filter(t => t.reward_type === 'goods');

        const filteredCoupons = Array.isArray(rawCoupons) ? rawCoupons.filter(c => {
          const cSeason = Number(c.season_id);
          return cSeason === this.selectedSeasonId || (!c.season_id && this.selectedSeasonId === 2);
        }) : [];

        this.coupons = filteredCoupons.map(c => {
          const tierStatusMatch = typeof c.status === 'string' ? c.status.match(/^tier_(\d+)_(active|used)$/) : null;
          let tierIdNum = c.reward_tier_id ? Number(c.reward_tier_id) : null;
          let normalizedStatus = c.status;

          if (tierStatusMatch) {
            tierIdNum = parseInt(tierStatusMatch[1], 10);
            normalizedStatus = tierStatusMatch[2];
          } else if (c.status === 'used') {
            normalizedStatus = 'used';
          } else {
            normalizedStatus = 'active';
          }

          let matchedTier = (this.tiers || []).find(t => Number(t.id) === tierIdNum);
          const isGoods = matchedTier ? (matchedTier.reward_type === 'goods') : (c.reward_type === 'goods');
          return {
            ...c,
            status: normalizedStatus,
            season_id: this.selectedSeasonId,
            reward_tier_id: tierIdNum || matchedTier?.id || null,
            reward_type: isGoods ? 'goods' : (c.reward_type || 'store_coupon'),
            goods_name: matchedTier?.goods_name || c.goods_name || (isGoods ? matchedTier?.title : null),
            exchange_location: matchedTier?.exchange_location || c.exchange_location || null,
            exchange_notice: matchedTier?.exchange_notice || c.exchange_notice || null,
            title: matchedTier?.title || c.title || ''
          };
        });
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
      this.renderPopTierSelect();

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
   * シーズンの期間フェーズ判定（日付＆本番稼働判定の分離）
   * ------------------------------------------------------------------------ */
  getSeasonPhaseInfo(season) {
    if (!season) return { phaseKey: 'unknown', phaseLabel: '不明', badgeClass: 'tag-area', timerText: '-', isEventActive: false, isCouponUsable: false };
    const now = new Date();
    const startDate = season.start_date ? new Date(season.start_date) : null;
    const endDate = season.end_date ? new Date(season.end_date) : null;
    if (endDate) endDate.setHours(23, 59, 59, 999);
    const validUntil = season.coupon_valid_until ? new Date(season.coupon_valid_until) : null;
    if (validUntil) validUntil.setHours(23, 59, 59, 999);

    if (startDate && now < startDate) {
      const days = Math.max(1, Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      return {
        phaseKey: 'upcoming',
        phaseLabel: '開催前（準備中）',
        badgeClass: 'tag-area',
        timerText: `開幕まであと ${days} 日`,
        isEventActive: false,
        isCouponUsable: false
      };
    } else if (now <= endDate) {
      const days = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      return {
        phaseKey: 'event_active',
        phaseLabel: 'イベント開催中',
        badgeClass: 'tag-active',
        timerText: `開催終了まであと ${days} 日`,
        isEventActive: true,
        isCouponUsable: false
      };
    } else if (now <= validUntil) {
      const days = Math.max(0, Math.ceil((validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      return {
        phaseKey: 'coupon_only',
        phaseLabel: '特典クーポン利用期間中',
        badgeClass: 'tag-active',
        timerText: `クーポン利用期限まであと ${days} 日`,
        isEventActive: false,
        isCouponUsable: true
      };
    } else {
      return {
        phaseKey: 'closed',
        phaseLabel: '全期間終了（アーカイブ）',
        badgeClass: 'tag-area',
        timerText: 'イベント終了',
        isEventActive: false,
        isCouponUsable: false
      };
    }
  }

  /* ------------------------------------------------------------------------
   * シーズン切替制御
   * ------------------------------------------------------------------------ */
  renderSeasonSelector() {
    const sel = document.getElementById('season-selector');
    if (!sel) return;
    sel.innerHTML = this.seasons.map(s => {
      const phase = this.getSeasonPhaseInfo(s);
      const activeNote = s.is_active ? ` (本番適用中 / ${phase.phaseLabel})` : ` (${phase.phaseLabel})`;
      return `
        <option value="${s.id}" ${s.id === this.selectedSeasonId ? 'selected' : ''}>
          ${this.escapeHtml(s.name)}${activeNote}
        </option>
      `;
    }).join('');
  }

  async onSeasonSelectChange(seasonId) {
    this.selectedSeasonId = parseInt(seasonId, 10);
    const targetSeason = this.seasons.find(s => s.id === this.selectedSeasonId);
    const seasonName = targetSeason ? targetSeason.name : '選択中イベント';
    this.showToast(`「${seasonName}」のデータに切り替え中...`);
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

    const phase = this.getSeasonPhaseInfo(current);
    banner.className = 'status-banner mb-4';

    if (phase.phaseKey === 'upcoming') {
      banner.classList.add('banner-warning');
      icon.textContent = '⏳';
      title.textContent = `【開催前】${current.name}`;
      desc.textContent = `開催予定: ${current.start_date} 〜 ${current.end_date}`;
      timer.textContent = phase.timerText;
    } else if (phase.phaseKey === 'event_active') {
      banner.classList.add('banner-active');
      icon.textContent = '🍺';
      title.textContent = `【イベント開催中】${current.name}`;
      desc.textContent = `ハシゴ酒クエスト開催中！ (〜 ${current.end_date} まで)`;
      timer.textContent = phase.timerText;
    } else if (phase.phaseKey === 'coupon_only') {
      banner.classList.add('banner-active');
      icon.textContent = '🎁';
      title.textContent = `【特典クーポン利用期間中】${current.name}`;
      desc.textContent = `ハシゴ酒イベント（サイン集め）は終了しました。現在は獲得クーポンの酒場利用期間です（〜 ${current.coupon_valid_until} まで）！`;
      timer.textContent = phase.timerText;
    } else {
      banner.classList.add('banner-expired');
      icon.textContent = '🔒';
      title.textContent = `【全期間終了】${current.name}`;
      desc.textContent = `今期のハシゴ酒クエストおよび特典クーポン利用期間はすべて終了いたしました。`;
      timer.textContent = `終了済`;
    }
  }

  /* ------------------------------------------------------------------------
   * 1. ダッシュボード描画
   * ------------------------------------------------------------------------ */
  renderDashboard() {
    // KPI
    const usedStoreCoupons = this.coupons.filter(c => c.reward_type !== 'goods' && c.status === 'used' && c.store_id);
    const usedGoods = this.coupons.filter(c => c.reward_type === 'goods' && c.status === 'used');

    const usersElem = document.getElementById('kpi-users-count');
    if (usersElem) {
      usersElem.textContent = this.users.length.toLocaleString();
    }

    const storesElem = document.getElementById('kpi-stores-count');
    if (storesElem) storesElem.textContent = this.stores.filter(s => s.is_participating !== false).length.toLocaleString();
    
    const couponsElem = document.getElementById('kpi-coupons-used');
    if (couponsElem) couponsElem.textContent = `${usedStoreCoupons.length.toLocaleString()} 件`;

    const goodsElem = document.getElementById('kpi-goods-used');
    if (goodsElem) goodsElem.textContent = `${usedGoods.length.toLocaleString()} 点`;

    // 酒場クーポン利用人気 TOP 5
    const couponStoreMap = {};
    usedStoreCoupons.forEach(c => {
      couponStoreMap[c.store_id] = (couponStoreMap[c.store_id] || 0) + 1;
    });

    const sortedCoupons = Object.entries(couponStoreMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topCouponsElem = document.getElementById('top-coupons-ranking');
    if (topCouponsElem) {
      if (sortedCoupons.length === 0) {
        topCouponsElem.innerHTML = '<div class="empty-state text-muted py-3">今期のクーポン利用データがありません</div>';
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
                <strong style="color: #10b981;">${count} 回利用 (消込)</strong>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // リアルタイムアクティビティ速報
    const activityElem = document.getElementById('recent-activity-list');
    const recentCoupons = (this.coupons || []).slice(0, 10).map(c => ({
      type: c.status === 'used' ? 'used' : 'acquired',
      isGoods: c.reward_type === 'goods',
      goodsName: c.goods_name || c.title || '記念品',
      time: new Date(c.used_at || c.acquired_at),
      storeId: c.store_id,
      userId: c.user_id
    }));

    const allActivities = recentCoupons
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

        let icon = '🎁';
        let text = '';
        if (act.type === 'acquired') {
          if (act.isGoods) {
            icon = '🎁';
            text = `<strong>${this.escapeHtml(userName)}</strong> が <strong>${this.escapeHtml(act.goodsName)}</strong> の引換券を獲得しました`;
          } else {
            icon = '🎁';
            text = `<strong>${this.escapeHtml(userName)}</strong> が <strong>${this.escapeHtml(storeName || '酒場特典')}</strong> のクーポンを獲得しました`;
          }
        } else if (act.type === 'used') {
          if (act.isGoods) {
            icon = '🎁';
            text = `<strong>${this.escapeHtml(userName)}</strong> が <strong>${this.escapeHtml(act.goodsName)}</strong> を受け取り（引換済）ました`;
          } else {
            icon = '✅';
            text = `<strong>${this.escapeHtml(userName)}</strong> が <strong>${this.escapeHtml(storeName)}</strong> でクーポンを利用（消し込み）しました`;
          }
        }

        const timeStr = isNaN(act.time.getTime()) ? '-' : `${act.time.getMonth() + 1}/${act.time.getDate()} ${String(act.time.getHours()).padStart(2, '0')}:${String(act.time.getMinutes()).padStart(2, '0')}`;

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
    const totalStoreCoupons = this.coupons.filter(c => c.reward_type !== 'goods' && c.status === 'used' && c.store_id).length;
    const totalGoods = this.coupons.filter(c => c.reward_type === 'goods' && c.status === 'used').length;
    const participatingStores = this.stores.filter(s => s.is_participating !== false).length;
    const totalUsers = this.users.length;

    const cElem = document.getElementById('analytics-total-store-coupons');
    if (cElem) cElem.textContent = `${totalStoreCoupons.toLocaleString()} 件`;
    const gElem = document.getElementById('analytics-total-goods');
    if (gElem) gElem.textContent = `${totalGoods.toLocaleString()} 点`;
    const sElem = document.getElementById('analytics-total-stores');
    if (sElem) sElem.textContent = `${participatingStores.toLocaleString()} 軒`;
    const uElem = document.getElementById('analytics-total-users');
    if (uElem) uElem.textContent = `${totalUsers.toLocaleString()} 名`;

    // 2. 酒場実績サマリーKPIピル集計
    const storeStats = this.getAnalyticsStoreStats();
    const storeTotalElem = document.getElementById('analytics-kpi-store-total');
    if (storeTotalElem) storeTotalElem.textContent = `${storeStats.length} 軒`;
    const storeUsedElem = document.getElementById('analytics-kpi-store-used');
    if (storeUsedElem) {
      const usedCount = storeStats.filter(s => s.usedCount > 0).length;
      storeUsedElem.textContent = `${usedCount} 軒`;
    }
    const storeUnusedElem = document.getElementById('analytics-kpi-store-unused');
    if (storeUnusedElem) {
      const unusedCount = storeStats.filter(s => s.usedCount === 0).length;
      storeUnusedElem.textContent = `${unusedCount} 軒`;
    }
    const storeCouponElem = document.getElementById('analytics-kpi-store-coupon');
    if (storeCouponElem) {
      const couponCount = storeStats.filter(s => s.isCouponTarget).length;
      storeCouponElem.textContent = `${couponCount} 軒`;
    }

    // 3. 特典サマリーKPIピル集計
    const tiers = this.tiers || [];
    const tierTotalElem = document.getElementById('analytics-kpi-tier-total');
    if (tierTotalElem) tierTotalElem.textContent = `${tiers.length} 件`;
    const tierCouponElem = document.getElementById('analytics-kpi-tier-coupon');
    if (tierCouponElem) {
      const couponTiers = tiers.filter(t => t.reward_type !== 'goods').length;
      tierCouponElem.textContent = `${couponTiers} 件`;
    }
    const tierGoodsElem = document.getElementById('analytics-kpi-tier-goods');
    if (tierGoodsElem) {
      const goodsTiers = tiers.filter(t => t.reward_type === 'goods').length;
      tierGoodsElem.textContent = `${goodsTiers} 件`;
    }
    const tierReachedElem = document.getElementById('analytics-kpi-tier-reached');
    if (tierReachedElem) {
      const reachedTiers = tiers.filter(t => {
        return this.coupons.some(c => Number(c.reward_tier_id) === Number(t.id));
      }).length;
      tierReachedElem.textContent = `${reachedTiers} 件`;
    }

    // 4. エリアフィルター初期化
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

    // 5. テーブル＆カード描画
    this.renderAnalyticsStoreTable();
    this.renderAnalyticsTierCards();
  }

  /* 酒場集計データ算出共通ヘルパー */
  getAnalyticsStoreStats() {
    return this.stores.map(store => {
      const raw = store.raw_data || {};
      const usedCount = this.coupons.filter(c => c.store_id === store.id && c.status === 'used' && c.reward_type !== 'goods').length;

      let planType = raw.plan_type || '';
      if (!planType) {
        if (raw.set_name && raw.quest_name) planType = '両方で参加';
        else if (raw.set_name) planType = '「酔いどれセット」のみ';
        else if (raw.quest_name) planType = '「お遊びゲーム」のみ';
        else planType = '-';
      }

      return {
        id: store.id,
        name: store.name,
        area: store.area || '',
        planType,
        isCouponTarget: !!store.is_coupon_target,
        usedCount
      };
    });
  }

  /* 酒場実績 サマリーピル クイック絞り込み */
  quickFilterAnalyticsStores(type) {
    const pillIds = [
      'kpi-pill-analytics-store-total',
      'kpi-pill-analytics-store-used',
      'kpi-pill-analytics-store-unused',
      'kpi-pill-analytics-store-coupon'
    ];
    pillIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });

    const activeMap = {
      'all': 'kpi-pill-analytics-store-total',
      'has_used': 'kpi-pill-analytics-store-used',
      'no_used': 'kpi-pill-analytics-store-unused',
      'coupon_target': 'kpi-pill-analytics-store-coupon'
    };
    if (activeMap[type]) {
      const el = document.getElementById(activeMap[type]);
      if (el) el.classList.add('active');
    }

    const statusFilter = document.getElementById('analytics-store-status-filter');
    if (statusFilter) statusFilter.value = type;

    const segmentGroup = document.getElementById('analytics-store-segmented');
    if (segmentGroup) {
      segmentGroup.querySelectorAll('.segment-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.val === type);
      });
    }

    this.renderAnalyticsStoreTable();
  }

  /* 酒場実績 セグメントボタン切り替え */
  setAnalyticsStoreSegment(val) {
    this.quickFilterAnalyticsStores(val);
  }

  /* 酒場実績 フィルター全リセット */
  resetAnalyticsStoreFilters() {
    const searchInput = document.getElementById('analytics-store-search');
    if (searchInput) searchInput.value = '';
    const areaFilter = document.getElementById('analytics-area-filter');
    if (areaFilter) areaFilter.value = '';
    const planFilter = document.getElementById('analytics-plan-filter');
    if (planFilter) planFilter.value = '';
    const sortSelect = document.getElementById('analytics-sort-select');
    if (sortSelect) sortSelect.value = 'used_desc';

    this.quickFilterAnalyticsStores('all');
  }

  renderAnalyticsStoreTable() {
    const tbody = document.getElementById('analytics-stores-tbody');
    const countElem = document.getElementById('analytics-store-count');
    const filteredBadge = document.getElementById('analytics-store-filtered-count');
    if (!tbody) return;

    const search = (document.getElementById('analytics-store-search')?.value || '').trim().toLowerCase();
    const statusFilter = document.getElementById('analytics-store-status-filter')?.value || 'all';
    const areaFilter = document.getElementById('analytics-area-filter')?.value || '';
    const planFilter = document.getElementById('analytics-plan-filter')?.value || '';
    const sortBy = document.getElementById('analytics-sort-select')?.value || 'used_desc';

    // 全店舗ごとの実績計算
    const storeStats = this.getAnalyticsStoreStats();
    if (countElem) countElem.textContent = storeStats.length;

    // 絞り込み
    let filtered = storeStats.filter(st => {
      const matchSearch = !search || st.id.toLowerCase().includes(search) || st.name.toLowerCase().includes(search) || st.area.toLowerCase().includes(search);
      const matchArea = !areaFilter || st.area === areaFilter;

      let matchStatus = true;
      if (statusFilter === 'has_used') {
        matchStatus = st.usedCount > 0;
      } else if (statusFilter === 'no_used') {
        matchStatus = st.usedCount === 0;
      } else if (statusFilter === 'coupon_target') {
        matchStatus = st.isCouponTarget;
      }

      let matchPlan = true;
      if (planFilter === 'both') {
        matchPlan = st.planType.includes('両方');
      } else if (planFilter === 'set') {
        matchPlan = st.planType.includes('セット');
      } else if (planFilter === 'quest') {
        matchPlan = st.planType.includes('クエスト') || st.planType.includes('ゲーム');
      }

      return matchSearch && matchArea && matchStatus && matchPlan;
    });

    // ソート
    filtered.sort((a, b) => {
      if (sortBy === 'used_desc') return b.usedCount - a.usedCount || a.id.localeCompare(b.id, undefined, { numeric: true });
      if (sortBy === 'used_asc') return a.usedCount - b.usedCount || a.id.localeCompare(b.id, undefined, { numeric: true });
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name, 'ja');
      return a.id.localeCompare(b.id, undefined, { numeric: true });
    });

    if (filteredBadge) filteredBadge.textContent = `表示中: ${filtered.length} 軒`;

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">該当する酒場実績がありません</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(st => {
      const planBadge = st.planType.includes('両方') 
        ? '<span class="badge" style="background:#e0f2fe; color:#0369a1; font-size:11px;">両方参加</span>'
        : (st.planType.includes('セット')
          ? '<span class="badge" style="background:#fef3c7; color:#b45309; font-size:11px;">セットのみ</span>'
          : (st.planType.includes('クエスト') || st.planType.includes('ゲーム')
            ? '<span class="badge" style="background:#f3e8ff; color:#7e22ce; font-size:11px;">お遊びゲームのみ</span>'
            : `<span class="badge" style="background:#f1f5f9; color:#64748b; font-size:11px;">${this.escapeHtml(st.planType)}</span>`));

      const couponTargetIcon = st.isCouponTarget 
        ? '<span class="badge" style="background:#dcfce7; color:#15803d; font-size:11px;"><i class="fa-solid fa-check"></i> 対象</span>' 
        : '<span style="color:#94a3b8; font-size:11px;">-</span>';

      return `
        <tr>
          <td><code style="font-size:12px; font-weight:bold;">${this.escapeHtml(st.id)}</code></td>
          <td>
            <strong style="color:#0f172a; font-size:13px;">${this.escapeHtml(st.name)}</strong>
          </td>
          <td><span class="tag tag-area">${this.escapeHtml(st.area)}</span></td>
          <td>${planBadge}</td>
          <td style="text-align: right; font-weight: bold; color: #059669; font-size: 14px;">
            ${st.usedCount} <span style="font-size:11px; font-weight:normal; color:#64748b;">件</span>
          </td>
          <td style="text-align: center;">
            ${couponTargetIcon}
          </td>
        </tr>
      `;
    }).join('');
  }

  renderAnalyticsTierCards() {
    this.renderAnalyticsTierTable();
  }

  /* 特典・グッズ サマリーピル クイック絞り込み */
  quickFilterAnalyticsTiers(type) {
    const pillIds = [
      'kpi-pill-analytics-tier-total',
      'kpi-pill-analytics-tier-coupon',
      'kpi-pill-analytics-tier-goods',
      'kpi-pill-analytics-tier-reached'
    ];
    pillIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });

    const activeMap = {
      'all': 'kpi-pill-analytics-tier-total',
      'store_coupon': 'kpi-pill-analytics-tier-coupon',
      'goods': 'kpi-pill-analytics-tier-goods',
      'has_reached': 'kpi-pill-analytics-tier-reached'
    };
    if (activeMap[type]) {
      const el = document.getElementById(activeMap[type]);
      if (el) el.classList.add('active');
    }

    const typeFilter = document.getElementById('analytics-tier-type-filter');
    const statusFilter = document.getElementById('analytics-tier-status-filter');

    if (type === 'store_coupon' || type === 'goods') {
      if (typeFilter) typeFilter.value = type;
      if (statusFilter) statusFilter.value = 'all';
    } else if (type === 'has_reached') {
      if (typeFilter) typeFilter.value = 'all';
      if (statusFilter) statusFilter.value = 'has_reached';
    } else {
      if (typeFilter) typeFilter.value = 'all';
      if (statusFilter) statusFilter.value = 'all';
    }

    const segmentGroup = document.getElementById('analytics-tier-segmented');
    if (segmentGroup) {
      const segVal = (type === 'store_coupon' || type === 'goods') ? type : 'all';
      segmentGroup.querySelectorAll('.segment-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.val === segVal);
      });
    }

    this.renderAnalyticsTierTable();
  }

  /* 特典・グッズ セグメントボタン切り替え */
  setAnalyticsTierSegment(val) {
    this.quickFilterAnalyticsTiers(val);
  }

  /* 特典・グッズ フィルター全リセット */
  resetAnalyticsTierFilters() {
    const searchInput = document.getElementById('analytics-tier-search');
    if (searchInput) searchInput.value = '';
    const statusFilter = document.getElementById('analytics-tier-status-filter');
    if (statusFilter) statusFilter.value = 'all';
    const sortSelect = document.getElementById('analytics-tier-sort-select');
    if (sortSelect) sortSelect.value = 'visits_asc';

    this.quickFilterAnalyticsTiers('all');
  }

  renderAnalyticsTierTable() {
    const tbody = document.getElementById('analytics-tiers-tbody');
    const countElem = document.getElementById('analytics-tier-count');
    const filteredBadge = document.getElementById('analytics-tier-filtered-count');
    if (!tbody) return;

    const search = (document.getElementById('analytics-tier-search')?.value || '').trim().toLowerCase();
    const typeFilter = document.getElementById('analytics-tier-type-filter')?.value || 'all';
    const statusFilter = document.getElementById('analytics-tier-status-filter')?.value || 'all';
    const sortBy = document.getElementById('analytics-tier-sort-select')?.value || 'visits_asc';

    let tiers = this.tiers || [];
    if (countElem) countElem.textContent = tiers.length;

    // 各特典の統計データを付与
    const tierStats = tiers.map(tier => {
      const isGoods = tier.reward_type === 'goods';
      const tierCoupons = this.coupons.filter(c => Number(c.reward_tier_id) === Number(tier.id));
      const reachedUsersSet = new Set(tierCoupons.map(c => c.user_id));
      const reachedUsersCount = reachedUsersSet.size;

      let usedCount = 0;
      let remainingCount = 0;
      let progressPercent = 0;

      if (isGoods) {
        usedCount = tierCoupons.filter(c => c.status === 'used').length;
        remainingCount = Math.max(0, tierCoupons.length - usedCount);
        progressPercent = tierCoupons.length > 0 ? Math.round((usedCount / tierCoupons.length) * 100) : 0;
      } else {
        usedCount = tierCoupons.filter(c => c.status === 'used').length;
        remainingCount = Math.max(0, tierCoupons.length - usedCount);
        progressPercent = tierCoupons.length > 0 ? Math.round((usedCount / tierCoupons.length) * 100) : 0;
      }

      const requiredCount = Number(tier.required_visits || tier.required_count) || 0;

      return {
        tier,
        isGoods,
        tierCoupons,
        reachedUsersCount,
        usedCount,
        remainingCount,
        progressPercent,
        requiredCount
      };
    });

    // 絞り込み
    let filtered = tierStats.filter(st => {
      const t = st.tier;
      const matchSearch = !search || 
        (t.title || '').toLowerCase().includes(search) || 
        (t.goods_name || '').toLowerCase().includes(search) || 
        (t.reward_desc || '').toLowerCase().includes(search) || 
        (t.title_reward || '').toLowerCase().includes(search);

      const matchType = typeFilter === 'all' || t.reward_type === typeFilter;

      let matchStatus = true;
      if (statusFilter === 'has_reached') {
        matchStatus = st.reachedUsersCount > 0;
      } else if (statusFilter === 'has_remaining') {
        matchStatus = st.remainingCount > 0;
      } else if (statusFilter === 'completed') {
        matchStatus = st.reachedUsersCount > 0 && st.remainingCount === 0;
      } else if (statusFilter === 'no_reached') {
        matchStatus = st.reachedUsersCount === 0;
      }

      return matchSearch && matchType && matchStatus;
    });

    // ソート
    filtered.sort((a, b) => {
      if (sortBy === 'visits_desc') return b.requiredCount - a.requiredCount;
      if (sortBy === 'reached_desc') return b.reachedUsersCount - a.reachedUsersCount || a.requiredCount - b.requiredCount;
      if (sortBy === 'used_desc') return b.usedCount - a.usedCount || a.requiredCount - b.requiredCount;
      if (sortBy === 'remaining_desc') return b.remainingCount - a.remainingCount || a.requiredCount - b.requiredCount;
      return a.requiredCount - b.requiredCount;
    });

    if (filteredBadge) filteredBadge.textContent = `表示中: ${filtered.length} 件`;

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">該当する特典データがありません</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(st => {
      const tier = st.tier;
      const isGoods = st.isGoods;
      const badge = isGoods 
        ? '<span class="badge" style="background:#fef3c7; color:#b45309; border:1px solid #fde68a;"><i class="fa-solid fa-gift"></i> グッズ引換型</span>' 
        : '<span class="badge" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd;"><i class="fa-solid fa-wine-glass"></i> 酒場クーポン型</span>';

      let detailName = '';
      let targetCountHtml = '';
      let usedCountHtml = '';
      let remainCountHtml = '';
      let progressBarColor = '';

      if (isGoods) {
        detailName = `<strong style="color:#0f172a;">🎁 ${this.escapeHtml(tier.goods_name || tier.title)}</strong>`;
        progressBarColor = 'linear-gradient(90deg, #10b981, #059669)';
        targetCountHtml = `<strong>${st.reachedUsersCount}</strong> 名<br><small class="text-muted">(獲得計 ${st.tierCoupons.length}点)</small>`;
        usedCountHtml = `<strong style="color:#059669; font-size:1.05rem;">${st.usedCount}</strong> <small>点</small>`;
        remainCountHtml = `<strong style="color:#d97706; font-size:1.05rem;">${st.remainingCount}</strong> <small>点</small>`;
      } else {
        const selectableCount = Number(tier.selectable_count || tier.coupon_count) || 5;
        detailName = `お好きな酒場 <strong style="color:#0284c7;">${selectableCount}</strong> 枠分`;
        progressBarColor = 'linear-gradient(90deg, #38bdf8, #0284c7)';
        targetCountHtml = `<strong>${st.reachedUsersCount}</strong> 名<br><small class="text-muted">(付与計 ${st.tierCoupons.length}枠)</small>`;
        usedCountHtml = `<strong style="color:#059669; font-size:1.05rem;">${st.usedCount}</strong> <small>件</small>`;
        remainCountHtml = `<strong style="color:#d97706; font-size:1.05rem;">${st.remainingCount}</strong> <small>枠</small>`;
      }

      return `
        <tr>
          <td>
            <span class="badge" style="background:#f1f5f9; color:#334155; font-weight:bold;">
              ${st.requiredCount} 軒達成
            </span>
          </td>
          <td>${badge}</td>
          <td><strong style="color:#0f172a;">${this.escapeHtml(tier.title)}</strong></td>
          <td>${detailName}</td>
          <td style="text-align: right;">${targetCountHtml}</td>
          <td style="text-align: right;">${usedCountHtml}</td>
          <td style="text-align: right;">${remainCountHtml}</td>
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              <div style="flex:1; background:#f1f5f9; border-radius:4px; height:8px; overflow:hidden;">
                <div style="background:${progressBarColor}; height:100%; width:${st.progressPercent}%; transition:width 0.3s;"></div>
              </div>
              <span style="font-size:12px; font-weight:bold; color:#334155; min-width:38px; text-align:right;">${st.progressPercent}%</span>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  exportAnalyticsStoresToCSV() {
    let csvContent = '\uFEFF酒場ID,酒場名,エリア,参加企画,クーポン取扱対象,クーポン利用数(消込済)\n';
    
    this.stores.forEach(store => {
      const raw = store.raw_data || {};
      const usedCount = this.coupons.filter(c => c.store_id === store.id && c.status === 'used' && c.reward_type !== 'goods').length;

      let planType = raw.plan_type || '';
      if (!planType) {
        if (raw.set_name && raw.quest_name) planType = '両方で参加';
        else if (raw.set_name) planType = '「酔いどれセット」のみ';
        else if (raw.quest_name) planType = '「お遊びゲーム」のみ';
        else planType = '-';
      }

      csvContent += `"${store.id}","${(store.name || '').replace(/"/g, '""')}","${store.area || ''}","${planType}","${store.is_coupon_target ? '対象' : '非対象'}",${usedCount}\n`;
    });

    const filename = `大正酔いどれクエスト_全酒場実績集計_${new Date().toISOString().slice(0, 10)}.csv`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    this.showToast(`CSV「${filename}」を出力しました`);
  }

  exportAnalyticsTiersToCSV() {
    let csvContent = '\uFEFF特典ID,特典名,種別,必要達成軒数,グッズ名/特典枠数,引換場所,達成獲得人数,利用・受取済数,未利用・未受取残数,進捗率\n';
    
    (this.tiers || []).forEach(tier => {
      const isGoods = tier.reward_type === 'goods';
      const tierCoupons = this.coupons.filter(c => Number(c.reward_tier_id) === Number(tier.id));
      const reachedUsersCount = new Set(tierCoupons.map(c => c.user_id)).size;

      let detailName = '';
      let usedCount = 0;
      let remaining = 0;
      let rateStr = '0.0%';

      if (isGoods) {
        detailName = tier.goods_name || tier.title;
        usedCount = tierCoupons.filter(c => c.status === 'used').length;
        remaining = Math.max(0, tierCoupons.length - usedCount);
        rateStr = tierCoupons.length > 0 ? `${Math.round((usedCount / tierCoupons.length) * 100)}%` : '0%';
      } else {
        const selectableCount = Number(tier.selectable_count || tier.coupon_count) || 5;
        detailName = `${selectableCount}酒場分`;
        const totalSlots = tierCoupons.length;
        usedCount = tierCoupons.filter(c => c.status === 'used').length;
        remaining = Math.max(0, totalSlots - usedCount);
        rateStr = totalSlots > 0 ? `${Math.round((usedCount / totalSlots) * 100)}%` : '0%';
      }

      const reqCount = tier.required_visits || tier.required_count || 5;
      csvContent += `${tier.id},"${(tier.title || '').replace(/"/g, '""')}","${isGoods ? 'グッズ引換型' : '酒場クーポン型'}",${reqCount},"${detailName.replace(/"/g, '""')}","${(tier.exchange_location || '-').replace(/"/g, '""')}",${reachedUsersCount},${usedCount},${remaining},"${rateStr}"\n`;
    });

    const filename = `大正酔いどれクエスト_特典別達成集計_${new Date().toISOString().slice(0, 10)}.csv`;
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
  updateStoreKPIs() {
    const total = this.stores.length;
    const organizer = this.stores.filter(s => Boolean(s.is_organizer || s.isOrganizer)).length;
    const setStores = this.stores.filter(s => Boolean(s.set_name || s.set_price || (s.plan_type && s.plan_type.includes('セット')))).length;
    const questStores = this.stores.filter(s => Boolean(s.quest_name || s.quest_price || (s.plan_type && (s.plan_type.includes('クエスト') || s.plan_type.includes('ゲーム'))))).length;
    const couponStores = this.stores.filter(s => Boolean(s.is_coupon_target)).length;

    const elemTotal = document.getElementById('store-kpi-total');
    if (elemTotal) elemTotal.textContent = `${total.toLocaleString()} 軒`;

    const elemOrganizer = document.getElementById('store-kpi-organizer');
    if (elemOrganizer) elemOrganizer.textContent = `${organizer.toLocaleString()} 軒`;

    const elemSet = document.getElementById('store-kpi-set');
    if (elemSet) elemSet.textContent = `${setStores.toLocaleString()} 軒`;

    const elemQuest = document.getElementById('store-kpi-quest');
    if (elemQuest) elemQuest.textContent = `${questStores.toLocaleString()} 軒`;

    const elemCoupon = document.getElementById('store-kpi-coupon');
    if (elemCoupon) elemCoupon.textContent = `${couponStores.toLocaleString()} 軒`;
  }

  /* 共通テーブルページネーション描画ヘルパー */
  renderPaginationControls({
    barId,
    rangeTextId,
    controlsId,
    totalItems,
    currentPage,
    pageSize,
    unit = '件',
    onPageChange
  }) {
    const bar = document.getElementById(barId);
    if (!bar) return;

    if (totalItems === 0) {
      bar.style.display = 'none';
      return;
    }
    bar.style.display = 'flex';

    const rangeText = document.getElementById(rangeTextId);
    const controls = document.getElementById(controlsId);

    const isAll = pageSize === 'all';
    const numPageSize = isAll ? totalItems : Number(pageSize);
    const totalPages = isAll ? 1 : Math.max(1, Math.ceil(totalItems / numPageSize));
    const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

    // 範囲テキスト表示
    if (rangeText) {
      if (isAll) {
        rangeText.textContent = `全 ${totalItems.toLocaleString()} ${unit} を表示中`;
      } else {
        const start = (validCurrentPage - 1) * numPageSize + 1;
        const end = Math.min(validCurrentPage * numPageSize, totalItems);
        rangeText.textContent = `${start.toLocaleString()} 〜 ${end.toLocaleString()} ${unit} / 全 ${totalItems.toLocaleString()} ${unit}`;
      }
    }

    if (!controls) return;

    // 全件表示時、または 1ページのみの場合は簡易表示
    if (totalPages <= 1) {
      controls.innerHTML = `
        <button class="pagination-btn" disabled><i class="fa-solid fa-chevron-left"></i> 前へ</button>
        <button class="pagination-btn active">1</button>
        <button class="pagination-btn" disabled>次へ <i class="fa-solid fa-chevron-right"></i></button>
      `;
      return;
    }

    // 複数ページある場合のボタン生成
    let buttonsHtml = '';

    // 前へボタン
    const prevDisabled = validCurrentPage <= 1 ? 'disabled' : '';
    const prevOnClick = validCurrentPage <= 1 ? '' : `onclick="${onPageChange}(${validCurrentPage - 1})"`;
    buttonsHtml += `<button class="pagination-btn" ${prevDisabled} ${prevOnClick} title="前のページ"><i class="fa-solid fa-chevron-left"></i> 前へ</button>`;

    // ページ番号ボタン生成ロジック
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (validCurrentPage > 3) {
        pages.push('...');
      }
      const startP = Math.max(2, validCurrentPage - 1);
      const endP = Math.min(totalPages - 1, validCurrentPage + 1);
      for (let i = startP; i <= endP; i++) {
        pages.push(i);
      }
      if (validCurrentPage < totalPages - 2) {
        pages.push('...');
      }
      pages.push(totalPages);
    }

    pages.forEach(p => {
      if (p === '...') {
        buttonsHtml += `<span class="pagination-ellipsis">…</span>`;
      } else if (p === validCurrentPage) {
        buttonsHtml += `<button class="pagination-btn active">${p}</button>`;
      } else {
        buttonsHtml += `<button class="pagination-btn" onclick="${onPageChange}(${p})">${p}</button>`;
      }
    });

    // 次へボタン
    const nextDisabled = validCurrentPage >= totalPages ? 'disabled' : '';
    const nextOnClick = validCurrentPage >= totalPages ? '' : `onclick="${onPageChange}(${validCurrentPage + 1})"`;
    buttonsHtml += `<button class="pagination-btn" ${nextDisabled} ${nextOnClick} title="次のページ">次へ <i class="fa-solid fa-chevron-right"></i></button>`;

    controls.innerHTML = buttonsHtml;
  }

  /* 店舗マスター ページ移動 */
  goToStorePage(targetPage) {
    this.storePagination.page = targetPage;
    this.renderStoresTable(this.lastFilteredStores, true);
    const tableElem = document.getElementById('store-table-body');
    if (tableElem) {
      tableElem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  /* 店舗マスター 表示件数変更 */
  setStorePageSize(size) {
    this.storePagination.pageSize = size === 'all' ? 'all' : parseInt(size, 10);
    this.storePagination.page = 1;
    this.renderStoresTable(this.lastFilteredStores, true);
  }

  renderStoresTable(filtered = null, preservePage = false) {
    this.updateStoreKPIs();

    const stores = filtered !== null ? filtered : this.stores;
    this.lastFilteredStores = stores;

    // ページ位置の制御
    if (!preservePage) {
      this.storePagination.page = 1;
    }

    const pageSize = this.storePagination.pageSize;
    const totalItems = stores.length;
    const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(totalItems / pageSize));
    if (this.storePagination.page > totalPages) {
      this.storePagination.page = totalPages;
    }
    const currentPage = this.storePagination.page;

    // ページネーション用スライス
    const startIndex = pageSize === 'all' ? 0 : (currentPage - 1) * pageSize;
    const endIndex = pageSize === 'all' ? totalItems : Math.min(startIndex + pageSize, totalItems);
    const pagedStores = stores.slice(startIndex, endIndex);

    const tbody = document.getElementById('store-table-body');

    // エリアプルダウンの動的生成
    const areaFilter = document.getElementById('area-filter');
    if (areaFilter && areaFilter.children.length <= 1) {
      const areas = Array.from(new Set(this.stores.map(s => s.area))).filter(Boolean);
      areas.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a;
        opt.textContent = a;
        areaFilter.appendChild(opt);
      });
    }

    // 表示件数バッジの更新
    const countBadge = document.getElementById('store-filtered-count');
    if (countBadge) {
      countBadge.textContent = stores.length === this.stores.length 
        ? `表示中: ${stores.length} 軒` 
        : `表示中: ${stores.length} / ${this.stores.length} 軒`;
    }

    // ページネーションコントロール描画
    this.renderPaginationControls({
      barId: 'store-pagination-bar',
      rangeTextId: 'store-pagination-range-text',
      controlsId: 'store-pagination-controls',
      totalItems,
      currentPage,
      pageSize,
      unit: '軒',
      onPageChange: 'window.adminApp.goToStorePage'
    });

    if (stores.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-muted">該当する店舗がありません</td></tr>';
      return;
    }

    tbody.innerHTML = pagedStores.map(store => {
      const isParticipating = Boolean(store.is_participating);
      const isCoupon = Boolean(store.is_coupon_target);
      // 1899年等の壊れた日時文字列をクレンジングして安全に表示
      const formatDisplayHours = (h) => {
        if (!h) return '-';
        let val = String(h).trim();
        val = val.replace(/[A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{1,2}\s+1899\s*/gi, '').trim();
        const m = val.match(/(?:^|[^\d])(\d{1,2}:\d{2})\s*[-〜~]\s*(?:翌)?(\d{1,2}:\d{2})/);
        if (m) {
          const startH = m[1].padStart(5, '0');
          const endH = m[2].padStart(5, '0');
          const isOvernight = val.includes('翌') || (endH <= startH);
          const base = `${startH}〜${isOvernight ? '翌' : ''}${endH}`;
          const custom = val.replace(m[0], '').replace(/翌/, '').replace(/^[()（）\s]+|[()（）\s]+$/g, '').trim();
          return custom ? `${base} (${custom})` : base;
        }
        return val || '-';
      };
      const hoursText = formatDisplayHours(store.hours);
      const timeNotes = store.time_notes || store.conditions?.timeNotes || '';
      const daysText = store.days || '-';
      const setNameText = store.set_name || '-';
      const setPriceText = this.formatPrice(store.set_price);
      const questNameText = store.quest_name || '-';
      const questPriceText = this.formatPrice(store.quest_price, true);

      return `
        <tr>
          <td><code>${this.escapeHtml(store.id)}</code></td>
          <td>
            <div class="table-store-name" style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <strong>${this.escapeHtml(store.name)}</strong>
              ${(store.is_organizer || store.isOrganizer) ? 
                '<span class="badge" style="background:#dbeafe; color:#1d4ed8; border:1px solid #bfdbfe; font-size:11px; padding:2px 6px; font-weight:bold;">運営店</span>' : ''}
            </div>
            ${store.address ? `<div style="font-size:11px; color:#475569; margin-top:2px;"><i class="fa-solid fa-location-dot" style="color:#d97706; font-size:10px;"></i> ${this.escapeHtml(store.address)}</div>` : ''}
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
            ${store.special_date ? `<div style="font-size: 11px; color: #b91c1c; background: #fee2e2; border:1px solid #fecaca; padding: 2px 5px; border-radius: 3px; margin-top: 2px; display: inline-block; font-weight: bold;">📅 特定日: ${this.escapeHtml(store.special_date)}</div>` : ''}
            ${timeNotes ? `<div style="font-size: 11px; color: #b45309; background: #fef3c7; padding: 2px 5px; border-radius: 3px; margin-top: 2px; display: inline-block;">💡 ${this.escapeHtml(timeNotes)}</div>` : ''}
          </td>
          <td>
            <div style="font-weight: 500;">${this.escapeHtml(setNameText)}</div>
            <small style="color: #b45309; font-weight: bold;">${setPriceText}</small>
          </td>
          <td>
            <div>${this.escapeHtml(questNameText)}</div>
            <small class="text-muted">${questPriceText}</small>
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

  setStoreParticipatingFilter(val) {
    const hidden = document.getElementById('participating-filter');
    if (hidden) hidden.value = val;
    const group = document.getElementById('store-participating-segmented');
    if (group) {
      group.querySelectorAll('.segment-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.val === val);
      });
    }
    this.filterStores();
  }

  filterStores() {
    const searchElem = document.getElementById('store-search');
    const areaElem = document.getElementById('area-filter');
    const partElem = document.getElementById('participating-filter');
    const planElem = document.getElementById('plan-filter');
    const couponElem = document.getElementById('coupon-target-filter');
    const orgElem = document.getElementById('organizer-filter');

    const search = searchElem ? searchElem.value.toLowerCase().trim() : '';
    const area = areaElem ? areaElem.value : '';
    const participating = partElem ? partElem.value : '';
    const plan = planElem ? planElem.value : '';
    const couponTarget = couponElem ? couponElem.value : '';
    const organizer = orgElem ? orgElem.value : '';

    const filtered = this.stores.filter(s => {
      // 1. フリーワード検索（店舗名, ID, エリア, ジャンル, 席, セット名, セット内容, クエスト名, クエスト内容, 住所, キャッチ）
      const matchSearch = !search || 
        (s.name && s.name.toLowerCase().includes(search)) ||
        (s.id && s.id.toLowerCase().includes(search)) ||
        (s.area && s.area.toLowerCase().includes(search)) ||
        (s.category && s.category.toLowerCase().includes(search)) ||
        (s.style && s.style.toLowerCase().includes(search)) ||
        (s.set_name && s.set_name.toLowerCase().includes(search)) ||
        (s.set_content && s.set_content.toLowerCase().includes(search)) ||
        (s.quest_name && s.quest_name.toLowerCase().includes(search)) ||
        (s.quest_content && s.quest_content.toLowerCase().includes(search)) ||
        (s.address && s.address.toLowerCase().includes(search)) ||
        (s.catchphrase && s.catchphrase.toLowerCase().includes(search));
      
      // 2. エリア
      const matchArea = !area || s.area === area;

      // 3. 参加状態
      const matchPart = !participating ||
        (participating === 'true' && s.is_participating !== false) ||
        (participating === 'false' && s.is_participating === false);

      // 4. 参加プラン
      const hasSet = Boolean(s.set_name || s.set_price || (s.plan_type && s.plan_type.includes('セット')));
      const hasQuest = Boolean(s.quest_name || s.quest_price || (s.plan_type && (s.plan_type.includes('クエスト') || s.plan_type.includes('ゲーム'))));
      let matchPlan = true;
      if (plan === 'both') {
        matchPlan = (hasSet && hasQuest) || (s.plan_type && s.plan_type.includes('両方'));
      } else if (plan === 'set_only') {
        matchPlan = hasSet && !hasQuest;
      } else if (plan === 'quest_only') {
        matchPlan = hasQuest && !hasSet;
      }

      // 5. クーポン取扱
      const matchCoupon = !couponTarget || 
        (couponTarget === 'true' && Boolean(s.is_coupon_target)) ||
        (couponTarget === 'false' && !s.is_coupon_target);

      // 6. 店舗種別 (運営店)
      const isOrg = Boolean(s.is_organizer || s.isOrganizer);
      const matchOrg = !organizer ||
        (organizer === 'true' && isOrg) ||
        (organizer === 'false' && !isOrg);

      return matchSearch && matchArea && matchPart && matchPlan && matchCoupon && matchOrg;
    });

    // 詳細条件バッジ（プラン・クーポン・店舗種別のいずれかが設定されていればバッジ点灯）
    const badgeElem = document.getElementById('advanced-filter-badge');
    if (badgeElem) {
      const hasAdvanced = Boolean(plan || couponTarget || organizer);
      badgeElem.style.display = hasAdvanced ? 'inline' : 'none';
    }

    this.renderStoresTable(filtered);
  }

  toggleAdvancedFilters() {
    const drawer = document.getElementById('store-advanced-filters');
    const btn = document.getElementById('btn-toggle-advanced-filter');
    if (!drawer) return;

    const isHidden = drawer.style.display === 'none' || !drawer.style.display;
    drawer.style.display = isHidden ? 'block' : 'none';
    if (btn) {
      if (isHidden) {
        btn.classList.add('btn-primary');
        btn.classList.remove('btn-outline');
      } else {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline');
      }
    }
  }

  quickFilterStores(type) {
    // KPIピル/カードのアクティブスタイル更新
    const pillIds = [
      'kpi-pill-store-total', 'kpi-card-store-total',
      'kpi-pill-store-organizer', 'kpi-card-store-organizer',
      'kpi-pill-store-set', 'kpi-card-store-set',
      'kpi-pill-store-quest', 'kpi-card-store-quest',
      'kpi-pill-store-coupon', 'kpi-card-store-coupon'
    ];
    pillIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });

    const activePillMap = {
      'all': ['kpi-pill-store-total', 'kpi-card-store-total'],
      'organizer': ['kpi-pill-store-organizer', 'kpi-card-store-organizer'],
      'set': ['kpi-pill-store-set', 'kpi-card-store-set'],
      'quest': ['kpi-pill-store-quest', 'kpi-card-store-quest'],
      'coupon': ['kpi-pill-store-coupon', 'kpi-card-store-coupon']
    };
    if (activePillMap[type]) {
      activePillMap[type].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('active');
      });
    }

    // フィルターの各値をリセット
    const searchElem = document.getElementById('store-search');
    const areaElem = document.getElementById('area-filter');
    const planElem = document.getElementById('plan-filter');
    const couponElem = document.getElementById('coupon-target-filter');
    const orgElem = document.getElementById('organizer-filter');

    if (searchElem) searchElem.value = '';
    if (areaElem) areaElem.value = '';
    if (planElem) planElem.value = '';
    if (couponElem) couponElem.value = '';
    if (orgElem) orgElem.value = '';

    // 特定タイプのフィルターをセット
    if (type === 'organizer') {
      if (orgElem) orgElem.value = 'true';
    } else if (type === 'coupon') {
      if (couponElem) couponElem.value = 'true';
    } else if (type === 'set') {
      // セット提供店（両方 または セットのみ）
      const filtered = this.stores.filter(s => Boolean(s.set_name || s.set_price || (s.plan_type && s.plan_type.includes('セット'))));
      this.renderStoresTable(filtered);
      return;
    } else if (type === 'quest') {
      // お遊びゲーム提供店（両方 または お遊びゲームのみ）
      const filtered = this.stores.filter(s => Boolean(s.quest_name || s.quest_price || (s.plan_type && (s.plan_type.includes('クエスト') || s.plan_type.includes('ゲーム')))));
      this.renderStoresTable(filtered);
      return;
    }

    this.filterStores();
  }

  resetStoreFilters() {
    const pillIds = [
      'kpi-pill-store-total', 'kpi-card-store-total',
      'kpi-pill-store-organizer', 'kpi-card-store-organizer',
      'kpi-pill-store-set', 'kpi-card-store-set',
      'kpi-pill-store-quest', 'kpi-card-store-quest',
      'kpi-pill-store-coupon', 'kpi-card-store-coupon'
    ];
    pillIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });
    const totalPill = document.getElementById('kpi-pill-store-total') || document.getElementById('kpi-card-store-total');
    if (totalPill) totalPill.classList.add('active');

    const searchElem = document.getElementById('store-search');
    const areaElem = document.getElementById('area-filter');
    const planElem = document.getElementById('plan-filter');
    const couponElem = document.getElementById('coupon-target-filter');
    const orgElem = document.getElementById('organizer-filter');

    if (searchElem) searchElem.value = '';
    if (areaElem) areaElem.value = '';
    if (planElem) planElem.value = '';
    if (couponElem) couponElem.value = '';
    if (orgElem) orgElem.value = '';

    const badgeElem = document.getElementById('advanced-filter-badge');
    if (badgeElem) badgeElem.style.display = 'none';

    this.filterStores();
  }

  async toggleCouponTarget(storeId) {
    const store = this.stores.find(s => s.id === storeId);
    if (!store) return;

    const targetSeasonId = this.selectedSeasonId || 2;
    const newStatus = !store.is_coupon_target;
    store.is_coupon_target = newStatus;

    const existingRaw = store.raw_data || {};
    const existingSeasons = { ...(existingRaw.seasons || {}) };
    const seasonData = { ...(existingSeasons[targetSeasonId] || {}) };
    seasonData.is_coupon_target = newStatus;
    existingSeasons[targetSeasonId] = seasonData;

    const updatedRawData = {
      ...existingRaw,
      seasons: existingSeasons,
      ...(targetSeasonId === 2 ? { is_coupon_target: newStatus } : {})
    };

    try {
      const updatePayload = {
        raw_data: updatedRawData
      };
      if (targetSeasonId === 2) {
        updatePayload.is_coupon_target = newStatus;
      }
      await this.api.supabaseFetch(`stores?id=eq.${storeId}`, {
        method: 'PATCH',
        headers: {
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updatePayload)
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

    const targetSeason = this.seasons.find(s => s.id === this.selectedSeasonId);
    const seasonName = targetSeason ? targetSeason.name : '選択中イベント';

    const seasonBadge = document.getElementById('store-modal-season-badge');
    if (seasonBadge) {
      seasonBadge.textContent = `対象イベント: ${seasonName}`;
    }

    const participatingCb = document.getElementById('edit-store-participating');
    const participatingLabel = document.getElementById('label-store-participating');
    if (participatingLabel) {
      participatingLabel.textContent = `✨ この酒場を「${seasonName}」に参加させる`;
    }

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
        is_participating: true,
        area: '',
        category: '',
        style: '',
        yoidore_type: '',
        takeout: '',
        catchphrase: '',
        days: '',
        hours: '',
        special_date: '',
        payment: '',
        is_coupon_target: true,
        plan_type: '',
        badge_sales_count: ''
      };
    }

    if (participatingCb) {
      participatingCb.checked = store.is_participating !== false;
    }

    const raw = store.raw_data || {};
    const quest = store.quest || raw.quest || {};
    const yoidoreSet = store.yoidoreSet || raw.yoidoreSet || {};
    const conditions = store.conditions || raw.conditions || {};
    const numId = (store.id || '').replace(/\D/g, '').padStart(3, '0');

    document.getElementById('edit-store-id').value = store.id || '';
    document.getElementById('edit-store-name').value = store.name || '';
    document.getElementById('edit-store-address').value = store.address || raw['address'] || raw['住所'] || raw['店舗住所'] || '';

    // 1. エリア設定
    const knownAreas = ['三軒家西', '三軒家東', '駅前', '泉尾', '千島', '平尾'];
    const currentArea = store.area || raw['area'] || raw['エリア'] || '';
    const areaSelect = document.getElementById('edit-store-area-select');
    const areaCustom = document.getElementById('edit-store-area-custom');
    if (!currentArea) {
      areaSelect.value = '';
      areaCustom.style.display = 'none';
      areaCustom.value = '';
    } else if (knownAreas.includes(currentArea)) {
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
    const currentCat = store.category || raw['category'] || raw['カテゴリ'] || '';
    const catSelect = document.getElementById('edit-store-category-select');
    const catCustom = document.getElementById('edit-store-category-custom');
    if (!currentCat) {
      catSelect.value = '';
      if (catCustom) {
        catCustom.style.display = 'none';
        catCustom.value = '';
      }
    } else if (knownCategories.includes(currentCat)) {
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
    const currentStyle = store.style || raw['style'] || raw['スタイル'] || '';
    const normalizedStyle = currentStyle === '立ち呑み' ? '立ち飲み' : currentStyle;
    const styleSelect = document.getElementById('edit-store-style');
    const styleCustom = document.getElementById('edit-store-style-custom');
    if (!normalizedStyle) {
      styleSelect.value = '';
      if (styleCustom) {
        styleCustom.style.display = 'none';
        styleCustom.value = '';
      }
    } else if (knownStyles.includes(normalizedStyle)) {
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
    const currentPlan = store.plan_type || (store.quest_name && store.set_name ? '「酔いどれセット」・「お遊びゲーム」両方で参加' : (store.quest_name ? '「お遊びゲーム」のみで参加' : (store.set_name ? '「酔いどれセット」のみで参加' : '')));
    const planSelect = document.getElementById('edit-store-plan-type');
    if (planSelect) {
      if (currentPlan.includes('両方') || currentPlan === '両方') {
        planSelect.value = '「酔いどれセット」・「お遊びゲーム」両方で参加';
      } else if (currentPlan.includes('クエスト') || currentPlan.includes('ゲーム')) {
        planSelect.value = '「お遊びゲーム」のみで参加';
      } else if (currentPlan.includes('セット')) {
        planSelect.value = '「酔いどれセット」のみで参加';
      } else {
        planSelect.value = '';
      }
    }

    // 4. 酔いどれタイプ設定
    const currentType = store.yoidore_type || store.type || '';
    const normalizedType = currentType === 'サク呑み' ? 'サク飲み' : currentType;
    document.getElementById('edit-store-type').value = 
      ['サク飲み', '腹ごしらえ', 'ひと休み', '昼飲み', '夜遊び'].includes(normalizedType) ? normalizedType : '';

    // 5. テイクアウト設定
    let takeoutVal = '';
    const rawTakeout = store.takeout;
    if (rawTakeout === 'テイクアウト専門' || rawTakeout === '専門') {
      takeoutVal = 'テイクアウト専門';
    } else if (rawTakeout === true || rawTakeout === 'テイクアウトOK' || rawTakeout === '可能' || rawTakeout === '可' || rawTakeout === 'OK') {
      takeoutVal = 'テイクアウトOK';
    } else if (rawTakeout === false || rawTakeout === 'テイクアウト不可' || rawTakeout === '不可' || rawTakeout === 'なし') {
      takeoutVal = 'テイクアウト不可';
    }
    document.getElementById('edit-store-takeout').value = takeoutVal;

    document.getElementById('edit-store-catchphrase').value = store.catchphrase || '';

    // 6. 提供日/営業日チェックボックス設定
    const currentDays = String(store.days || '');
    const dayCbs = document.querySelectorAll('input[name="store-days-check"]');
    dayCbs.forEach(cb => {
      cb.checked = currentDays ? currentDays.includes(cb.value) : false;
    });

    // 特定日設定
    const rawSpecialDate = String(store.special_date || raw.special_date || raw.seasons?.[this.selectedSeasonId]?.special_date || '').trim();
    const specialDateInput = document.getElementById('edit-store-special-date');
    if (specialDateInput) {
      specialDateInput.value = rawSpecialDate;
    }

    // 7. 提供時間/営業時間設定
    let currentHours = String(store.hours || '').trim();
    // 1899年等の破損Date文字列（Sat Dec 30 1899 等）を事前クレンジング
    currentHours = currentHours.replace(/[A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{1,2}\s+1899\s*/gi, '').trim();

    // 通常形式: 17:00〜22:00, 21:00〜翌03:00 等
    let timeMatch = currentHours ? currentHours.match(/(?:^|[^\d])(\d{1,2}:\d{2})\s*[-〜~]\s*(?:翌)?(\d{1,2}:\d{2})/) : null;

    if (timeMatch) {
      const startH = timeMatch[1].padStart(5, '0');
      const endH = timeMatch[2].padStart(5, '0');
      document.getElementById('edit-store-hours-start').value = startH;
      document.getElementById('edit-store-hours-end').value = endH;
      // 翌日判定: 「翌」が含まれるか、終了時刻が開始時刻以下（例: 21:00〜03:00, 12:00〜00:00）の場合に自動チェック
      const isNextDay = currentHours.includes('翌') || (endH <= startH);
      document.getElementById('edit-store-hours-nextday').checked = isNextDay;
      
      let cleaned = currentHours
        .replace(timeMatch[0], '')
        .replace(/翌/, '')
        .replace(/^[()（）\s]+|[()（）\s]+$/g, '')
        .trim();
      document.getElementById('edit-store-hours-custom').value = cleaned;
    } else {
      document.getElementById('edit-store-hours-start').value = '';
      document.getElementById('edit-store-hours-end').value = '';
      document.getElementById('edit-store-hours-nextday').checked = false;
      document.getElementById('edit-store-hours-custom').value = currentHours;
    }

    // 提供時間に対する補足
    document.getElementById('edit-store-time-notes').value = store.time_notes || '';

    // 8. 決済方法チェックボックス設定（未設定なら勝手に現金チェックを入れない）
    const currentPayments = Array.isArray(store.paymentMethods) ? store.paymentMethods : 
      (store.payment ? String(store.payment).split(/[,、]/).map(p => p.trim()) : []);
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

    document.getElementById('edit-store-set-name').value = store.set_name || '';
    document.getElementById('edit-store-set-price').value = (store.set_price !== undefined && store.set_price !== null && store.set_price !== '') ? store.set_price : '';
    document.getElementById('edit-store-set-content').value = store.set_content || '';
    document.getElementById('edit-store-set-charge').value = store.set_charge || '';
    document.getElementById('edit-store-set-limit').value = store.set_limit || '';
    document.getElementById('edit-store-set-notes').value = store.set_notes || '';

    document.getElementById('edit-store-quest-name').value = store.quest_name || '';
    document.getElementById('edit-store-quest-price').value = (store.quest_price !== undefined && store.quest_price !== null && store.quest_price !== '') ? store.quest_price : '';
    document.getElementById('edit-store-quest-content').value = store.quest_content || '';
    document.getElementById('edit-store-quest-charge').value = store.quest_charge || '';
    document.getElementById('edit-store-quest-notes').value = store.quest_notes || '';

    const rawMapUrl = String(store.map_url || store.googleMapUrl || '').trim();
    document.getElementById('edit-store-map-url').value = (!/^https?:\/\//i.test(rawMapUrl) || rawMapUrl.includes('google.com/maps/search')) ? '' : rawMapUrl;
    const rawInstaUrl = String(store.insta_url || store.instagramUrl || '').trim();
    document.getElementById('edit-store-insta-url').value = /^https?:\/\//i.test(rawInstaUrl) ? rawInstaUrl : '';
    document.getElementById('edit-store-photo-url').value = store.photo_url || store.photoUrl || (numId ? `photo/${numId}.jpg` : '');
    document.getElementById('edit-store-badge-sales').value = store.badge_sales_count || '';
    document.getElementById('edit-store-coupon-target').checked = Boolean(store.is_coupon_target);
    const organizerCb = document.getElementById('edit-store-organizer');
    if (organizerCb) {
      organizerCb.checked = Boolean(store.is_organizer || store.isOrganizer);
    }

    this.updateMediaPreview();
    document.body.style.overflow = 'hidden';
    document.getElementById('store-modal').style.display = 'flex';
  }

  updateMediaPreview() {
    const photoVal = (document.getElementById('edit-store-photo-url').value || '').trim();
    const mapVal = (document.getElementById('edit-store-map-url').value || '').trim();
    const instaVal = (document.getElementById('edit-store-insta-url').value || '').trim();
    const nameVal = (document.getElementById('edit-store-name').value || '').trim();
    const addressVal = (document.getElementById('edit-store-address').value || '').trim();

    // 住所からGoogleマップ確認ボタン
    const addressMapBtn = document.getElementById('btn-check-address-map');
    if (addressMapBtn) {
      if (addressVal) {
        const query = encodeURIComponent(addressVal);
        addressMapBtn.href = `https://www.google.com/maps/search/?api=1&query=${query}`;
        addressMapBtn.style.display = 'inline-flex';
      } else {
        addressMapBtn.style.display = 'none';
      }
    }

    // 地図URLテストリンク
    const mapBtn = document.getElementById('btn-check-map');
    if (mapBtn) {
      if (mapVal && /^https?:\/\//i.test(mapVal) && !mapVal.includes('google.com/maps/search')) {
        mapBtn.href = mapVal;
        mapBtn.style.display = 'inline-flex';
      } else {
        mapBtn.style.display = 'none';
      }
    }

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

    const targetSeasonId = this.selectedSeasonId || 2;
    const isParticipating = document.getElementById('edit-store-participating') ? document.getElementById('edit-store-participating').checked : true;

    // 1. エリア取得
    const areaSelect = document.getElementById('edit-store-area-select').value;
    const area = areaSelect === 'custom' ? document.getElementById('edit-store-area-custom').value.trim() : areaSelect;

    // 2. ジャンル/カテゴリ取得
    const catSelect = document.getElementById('edit-store-category-select').value;
    const category = catSelect === 'custom' ? document.getElementById('edit-store-category-custom').value.trim() : catSelect;

    // 3. 席スタイル取得
    const styleSelect = document.getElementById('edit-store-style').value;
    const style = styleSelect === 'custom' ? document.getElementById('edit-store-style-custom').value.trim() : styleSelect;

    // 3.5 参加企画取得
    const planType = document.getElementById('edit-store-plan-type').value;

    // 4. 酔いどれタイプ取得
    const yoidore_type = document.getElementById('edit-store-type').value;

    // 5. テイクアウト取得
    const takeout = document.getElementById('edit-store-takeout').value;

    // 6. 営業日取得（未選択なら空文字。勝手に全日営業にしない）
    const selectedDays = [];
    document.querySelectorAll('input[name="store-days-check"]:checked').forEach(cb => {
      selectedDays.push(cb.value);
    });
    const days = selectedDays.join(',');

    // 7. 営業時間取得（未入力なら空文字。勝手に17:00〜23:00にしない）
    const hStart = document.getElementById('edit-store-hours-start').value;
    const hEnd = document.getElementById('edit-store-hours-end').value;
    const isNextDay = document.getElementById('edit-store-hours-nextday').checked;
    const effectiveNextDay = isNextDay || (hStart && hEnd && hEnd <= hStart);
    const hCustom = document.getElementById('edit-store-hours-custom').value.trim();
    let hours = '';
    if (hStart && hEnd) {
      hours = `${hStart}〜${effectiveNextDay ? '翌' : ''}${hEnd}`;
    } else if (hStart) {
      hours = `${hStart}〜`;
    } else if (hEnd) {
      hours = `〜${effectiveNextDay ? '翌' : ''}${hEnd}`;
    }
    if (hCustom) {
      hours = hours ? `${hours} (${hCustom})` : hCustom;
    }

    // 8. 決済方法取得（未選択なら空文字。勝手に現金にしない）
    const selectedPayments = [];
    document.querySelectorAll('input[name="store-payment-check"]:checked').forEach(cb => {
      selectedPayments.push(cb.value);
    });
    const pOther = document.getElementById('edit-store-payment-other').value.trim();
    if (pOther) {
      selectedPayments.push(pOther);
    }
    const payment = selectedPayments.join(', ');

    const name = document.getElementById('edit-store-name').value.trim();
    if (!name) return alert('店舗名を入力してください');

    const address = document.getElementById('edit-store-address').value.trim();
    const catchphrase = document.getElementById('edit-store-catchphrase').value.trim();
    const timeNotes = document.getElementById('edit-store-time-notes').value.trim();
    let setName = document.getElementById('edit-store-set-name').value.trim();
    let setPrice = document.getElementById('edit-store-set-price').value.trim();
    let setContent = document.getElementById('edit-store-set-content').value.trim();
    let setCharge = document.getElementById('edit-store-set-charge').value.trim();
    let setLimit = document.getElementById('edit-store-set-limit').value.trim();
    let setNotes = document.getElementById('edit-store-set-notes').value.trim();
    let questName = document.getElementById('edit-store-quest-name').value.trim();
    let questPrice = document.getElementById('edit-store-quest-price').value.trim();
    let questContent = document.getElementById('edit-store-quest-content').value.trim();
    let questCharge = document.getElementById('edit-store-quest-charge').value.trim();
    let questNotes = document.getElementById('edit-store-quest-notes').value.trim();

    // 選択された参加企画に合わせて不要な側のデータをクリーンアップ（データの不整合を防止）
    if (planType.includes('クエスト」のみ') || planType.includes('ゲーム」のみ') || planType.includes('お遊びゲーム')) {
      setName = ''; setPrice = ''; setContent = ''; setCharge = ''; setLimit = ''; setNotes = '';
    } else if (planType.includes('セット」のみ')) {
      questName = ''; questPrice = ''; questContent = ''; questCharge = ''; questNotes = '';
    }
    const badgeSalesCount = document.getElementById('edit-store-badge-sales').value.trim();
    const specialDate = (document.getElementById('edit-store-special-date')?.value || '').trim();
    let mapUrl = document.getElementById('edit-store-map-url').value.trim();
    if (!/^https?:\/\//i.test(mapUrl) || mapUrl.includes('google.com/maps/search')) {
      mapUrl = '';
    }
    let instaUrl = document.getElementById('edit-store-insta-url').value.trim();
    if (instaUrl && !/^https?:\/\//i.test(instaUrl)) {
      instaUrl = '';
    }
    const photoUrl = document.getElementById('edit-store-photo-url').value.trim();
    const isCouponTarget = document.getElementById('edit-store-coupon-target').checked;
    const isOrganizer = document.getElementById('edit-store-organizer') ? document.getElementById('edit-store-organizer').checked : false;
    const displayOrder = parseInt(storeId.replace(/\D/g, ''), 10) || 0;

    // 既存店舗のraw_dataおよび全シーズン企画データを取得・保護
    const existingStore = this.stores.find(s => s.id === storeId);
    const existingRaw = existingStore?.raw_data || {};
    const existingSeasons = { ...(existingRaw.seasons || {}) };

    // 選択中シーズンの企画データを更新
    existingSeasons[targetSeasonId] = {
      is_participating: isParticipating,
      is_coupon_target: isCouponTarget,
      is_organizer: isOrganizer,
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
      days: days,
      hours: hours,
      time_notes: timeNotes,
      special_date: specialDate,
      takeout: takeout
    };

    const rawData = {
      ...existingRaw,
      id: storeId,
      name: name,
      address: address,
      area: area,
      category: category,
      style: style,
      type: yoidore_type,
      takeout: takeout,
      catchphrase: catchphrase,
      payment: payment,
      map_url: mapUrl,
      insta_url: instaUrl,
      photo_url: photoUrl,
      // 2層分離: シーズン別企画データ
      seasons: existingSeasons,
      // 互換用（第2回時はトップレベルにも反映）
      ...(targetSeasonId === 2 ? {
        days,
        hours,
        time_notes: timeNotes,
        special_date: specialDate,
        is_coupon_target: isCouponTarget,
        is_organizer: isOrganizer,
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
        badge_sales_count: badgeSalesCount
      } : {})
    };

    const storePayload = {
      id: storeId,
      name: name,
      area: area,
      ...(targetSeasonId === 2 ? { is_coupon_target: isCouponTarget } : {}),
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
      this.showToast(`🎉 酒場「${name}」の企画データをSupabaseに保存しました！`);
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
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
      const firstSheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      if (rows.length < 2) {
        alert('データ行が見つかりませんでした。有効なアンケート回答ファイルを選択してください。');
        return;
      }

      const targetSeasonId = this.selectedSeasonId || 2;

      const headers = rows[0].map(h => String(h || '').trim());
      const dataRows = rows.slice(1);

      // 店舗名正規化関数（マッチング用）
      const normalizeStoreName = (name) => {
        if (!name) return '';
        let n = String(name).normalize('NFKC').toLowerCase();
        return n.replace(/[\s!！?？~〜\-_・·'"()（）「」『』\[\]/／\\]+/g, '');
      };

      // 2枚目のシート（「シート1」など店舗マスタ辞書）が存在する場合はマスタマップを作成
      const masterMap = new Map();
      if (wb.SheetNames.length > 1) {
        const secondSheetName = wb.SheetNames[1];
        const secondSheet = wb.Sheets[secondSheetName];
        const masterRows = XLSX.utils.sheet_to_json(secondSheet, { header: 1, defval: '' });
        if (masterRows.length > 1) {
          for (let i = 1; i < masterRows.length; i++) {
            const mRow = masterRows[i];
            const mId = mRow[0] !== undefined ? String(mRow[0]).trim() : '';
            const mName = mRow[1] !== undefined ? String(mRow[1]).trim() : '';
            const mCatch = mRow[2] !== undefined ? String(mRow[2]).trim() : '';
            const mInsta = mRow[3] !== undefined ? String(mRow[3]).trim() : '';
            const mAddr = mRow[4] !== undefined ? String(mRow[4]).trim() : '';
            const mMap = mRow[5] !== undefined ? String(mRow[5]).trim() : '';
            if (mName) {
              const normKey = normalizeStoreName(mName);
              masterMap.set(normKey, {
                id: mId,
                name: mName,
                catchphrase: mCatch,
                insta_url: mInsta,
                address: mAddr,
                map_url: mMap
              });
            }
          }
        }
      }

      const findMasterInfo = (excelName) => {
        const normExcel = normalizeStoreName(excelName);
        if (!normExcel) return null;
        if (masterMap.has(normExcel)) return masterMap.get(normExcel);
        for (const [key, val] of masterMap.entries()) {
          if (key.includes(normExcel) || normExcel.includes(key)) {
            return val;
          }
        }
        return null;
      };

      // 既存店舗一覧から名前マッチング用ロジックを作成
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

        const participateAns = String(row[2] || rowObj['大正酔いどれクエストに参加されますか？'] || rowObj['大正酔いどれクエストⅡに参加されますか？'] || '').trim();
        const isSkip = (participateAns === '参加しない' || storeName.includes('テスト'));

        // マスタ辞書（シート1）からの補完情報
        const masterInfo = findMasterInfo(storeName);

        // 既存店舗検索（正規化＆部分一致）
        const existing = findExistingStore(storeName);

        // Col 38〜42（AM〜AQ）: ID, キャッチコピー, Instagram, 住所, googlemap
        const rawExcelId = String(row[38] !== undefined && row[38] !== '' ? row[38] : (rowObj['ID'] || masterInfo?.id || '')).trim();
        let storeNum = null;
        if (rawExcelId) {
          const parsed = parseInt(rawExcelId.replace(/\D/g, ''), 10);
          if (!isNaN(parsed)) storeNum = parsed;
        }

        let storeId = '';
        if (storeNum !== null) {
          storeId = `store-${String(storeNum).padStart(2, '0')}`;
        } else if (existing) {
          storeId = existing.id;
          const exNum = parseInt(existing.id.replace(/\D/g, ''), 10);
          if (!isNaN(exNum)) storeNum = exNum;
        } else {
          storeNum = newCounter++;
          storeId = `store-${String(storeNum).padStart(2, '0')}`;
        }

        // 店舗名はExcel記載の店名を最優先
        const finalStoreName = storeName || (existing ? existing.name : (masterInfo?.name || ''));

        // 1. エリア（Excel記載の生文字列をそのまま尊重）
        const area = String(row[3] !== undefined && row[3] !== '' ? row[3] : (rowObj['エリア'] || rowObj['  エリア  '] || '')).trim();

        // 2. カテゴリ（Excel記載の生文字列をそのまま尊重）
        const category = String(row[4] !== undefined && row[4] !== '' ? row[4] : (rowObj['カテゴリ'] || '')).trim();

        // 時刻フォーマット変換（Dateオブジェクト、シリアル値、文字列すべてに対応するハイブリッド仕様）
        const formatExcelTime = (val) => {
          if (val === null || val === undefined || val === '') return '';
          // 1. Date オブジェクト（SheetJS cellDates: true の場合）
          if (val instanceof Date) {
            if (isNaN(val.getTime())) return '';
            const hours = String(val.getHours()).padStart(2, '0');
            const mins = String(val.getMinutes()).padStart(2, '0');
            return `${hours}:${mins}`;
          }
          // 2. 数値シリアル値（cellDates: false や小数値の場合）
          const num = typeof val === 'number' ? val : (typeof val === 'string' && !val.includes(':') && !isNaN(parseFloat(val)) ? parseFloat(val) : NaN);
          if (!isNaN(num) && num >= 0) {
            const frac = num >= 1 ? (num - Math.floor(num)) : num;
            const totalMinutes = Math.round(frac * 24 * 60);
            const hours = Math.floor(totalMinutes / 60) % 24;
            const mins = totalMinutes % 60;
            return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
          }
          // 3. 文字列（"17:00"、破損文字列 "Sat Dec 30 1899 17:00:00" 等の救済）
          const str = String(val).trim();
          const timeMatch = str.match(/(?:^|\s|[A-Za-z])(\d{1,2}):(\d{2})(?::\d{2})?/);
          if (timeMatch) {
            return `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
          }
          return str;
        };

        // 3. スタイル (Excel記載の生文字列をそのまま尊重。明らかな誤字のみ最小限補正)
        let style = String(row[5] !== undefined && row[5] !== '' ? row[5] : (rowObj['スタイル'] || '')).trim();
        if (style === 'テールブあり' || style === 'テールブ') style = 'テーブルあり';

        // 4. タイプ (Excel記載の生文字列をそのまま尊重)
        let yoidore_type = String(row[6] !== undefined && row[6] !== '' ? row[6] : (rowObj['タイプ'] || '')).trim();

        // 5. テイクアウト（Excel記載の生文字列をそのまま尊重）
        let takeout = String(row[7] !== undefined && row[7] !== '' ? row[7] : (rowObj['テイクアウト'] || '')).trim();

        // 6. 提供曜日 (Excel記載の生文字列を尊重。曜日抽出ができる場合はカンマ区切りに正規化)
        const rawDays = String(row[8] !== undefined && row[8] !== '' ? row[8] : (rowObj['提供曜日'] || rowObj['どれクエ対応曜日'] || '')).trim();
        let days = '';
        if (rawDays) {
          if (rawDays.includes('全て') || rawDays.includes('全日') || rawDays.includes('毎日')) {
            days = '月,火,水,木,金,土,日';
          } else {
            const daysList = [];
            ['月', '火', '水', '木', '金', '土', '日', '祝'].forEach(d => {
              if (d === '日') {
                if (/日曜日|日曜|(?:^|[,、\s])日(?:[,、\s]|$)/.test(rawDays)) daysList.push('日');
              } else {
                if (rawDays.includes(d)) daysList.push(d);
              }
            });
            days = daysList.length > 0 ? daysList.join(',') : rawDays;
          }
        }

        // 7. 提供時間 & 提供時間に対する補足（Excelの入力通りに構築）
        const rawHStart = row[9] !== undefined && row[9] !== '' ? row[9] : (rowObj['提供時間：開始'] || rowObj['どれクエ対応時間：開始']);
        const rawHEnd = row[10] !== undefined && row[10] !== '' ? row[10] : (rowObj['提供時間：終了'] || rowObj['どれクエ対応時間：終了']);
        const hStart = formatExcelTime(rawHStart);
        const hEnd = formatExcelTime(rawHEnd);
        let hours = '';
        if (hStart && hEnd) {
          const isOvernight = hEnd < hStart;
          hours = `${hStart}〜${isOvernight ? '翌' : ''}${hEnd}`;
        } else if (hStart) {
          hours = `${hStart}〜`;
        } else if (hEnd) {
          hours = `〜${hEnd}`;
        }

        const rawTimeNote = String(row[11] !== undefined && row[11] !== '' ? row[11] : (rowObj['提供時間に対する補足'] || '')).trim();
        const cleanTimeNote = (rawTimeNote && rawTimeNote !== 'None') ? rawTimeNote : '';

        // 8. 決済方法（Excel記載の生文字列をそのまま尊重）
        const payment = String(row[12] !== undefined && row[12] !== '' ? row[12] : (rowObj['決済方法'] || '')).trim();

        // 9. クーポン取扱
        const couponAns = String(row[13] !== undefined && row[13] !== '' ? row[13] : (rowObj['店舗クーポンを希望されますか？'] || '')).trim();
        const isCouponTarget = couponAns.includes('希望します') || couponAns.includes('はい') || couponAns === 'true';

        // 10. 参加企画とセット・クエストの抽出（Excelの回答企画に基づき完全分離）
        const planTypeRaw = String(row[14] !== undefined && row[14] !== '' ? row[14] : (rowObj['「どれクエ」にはどの企画で参加されますか？'] || rowObj['「どれクエⅡ」にはどの企画で参加されますか？'] || rowObj['  「どれクエ」にはどの企画で参加されますか？  '] || rowObj['  「どれクエⅡ」にはどの企画で参加されますか？  '] || '')).trim();
        
        // セルの文字列をそのまま（改変・数字丸め等を行わずに）取得するヘルパー
        const cleanCellText = (val) => {
          if (val === null || val === undefined) return '';
          if (typeof val === 'number') {
            return Number.isInteger(val) ? String(val) : String(val);
          }
          const s = String(val).trim();
          return s === 'None' ? '' : s;
        };

        // 日付セル（Date型、YYYY-MM-DD/YYYY/MM/DD、Excelシリアル値）を 'YYYY-MM-DD' に正規化するヘルパー
        const normalizeSpecialDate = (val) => {
          if (val === null || val === undefined || val === '') return '';
          if (val instanceof Date) {
            if (isNaN(val.getTime())) return '';
            const y = val.getFullYear();
            const m = String(val.getMonth() + 1).padStart(2, '0');
            const d = String(val.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
          }
          const s = String(val).trim();
          if (!s || s === '0' || s === 'None' || s === 'null' || s === 'undefined') return '';
          const match = s.match(/^(\d{4})[./\-\u5E74](\d{1,2})[./\-\u6708](\d{1,2})\u65E5?$/);
          if (match) {
            return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
          }
          const num = Number(s);
          if (!isNaN(num) && num > 40000 && num < 60000) {
            const date = new Date(Math.round((num - 25569) * 86400 * 1000));
            const y = date.getUTCFullYear();
            const m = String(date.getUTCMonth() + 1).padStart(2, '0');
            const d = String(date.getUTCDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
          }
          return s;
        };

        let planType = planTypeRaw;
        let setName = '', setContent = '', setNotes = '', setPrice = '', setCharge = '', setLimit = '';
        let questName = '', questContent = '', questNotes = '', questPrice = '', questCharge = '';

        const isSetOnly = planType.includes('セット」のみ');
        const isQuestOnly = planType.includes('クエスト」のみ') || planType.includes('ゲーム」のみ') || planType.includes('お遊びゲーム');

        if (isSetOnly) {
          // 「セットのみ」の場合はExcelのセット情報列（Col 15〜20）からそのまま抽出
          setName = cleanCellText(row[15] !== undefined && row[15] !== '' ? row[15] : (rowObj['  酔いどれセット名  '] || rowObj['酔いどれセット名']));
          setContent = cleanCellText(row[16] !== undefined && row[16] !== '' ? row[16] : (rowObj['  酔いどれセット内容  '] || rowObj['酔いどれセット内容']));
          setNotes = cleanCellText(row[17] !== undefined && row[17] !== '' ? row[17] : rowObj['セット内容備考']);
          setPrice = cleanCellText(row[18] !== undefined && row[18] !== '' ? row[18] : (rowObj['  価格(税込)  '] || rowObj['価格(税込)']));
          setCharge = cleanCellText(row[19] !== undefined && row[19] !== '' ? row[19] : rowObj['チャージ料(税込)']);
          setLimit = cleanCellText(row[20] !== undefined && row[20] !== '' ? row[20] : rowObj['限定数量']);
          // クエスト（お遊びゲーム）情報は完全に空
          questName = ''; questContent = ''; questNotes = ''; questPrice = ''; questCharge = '';
        } else if (isQuestOnly) {
          // 「クエストのみ / お遊びゲームのみ」の場合はセット情報を完全クリアし、クエスト情報列（Col 21〜25）からそのまま抽出（クエスト名/お遊びゲーム名両対応）
          setName = ''; setContent = ''; setNotes = ''; setPrice = ''; setCharge = ''; setLimit = '';
          questName = cleanCellText(row[21] !== undefined && row[21] !== '' ? row[21] : (rowObj['お遊びゲーム名'] || rowObj['クエスト名']));
          questContent = cleanCellText(row[22] !== undefined && row[22] !== '' ? row[22] : (rowObj['お遊びゲーム内容/報酬'] || rowObj['クエスト内容/報酬'] || rowObj['お遊びゲーム内容'] || rowObj['クエスト内容']));
          questPrice = cleanCellText(row[23] !== undefined && row[23] !== '' ? row[23] : (rowObj['お遊びゲーム料金(税込)'] || rowObj['クエスト料金(税込)'] || rowObj['お遊びゲーム料金'] || rowObj['クエスト料金']));
          questCharge = cleanCellText(row[24] !== undefined && row[24] !== '' ? row[24] : (rowObj['お遊びゲームチャージ料 (税込)'] || rowObj['クエストチャージ料 (税込)'] || rowObj['お遊びゲームチャージ料'] || rowObj['クエストチャージ料']));
          questNotes = cleanCellText(row[25] !== undefined && row[25] !== '' ? row[25] : (rowObj['お遊びゲーム備考'] || rowObj['クエスト備考'] || rowObj['お遊びゲーム注意事項・備考']));
        } else {
          // 「両方」または個別回答の場合はExcelの両方対応列（Col 26〜36）または単独列からそのまま抽出
          setName = cleanCellText(row[26] !== undefined && row[26] !== '' ? row[26] : (rowObj['酔いどれセット名'] || row[15]));
          setContent = cleanCellText(row[27] !== undefined && row[27] !== '' ? row[27] : (rowObj['  酔いどれセット内容   2'] || row[16]));
          setNotes = cleanCellText(row[28] !== undefined && row[28] !== '' ? row[28] : (rowObj['セット内容備考 2'] || row[17]));
          setPrice = cleanCellText(row[29] !== undefined && row[29] !== '' ? row[29] : (rowObj['価格(税込)'] || row[18]));
          setCharge = cleanCellText(row[30] !== undefined && row[30] !== '' ? row[30] : (rowObj['チャージ料(税込) 2'] || row[19]));
          setLimit = cleanCellText(row[31] !== undefined && row[31] !== '' ? row[31] : (rowObj['限定数量 2'] || row[20]));

          questName = cleanCellText(row[32] !== undefined && row[32] !== '' ? row[32] : (rowObj['お遊びゲーム名 2'] || rowObj['クエスト名 2'] || rowObj['お遊びゲーム名'] || row[21]));
          questContent = cleanCellText(row[33] !== undefined && row[33] !== '' ? row[33] : (rowObj['お遊びゲーム内容/報酬 2'] || rowObj['クエスト内容/報酬 2'] || rowObj['お遊びゲーム内容/報酬'] || row[22]));
          questPrice = cleanCellText(row[34] !== undefined && row[34] !== '' ? row[34] : (rowObj['お遊びゲーム料金(税込) 2'] || rowObj['クエスト料金(税込) 2'] || rowObj['お遊びゲーム料金(税込)'] || row[23]));
          questCharge = cleanCellText(row[35] !== undefined && row[35] !== '' ? row[35] : (rowObj['お遊びゲームチャージ料 (税込) 2'] || rowObj['クエストチャージ料 (税込) 2'] || rowObj['お遊びゲームチャージ料 (税込)'] || row[24]));
          questNotes = cleanCellText(row[36] !== undefined && row[36] !== '' ? row[36] : (rowObj['お遊びゲーム備考 2'] || rowObj['クエスト備考 2'] || rowObj['お遊びゲーム備考'] || row[25]));

          if (!planType) {
            if (setName && questName) planType = '「酔いどれセット」・「お遊びゲーム」両方で参加';
            else if (setName) planType = '「酔いどれセット」のみで参加';
            else if (questName) planType = '「お遊びゲーム」のみで参加';
          }
        }

        // 11. 参加証(缶バッチ)販売希望数
        const badgeSalesRaw = cleanCellText(row[37] !== undefined && row[37] !== '' ? row[37] : (rowObj['お客様向け参加証(缶バッチ)\u3000販売希望数は？'] || rowObj['お客様向け参加証(缶バッチ) 販売希望数は？']));

        // 12. 追加マスタ情報（キャッチコピー, Instagram, 住所, GoogleマップURL）
        const catchphrase = cleanCellText(row[39] !== undefined && row[39] !== '' ? row[39] : (rowObj['キャッチコピー'] || masterInfo?.catchphrase || existing?.catchphrase || existing?.raw_data?.catchphrase || ''));
        let insta_url = cleanCellText(row[40] !== undefined && row[40] !== '' ? row[40] : (rowObj['Instagram'] || masterInfo?.insta_url || existing?.insta_url || existing?.raw_data?.insta_url || ''));
        if (insta_url && !/^https?:\/\//i.test(insta_url)) {
          insta_url = '';
        }
        const address = cleanCellText(row[41] !== undefined && row[41] !== '' ? row[41] : (rowObj['住所'] || rowObj['店舗住所'] || masterInfo?.address || existing?.address || existing?.raw_data?.address || ''));
        let map_url = cleanCellText(row[42] !== undefined && row[42] !== '' ? row[42] : (rowObj['googlemap'] || masterInfo?.map_url || existing?.map_url || existing?.raw_data?.map_url || ''));
        if (!/^https?:\/\//i.test(map_url) || map_url.includes('google.com/maps/search')) {
          map_url = '';
        }

        // 13. 特定日（Col 43 / AR列 / rowObj['特定日']）
        const special_date = normalizeSpecialDate(row[43] !== undefined && row[43] !== '' ? row[43] : (rowObj['特定日'] || ''));

        const numStr3 = storeNum !== null ? String(storeNum).padStart(3, '0') : '';
        const photo_url = (numStr3 ? `photo/${numStr3}.jpg` : (existing?.photo_url || existing?.raw_data?.photo || ''));

        const item = {
          id: storeId,
          name: finalStoreName,
          display_order: storeNum || (newCounter),
          isExisting: Boolean(existing),
          isSkip,
          area,
          address,
          category,
          style,
          yoidore_type,
          takeout,
          catchphrase,
          days,
          hours,
          time_notes: cleanTimeNote,
          special_date,
          payment,
          is_coupon_target: isCouponTarget,
          planType,
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
          badge_sales_count: badgeSalesRaw,
          map_url,
          insta_url,
          photo_url
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

      const timeDisplay = `${item.special_date ? `<span class="badge" style="background:#fee2e2; color:#b91c1c; font-size:10px; margin-bottom:2px; display:inline-block;"><i class="fa-regular fa-calendar"></i> 特定日: ${item.special_date}</span><br>` : ''}${item.hours || '-'}${item.time_notes ? `<br><small style="color:#d97706;">💡 ${item.time_notes}</small>` : ''}`;

      return `
        <tr style="${item.isSkip ? 'opacity: 0.5; background: #f8fafc;' : ''}">
          <td>${statusBadge}</td>
          <td><code>${item.id}</code></td>
          <td><strong>${item.name}</strong></td>
          <td><span class="badge badge-area">${item.area}</span> <span class="badge">${item.category}</span></td>
          <td><small>${timeDisplay}</small></td>
          <td><small style="color:#64748b;">${item.planType.includes('両方') ? '両方' : (item.planType.includes('セット') ? 'セットのみ' : 'お遊びゲームのみ')}</small></td>
          <td>${item.set_name ? `${item.set_name} (${this.formatPrice(item.set_price)})` : '-'}</td>
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

    const targetSeasonId = this.selectedSeasonId || 2;
    const targetSeason = this.seasons.find(s => s.id === targetSeasonId);
    const seasonName = targetSeason ? targetSeason.name : '選択中イベント';
    const confirmMsg = `合計 ${validItems.length} 件の店舗データを「${seasonName}」の企画データとしてSupabaseに反映（店舗マスタ更新＋シーズン参加登録）します。よろしいですか？`;
    if (!confirm(confirmMsg)) return;

    try {
      this.showToast(`Supabaseへ一括保存中 (0 / ${validItems.length})...`);
      let successCount = 0;

      for (let i = 0; i < validItems.length; i++) {
        const item = validItems[i];
        const displayOrder = item.display_order || parseInt(String(item.id).replace(/\D/g, ''), 10) || (i + 1);

        const existingStore = this.stores.find(s => s.id === item.id);
        const existingRaw = existingStore?.raw_data || {};
        const existingSeasons = { ...(existingRaw.seasons || {}) };

        // 該当シーズンの企画データを作成（勝手な固定値フォールバックを撤廃し、itemの値をそのまま正確に保存）
        existingSeasons[targetSeasonId] = {
          is_participating: true,
          is_coupon_target: Boolean(item.is_coupon_target),
          plan_type: item.planType || '',
          set_name: item.set_name || '',
          set_content: item.set_content || '',
          set_price: item.set_price || '',
          set_charge: item.set_charge || '',
          set_limit: item.set_limit || '',
          set_notes: item.set_notes || '',
          quest_name: item.quest_name || '',
          quest_content: item.quest_content || '',
          quest_price: (item.quest_price !== undefined && item.quest_price !== null && item.quest_price !== '') ? item.quest_price : '',
          quest_charge: item.quest_charge || '',
          quest_notes: item.quest_notes || '',
          badge_sales_count: item.badge_sales_count || '',
          days: item.days || '',
          hours: item.hours || '',
          time_notes: item.time_notes || '',
          special_date: item.special_date || '',
          takeout: item.takeout || ''
        };

        const rawData = {
          ...existingRaw,
          id: item.id,
          name: item.name,
          area: item.area || '',
          address: item.address || '',
          category: item.category || '',
          style: item.style || '',
          type: item.yoidore_type || '',
          takeout: item.takeout || '',
          catchphrase: item.catchphrase || '',
          payment: item.payment || '',
          map_url: item.map_url || '',
          insta_url: item.insta_url || '',
          photo_url: item.photo_url || '',
          // 2層分離: シーズン別企画データ
          seasons: existingSeasons,
          // 互換用（第2回時はトップレベルにも反映）
          ...(targetSeasonId === 2 ? {
            days: item.days || '',
            hours: item.hours || '',
            time_notes: item.time_notes || '',
            special_date: item.special_date || '',
            is_coupon_target: Boolean(item.is_coupon_target),
            plan_type: item.planType || '',
            set_name: item.set_name || '',
            set_content: item.set_content || '',
            set_price: item.set_price || '',
            set_charge: item.set_charge || '',
            set_limit: item.set_limit || '',
            set_notes: item.set_notes || '',
            quest_name: item.quest_name || '',
            quest_content: item.quest_content || '',
            quest_price: (item.quest_price !== undefined && item.quest_price !== null && item.quest_price !== '') ? item.quest_price : '',
            quest_charge: item.quest_charge || '',
            quest_notes: item.quest_notes || '',
            badge_sales_count: item.badge_sales_count || ''
          } : {})
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
      this.showToast(`🎉 ${successCount} 軒の酒場アンケート情報を「${seasonName}」のデータとしてSupabaseへ同期・更新しました！`);
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
        const phase = this.getSeasonPhaseInfo(s);
        return `
          <div class="season-card ${isCurrent ? 'active' : ''}">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
              <div>
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <strong style="font-size: 1.05rem; color: #0f172a;">${this.escapeHtml(s.name)}</strong>
                  ${s.is_active ? '<span class="tag tag-primary" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-weight:bold;"><i class="fa-solid fa-circle-check"></i> 本番適用中</span>' : ''}
                  <span class="tag ${phase.badgeClass}">${phase.phaseLabel}</span>
                </div>
                <div class="text-muted" style="font-size: 0.85rem; margin-top: 4px;">
                  📅 開催期間: ${s.start_date} 〜 ${s.end_date} ｜ 🎟️ クーポン利用期限: ${s.coupon_valid_until}
                </div>
              </div>
              <div style="display: flex; gap: 8px; align-items: center;">
                ${!s.is_active ? `
                  <button class="btn btn-sm btn-primary" onclick="window.adminApp.activateSeason(${s.id})">
                    <i class="fa-solid fa-bolt"></i> このシーズンを本番適用に切替
                  </button>
                  <button class="btn btn-sm btn-outline-danger" onclick="window.adminApp.confirmDeleteSeason(${s.id}, '${this.escapeHtml(s.name)}')" title="シーズンを削除">
                    <i class="fa-solid fa-trash"></i> 削除
                  </button>
                ` : `
                  <span class="text-success" style="font-weight: bold; font-size: 0.85rem;"><i class="fa-solid fa-circle-check"></i> 本番稼働中</span>
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
      document.getElementById('edit-season-start').value = current.start_date || '';
      document.getElementById('edit-season-end').value = current.end_date || '';
      document.getElementById('edit-season-valid').value = current.coupon_valid_until || '';

      // ガイダンス設定
      const overviewEl = document.getElementById('edit-season-overview');
      if (overviewEl) overviewEl.value = current.overview || '';

      const steps = (current.guide_steps && Array.isArray(current.guide_steps)) ? current.guide_steps : [];
      const s1Title = document.getElementById('edit-season-step1-title');
      const s1Desc = document.getElementById('edit-season-step1-desc');
      const s2Title = document.getElementById('edit-season-step2-title');
      const s2Desc = document.getElementById('edit-season-step2-desc');
      const s3Title = document.getElementById('edit-season-step3-title');
      const s3Desc = document.getElementById('edit-season-step3-desc');

      if (s1Title) s1Title.value = steps[0]?.title || '';
      if (s1Desc) s1Desc.value = steps[0]?.desc || '';
      if (s2Title) s2Title.value = steps[1]?.title || '';
      if (s2Desc) s2Desc.value = steps[1]?.desc || '';
      if (s3Title) s3Title.value = steps[2]?.title || '';
      if (s3Desc) s3Desc.value = steps[2]?.desc || '';

      const rulesEl = document.getElementById('edit-season-rules');
      if (rulesEl) rulesEl.value = current.rules_notes || '';

      // 初期称号設定
      const initTitleEl = document.getElementById('edit-season-initial-hero-title');
      if (initTitleEl) initTitleEl.value = current.initial_hero_title || '';
      const initColor = current.initial_badge_color || '#94a3b8';
      const initColorEl = document.getElementById('edit-season-initial-badge-color');
      const initColorPickerEl = document.getElementById('edit-season-initial-badge-color-picker');
      if (initColorEl) initColorEl.value = initColor;
      if (initColorPickerEl) initColorPickerEl.value = initColor;
    }

    // 特典一覧のレンダリング
    this.renderRewardTiers();
  }

  /* ------------------------------------------------------------------------
   * 特典ランク (reward_tiers) CRUD制御（称号・バッジカラー統合）
   * ------------------------------------------------------------------------ */
  renderRewardTiers() {
    const tbody = document.getElementById('reward-tiers-tbody');
    const tierElem = document.getElementById('reward-tiers-list');
    const container = tbody || tierElem;
    if (!container) return;

    if (!this.tiers || this.tiers.length === 0) {
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">今シーズンの特典マイルストーンが登録されていません。「＋ 特典ランクを新規作成」から追加してください。</td></tr>';
      } else if (tierElem) {
        tierElem.innerHTML = '<div class="empty-state text-muted py-3">今シーズンの特典マイルストーンが登録されていません。「＋ 特典ランクを新規作成」から追加してください。</div>';
      }
      return;
    }

    const sortedTiers = [...this.tiers].sort((a, b) => (Number(a.required_visits) || 0) - (Number(b.required_visits) || 0));

    if (tbody) {
      tbody.innerHTML = sortedTiers.map(t => {
        const isGoods = t.reward_type === 'goods';
        const typeBadge = isGoods
          ? '<span class="badge" style="background:#fef3c7; color:#b45309; border:1px solid #fde68a;"><i class="fa-solid fa-gift"></i> グッズ引換型</span>'
          : '<span class="badge" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd;"><i class="fa-solid fa-ticket"></i> クーポン型</span>';

        const heroTitleBadge = t.hero_title ? `
          <span class="hero-title-badge-preview" style="background: ${this.escapeHtml(t.badge_color || '#facc15')}; color: #000; border: 1px solid rgba(0,0,0,0.15); font-size: 11px; padding: 2px 8px; border-radius: 12px; font-weight: bold; display: inline-block;">
            🎖️ ${this.escapeHtml(t.hero_title)}
          </span>
        ` : '<span class="text-muted" style="font-size: 12px;">-</span>';

        const rewardContent = isGoods
          ? `<strong style="color:#0f172a;">🎁 ${this.escapeHtml(t.goods_name || 'オリジナルグッズ')}</strong>`
          : `お好きな酒場 <strong style="color:#0284c7;">${t.selectable_count || 5}</strong> 枠分`;

        let notesHtml = '';
        if (isGoods && t.exchange_location) {
          notesHtml += `<div style="font-size:12px; color:#334155; margin-bottom:2px;"><i class="fa-solid fa-location-dot text-danger"></i> <strong>引換:</strong> ${this.escapeHtml(t.exchange_location)}</div>`;
        }
        if (isGoods && t.exchange_notice) {
          notesHtml += `<div style="font-size:11px; color:#d97706; margin-bottom:2px;"><i class="fa-solid fa-triangle-exclamation"></i> ${this.escapeHtml(t.exchange_notice)}</div>`;
        }
        if (t.description) {
          notesHtml += `<div class="text-muted" style="font-size:12px;">${this.escapeHtml(t.description)}</div>`;
        }
        if (!notesHtml) notesHtml = '<span class="text-muted">-</span>';

        return `
          <tr>
            <td>
              <span class="badge" style="background:#f1f5f9; color:#0f172a; font-weight:bold; font-size:0.85rem;">
                <i class="fa-solid fa-beer-mug-empty text-gold"></i> <strong>${t.required_visits}</strong> 軒
              </span>
            </td>
            <td>${typeBadge}</td>
            <td><strong style="color:#0f172a; font-size:0.95rem;">${this.escapeHtml(t.title)}</strong></td>
            <td>${heroTitleBadge}</td>
            <td>${rewardContent}</td>
            <td>${notesHtml}</td>
            <td style="text-align: center;">
              <button class="btn btn-sm btn-secondary" onclick="window.adminApp.openTierModal('edit', ${t.id})" title="編集">
                <i class="fa-solid fa-pen"></i> 編集
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="window.adminApp.deleteTier(${t.id}, '${this.escapeHtml(t.title)}')" title="削除">
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>
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

  openTierModal(tierIdOrMode, optionalId) {
    const isNew = tierIdOrMode === 'new';
    const targetId = (tierIdOrMode === 'edit' && optionalId !== undefined) ? optionalId : tierIdOrMode;
    document.getElementById('tier-modal-title').innerHTML = isNew ? 
      '<i class="fa-solid fa-gift"></i> 新規特典ランクの作成' : 
      '<i class="fa-solid fa-pen-to-square"></i> 特典ランクの編集';

    let tier = {};
    if (!isNew) {
      tier = this.tiers.find(t => t.id === Number(targetId)) || {};
    } else {
      tier = {
        id: '',
        reward_type: 'store_coupon',
        title: '',
        hero_title: '',
        badge_color: '#facc15',
        required_visits: '',
        selectable_count: '',
        goods_name: '',
        exchange_location: '',
        exchange_notice: '',
        description: ''
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
    document.getElementById('edit-tier-required').value = tier.required_visits ?? '';
    document.getElementById('edit-tier-hero-title').value = tier.hero_title || '';
    document.getElementById('edit-tier-badge-color').value = tier.badge_color || '#facc15';
    document.getElementById('edit-tier-badge-color-picker').value = tier.badge_color || '#facc15';
    document.getElementById('edit-tier-selectable').value = tier.selectable_count ?? '';
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
    const hero_title = document.getElementById('edit-tier-hero-title')?.value.trim() || null;
    const badge_color = document.getElementById('edit-tier-badge-color')?.value.trim() || '#facc15';
    const selectable_count_raw = document.getElementById('edit-tier-selectable').value.trim();
    const selectable_count = parseInt(selectable_count_raw, 10);
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
    if (!isGoods && (isNaN(selectable_count) || selectable_count < 1)) {
      alert('店舗クーポン型の場合、獲得可能クーポン数（1以上）を入力してください。');
      return;
    }

    const tierData = {
      season_id,
      reward_type,
      title,
      hero_title,
      badge_color,
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
      await this.api.adminSaveRewardTier(tierData, this.selectedSeasonId);
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
      await this.api.adminDeleteRewardTier(tierId, this.selectedSeasonId);
      this.showToast(`特典「${title}」を削除しました。`);
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
    const s1Title = document.getElementById('edit-season-step1-title')?.value.trim() || '';
    const s1Desc = document.getElementById('edit-season-step1-desc')?.value.trim() || '';
    const s2Title = document.getElementById('edit-season-step2-title')?.value.trim() || '';
    const s2Desc = document.getElementById('edit-season-step2-desc')?.value.trim() || '';
    const s3Title = document.getElementById('edit-season-step3-title')?.value.trim() || '';
    const s3Desc = document.getElementById('edit-season-step3-desc')?.value.trim() || '';
    const rules_notes = document.getElementById('edit-season-rules')?.value.trim() || '';
    const initial_hero_title = document.getElementById('edit-season-initial-hero-title')?.value.trim() || '';
    const initial_badge_color = document.getElementById('edit-season-initial-badge-color')?.value.trim() || '#94a3b8';

    const guide_steps = (s1Title || s1Desc || s2Title || s2Desc || s3Title || s3Desc) ? [
      { step: '其の一', title: s1Title, desc: s1Desc },
      { step: '其の二', title: s2Title, desc: s2Desc },
      { step: '其の三', title: s3Title, desc: s3Desc }
    ] : [];

    const seasonData = {
      id: current.id || 2,
      name: name || current.name || '',
      start_date,
      end_date,
      coupon_valid_until,
      overview,
      guide_steps,
      rules_notes,
      initial_hero_title,
      initial_badge_color,
      is_active: current.is_active !== undefined ? current.is_active : true
    };

    try {
      this.showToast('開催日程・ガイダンスを保存中...');
      await this.api.adminSaveSeason(seasonData);
      this.selectedSeasonId = seasonData.id;
      this.showToast(`「${seasonData.name}」の開催日程＆ガイダンス設定を保存しました！`);
      await this.loadAllData();
      this.renderSeasonSettings();
    } catch (err) {
      alert('保存に失敗しました: ' + err.message);
    }
  }

  openSeasonModal() {
    const nextId = (this.seasons.reduce((max, s) => Math.max(max, s.id), 0) || 2) + 1;
    document.getElementById('new-season-id').value = nextId;
    document.getElementById('new-season-name').value = '';
    document.getElementById('new-season-start').value = '';
    document.getElementById('new-season-end').value = '';
    document.getElementById('new-season-valid').value = '';
    const newTitleEl = document.getElementById('new-season-initial-hero-title');
    if (newTitleEl) newTitleEl.value = '';
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
    const initial_hero_title = document.getElementById('new-season-initial-hero-title')?.value.trim() || '';
    const is_active = document.getElementById('new-season-active').checked;

    const seasonData = { id, name, start_date, end_date, coupon_valid_until, initial_hero_title, initial_badge_color: '#94a3b8', is_active };

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
    const targetSeason = this.seasons.find(s => s.id === seasonId);
    const seasonName = targetSeason ? targetSeason.name : '選択中イベント';
    if (!confirm(`「${seasonName}」を本番適用（アクティブ）に切り替えますか？\n（参加者のアプリが「${seasonName}」モードに切り替わります）`)) {
      return;
    }
    try {
      this.showToast('本番適用シーズンを切り替え中...');
      await this.api.adminSetActiveSeason(seasonId);
      this.selectedSeasonId = seasonId;
      this.showToast(`「${seasonName}」を本番適用に切り替えました！`);
      await this.loadAllData();
    } catch (err) {
      alert('切り替えに失敗しました: ' + err.message);
    }
  }

  async confirmDeleteSeason(seasonId, seasonName) {
    const targetSeason = this.seasons.find(s => s.id === seasonId);
    if (targetSeason && targetSeason.is_active) {
      alert('現在本番適用中（アクティブ）のシーズンは削除できません。先に別のシーズンを本番適用に切り替えてください。');
      return;
    }

    if (!confirm(`【確認】シーズン「${seasonName}」を削除しますか？\n\n※この操作を実行すると、このシーズンの開催設定および店舗の参加・企画データ設定が削除されます。\n※よろしければ「OK」を押してください。`)) {
      return;
    }

    try {
      this.showToast(`「${seasonName}」を削除中...`);
      await this.api.adminDeleteSeason(seasonId);
      this.showToast(`「${seasonName}」を削除しました。`);

      // 削除したシーズンが選択中だった場合は、残りのアクティブシーズンまたは先頭シーズンに切り替え
      if (this.selectedSeasonId === seasonId) {
        const remaining = (this.seasons || []).find(s => s.id !== seasonId);
        this.selectedSeasonId = remaining ? remaining.id : 2;
      }

      await this.loadAllData();
    } catch (err) {
      alert('シーズン削除に失敗しました: ' + err.message);
    }
  }

  /* ------------------------------------------------------------------------
   * 4. 参加者・履歴ログ & 削除・復元機能
   * ------------------------------------------------------------------------ */
  renderLogs() {
    const usedCouponsCount = (this.coupons || []).filter(c => c.status === 'used').length;
    const usersCountElem = document.getElementById('count-users');
    if (usersCountElem) usersCountElem.textContent = this.users ? this.users.length : 0;
    const couponsCountElem = document.getElementById('count-coupons');
    if (couponsCountElem) couponsCountElem.textContent = usedCouponsCount;

    // 1. 参加者一覧テーブル描画 (サマリーKPIピル & リアルタイム件数バッジ連動)
    this.renderParticipants();

    // 2. クーポン・特典利用履歴テーブル描画 (検索・種別フィルター & リアルタイム件数バッジ連動)
    this.renderCouponLogs();
  }

  /* 参加者 友だち種別トグルフィルター（互換性保持） */
  setUserFriendFilter(val) {
    this.renderParticipants();
  }

  /* 参加者 サマリーピル クイック絞り込み切り替え */
  quickFilterParticipants(filterType) {
    const tierFilter = document.getElementById('users-tier-filter');
    if (tierFilter) {
      tierFilter.value = filterType;
    }
    this.renderParticipants();
  }

  /* 参加者 フィルター・検索全リセット */
  resetParticipantFilters() {
    const searchInput = document.getElementById('users-search-input');
    if (searchInput) searchInput.value = '';
    const tierFilter = document.getElementById('users-tier-filter');
    if (tierFilter) tierFilter.value = 'all';
    const sortSelect = document.getElementById('users-sort-select');
    if (sortSelect) sortSelect.value = 'created_desc';
    this.renderParticipants();
  }

  /* 参加者 ページ移動 */
  goToUserPage(targetPage) {
    this.userPagination.page = targetPage;
    this.renderParticipants(true);
    const tableElem = document.getElementById('users-table-body');
    if (tableElem) {
      tableElem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  /* 参加者 表示件数変更 */
  setUserPageSize(size) {
    this.userPagination.pageSize = size === 'all' ? 'all' : parseInt(size, 10);
    this.userPagination.page = 1;
    this.renderParticipants(true);
  }

  /* 参加者一覧テーブルの描画（検索・絞り込み・ソート・サマリーKPI連動） */
  renderParticipants(preservePage = false) {
    const userTbody = document.getElementById('users-table-body');
    if (!userTbody) return;

    if (!this.users || this.users.length === 0) {
      userTbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">参加者データがありません</td></tr>';
      // KPIクリア
      const kpiTotal = document.getElementById('user-kpi-total');
      if (kpiTotal) kpiTotal.textContent = '0 名';
      const countBadge = document.getElementById('users-filtered-count');
      if (countBadge) countBadge.textContent = '表示中: 0 / 0 名';
      const paginationBar = document.getElementById('users-pagination-bar');
      if (paginationBar) paginationBar.style.display = 'none';
      return;
    }

    const searchInput = document.getElementById('users-search-input');
    const searchTerm = (searchInput ? searchInput.value : '').trim().toLowerCase();

    const tierFilter = document.getElementById('users-tier-filter');
    const filterValue = tierFilter ? tierFilter.value : 'all';

    const sortSelect = document.getElementById('users-sort-select');
    const sortValue = sortSelect ? sortSelect.value : 'created_desc';

    const sortedTiers = [...(this.tiers || [])].sort((a, b) => (Number(a.required_visits || 0)) - (Number(b.required_visits || 0)));

    // 1. 各ユーザーの特典・消込データを集計
    let countHasRewards = 0;
    let countHasRemaining = 0;
    let countGoodsUnclaimed = 0;
    let countAllUsed = 0;
    let countNoRewards = 0;

    const enrichedUsers = this.users.map(u => {
      const userCoupons = (this.coupons || []).filter(c => c.user_id === u.line_user_id);
      const tierStatusList = [];
      let totalStoreCoupons = 0;
      let usedStoreCoupons = 0;
      let totalGoods = 0;
      let claimedGoods = 0;

      if (sortedTiers.length > 0) {
        sortedTiers.forEach(tier => {
          const tierIdNum = Number(tier.id);
          const isGoods = tier.reward_type === 'goods';

          const matchingCoupons = userCoupons.filter(c => Number(c.reward_tier_id) === tierIdNum || (c.status && String(c.status).startsWith(`tier_${tierIdNum}_`)));

          if (matchingCoupons.length > 0) {
            const total = matchingCoupons.length;
            const usedList = matchingCoupons.filter(c => c.status === 'used');
            const used = usedList.length;
            const remaining = Math.max(0, total - used);

            const usedStores = usedList.map(c => {
              const st = this.stores.find(s => s.id === c.store_id);
              return st ? st.name : (c.store_id || '酒場');
            });

            if (isGoods) {
              totalGoods += 1;
              if (used > 0) claimedGoods += 1;
            } else {
              totalStoreCoupons += total;
              usedStoreCoupons += used;
            }

            tierStatusList.push({
              tier,
              isGoods,
              total,
              used,
              remaining,
              usedStores,
              coupons: matchingCoupons
            });
          }
        });
      }

      const remainingStoreCoupons = Math.max(0, totalStoreCoupons - usedStoreCoupons);
      const unclaimedGoods = Math.max(0, totalGoods - claimedGoods);
      const totalRewardsCount = tierStatusList.length || (userCoupons.length > 0 ? 1 : 0);

      // KPI カウント判定
      if (totalRewardsCount > 0) countHasRewards++;
      if (remainingStoreCoupons > 0) countHasRemaining++;
      if (unclaimedGoods > 0) countGoodsUnclaimed++;
      if (totalStoreCoupons > 0 && remainingStoreCoupons === 0) countAllUsed++;
      if (totalRewardsCount === 0) countNoRewards++;

      return {
        user: u,
        userCoupons,
        tierStatusList,
        totalStoreCoupons,
        usedStoreCoupons,
        remainingStoreCoupons,
        totalGoods,
        claimedGoods,
        unclaimedGoods,
        totalRewardsCount
      };
    });

    // 2. サマリーストリップのKPIピルを最新値に更新
    const elKpiTotal = document.getElementById('user-kpi-total');
    if (elKpiTotal) elKpiTotal.textContent = `${enrichedUsers.length} 名`;

    const elKpiHasRewards = document.getElementById('user-kpi-has-rewards');
    if (elKpiHasRewards) elKpiHasRewards.textContent = `${countHasRewards} 名`;

    const elKpiHasRemaining = document.getElementById('user-kpi-has-remaining');
    if (elKpiHasRemaining) elKpiHasRemaining.textContent = `${countHasRemaining} 名`;

    const elKpiGoodsUnclaimed = document.getElementById('user-kpi-goods-unclaimed');
    if (elKpiGoodsUnclaimed) elKpiGoodsUnclaimed.textContent = `${countGoodsUnclaimed} 名`;

    const elKpiAllUsed = document.getElementById('user-kpi-all-used');
    if (elKpiAllUsed) elKpiAllUsed.textContent = `${countAllUsed} 名`;

    const elKpiNoRewards = document.getElementById('user-kpi-no-rewards');
    if (elKpiNoRewards) elKpiNoRewards.textContent = `${countNoRewards} 名`;

    // ピルのアクティブクラス同期
    const pillMap = {
      'all': 'kpi-pill-user-all',
      'has_rewards': 'kpi-pill-user-has-rewards',
      'has_remaining': 'kpi-pill-user-has-remaining',
      'goods_unclaimed': 'kpi-pill-user-goods-unclaimed',
      'all_used': 'kpi-pill-user-all-used',
      'no_rewards': 'kpi-pill-user-no-rewards'
    };
    document.querySelectorAll('#users-summary-strip .summary-pill').forEach(p => p.classList.remove('active'));
    const activePillId = pillMap[filterValue] || (filterValue === 'all' ? 'kpi-pill-user-all' : null);
    if (activePillId) {
      const activePill = document.getElementById(activePillId);
      if (activePill) activePill.classList.add('active');
    }

    // 3. フィルタリング実行
    let filtered = enrichedUsers.filter(item => {
      const u = item.user;
      // 検索フィルター
      if (searchTerm) {
        const name = (u.display_name || '').toLowerCase();
        const lineId = (u.line_user_id || '').toLowerCase();
        if (!name.includes(searchTerm) && !lineId.includes(searchTerm)) {
          return false;
        }
      }

      // 状態・獲得枠フィルター
      if (filterValue === 'has_rewards') {
        if (item.totalRewardsCount === 0) return false;
      } else if (filterValue === 'has_remaining') {
        if (item.remainingStoreCoupons === 0) return false;
      } else if (filterValue === 'all_used') {
        if (!(item.totalStoreCoupons > 0 && item.remainingStoreCoupons === 0)) return false;
      } else if (filterValue === 'goods_unclaimed') {
        if (item.unclaimedGoods === 0) return false;
      } else if (filterValue === 'no_rewards') {
        if (item.totalRewardsCount !== 0) return false;
      }

      return true;
    });

    // 4. ソート実行
    filtered.sort((a, b) => {
      const uA = a.user;
      const uB = b.user;
      if (sortValue === 'created_desc') {
        return new Date(uB.created_at || 0) - new Date(uA.created_at || 0);
      } else if (sortValue === 'active_desc') {
        return new Date(uB.last_active_at || 0) - new Date(uA.last_active_at || 0);
      } else if (sortValue === 'coupons_desc') {
        return (b.totalStoreCoupons + b.totalGoods) - (a.totalStoreCoupons + a.totalGoods);
      } else if (sortValue === 'used_desc') {
        return (b.usedStoreCoupons + b.claimedGoods) - (a.usedStoreCoupons + a.claimedGoods);
      } else if (sortValue === 'name_asc') {
        return (uA.display_name || '').localeCompare(uB.display_name || '', 'ja');
      }
      return 0;
    });

    this.lastFilteredUsers = filtered;

    // 5. 件数バッジ更新
    const filteredCountElem = document.getElementById('users-filtered-count');
    if (filteredCountElem) {
      filteredCountElem.textContent = filtered.length === enrichedUsers.length
        ? `表示中: ${filtered.length} 名`
        : `表示中: ${filtered.length} / ${enrichedUsers.length} 名`;
    }
    const tabCountElem = document.getElementById('count-users');
    if (tabCountElem) {
      tabCountElem.textContent = enrichedUsers.length;
    }

    // ページ位置の制御
    if (!preservePage) {
      this.userPagination.page = 1;
    }

    const pageSize = this.userPagination.pageSize;
    const totalItems = filtered.length;
    const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(totalItems / pageSize));
    if (this.userPagination.page > totalPages) {
      this.userPagination.page = totalPages;
    }
    const currentPage = this.userPagination.page;

    const startIndex = pageSize === 'all' ? 0 : (currentPage - 1) * pageSize;
    const endIndex = pageSize === 'all' ? totalItems : Math.min(startIndex + pageSize, totalItems);
    const pagedUsers = filtered.slice(startIndex, endIndex);

    // ページネーションコントロール描画
    this.renderPaginationControls({
      barId: 'users-pagination-bar',
      rangeTextId: 'users-pagination-range-text',
      controlsId: 'users-pagination-controls',
      totalItems,
      currentPage,
      pageSize,
      unit: '名',
      onPageChange: 'window.adminApp.goToUserPage'
    });

    if (filtered.length === 0) {
      userTbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">該当する参加者が見つかりません</td></tr>';
      return;
    }

    userTbody.innerHTML = pagedUsers.map(item => {
      const u = item.user;
      const tierList = item.tierStatusList;

      // 1. 獲得特典ピル（横並びコンパクト表示）
      let rewardsHtml = '';
      if (tierList.length > 0) {
        rewardsHtml = `
          <div style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center;">
            ${tierList.map(tItem => {
              const t = tItem.tier;
              const req = t.required_visits ?? t.required_count ?? 0;
              if (tItem.isGoods) {
                return `<span class="badge" style="background:#fef3c7; color:#92400e; border:1px solid #fde047; font-size:11px; padding:2px 6px;" title="${this.escapeHtml(t.title)} (記念品)"><i class="fa-solid fa-gift"></i> ${req}軒</span>`;
              } else {
                return `<span class="badge" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-size:11px; padding:2px 6px;" title="${this.escapeHtml(t.title)} (${t.selectable_count || 5}枠)"><i class="fa-solid fa-ticket"></i> ${req}軒(${t.selectable_count || 5}枠)</span>`;
              }
            }).join('')}
          </div>
        `;
      } else if (item.userCoupons.length > 0) {
        rewardsHtml = `<span class="badge" style="background:#f1f5f9; color:#475569; font-size:11px; padding:2px 6px;"><i class="fa-solid fa-trophy"></i> 特典付与済 (${item.userCoupons.length}件)</span>`;
      } else {
        rewardsHtml = `<span class="text-muted" style="font-size:11px;"><i class="fa-solid fa-hourglass-start"></i> 未獲得</span>`;
      }

      // 2. クーポン保有・消込状況（サマリー ＋ 小型プログレス）
      let statusHtml = '';
      if (item.totalStoreCoupons > 0 || item.totalGoods > 0) {
        const parts = [];

        // 店舗クーポンサマリー
        if (item.totalStoreCoupons > 0) {
          const usedPct = Math.round((item.usedStoreCoupons / item.totalStoreCoupons) * 100);
          const isComplete = item.remainingStoreCoupons === 0;
          parts.push(`
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="font-size:11px; font-weight:600; color:${isComplete ? '#64748b' : '#0369a1'};">
                <i class="fa-solid fa-ticket"></i> ${item.usedStoreCoupons}/${item.totalStoreCoupons}枠消込
              </span>
              <div style="width:50px; height:6px; background:#e2e8f0; border-radius:3px; overflow:hidden; flex-shrink:0;">
                <div style="width:${usedPct}%; height:100%; background:${isComplete ? '#10b981' : '#0284c7'};"></div>
              </div>
              ${isComplete 
                ? '<span style="font-size:10px; color:#10b981; font-weight:bold;">完</span>' 
                : `<span style="font-size:10px; color:#16a34a; font-weight:bold;">残${item.remainingStoreCoupons}</span>`
              }
            </div>
          `);
        }

        // 記念品サマリー
        if (item.totalGoods > 0) {
          const isAllClaimed = item.unclaimedGoods === 0;
          parts.push(`
            <div style="display:flex; align-items:center; gap:6px; font-size:11px;">
              <span style="color:#92400e; font-weight:600;"><i class="fa-solid fa-gift"></i> 記念品:</span>
              ${isAllClaimed
                ? `<span class="badge" style="background:#dcfce7; color:#15803d; font-size:10px; padding:1px 5px;"><i class="fa-solid fa-check"></i> 引換済 (${item.claimedGoods}/${item.totalGoods})</span>`
                : `<span class="badge" style="background:#fef3c7; color:#b45309; font-size:10px; padding:1px 5px;"><i class="fa-solid fa-clock"></i> 未引換あり (${item.claimedGoods}/${item.totalGoods})</span>`
              }
            </div>
          `);
        }

        statusHtml = `
          <div style="display:flex; flex-direction:column; gap:2px;">
            ${parts.join('')}
          </div>
        `;
      } else if (item.userCoupons.length > 0) {
        const used = item.userCoupons.filter(c => c.status === 'used').length;
        statusHtml = `<span style="font-size:11px; color:#475569;">付与計 ${item.userCoupons.length}件 (${used}件消込済)</span>`;
      } else {
        statusHtml = `<span class="text-muted" style="font-size:11px;">-</span>`;
      }

      const createdStr = u.created_at ? new Date(u.created_at).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';
      const activeStr = u.last_active_at ? new Date(u.last_active_at).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <img src="${u.picture_url || 'assets/banner.png'}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover; border: 1px solid #e2e8f0; flex-shrink:0;">
              <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px;">
                <strong style="font-size: 13px; color:#0f172a;" title="${this.escapeHtml(u.display_name || '冒険者')}">${this.escapeHtml(u.display_name || '冒険者')}</strong>
              </div>
            </div>
          </td>
          <td><code style="font-size: 11px; padding: 1px 4px;">${this.escapeHtml(u.line_user_id || '')}</code></td>
          <td>${rewardsHtml}</td>
          <td>${statusHtml}</td>
          <td><small class="text-muted" style="font-size:11px;">${createdStr}</small></td>
          <td><small class="text-muted" style="font-size:11px;">${activeStr}</small></td>
          <td style="text-align: center; white-space: nowrap;">
            <div style="display: flex; gap: 4px; justify-content: center; align-items: center;">
              <button class="btn btn-sm btn-outline-primary" style="padding: 2px 7px; font-size: 11px;" onclick="window.adminApp.openParticipantDetailModal('${u.line_user_id}')" title="特典・消込詳細を確認">
                <i class="fa-solid fa-magnifying-glass"></i> 詳細
              </button>
              <button class="btn btn-sm btn-outline-danger" style="padding: 2px 6px; font-size: 11px;" onclick="window.adminApp.confirmDeleteUser('${u.line_user_id}', '${this.escapeHtml(u.display_name || '')}')" title="ユーザーを削除">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  /* 特典種別トグル */
  setCouponTypeSegment(val) {
    const hidden = document.getElementById('coupons-type-filter');
    if (hidden) hidden.value = val;
    const group = document.getElementById('coupons-type-segmented');
    if (group) {
      group.querySelectorAll('.segment-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.val === val);
      });
    }
    this.renderCouponLogs();
  }

  /* 特典利用状態トグル */
  setCouponStatusSegment(val) {
    const hidden = document.getElementById('coupons-status-filter');
    if (hidden) hidden.value = val;
    const group = document.getElementById('coupons-status-segmented');
    if (group) {
      group.querySelectorAll('.segment-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.val === val);
      });
    }
    this.renderCouponLogs();
  }

  /* 特典クーポン・グッズ消込履歴の描画（検索・種別状態フィルター連動） */
  renderCouponLogs() {
    const couponTbody = document.getElementById('coupons-table-body');
    if (!couponTbody) return;

    if (!this.coupons || this.coupons.length === 0) {
      couponTbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">今期のクーポン・特典履歴がありません</td></tr>';
      const badge = document.getElementById('coupons-filtered-count');
      if (badge) badge.textContent = '表示中: 0 / 0 件';
      return;
    }

    const searchInput = document.getElementById('coupons-search-input');
    const searchTerm = (searchInput ? searchInput.value : '').trim().toLowerCase();

    const typeFilter = document.getElementById('coupons-type-filter');
    const typeVal = typeFilter ? typeFilter.value : 'all';

    const statusFilter = document.getElementById('coupons-status-filter');
    const statusVal = statusFilter ? statusFilter.value : 'all';

    // フィルタリング
    const filteredCoupons = this.coupons.filter(c => {
      const store = this.stores.find(s => s.id === c.store_id);
      const isGoods = c.reward_type === 'goods';
      const user = this.users.find(u => u.line_user_id === c.user_id);
      const userName = user ? user.display_name : c.user_id;
      const targetName = isGoods ? (c.goods_name || c.title || '記念品引換') : (store ? store.name : (c.store_id || ''));

      // 検索フィルター
      if (searchTerm) {
        const uStr = (userName || '').toLowerCase();
        const tStr = (targetName || '').toLowerCase();
        const idStr = (c.user_id || '').toLowerCase();
        if (!uStr.includes(searchTerm) && !tStr.includes(searchTerm) && !idStr.includes(searchTerm)) {
          return false;
        }
      }

      // 種別フィルター (全種別 / クーポン / 記念品)
      if (typeVal === 'store' && isGoods) return false;
      if (typeVal === 'goods' && !isGoods) return false;

      // 状態フィルター (全状態 / 消込・受取済 / 未使用・残枠)
      if (statusVal === 'used' && c.status !== 'used') return false;
      if (statusVal === 'unused' && c.status === 'used') return false;

      return true;
    });

    // 件数バッジ更新
    const countBadge = document.getElementById('coupons-filtered-count');
    if (countBadge) {
      countBadge.textContent = `表示中: ${filteredCoupons.length} / ${this.coupons.length} 件`;
    }

    if (filteredCoupons.length === 0) {
      couponTbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">該当する消込履歴が見つかりません</td></tr>';
      return;
    }

    couponTbody.innerHTML = filteredCoupons.map(c => {
      const store = this.stores.find(s => s.id === c.store_id);
      const isGoods = c.reward_type === 'goods';
      const typeBadge = isGoods 
        ? '<span class="badge" style="background:#fef3c7; color:#b45309;"><i class="fa-solid fa-gift"></i> 記念品</span>' 
        : '<span class="badge" style="background:#e0f2fe; color:#0369a1;"><i class="fa-solid fa-wine-glass"></i> クーポン</span>';
      
      const targetName = isGoods 
        ? `🎁 ${this.escapeHtml(c.goods_name || c.title || '記念品引換')}` 
        : (store ? `🍺 ${this.escapeHtml(store.name)} <small style="color:#64748b;">(${c.store_id})</small>` : (c.store_id ? `🍺 ${this.escapeHtml(c.store_id)}` : '<span style="color:#94a3b8;">🎟️ （利用店舗未指定）</span>'));
      
      const user = this.users.find(u => u.line_user_id === c.user_id);
      const userName = user ? user.display_name : c.user_id;
      const usedTime = c.used_at || c.acquired_at;
      const timeStr = usedTime ? new Date(usedTime).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';
      const isUsed = c.status === 'used';

      const statusTag = isUsed 
        ? (isGoods ? '<span class="tag tag-active" style="background:#dcfce7; color:#15803d; font-size:11px;"><i class="fa-solid fa-check"></i> 受取済</span>' : '<span class="tag tag-active" style="background:#dcfce7; color:#15803d; font-size:11px;"><i class="fa-solid fa-check"></i> 利用済</span>')
        : '<span class="tag tag-area" style="background:#f1f5f9; color:#475569; font-size:11px;"><i class="fa-solid fa-clock"></i> 未使用・保有</span>';

      return `
        <tr>
          <td><small class="text-muted">${timeStr}</small></td>
          <td>${typeBadge}</td>
          <td><strong>${this.escapeHtml(userName)}</strong></td>
          <td><strong>${targetName}</strong></td>
          <td style="text-align: center;">${statusTag}</td>
          <td style="text-align: center;">
            <button class="btn btn-sm btn-outline-primary" style="padding: 2px 8px; font-size: 11px;" onclick="window.adminApp.openParticipantDetailModal('${c.user_id}')" title="この冒険者の詳細モーダルを開く">
              <i class="fa-solid fa-magnifying-glass"></i> 詳細
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  /* 特典消込履歴 フィルター・検索全リセット */
  resetCouponFilters() {
    const searchInput = document.getElementById('coupons-search-input');
    if (searchInput) searchInput.value = '';
    const typeFilter = document.getElementById('coupons-type-filter');
    if (typeFilter) typeFilter.value = 'all';
    const typeGroup = document.getElementById('coupons-type-segmented');
    if (typeGroup) {
      typeGroup.querySelectorAll('.segment-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.val === 'all');
      });
    }
    const statusFilter = document.getElementById('coupons-status-filter');
    if (statusFilter) statusFilter.value = 'all';
    const statusGroup = document.getElementById('coupons-status-segmented');
    if (statusGroup) {
      statusGroup.querySelectorAll('.segment-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.val === 'all');
      });
    }
    this.renderCouponLogs();
  }

  /* 参加者 特典・消込詳細モーダルを開く */
  openParticipantDetailModal(lineUserId) {
    const user = (this.users || []).find(u => u.line_user_id === lineUserId);
    if (!user) {
      alert('ユーザー情報が見つかりません');
      return;
    }

    const modal = document.getElementById('participant-detail-modal');
    if (!modal) return;

    // 基本情報セット
    const avatarElem = document.getElementById('pmodal-avatar');
    if (avatarElem) avatarElem.src = user.picture_url || 'assets/banner.png';

    const nameElem = document.getElementById('pmodal-name');
    if (nameElem) nameElem.textContent = user.display_name || '冒険者';

    const idElem = document.getElementById('pmodal-id');
    if (idElem) idElem.textContent = user.line_user_id || '';

    const createdElem = document.getElementById('pmodal-created');
    if (createdElem) createdElem.textContent = user.created_at ? new Date(user.created_at).toLocaleString('ja-JP') : '-';

    const activeElem = document.getElementById('pmodal-active');
    if (activeElem) activeElem.textContent = user.last_active_at ? new Date(user.last_active_at).toLocaleString('ja-JP') : '-';

    // クーポン・特典集計
    const userCoupons = (this.coupons || []).filter(c => c.user_id === lineUserId);
    const sortedTiers = [...(this.tiers || [])].sort((a, b) => (Number(a.required_visits || 0)) - (Number(b.required_visits || 0)));
    const unlockedTierIds = Array.from(new Set(userCoupons.map(c => Number(c.reward_tier_id)).filter(id => !isNaN(id) && id > 0)));

    const container = document.getElementById('pmodal-tiers-container');
    const statsBadge = document.getElementById('pmodal-stats-badge');
    const summaryCountElem = document.getElementById('pmodal-summary-count');

    let totalCoupons = 0;
    let usedCoupons = 0;
    let totalGoods = 0;
    let claimedGoods = 0;

    const cardsHtml = [];
    let fallbackSlotCounter = 0;

    sortedTiers.forEach(tier => {
      const tierIdNum = Number(tier.id);
      const isGoods = tier.reward_type === 'goods';
      const reqVisits = tier.required_visits ?? tier.required_count ?? 0;

      const matchingCoupons = userCoupons.filter(c => Number(c.reward_tier_id) === tierIdNum || (c.status && String(c.status).startsWith(`tier_${tierIdNum}_`)));
      const isUnlocked = matchingCoupons.length > 0;

      if (isUnlocked) {
        const total = matchingCoupons.length;
        const usedList = matchingCoupons.filter(c => c.status === 'used');
        const used = usedList.length;
        const remaining = Math.max(0, total - used);

        if (isGoods) {
          totalGoods += 1;
          if (used > 0) claimedGoods += 1;

          const isClaimed = used > 0;
          const claimCoupon = matchingCoupons[0];
          const claimTime = claimCoupon && (claimCoupon.used_at || claimCoupon.acquired_at) 
            ? new Date(claimCoupon.used_at || claimCoupon.acquired_at).toLocaleString('ja-JP') 
            : '-';
          const storeName = claimCoupon && claimCoupon.store_id 
            ? (this.stores.find(s => s.id === claimCoupon.store_id)?.name || claimCoupon.store_id) 
            : (tier.exchange_location || '指定引換所');

          cardsHtml.push(`
            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 14px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span class="badge" style="background:#fef3c7; color:#92400e; font-size:12px; padding:3px 8px; font-weight:bold;">
                    <i class="fa-solid fa-gift"></i> 【${reqVisits}軒達成】 ${this.escapeHtml(tier.title)}
                  </span>
                  <span style="font-size:11px; color:#78350f;">(記念品グッズ)</span>
                </div>
                <div style="display:flex; align-items:center; gap:6px;">
                  ${isClaimed 
                    ? `<span class="badge" style="background:#10b981; color:#fff; font-size:11px; padding:3px 8px;"><i class="fa-solid fa-check"></i> 引換完了</span>
                       <button class="btn btn-sm btn-secondary" style="padding: 2px 7px; font-size: 11px;" onclick="window.adminApp.updateCouponStatus('${claimCoupon.id}', 'active')" title="未受取に戻す">
                         <i class="fa-solid fa-rotate-left"></i> 未受取へ
                       </button>`
                    : `<span class="badge" style="background:#f59e0b; color:#fff; font-size:11px; padding:3px 8px;"><i class="fa-solid fa-clock"></i> 未引換</span>
                       <button class="btn btn-sm btn-success" style="padding: 2px 7px; font-size: 11px;" onclick="window.adminApp.updateCouponStatus('${claimCoupon.id}', 'used')" title="受取済みに更新">
                         <i class="fa-solid fa-check"></i> 受取済へ
                       </button>`
                  }
                  <button class="btn btn-sm btn-outline-danger" style="padding: 2px 7px; font-size: 11px;" onclick="window.adminApp.confirmRevokeUserRewardTier('${lineUserId}', ${tier.id}, '${this.escapeHtml(tier.title)}')" title="この特典の獲得自体を取り消す">
                    <i class="fa-solid fa-trash"></i> 特典取消
                  </button>
                </div>
              </div>
              <div style="font-size: 13px; color: #1e293b; margin-bottom: 6px;">
                <strong>記念品名:</strong> ${this.escapeHtml(tier.goods_name || tier.title)}
              </div>
              <div style="font-size: 12px; color: #64748b; background: rgba(255,255,255,0.8); padding: 8px 10px; border-radius: 6px; border: 1px solid #fed7aa;">
                <div><i class="fa-solid fa-location-dot"></i> <strong>引換場所:</strong> ${this.escapeHtml(storeName)}</div>
                ${isClaimed ? `<div style="margin-top:2px;"><i class="fa-solid fa-calendar-check"></i> <strong>引換日時:</strong> ${claimTime}</div>` : ''}
              </div>
            </div>
          `);
        } else {
          totalCoupons += total;
          usedCoupons += used;

          const isCompleted = remaining === 0;

          // 各スロット（枠）の詳細リスト
          const slotsHtml = [];
          for (let i = 0; i < total; i++) {
            const coupon = matchingCoupons[i];
            const isSlotUsed = coupon && coupon.status === 'used';
            const store = coupon ? this.stores.find(s => s.id === coupon.store_id) : null;
            const storeName = store ? store.name : (coupon && coupon.store_id ? coupon.store_id : '（店舗未指定）');
            const usedAtStr = coupon && coupon.used_at ? new Date(coupon.used_at).toLocaleString('ja-JP') : '-';

            slotsHtml.push(`
              <div style="display:flex; justify-content:space-between; align-items:center; background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:6px 10px; font-size:12px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-weight:bold; color:#64748b; font-size:11px;">枠 ${i + 1}</span>
                  ${isSlotUsed 
                    ? `<span class="badge" style="background:#10b981; color:#fff; font-size:10px; padding:2px 6px;"><i class="fa-solid fa-check"></i> 消込済</span>`
                    : `<span class="badge" style="background:#e0f2fe; color:#0369a1; font-size:10px; padding:2px 6px;"><i class="fa-solid fa-circle-check"></i> 未使用</span>`
                  }
                  <span style="color:#1e293b; font-weight:600;">${this.escapeHtml(storeName)}</span>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:11px; color:#64748b;">
                    ${isSlotUsed ? `<i class="fa-solid fa-clock"></i> ${usedAtStr}` : '未利用'}
                  </span>
                  ${isSlotUsed ? `
                    <button class="btn btn-sm btn-secondary" style="padding: 1px 6px; font-size: 10px;" onclick="window.adminApp.updateCouponStatus('${coupon.id}', 'active')" title="この枠を未使用に戻す">
                      <i class="fa-solid fa-rotate-left"></i> 未使用へ
                    </button>
                  ` : `
                    <button class="btn btn-sm btn-primary" style="padding: 1px 6px; font-size: 10px;" onclick="window.adminApp.openManualRedeemModal('${coupon.id}')" title="利用酒場を指定して消込">
                      <i class="fa-solid fa-check"></i> 消込
                    </button>
                  `}
                </div>
              </div>
            `);
          }

          cardsHtml.push(`
            <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 12px 14px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span class="badge" style="background:#e0f2fe; color:#0369a1; font-size:12px; padding:3px 8px; font-weight:bold;">
                    <i class="fa-solid fa-ticket"></i> 【${reqVisits}軒達成】 ${this.escapeHtml(tier.title)}
                  </span>
                  <span style="font-size:11px; color:#0369a1;">(${total}枠中 <strong>${used}枠消込</strong> / 残り${remaining}枠)</span>
                </div>
                <div style="display:flex; align-items:center; gap:6px;">
                  ${isCompleted
                    ? `<span class="badge" style="background:#10b981; color:#fff; font-size:11px; padding:3px 8px;"><i class="fa-solid fa-check-double"></i> 全枠消込済</span>`
                    : `<span class="badge" style="background:#0284c7; color:#fff; font-size:11px; padding:3px 8px;"><i class="fa-solid fa-circle-check"></i> 残り ${remaining} 枠利用可</span>`
                  }
                  <button class="btn btn-sm btn-outline-danger" style="padding: 2px 7px; font-size: 11px;" onclick="window.adminApp.confirmRevokeUserRewardTier('${lineUserId}', ${tier.id}, '${this.escapeHtml(tier.title)}')" title="この特典の獲得自体（全${total}枠）を取り消す">
                    <i class="fa-solid fa-trash"></i> 特典取消
                  </button>
                </div>
              </div>

              <!-- スロット一覧 -->
              <div style="display:flex; flex-direction:column; gap:4px; margin-top:8px;">
                ${slotsHtml.join('')}
              </div>
            </div>
          `);
        }
      }
    });

    if (cardsHtml.length === 0) {
      if (userCoupons.length > 0) {
        container.innerHTML = `
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px; text-align:center;">
            <p style="margin:0; font-size:13px; color:#475569;">特典レコード: 計 ${userCoupons.length}件登録あり</p>
          </div>
        `;
      } else {
        container.innerHTML = `
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:20px; text-align:center;">
            <i class="fa-solid fa-hourglass-start" style="font-size:24px; color:#94a3b8; margin-bottom:6px;"></i>
            <p style="margin:0; font-size:13px; color:#64748b;">まだ特典を獲得していません（スタンプラリー参加中）</p>
          </div>
        `;
      }
    } else {
      container.innerHTML = cardsHtml.join('');
    }

    if (statsBadge) {
      statsBadge.textContent = `酒場クーポン: ${usedCoupons}/${totalCoupons}枠消込 | 記念品: ${claimedGoods}/${totalGoods}品受取`;
    }
    if (summaryCountElem) {
      summaryCountElem.textContent = `${cardsHtml.length} 特典ランク解放 (クーポン ${totalCoupons}枠 / 記念品 ${totalGoods}点)`;
    }

    modal.style.display = 'flex';
  }

  /* 参加者 特典・消込詳細モーダルを閉じる */
  closeParticipantDetailModal() {
    const modal = document.getElementById('participant-detail-modal');
    if (modal) modal.style.display = 'none';
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
    if (!confirm(`⚠️ 警告: ユーザー「${displayName}」を完全に削除しますか？\n\n※このユーザーに紐づくすべての獲得クーポン・利用消込履歴も完全に削除されます。この操作は元に戻せません。`)) {
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

  // クーポン手動消込モーダルを開く (店舗選択用)
  openManualRedeemModal(couponId) {
    const coupon = (this.coupons || []).find(c => String(c.id) === String(couponId));
    if (!coupon) {
      alert('対象のクーポンデータが見つかりません');
      return;
    }

    const user = (this.users || []).find(u => u.line_user_id === coupon.user_id);
    const userName = user ? user.display_name : coupon.user_id;
    const tier = (this.tiers || []).find(t => Number(t.id) === Number(coupon.reward_tier_id));
    const tierName = tier ? `【${tier.required_visits || 5}軒達成】${tier.title}` : '酒場クーポン';

    const modal = document.getElementById('manual-redeem-modal');
    if (!modal) return;

    document.getElementById('manual-redeem-coupon-id').value = couponId;
    document.getElementById('manual-redeem-tier-id').value = coupon.reward_tier_id || tier?.id || '';
    document.getElementById('manual-redeem-user-name').textContent = userName || '冒険者';
    document.getElementById('manual-redeem-tier-name').textContent = tierName;

    // 対象ユーザーが今期既に利用（used）した店舗IDのセット
    const userUsedStoreIds = new Set(
      (this.coupons || [])
        .filter(c => c.user_id === coupon.user_id && c.status === 'used' && c.store_id)
        .map(c => c.store_id)
    );

    // クーポン取扱対象（かつ参加中）の店舗のみを抽出
    const couponStores = (this.stores || []).filter(s => s.is_participating !== false && s.is_coupon_target);
    couponStores.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

    const select = document.getElementById('manual-redeem-store-select');
    select.innerHTML = '<option value="">-- 利用する酒場を選択してください --</option>' +
      couponStores.map(s => {
        const isUsedInThisStore = userUsedStoreIds.has(s.id);
        if (isUsedInThisStore) {
          return `<option value="${s.id}" disabled style="color:#94a3b8;">🍺 [${s.id}] ${this.escapeHtml(s.name)} (${this.escapeHtml(s.area || '')}) ※利用済</option>`;
        }
        return `<option value="${s.id}">🍺 [${s.id}] ${this.escapeHtml(s.name)} (${this.escapeHtml(s.area || '')})</option>`;
      }).join('');

    modal.style.display = 'flex';
  }

  closeManualRedeemModal() {
    const modal = document.getElementById('manual-redeem-modal');
    if (modal) modal.style.display = 'none';
  }

  async submitManualRedeem() {
    const couponId = document.getElementById('manual-redeem-coupon-id').value;
    const tierId = document.getElementById('manual-redeem-tier-id')?.value;
    const storeId = document.getElementById('manual-redeem-store-select').value;

    if (!storeId) {
      alert('利用する酒場を選択してください。');
      return;
    }

    const coupon = (this.coupons || []).find(c => String(c.id) === String(couponId));
    const store = (this.stores || []).find(s => s.id === storeId);
    const storeName = store ? store.name : storeId;
    const finalTierId = tierId || coupon?.reward_tier_id;

    try {
      this.showToast(`酒場「${storeName}」で消込中...`);
      await this.api.adminUpdateCouponStatus(couponId, 'used', new Date().toISOString(), storeId, finalTierId);
      this.closeManualRedeemModal();
      this.showToast(`酒場「${storeName}」でクーポンを消込（使用済）にしました！`);
      await this.loadAllData();
      if (coupon && document.getElementById('participant-detail-modal')?.style.display === 'flex') {
        this.openParticipantDetailModal(coupon.user_id);
      }
    } catch (err) {
      alert('消込に失敗しました: ' + err.message);
    }
  }

  // クーポンステータス変更 (未使用 ⇔ 利用済)
  async updateCouponStatus(couponId, newStatus, usedAt = null, storeId = null) {
    const coupon = (this.coupons || []).find(c => String(c.id) === String(couponId));
    try {
      this.showToast('状態を更新中...');
      await this.api.adminUpdateCouponStatus(couponId, newStatus, usedAt, storeId, coupon?.reward_tier_id);
      this.showToast(`状態を【${newStatus === 'used' ? '利用済' : '未使用'}】に変更しました`);
      await this.loadAllData();
      if (coupon && document.getElementById('participant-detail-modal')?.style.display === 'flex') {
        this.openParticipantDetailModal(coupon.user_id);
      }
    } catch (err) {
      alert('更新に失敗しました: ' + err.message);
    }
  }

  // 特典（Tier）単位での獲得取消・未獲得リセット
  async confirmRevokeUserRewardTier(userId, tierId, tierTitle) {
    const user = (this.users || []).find(u => u.line_user_id === userId);
    const userName = user ? user.display_name : userId;

    if (!confirm(`⚠️ 【確認】冒険者「${userName}」の特典【${tierTitle}】の獲得を取り消しますか？\n\n※この特典に紐づくすべてのクーポン枠（または記念品）データが削除され、未獲得（解放前）の状態に戻ります。\n※よろしければ「OK」を押してください。`)) {
      return;
    }

    try {
      this.showToast('特典の獲得を取り消し中...');
      await this.api.adminRevokeUserRewardTier(userId, tierId, this.selectedSeasonId);
      this.showToast(`【${tierTitle}】の獲得を取り消し、未獲得に戻しました。`);
      await this.loadAllData();
      if (document.getElementById('participant-detail-modal')?.style.display === 'flex') {
        this.openParticipantDetailModal(userId);
      }
    } catch (err) {
      alert('取消に失敗しました: ' + err.message);
    }
  }

  exportCurrentTableToCSV() {
    let filename = `yoidore_season${this.selectedSeasonId}_${this.activeLogSubTab}_${new Date().toISOString().slice(0, 10)}.csv`;
    let csvContent = '\uFEFF';

    if (this.activeLogSubTab === 'users') {
      csvContent += 'LINE_User_ID,表示名,獲得特典一覧,酒場クーポン総枠数,酒場クーポン利用済数,酒場クーポン残枠数,記念品グッズ総数,記念品グッズ受取済数,消込店舗一覧,参加登録日時,最終アクセス\n';
      this.users.forEach(u => {
        const userCoupons = (this.coupons || []).filter(c => c.user_id === u.line_user_id);
        const unlockedTierIds = Array.from(new Set(userCoupons.map(c => Number(c.reward_tier_id)).filter(Boolean)));
        const unlockedTiers = (this.tiers || []).filter(t => unlockedTierIds.includes(Number(t.id)));
        const rewardsSummary = unlockedTiers.map(t => `${t.title}(${t.reward_type === 'goods' ? 'グッズ' : `${t.selectable_count || 5}枠`})`).join(' / ') || (userCoupons.length > 0 ? `${userCoupons.length}件` : '未獲得');

        const storeCoupons = userCoupons.filter(c => c.reward_type !== 'goods');
        const goodsCoupons = userCoupons.filter(c => c.reward_type === 'goods');
        const storeTotal = storeCoupons.length;
        const storeUsed = storeCoupons.filter(c => c.status === 'used').length;
        const storeRemaining = Math.max(0, storeTotal - storeUsed);
        const goodsTotal = goodsCoupons.length;
        const goodsUsed = goodsCoupons.filter(c => c.status === 'used').length;

        const usedStores = storeCoupons.filter(c => c.status === 'used').map(c => {
          const store = this.stores.find(s => s.id === c.store_id);
          return store ? store.name : c.store_id;
        }).join(';');

        csvContent += `"${u.line_user_id}","${(u.display_name || '').replace(/"/g, '""')}","${rewardsSummary.replace(/"/g, '""')}",${storeTotal},${storeUsed},${storeRemaining},${goodsTotal},${goodsUsed},"${usedStores.replace(/"/g, '""')}","${u.created_at || ''}","${u.last_active_at || ''}"\n`;
      });
    } else if (this.activeLogSubTab === 'coupons') {
      csvContent += '利用・受取日時,種別,シーズンID,LINE_User_ID,ユーザー名,酒場ID,酒場名/記念品名,状態\n';
      this.coupons.forEach(c => {
        const store = this.stores.find(s => s.id === c.store_id);
        const user = this.users.find(u => u.line_user_id === c.user_id);
        const isGoods = c.reward_type === 'goods';
        const typeStr = isGoods ? 'グッズ引換' : '酒場クーポン';
        const targetName = isGoods ? (c.goods_name || '記念品') : (store ? store.name : (c.store_id ? c.store_id : '（酒場未指定）'));
        const timeStr = c.used_at || c.acquired_at || '';
        csvContent += `"${timeStr}","${typeStr}",${c.season_id || this.selectedSeasonId},"${c.user_id}","${(user ? user.display_name : '').replace(/"/g, '""')}","${c.store_id || ''}","${targetName.replace(/"/g, '""')}","${c.status}"\n`;
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
   * 5. 運営店専用 特典達成QR・POP一括印刷
   * ------------------------------------------------------------------------ */
  renderPopTierSelect() {
    const sel = document.getElementById('pop-tier-select');
    if (!sel) return;
    const sortedTiers = [...(this.tiers || [])].sort((a, b) => (Number(a.required_visits || a.required_count) || 0) - (Number(b.required_visits || b.required_count) || 0));
    sel.innerHTML = `<option value="all">全マイルストーン特典POP（${sortedTiers.length}種）を一括印刷</option>`;
    sortedTiers.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      const req = t.required_visits ?? t.required_count ?? 0;
      opt.textContent = `【${req}軒達成】 ${t.title}`;
      sel.appendChild(opt);
    });
    this.renderPopCards();
  }

  filterPopCards() {
    const sel = document.getElementById('pop-tier-select');
    const tierId = sel ? sel.value : 'all';
    this.renderPopCards(tierId === 'all' ? null : tierId);
  }

  renderPopCards(targetTierId = null) {
    const container = document.getElementById('pop-cards-container');
    if (!container) return;

    const sortedTiers = [...(this.tiers || [])].sort((a, b) => (Number(a.required_visits || a.required_count) || 0) - (Number(b.required_visits || b.required_count) || 0));
    const tiers = targetTierId ? sortedTiers.filter(t => String(t.id) === String(targetTierId)) : sortedTiers;

    if (tiers.length === 0) {
      container.innerHTML = '<div class="empty-state text-muted py-4">設定されたマイルストーン特典データがありません。「シーズン・開催設定」で特典ランクを登録してください。</div>';
      return;
    }

    container.innerHTML = '';
    const liffId = this.api.liffId || '2011637649-WWv6pnTL';
    const currentSeason = this.seasons.find(s => s.id === this.selectedSeasonId) || this.api.currentSeason;
    const seasonTitle = currentSeason ? currentSeason.name : '大正酔いどれクエスト';

    tiers.forEach(tier => {
      const reqVisits = tier.required_visits ?? tier.required_count ?? 0;
      // LIFF経由または通常Web経由どちらでも動作する達成パラメータ
      const claimUrl = `https://liff.line.me/${liffId}?claim_tier=${tier.id}`;
      const card = document.createElement('div');
      card.className = 'pop-card';

      const isGoods = tier.reward_type === 'goods';
      const couponCount = tier.selectable_count || tier.coupon_count || 5;
      const rewardSummary = isGoods
        ? `🎁 記念品: ${this.escapeHtml(tier.goods_name || tier.title)}`
        : `🍺 酒場クーポン ${couponCount}枠`;

      card.innerHTML = `
        <div class="pop-event-header">
          <div class="pop-event-title">${this.escapeHtml(seasonTitle)}</div>
        </div>
        <div class="pop-tier-title">
          ${this.escapeHtml(tier.title)}
        </div>
        <div class="pop-reward-badge">
          ${rewardSummary}
        </div>
        <div class="pop-qr-wrapper" id="pop-qr-tier-${tier.id}"></div>
      `;

      container.appendChild(card);

      const qrElem = document.getElementById(`pop-qr-tier-${tier.id}`);
      if (qrElem && window.QRCode) {
        new window.QRCode(qrElem, {
          text: claimUrl,
          width: 260,
          height: 260,
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

// 初期化（DOM準備完了または即時実行）
function initAdminApp() {
  if (!window.adminApp) {
    window.adminApp = new YoidoreAdminApp();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdminApp);
} else {
  initAdminApp();
}
