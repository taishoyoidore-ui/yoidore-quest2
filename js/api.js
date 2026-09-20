/**
 * 大正酔いどれクエスト - API & 認証 & Supabase通信マネージャー
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
    const fallbackGuidance = window.APP_CONFIG?.fallbackSeasonGuidance || {};
    this.currentSeason = {
      id: 2,
      name: '大正酔いどれクエスト',
      start_date: '2026-08-01',
      end_date: '2026-08-31',
      coupon_valid_until: '2026-09-30',
      is_active: true,
      overview: fallbackGuidance.overview || '',
      guide_steps: fallbackGuidance.guide_steps || [],
      rules_notes: fallbackGuidance.rules_notes || ''
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
   * 店舗マスタ取得 (2層分離モデル: stores 基本情報 + season_stores 企画データ)
   * ------------------------------------------------------------------------ */
  async getStores(seasonId = null) {
    const targetSeasonId = Number(seasonId || this.currentSeason?.id || 2);

    try {
      const data = await this.supabaseFetch('stores?select=*&order=display_order.asc', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
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

        const mappedStores = data.map(s => {
          const raw = s.raw_data || {};
          const seasonsMap = raw.seasons || {};
          // 指定シーズンの個別企画データ（なければ旧互換で第2回はトップレベルrawを参照）
          const hasExplicitSeason = seasonsMap[targetSeasonId] !== undefined;
          const seasonData = seasonsMap[targetSeasonId] || (targetSeasonId === 2 ? raw : null);

          const numId = s.id ? s.id.replace(/\D/g, '').padStart(3, '0') : '001';
          const resolvedPhoto = formatMediaUrl(s.photo_url || raw['photo_url'] || raw['photoUrl'] || raw['photo'], 'photo', 'jpg', numId);
          const resolvedLogo = formatMediaUrl(s.logo_url || raw['logo_url'] || raw['logoUrl'] || raw['logo'], 'logo', 'png', numId);

          // 参加フラグの判定（データがないシーズンは未参加）
          let isParticipating = false;
          if (hasExplicitSeason) {
            isParticipating = Boolean(seasonData?.is_participating);
          } else if (targetSeasonId === 2) {
            isParticipating = seasonData ? (seasonData.is_participating !== undefined ? Boolean(seasonData.is_participating) : true) : false;
          } else {
            isParticipating = false;
          }

          // シーズン企画データの抽出（seasonDataが無い場合は空値）
          const questTitle = seasonData ? (seasonData.quest_name || seasonData.quest?.title || seasonData['クエスト名'] || (seasonData === raw ? s.quest_name : '') || '') : '';
          const questPrice = seasonData ? (seasonData.quest_price !== undefined ? Number(seasonData.quest_price) : Number(seasonData.quest?.price || seasonData['クエスト価格'] || (seasonData === raw ? s.quest_price : 0) || 0)) : 0;
          const questCharge = seasonData ? (seasonData.quest_charge || seasonData.quest?.charge || seasonData['クエストチャージ'] || (seasonData === raw ? s.quest_charge : '') || '') : '';
          const questContent = seasonData ? (seasonData.quest_content || seasonData.quest?.content || seasonData['クエスト内容'] || (seasonData === raw ? s.quest_content : '') || '') : '';
          const questNotes = seasonData ? (seasonData.quest_notes || seasonData.quest?.notes || seasonData['クエスト備考'] || (seasonData === raw ? s.quest_notes : '') || '') : '';

          const setTitle = seasonData ? (seasonData.set_name || seasonData.yoidoreSet?.title || seasonData['酔いどれセット名'] || seasonData['セット名'] || (seasonData === raw ? s.set_name : '') || '') : '';
          const setContent = seasonData ? (seasonData.set_content || seasonData.yoidoreSet?.content || seasonData['セット内容'] || (seasonData === raw ? s.set_content : '') || '') : '';
          const setPrice = seasonData ? (seasonData.set_price !== undefined ? Number(seasonData.set_price) : Number(seasonData.yoidoreSet?.price || seasonData['価格'] || (seasonData === raw ? s.set_price : 0) || 0)) : 0;
          const setCharge = seasonData ? (seasonData.set_charge || seasonData.yoidoreSet?.charge || seasonData['チャージ'] || (seasonData === raw ? s.set_charge : '') || '') : '';
          const setIncludeCharge = Boolean(setCharge === '込' || seasonData?.yoidoreSet?.includeCharge || seasonData?.['チャージ込']);
          const setNotes = seasonData ? (seasonData.set_notes || seasonData.yoidoreSet?.notes || seasonData['セット備考'] || (seasonData === raw ? s.set_notes : '') || '') : '';

          const days = seasonData ? (seasonData.days || seasonData.conditions?.days || seasonData['提供日'] || (seasonData === raw ? s.days : '') || '') : '';
          const hours = seasonData ? (seasonData.hours || seasonData.conditions?.hours || seasonData['提供時間'] || (seasonData === raw ? s.hours : '') || '') : '';
          const timeNotes = seasonData ? (seasonData.time_notes || seasonData.conditions?.timeNotes || seasonData['提供時間に対する補足'] || (seasonData === raw ? s.time_notes : '') || '') : '';
          const limit = seasonData ? (seasonData.set_limit || seasonData.conditions?.limit || seasonData['限定数'] || (seasonData === raw ? s.set_limit : '') || '') : '';

          const paymentMethods = s.payment ? String(s.payment).split(/[,、]/).map(p => p.trim()) : 
            (Array.isArray(raw['paymentMethods']) ? raw['paymentMethods'] : 
              (raw['payment'] || raw['決済方法'] ? String(raw['payment'] || raw['決済方法']).split(/[,、]/).map(p => p.trim()) : ['現金']));
          const paymentStr = Array.isArray(paymentMethods) ? paymentMethods.join(', ') : String(s.payment || '現金');

          // 固定基本情報
          const mapUrl = s.map_url || raw['map_url'] || raw['googleMapUrl'] || raw['Google Map URL'] || '';
          const instaUrl = s.insta_url || raw['insta_url'] || raw['instagramUrl'] || raw['Instagram URL'] || '';
          const catchphrase = s.catchphrase || raw['catchphrase'] || raw['キャッチコピー'] || '';
          const area = s.area || raw['area'] || raw['エリア'] || '';
          const category = s.category || raw['category'] || raw['カテゴリ'] || '居酒屋';
          const style = s.style || raw['style'] || raw['スタイル'] || 'テーブルあり';
          const type = s.yoidore_type || raw['type'] || raw['yoidore_type'] || raw['タイプ'] || 'サク飲み';
          
          const planType = seasonData ? (seasonData.plan_type || (questTitle ? '両方で参加' : (setTitle ? '「酔いどれセット」のみで参加' : ''))) : '';
          const badgeSalesCount = seasonData?.badge_sales_count || '';
          const hasQuest = Boolean(questTitle && questTitle.trim() !== '' && questTitle !== '？？？？？' && !planType.includes('「酔いどれセット」のみ'));
          const isCouponTarget = seasonData ? (seasonData.is_coupon_target !== undefined ? Boolean(seasonData.is_coupon_target) : (targetSeasonId === 2 ? (s.is_coupon_target !== false) : false)) : false;
          const takeout = seasonData ? (seasonData.takeout || (typeof s.takeout === 'string' && s.takeout ? s.takeout : (raw['takeout'] || ''))) : '';

          return {
            id: s.id,
            season_id: targetSeasonId,
            name: s.name,
            area: area,
            category: category,
            style: style,
            type: type,
            yoidore_type: type,
            takeout: takeout,
            isTakeout: takeout === 'テイクアウト専門' || takeout === 'テイクアウトOK' || takeout === true,
            isOpenToday: seasonData?.isOpenToday !== false,
            isQuestActive: seasonData?.isQuestActive !== undefined ? (Boolean(seasonData.isQuestActive) && hasQuest) : hasQuest,
            isParticipating: isParticipating,
            is_participating: isParticipating,
            isCouponTarget: isCouponTarget,
            is_coupon_target: isCouponTarget,
            catchphrase: catchphrase,
            plan_type: planType,
            planType: planType,
            badge_sales_count: badgeSalesCount,
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
              soldOutEnd: Boolean(seasonData?.conditions?.soldOutEnd || seasonData?.['売切終了'])
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

        const activeSeasonId = Number(this.currentSeason?.id || 2);
        // アクティブシーズンまたは初回取得時に this.stores を更新
        if (targetSeasonId === activeSeasonId || !this.stores || this.stores.length === 0) {
          this.stores = mappedStores;
        }

        if (window.debugLog) window.debugLog(`📡 Supabaseからシーズン${targetSeasonId}の店舗データ ${mappedStores.length} 件を受信・同期完了！`);
        return mappedStores;
      }
    } catch (e) {
      console.warn('Supabaseからの店舗取得に失敗したためローカルデータを使用します:', e);
      if (window.debugLog) window.debugLog('⚠️ Supabase店舗取得失敗（ローカルデータ利用）: ' + e.message);
    }

    // フォールバック: 既存の window.TAISHO_STORES
    if (window.TAISHO_STORES && window.TAISHO_STORES.length > 0) {
      const fallbackStores = window.TAISHO_STORES.map(s => ({
        ...s,
        season_id: targetSeasonId,
        is_participating: true,
        isParticipating: true
      }));
      const activeSeasonId = Number(this.currentSeason?.id || 2);
      if (targetSeasonId === activeSeasonId || !this.stores || this.stores.length === 0) {
        this.stores = fallbackStores;
      }
      return fallbackStores;
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
    if (cloudConfig && cloudConfig.seasons && Array.isArray(cloudConfig.seasons) && cloudConfig.seasons.length > 0) {
      this.seasons = cloudConfig.seasons;
      const active = cloudConfig.seasons.find(s => s.is_active) || cloudConfig.seasons[0];
      if (active) this.currentSeason = active;
    } else if (cloudConfig && cloudConfig.current_season) {
      this.currentSeason = cloudConfig.current_season;
      if (!Array.isArray(this.seasons) || this.seasons.length === 0) {
        this.seasons = [{ ...this.currentSeason }];
      }
    }

    const fallbackGuidance = window.APP_CONFIG?.fallbackSeasonGuidance || {};
    if (!this.currentSeason.overview && fallbackGuidance.overview) {
      this.currentSeason.overview = fallbackGuidance.overview;
    }
    if ((!this.currentSeason.guide_steps || this.currentSeason.guide_steps.length === 0) && fallbackGuidance.guide_steps) {
      this.currentSeason.guide_steps = fallbackGuidance.guide_steps;
    }
    if (!this.currentSeason.rules_notes && fallbackGuidance.rules_notes) {
      this.currentSeason.rules_notes = fallbackGuidance.rules_notes;
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
   * 特典ランク一覧取得 (シーズン別・直接データベースから取得)
   * ------------------------------------------------------------------------ */
  async getRewardTiers(seasonId = null) {
    const targetSeasonId = Number(seasonId || this.currentSeason?.id || 2);

    // 1. データベースのクラウド共有設定 (__system_config__) を取得
    const cloudConfig = await this.fetchSystemConfig();
    const tiersBySeason = cloudConfig?.reward_tiers_by_season || {};

    // シーズン別マップに存在する場合
    if (tiersBySeason[targetSeasonId] && Array.isArray(tiersBySeason[targetSeasonId]) && tiersBySeason[targetSeasonId].length > 0) {
      this.rewardTiers = tiersBySeason[targetSeasonId].map(s => ({
        id: Number(s.id),
        season_id: targetSeasonId,
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

    // 旧形式のフラット配列から該当シーズンを抽出
    if (cloudConfig && Array.isArray(cloudConfig.reward_tiers) && cloudConfig.reward_tiers.length > 0) {
      const filtered = cloudConfig.reward_tiers.filter(t => {
        const tSeason = Number(t.season_id);
        return tSeason === targetSeasonId || (!t.season_id && targetSeasonId === 2);
      });

      if (filtered.length > 0) {
        this.rewardTiers = filtered.map(s => ({
          id: Number(s.id),
          season_id: targetSeasonId,
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
    }

    // 2. DB未設定時の初期フォールバック（第2回の場合のみデフォルトフォールバックを初期設定）
    if (targetSeasonId === 2) {
      this.rewardTiers = (this.config.fallbackRewardTiers || []).map(t => ({
        ...t,
        season_id: 2
      }));
      tiersBySeason[2] = this.rewardTiers;
      await this.saveSystemConfig({
        reward_tiers_by_season: tiersBySeason,
        reward_tiers: this.rewardTiers
      });
      return this.rewardTiers;
    }

    // その他のシーズンで未設定の場合は空配列
    this.rewardTiers = [];
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
   * ユーザーの来店ログ取得 (visits - 指定シーズン完全絞り込み)
   * ------------------------------------------------------------------------ */
  async getUserVisits(seasonId = null) {
    if (!this.currentUser || !this.currentUser.userId) return [];
    const targetSeasonId = Number(seasonId || this.currentSeason?.id || 2);

    try {
      const data = await this.supabaseFetch(`visits?user_id=eq.${encodeURIComponent(this.currentUser.userId)}&select=*&order=visited_at.desc`);
      if (Array.isArray(data)) {
        // 指定シーズンに絞り込み（旧データでseason_idが無いものは第2回とみなす）
        this.visits = data.filter(v => {
          const vSeason = Number(v.season_id);
          return vSeason === targetSeasonId || (!v.season_id && targetSeasonId === 2);
        });
        return this.visits;
      }
    } catch (e) {
      console.error('Supabaseからの来店履歴取得エラー:', e);
    }
    return this.visits || [];
  }

  /* ------------------------------------------------------------------------
   * 店主サインの受取・冒険の書への記録実行 (QRコード読み取り時 - シーズン連動)
   * ------------------------------------------------------------------------ */
  async recordVisit(storeId, seasonId = null) {
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

    const targetSeasonId = Number(seasonId || this.currentSeason?.id || 2);

    // 店舗情報を取得して今期参加状況をチェック
    await this.getStores(targetSeasonId);
    const store = (this.stores && this.stores.find(s => s.id === storeId)) ||
                  (window.STORES_DATA && window.STORES_DATA.find(s => s.id === storeId));
    
    if (store && store.is_participating === false) {
      return {
        success: false,
        notParticipating: true,
        storeId,
        message: `『${store.name || storeId}』は現在の開催シーズンには参加していません。`
      };
    }

    // 現在のシーズンの来店履歴を取得して既にハシゴ済みかチェック
    await this.getUserVisits(targetSeasonId);
    const existing = (this.visits || []).find(v => v.store_id === storeId);
    if (existing) {
      return {
        success: false,
        alreadyVisited: true,
        storeId,
        message: 'この酒場の店主サインはすでに冒険の書に記録済みです！'
      };
    }

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
      await this.getUserVisits(targetSeasonId);
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
   * 🧪 開発・テスト用: 指定店舗数の一括サイン受取・記録実行 (シーズン連動)
   * ------------------------------------------------------------------------ */
  async recordMultipleVisitsForTest(targetCount = 5, seasonId = null) {
    if (!this.currentUser || !this.currentUser.userId) {
      return { success: false, message: 'ユーザー情報が見つかりません。' };
    }

    const targetSeasonId = Number(seasonId || this.currentSeason?.id || 2);
    await this.getStores(targetSeasonId);
    await this.getUserVisits(targetSeasonId);

    // 今期参加店舗のみを対象
    const participatingStores = (this.stores || []).filter(s => s.is_participating !== false);
    const visitedStoreIds = new Set((this.visits || []).map(v => v.store_id));
    const unvisitedStores = participatingStores.filter(s => !visitedStoreIds.has(s.id));

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
      await this.getUserVisits(targetSeasonId);
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

  // 互換用エイリアス
  async addMockVisits(targetCount = 5, seasonId = null) {
    return this.recordMultipleVisitsForTest(targetCount, seasonId);
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

  // 互換用エイリアス
  async resetVisitsAndCoupons() {
    return this.resetUserVisitsAndCouponsForTest();
  }

  /* ------------------------------------------------------------------------
   * ユーザーの獲得クーポン・グッズ引換券一覧取得 (シーズン別・データベースから取得)
   * ------------------------------------------------------------------------ */
  async getUserCoupons(seasonId = null) {
    if (!this.currentUser || !this.currentUser.userId) return [];
    const targetSeasonId = Number(seasonId || this.currentSeason?.id || 2);

    let coupons = [];
    try {
      const data = await this.supabaseFetch(`user_coupons?user_id=eq.${encodeURIComponent(this.currentUser.userId)}&select=*,stores(*)&order=acquired_at.desc`);
      if (Array.isArray(data)) {
        const tiers = await this.getRewardTiers(targetSeasonId);
        const goodsTiers = tiers.filter(t => t.reward_type === 'goods');

        // 指定シーズンで絞り込み
        const filteredCoupons = data.filter(c => {
          const cSeason = Number(c.season_id);
          return cSeason === targetSeasonId || (!c.season_id && targetSeasonId === 2);
        });

        coupons = filteredCoupons.map(c => {
          let matchedTier = tiers.find(t => Number(t.id) === Number(c.reward_tier_id));
          if (!matchedTier && goodsTiers.length > 0 && c.store_id === 'store-01') {
            matchedTier = goodsTiers[0];
          }

          const isGoods = matchedTier?.reward_type === 'goods';
          return {
            ...c,
            season_id: targetSeasonId,
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
   * クーポン型特典の宝箱開封・回数枠獲得 (シーズン連動・データベースに保存)
   * ------------------------------------------------------------------------ */
  async claimStoreCouponTier(rewardTierId, seasonId = null) {
    if (!this.currentUser || !this.currentUser.userId) {
      return { success: false, message: 'LINEログインが必要です' };
    }

    const targetSeasonId = Number(seasonId || this.currentSeason?.id || 2);
    await this.getUserCoupons(targetSeasonId);
    if (this.userCoupons.some(c => Number(c.reward_tier_id) === Number(rewardTierId))) {
      return { success: false, message: '既にこの特典クーポンは獲得済みです。' };
    }

    const tiers = await this.getRewardTiers(targetSeasonId);
    const tier = tiers.find(t => Number(t.id) === Number(rewardTierId));
    const ticketCount = Number(tier?.selectable_count) || 5;
    const numTierId = parseInt(rewardTierId, 10);

    const makeRows = (useTierId, withStoreId = false) => {
      const rows = [];
      for (let i = 0; i < ticketCount; i++) {
        const row = {
          user_id: this.currentUser.userId,
          status: 'active',
          season_id: targetSeasonId,
          reward_type: 'store_coupon',
          acquired_at: new Date().toISOString()
        };
        if (withStoreId) {
          row.store_id = null;
        }
        if (useTierId && !isNaN(numTierId)) {
          row.reward_tier_id = numTierId;
        }
        rows.push(row);
      }
      return rows;
    };

    try {
      await this.syncUserToDatabase();
      try {
        await this.supabaseFetch('user_coupons', {
          method: 'POST',
          headers: { 'Prefer': 'return=representation' },
          body: JSON.stringify(makeRows(true, false))
        });
      } catch (fkErr) {
        // FK制約やスキーマエラー時は reward_tier_id を除外して保存
        try {
          await this.supabaseFetch('user_coupons', {
            method: 'POST',
            headers: { 'Prefer': 'return=representation' },
            body: JSON.stringify(makeRows(false, false))
          });
        } catch (subErr) {
          console.warn('DBへの直接挿入フォールバック:', subErr);
        }
      }
      await this.getUserCoupons(targetSeasonId);
    } catch (err) {
      console.error('データベースへのクーポン枠保存エラー:', err);
      return {
        success: false,
        message: 'クーポンの保存に失敗しました: ' + (err.message || '通信エラー')
      };
    }

    return { success: true, count: ticketCount, tier };
  }

  /* ------------------------------------------------------------------------
   * クーポン選択・獲得 (後方互換・一括指定保存用)
   * ------------------------------------------------------------------------ */
  async claimCoupons(rewardTierId, selectedStoreIds, seasonId = null) {
    if (!this.currentUser || !this.currentUser.userId) {
      return { success: false, message: 'LINEログインが必要です' };
    }
    if (!selectedStoreIds || selectedStoreIds.length === 0) {
      return { success: false, message: '店舗が選択されていません' };
    }

    const targetSeasonId = Number(seasonId || this.currentSeason?.id || 2);
    const numTierId = parseInt(rewardTierId, 10);
    const makeRows = (useTierId) => selectedStoreIds.map(storeId => {
      const row = {
        user_id: this.currentUser.userId,
        store_id: storeId,
        status: 'active',
        season_id: targetSeasonId,
        reward_type: 'store_coupon',
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
      await this.getUserCoupons(targetSeasonId);
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
   * グッズ・記念品引換券の即時獲得 (シーズン連動・データベースに保存)
   * ------------------------------------------------------------------------ */
  async claimGoodsReward(rewardTierId, seasonId = null) {
    if (!this.currentUser || !this.currentUser.userId) {
      return { success: false, message: 'LINEログインが必要です' };
    }

    const targetSeasonId = Number(seasonId || this.currentSeason?.id || 2);
    await this.getUserCoupons(targetSeasonId);
    if (this.userCoupons.some(c => Number(c.reward_tier_id) === Number(rewardTierId))) {
      return { success: false, message: '既にこのグッズ引換券は獲得済みです。' };
    }

    const tiers = await this.getRewardTiers(targetSeasonId);
    const tier = tiers.find(t => Number(t.id) === Number(rewardTierId));

    try {
      await this.syncUserToDatabase();
      const numTierId = parseInt(rewardTierId, 10);
      const insertRow = {
        user_id: this.currentUser.userId,
        store_id: 'store-01', // 共通デフォルト店舗
        status: 'active',
        season_id: targetSeasonId,
        reward_type: 'goods',
        goods_name: tier?.goods_name || tier?.title || '記念オリジナルグッズ',
        exchange_location: tier?.exchange_location || '全参加酒場または運営本部',
        exchange_notice: tier?.exchange_notice || '',
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

      await this.getUserCoupons(targetSeasonId);
      return { success: true, goods: { ...insertRow, goods_name: tier?.goods_name || tier?.title } };
    } catch (e) {
      console.error('グッズ引換券のデータベース保存エラー:', e);
      return { success: false, message: 'グッズ引換券の発行に失敗しました: ' + (e.message || '通信エラー') };
    }
  }

  /* ------------------------------------------------------------------------
   * クーポン・引換券の消し込み（店舗指定 & 直接データベース更新）
   * ------------------------------------------------------------------------ */
  async redeemCoupon(couponId, storeId = null) {
    if (!couponId) return { success: false, message: 'クーポン・引換券IDが指定されていません' };

    const updateBody = {
      status: 'used',
      used_at: new Date().toISOString()
    };
    if (storeId) {
      updateBody.store_id = storeId;
    }

    try {
      await this.supabaseFetch(`user_coupons?id=eq.${encodeURIComponent(couponId)}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify(updateBody)
      });
      await this.getUserCoupons();
    } catch (err) {
      console.error('データベースのクーポン消し込みエラー:', err);
      // ローカル更新フォールバック
      const target = this.userCoupons.find(c => c.id === couponId);
      if (target) {
        target.status = 'used';
        target.used_at = updateBody.used_at;
        if (storeId) target.store_id = storeId;
      }
    }

    return { success: true };
  }

  /* ------------------------------------------------------------------------
   * 特典ランクから1店舗分のクーポンを店頭消し込み（オンデマンド即時記録）
   * ------------------------------------------------------------------------ */
  async redeemCouponForStore(tierId, storeId, seasonId = null) {
    if (!this.currentUser || !this.currentUser.userId) {
      return { success: false, message: 'ユーザー情報が見つかりません。' };
    }

    const targetSeasonId = Number(seasonId || this.currentSeason?.id || 2);
    await this.getUserCoupons(targetSeasonId);

    // 既に該当店舗でクーポン利用（used）済みか確認
    const alreadyUsed = this.userCoupons.some(c => c.status === 'used' && c.store_id === storeId && Number(c.reward_tier_id) === Number(tierId));
    if (alreadyUsed) {
      return { success: false, message: 'この店舗のクーポンはすでにご利用済みです。' };
    }

    // 未使用で、該当tier（またはクーポン型）の既存空枠レコードを探す
    const availableCoupons = this.userCoupons.filter(c => {
      if (c.status === 'used') return false;
      if (c.reward_type === 'goods') return false;
      if (tierId) {
        return Number(c.reward_tier_id) === Number(tierId);
      }
      return true;
    });

    if (availableCoupons.length > 0) {
      // 既存の空枠レコードがあればそれを used に更新
      const couponToUse = availableCoupons[0];
      return await this.redeemCoupon(couponToUse.id, storeId);
    }

    // 事前空枠がない場合は、直接 used レコードをINSERTして即時消費
    try {
      await this.syncUserToDatabase();
      const numTierId = parseInt(tierId, 10);
      const now = new Date().toISOString();
      const baseRow = {
        user_id: this.currentUser.userId,
        store_id: storeId,
        status: 'used',
        acquired_at: now,
        used_at: now
      };

      const tryInsert = async (payload) => {
        return await this.supabaseFetch('user_coupons', {
          method: 'POST',
          headers: { 'Prefer': 'return=representation' },
          body: JSON.stringify(payload)
        });
      };

      // スキーマの段階的フォールバック（PGRST204回避）
      try {
        const fullRow = { ...baseRow, season_id: targetSeasonId };
        if (!isNaN(numTierId)) fullRow.reward_tier_id = numTierId;
        await tryInsert(fullRow);
      } catch (err1) {
        try {
          const rowWithSeason = { ...baseRow, season_id: targetSeasonId };
          await tryInsert(rowWithSeason);
        } catch (err2) {
          await tryInsert(baseRow);
        }
      }

      await this.getUserCoupons(targetSeasonId);
      return { success: true };
    } catch (err) {
      console.error('店頭クーポン直接消し込みエラー:', err);
      return { success: false, message: 'クーポンの利用記録に失敗しました: ' + (err.message || '通信エラー') };
    }
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

  // シーズンの削除
  async adminDeleteSeason(seasonId) {
    const targetId = Number(seasonId);
    if (Array.isArray(this.seasons)) {
      this.seasons = this.seasons.filter(s => Number(s.id) !== targetId);
    }
    if (this.currentSeason && Number(this.currentSeason.id) === targetId) {
      const remainingActive = this.seasons.find(s => s.is_active) || this.seasons[0];
      if (remainingActive) {
        this.currentSeason = { ...remainingActive };
      }
    }

    // Supabaseクラウド共有設定へ確実に永続化同期
    await this.saveSystemConfig({ seasons: this.seasons, current_season: this.currentSeason });

    // 店舗のシーズン企画データからも該当シーズンを安全にクリーンアップ
    try {
      const storesRes = await this.supabaseFetch('stores?select=id,raw_data');
      if (Array.isArray(storesRes)) {
        for (const store of storesRes) {
          if (store.raw_data && store.raw_data.seasons && store.raw_data.seasons[String(targetId)]) {
            const updatedRaw = { ...store.raw_data };
            const updatedSeasons = { ...updatedRaw.seasons };
            delete updatedSeasons[String(targetId)];
            updatedRaw.seasons = updatedSeasons;

            await this.supabaseFetch(`stores?id=eq.${encodeURIComponent(store.id)}`, {
              method: 'PATCH',
              body: JSON.stringify({ raw_data: updatedRaw })
            });
          }
        }
      }
    } catch (cleanErr) {
      console.warn('店舗企画データのシーズンクリーンアップ中に軽微な警告:', cleanErr);
    }

    return true;
  }

  // 特典ランク (reward_tiers) の新規登録 / 更新 (シーズン完全分離)
  async adminSaveRewardTier(tierData, seasonId = null) {
    const targetSeasonId = Number(seasonId || tierData.season_id || this.currentSeason?.id || 2);
    const cleanData = {
      season_id: targetSeasonId,
      reward_type: tierData.reward_type || 'store_coupon',
      title: tierData.title,
      required_visits: Number(tierData.required_visits),
      selectable_count: Number(tierData.selectable_count) || 1,
      goods_name: tierData.goods_name || null,
      exchange_location: tierData.exchange_location || null,
      exchange_notice: tierData.exchange_notice || null,
      description: tierData.description || ''
    };

    const cloudConfig = (await this.fetchSystemConfig()) || {};
    const tiersBySeason = cloudConfig.reward_tiers_by_season || {};
    let currentSeasonTiers = tiersBySeason[targetSeasonId] || [];

    let targetId = tierData.id ? Number(tierData.id) : null;
    if (!targetId) {
      const allExistingTiers = Object.values(tiersBySeason).flat().concat(cloudConfig.reward_tiers || []);
      const maxId = allExistingTiers.reduce((max, t) => Math.max(max, Number(t.id) || 0), 0);
      targetId = maxId + 1;
    }
    cleanData.id = targetId;

    const idx = currentSeasonTiers.findIndex(t => Number(t.id) === targetId);
    if (idx !== -1) {
      currentSeasonTiers[idx] = { ...currentSeasonTiers[idx], ...cleanData };
    } else {
      currentSeasonTiers.push(cleanData);
    }
    currentSeasonTiers.sort((a, b) => (a.required_visits || 0) - (b.required_visits || 0));
    tiersBySeason[targetSeasonId] = currentSeasonTiers;

    // 全特典フラット配列も更新
    const allFlatTiers = Object.values(tiersBySeason).flat();

    // Supabaseクラウド共有設定へ確実に永続化同期
    await this.saveSystemConfig({
      reward_tiers_by_season: tiersBySeason,
      reward_tiers: allFlatTiers
    });

    this.rewardTiers = currentSeasonTiers;
    return cleanData;
  }

  // 特典ランクの削除 (シーズン完全分離)
  async adminDeleteRewardTier(tierId, seasonId = null) {
    const numId = Number(tierId);
    const targetSeasonId = Number(seasonId || this.currentSeason?.id || 2);

    const cloudConfig = (await this.fetchSystemConfig()) || {};
    const tiersBySeason = cloudConfig.reward_tiers_by_season || {};
    let currentSeasonTiers = tiersBySeason[targetSeasonId] || [];

    currentSeasonTiers = currentSeasonTiers.filter(t => Number(t.id) !== numId);
    tiersBySeason[targetSeasonId] = currentSeasonTiers;

    const allFlatTiers = Object.values(tiersBySeason).flat();

    // Supabaseクラウド共有設定へ確実に永続化同期
    await this.saveSystemConfig({
      reward_tiers_by_season: tiersBySeason,
      reward_tiers: allFlatTiers
    });

    this.rewardTiers = currentSeasonTiers;
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
