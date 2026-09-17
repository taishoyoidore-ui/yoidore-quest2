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
   * LIFF 初期化 & ユーザー情報取得 (LINEログイン 100% 必須)
   * ------------------------------------------------------------------------ */
  async initAuth() {
    // 1. LIFF SDK のロード待機（最大3秒）
    if (window.location.protocol.startsWith('http')) {
      let waitCount = 0;
      while (!window.liff && waitCount < 30) {
        await new Promise(r => setTimeout(r, 100));
        waitCount++;
      }
    }

    // 2. LIFF SDK による LINE ログイン実行
    if (window.liff && this.liffId) {
      try {
        await window.liff.init({ liffId: this.liffId });
        this.isLiffReady = true;

        if (window.liff.isLoggedIn()) {
          const profile = await window.liff.getProfile();
          this.currentUser = {
            userId: profile.userId,
            displayName: profile.displayName || '酔いどれ勇者',
            pictureUrl: profile.pictureUrl || ''
          };
          // 実際のLINEユーザー情報をローカルストレージにも安全に保存
          try {
            localStorage.setItem('yoidore_line_user', JSON.stringify(this.currentUser));
          } catch (e) {}
          if (window.debugLog) window.debugLog('LINE LIFFログイン成功: ' + this.currentUser.displayName);
        } else {
          // 未ログイン時はLINEログイン画面へリダイレクト
          window.liff.login();
          return;
        }
      } catch (err) {
        console.warn('LIFF初期化エラー:', err);
        if (window.debugLog) window.debugLog('LIFF初期化エラー: ' + (err.message || err));
      }
    }

    // 3. 通信遅延等のバックアップ（前回の本物のLINEログイン情報が存在する場合のみ復元）
    if (!this.currentUser) {
      try {
        const saved = localStorage.getItem('yoidore_line_user');
        if (saved) {
          this.currentUser = JSON.parse(saved);
        }
      } catch (e) {}
    }

    // 4. Supabaseのusersテーブルにユーザーを保存/更新
    if (this.currentUser) {
      await this.syncUserToDatabase();
    }
  }

  async syncUserToDatabase() {
    if (!this.currentUser) return;
    try {
      await this.supabaseFetch('users', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({
          line_user_id: this.currentUser.userId,
          display_name: this.currentUser.displayName,
          picture_url: this.currentUser.pictureUrl,
          last_active_at: new Date().toISOString()
        })
      });
    } catch (e) {
      console.warn('ユーザー同期に失敗（オフラインの可能性）:', e);
    }
  }

  /* ------------------------------------------------------------------------
   * 店舗マスタ取得 (Supabase -> Fallback to STORES.xlsx/data.js)
   * ------------------------------------------------------------------------ */
  async getStores() {
    try {
      const data = await this.supabaseFetch('stores?select=*&order=display_order.asc');
      if (Array.isArray(data) && data.length > 0) {
        // Supabaseのstoresをフロントエンドのデータ構造に正規化
        this.stores = data.map(s => {
          const raw = s.raw_data || {};
          const numId = s.id ? s.id.replace(/\D/g, '').padStart(3, '0') : '001';
          return {
            id: s.id,
            name: s.name,
            area: s.area || raw['エリア'] || '',
            category: raw['カテゴリ'] || raw['category'] || '',
            style: raw['スタイル'] || raw['style'] || '',
            type: raw['タイプ'] || raw['酔いどれタイプ'] || raw['type'] || '',
            takeout: raw['テイクアウト'] || (raw['isTakeout'] ? 'テイクアウトOK' : '不可'),
            isTakeout: Boolean(raw['isTakeout'] || raw['テイクアウト'] === 'テイクアウトOK' || raw['テイクアウト'] === '可'),
            isOpenToday: raw['isOpenToday'] !== false,
            isQuestActive: raw['isQuestActive'] !== false,
            isCouponTarget: s.is_coupon_target !== false,
            couponDescription: s.coupon_description || '',
            catchphrase: raw['キャッチコピー'] || raw['catchphrase'] || '',
            quest: raw.quest || {
              title: raw['クエスト名'] || raw['クエストタイトル'] || 'クエスト',
              price: Number(raw['クエスト価格'] || raw['クエスト価格(円)'] || 0),
              charge: raw['クエストチャージ'] || '不要',
              content: raw['クエスト内容'] || '',
              notes: raw['クエスト備考'] || ''
            },
            yoidoreSet: raw.yoidoreSet || {
              title: raw['酔いどれセット名'] || raw['セット名'] || '酔いどれセット',
              content: raw['セット内容'] || '',
              price: Number(raw['価格'] || raw['価格(円)'] || raw['セット価格'] || 0),
              charge: raw['チャージ'] || raw['チャージ有無'] || '不要',
              includeCharge: Boolean(raw['チャージ込']),
              notes: raw['セット備考'] || raw['備考'] || ''
            },
            conditions: raw.conditions || {
              days: raw['提供日'] || '全日',
              hours: raw['提供時間'] || '営業時間内',
              limit: raw['限定数'] || 'なし',
              soldOutEnd: Boolean(raw['売切終了'])
            },
            paymentMethods: Array.isArray(raw['paymentMethods']) ? raw['paymentMethods'] : (raw['決済方法'] ? String(raw['決済方法']).split(/[,、]/).map(p => p.trim()) : ['現金']),
            googleMapUrl: raw['googleMapUrl'] || raw['Google Map URL'] || raw['map_url'] || '',
            instagramUrl: raw['instagramUrl'] || raw['Instagram URL'] || raw['insta_url'] || '',
            photoUrl: raw['photoUrl'] || raw['photo'] || `photo/${numId}.jpg`,
            logoUrl: raw['logoUrl'] || raw['logo'] || `logo/${numId}.png`,
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
   * 特典ランク一覧取得
   * ------------------------------------------------------------------------ */
  async getRewardTiers() {
    try {
      const data = await this.supabaseFetch('reward_tiers?select=*&order=required_visits.asc');
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
   * ユーザーの来店ログ取得 (visits)
   * ------------------------------------------------------------------------ */
  async getUserVisits() {
    if (!this.currentUser) return [];
    try {
      const data = await this.supabaseFetch(`visits?user_id=eq.${encodeURIComponent(this.currentUser.userId)}&select=*&order=visited_at.desc`);
      if (Array.isArray(data)) {
        this.visits = data;
        return this.visits;
      }
    } catch (e) {
      console.warn('来店履歴の取得に失敗 (ローカルストレージを使用):', e);
    }
    try {
      const raw = localStorage.getItem('yoidore_visits');
      this.visits = raw ? JSON.parse(raw) : [];
    } catch (err) {
      this.visits = this.visits || [];
    }
    return this.visits;
  }

  /* ------------------------------------------------------------------------
   * 来店チェックイン実行 (QRコード読み取り時)
   * ------------------------------------------------------------------------ */
  async checkInStore(storeId) {
    if (!this.currentUser) {
      await this.initAuth();
    }
    if (!storeId) return { success: false, message: '店舗IDが指定されていません' };

    // 既に訪問済みかチェック
    const existing = this.visits.find(v => v.store_id === storeId);
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
      console.warn('Supabaseチェックイン失敗のためローカル保存:', err);
      const newVisit = {
        id: `visit_${Date.now()}`,
        user_id: this.currentUser.userId,
        store_id: storeId,
        visited_at: new Date().toISOString()
      };
      this.visits = [newVisit, ...(this.visits || [])];
      try {
        localStorage.setItem('yoidore_visits', JSON.stringify(this.visits));
      } catch (e) {}
    }

    return {
      success: true,
      alreadyVisited: false,
      storeId,
      storeName,
      totalVisits: this.visits.length,
      message: `『${storeName}』を冒険の書に記録した！`
    };
  }

  /* ------------------------------------------------------------------------
   * ユーザーの獲得クーポン一覧取得 (user_coupons)
   * ------------------------------------------------------------------------ */
  async getUserCoupons() {
    if (!this.currentUser) return [];
    try {
      const data = await this.supabaseFetch(`user_coupons?user_id=eq.${encodeURIComponent(this.currentUser.userId)}&select=*,stores(*),reward_tiers(*)&order=acquired_at.desc`);
      if (Array.isArray(data)) {
        this.userCoupons = data;
        return this.userCoupons;
      }
    } catch (e) {
      console.warn('クーポン一覧の取得に失敗 (ローカルストレージを使用):', e);
    }
    try {
      const raw = localStorage.getItem('yoidore_coupons');
      this.userCoupons = raw ? JSON.parse(raw) : [];
    } catch (err) {
      this.userCoupons = this.userCoupons || [];
    }
    return this.userCoupons;
  }

  /* ------------------------------------------------------------------------
   * クーポン選択・獲得 (達成した特典から店舗を選んで保存)
   * ------------------------------------------------------------------------ */
  async claimCoupons(rewardTierId, selectedStoreIds) {
    if (!this.currentUser) return { success: false, message: 'ログインしていません' };
    if (!selectedStoreIds || selectedStoreIds.length === 0) {
      return { success: false, message: '店舗が選択されていません' };
    }

    const insertRows = selectedStoreIds.map((storeId, idx) => {
      const store = (this.stores && this.stores.find(s => s.id === storeId)) ||
                    (window.STORES_DATA && window.STORES_DATA.find(s => s.id === storeId));
      return {
        id: `coupon_${Date.now()}_${idx}`,
        user_id: this.currentUser.userId,
        store_id: storeId,
        reward_tier_id: rewardTierId,
        status: 'active',
        acquired_at: new Date().toISOString(),
        stores: store || { id: storeId, name: storeId }
      };
    });

    try {
      await this.supabaseFetch('user_coupons', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify(insertRows)
      });
      await this.getUserCoupons();
    } catch (err) {
      console.warn('Supabaseクーポン保存失敗のためローカル保存:', err);
      this.userCoupons = [...(this.userCoupons || []), ...insertRows];
      try {
        localStorage.setItem('yoidore_coupons', JSON.stringify(this.userCoupons));
      } catch (e) {}
    }

    return { success: true, count: selectedStoreIds.length };
  }

  /* ------------------------------------------------------------------------
   * クーポン消し込み（店舗スタッフ操作）
   * ------------------------------------------------------------------------ */
  async redeemCoupon(couponId) {
    if (!couponId) return { success: false, message: 'クーポンIDが指定されていません' };

    try {
      await this.supabaseFetch(`user_coupons?id=eq.${couponId}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({
          status: 'used',
          used_at: new Date().toISOString()
        })
      });
      await this.getUserCoupons();
    } catch (err) {
      console.warn('Supabase消し込み失敗のためローカル保存:', err);
      if (this.userCoupons) {
        const c = this.userCoupons.find(x => String(x.id) === String(couponId));
        if (c) {
          c.status = 'used';
          c.used_at = new Date().toISOString();
        }
        try {
          localStorage.setItem('yoidore_coupons', JSON.stringify(this.userCoupons));
        } catch (e) {}
      }
    }

    return { success: true };
  }

  /* ------------------------------------------------------------------------
   * テスト用データリセット
   * ------------------------------------------------------------------------ */
  resetMockData() {
    this.visits = [];
    this.userCoupons = [];
    try {
      localStorage.removeItem('yoidore_visits');
      localStorage.removeItem('yoidore_coupons');
    } catch (e) {}
  }
}

// グローバルインスタンス
window.questApi = new QuestApiManager();
