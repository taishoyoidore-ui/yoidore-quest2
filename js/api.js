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
          const resolvedPhoto = formatMediaUrl(s.photo_url || raw['photoUrl'] || raw['photo'] || raw['photo_url'], 'photo', 'jpg', numId);
          const resolvedLogo = formatMediaUrl(s.logo_url || raw['logoUrl'] || raw['logo'] || raw['logo_url'], 'logo', 'png', numId);

          const questTitle = s.quest_name || raw.quest?.title || raw['クエスト名'] || raw['クエストタイトル'] || raw['quest_name'] || '';
          const questPrice = s.quest_price !== undefined ? Number(s.quest_price) : Number(raw.quest?.price || raw['クエスト価格'] || raw['クエスト価格(円)'] || raw['quest_price'] || 0);
          const questCharge = s.quest_charge || raw.quest?.charge || raw['クエストチャージ'] || raw['quest_charge'] || '不要';
          const questContent = s.quest_content || raw.quest?.content || raw['クエスト内容'] || raw['quest_content'] || '';
          const questNotes = s.quest_notes || raw.quest?.notes || raw['クエスト備考'] || raw['quest_notes'] || '';

          const setTitle = s.set_name || raw.yoidoreSet?.title || raw['酔いどれセット名'] || raw['セット名'] || raw['set_name'] || '酔いどれセット';
          const setContent = s.set_content || raw.yoidoreSet?.content || raw['セット内容'] || raw['set_content'] || '';
          const setPrice = s.set_price !== undefined ? Number(s.set_price) : Number(raw.yoidoreSet?.price || raw['価格'] || raw['価格(円)'] || raw['セット価格'] || raw['set_price'] || 1000);
          const setCharge = s.set_charge || raw.yoidoreSet?.charge || raw['チャージ'] || raw['チャージ有無'] || raw['set_charge'] || '不要';
          const setIncludeCharge = Boolean(setCharge === '込' || raw.yoidoreSet?.includeCharge || raw['チャージ込']);
          const setNotes = s.set_notes || raw.yoidoreSet?.notes || raw['セット備考'] || raw['備考'] || raw['set_notes'] || '';

          const days = s.days || raw.conditions?.days || raw['提供日'] || raw['提供曜日'] || raw['days'] || '月,火,水,金,土,日';
          const hours = s.hours || raw.conditions?.hours || raw['提供時間'] || raw['営業時間'] || raw['hours'] || '17:00〜23:00';
          const timeNotes = s.time_notes || raw.conditions?.timeNotes || raw['提供時間に対する補足'] || raw['時間補足'] || raw['time_notes'] || '';
          const limit = s.set_limit || raw.conditions?.limit || raw['限定数'] || raw['限定数量'] || raw['set_limit'] || '';

          const paymentMethods = s.payment ? String(s.payment).split(/[,、]/).map(p => p.trim()) : 
            (Array.isArray(raw['paymentMethods']) ? raw['paymentMethods'] : 
              (raw['決済方法'] ? String(raw['決済方法']).split(/[,、]/).map(p => p.trim()) : ['現金']));
          const paymentStr = Array.isArray(paymentMethods) ? paymentMethods.join(', ') : String(s.payment || '現金');

          const mapUrl = s.map_url || raw['googleMapUrl'] || raw['Google Map URL'] || raw['map_url'] || '';
          const instaUrl = s.insta_url || raw['instagramUrl'] || raw['Instagram URL'] || raw['insta_url'] || '';
          const catchphrase = s.catchphrase || raw['キャッチコピー'] || raw['catchphrase'] || '';
          const area = s.area || raw['エリア'] || '';
          const category = s.category || raw['カテゴリ'] || raw['category'] || '居酒屋';
          const style = s.style || raw['スタイル'] || raw['style'] || 'テーブルあり';
          const type = s.yoidore_type || raw['タイプ'] || raw['酔いどれタイプ'] || raw['type'] || 'サク飲み';

          return {
            id: s.id,
            name: s.name,
            area: area,
            category: category,
            style: style,
            type: type,
            yoidore_type: type,
            takeout: (typeof s.takeout === 'string' && s.takeout) ? s.takeout : (s.takeout === true ? 'テイクアウトOK' : (s.takeout === false ? 'テイクアウト不可' : (raw['テイクアウト'] || (raw['isTakeout'] ? 'テイクアウトOK' : 'テイクアウト不可')))),
            isTakeout: s.takeout === 'テイクアウト専門' || s.takeout === 'テイクアウトOK' || s.takeout === true || Boolean(raw['isTakeout'] || raw['テイクアウト'] === 'テイクアウトOK' || raw['テイクアウト'] === 'テイクアウト専門' || raw['テイクアウト'] === '可'),
            isOpenToday: raw['isOpenToday'] !== false,
            isQuestActive: raw['isQuestActive'] !== false,
            isCouponTarget: s.is_coupon_target !== false,
            is_coupon_target: s.is_coupon_target !== false,
            couponDescription: s.coupon_description || '',
            coupon_description: s.coupon_description || '',
            catchphrase: catchphrase,
            // トップレベルエイリアス（管理画面・POP・API相互互換）
            set_name: setTitle,
            set_price: setPrice,
            set_content: setContent,
            set_charge: setCharge,
            set_limit: limit,
            set_notes: setNotes,
            quest_name: questTitle,
            quest_price: questPrice,
            quest_charge: questCharge,
            quest_content: questContent,
            quest_notes: questNotes,
            days: days,
            hours: hours,
            time_notes: timeNotes,
            payment: paymentStr,
            map_url: mapUrl,
            insta_url: instaUrl,
            quest: {
              title: questTitle || 'クエスト',
              price: questPrice,
              charge: questCharge,
              content: questContent,
              notes: questNotes
            },
            yoidoreSet: {
              title: setTitle,
              content: setContent,
              price: setPrice,
              charge: setCharge,
              includeCharge: setIncludeCharge,
              notes: setNotes
            },
            conditions: {
              days: days,
              hours: hours,
              timeNotes: timeNotes,
              limit: limit,
              soldOutEnd: Boolean(raw.conditions?.soldOutEnd || raw['売切終了'])
            },
            paymentMethods: paymentMethods,
            googleMapUrl: mapUrl,
            instagramUrl: instaUrl,
            photoUrl: resolvedPhoto,
            photo_url: resolvedPhoto,
            logoUrl: resolvedLogo,
            logo_url: resolvedLogo,
            mapPos: raw.mapPos || { x: 50, y: 50 },
            raw_data: raw
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
   * システム共有設定（特典・称号・シーズン）のクラウド取得・保存
   * （Supabase usersテーブルの特別レコード __system_config__ を介して全端末リアルタイム同期）
   * ------------------------------------------------------------------------ */
  async fetchSystemConfig() {
    try {
      const res = await this.supabaseFetch('users?line_user_id=eq.__system_config__&select=*');
      if (Array.isArray(res) && res.length > 0 && res[0].display_name) {
        const config = JSON.parse(res[0].display_name);
        return config;
      }
    } catch (e) {
      console.warn('システム共有設定のSupabase取得失敗:', e);
    }
    return null;
  }

  async saveSystemConfig(partialConfig) {
    try {
      let current = (await this.fetchSystemConfig()) || {};
      const updated = { ...current, ...partialConfig };

      await this.supabaseFetch('users', {
        method: 'POST',
        headers: {
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify({
          line_user_id: '__system_config__',
          display_name: JSON.stringify(updated),
          picture_url: 'system',
          last_active_at: new Date().toISOString()
        })
      });
      return true;
    } catch (e) {
      console.warn('システム共有設定のSupabase保存失敗:', e);
      return false;
    }
  }

  /* ------------------------------------------------------------------------
   * シーズン情報取得 & 開催状態判定
   * ------------------------------------------------------------------------ */
  async getCurrentSeason() {
    const cloudConfig = await this.fetchSystemConfig();
    if (cloudConfig && cloudConfig.seasons && Array.isArray(cloudConfig.seasons)) {
      const active = cloudConfig.seasons.find(s => s.is_active);
      if (active) this.currentSeason = active;
    } else if (cloudConfig && cloudConfig.current_season) {
      this.currentSeason = cloudConfig.current_season;
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
    const cloudConfig = await this.fetchSystemConfig();
    if (cloudConfig && Array.isArray(cloudConfig.seasons) && cloudConfig.seasons.length > 0) {
      this.seasons = cloudConfig.seasons;
      return this.seasons;
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

    return this.seasons;
  }

  /* ------------------------------------------------------------------------
   * リピーター判定
   * ------------------------------------------------------------------------ */
  async checkIsVeteranUser() {
    if (!this.currentUser) return { isVeteran: false, previousVisitsCount: 0 };
    try {
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
   * 特典ランク一覧取得 (直接データベースから取得)
   * ------------------------------------------------------------------------ */
  async getRewardTiers(seasonId = null) {
    // 1. データベースのクラウド共有設定 (__system_config__) を取得
    const cloudConfig = await this.fetchSystemConfig();
    if (cloudConfig && Array.isArray(cloudConfig.reward_tiers) && cloudConfig.reward_tiers.length > 0) {
      this.rewardTiers = cloudConfig.reward_tiers.map(s => ({
        id: Number(s.id),
        reward_type: s.reward_type || 'store_coupon',
        title: s.title,
        required_visits: Number(s.required_visits),
        selectable_count: Number(s.selectable_count) || 1,
        goods_name: s.goods_name || null,
        exchange_location: s.exchange_location || null,
        exchange_notice: s.exchange_notice || null,
        description: s.description || ''
      })).sort((a, b) => (a.required_visits || 0) - (b.required_visits || 0));

      return this.rewardTiers;
    }

    // 2. DB未設定時の初期フォールバック
    this.rewardTiers = [...(this.config.fallbackRewardTiers || [])];
    await this.saveSystemConfig({ reward_tiers: this.rewardTiers });
    return this.rewardTiers;
  }

  /* ------------------------------------------------------------------------
   * 勇者レベル・称号マスタ一覧取得 (直接データベースから取得)
   * ------------------------------------------------------------------------ */
  async getHeroTitles() {
    // 1. データベースのクラウド共有設定から取得
    const cloudConfig = await this.fetchSystemConfig();
    if (cloudConfig && Array.isArray(cloudConfig.hero_titles) && cloudConfig.hero_titles.length > 0) {
      this.heroTitles = cloudConfig.hero_titles.sort((a, b) => (a.min_visits || 0) - (b.min_visits || 0));
      return this.heroTitles;
    }

    // 2. DB未設定時の初期フォールバック
    this.heroTitles = [...(this.config.fallbackHeroTitles || [])];
    await this.saveSystemConfig({ hero_titles: this.heroTitles });
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
   * ユーザーの獲得クーポン・グッズ引換券一覧取得 (全てデータベースから直接取得)
   * ------------------------------------------------------------------------ */
  async getUserCoupons() {
    if (!this.currentUser || !this.currentUser.userId) return [];
    let coupons = [];
    try {
      const data = await this.supabaseFetch(`user_coupons?user_id=eq.${encodeURIComponent(this.currentUser.userId)}&select=*,stores(*)&order=acquired_at.desc`);
      if (Array.isArray(data)) {
        const tiers = await this.getRewardTiers();
        const goodsTiers = tiers.filter(t => t.reward_type === 'goods');

        coupons = data.map(c => {
          let matchedTier = tiers.find(t => Number(t.id) === Number(c.reward_tier_id));
          if (!matchedTier && goodsTiers.length > 0 && c.store_id === 'store-01') {
            matchedTier = goodsTiers[0];
          }

          const isGoods = matchedTier?.reward_type === 'goods';
          return {
            ...c,
            reward_tier_id: c.reward_tier_id || matchedTier?.id || null,
            reward_type: isGoods ? 'goods' : (c.reward_type || 'store_coupon'),
            goods_name: matchedTier?.goods_name || c.goods_name || matchedTier?.title || null,
            exchange_location: matchedTier?.exchange_location || c.exchange_location || null,
            exchange_notice: matchedTier?.exchange_notice || c.exchange_notice || null,
            title: matchedTier?.title || c.title || ''
          };
        });
      }
    } catch (e) {
      console.error('データベースからのクーポン一覧取得エラー:', e);
    }

    this.userCoupons = coupons;
    return this.userCoupons;
  }

  /* ------------------------------------------------------------------------
   * クーポン選択・獲得 (達成した特典から店舗を選んでデータベースに保存)
   * ------------------------------------------------------------------------ */
  async claimCoupons(rewardTierId, selectedStoreIds) {
    if (!this.currentUser || !this.currentUser.userId) {
      return { success: false, message: 'LINEログインが必要です' };
    }
    if (!selectedStoreIds || selectedStoreIds.length === 0) {
      return { success: false, message: '店舗が選択されていません' };
    }

    const numTierId = parseInt(rewardTierId, 10);
    const makeRows = (useTierId) => selectedStoreIds.map(storeId => {
      const row = {
        user_id: this.currentUser.userId,
        store_id: storeId,
        status: 'active',
        acquired_at: new Date().toISOString()
      };
      if (useTierId && !isNaN(numTierId)) {
        row.reward_tier_id = numTierId;
      }
      return row;
    });

    try {
      await this.syncUserToDatabase();
      try {
        await this.supabaseFetch('user_coupons', {
          method: 'POST',
          headers: { 'Prefer': 'return=representation' },
          body: JSON.stringify(makeRows(true))
        });
      } catch (fkErr) {
        // FK制約エラー時は reward_tier_id を除外して確実に保存
        await this.supabaseFetch('user_coupons', {
          method: 'POST',
          headers: { 'Prefer': 'return=representation' },
          body: JSON.stringify(makeRows(false))
        });
      }
      await this.getUserCoupons();
    } catch (err) {
      console.error('データベースへのクーポン保存エラー:', err);
      return {
        success: false,
        message: 'クーポンの保存に失敗しました: ' + (err.message || '通信エラー')
      };
    }

    return { success: true, count: selectedStoreIds.length };
  }

  /* ------------------------------------------------------------------------
   * グッズ・記念品引換券の即時獲得 (直接データベースに保存)
   * ------------------------------------------------------------------------ */
  async claimGoodsReward(rewardTierId) {
    if (!this.currentUser || !this.currentUser.userId) {
      return { success: false, message: 'LINEログインが必要です' };
    }

    await this.getUserCoupons();
    if (this.userCoupons.some(c => Number(c.reward_tier_id) === Number(rewardTierId))) {
      return { success: false, message: '既にこのグッズ引換券は獲得済みです。' };
    }

    const tiers = await this.getRewardTiers();
    const tier = tiers.find(t => Number(t.id) === Number(rewardTierId));

    try {
      await this.syncUserToDatabase();
      const numTierId = parseInt(rewardTierId, 10);
      const insertRow = {
        user_id: this.currentUser.userId,
        store_id: 'store-01', // 共通デフォルト店舗
        status: 'active',
        acquired_at: new Date().toISOString()
      };

      try {
        if (!isNaN(numTierId)) {
          insertRow.reward_tier_id = numTierId;
        }
        await this.supabaseFetch('user_coupons', {
          method: 'POST',
          headers: { 'Prefer': 'return=representation' },
          body: JSON.stringify(insertRow)
        });
      } catch (fkErr) {
        // FK制約エラー時は reward_tier_id を除外して確実に保存
        delete insertRow.reward_tier_id;
        await this.supabaseFetch('user_coupons', {
          method: 'POST',
          headers: { 'Prefer': 'return=representation' },
          body: JSON.stringify(insertRow)
        });
      }

      await this.getUserCoupons();
      return { success: true, goods: { ...insertRow, goods_name: tier?.goods_name || tier?.title } };
    } catch (e) {
      console.error('グッズ引換券のデータベース保存エラー:', e);
      return { success: false, message: 'グッズ引換券の発行に失敗しました: ' + (e.message || '通信エラー') };
    }
  }

  /* ------------------------------------------------------------------------
   * クーポン・引換券の消し込み（直接データベースを更新）
   * ------------------------------------------------------------------------ */
  async redeemCoupon(couponId) {
    if (!couponId) return { success: false, message: 'クーポン・引換券IDが指定されていません' };

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
      console.error('データベースのクーポン消し込みエラー:', err);
      return {
        success: false,
        message: '消し込みに失敗しました: ' + (err.message || '通信エラー')
      };
    }

    return { success: true };
  }

  /* ------------------------------------------------------------------------
   * バックオフィス管理用 削除 & 更新 API
   * ------------------------------------------------------------------------ */
  // ユーザーの完全削除 (カスケードでvisits/couponsも削除)
  async adminDeleteUser(userId) {
    if (!userId || userId.startsWith('__')) return;
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

    // Supabaseクラウド共有設定へ確実に永続化同期
    await this.saveSystemConfig({ seasons: this.seasons, current_season: this.currentSeason });

    return seasonData;
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
    }

    // Supabaseクラウド共有設定へ確実に永続化同期
    await this.saveSystemConfig({ seasons: this.seasons, current_season: this.currentSeason });
    await this.getCurrentSeason();
  }

  // 特典ランク (reward_tiers) の新規登録 / 更新
  async adminSaveRewardTier(tierData) {
    const cleanData = {
      season_id: Number(tierData.season_id) || 2,
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
        this.rewardTiers.reduce((max, t) => Math.max(max, Number(t.id) || 0), 0) : 0;
      targetId = maxId + 1;
    }
    cleanData.id = targetId;

    if (!Array.isArray(this.rewardTiers)) this.rewardTiers = [];
    const idx = this.rewardTiers.findIndex(t => Number(t.id) === targetId);
    if (idx !== -1) {
      this.rewardTiers[idx] = { ...this.rewardTiers[idx], ...cleanData };
    } else {
      this.rewardTiers.push(cleanData);
    }
    this.rewardTiers.sort((a, b) => (a.required_visits || 0) - (b.required_visits || 0));

    // Supabaseクラウド共有設定へ確実に永続化同期
    await this.saveSystemConfig({ reward_tiers: this.rewardTiers });

    return cleanData;
  }

  // 特典ランクの削除
  async adminDeleteRewardTier(tierId) {
    const numId = Number(tierId);
    this.rewardTiers = (this.rewardTiers || []).filter(t => Number(t.id) !== numId);

    // Supabaseクラウド共有設定へ確実に永続化同期
    await this.saveSystemConfig({ reward_tiers: this.rewardTiers });

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

    if (!Array.isArray(this.heroTitles)) this.heroTitles = [];
    const idx = this.heroTitles.findIndex(t => Number(t.id) === targetId || t.level === cleanData.level);
    if (idx !== -1) {
      this.heroTitles[idx] = { ...this.heroTitles[idx], ...cleanData };
    } else {
      this.heroTitles.push(cleanData);
    }
    this.heroTitles.sort((a, b) => a.min_visits - b.min_visits);

    // Supabaseクラウド共有設定へ確実に永続化同期
    await this.saveSystemConfig({ hero_titles: this.heroTitles });

    return cleanData;
  }

  // 勇者称号の削除
  async adminDeleteHeroTitle(titleId) {
    const numId = Number(titleId);
    this.heroTitles = (this.heroTitles || []).filter(t => Number(t.id) !== numId && t.level !== numId);

    // Supabaseクラウド共有設定へ確実に永続化同期
    await this.saveSystemConfig({ hero_titles: this.heroTitles });

    return true;
  }

  /* ------------------------------------------------------------------------
   * テスト用データリセット
   * ------------------------------------------------------------------------ */
  resetMockData() {
    this.visits = [];
    this.userCoupons = [];
  }
}

// グローバルインスタンス
window.QuestApiManager = QuestApiManager;
window.questApi = new QuestApiManager();
