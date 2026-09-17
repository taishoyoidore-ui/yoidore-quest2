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
   * LIFF 初期化 & ユーザー情報取得
   * ------------------------------------------------------------------------ */
  async initAuth() {
    // 1. LIFF SDK が読み込まれているか確認 (http/https 環境のみ実行)
    if (window.location.protocol.startsWith('http') && window.liff && this.liffId) {
      try {
        await window.liff.init({ liffId: this.liffId });
        this.isLiffReady = true;

        if (window.liff.isLoggedIn()) {
          const profile = await window.liff.getProfile();
          this.currentUser = {
            userId: profile.userId,
            displayName: profile.displayName || '名無しの冒険者',
            pictureUrl: profile.pictureUrl || ''
          };
          if (window.debugLog) window.debugLog('LINE LIFFログイン成功: ' + this.currentUser.displayName);
        } else if (window.liff.isInClient()) {
          // LINEアプリ内なら自動ログイン
          window.liff.login();
          return;
        }
      } catch (err) {
        if (window.debugLog) window.debugLog('LIFF初期化スキップ: ' + (err.message || err));
      }
    }

    // 2. LINE外ブラウザまたはローカル環境でのフォールバック
    if (!this.currentUser) {
      // ローカルストレージに保存済みのモックユーザーを取得、なければ作成
      let savedUser = null;
      try {
        savedUser = localStorage.getItem('yoidore_mock_user');
      } catch (e) {}

      if (savedUser) {
        try {
          this.currentUser = JSON.parse(savedUser);
        } catch (e) {
          this.currentUser = null;
        }
      }

      if (!this.currentUser) {
        const defaultUser = this.config.devMock?.defaultUser || {
          userId: 'mock-hero-' + Math.random().toString(36).substring(2, 8),
          displayName: '酔いどれ勇者タロウ',
          pictureUrl: 'assets/banner.png'
        };
        this.currentUser = defaultUser;
        try {
          localStorage.setItem('yoidore_mock_user', JSON.stringify(this.currentUser));
        } catch (e) {}
      }
      console.log('開発用モックユーザーで起動:', this.currentUser);
    }

    // 3. Supabaseのusersテーブルにユーザーを保存/更新
    await this.syncUserToDatabase();
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
          return {
            id: s.id,
            name: s.name,
            area: s.area || raw['エリア'] || '',
            category: raw['カテゴリ'] || '',
            style: raw['スタイル'] || '',
            type: raw['タイプ'] || raw['酔いどれタイプ'] || '',
            takeout: raw['テイクアウト'] || '',
            catchphrase: raw['キャッチコピー'] || '',
            days: raw['提供日'] ? raw['提供日'].split(',').map(d => d.trim()) : [],
            hours: raw['提供時間'] || '',
            payment: raw['決済方法'] || '',
            setName: raw['酔いどれセット名'] || '',
            setContent: raw['セット内容'] || '',
            price: raw['価格(円)'] || '',
            charge: raw['チャージ'] || 'なし',
            limit: raw['限定数'] || 'なし',
            notes: raw['セット備考'] || '',
            questTitle: raw['クエスト名'] || '',
            questContent: raw['クエスト内容'] || '',
            questPrice: raw['クエスト価格(円)'] || '',
            questCharge: raw['クエストチャージ'] || '',
            mapUrl: raw['Google Map URL'] || raw['google map url'] || '',
            instaUrl: raw['Instagram URL'] || raw['instagram url'] || '',
            photo: raw['photo'] || 'photo/' + s.id.replace('store-', '') + '.jpg',
            logo: raw['logo'] || 'logo/' + s.id.replace('store-', '') + '.png',
            isCouponTarget: Boolean(s.is_coupon_target),
            couponDescription: s.coupon_description || ''
          };
        });
        return this.stores;
      }
    } catch (e) {
      console.warn('Supabaseからの店舗取得に失敗したためローカルデータを使用します:', e);
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
