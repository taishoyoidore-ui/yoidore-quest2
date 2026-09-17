/**
 * 大正酔いどれクエストⅡ - API & 認証 & Supabase通信マネージャー
 */

class QuestApiManager {
  constructor() {
    this.config = window.APP_CONFIG || {};
    this.supabaseUrl = this.config.supabase?.url || '';
    this.supabaseKey = this.config.supabase?.anonKey || '';
    this.liffId = this.config.liff?.id || '';
    
    this.currentUser = null;
    this.isLiffReady = false;
    this.isOfflineMode = false;
    
    // シーズン管理
    this.currentSeason = {
      id: 2,
      name: '大正酔いどれクエストⅡ',
      start_date: '2026-08-01',
      end_date: '2026-08-31',
      coupon_valid_until: '2026-09-30',
      is_active: true
    };
    this.seasons = [];
    
    // キャッシュ
    this.stores = [];
    this.visits = [];
    this.rewardTiers = [];
    this.userCoupons = [];
  }

  /* ------------------------------------------------------------------------
   * 共通 Supabase REST API 呼び出し
   * ------------------------------------------------------------------------ */
  async supabaseFetch(endpoint, options = {}) {
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error('Supabase configuration missing');
    }

    const headers = {
      'apikey': this.supabaseKey,
      'Authorization': `Bearer ${this.supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options.headers || {})
    };

    const url = `${this.supabaseUrl}/rest/v1/${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Supabase API error (${endpoint}):`, errText);
      throw new Error(`API Error: ${res.status} ${errText}`);
    }

    // 204 No Content の場合は空配列を返す
    if (res.status === 204) return [];
    return await res.json();
  }

  /* ------------------------------------------------------------------------
   * LIFF 初期化 & ユーザー情報取得 (LINE公式ログイン 100% 必須)
   * ------------------------------------------------------------------------ */
  async initAuth() {
    // 1. LIFF SDK のロード待機（最大3秒）
    let waitCount = 0;
    while (!window.liff && waitCount < 30) {
      await new Promise(r => setTimeout(r, 100));
      waitCount++;
    }

    if (!window.liff || !this.liffId) {
      console.error('LIFF SDK または LIFF ID が設定されていません');
      if (window.debugLog) window.debugLog('LIFF SDK または LIFF ID が未設定');
      return;
    }

    // 2. LIFF SDK による初期化 & LINE ログイン実行
    try {
      await window.liff.init({ liffId: this.liffId });
      this.isLiffReady = true;

      if (!window.liff.isLoggedIn()) {
        // 未ログイン時はLINE公式ログイン画面へ即時リダイレクト
        window.liff.login();
        return;
      }

      // 3. LINE公式プロフィール情報の取得
      const profile = await window.liff.getProfile();
      this.currentUser = {
        userId: profile.userId,
        displayName: profile.displayName || '酔いどれ勇者',
        pictureUrl: profile.pictureUrl || ''
      };

      if (window.debugLog) window.debugLog('LINE LIFFログイン成功: ' + this.currentUser.displayName + ' (' + this.currentUser.userId + ')');

      // 4. SupabaseのusersテーブルにLINEユーザー情報を確実に同期（UPSERT）
      await this.syncUserToDatabase();
    } catch (err) {
      console.error('LIFF初期化/LINEログインエラー:', err);
      if (window.debugLog) window.debugLog('LIFF初期化/LINEログインエラー: ' + (err.message || err));
    }
  }

  async syncUserToDatabase() {
    if (!this.currentUser || !this.currentUser.userId) return;
    try {
      await this.supabaseFetch('users?on_conflict=line_user_id', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({
          line_user_id: this.currentUser.userId,
          display_name: this.currentUser.displayName || '酔いどれ勇者',
          picture_url: this.currentUser.pictureUrl || '',
          last_active_at: new Date().toISOString()
        })
      });
    } catch (e) {
      console.error('ユーザー情報のSupabase同期に失敗:', e);
    }
  }

  /* ------------------------------------------------------------------------
   * 店舗マスタ取得 (Supabase -> Fallback to STORES.xlsx/data.js)
   * ------------------------------------------------------------------------ */
  async getStores() {
    try {
      const data = await this.supabaseFetch('stores?select=*&order=display_order.asc');
      if (Array.isArray(data) && data.length > 0) {
        const formatMediaUrl = (val, prefix, fallbackExt, numId) => {
          let target = val;
          if (!target) {
            return numId ? `${prefix}/${numId}.${fallbackExt}` : '';
          }
          target = String(target).trim();
          if (!target) {
            return numId ? `${prefix}/${numId}.${fallbackExt}` : '';
          }
          if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('/') || target.startsWith(`${prefix}/`)) {
            return target;
          }
          return `${prefix}/${target}`;
        };

        // Supabaseのstoresをフロントエンドのデータ構造に正規化
        this.stores = data.map(s => {
          const raw = s.raw_data || {};
          const numId = s.id ? s.id.replace(/\D/g, '').padStart(3, '0') : '001';
          const resolvedPhoto = formatMediaUrl(s.photo_url || raw['photoUrl'] || raw['photo'], 'photo', 'jpg', numId);
          const resolvedLogo = formatMediaUrl(s.logo_url || raw['logoUrl'] || raw['logo'], 'logo', 'png', numId);

          return {
            id: s.id,
            name: s.name,
            area: s.area || raw['エリア'] || '',
            category: s.category || raw['カテゴリ'] || raw['category'] || '',
            style: s.style || raw['スタイル'] || raw['style'] || '',
            type: s.yoidore_type || raw['タイプ'] || raw['酔いどれタイプ'] || raw['type'] || '',
            takeout: s.takeout !== undefined ? (s.takeout ? 'テイクアウトOK' : 'テイクアウト不可') : (raw['テイクアウト'] || (raw['isTakeout'] ? 'テイクアウトOK' : '不可')),
            isTakeout: s.takeout !== undefined ? Boolean(s.takeout) : Boolean(raw['isTakeout'] || raw['テイクアウト'] === 'テイクアウトOK' || raw['テイクアウト'] === '可'),
            isOpenToday: raw['isOpenToday'] !== false,
            isQuestActive: raw['isQuestActive'] !== false,
            isCouponTarget: s.is_coupon_target !== false,
            couponDescription: s.coupon_description || '',
            catchphrase: s.catchphrase || raw['キャッチコピー'] || raw['catchphrase'] || '',
            quest: {
              title: s.quest_name || raw.quest?.title || raw['クエスト名'] || raw['クエストタイトル'] || 'クエスト',
              price: s.quest_price !== undefined ? Number(s.quest_price) : Number(raw.quest?.price || raw['クエスト価格'] || raw['クエスト価格(円)'] || 0),
              charge: s.quest_charge || raw.quest?.charge || raw['クエストチャージ'] || '不要',
              content: s.quest_content || raw.quest?.content || raw['クエスト内容'] || '',
              notes: s.quest_notes || raw.quest?.notes || raw['クエスト備考'] || ''
            },
            yoidoreSet: {
              title: s.set_name || raw.yoidoreSet?.title || raw['酔いどれセット名'] || raw['セット名'] || '酔いどれセット',
              content: s.set_content || raw.yoidoreSet?.content || raw['セット内容'] || '',
              price: s.set_price !== undefined ? Number(s.set_price) : Number(raw.yoidoreSet?.price || raw['価格'] || raw['価格(円)'] || raw['セット価格'] || 0),
              charge: s.set_charge || raw.yoidoreSet?.charge || raw['チャージ'] || raw['チャージ有無'] || '不要',
              includeCharge: Boolean(s.set_charge === '込' || raw.yoidoreSet?.includeCharge || raw['チャージ込']),
              notes: s.set_notes || raw.yoidoreSet?.notes || raw['セット備考'] || raw['備考'] || ''
            },
            conditions: raw.conditions || {
              days: s.days || raw['提供日'] || '全日',
              hours: s.hours || raw['提供時間'] || '営業時間内',
              limit: s.set_limit || raw['限定数'] || 'なし',
              soldOutEnd: Boolean(raw['売切終了'])
            },
            paymentMethods: s.payment ? String(s.payment).split(/[,、]/).map(p => p.trim()) : (Array.isArray(raw['paymentMethods']) ? raw['paymentMethods'] : (raw['決済方法'] ? String(raw['決済方法']).split(/[,、]/).map(p => p.trim()) : ['現金'])),
            googleMapUrl: s.map_url || raw['googleMapUrl'] || raw['Google Map URL'] || raw['map_url'] || '',
            instagramUrl: s.insta_url || raw['instagramUrl'] || raw['Instagram URL'] || raw['insta_url'] || '',
            photoUrl: resolvedPhoto,
            photo_url: resolvedPhoto,
            logoUrl: resolvedLogo,
            logo_url: resolvedLogo,
            mapPos: raw.mapPos || { x: 50, y: 50 }
          };
        });
        if (window.debugLog) window.debugLog(`📡 Supabaseから店舗データ ${this.stores.length} 件を受信・同期完了！`);
        return this.stores;
      }
    } catch (e) {
      console.warn('Supabaseからの店舗取得に失敗したためローカルデータを使用します:', e);
      if (window.debugLog) window.debugLog('⚠️ Supabase店舗取得失敗（ローカルデータ利用）: ' + e.message);
    }

    // フォールバック: 既存の window.TAISHO_STORES
    if (window.TAISHO_STORES && window.TAISHO_STORES.length > 0) {
      this.stores = window.TAISHO_STORES;
      return this.stores;
    }
    return [];
  }

  /* ------------------------------------------------------------------------
   * シーズン情報取得 & 開催状態判定
   * ------------------------------------------------------------------------ */
  async getCurrentSeason() {
    try {
      const data = await this.supabaseFetch('seasons?is_active=eq.true&select=*&limit=1');
      if (Array.isArray(data) && data.length > 0) {
        this.currentSeason = data[0];
      }
    } catch (e) {
      // Supabaseにseasonsテーブルが無い場合はlocalStorageから最新データを取得
      try {
        const local = localStorage.getItem('yoidore_current_season');
        if (local) {
          const parsed = JSON.parse(local);
          if (parsed && parsed.name) {
            this.currentSeason = { ...this.currentSeason, ...parsed };
          }
        }
      } catch (err) {}
    }

    const now = new Date();
    const startDate = new Date(this.currentSeason.start_date || '2026-08-01');
    const endDate = new Date(this.currentSeason.end_date || '2026-08-31');
    endDate.setHours(23, 59, 59, 999);

    // クーポン利用開始日（本開催終了翌日 00:00:00）
    const couponStartDate = new Date(this.currentSeason.end_date || '2026-08-31');
    couponStartDate.setDate(couponStartDate.getDate() + 1);
    couponStartDate.setHours(0, 0, 0, 0);

    const pad = n => String(n).padStart(2, '0');
    const couponStartDateStr = `${couponStartDate.getFullYear()}-${pad(couponStartDate.getMonth() + 1)}-${pad(couponStartDate.getDate())}`;

    const couponValidUntil = new Date(this.currentSeason.coupon_valid_until || '2026-09-30');
    couponValidUntil.setHours(23, 59, 59, 999);

    const isBeforeEvent = now < startDate;
    const isEventActive = now >= startDate && now <= endDate; // 本開催中（サイン受取・宝箱解放）
    const isCouponUsable = now >= couponStartDate && now <= couponValidUntil; // クーポン利用可能期間（本開催終了翌日〜有効期限）
    const isCouponActive = now <= couponValidUntil; // クーポン期限内（獲得・所持可能期間）
    const isExpired = now > couponValidUntil; // 全期間終了

    const diffTime = couponValidUntil.getTime() - now.getTime();
    const daysLeft = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    this.currentSeason.statusInfo = {
      now,
      startDate,
      endDate,
      couponStartDate,
      couponStartDateStr,
      couponValidUntil,
      isBeforeEvent,
      isEventActive,
      isCouponUsable,
      isCouponActive,
      isExpired,
      daysLeft
    };

    return this.currentSeason;
  }

  async getSeasons() {
    try {
      const data = await this.supabaseFetch('seasons?select=*&order=id.desc');
      if (Array.isArray(data) && data.length > 0) {
        this.seasons = data;
        return this.seasons;
      }
    } catch (e) {
      try {
        const local = localStorage.getItem('yoidore_seasons');
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.seasons = parsed;
          }
        }
      } catch (err) {}
    }

    if (!Array.isArray(this.seasons) || this.seasons.length === 0) {
      this.seasons = [{ ...this.currentSeason }];
    }

    // 常に最新のcurrentSeasonをseasons配列内に同期
    if (this.currentSeason && this.currentSeason.id) {
      const currentIdx = this.seasons.findIndex(s => s.id === this.currentSeason.id);
      if (currentIdx >= 0) {
        this.seasons[currentIdx] = { ...this.seasons[currentIdx], ...this.currentSeason };
      } else {
        this.seasons.unshift({ ...this.currentSeason });
      }
    }

    try {
      localStorage.setItem('yoidore_seasons', JSON.stringify(this.seasons));
    } catch (err) {}

    return this.seasons;
  }

  /* ------------------------------------------------------------------------
   * リピーター（歴戦の古参勇者）判定
   * ------------------------------------------------------------------------ */
  async checkIsVeteranUser() {
    if (!this.currentUser) return { isVeteran: false, previousVisitsCount: 0 };
    try {
      const currentSeasonId = this.currentSeason?.id || 2;
      const data = await this.supabaseFetch(`visits?user_id=eq.${encodeURIComponent(this.currentUser.userId)}&select=id`);
      const count = Array.isArray(data) ? data.length : 0;
      return {
        isVeteran: count > 0,
        previousVisitsCount: count
      };
    } catch (e) {
      return { isVeteran: false, previousVisitsCount: 0 };
    }
  }

  /* ------------------------------------------------------------------------
   * 特典ランク一覧取得 (Supabaseデータベース最優先)
   * ------------------------------------------------------------------------ */
  async getRewardTiers(seasonId = null) {
    let localTiers = [];
    try {
      const local = localStorage.getItem('yoidore_reward_tiers');
      if (local) localTiers = JSON.parse(local) || [];
    } catch (err) {}

    if (localTiers.length === 0 && this.config.fallbackRewardTiers) {
      localTiers = [...this.config.fallbackRewardTiers];
    }

    let deletedIds = [];
    try {
      const del = localStorage.getItem('yoidore_deleted_tier_ids');
      if (del) deletedIds = (JSON.parse(del) || []).map(Number);
    } catch (err) {}

    // store-01 の raw_data._system_reward_tiers からの補完データ取得
    let sharedTiers = [];
    try {
      const s1 = (this.stores || []).find(s => s.id === 'store-01');
      if (s1 && s1.raw_data && Array.isArray(s1.raw_data._system_reward_tiers)) {
        sharedTiers = s1.raw_data._system_reward_tiers;
      }
    } catch (e) {}

    try {
      const data = await this.supabaseFetch('reward_tiers?select=*&order=required_visits.asc');
      if (Array.isArray(data) && data.length > 0) {
        const mergedMap = new Map();

        // 1. まずローカル設定・初期フォールバックをマップにセット
        localTiers.forEach(t => {
          const key = Number(t.id);
          if (!deletedIds.includes(key)) {
            mergedMap.set(key, { ...t, id: key });
          }
        });

        // 2. store-01経由の共有設定で上書き・補完
        sharedTiers.forEach(t => {
          const key = Number(t.id);
          if (!deletedIds.includes(key)) {
            mergedMap.set(key, { ...(mergedMap.get(key) || {}), ...t, id: key });
          }
        });

        // 3. Supabaseのreward_tiersテーブルデータをマージ
        data.forEach(s => {
          const key = Number(s.id);
          if (!deletedIds.includes(key)) {
            const existing = mergedMap.get(key) || {};
            mergedMap.set(key, {
              id: key,
              reward_type: s.reward_type || existing.reward_type || 'store_coupon',
              title: s.title || existing.title,
              required_visits: Number(s.required_visits || existing.required_visits),
              selectable_count: Number(s.selectable_count || existing.selectable_count) || 1,
              goods_name: s.goods_name || existing.goods_name || null,
              exchange_location: s.exchange_location || existing.exchange_location || null,
              exchange_notice: s.exchange_notice || existing.exchange_notice || null,
              description: s.description || existing.description || ''
            });
          }
        });

        this.rewardTiers = Array.from(mergedMap.values()).sort((a, b) => (a.required_visits || 0) - (b.required_visits || 0));

        try {
          localStorage.setItem('yoidore_reward_tiers', JSON.stringify(this.rewardTiers));
        } catch (e) {}

        return this.rewardTiers;
      }
    } catch (e) {
      console.warn('特典ランクのSupabase取得失敗 (ローカルキャッシュを使用):', e);
    }

    // Supabase通信失敗時のフォールバック処理
    const fallbackMap = new Map();
    localTiers.forEach(t => {
      const key = Number(t.id);
      if (!deletedIds.includes(key)) fallbackMap.set(key, t);
    });
    sharedTiers.forEach(t => {
      const key = Number(t.id);
      if (!deletedIds.includes(key)) fallbackMap.set(key, { ...(fallbackMap.get(key) || {}), ...t });
    });

    this.rewardTiers = Array.from(fallbackMap.values()).sort((a, b) => (a.required_visits || 0) - (b.required_visits || 0));
    return this.rewardTiers;
  }

  /* ------------------------------------------------------------------------
   * 勇者レベル・称号マスタ一覧取得
   * ------------------------------------------------------------------------ */
  async getHeroTitles() {
    let localTitles = [];
    try {
      const local = localStorage.getItem('yoidore_hero_titles');
      if (local) localTitles = JSON.parse(local) || [];
    } catch (err) {}

    if (localTitles.length === 0 && this.config.fallbackHeroTitles) {
      localTitles = [...this.config.fallbackHeroTitles];
    }

    let deletedIds = [];
    try {
      const del = localStorage.getItem('yoidore_deleted_hero_ids');
      if (del) deletedIds = JSON.parse(del) || [];
    } catch (err) {}

    try {
      const data = await this.supabaseFetch('hero_titles?select=*&order=min_visits.asc');
      if (Array.isArray(data) && data.length > 0) {
        const mergedMap = new Map();
        localTitles.forEach(t => {
          const key = Number(t.id) || t.level;
          if (!deletedIds.includes(t.id) && !deletedIds.includes(String(t.id))) {
            mergedMap.set(key, t);
          }
        });
        data.forEach(s => {
          const key = Number(s.id) || s.level;
          if (!deletedIds.includes(s.id) && !deletedIds.includes(String(s.id))) {
            mergedMap.set(key, { ...(mergedMap.get(key) || {}), ...s });
          }
        });
        this.heroTitles = Array.from(mergedMap.values()).sort((a, b) => (a.min_visits || 0) - (b.min_visits || 0));
        try {
          localStorage.setItem('yoidore_hero_titles', JSON.stringify(this.heroTitles));
        } catch (e) {}
        return this.heroTitles;
      }
    } catch (e) {}

    this.heroTitles = localTitles.filter(t => !deletedIds.includes(t.id) && !deletedIds.includes(String(t.id))).sort((a, b) => (a.min_visits || 0) - (b.min_visits || 0));
    return this.heroTitles;
  }

  /* ------------------------------------------------------------------------
   * ユーザーの来店ログ取得 (visits)
   * ------------------------------------------------------------------------ */
  async getUserVisits() {
    if (!this.currentUser || !this.currentUser.userId) return [];
    try {
      const data = await this.supabaseFetch(`visits?user_id=eq.${encodeURIComponent(this.currentUser.userId)}&select=*&order=visited_at.desc`);
      if (Array.isArray(data)) {
        this.visits = data;
        return this.visits;
      }
    } catch (e) {
      console.error('Supabaseからの来店履歴取得エラー:', e);
    }
    return this.visits || [];
  }

  /* ------------------------------------------------------------------------
   * 店主サインの受取・冒険の書への記録実行 (QRコード読み取り時)
   * ------------------------------------------------------------------------ */
  async recordVisit(storeId) {
    if (!this.currentUser || !this.currentUser.userId) {
      await this.initAuth();
    }
    if (!this.currentUser || !this.currentUser.userId) {
      return {
        success: false,
        message: 'LINEログインが必要です。LINE公式アカウントまたはLINEアプリ内からアクセスしてください。'
      };
    }
    if (!storeId) return { success: false, message: '店舗IDが指定されていません' };

    // 既にハシゴ済みかチェック
    const existing = (this.visits || []).find(v => v.store_id === storeId);
    if (existing) {
      return {
        success: false,
        alreadyVisited: true,
        storeId,
        message: 'この酒場の店主サインはすでに冒険の書に記録済みです！'
      };
    }

    const store = (this.stores && this.stores.find(s => s.id === storeId)) ||
                  (window.STORES_DATA && window.STORES_DATA.find(s => s.id === storeId));
    const storeName = store ? store.name : storeId;

    try {
      // 外部キー制約のためユーザーを確実に同期
      await this.syncUserToDatabase();
      await this.supabaseFetch('visits', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({
          user_id: this.currentUser.userId,
          store_id: storeId,
          visited_at: new Date().toISOString()
        })
      });
      await this.getUserVisits();
    } catch (err) {
      console.error('Supabaseサイン記録保存エラー:', err);
      return {
        success: false,
        message: 'サイン記録の保存に失敗しました: ' + (err.message || '通信エラー')
      };
    }

    return {
      success: true,
      alreadyVisited: false,
      storeId,
      storeName,
      totalVisits: (this.visits || []).length,
      message: `『${storeName}』の店主サインを冒険の書に記録した！`
    };
  }

  // 互換用
  async checkInStore(storeId) {
    return this.recordVisit(storeId);
  }

  /* ------------------------------------------------------------------------
   * 🧪 開発・テスト用: 指定店舗数の一括サイン受取・記録実行
   * ------------------------------------------------------------------------ */
  async recordMultipleVisitsForTest(targetCount = 5) {
    if (!this.currentUser || !this.currentUser.userId) {
      return { success: false, message: 'ユーザー情報が見つかりません。' };
    }

    const allStores = (this.stores && this.stores.length > 0) ? this.stores : (window.STORES_DATA || []);
    const visitedStoreIds = new Set((this.visits || []).map(v => v.store_id));
    const unvisitedStores = allStores.filter(s => !visitedStoreIds.has(s.id));

    if (unvisitedStores.length === 0) {
      return { success: false, message: 'すべての参加店舗のサイン受取・記録が完了しています。' };
    }

    const storesToAdd = unvisitedStores.slice(0, targetCount);
    const now = new Date();

    const insertRows = storesToAdd.map((s, idx) => ({
      user_id: this.currentUser.userId,
      store_id: s.id,
      visited_at: new Date(now.getTime() - (storesToAdd.length - 1 - idx) * 60000).toISOString()
    }));

    try {
      await this.syncUserToDatabase();
      await this.supabaseFetch('visits', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify(insertRows)
      });
      await this.getUserVisits();
      return {
        success: true,
        count: insertRows.length,
        stores: storesToAdd.map(s => s.name),
        totalVisits: (this.visits || []).length
      };
    } catch (err) {
      console.error('一括サイン記録保存エラー:', err);
      return {
        success: false,
        message: '一括サイン記録の保存に失敗しました: ' + (err.message || '通信エラー')
      };
    }
  }

  /* ------------------------------------------------------------------------
   * 🧪 開発・テスト用: 自身の来店履歴・クーポン履歴のリセット
   * ------------------------------------------------------------------------ */
  async resetUserVisitsAndCouponsForTest() {
    if (!this.currentUser || !this.currentUser.userId) {
      return { success: false, message: 'ユーザー情報が見つかりません。' };
    }

    const uid = this.currentUser.userId;
    try {
      await this.supabaseFetch(`visits?user_id=eq.${encodeURIComponent(uid)}`, { method: 'DELETE' });
      await this.supabaseFetch(`user_coupons?user_id=eq.${encodeURIComponent(uid)}`, { method: 'DELETE' });
      localStorage.removeItem(`yoidore_goods_vouchers_${uid}`);
      this.visits = [];
      this.userCoupons = [];
      await this.getUserVisits();
      await this.getUserCoupons();
      return { success: true };
    } catch (err) {
      console.error('テストデータリセットエラー:', err);
      return { success: false, message: 'リセットに失敗しました: ' + (err.message || '通信エラー') };
    }
  }

  /* ------------------------------------------------------------------------
   * ユーザーの獲得クーポン・グッズ引換券一覧取得 (user_coupons & local goods)
   * ------------------------------------------------------------------------ */
  async getUserCoupons() {
    if (!this.currentUser || !this.currentUser.userId) return [];
    let coupons = [];
    try {
      const data = await this.supabaseFetch(`user_coupons?user_id=eq.${encodeURIComponent(this.currentUser.userId)}&select=*,stores(*),reward_tiers(*)&order=acquired_at.desc`);
      if (Array.isArray(data)) {
        coupons = data;
      }
    } catch (e) {
      console.error('Supabaseからのクーポン一覧取得エラー:', e);
    }

    // グッズ引換券（ローカル永続化分）の統合
    try {
      const localGoodsKey = `yoidore_goods_vouchers_${this.currentUser.userId}`;
      const localGoods = JSON.parse(localStorage.getItem(localGoodsKey) || '[]');
      if (Array.isArray(localGoods) && localGoods.length > 0) {
        coupons = [...localGoods, ...coupons];
      }
    } catch (e) {}

    this.userCoupons = coupons;
    return this.userCoupons;
  }

  /* ------------------------------------------------------------------------
   * クーポン選択・獲得 (達成した特典から店舗を選んで保存)
   * ------------------------------------------------------------------------ */
  async claimCoupons(rewardTierId, selectedStoreIds) {
    if (!this.currentUser || !this.currentUser.userId) {
      return { success: false, message: 'LINEログインが必要です' };
    }
    if (!selectedStoreIds || selectedStoreIds.length === 0) {
      return { success: false, message: '店舗が選択されていません' };
    }

    const dbRows = selectedStoreIds.map(storeId => {
      const row = {
        user_id: this.currentUser.userId,
        store_id: storeId,
        status: 'active',
        acquired_at: new Date().toISOString()
      };
      if (rewardTierId && !isNaN(Number(rewardTierId))) {
        row.reward_tier_id = parseInt(rewardTierId, 10);
      }
      return row;
    });

    try {
      await this.syncUserToDatabase();
      await this.supabaseFetch('user_coupons', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify(dbRows)
      });
      await this.getUserCoupons();
    } catch (err) {
      console.error('Supabaseクーポン保存エラー:', err);
      return {
        success: false,
        message: 'クーポンの保存に失敗しました: ' + (err.message || '通信エラー')
      };
    }

    return { success: true, count: selectedStoreIds.length };
  }

  /* ------------------------------------------------------------------------
   * グッズ・記念品引換券の即時獲得 (店舗選択不要)
   * ------------------------------------------------------------------------ */
  async claimGoodsReward(rewardTierId) {
    if (!this.currentUser || !this.currentUser.userId) {
      return { success: false, message: 'LINEログインが必要です' };
    }

    const tiers = await this.getRewardTiers();
    const tier = tiers.find(t => t.id === Number(rewardTierId) || String(t.id) === String(rewardTierId));

    const goodsVoucher = {
      id: `goods-${rewardTierId}-${Date.now()}`,
      user_id: this.currentUser.userId,
      reward_tier_id: parseInt(rewardTierId, 10) || null,
      reward_type: 'goods',
      goods_name: tier?.goods_name || tier?.title || 'オリジナル記念グッズ',
      exchange_location: tier?.exchange_location || '全参加店舗または運営本部にて引換可能',
      exchange_notice: tier?.exchange_notice || '※お会計時またはご注文時に引換画面をスタッフへご提示ください。',
      title: tier?.title || 'ハシゴ達成記念グッズ引換券',
      description: tier?.description || '',
      status: 'active',
      acquired_at: new Date().toISOString()
    };

    try {
      const localGoodsKey = `yoidore_goods_vouchers_${this.currentUser.userId}`;
      const currentList = JSON.parse(localStorage.getItem(localGoodsKey) || '[]');
      if (currentList.some(v => Number(v.reward_tier_id) === Number(rewardTierId))) {
        return { success: false, message: '既にこのグッズ引換券は獲得済みです。' };
      }
      currentList.unshift(goodsVoucher);
      localStorage.setItem(localGoodsKey, JSON.stringify(currentList));
      await this.getUserCoupons();
      return { success: true, goods: goodsVoucher };
    } catch (e) {
      return { success: false, message: 'グッズ引換券の発行に失敗しました: ' + e.message };
    }
  }

  /* ------------------------------------------------------------------------
   * クーポン・引換券の消し込み（店舗・運営スタッフ操作）
   * ------------------------------------------------------------------------ */
  async redeemCoupon(couponId) {
    if (!couponId) return { success: false, message: 'クーポン・引換券IDが指定されていません' };

    // グッズ引換券の場合
    if (String(couponId).startsWith('goods-')) {
      try {
        const localGoodsKey = `yoidore_goods_vouchers_${this.currentUser.userId}`;
        const currentList = JSON.parse(localStorage.getItem(localGoodsKey) || '[]');
        const target = currentList.find(c => c.id === couponId);
        if (target) {
          target.status = 'used';
          target.used_at = new Date().toISOString();
          localStorage.setItem(localGoodsKey, JSON.stringify(currentList));
        }
        await this.getUserCoupons();
        return { success: true };
      } catch (e) {
        return { success: false, message: '引換券の消し込みに失敗しました: ' + e.message };
      }
    }

    try {
      await this.supabaseFetch(`user_coupons?id=eq.${encodeURIComponent(couponId)}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({
          status: 'used',
          used_at: new Date().toISOString()
        })
      });
      await this.getUserCoupons();
    } catch (err) {
      console.error('Supabaseクーポン消し込みエラー:', err);
      return {
        success: false,
        message: 'クーポンの消し込みに失敗しました: ' + (err.message || '通信エラー')
      };
    }

    return { success: true };
  }

  /* ------------------------------------------------------------------------
   * バックオフィス管理用 削除 & 更新 API
   * ------------------------------------------------------------------------ */
  // ユーザーの完全削除 (カスケードでvisits/couponsも削除)
  async adminDeleteUser(userId) {
    // 関連データの明示的クリーンアップ
    try {
      await this.supabaseFetch(`visits?user_id=eq.${encodeURIComponent(userId)}`, { method: 'DELETE' });
    } catch (e) {}
    try {
      await this.supabaseFetch(`user_coupons?user_id=eq.${encodeURIComponent(userId)}`, { method: 'DELETE' });
    } catch (e) {}
    return await this.supabaseFetch(`users?line_user_id=eq.${encodeURIComponent(userId)}`, { method: 'DELETE' });
  }

  // 来店ログの個別削除
  async adminDeleteVisit(visitId) {
    return await this.supabaseFetch(`visits?id=eq.${encodeURIComponent(visitId)}`, { method: 'DELETE' });
  }

  // クーポン記録の個別削除
  async adminDeleteCoupon(couponId) {
    return await this.supabaseFetch(`user_coupons?id=eq.${encodeURIComponent(couponId)}`, { method: 'DELETE' });
  }

  // クーポン状態の手動変更 (使用済み ⇔ 未使用)
  async adminUpdateCouponStatus(couponId, status, usedAt = null) {
    return await this.supabaseFetch(`user_coupons?id=eq.${encodeURIComponent(couponId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        used_at: status === 'used' ? (usedAt || new Date().toISOString()) : null
      })
    });
  }

  // シーズンの新規登録 / 更新
  async adminSaveSeason(seasonData) {
    if (!this.currentSeason) this.currentSeason = {};
    this.currentSeason = { ...this.currentSeason, ...seasonData };

    if (!Array.isArray(this.seasons)) {
      this.seasons = [{ ...this.currentSeason }];
    }
    const idx = this.seasons.findIndex(s => s.id === seasonData.id);
    if (idx >= 0) {
      this.seasons[idx] = { ...this.seasons[idx], ...seasonData };
    } else {
      this.seasons.unshift({ ...seasonData });
    }

    try {
      localStorage.setItem('yoidore_current_season', JSON.stringify(this.currentSeason));
      localStorage.setItem('yoidore_seasons', JSON.stringify(this.seasons));
    } catch (e) {}

    try {
      return await this.supabaseFetch('seasons', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify(seasonData)
      });
    } catch (err) {
      console.warn('Supabase seasons保存（ローカルストレージに保存済）:', err);
    }
  }

  // アクティブシーズンの切り替え
  async adminSetActiveSeason(seasonId) {
    if (Array.isArray(this.seasons)) {
      this.seasons.forEach(s => {
        s.is_active = (s.id === seasonId);
      });
      const active = this.seasons.find(s => s.id === seasonId);
      if (active) {
        this.currentSeason = { ...active, is_active: true };
      }
      try {
        localStorage.setItem('yoidore_seasons', JSON.stringify(this.seasons));
        localStorage.setItem('yoidore_current_season', JSON.stringify(this.currentSeason));
      } catch (e) {}
    }

    try {
      await this.supabaseFetch('seasons?id=neq.0', {
        method: 'PATCH',
        body: JSON.stringify({ is_active: false })
      });
      await this.supabaseFetch(`seasons?id=eq.${seasonId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: true })
      });
    } catch (e) {}
    await this.getCurrentSeason();
  }

  // 特典ランク (reward_tiers) の新規登録 / 更新
  async adminSaveRewardTier(tierData) {
    const cleanData = {
      reward_type: tierData.reward_type || 'store_coupon',
      title: tierData.title,
      required_visits: Number(tierData.required_visits),
      selectable_count: Number(tierData.selectable_count) || 1,
      goods_name: tierData.goods_name || null,
      exchange_location: tierData.exchange_location || null,
      exchange_notice: tierData.exchange_notice || null,
      description: tierData.description || ''
    };

    let targetId = tierData.id ? Number(tierData.id) : null;
    if (!targetId) {
      const maxId = (this.rewardTiers && this.rewardTiers.length > 0) ? 
        this.rewardTiers.reduce((max, t) => Math.max(max, Number(t.id) || 0), 0) : 2;
      targetId = maxId + 1;
    }
    cleanData.id = targetId;

    // 削除済みリストから復元（もしあれば）
    try {
      let deletedIds = JSON.parse(localStorage.getItem('yoidore_deleted_tier_ids') || '[]');
      deletedIds = deletedIds.filter(id => id !== targetId && String(id) !== String(targetId));
      localStorage.setItem('yoidore_deleted_tier_ids', JSON.stringify(deletedIds));
    } catch (e) {}

    // メモリキャッシュとlocalStorageに即座に反映
    if (!Array.isArray(this.rewardTiers)) this.rewardTiers = [];
    const idx = this.rewardTiers.findIndex(t => Number(t.id) === targetId);
    if (idx !== -1) {
      this.rewardTiers[idx] = { ...this.rewardTiers[idx], ...cleanData };
    } else {
      this.rewardTiers.push(cleanData);
    }
    this.rewardTiers.sort((a, b) => (a.required_visits || 0) - (b.required_visits || 0));

    try {
      localStorage.setItem('yoidore_reward_tiers', JSON.stringify(this.rewardTiers));
    } catch (e) {}

    // Supabaseへの書き込みを試行 & 全端末共有同期
    const supabaseClean = {
      season_id: Number(tierData.season_id) || 2,
      reward_type: cleanData.reward_type,
      title: cleanData.title,
      required_visits: cleanData.required_visits,
      selectable_count: cleanData.selectable_count,
      goods_name: cleanData.goods_name,
      exchange_location: cleanData.exchange_location,
      exchange_notice: cleanData.exchange_notice,
      description: cleanData.description
    };
    try {
      if (tierData.id) {
        await this.supabaseFetch(`reward_tiers?id=eq.${targetId}`, {
          method: 'PATCH',
          body: JSON.stringify(supabaseClean)
        });
      } else {
        await this.supabaseFetch('reward_tiers', {
          method: 'POST',
          body: JSON.stringify({ id: targetId, ...supabaseClean })
        });
      }
    } catch (e) {
      console.warn('Supabase reward_tiers拡張保存失敗、基本フィールドで再試行:', e);
      try {
        const basicClean = {
          title: cleanData.title,
          required_visits: cleanData.required_visits,
          selectable_count: cleanData.selectable_count,
          description: cleanData.description
        };
        if (tierData.id) {
          await this.supabaseFetch(`reward_tiers?id=eq.${targetId}`, {
            method: 'PATCH',
            body: JSON.stringify(basicClean)
          });
        } else {
          await this.supabaseFetch('reward_tiers', {
            method: 'POST',
            body: JSON.stringify({ id: targetId, ...basicClean })
          });
        }
      } catch (err2) {}
    }

    try {
      const s1 = (this.stores || []).find(s => s.id === 'store-01');
      const curRaw = (s1 && s1.raw_data) || {};
      await this.supabaseFetch('stores?id=eq.store-01', {
        method: 'PATCH',
        body: JSON.stringify({ raw_data: { ...curRaw, _system_reward_tiers: this.rewardTiers } })
      });
    } catch (e) {}

    return cleanData;
  }

  // 特典ランクの削除
  async adminDeleteRewardTier(tierId) {
    const numId = Number(tierId);
    try {
      let deletedIds = JSON.parse(localStorage.getItem('yoidore_deleted_tier_ids') || '[]');
      if (!deletedIds.includes(numId)) deletedIds.push(numId);
      localStorage.setItem('yoidore_deleted_tier_ids', JSON.stringify(deletedIds));
    } catch (e) {}

    this.rewardTiers = (this.rewardTiers || []).filter(t => Number(t.id) !== numId);
    try {
      localStorage.setItem('yoidore_reward_tiers', JSON.stringify(this.rewardTiers));
    } catch (e) {}

    try {
      await this.supabaseFetch(`reward_tiers?id=eq.${numId}`, {
        method: 'DELETE'
      });
    } catch (e) {}

    try {
      const s1 = (this.stores || []).find(s => s.id === 'store-01');
      const curRaw = (s1 && s1.raw_data) || {};
      await this.supabaseFetch('stores?id=eq.store-01', {
        method: 'PATCH',
        body: JSON.stringify({ raw_data: { ...curRaw, _system_reward_tiers: this.rewardTiers } })
      });
    } catch (e) {}

    return true;
  }

  // 勇者レベル・称号 (hero_titles) の新規登録 / 更新
  async adminSaveHeroTitle(titleData) {
    const cleanData = {
      level: Number(titleData.level),
      min_visits: Number(titleData.min_visits),
      title: titleData.title,
      badge_color: titleData.badge_color || '#facc15',
      display_order: Number(titleData.display_order || titleData.level),
      description: titleData.description || ''
    };

    let targetId = titleData.id ? Number(titleData.id) : null;
    if (!targetId) {
      const maxId = (this.heroTitles && this.heroTitles.length > 0) ? 
        this.heroTitles.reduce((max, t) => Math.max(max, Number(t.id) || 0), 0) : 0;
      targetId = maxId + 1;
    }
    cleanData.id = targetId;

    try {
      let deletedIds = JSON.parse(localStorage.getItem('yoidore_deleted_hero_ids') || '[]');
      deletedIds = deletedIds.filter(id => id !== targetId && String(id) !== String(targetId));
      localStorage.setItem('yoidore_deleted_hero_ids', JSON.stringify(deletedIds));
    } catch (e) {}

    if (!Array.isArray(this.heroTitles)) this.heroTitles = [];
    const idx = this.heroTitles.findIndex(t => Number(t.id) === targetId || t.level === cleanData.level);
    if (idx !== -1) {
      this.heroTitles[idx] = { ...this.heroTitles[idx], ...cleanData };
    } else {
      this.heroTitles.push(cleanData);
    }
    this.heroTitles.sort((a, b) => a.min_visits - b.min_visits);

    try {
      localStorage.setItem('yoidore_hero_titles', JSON.stringify(this.heroTitles));
    } catch (e) {}

    try {
      if (titleData.id) {
        await this.supabaseFetch(`hero_titles?id=eq.${targetId}`, {
          method: 'PATCH',
          body: JSON.stringify(cleanData)
        });
      } else {
        await this.supabaseFetch('hero_titles', {
          method: 'POST',
          body: JSON.stringify({ id: targetId, ...cleanData })
        });
      }
    } catch (e) {
      console.warn('Supabase hero_titles保存（ローカルに完全保存完了）:', e);
    }

    return cleanData;
  }

  // 勇者称号の削除
  async adminDeleteHeroTitle(titleId) {
    const numId = Number(titleId);
    try {
      let deletedIds = JSON.parse(localStorage.getItem('yoidore_deleted_hero_ids') || '[]');
      if (!deletedIds.includes(numId)) deletedIds.push(numId);
      localStorage.setItem('yoidore_deleted_hero_ids', JSON.stringify(deletedIds));
    } catch (e) {}

    this.heroTitles = (this.heroTitles || []).filter(t => Number(t.id) !== numId);
    try {
      localStorage.setItem('yoidore_hero_titles', JSON.stringify(this.heroTitles));
    } catch (e) {}

    try {
      await this.supabaseFetch(`hero_titles?id=eq.${encodeURIComponent(titleId)}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('Supabase hero_titles削除:', e);
    }
  }

  /* ------------------------------------------------------------------------
   * テスト用データリセット
   * ------------------------------------------------------------------------ */
  resetMockData() {
    this.visits = [];
    this.userCoupons = [];
    try {
      const seasonId = this.currentSeason?.id || 2;
      localStorage.removeItem(`yoidore_visits_s${seasonId}`);
      localStorage.removeItem(`yoidore_coupons_s${seasonId}`);
    } catch (e) {}
  }
}

// グローバルインスタンス
window.questApi = new QuestApiManager();
