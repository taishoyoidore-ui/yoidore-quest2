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
      await this.supabaseFetch('users', {
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
      console.warn('シーズン情報の取得に失敗（デフォルトを使用）:', e);
    }

    const now = new Date();
    const startDate = new Date(this.currentSeason.start_date || '2026-08-01');
    const endDate = new Date(this.currentSeason.end_date || '2026-08-31');
    // 終了日の23:59:59まで有効
    endDate.setHours(23, 59, 59, 999);

    const couponValidUntil = new Date(this.currentSeason.coupon_valid_until || '2026-09-30');
    couponValidUntil.setHours(23, 59, 59, 999);

    const isEventActive = now >= startDate && now <= endDate;
    const isCouponActive = now <= couponValidUntil;
    const isExpired = now > couponValidUntil;

    // 残り日数計算
    const diffTime = couponValidUntil.getTime() - now.getTime();
    const daysLeft = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    this.currentSeason.statusInfo = {
      now,
      startDate,
      endDate,
      couponValidUntil,
      isEventActive,
      isCouponActive,
      isExpired,
      daysLeft
    };

    return this.currentSeason;
  }

  async getSeasons() {
    try {
      const data = await this.supabaseFetch('seasons?select=*&order=id.desc');
      if (Array.isArray(data)) {
        this.seasons = data;
        return this.seasons;
      }
    } catch (e) {
      console.warn('シーズン一覧の取得に失敗:', e);
    }
    this.seasons = [this.currentSeason];
    return this.seasons;
  }

  /* ------------------------------------------------------------------------
   * リピーター（歴戦の古参勇者）判定
   * ------------------------------------------------------------------------ */
  async checkIsVeteranUser() {
    if (!this.currentUser) return { isVeteran: false, previousVisitsCount: 0 };
    try {
      // 過去シーズン(現在シーズン未満)の来店を検索
      const currentSeasonId = this.currentSeason?.id || 2;
      const data = await this.supabaseFetch(`visits?user_id=eq.${encodeURIComponent(this.currentUser.userId)}&season_id=lt.${currentSeasonId}&select=id`);
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
   * 特典ランク一覧取得
   * ------------------------------------------------------------------------ */
  async getRewardTiers(seasonId = null) {
    const targetSeasonId = seasonId !== null ? seasonId : (this.currentSeason?.id || 2);
    try {
      const data = await this.supabaseFetch(`reward_tiers?season_id=eq.${targetSeasonId}&select=*&order=required_visits.asc`);
      if (Array.isArray(data) && data.length > 0) {
        this.rewardTiers = data;
        return this.rewardTiers;
      }
    } catch (e) {
      console.warn('特典ランクの取得に失敗:', e);
    }
    this.rewardTiers = this.config.fallbackRewardTiers || [];
    return this.rewardTiers;
  }

  /* ------------------------------------------------------------------------
   * 勇者レベル・称号マスタ一覧取得
   * ------------------------------------------------------------------------ */
  async getHeroTitles() {
    try {
      const data = await this.supabaseFetch('hero_titles?select=*&order=min_visits.asc');
      if (Array.isArray(data) && data.length > 0) {
        this.heroTitles = data;
        return this.heroTitles;
      }
    } catch (e) {
      console.warn('称号マスタの取得に失敗 (フォールバックを使用):', e);
    }

    try {
      const local = localStorage.getItem('yoidore_hero_titles');
      if (local) {
        this.heroTitles = JSON.parse(local);
        return this.heroTitles;
      }
    } catch (e) {}

    this.heroTitles = this.config.fallbackHeroTitles || [];
    return this.heroTitles;
  }

  /* ------------------------------------------------------------------------
   * ユーザーの来店ログ取得 (visits)
   * ------------------------------------------------------------------------ */
  async getUserVisits() {
    if (!this.currentUser || !this.currentUser.userId) return [];
    const seasonId = this.currentSeason?.id || 2;
    try {
      const data = await this.supabaseFetch(`visits?user_id=eq.${encodeURIComponent(this.currentUser.userId)}&season_id=eq.${seasonId}&select=*&order=visited_at.desc`);
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
   * 来店チェックイン実行 (QRコード読み取り時)
   * ------------------------------------------------------------------------ */
  async checkInStore(storeId) {
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

    const seasonId = this.currentSeason?.id || 2;

    // 既に訪問済みかチェック
    const existing = (this.visits || []).find(v => v.store_id === storeId);
    if (existing) {
      return {
        success: false,
        alreadyVisited: true,
        storeId,
        message: 'この酒場はすでに冒険の書に記録済みです！'
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
          season_id: seasonId,
          visited_at: new Date().toISOString()
        })
      });
      await this.getUserVisits();
    } catch (err) {
      console.error('Supabaseチェックイン保存エラー:', err);
      return {
        success: false,
        message: 'チェックインの保存に失敗しました: ' + (err.message || '通信エラー')
      };
    }

    return {
      success: true,
      alreadyVisited: false,
      storeId,
      storeName,
      totalVisits: (this.visits || []).length,
      message: `『${storeName}』を冒険の書に記録した！`
    };
  }

  /* ------------------------------------------------------------------------
   * ユーザーの獲得クーポン一覧取得 (user_coupons)
   * ------------------------------------------------------------------------ */
  async getUserCoupons() {
    if (!this.currentUser || !this.currentUser.userId) return [];
    const seasonId = this.currentSeason?.id || 2;
    try {
      const data = await this.supabaseFetch(`user_coupons?user_id=eq.${encodeURIComponent(this.currentUser.userId)}&season_id=eq.${seasonId}&select=*,stores(*),reward_tiers(*)&order=acquired_at.desc`);
      if (Array.isArray(data)) {
        this.userCoupons = data;
        return this.userCoupons;
      }
    } catch (e) {
      console.error('Supabaseからのクーポン一覧取得エラー:', e);
    }
    return this.userCoupons || [];
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

    const seasonId = this.currentSeason?.id || 2;

    const dbRows = selectedStoreIds.map(storeId => {
      const row = {
        user_id: this.currentUser.userId,
        store_id: storeId,
        season_id: seasonId,
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
   * クーポン消し込み（店舗スタッフ操作）
   * ------------------------------------------------------------------------ */
  async redeemCoupon(couponId) {
    if (!couponId) return { success: false, message: 'クーポンIDが指定されていません' };

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
    return await this.supabaseFetch('seasons', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(seasonData)
    });
  }

  // アクティブシーズンの切り替え
  async adminSetActiveSeason(seasonId) {
    // 全てを一度非アクティブ化
    await this.supabaseFetch('seasons?id=neq.0', {
      method: 'PATCH',
      body: JSON.stringify({ is_active: false })
    });
    // 指定IDをアクティブ化
    await this.supabaseFetch(`seasons?id=eq.${seasonId}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: true })
    });
    await this.getCurrentSeason();
  }

  // 特典ランク (reward_tiers) の新規登録 / 更新
  async adminSaveRewardTier(tierData) {
    return await this.supabaseFetch('reward_tiers', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(tierData)
    });
  }

  // 特典ランクの削除
  async adminDeleteRewardTier(tierId) {
    return await this.supabaseFetch(`reward_tiers?id=eq.${encodeURIComponent(tierId)}`, { method: 'DELETE' });
  }

  // 勇者レベル・称号 (hero_titles) の新規登録 / 更新
  async adminSaveHeroTitle(titleData) {
    return await this.supabaseFetch('hero_titles', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(titleData)
    });
  }

  // 勇者称号の削除
  async adminDeleteHeroTitle(titleId) {
    return await this.supabaseFetch(`hero_titles?id=eq.${encodeURIComponent(titleId)}`, { method: 'DELETE' });
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
