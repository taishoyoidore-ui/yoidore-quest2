/**
 * 店舗が「現在、どれクエ提供時間内（曜日・時間）」かを動的に判定する関数
 * @param {Object} store 店舗データ
 * @param {Date} [now=new Date()] 判定基準日時
 * @returns {boolean}
 */
function checkIsOpenToday(store, now = new Date()) {
  if (!store) return false;

  const rawDays = String(store.days || store.conditions?.days || '').trim();
  const rawHours = String(store.hours || store.conditions?.hours || '').trim();

  if (!rawDays || !rawHours) return false;

  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const curDayIndex = now.getDay();
  const curDayName = dayNames[curDayIndex];
  
  const yesterdayIndex = (curDayIndex + 6) % 7;
  const yesterdayName = dayNames[yesterdayIndex];

  // 全角数字・全角コロン等を半角に正規化
  const normalizeStr = (str) => {
    return str
      .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
      .replace(/：/g, ':')
      .replace(/[\s\u3000]+/g, ' ');
  };

  const cleanDays = normalizeStr(rawDays);
  const cleanHours = normalizeStr(rawHours);

  // 1. 曜日リストの解析
  const parseAllowedDays = (daysStr) => {
    if (!daysStr) return [];
    if (daysStr.includes('全て') || daysStr.includes('全日') || daysStr.includes('毎日')) {
      return [...dayNames];
    }
    
    // "月〜金" や "月～金" などの範囲指定の展開
    const rangeMatch = daysStr.match(/([日月火水木金土])\s*[〜～\-–—~]\s*([日月火水木金土])/);
    const rangeDays = [];
    if (rangeMatch) {
      const startIdx = dayNames.indexOf(rangeMatch[1]);
      const endIdx = dayNames.indexOf(rangeMatch[2]);
      if (startIdx !== -1 && endIdx !== -1) {
        let idx = startIdx;
        while (true) {
          rangeDays.push(dayNames[idx]);
          if (idx === endIdx) break;
          idx = (idx + 1) % 7;
        }
      }
    }

    const matchedDays = new Set(rangeDays);
    for (const d of dayNames) {
      const regex = new RegExp(`(?:^|[^日月火水木金土])${d}(?:曜日|曜|(?=[^日月火水木金土]|$))`);
      if (regex.test(daysStr)) {
        matchedDays.add(d);
      }
    }
    return Array.from(matchedDays);
  };

  const allowedDays = parseAllowedDays(cleanDays);
  if (allowedDays.length === 0) return false;

  // 2. 営業時間帯の解析と判定
  // 複数時間帯（カンマ、スラッシュ、改行、読点等で分割）
  const timeSlots = cleanHours.split(/[,、/／\n\r]+/).map(s => s.trim()).filter(Boolean);
  if (timeSlots.length === 0) return false;

  const curMinutes = now.getHours() * 60 + now.getMinutes();

  for (const slot of timeSlots) {
    // 例: "17:00〜23:00", "17時〜23時", "17:00 - 翌2:00", "17:00〜26:00", "17:00-02:00", "15:00:00〜22:30:00"
    const match = slot.match(/(翌)?\s*(\d{1,2})(?::(\d{2})|時(?:(\d{2})分?)?)?(?::\d{2})?\s*[〜～\-–—~]\s*(翌)?\s*(\d{1,2})(?::(\d{2})|時(?:(\d{2})分?)?)?(?::\d{2})?/);
    if (!match) continue;

    let startH = parseInt(match[2], 10);
    const startM = parseInt(match[3] || match[4] || '0', 10);
    const endIsNext = Boolean(match[5]);
    let endH = parseInt(match[6], 10);
    const endM = parseInt(match[7] || match[8] || '0', 10);

    if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) continue;

    if (endH >= 24) {
      endH = endH % 24;
    }

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    const isOvernight = endIsNext || endMinutes <= startMinutes;

    if (!isOvernight) {
      if (allowedDays.includes(curDayName)) {
        if (curMinutes >= startMinutes && curMinutes < endMinutes) {
          return true;
        }
      }
    } else {
      if (curMinutes >= startMinutes) {
        if (allowedDays.includes(curDayName)) {
          return true;
        }
      } else if (curMinutes < endMinutes) {
        if (allowedDays.includes(yesterdayName)) {
          return true;
        }
      }
    }
  }

  return false;
}

// グローバル公開
window.checkIsOpenToday = checkIsOpenToday;

/**
 * URLやQRコード読み取り文字列からマイルストーン特典達成ID (claim_tier / tier_id) を安全・確実に抽出
 * (LINE LIFFの liff.state パラメータ、通常クエリ、ハッシュフラグメント、生URL、プレーンIDすべてに対応)
 * @param {string} input 
 * @returns {string|null} 達成特典ランクID（例: "1", "2", "3"）または null
 */
function extractClaimTierParam(input = window.location.href) {
  if (!input) return null;
  const str = String(input).trim();

  // 1. プレーンなIDまたはtier文字列 (例: "1", "2", "tier-1", "claim-tier-1", "tier_1")
  if (/^(tier[-_]?|claim[-_]?tier[-_]?)?\d+$/i.test(str)) {
    return str.replace(/^(tier[-_]?|claim[-_]?tier[-_]?)/i, '');
  }

  try {
    // 2. URLオブジェクトからパラメータ抽出
    const url = new URL(str, window.location.origin);
    
    // 2.1 標準クエリパラメータ
    let tier = url.searchParams.get('claim_tier') || 
               url.searchParams.get('tier_id') || 
               (url.searchParams.get('action') === 'claim_tier' ? url.searchParams.get('tier') : null) || 
               url.searchParams.get('tier');
    if (tier) return String(tier).trim();

    // 2.2 LIFF state パラメータ (?liff.state=%3Fclaim_tier%3D1, /?claim_tier=1 等)
    const liffState = url.searchParams.get('liff.state');
    if (liffState) {
      const decodedState = decodeURIComponent(liffState);
      const stateMatch = decodedState.match(/[?&#](?:claim_tier|tier_id|tier)=([^&#]+)/i);
      if (stateMatch) return decodeURIComponent(stateMatch[1]).trim();
      try {
        const dummyUrl = new URL(decodedState.startsWith('/') ? `https://dummy.local${decodedState}` : (decodedState.startsWith('?') ? `https://dummy.local/${decodedState}` : decodedState));
        const tierFromState = dummyUrl.searchParams.get('claim_tier') || dummyUrl.searchParams.get('tier_id') || dummyUrl.searchParams.get('tier');
        if (tierFromState) return String(tierFromState).trim();
      } catch (e) {}
    }

    // 2.3 ハッシュフラグメント (#/?claim_tier=1, #claim_tier=1 等)
    if (url.hash) {
      const hashClean = url.hash.replace(/^#\/?/, '');
      const hashQuery = hashClean.includes('?') ? hashClean.split('?')[1] : hashClean;
      const hashParams = new URLSearchParams(hashQuery);
      const tierFromHash = hashParams.get('claim_tier') || hashParams.get('tier_id') || hashParams.get('tier');
      if (tierFromHash) return String(tierFromHash).trim();
      const hashMatch = url.hash.match(/[?&#](?:claim_tier|tier_id|tier)=([^&#]+)/i);
      if (hashMatch) return decodeURIComponent(hashMatch[1]).trim();
    }
  } catch (e) {}

  // 3. 正規表現でのフォールバック抽出
  const rawMatch = str.match(/[?&#](?:claim_tier|tier_id|tier)=([^&#]+)/i);
  if (rawMatch) return decodeURIComponent(rawMatch[1]).trim();

  return null;
}

window.extractClaimTierParam = extractClaimTierParam;

class YoidoreQuestApp {
  constructor() {
    if (window.debugLog) window.debugLog('🚀 YoidoreQuestApp 起動開始');
    
    // URLパラメータからマイルストーン達成QRアクセスの事前チェック
    const hasClaimTier = extractClaimTierParam(window.location.href);

    this.currentView = hasClaimTier ? 'quest-book' : 'top';
    this.selectedStore = null;
    this.soundEnabled = true;
    this.audioCtx = null;
    this.isStarted = Boolean(hasClaimTier);
    this.lastStoresScrollY = 0;
    
    // フィルター状態
    this.filters = {
      area: 'ALL',
      category: 'ALL',
      style: 'ALL',
      type: 'ALL',
      takeout: 'ALL',
      openToday: false,
      organizer: false,
      searchQuery: ''
    };

    // 特典達成QRから直接アクセス時はスタートオーバーレイを即座に非表示
    if (hasClaimTier) {
      const overlay = document.getElementById('start-overlay');
      if (overlay) {
        overlay.style.display = 'none';
      }
    }

    // 初期履歴の登録 (ブラウザバック用 - file://プロトコル等でのSecurityError対策)
    try {
      if (window.history && window.history.replaceState) {
        window.history.replaceState({
          view: this.currentView,
          selectedStoreId: null,
          filters: { ...this.filters }
        }, '');
      }
    } catch (e) {
      if (window.debugLog) window.debugLog('⚠️ history.replaceStateスキップ: ' + e.message);
    }

    try {
      this.initAudio();
      this.initEvents();
      if (!hasClaimTier) {
        this.initPrologueDemo();
        this.render();
      }
      this.initQuestSystem();
      if (window.debugLog) window.debugLog('✅ アプリ初期化完了');
    } catch (err) {
      alert('【初期化エラー】' + err.message);
      if (window.debugLog) window.debugLog('❌ 初期化エラー: ' + err.stack);
    }
  }

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // 日付フォーマット補助 (例: 2026-08-01 -> 2026年8月1日(土))
  formatDateWithDay(dStr) {
    if (!dStr) return '';
    const parts = String(dStr).split('T')[0].split(/[-/]/);
    if (parts.length >= 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      const dateObj = new Date(y, m - 1, d);
      const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
      const dayName = isNaN(dateObj.getTime()) ? '' : `(${dayNames[dateObj.getDay()]})`;
      return `${y}年${m}月${d}日${dayName}`;
    }
    return String(dStr);
  }

  // 短縮日付フォーマット (例: 2026-08-01 -> 8/1(土))
  formatShortDateWithDay(dStr) {
    if (!dStr) return '';
    const parts = String(dStr).split('T')[0].split(/[-/]/);
    if (parts.length >= 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      const dateObj = new Date(y, m - 1, d);
      const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
      const dayName = isNaN(dateObj.getTime()) ? '' : `(${dayNames[dateObj.getDay()]})`;
      return `${m}/${d}${dayName}`;
    }
    return String(dStr);
  }

  // 獲得特典マイルストーン段階数（unlockedTierCount）から勇者称号・レベルデータを取得 (reward_tiers 連動)
  getHeroTitleForTierCount(unlockedTierCount = 0) {
    const activeSeasonId = window.questApi?.currentSeason?.id || 2;
    const rewardTiers = (window.questApi && window.questApi.rewardTiers && window.questApi.rewardTiers.length > 0)
      ? window.questApi.rewardTiers.filter(t => Number(t.season_id) === Number(activeSeasonId))
      : (window.APP_CONFIG?.fallbackRewardTiers || []);
    
    // 必要軒数順（昇順）にソート
    const sortedTiers = [...rewardTiers].sort((a, b) => (Number(a.required_visits) || 0) - (Number(b.required_visits) || 0));

    // レベル計算: 未達成ならLv.1、第1マイルストーン達成ならLv.2、第2ならLv.3...
    const count = Math.max(0, Number(unlockedTierCount) || 0);
    const currentLv = 1 + count;

    const defaultTitle = window.APP_CONFIG?.fallbackDefaultTitle || { title: '駆け出しの呑兵衛', badge_color: '#94a3b8' };

    if (count === 0) {
      return {
        level: 1,
        title: defaultTitle.title,
        badge_color: defaultTitle.badge_color,
        description: '初期冒険者'
      };
    }

    // 達成済み特典（1〜count番目まで）の中から、最も上位でhero_titleが設定されているものを探索
    // 未設定の場合は直前の有効称号（なければ初期称号）を引き継ぐ
    const unlockedTiers = sortedTiers.slice(0, count);
    let activeTitle = defaultTitle.title;
    let activeBadgeColor = defaultTitle.badge_color;
    let activeDesc = `${currentLv}段階達成の勇者`;

    for (let i = 0; i < unlockedTiers.length; i++) {
      const tier = unlockedTiers[i];
      if (tier && tier.hero_title && typeof tier.hero_title === 'string' && tier.hero_title.trim() !== '') {
        activeTitle = tier.hero_title.trim();
        if (tier.badge_color) activeBadgeColor = tier.badge_color;
        if (tier.description) activeDesc = tier.description;
      }
    }

    return {
      level: currentLv,
      title: activeTitle,
      badge_color: activeBadgeColor,
      description: activeDesc
    };
  }

  // 互換用メソッド
  getHeroTitleForVisits(count = 0) {
    return this.getHeroTitleForTierCount(count);
  }

  getStores(seasonId = null) {
    let list = [];
    if (window.questApi && window.questApi.stores && window.questApi.stores.length > 0) {
      list = window.questApi.stores;
    } else if (window.TAISHO_STORES && window.TAISHO_STORES.length > 0) {
      list = window.TAISHO_STORES;
    } else if (window.STORES_DATA && window.STORES_DATA.length > 0) {
      list = window.STORES_DATA;
    }
    if (seasonId) {
      return list.filter(s => Number(s.season_id) === Number(seasonId) && s.is_participating !== false);
    }
    return list.filter(s => s.is_participating !== false);
  }

  getAreas() {
    const stores = this.getStores();
    if (stores.length > 0) {
      const areas = Array.from(new Set(stores.map(s => s.area))).filter(Boolean);
      if (areas.length > 0) return areas;
    }
    return ['三軒家西', '三軒家東', '駅前', '泉尾', '平尾'];
  }

  getCategories() {
    const stores = this.getStores();
    if (stores.length > 0) {
      const categories = Array.from(new Set(stores.map(s => s.category))).filter(Boolean);
      if (categories.length > 0) return categories;
    }
    return ['おばんざい', '居酒屋', '立ち呑み', '中華', 'カフェ', 'バー', 'BAR', '焼肉', 'バル', '食堂'];
  }

  getStyles() {
    const stores = this.getStores();
    if (stores.length > 0) {
      const styles = Array.from(new Set(stores.map(s => s.style))).filter(Boolean);
      if (styles.length > 0) return styles;
    }
    return ['テーブルあり', '立ち呑み', 'カウンター'];
  }

  getTypes() {
    const stores = this.getStores();
    if (stores.length > 0) {
      const types = Array.from(new Set(stores.map(s => s.type))).filter(Boolean);
      if (types.length > 0) return types;
    }
    return ['サク飲み', '腹ごしらえ', 'ひと休み', '昼飲み', '夜遊び', 'テイクアウト'];
  }

  /* ------------------------------------------------------------------------
   * Supabase & LIFF クエストシステム初期化
   * ------------------------------------------------------------------------ */
  async initQuestSystem() {
    if (window.questApi) {
      // URLパラメータからのマイルストーン特典達成検出 (LINE LIFFのliff.stateや通常パラメータ・ハッシュを全自動解析)
      const claimTierId = extractClaimTierParam(window.location.href);

      try {
        await window.questApi.initAuth();
        
        // 友だち限定セーフティガード判定 (未登録またはブロック中の場合は画面をロック)
        if (window.questApi.isFriend === false) {
          const gateOverlay = document.getElementById('friendship-gate-overlay');
          const startOverlay = document.getElementById('start-overlay');
          const syncLoader = document.getElementById('qr-claim-sync-loader');
          if (syncLoader) syncLoader.style.display = 'none';
          if (startOverlay) startOverlay.style.display = 'none';
          if (gateOverlay) gateOverlay.style.display = 'flex';
          this.typeMessage('⚠️ 公式LINEの友だち登録（ブロック解除）が必要です。');
          return;
        }
        
        // シーズン・設定・店舗・特典・履歴データを並列取得で高速化
        const [curSeason, seasons, stores] = await Promise.all([
          window.questApi.getCurrentSeason(),
          window.questApi.getSeasons(),
          window.questApi.getStores()
        ]);

        if (curSeason && curSeason.start_date && curSeason.end_date) {
          const periodBadge = document.getElementById('start-period-badge');
          if (periodBadge) {
            periodBadge.textContent = `📅 ${this.formatDateWithDay(curSeason.start_date)} 〜 ${this.formatDateWithDay(curSeason.end_date)} 開催`;
          }
        }

        if (stores && stores.length > 0) {
          window.STORES_DATA = stores;
          window.TAISHO_STORES = stores;
        }

        // 特典設定・称号・来店履歴・クーポン履歴を並列取得
        await Promise.all([
          window.questApi.getRewardTiers(),
          window.questApi.getHeroTitles(),
          window.questApi.getUserVisits(),
          window.questApi.getUserCoupons()
        ]);

        const claimTierId = extractClaimTierParam(window.location.href);

        if (claimTierId) {
          // スタート画面オーバーレイを確実に非表示にして冒険の書にセット
          const overlay = document.getElementById('start-overlay');
          if (overlay) overlay.style.display = 'none';
          this.isStarted = true;
          this.currentView = 'quest-book';

          // URLパラメータを安全にクリーンアップ（再読み込み時の重複達成防止）
          try {
            if (window.history && window.history.replaceState) {
              const cleanUrl = window.location.pathname;
              window.history.replaceState({
                view: 'quest-book',
                selectedStoreId: null,
                filters: { ...this.filters }
              }, '', cleanUrl);
            }
          } catch (e) {}

          await this.handleClaimMilestoneTier(claimTierId);
        } else {
          this.render();
        }
      } catch (e) {
        console.warn('Quest system initialization failed:', e);
        this.render();
      } finally {
        // 同期ローダーをスムーズにフェードアウト・非表示
        const syncLoader = document.getElementById('qr-claim-sync-loader');
        if (syncLoader) {
          syncLoader.style.opacity = '0';
          setTimeout(() => {
            syncLoader.style.display = 'none';
          }, 300);
        }
      }
    }
  }

  /* ------------------------------------------------------------------------
   * Web Audio API (ファミコン風効果音)
   * ------------------------------------------------------------------------ */
  initAudio() {
    // ユーザーインタラクション時にAudioContextを初期化
    const unlockAudio = () => {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.audioCtx = new AudioContext();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);

    // スタートジングル音源のプリロード
    try {
      this.startAudio = new Audio('mp3/jingle_item01.mp3');
      this.startAudio.preload = 'auto';
    } catch (e) {}
  }

  /* ------------------------------------------------------------------------
   * 冒険の幕開けジングルSE（mp3/jingle_item01.mp3）
   * ------------------------------------------------------------------------ */
  playStartSE() {
    if (!this.soundEnabled) return;
    try {
      if (this.startAudio) {
        this.startAudio.currentTime = 0;
        this.startAudio.volume = 0.65;
        this.startAudio.play().catch(() => {
          this.playTone(880, 0.12, 'square');
        });
      } else {
        const audio = new Audio('mp3/jingle_item01.mp3');
        audio.volume = 0.65;
        audio.play().catch(() => {
          this.playTone(880, 0.12, 'square');
        });
      }
    } catch (e) {
      this.playTone(880, 0.12, 'square');
    }
  }

  /* ------------------------------------------------------------------------
   * 起動タイトル放置プロローグデモ（オープニングデモ）
   * ------------------------------------------------------------------------ */
  initPrologueDemo() {
    if (this.isStarted) return;
    this.prologueIdleTimer = null;
    this.prologueTypingTimer = null;
    this.prologueLoopTimer = null;
    this.isPrologueDemoActive = false;

    // 4.5秒の放置タイマーを開始
    this.resetPrologueIdleTimer();

    // デモコンテナまたはオーバーレイ全体のタップでゲーム開始
    const demoContainer = document.getElementById('prologue-demo-container');
    if (demoContainer) {
      demoContainer.addEventListener('click', (e) => {
        e.stopPropagation();
        this.startGame();
      });
    }

    const overlay = document.getElementById('start-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => {
        if (this.isPrologueDemoActive) {
          this.startGame();
        }
      });
    }
  }

  resetPrologueIdleTimer() {
    if (this.prologueIdleTimer) clearTimeout(this.prologueIdleTimer);
    if (this.isStarted) return;
    this.prologueIdleTimer = setTimeout(() => {
      this.startPrologueDemo();
    }, 4500);
  }

  startPrologueDemo() {
    if (this.isStarted || this.isPrologueDemoActive) return;
    const overlay = document.getElementById('start-overlay');
    const textEl = document.getElementById('prologue-demo-text');
    if (!overlay || !textEl) return;

    this.isPrologueDemoActive = true;
    overlay.classList.add('demo-mode');

    // 表示するプロローグ文を取得（DB設定優先 ➔ フォールバック）
    const currentSeason = (window.questApi && window.questApi.currentSeason) || {};
    const fallback = window.APP_CONFIG?.fallbackSeasonGuidance || {};
    const rawText = currentSeason.overview || fallback.overview || '大正区全域に広がる33の個性豊かな酒場をめぐるハシゴ酒RPG！\n各店自慢の限定「酔いどれセット」や「酒場クエスト」に挑み、ハシゴ酒の証を刻んで宝箱（酒場クーポン＆特製グッズ）を解放せよ！';

    textEl.innerHTML = '<span class="prologue-cursor"></span>';
    let index = 0;
    if (this.prologueTypingTimer) clearInterval(this.prologueTypingTimer);
    if (this.prologueLoopTimer) clearTimeout(this.prologueLoopTimer);

    // 1文字ずつタイプ表示
    this.prologueTypingTimer = setInterval(() => {
      if (this.isStarted || !this.isPrologueDemoActive) {
        clearInterval(this.prologueTypingTimer);
        return;
      }

      if (index < rawText.length) {
        index++;
        const currentSub = this.escapeHtml(rawText.substring(0, index)).replace(/\n/g, '<br>');
        textEl.innerHTML = currentSub + '<span class="prologue-cursor"></span>';
      } else {
        clearInterval(this.prologueTypingTimer);
        textEl.innerHTML = this.escapeHtml(rawText).replace(/\n/g, '<br>');

        // 読み終えてから約10秒間放置されたら、タイトル画面に戻してループ（アーケード風アトラクトモード）
        this.prologueLoopTimer = setTimeout(() => {
          this.stopPrologueDemo(false);
        }, 10000);
      }
    }, 45);
  }

  stopPrologueDemo(shouldCancelTimer = true) {
    this.isPrologueDemoActive = false;
    if (this.prologueTypingTimer) clearInterval(this.prologueTypingTimer);
    if (this.prologueLoopTimer) clearTimeout(this.prologueLoopTimer);
    if (this.prologueIdleTimer) clearTimeout(this.prologueIdleTimer);

    const overlay = document.getElementById('start-overlay');
    if (overlay) {
      overlay.classList.remove('demo-mode');
    }

    if (!shouldCancelTimer && !this.isStarted) {
      this.resetPrologueIdleTimer();
    }
  }

  startGame() {
    this.stopPrologueDemo(true);
    if (window.debugLog) window.debugLog('▶ PUSH STARTがクリックされました');
    
    // 即座にオーバーレイを非表示（CSSアニメーションとdisplay:none併用）
    const overlay = document.getElementById('start-overlay');
    if (overlay) {
      overlay.classList.add('fade-out');
      overlay.style.display = 'none';
      if (window.debugLog) window.debugLog('✨ スタートオーバーレイを非表示にしました');
    }
    this.isStarted = true;

    try {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.audioCtx = new AudioContext();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    } catch (e) {
      if (window.debugLog) window.debugLog('⚠️ 音声初期化スキップ: ' + e.message);
    }

    try {
      this.playStartSE();
    } catch (e) {}

    try {
      this.render();
    } catch (e) {
      console.error('Render error in startGame:', e);
    }
  }

  playTone(freq, duration, type = 'square') {
    if (!this.soundEnabled || !this.audioCtx) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {}
  }

  playCursorSE() {
    this.playTone(440, 0.05, 'square');
  }

  playSelectSE() {
    this.playTone(880, 0.08, 'square');
  }

  playBackSE() {
    this.playTone(330, 0.08, 'square');
  }

  /* ハンコ・スタンプ押下SE（ポンッ！という気持ちいい打撃音） */
  playStampSE() {
    if (!this.soundEnabled || !this.audioCtx) return;
    try {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const now = this.audioCtx.currentTime;

      // 1. 低音インパクト（ボムッ/ポンッ）
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(190, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.15);

      // 2. スタンプの紙接触アタック音（ピシッ）
      const clickOsc = this.audioCtx.createOscillator();
      const clickGain = this.audioCtx.createGain();
      clickOsc.type = 'square';
      clickOsc.frequency.setValueAtTime(600, now);
      clickOsc.frequency.exponentialRampToValueAtTime(100, now + 0.04);

      clickGain.gain.setValueAtTime(0.18, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      clickOsc.connect(clickGain);
      clickGain.connect(this.audioCtx.destination);
      clickOsc.start(now);
      clickOsc.stop(now + 0.06);
    } catch (e) {}
  }

  playFanfareSE() {
    if (!this.soundEnabled || !this.audioCtx) return;
    try {
      const now = this.audioCtx.currentTime;
      const notes = [
        { freq: 523.25, duration: 0.1, delay: 0 },      // C5
        { freq: 523.25, duration: 0.1, delay: 0.12 },   // C5
        { freq: 523.25, duration: 0.1, delay: 0.24 },   // C5
        { freq: 659.25, duration: 0.35, delay: 0.36 },  // E5
        { freq: 587.33, duration: 0.15, delay: 0.72 },  // D5
        { freq: 783.99, duration: 0.6, delay: 0.9 }     // G5
      ];
      notes.forEach(n => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(n.freq, now + n.delay);
        gain.gain.setValueAtTime(0.12, now + n.delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + n.delay + n.duration);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now + n.delay);
        osc.stop(now + n.delay + n.duration);
      });
    } catch (e) {}
  }

  /* ドラクエ完全再現 8bit レベルアップ・ファンファーレSE */
  playLevelUpSE() {
    if (!this.soundEnabled || !this.audioCtx) return;
    try {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const now = this.audioCtx.currentTime;

      // 共通トーン生成ヘルパー（ファミコンAPU再現）
      const playTone = (freq, startTime, duration, type = 'square', peakGain = 0.12, isLong = false) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);

        // クリックノイズ防止のアタック
        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.006);

        if (isLong) {
          // 最終ロングトーンはサステインを保ちつつ自然にディケイ
          gain.gain.setValueAtTime(peakGain, startTime + duration * 0.35);
          gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
        } else {
          // 歯切れの良いスタッカート
          gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
        }

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration + 0.02);
      };

      // テンポ設定（BPM 約160相当）
      const t16 = 0.075; // 16分音符 (75ms)
      const t8 = 0.15;   // 8分音符 (150ms)

      // --- 1. 主旋律 (Lead: 矩形波 50% パルス) ---
      // 冒頭の駆け上がり (ファ - ソ - ラ - シ♭)
      playTone(349.23, now,          t16 * 0.92, 'square', 0.12); // F4
      playTone(392.00, now + t16,    t16 * 0.92, 'square', 0.12); // G4
      playTone(440.00, now + t16 * 2, t16 * 0.92, 'square', 0.12); // A4
      playTone(466.16, now + t16 * 3, t16 * 0.92, 'square', 0.12); // Bb4

      // テッ・テッ・テッ・テー♪ (ド - ラ - ド - 高ファ)
      const phraseStart = now + t16 * 4;
      playTone(523.25, phraseStart,          t8 * 0.72, 'square', 0.13); // C5
      playTone(440.00, phraseStart + t8,     t8 * 0.72, 'square', 0.13); // A4
      playTone(523.25, phraseStart + t8 * 2, t8 * 0.72, 'square', 0.13); // C5
      playTone(698.46, phraseStart + t8 * 3, 1.15,      'square', 0.14, true); // F5

      // --- 2. 和音・ハモリ (Harmony: 矩形波 3度/6度下 & コードトーン) ---
      playTone(440.00, phraseStart,          t8 * 0.72, 'square', 0.08); // A4
      playTone(349.23, phraseStart + t8,     t8 * 0.72, 'square', 0.08); // F4
      playTone(440.00, phraseStart + t8 * 2, t8 * 0.72, 'square', 0.08); // A4
      playTone(523.25, phraseStart + t8 * 3, 1.15,      'square', 0.09, true); // C5
      playTone(440.00, phraseStart + t8 * 3, 1.15,      'square', 0.07, true); // A4

      // --- 3. ベース音 (Bass: ファミコン特有の三角波 Triangle) ---
      playTone(174.61, phraseStart,          t8 * 0.85, 'triangle', 0.14); // F3
      playTone(174.61, phraseStart + t8,     t8 * 0.85, 'triangle', 0.14); // F3
      playTone(174.61, phraseStart + t8 * 2, t8 * 0.85, 'triangle', 0.14); // F3
      playTone(174.61, phraseStart + t8 * 3, 1.15,      'triangle', 0.15, true); // F3
      playTone(87.31,  phraseStart + t8 * 3, 1.15,      'triangle', 0.12, true); // F2

    } catch (e) {
      console.warn('Level up sound failed:', e);
    }
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    const btn = document.getElementById('sound-toggle-btn');
    if (btn) {
      btn.textContent = this.soundEnabled ? '🔊 音声 ON' : '🔇 音声 OFF';
    }
    if (this.soundEnabled) this.playSelectSE();
  }

  /* ------------------------------------------------------------------------
   * イベント初期化
   * ------------------------------------------------------------------------ */
  initEvents() {
    // スタートボタン
    const startBtn = document.getElementById('start-game-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        if (window.debugLog) window.debugLog('🖱️ start-game-btn クリックイベント発火');
        this.startGame();
      });
    }

    // サウンド切り替えボタン
    const soundBtn = document.getElementById('sound-toggle-btn');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => this.toggleSound());
    }

    // ヘッダー「◀ もどる」ボタン
    const headerBackBtn = document.getElementById('header-back-btn');
    if (headerBackBtn) {
      headerBackBtn.addEventListener('click', () => {
        if (window.debugLog) window.debugLog('🖱️ ヘッダーもどるボタン クリック');
        this.goBack();
      });
    }

    // スティッキー絞り込みバーのタップで最上部（絞り込みフォーム）へスムーズスクロール
    const stickyBar = document.getElementById('sticky-filter-bar');
    if (stickyBar) {
      stickyBar.addEventListener('click', () => {
        this.playSelectSE();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // ブラウザバック / スワイプ戻りイベント (PopState)
    window.addEventListener('popstate', (e) => {
      this.handlePopState(e);
    });

    // スクロール時のスマート絞り込みバー表示制御
    window.addEventListener('scroll', () => {
      this.updateStickyFilterBar();
    });

    // ナビゲーションバー
    const navItems = document.querySelectorAll('.nav-item');
    if (window.debugLog) window.debugLog('ナビゲーション登録件数: ' + navItems.length);

    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const targetView = item.dataset.targetView;
        if (window.debugLog) window.debugLog('🖱️ ナビクリック: ' + targetView);

        if (targetView === 'qr-scan' || item.id === 'nav-btn-qr-scan') {
          e.preventDefault();
          this.playSelectSE();
          this.openQrScannerModal();
          return;
        }

        if (targetView === 'map' || item.id === 'nav-btn-map') {
          e.preventDefault();
          this.playSelectSE();
          window.open('https://maps.app.goo.gl/SqskFzoxuso7NwwL8', '_blank');
          return;
        }

        e.preventDefault();
        if (targetView) {
          this.playSelectSE();
          if (targetView === 'stores-all') {
            if (this.currentView === 'stores') {
              this.resetFilters();
            }
            this.navigateTo('stores');
          } else {
            this.navigateTo(targetView);
          }
        }
      });
    });
  }

  /* ------------------------------------------------------------------------
   * スティッキースマート絞り込みバーの動的更新
   * ------------------------------------------------------------------------ */
  updateStickyFilterBar() {
    const stickyBar = document.getElementById('sticky-filter-bar');
    if (!stickyBar) return;

    if (this.currentView !== 'stores') {
      stickyBar.classList.add('hidden');
      return;
    }

    // 絞り込み条件ウィンドウが画面上部にスクロールアウトしたかを判定
    const filterWindow = document.getElementById('store-filter-window');
    let shouldShow = false;
    
    if (filterWindow) {
      const rect = filterWindow.getBoundingClientRect();
      // ウィンドウの下端がヘッダー（46px）の下を通過したら表示
      shouldShow = rect.bottom <= 50;
    } else {
      const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
      shouldShow = scrollY > 150;
    }

    if (shouldShow) {
      stickyBar.classList.remove('hidden');
    } else {
      stickyBar.classList.add('hidden');
    }

    // 条件タグのテキスト生成
    const tagsContainer = document.getElementById('sticky-filter-tags');
    if (tagsContainer) {
      const activeTags = [];
      if (this.filters.area !== 'ALL') activeTags.push(`<span class="sticky-tag-item">📍 ${this.filters.area}</span>`);
      if (this.filters.category !== 'ALL') activeTags.push(`<span class="sticky-tag-item">${this.filters.category}</span>`);
      if (this.filters.style !== 'ALL') activeTags.push(`<span class="sticky-tag-item">🪑 ${this.filters.style}</span>`);
      if (this.filters.type !== 'ALL') activeTags.push(`<span class="sticky-tag-item">🍺 ${this.filters.type}</span>`);
      if (this.filters.takeout === 'YES') activeTags.push(`<span class="sticky-tag-item">テイクアウト可</span>`);
      if (this.filters.openToday) activeTags.push(`<span class="sticky-tag-item text-green">✓ どれクエ対応中</span>`);
      if (this.filters.organizer) activeTags.push(`<span class="sticky-tag-item" style="color:#93c5fd;">運営店のみ</span>`);
      if (this.filters.searchQuery) activeTags.push(`<span class="sticky-tag-item">🔎 ${this.filters.searchQuery}</span>`);

      let count = 0;
      count = this.getStores().filter(store => {
        if (this.filters.organizer && !store.isOrganizer) return false;
        if (this.filters.area !== 'ALL' && store.area !== this.filters.area) return false;
        if (this.filters.category !== 'ALL' && store.category !== this.filters.category) return false;
        if (this.filters.style !== 'ALL' && store.style !== this.filters.style) return false;
        if (this.filters.type !== 'ALL' && store.type !== this.filters.type) return false;
        if (this.filters.takeout === 'YES' && !store.isTakeout) return false;
        if (this.filters.openToday && !store.isOpenToday) return false;
        if (this.filters.searchQuery) {
          const q = this.filters.searchQuery.toLowerCase().trim();
          return store.name.toLowerCase().includes(q) || store.catchphrase.toLowerCase().includes(q);
        }
        return true;
      }).length;

      if (activeTags.length > 0) {
        tagsContainer.innerHTML = `
          <span class="sticky-icon">🔍</span>
          <div style="display:flex; gap:4px; align-items:center; overflow:hidden;">
            ${activeTags.join('')}
            <span style="font-size:12px; color:#ffffff; font-weight:bold; margin-left:4px;">(${count}軒)</span>
          </div>
        `;
      } else {
        tagsContainer.innerHTML = `
          <span class="sticky-icon">🍺</span>
          <span>全酒場一覧 (${count}軒)</span>
        `;
      }
    }
  }

  /* ------------------------------------------------------------------------
   * 1つ前の画面に戻る処理
   * ------------------------------------------------------------------------ */
  goBack() {
    this.playBackSE();
    if (window.history.length > 1) {
      window.history.back();
    } else {
      // 履歴がない場合のフォールバック
      if (this.currentView === 'detail') {
        this.navigateTo('stores');
      } else {
        this.navigateTo('top');
      }
    }
  }

  /* ------------------------------------------------------------------------
   * ブラウザバック・スワイプ戻り時のハンドリング
   * ------------------------------------------------------------------------ */
  handlePopState(e) {
    this.playBackSE();
    if (e.state && e.state.view) {
      if (e.state.filters) {
        this.filters = { ...e.state.filters };
      }
      if (e.state.selectedStoreId && typeof STORES_DATA !== 'undefined') {
        this.selectedStore = STORES_DATA.find(s => s.id === e.state.selectedStoreId) || null;
      }
      this.navigateTo(e.state.view, null, true);
    } else {
      // stateが無い場合はトップ画面へ
      this.navigateTo('top', null, true);
    }
  }

  resetFilters() {
    this.filters = {
      area: 'ALL',
      category: 'ALL',
      style: 'ALL',
      type: 'ALL',
      takeout: 'ALL',
      openToday: false,
      organizer: false,
      searchQuery: ''
    };
    this.lastStoresScrollY = 0;
    this.updateHistoryFilters();
  }

  /* ------------------------------------------------------------------------
   * 現在の履歴ステートの絞り込み条件を最新に同期
   * ------------------------------------------------------------------------ */
  updateHistoryFilters() {
    try {
      if (window.history && window.history.replaceState) {
        const currentState = window.history.state || {};
        window.history.replaceState({
          ...currentState,
          view: this.currentView,
          selectedStoreId: this.selectedStore ? this.selectedStore.id : null,
          filters: { ...this.filters }
        }, '');
      }
    } catch (e) {
      console.warn('history.replaceState is not supported in this context:', e);
    }
  }

  /* ------------------------------------------------------------------------
   * 画面遷移とメッセージ更新
   * ------------------------------------------------------------------------ */
  navigateTo(view, extraData = null, isPopState = false) {
    if (view === 'map') {
      window.open('https://maps.app.goo.gl/SqskFzoxuso7NwwL8', '_blank');
      return;
    }

    // 店舗一覧画面から別画面（詳細など）へ遷移する際、現在のスクロール位置を保存
    if (this.currentView === 'stores' && view !== 'stores') {
      this.lastStoresScrollY = window.scrollY || window.pageYOffset || (document.documentElement ? document.documentElement.scrollTop : 0) || 0;
    }

    this.currentView = view;
    if (extraData && extraData.store) {
      this.selectedStore = extraData.store;
    }

    // History API に画面状態をプッシュ (popstate による遷移でない場合のみ - file://でのエラー対策)
    try {
      if (!isPopState && window.history && window.history.pushState) {
        window.history.pushState({
          view: view,
          selectedStoreId: this.selectedStore ? this.selectedStore.id : null,
          filters: { ...this.filters }
        }, '');
      }
    } catch (e) {
      console.warn('history.pushState is not supported in this context:', e);
    }

    // ヘッダー「◀ もどる」ボタンの表示/非表示切り替え (トップ画面以外で表示)
    const headerBackBtn = document.getElementById('header-back-btn');
    if (headerBackBtn) {
      if (view === 'top') {
        headerBackBtn.classList.add('hidden');
      } else {
        headerBackBtn.classList.remove('hidden');
      }
    }

    // ボトムナビのハイライト更新
    document.querySelectorAll('.nav-item').forEach(nav => {
      nav.classList.remove('active');
      if (nav.dataset.targetView === view) {
        nav.classList.add('active');
      }
    });

    this.render();
    this.updateStickyFilterBar();

    // 店舗一覧画面に戻ってきた場合は前回のスクロール位置を復元、それ以外は最上部へ
    if (view === 'stores' && this.lastStoresScrollY > 0) {
      const targetY = this.lastStoresScrollY;
      requestAnimationFrame(() => {
        window.scrollTo(0, targetY);
      });
      setTimeout(() => {
        window.scrollTo(0, targetY);
      }, 50);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // メッセージウィンドウのタイピング演出
  typeMessage(text) {
    const msgEl = document.getElementById('rpg-message-text');
    if (!msgEl) return;
    msgEl.textContent = '';
    let i = 0;
    
    // 既存タイマーをクリア
    if (this.msgTimer) clearInterval(this.msgTimer);

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    this.msgTimer = setInterval(() => {
      if (i < text.length) {
        msgEl.textContent += text.charAt(i);
        if (i % 2 === 0) this.playTone(300 + Math.random() * 100, 0.02, 'sine');
        i++;
      } else {
        clearInterval(this.msgTimer);
      }
    }, 25);
  }

  // アプリ共通フッターバージョン表示HTML
  getFooterVersionHTML() {
    const v = (window.APP_CONFIG && window.APP_CONFIG.version) || 'v2026.10.15.01';
    return `
      <div class="app-footer-version">
        <div>大正酔いどれクエスト 公式ガイド</div>
        <div class="version-pill">
          <span>⚙️ app version:</span>
          <strong style="color:#e2e8f0;">${v}</strong>
        </div>
      </div>
    `;
  }

  /* ------------------------------------------------------------------------
   * メインレンダリングルーティン
   * ------------------------------------------------------------------------ */
  render() {
    const stores = this.getStores();
    // 各店舗の今日・現在営業フラグを動的に更新
    if (typeof checkIsOpenToday === 'function' && stores.length > 0) {
      stores.forEach(store => {
        store.isOpenToday = checkIsOpenToday(store);
      });
    }

    const container = document.getElementById('view-container');
    if (!container) return;

    container.innerHTML = '';

    switch (this.currentView) {
      case 'top':
        this.renderTopView(container);
        break;
      case 'quest-book':
        this.renderQuestBookView(container);
        break;
      case 'area':
        this.renderAreaView(container);
        break;
      case 'category':
        this.renderCategoryView(container);
        break;
      case 'style':
        this.renderStyleView(container);
        break;
      case 'type':
        this.renderTypeView(container);
        break;
      case 'stores':
        this.renderStoresView(container);
        break;
      case 'detail':
        this.renderDetailView(container);
        break;
      default:
        this.renderTopView(container);
    }
  }

  /* ------------------------------------------------------------------------
   * 開催ステータス告知バナー生成（メッセージウィンドウへ統合のため空返却）
   * ------------------------------------------------------------------------ */
  getSeasonBannerHTML() {
    return '';
  }

  /* ------------------------------------------------------------------------
   * 3.1 トップ画面 (酒場案内所)
   * ------------------------------------------------------------------------ */
  renderTopView(container) {
    const allStores = this.getStores();
    const organizerCount = allStores.filter(s => s.isOrganizer).length;
    const takeoutCount = allStores.filter(s => s.isTakeout).length;
    const openCount = allStores.filter(s => s.isOpenToday).length;
    const totalCount = allStores.length;
    const areaCount = this.getAreas().length;
    const catCount = this.getCategories().length;
    const styleCount = this.getStyles().length;
    const typeCount = this.getTypes().length;

    const currentSeason = (window.questApi && window.questApi.currentSeason) || {};
    const fallback = window.APP_CONFIG?.fallbackSeasonGuidance || {};
    const guideSteps = (currentSeason.guide_steps && currentSeason.guide_steps.length > 0) ? currentSeason.guide_steps : (fallback.guide_steps || []);
    const rulesNotes = currentSeason.rules_notes || fallback.rules_notes || '';

    // 開催ステータスに応じた動的メッセージ設定
    const statusInfo = currentSeason.statusInfo;
    let topMessage = '大正酔いどれクエストへようこそ！コマンドを選んで酒場を探そう！楽しみ方は下の【冒険の心得】をチェック！';

    if (statusInfo) {
      if (statusInfo.isEventActive) {
        const seasonName = currentSeason.name || '大正酔いどれクエスト';
        const daysLeftText = (statusInfo.daysLeft !== undefined) ? `（残り${statusInfo.daysLeft}日）` : '';
        topMessage = `【${seasonName} 開催中！】${daysLeftText}コマンドを選んで酒場を探そう！`;
      } else if (statusInfo.isCouponActive) {
        const couponEndStr = currentSeason.coupon_valid_until ? `利用期限は${this.formatShortDateWithDay(currentSeason.coupon_valid_until)}まで！` : '';
        topMessage = `【後夜祭・クーポン利用期間中】${couponEndStr}コマンドを選んで酒場を探そう！`;
      } else if (statusInfo.isExpired) {
        topMessage = '大正酔いどれクエストは終了しました。ご参加ありがとうございました！';
      }
    }

    if (this.isStarted) {
      this.typeMessage(topMessage);
    }

    container.innerHTML = `
      <!-- コマンド選択 -->
      <div class="rpg-window gold-border">
        <div class="rpg-window-header">
          <span>▶ コマンド選択</span>
        </div>
        <ul class="command-list">
          <li class="command-item" data-action="area">
            <div class="command-item-left">
              <span class="command-cursor">▶</span>
              <span class="command-label">エリアから探す</span>
            </div>
            <span class="command-badge">${areaCount}エリア</span>
          </li>
          <li class="command-item" data-action="category">
            <div class="command-item-left">
              <span class="command-cursor">▶</span>
              <span class="command-label">酒場の種類から探す</span>
            </div>
            <span class="command-badge">${catCount}種類</span>
          </li>
          <li class="command-item" data-action="style">
            <div class="command-item-left">
              <span class="command-cursor">▶</span>
              <span class="command-label">席スタイルから探す</span>
            </div>
            <span class="command-badge">${styleCount}スタイル</span>
          </li>
          <li class="command-item" data-action="type">
            <div class="command-item-left">
              <span class="command-cursor">▶</span>
              <span class="command-label">酔いどれタイプから探す</span>
            </div>
            <span class="command-badge">${typeCount}タイプ</span>
          </li>
          <li class="command-item" data-action="today">
            <div class="command-item-left">
              <span class="command-cursor">▶</span>
              <span class="command-label">どれクエ対応中の酒場</span>
            </div>
            <span class="command-badge text-green">対応中 ${openCount}軒</span>
          </li>
          <li class="command-item" data-action="takeout">
            <div class="command-item-left">
              <span class="command-cursor">▶</span>
              <span class="command-label">テイクアウトOKな酒場</span>
            </div>
            <span class="command-badge">${takeoutCount}軒</span>
          </li>
          <li class="command-item" data-action="organizer">
            <div class="command-item-left">
              <span class="command-cursor">▶</span>
              <span class="command-label">運営店一覧</span>
            </div>
            <span class="command-badge" style="background:#1e3a8a; color:#93c5fd; border:1px solid #3b82f6;">QR設置 ${organizerCount}軒</span>
          </li>
        </ul>
      </div>

      <!-- 冒険の心得（常時オープン表示） -->
      <div class="rpg-window gold-border" style="margin-top:14px;">
        <div class="rpg-window-header">
          <span>📜 冒険の心得</span>
        </div>
        <div style="padding:10px 6px 8px; display:flex; flex-direction:column; gap:12px;">
          ${guideSteps.map((st, idx) => `
            <div class="guide-step-card">
              <div class="guide-step-header">
                <span>${idx === 0 ? '⚔️' : (idx === 1 ? '📱' : '🎁')}</span>
                <span>${this.escapeHtml(st.step || `其の${idx+1}`)}【${this.escapeHtml(st.title || '')}】</span>
              </div>
              <div class="guide-step-desc">${this.escapeHtml(st.desc || '')}</div>
            </div>
          `).join('')}

          ${rulesNotes ? `
            <div class="guide-rules-box">
              <div class="guide-rules-title">
                <i class="fa-solid fa-shield-halved"></i> 冒険の心得（注意事項）
              </div>
              <div class="guide-rules-content">
                ${this.escapeHtml(rulesNotes).replace(/\n/g, '<br>')}
              </div>
            </div>
          ` : ''}
        </div>
      </div>

      ${this.getFooterVersionHTML()}
    `;

    // コマンドクリックイベント
    container.querySelectorAll('.command-item').forEach(item => {
      item.addEventListener('mouseenter', () => this.playCursorSE());
      item.addEventListener('click', () => {
        this.playSelectSE();
        const action = item.dataset.action;
        if (action === 'area') this.navigateTo('area');
        else if (action === 'category') this.navigateTo('category');
        else if (action === 'style') this.navigateTo('style');
        else if (action === 'type') this.navigateTo('type');
        else if (action === 'today') {
          this.resetFilters();
          this.filters.openToday = true;
          this.navigateTo('stores');
        }
        else if (action === 'organizer') {
          this.resetFilters();
          this.filters.organizer = true;
          this.navigateTo('stores');
        }
        else if (action === 'takeout') {
          this.resetFilters();
          this.filters.takeout = 'YES';
          this.navigateTo('stores');
        }
      });
    });
  }

  /* ------------------------------------------------------------------------
   * 冒険の書 (Quest Book / Passport) 画面 (即時同期レンダリング)
   * ------------------------------------------------------------------------ */
  renderQuestBookView(container) {
    const user = (window.questApi && window.questApi.currentUser) || {
      displayName: '酔いどれ勇者',
      pictureUrl: 'assets/banner.png'
    };

    const activeSeason = window.questApi?.currentSeason || { id: 2, name: '大正酔いどれクエスト' };
    const seasonId = activeSeason.id || 2;
    const seasonName = activeSeason.name || '大正酔いどれクエスト';

    // メモリ上のキャッシュデータから即時同期レンダリング (0ms)
    const seasonStores = this.getStores(seasonId);
    const seasonVisits = window.questApi?.visits || [];
    const seasonRewardTiers = (window.questApi?.rewardTiers && window.questApi.rewardTiers.length > 0)
      ? window.questApi.rewardTiers 
      : (window.APP_CONFIG?.fallbackRewardTiers || []);
    const seasonCoupons = window.questApi?.userCoupons || [];

    // 参加店舗のみを対象とする
    const stores = (seasonStores || []).filter(s => s.is_participating !== false);
    const totalStores = stores.length || 33;
    const visits = seasonVisits || [];
    const userCoupons = seasonCoupons || [];
    const rewardTiers = seasonRewardTiers;

    // 獲得済みマイルストーン段階数の算出
    const unlockedTiers = rewardTiers.filter(t => userCoupons.some(c => Number(c.reward_tier_id) === Number(t.id) || (t.reward_type === 'goods' && (c.goods_name === t.goods_name || c.goods_name === t.title))));
    const unlockedTierCount = unlockedTiers.length;

    // 称号・レベル計算 (特典マイルストーン達成段階連動)
    const matchedHero = this.getHeroTitleForTierCount(unlockedTierCount);
    const heroTitle = matchedHero.title || '駆け出しの呑兵衛';
    const heroLv = matchedHero.level || (1 + unlockedTierCount);
    const heroColor = matchedHero.badge_color || '#facc15';
    const heroDesc = matchedHero.description || '';

    const info = activeSeason?.statusInfo;
    const isExpired = info ? info.isExpired : false;
    const isCouponUsable = info ? info.isCouponUsable : true;
    const couponStartDateStr = info?.couponStartDateStr || '';

    // 冒険の書ナビゲーションメッセージの動的設定
    const availableCoupons = userCoupons.filter(c => c.reward_type !== 'goods' && c.status !== 'used');
    const hasAnyCouponTier = userCoupons.some(c => c.reward_type !== 'goods');
    const hasAvailableCoupons = availableCoupons.length > 0;
    const hasAllUsedCoupons = hasAnyCouponTier && availableCoupons.length === 0;

    if (isExpired) {
      this.typeMessage('イベント期間は終了しました。これまでの冒険の記録をご確認いただけます。');
    } else if (!isCouponUsable && couponStartDateStr) {
      if (unlockedTierCount > 0) {
        this.typeMessage(`特典解放済み！酒場クーポンの利用開始は ${this.formatShortDateWithDay(couponStartDateStr)} から！お楽しみに！`);
      } else {
        this.typeMessage(`店主のサインを集めて特典を解放しよう！酒場クーポンの利用開始は ${this.formatShortDateWithDay(couponStartDateStr)} から！`);
      }
    } else if (hasAvailableCoupons) {
      this.typeMessage('酒場クーポンが使えるぞ！下の『酒場を選んでクーポンを使う』からお店を選ぼう！');
    } else if (hasAllUsedCoupons) {
      this.typeMessage('獲得した酒場クーポンはすべて利用済みです！大正の酒場巡りをお楽しみください！');
    } else {
      this.typeMessage('紙の冒険の書に店主のサインが集まったら、運営店でQRを読み込んで特典を解放しよう！');
    }

    // 特典・クーポン統合カードのレンダリング
    // 全利用済みクーポン（グッズ除外）をランクごとにスマートに割り当て
    const allUsedCoupons = userCoupons.filter(c => c.reward_type !== 'goods' && c.status === 'used' && c.store_id);
    const tierCouponMap = new Map();
    rewardTiers.forEach(t => tierCouponMap.set(Number(t.id), []));

    const unassignedCoupons = [];
    allUsedCoupons.forEach(c => {
      const tId = Number(c.reward_tier_id);
      if (tId && tierCouponMap.has(tId)) {
        tierCouponMap.get(tId).push(c);
      } else {
        unassignedCoupons.push(c);
      }
    });

    const couponTiers = rewardTiers.filter(t => t.reward_type !== 'goods');
    let unassignedIdx = 0;
    for (const t of couponTiers) {
      const assigned = tierCouponMap.get(Number(t.id));
      const limit = Number(t.selectable_count) || 5;
      while (assigned && assigned.length < limit && unassignedIdx < unassignedCoupons.length) {
        assigned.push(unassignedCoupons[unassignedIdx]);
        unassignedIdx++;
      }
    }
    if (unassignedIdx < unassignedCoupons.length && couponTiers.length > 0) {
      const lastTierId = Number(couponTiers[couponTiers.length - 1].id);
      const lastAssigned = tierCouponMap.get(lastTierId);
      if (lastAssigned) {
        while (unassignedIdx < unassignedCoupons.length) {
          lastAssigned.push(unassignedCoupons[unassignedIdx]);
          unassignedIdx++;
        }
      }
    }

    // 合計の獲得クーポン回数と利用可能残数を計算
    let totalEarnedSlots = 0;
    let totalUsedSlots = 0;

    // 1. クーポン型特典の一覧HTML（A案：スリム＆シンプルカード）
    const couponTiersList = rewardTiers.filter(t => t.reward_type !== 'goods');
    const couponsHtml = (couponTiersList.length > 0) ? couponTiersList.map(tier => {
      const isReached = userCoupons.some(c => Number(c.reward_tier_id) === Number(tier.id));
      const maxCount = tier.selectable_count || 5;
      const usedCoupons = tierCouponMap.get(Number(tier.id)) || [];
      const usedCount = usedCoupons.length;
      const remainCount = Math.max(0, maxCount - usedCount);
      const isAllUsed = isReached && remainCount === 0;

      if (isReached) {
        totalEarnedSlots += maxCount;
        totalUsedSlots += usedCount;
      }

      let statusBadge = '';
      let actionHtml = '';
      const stampHtml = isAllUsed ? `<div class="treasure-card-stamp-used">USED</div>` : '';

      if (isAllUsed) {
        statusBadge = '';
      } else if (isReached) {
        statusBadge = `<span class="treasure-tier-status status-unlocked" style="background:#0284c7; border-color:#38bdf8;">✨ 利用可能 (${remainCount}/${maxCount}回)</span>`;
      } else {
        statusBadge = `<span class="treasure-tier-status status-locked">🔒 未達成 (${tier.required_visits}軒)</span>`;
      }

      // 利用済み店舗の履歴HTML
      let historyHtml = '';
      if (usedCount > 0) {
        const historyItems = usedCoupons.map(c => {
          const st = stores.find(s => s.id === c.store_id) || c.stores || {};
          const storeName = st.name || c.store_id || '酒場';
          const usedTimeStr = c.used_at ? new Date(c.used_at).toLocaleDateString('ja-JP', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '利用済';
          return `
            <div class="tier-usage-item used" style="display:flex; justify-content:space-between; align-items:center; padding:7px 10px; border-radius:6px; font-size:12px;">
              <span class="usage-store-name" style="font-weight:bold; color:#f1f5f9; display:flex; align-items:center; gap:6px;">
                <i class="fa-solid fa-award" style="color:#f59e0b; font-size:12px;"></i> ${this.escapeHtml(storeName)}
              </span>
              <span class="usage-date" style="font-size:11px; color:#94a3b8;">${usedTimeStr}</span>
            </div>
          `;
        }).join('');

        historyHtml = `
          <div class="tier-usage-history-box" style="width:100%; box-sizing:border-box; margin-bottom:10px; background:rgba(15,23,42,0.75); border:1px solid rgba(217,119,6,0.35); border-radius:8px; padding:8px 10px;">
            <div style="color:#fbbf24; font-weight:bold; margin-bottom:6px; font-size:12px; display:flex; align-items:center; gap:6px;">
              <i class="fa-solid fa-scroll"></i> クーポン利用履歴（${usedCount} / ${maxCount} 軒）
            </div>
            <div class="tier-history-list" style="display:flex; flex-direction:column; gap:5px;">
              ${historyItems}
            </div>
          </div>
        `;
      }

      if (isAllUsed) {
        actionHtml = historyHtml;
      } else if (isReached) {
        if (isExpired) {
          actionHtml = `
            ${historyHtml}
            <div style="width:100%; box-sizing:border-box; padding:10px; text-align:center; color:#ef4444; font-weight:bold; font-size:13px; background:rgba(239,68,68,0.1); border-radius:6px;">🔒 クーポン利用期間は終了しました</div>
          `;
        } else {
          const btnText = usedCount === 0 
            ? `🎁 酒場を選んでクーポンを使う (残り${remainCount}軒)` 
            : `🎁 続けてクーポンを使う (残り${remainCount}軒)`;
          actionHtml = `
            ${historyHtml}
            <button class="treasure-claim-btn btn-direct-open-store-coupon" data-tier-id="${tier.id}" style="width:100%; box-sizing:border-box; display:block; background:linear-gradient(180deg, #eab308 0%, #ca8a04 100%); border-color:#fde047; font-weight:bold; font-size:13px; padding:11px 8px; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">
              ${btnText}
            </button>
          `;
        }
      }

      return `
        <div class="treasure-tier-card ${isReached ? 'unlocked' : ''}" style="position:relative; overflow:hidden;">
          ${stampHtml}
          <div class="treasure-tier-topbar">
            <span class="treasure-tier-type-badge badge-coupon">🍺 酒場クーポン (${maxCount}回分)</span>
            ${statusBadge}
          </div>
          <div class="treasure-tier-title-row">
            <h4 class="treasure-tier-title">🏆 ${this.escapeHtml(tier.title)}</h4>
          </div>
          <div class="treasure-tier-condition">
            <span>🍺 条件: <strong class="text-yellow">${tier.required_visits}軒ハシゴ</strong></span>
            <span> | 🎟️ <strong style="color:#ffffff;">お好きな${maxCount}軒で利用可能</strong></span>
          </div>
          ${actionHtml ? `<div class="treasure-tier-action">${actionHtml}</div>` : ''}
        </div>
      `;
    }).join('') : '<div style="padding:15px; text-align:center; color:#e2e8f0; font-size:14px;">クーポン特典はありません</div>';

    // 2. グッズ記念品型特典の一覧HTML（A案：スリム＆シンプルカード）
    const goodsTiersList = rewardTiers.filter(t => t.reward_type === 'goods');
    const goodsHtml = (goodsTiersList.length > 0) ? goodsTiersList.map(tier => {
      const goodsCoupons = userCoupons.filter(c => c.reward_type === 'goods' && (Number(c.reward_tier_id) === Number(tier.id) || c.goods_name === tier.goods_name || c.goods_name === tier.title));
      const usedGoodsCoupon = goodsCoupons.find(c => c.status === 'used');
      const activeGoodsCoupon = goodsCoupons.find(c => c.status !== 'used');
      const goodsCoupon = usedGoodsCoupon || activeGoodsCoupon || goodsCoupons[0];
      const isClaimed = Boolean(goodsCoupon);
      const isReached = isClaimed;
      const isUsed = Boolean(usedGoodsCoupon) || goodsCoupon?.status === 'used';

      let actionHtml = '';
      let statusBadge = '';
      const stampHtml = isUsed ? `<div class="treasure-card-stamp-used">USED</div>` : '';

      if (isUsed) {
        statusBadge = '';
        actionHtml = `
          <div style="font-size:12px; color:#94a3b8; text-align:center; padding:4px 0;">
            受取日時: ${new Date(goodsCoupon?.used_at || goodsCoupon?.acquired_at || Date.now()).toLocaleString('ja-JP')}
          </div>
        `;
      } else if (isReached) {
        statusBadge = '<span class="treasure-tier-status status-unlocked">🎁 引換可能</span>';
        actionHtml = `
          <button class="treasure-claim-btn btn-view-goods" data-tier-id="${tier.id}" style="background:linear-gradient(180deg, #d97706 0%, #b45309 100%); border-color:#f59e0b; margin-top:6px; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">
            🎁 記念品を受け取る
          </button>
        `;
      } else {
        statusBadge = `<span class="treasure-tier-status status-locked">🔒 未達成 (${tier.required_visits}軒)</span>`;
      }

      return `
        <div class="treasure-tier-card ${isReached || isClaimed ? 'unlocked' : ''}" style="position:relative; overflow:hidden;">
          ${stampHtml}
          <div class="treasure-tier-topbar">
            <span class="treasure-tier-type-badge badge-goods">🎁 グッズ引換</span>
            ${statusBadge}
          </div>
          <div class="treasure-tier-title-row">
            <h4 class="treasure-tier-title">🏆 ${this.escapeHtml(tier.title)}</h4>
          </div>
          <div class="treasure-tier-condition">
            <span>🍺 条件: <strong class="text-yellow">${tier.required_visits}軒ハシゴ</strong></span>
            <span> | 🎁 <strong style="color:#ffffff;">${this.escapeHtml(tier.goods_name || tier.title || '記念品')}</strong></span>
          </div>
          ${tier.exchange_location ? `
            <div class="treasure-tier-location" style="font-size:12px; color:#cbd5e1; margin-top:2px;">📍 <strong>引換場所:</strong> ${this.escapeHtml(tier.exchange_location)}</div>
          ` : ''}
          ${tier.exchange_notice ? `
            <div class="treasure-tier-notice" style="font-size:11.5px; color:#fbbf24; margin-top:2px;">⚠️ ${this.escapeHtml(tier.exchange_notice)}</div>
          ` : ''}
          ${actionHtml ? `<div class="treasure-tier-action">${actionHtml}</div>` : ''}
        </div>
      `;
    }).join('') : '<div style="padding:15px; text-align:center; color:#e2e8f0; font-size:14px;">記念品グッズはありません</div>';

    const seasonStartDate = activeSeason?.start_date || (seasonId === 2 ? window.APP_CONFIG?.eventPeriod?.startDate : '');
    const seasonEndDate = activeSeason?.end_date || (seasonId === 2 ? window.APP_CONFIG?.eventPeriod?.endDate : '');
    const seasonCouponUntil = activeSeason?.coupon_valid_until;
    const seasonPeriodStr = (seasonStartDate && seasonEndDate)
      ? `${this.formatDateWithDay(seasonStartDate)} 〜 ${this.formatDateWithDay(seasonEndDate)}`
      : '';

    const remainingAvailableCoupons = Math.max(0, totalEarnedSlots - totalUsedSlots);

    container.innerHTML = `
      <div class="quest-book-container">
        <!-- 1. 勇者ステータス（ドラクエ風クラシックステータス枠） -->
        <div class="rpg-window gold-border hero-status-window" style="margin-bottom:14px;">
          <div class="rpg-window-header header-gold">
            <span>▶ 冒険者のステータス</span>
            <span class="header-badge" style="background:#b45309; border:1px solid #fde047; color:#fff; padding:1px 6px; border-radius:4px; font-size:11px;">Lv.${heroLv}</span>
          </div>
          <div class="hero-status-body" style="display:flex; gap:12px; align-items:center;">
            <div class="hero-avatar-wrap" style="flex-shrink:0; text-align:center;">
              <img src="${user.pictureUrl || 'assets/banner.png'}" alt="Avatar" class="hero-avatar" onerror="this.src='assets/banner.png';" style="width:54px; height:54px; border:2px solid var(--border-gold); border-radius:8px; object-fit:cover; display:block;">
            </div>
            <div class="hero-status-grid" style="flex:1; min-width:0; display:flex; flex-direction:column; gap:5px; font-size:12.5px;">
              <div style="display:grid; grid-template-columns:82px 1fr; align-items:center; border-bottom:1px dashed rgba(248,225,108,0.25); padding-bottom:3px;">
                <span style="color:#94a3b8; font-size:11px; flex-shrink:0;">なまえ</span>
                <span style="color:#ffffff; font-weight:bold; font-size:13.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-align:left;">${this.escapeHtml ? this.escapeHtml(user.displayName) : user.displayName}</span>
              </div>
              <div style="display:grid; grid-template-columns:82px 1fr; align-items:center; border-bottom:1px dashed rgba(248,225,108,0.25); padding-bottom:3px;">
                <span style="color:#94a3b8; font-size:11px; flex-shrink:0;">しょうごう</span>
                <span style="color:${heroColor}; font-weight:bold; display:inline-flex; align-items:center; gap:4px; text-shadow:0 0 6px ${heroColor}55; text-align:left; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                  <i class="fa-solid fa-medal" style="font-size:11px; flex-shrink:0;"></i> <span>${heroTitle}</span>
                </span>
              </div>
              <div style="display:grid; grid-template-columns:82px 1fr; align-items:center;">
                <span style="color:#94a3b8; font-size:11px; flex-shrink:0;">酒場クーポン</span>
                <span style="color:#fde047; font-weight:bold; text-align:left;">
                  ${remainingAvailableCoupons > 0 ? `🎫 残り ${remainingAvailableCoupons} 軒分` : (unlockedTierCount > 0 ? '全利用済み' : '未解放')}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. ハシゴ達成・酒場クーポン一覧 -->
        <div class="rpg-window window-gold gold-border" style="margin-bottom:14px;">
          <div class="rpg-window-header header-gold">
            <span>🍺 ハシゴ達成・酒場クーポン</span>
          </div>
          <div style="margin-top:10px;">
            ${couponsHtml}
          </div>
        </div>

        <!-- 3. ハシゴ達成・記念グッズ引換一覧 -->
        <div class="rpg-window window-gold gold-border" style="margin-bottom:14px;">
          <div class="rpg-window-header header-gold">
            <span>🎁 ハシゴ達成・記念グッズ</span>
          </div>
          <div style="margin-top:10px;">
            ${goodsHtml}
          </div>
        </div>

        <!-- 4. ハシゴ酒・特典受取のながれ（最下部へ移動したガイド） -->
        <div class="rpg-window window-green" style="margin-bottom:14px;">
          <div class="rpg-window-header header-green">
            <span>📜 特典獲得＆酒場クーポンの使い方</span>
          </div>
          <div style="padding:10px 4px 6px; font-size:12px; color:#e2e8f0; line-height:1.6;">
            <div style="margin-bottom:6px; display:flex; align-items:flex-start; gap:6px;">
              <span style="color:#fde047; font-weight:bold; flex-shrink:0;">①</span>
              <span><strong>紙の冒険の書</strong>に、各酒場で酔いどれセット、または店舗クエストを攻略し、店主のサインを集めます。</span>
            </div>
            <div style="margin-bottom:6px; display:flex; align-items:flex-start; gap:6px;">
              <span style="color:#fde047; font-weight:bold; flex-shrink:0;">②</span>
              <span><strong>運営店（6店舗）</strong>へ行き「<strong>達成QRコード</strong>（5軒・10軒・15軒達成等）」をスマホで読み取ります。</span>
            </div>
            <div style="display:flex; align-items:flex-start; gap:6px;">
              <span style="color:#fde047; font-weight:bold; flex-shrink:0;">③</span>
              <span>冒険の書に酒場クーポン・グッズ引換券が解放されます！</span>
            </div>
          </div>
        </div>

        ${this.getFooterVersionHTML()}
      </div>
    `;

    // 2. 宝箱を開けてお店を選ぶ / 続けてクーポンを使うボタン
    container.querySelectorAll('.btn-direct-open-store-coupon').forEach(btn => {
      btn.addEventListener('click', () => {
        this.playSelectSE();
        const tierId = parseInt(btn.dataset.tierId, 10);
        const tier = rewardTiers.find(t => Number(t.id) === tierId);
        if (tier) {
          this.openStoreSelectForCoupon(tier, seasonId);
        }
      });
    });

    // 3. グッズ記念品受け取りボタン
    container.querySelectorAll('.btn-view-goods').forEach(btn => {
      btn.addEventListener('click', () => {
        this.playSelectSE();
        const tierId = parseInt(btn.dataset.tierId, 10);
        const tier = rewardTiers.find(t => Number(t.id) === tierId);
        if (tier) {
          this.openGoodsRedeemModal(tier, seasonId);
        }
      });
    });

    // 共通テストマイルストーン実行関数
    const handleTestTierClaim = async (tierIdx, btnEl) => {
      const tiers = window.questApi?.rewardTiers || [];
      const targetTier = tiers[tierIdx] || tiers.find(t => (tierIdx === 0 && Number(t.required_visits) <= 5) || (tierIdx === 1 && Number(t.required_visits) <= 10) || (tierIdx === 2 && Number(t.required_visits) <= 15)) || { id: tierIdx + 1, title: `${(tierIdx + 1) * 5}軒達成特典` };

      btnEl.disabled = true;
      const origText = btnEl.innerHTML;
      btnEl.innerHTML = '処理中...';

      try {
        await this.handleClaimMilestoneTier(targetTier.id);
      } catch (e) {
        alert('エラーが発生しました: ' + e.message);
      } finally {
        btnEl.disabled = false;
        btnEl.innerHTML = origText;
      }
    };

    const btnT1 = container.querySelector('#btn-quick-test-tier1');
    if (btnT1) btnT1.addEventListener('click', () => handleTestTierClaim(0, btnT1));

    const btnT2 = container.querySelector('#btn-quick-test-tier2');
    if (btnT2) btnT2.addEventListener('click', () => handleTestTierClaim(1, btnT2));

    const btnT3 = container.querySelector('#btn-quick-test-tier3');
    if (btnT3) btnT3.addEventListener('click', () => handleTestTierClaim(2, btnT3));

    const btnReset = container.querySelector('#btn-quick-test-reset');
    if (btnReset) {
      btnReset.addEventListener('click', async () => {
        if (!confirm('⚠️ 【履歴リセット】今期の獲得クーポン・特典履歴をすべて初期化しますか？')) {
          return;
        }
        btnReset.disabled = true;
        btnReset.textContent = 'リセット中...';
        try {
          const res = await (window.questApi.resetVisitsAndCoupons ? window.questApi.resetVisitsAndCoupons() : window.questApi.resetUserVisitsAndCouponsForTest());
          if (res && res.success === false) {
            alert('初期化に失敗しました: ' + (res.message || '通信エラー'));
          } else {
            this.playBackSE();
            alert('冒険の書の獲得特典・クーポン履歴を初期化しました。');
            await this.render();
          }
        } catch (err) {
          console.error('Reset error:', err);
          alert('初期化中にエラーが発生しました: ' + (err.message || '不明なエラー'));
        } finally {
          btnReset.disabled = false;
          btnReset.textContent = '🗑️ 履歴リセット';
        }
      });
    }

    // バックグラウンドで最新データをサイレント同期（画面は即時表示したまま、裏で通信）
    this.refreshQuestBookInBackground(seasonId);
  }

  /* ------------------------------------------------------------------------
   * 冒険の書 バックグラウンド・サイレント同期
   * ------------------------------------------------------------------------ */
  async refreshQuestBookInBackground(seasonId) {
    if (!window.questApi || this._isQuestBookSyncing) return;
    this._isQuestBookSyncing = true;
    try {
      const prevCouponsSign = (window.questApi.userCoupons || []).map(c => `${c.id}:${c.status}:${c.store_id || ''}:${c.used_at || ''}`).join('|');
      const prevVisitsLen = (window.questApi.visits || []).length;
      await Promise.all([
        window.questApi.getRewardTiers(seasonId),
        window.questApi.getUserCoupons(seasonId),
        window.questApi.getUserVisits(seasonId)
      ]);
      const newCouponsSign = (window.questApi.userCoupons || []).map(c => `${c.id}:${c.status}:${c.store_id || ''}:${c.used_at || ''}`).join('|');
      const newVisitsLen = (window.questApi.visits || []).length;
      // ユーザーがまだ冒険の書画面を表示していて、データに変更があった場合のみ再描画
      if (this.currentView === 'quest-book' && (prevCouponsSign !== newCouponsSign || prevVisitsLen !== newVisitsLen)) {
        const container = document.getElementById('view-container');
        if (container) {
          this.renderQuestBookView(container);
        }
      }
    } catch (e) {
      console.warn('QuestBook background sync skipped:', e);
    } finally {
      this._isQuestBookSyncing = false;
    }
  }

  /* ------------------------------------------------------------------------
   * クーポン利用時の店舗選択モーダル (1店舗選択 ➔ 店頭消し込みへ)
   * ------------------------------------------------------------------------ */
  openStoreSelectForCoupon(tier, seasonId = null) {
    const targetSeasonId = seasonId || window.questApi?.currentSeason?.id || 2;
    const stores = this.getStores();
    // 今期参加かつクーポン対象店舗のみを抽出
    const targetStores = stores.filter(s => s.is_participating !== false && s.isCouponTarget !== false);
    const userCoupons = (window.questApi && window.questApi.userCoupons) || [];
    
    // シーズン全体で今期クーポン利用（used）済みの全店舗IDリスト（グッズ引換を除外：1店舗1回限り）
    const usedStoreIds = new Set(
      userCoupons
        .filter(c => c.reward_type !== 'goods' && c.status === 'used' && c.store_id)
        .map(c => c.store_id)
    );

    // 未利用の店舗数
    const availableStores = targetStores.filter(s => !usedStoreIds.has(s.id));

    if (availableStores.length === 0) {
      alert('すべての対象店舗でクーポンをご利用済みです！');
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'rpg-modal-overlay';
    overlay.id = 'store-select-coupon-modal';

    const renderStoreList = (filterArea = 'all', searchQuery = '') => {
      let list = targetStores;
      if (filterArea !== 'all') {
        list = list.filter(s => s.area === filterArea);
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        list = list.filter(s => (s.name || '').toLowerCase().includes(q) || (s.area || '').toLowerCase().includes(q));
      }

      if (list.length === 0) {
        return `<div style="padding:20px; text-align:center; color:#94a3b8; font-size:13px;">該当する酒場が見つかりません</div>`;
      }

      return list.map(s => {
        const isUsed = usedStoreIds.has(s.id);

        const metaInfo = [
          s.area ? `📍 ${this.escapeHtml(s.area)}` : '',
          s.category ? `🍴 ${this.escapeHtml(s.category)}` : ''
        ].filter(Boolean).join(' / ');

        if (isUsed) {
          return `
            <div class="coupon-select-item is-used" style="min-height:52px; box-sizing:border-box; background:rgba(30,41,59,0.7); border:1px solid #475569; border-radius:8px; padding:8px 12px; display:flex; align-items:center; gap:10px; cursor:not-allowed;">
              <div class="coupon-select-item-info" style="flex:1; min-width:0; overflow:hidden;">
                <div class="coupon-select-item-name" style="font-weight:bold; color:#cbd5e1; font-size:14px; line-height:1.35; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${this.escapeHtml(s.name)}</div>
                ${metaInfo ? `<div style="font-size:11px; color:#94a3b8; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${metaInfo}</div>` : ''}
              </div>
              <div class="stamp-hanko-badge" style="font-size:11px; padding:2px 7px; flex-shrink:0;">
                USED
              </div>
            </div>
          `;
        }

        return `
          <div class="coupon-select-item selectable-store-item" data-store-id="${s.id}" style="min-height:52px; box-sizing:border-box; background:#101424; border:1px solid #33406b; border-radius:8px; padding:8px 12px; display:flex; align-items:center; gap:10px; cursor:pointer;">
            <div class="coupon-select-item-info" style="flex:1; min-width:0; overflow:hidden;">
              <div class="coupon-select-item-name" style="font-weight:bold; color:var(--text-yellow); font-size:14px; line-height:1.35; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${this.escapeHtml(s.name)}</div>
              ${metaInfo ? `<div style="font-size:11px; color:var(--text-cyan); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${metaInfo}</div>` : ''}
            </div>
            <div style="font-size:12px; color:var(--text-green); font-weight:bold; white-space:nowrap; padding:5px 9px; border:1px solid #22c55e; border-radius:4px; background:rgba(34,197,94,0.15); flex-shrink:0;">
              選ぶ ➔
            </div>
          </div>
        `;
      }).join('');
    };

    overlay.innerHTML = `
      <div class="rpg-modal-window gold-border" style="max-width:440px; width:94%; max-height:86vh; display:flex; flex-direction:column; padding:12px 10px;">
        <div class="rpg-window-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <span style="font-size:15px; font-weight:bold;">🏮 クーポン利用酒場の選択</span>
          <button id="store-modal-close-btn" style="background:none; border:none; color:#fff; font-size:20px; cursor:pointer; padding:0 4px;">✕</button>
        </div>
        <div style="padding:4px 0 6px; font-size:12px; color:var(--text-yellow); line-height:1.4;">
          クーポンを利用する酒場を選択してください。<br>
          <span style="font-size:11px; color:var(--text-dim);">※同一酒場での利用はシーズン中1回限りです。</span>
        </div>
        <div style="margin-bottom:6px;">
          <input type="text" id="coupon-store-search-input" placeholder="🔍 酒場名・エリアで検索..." style="width:100%; box-sizing:border-box; padding:7px 10px; background:#0f172a; border:1px solid var(--border-gold); color:#fff; border-radius:6px; font-size:12px;" />
        </div>
        <div class="coupon-select-list" id="coupon-stores-container" style="flex:1; overflow-y:auto; max-height:54vh; display:flex; flex-direction:column; gap:6px;">
          ${renderStoreList()}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const containerEl = document.getElementById('coupon-stores-container');
    const searchInput = document.getElementById('coupon-store-search-input');

    const bindStoreClicks = () => {
      containerEl.querySelectorAll('.selectable-store-item').forEach(item => {
        item.addEventListener('click', () => {
          this.playSelectSE();
          const storeId = item.dataset.storeId;
          const store = stores.find(s => s.id === storeId);
          if (!store) return;
          overlay.remove();
          this.openStoreCouponRedeemModal(tier, store, targetSeasonId);
        });
      });
    };

    bindStoreClicks();

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        containerEl.innerHTML = renderStoreList('all', searchInput.value);
        bindStoreClicks();
      });
    }

    // 閉じるボタン
    document.getElementById('store-modal-close-btn').addEventListener('click', () => {
      this.playBackSE();
      overlay.remove();
    });
  }

  /* ------------------------------------------------------------------------
   * スライド消し込み (Swipe to Redeem) コントローラー
   * ------------------------------------------------------------------------ */
  initSwipeRedeem(containerEl, onConfirm) {
    const track = containerEl.querySelector('.swipe-track');
    const thumb = containerEl.querySelector('.swipe-thumb');
    const fill = containerEl.querySelector('.swipe-fill');
    const text = containerEl.querySelector('.swipe-text');
    if (!track || !thumb) return;

    let isDragging = false;
    let startX = 0;
    let currentX = 0;
    let maxSlide = 0;
    let isConfirmed = false;

    const getClientX = (e) => {
      return (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX;
    };

    const updateMaxSlide = () => {
      const trackRect = track.getBoundingClientRect();
      const thumbRect = thumb.getBoundingClientRect();
      maxSlide = Math.max(0, trackRect.width - thumbRect.width - 6);
    };

    const onStart = (e) => {
      if (isConfirmed) return;
      updateMaxSlide();
      isDragging = true;
      thumb.classList.add('is-dragging');
      startX = getClientX(e);
      currentX = 0;
    };

    const onMove = (e) => {
      if (!isDragging || isConfirmed) return;
      const clientX = getClientX(e);
      const delta = clientX - startX;
      currentX = Math.max(0, Math.min(delta, maxSlide));

      thumb.style.transform = `translateX(${currentX}px)`;
      if (fill) {
        fill.style.width = `${currentX + 23}px`;
      }
      if (text) {
        const progress = maxSlide > 0 ? (currentX / maxSlide) : 0;
        text.style.opacity = `${Math.max(0, 1 - progress * 1.5)}`;
      }

      // 85%以上スライドで発火
      if (maxSlide > 0 && currentX >= maxSlide * 0.85) {
        isConfirmed = true;
        isDragging = false;
        thumb.classList.remove('is-dragging');
        thumb.style.transform = `translateX(${maxSlide}px)`;
        if (fill) fill.style.width = '100%';
        if (text) text.style.opacity = '0';

        onConfirm();
      }
    };

    const onEnd = () => {
      if (!isDragging || isConfirmed) return;
      isDragging = false;
      thumb.classList.remove('is-dragging');

      // バウンスバックで元に戻す
      thumb.style.transition = 'transform 0.25s ease-out';
      if (fill) fill.style.transition = 'width 0.25s ease-out';
      if (text) text.style.transition = 'opacity 0.25s ease-out';

      thumb.style.transform = 'translateX(0px)';
      if (fill) fill.style.width = '0px';
      if (text) text.style.opacity = '1';

      setTimeout(() => {
        thumb.style.transition = '';
        if (fill) fill.style.transition = '';
        if (text) text.style.transition = '';
      }, 250);
    };

    // タッチイベント
    thumb.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);

    // マウスイベント
    thumb.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
  }

  /* ------------------------------------------------------------------------
   * 店舗クーポン店頭消し込みモーダル (その都度選択時・店頭提示)
   * ------------------------------------------------------------------------ */
  openStoreCouponRedeemModal(tier, store, seasonId = null) {
    const targetSeasonId = seasonId || window.questApi?.currentSeason?.id || 2;
    const overlay = document.createElement('div');
    overlay.className = 'rpg-modal-overlay';
    overlay.id = 'store-coupon-redeem-modal';

    const info = window.questApi?.currentSeason?.statusInfo;
    const isExpired = info?.isExpired;
    const isCouponUsable = info?.isCouponUsable;
    const couponStartDateStr = info?.couponStartDateStr || '翌日';

    overlay.innerHTML = `
      <div class="rpg-modal-window gold-border" style="max-width: 440px; width: 94%; max-height: 90vh; overflow-y: auto; padding: 14px 10px;">
        <div class="rpg-window-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
          <span style="font-size: 15px; font-weight: bold;">🎟️ 酒場クーポン店頭提示</span>
          <button id="store-redeem-close-btn" style="background:none; border:none; color:#fff; font-size:20px; cursor:pointer; padding: 0 4px;">✕</button>
        </div>
        <div class="staff-redeem-box" id="store-redeem-content" style="padding: 8px 4px;">
          <div style="font-size: 20px; font-weight: bold; color: var(--text-yellow); margin: 4px 0 10px; line-height: 1.3;">
            🏮 ${this.escapeHtml(store.name)}
          </div>
          
          <div style="background: #0f152b; border: 2px dashed var(--border-gold); padding: 12px 10px; border-radius: 8px; margin-bottom: 12px; text-align: center;">
            <div style="font-size: 12px; color: var(--text-cyan); margin-bottom: 2px; font-weight: bold;">【${this.escapeHtml(tier.title || 'ハシゴ酒達成特典')}】</div>
            <div style="font-size: 18px; font-weight: bold; color: #fff; line-height: 1.3;">🍺 酒場特典チケット</div>
          </div>

          ${isExpired ? `
            <div style="padding: 14px 10px; border: 1px solid #ef4444; border-radius: 8px; background: #450a0a; color: #fca5a5; font-size: 13px; text-align: center; line-height: 1.5;">
              🔒 <strong>利用期限終了</strong><br>
              クーポンの利用期限は終了いたしました。
            </div>
          ` : (!isCouponUsable ? `
            <div style="padding: 14px 10px; border: 1px solid #f59e0b; border-radius: 8px; background: rgba(245,158,11,0.15); color: #fde68a; font-size: 13px; text-align: center; line-height: 1.5;">
              🔒 <strong>後夜祭期間にご利用いただけます</strong><br>
              <strong style="color: var(--text-yellow); font-size: 15px; display: block; margin: 6px 0;">📅 ${couponStartDateStr} 〜 ${window.questApi?.currentSeason?.coupon_valid_until || ''}</strong>
              <span style="font-size:11px; color:#cbd5e1;">※本開催期間中はご利用いただけません。</span>
            </div>
          ` : `
            <div class="staff-warning-banner" style="font-size: 12px; line-height: 1.4; padding: 8px 10px; margin-bottom: 12px;">
              ⚠️ <strong>【酒場スタッフ専用】</strong><br>
              お会計時にスライドして使用済みにしてください。
            </div>
            <div class="swipe-redeem-container" id="store-swipe-container">
              <div class="swipe-track">
                <div class="swipe-fill"></div>
                <div class="swipe-text">
                  <span style="white-space:nowrap;">👉 スライドして使用</span>
                </div>
                <div class="swipe-thumb">
                  <i class="fa-solid fa-angles-right"></i>
                </div>
              </div>
            </div>
          `)}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('store-redeem-close-btn').addEventListener('click', () => {
      this.playBackSE();
      overlay.remove();
    });

    const swipeContainer = overlay.querySelector('#store-swipe-container');
    if (swipeContainer) {
      this.initSwipeRedeem(swipeContainer, async () => {
        const contentBox = overlay.querySelector('#store-redeem-content');
        if (contentBox) {
          contentBox.innerHTML = `
            <div style="padding: 30px 10px; text-align: center;">
              <i class="fa-solid fa-spinner fa-spin" style="font-size: 32px; color: var(--text-yellow);"></i>
              <div style="font-size: 15px; color: #fff; margin-top: 14px; font-weight: bold;">消し込み処理中...</div>
            </div>
          `;
        }

        const res = await window.questApi.redeemCouponForStore(tier.id, store.id, targetSeasonId);
        if (res.success) {
          this.playFanfareSE();
          this.playStampSE();
          if (contentBox) {
            contentBox.innerHTML = `
              <div class="redeem-success-box" style="position:relative; overflow:hidden; padding:20px 10px;">
                <div style="font-size: 40px; margin-bottom: 6px;">🍺</div>
                <div style="font-size: 18px; font-weight: bold; color: #34d399; margin-bottom: 4px;">クーポン利用完了！</div>
                <div style="font-size: 13px; color: #e2e8f0; line-height: 1.4; margin-bottom: 16px;">
                  「${this.escapeHtml(store.name)}」でご利用いただきました。<br>ご来店ありがとうございます！
                </div>
                <div style="margin: 10px 0;">
                  <div class="stamp-hanko-mega stamp-animate">USED</div>
                </div>
              </div>
            `;
          }
          setTimeout(() => {
            overlay.remove();
            this.render();
          }, 1800);
        } else {
          alert(res.message || '消し込みに失敗しました。');
          overlay.remove();
        }
      });
    }
  }

  /* ------------------------------------------------------------------------
   * 記念品グッズ店頭引換モーダル (ダイレクト受取・店頭提示)
   * ------------------------------------------------------------------------ */
  openGoodsRedeemModal(tier, seasonId = null) {
    const targetSeasonId = seasonId || window.questApi?.currentSeason?.id || 2;
    const overlay = document.createElement('div');
    overlay.className = 'rpg-modal-overlay';
    overlay.id = 'goods-redeem-modal';

    const goodsTitle = tier.goods_name || tier.title || '記念品グッズ';

    overlay.innerHTML = `
      <div class="rpg-modal-window gold-border" style="max-width: 440px; width: 94%; max-height: 90vh; overflow-y: auto; padding: 14px 10px;">
        <div class="rpg-window-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
          <span style="font-size: 15px; font-weight: bold;">🎁 記念品受取画面</span>
          <button id="goods-redeem-close-btn" style="background:none; border:none; color:#fff; font-size:20px; cursor:pointer; padding: 0 4px;">✕</button>
        </div>
        <div class="staff-redeem-box" id="goods-redeem-content" style="padding: 8px 4px;">
          <div style="font-size: 19px; font-weight: bold; color: var(--text-yellow); margin: 4px 0 10px; line-height: 1.3;">
            🎁 ${this.escapeHtml(goodsTitle)}
          </div>
          <div style="font-size: 12px; color: var(--text-cyan); margin-bottom: 10px; background: rgba(0,0,0,0.4); padding: 7px 10px; border-radius: 6px; text-align: left;">
            📍 <strong>引換場所:</strong> ${this.escapeHtml(tier.exchange_location || '全参加酒場または運営本部')}
          </div>
          ${tier.exchange_notice ? `
            <div style="font-size: 12px; color: #fde68a; margin-bottom: 12px; background: rgba(0,0,0,0.3); padding: 8px 10px; border-radius: 6px; text-align: left; line-height: 1.4;">
              ℹ️ ${this.escapeHtml(tier.exchange_notice)}
            </div>
          ` : ''}

          <div class="staff-warning-banner" style="font-size: 12px; line-height: 1.4; padding: 8px 10px; margin-bottom: 12px;">
            ⚠️ <strong>【スタッフ確認専用】</strong><br>
            記念品お渡し時にスライドして受取完了にしてください。
          </div>
          <div class="swipe-redeem-container" id="goods-swipe-container">
            <div class="swipe-track">
              <div class="swipe-fill"></div>
              <div class="swipe-text">
                <span style="white-space:nowrap;">👉 スライドして受取</span>
              </div>
              <div class="swipe-thumb">
                <i class="fa-solid fa-angles-right"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('goods-redeem-close-btn').addEventListener('click', () => {
      this.playBackSE();
      overlay.remove();
    });

    const swipeContainer = overlay.querySelector('#goods-swipe-container');
    if (swipeContainer) {
      this.initSwipeRedeem(swipeContainer, async () => {
        const contentBox = overlay.querySelector('#goods-redeem-content');
        if (contentBox) {
          contentBox.innerHTML = `
            <div style="padding: 30px 10px; text-align: center;">
              <i class="fa-solid fa-spinner fa-spin" style="font-size: 32px; color: var(--text-yellow);"></i>
              <div style="font-size: 15px; color: #fff; margin-top: 14px; font-weight: bold;">受取消し込み処理中...</div>
            </div>
          `;
        }

        // 既存の未受取クーポンを探す、無ければ自動発行
        const userCoupons = await window.questApi.getUserCoupons(targetSeasonId);
        let goodsCoupon = userCoupons.find(c => c.reward_type === 'goods' && c.status !== 'used' && (Number(c.reward_tier_id) === Number(tier.id) || c.goods_name === tier.goods_name || c.goods_name === tier.title));

        if (!goodsCoupon) {
          const claimRes = await window.questApi.claimGoodsReward(tier.id, targetSeasonId);
          if (claimRes.success && claimRes.coupon) {
            goodsCoupon = claimRes.coupon;
          } else {
            // 再度取得
            const updatedCoupons = await window.questApi.getUserCoupons(targetSeasonId);
            goodsCoupon = updatedCoupons.find(c => c.reward_type === 'goods' && c.status !== 'used' && (Number(c.reward_tier_id) === Number(tier.id) || c.goods_name === tier.goods_name || c.goods_name === tier.title))
              || updatedCoupons.find(c => c.reward_type === 'goods' && (Number(c.reward_tier_id) === Number(tier.id) || c.goods_name === tier.goods_name || c.goods_name === tier.title));
          }
        }

        const couponId = goodsCoupon?.id;
        let redeemRes = { success: false };
        if (couponId) {
          redeemRes = await window.questApi.redeemCoupon(couponId, null, targetSeasonId);
        } else {
          redeemRes = { success: false, message: '引換券の発行に失敗しました。' };
        }

        if (redeemRes.success) {
          this.playFanfareSE();
          this.playStampSE();
          if (contentBox) {
            contentBox.innerHTML = `
              <div class="redeem-success-box" style="position:relative; overflow:hidden; padding:20px 10px;">
                <div style="font-size: 44px; margin-bottom: 8px;">🎉</div>
                <div style="font-size: 20px; font-weight: bold; color: #34d399; margin-bottom: 6px;">受取完了！</div>
                <div style="font-size: 14px; color: #e2e8f0; line-height: 1.5; margin-bottom: 16px;">
                  「${this.escapeHtml(goodsTitle)}」をお渡ししました。
                </div>
                <div style="margin: 10px 0;">
                  <div class="stamp-hanko-mega stamp-animate">USED</div>
                </div>
              </div>
            `;
          }
          setTimeout(() => {
            overlay.remove();
            this.render();
          }, 1800);
        } else {
          alert(redeemRes.message || '受取消し込みに失敗しました。');
          overlay.remove();
        }
      });
    }
  }

  /* ------------------------------------------------------------------------
   * クーポン消し込みモーダル (フォールバック・個別クーポン提示用)
   * ------------------------------------------------------------------------ */
  openRedeemModal(coupon) {
    const isGoods = coupon.reward_type === 'goods';
    if (isGoods) {
      const tierId = Number(coupon.reward_tier_id);
      const tier = (window.questApi?.rewardTiers || []).find(t => Number(t.id) === tierId) || {
        id: tierId,
        title: coupon.title || coupon.goods_name,
        goods_name: coupon.goods_name,
        exchange_location: coupon.exchange_location,
        exchange_notice: coupon.exchange_notice
      };
      return this.openGoodsRedeemModal(tier, coupon.season_id);
    }

    const storeId = coupon.store_id;
    const store = (this.stores || []).find(s => s.id === storeId) || coupon.stores || { id: storeId, name: storeId || '酒場' };
    const tierId = Number(coupon.reward_tier_id);
    const tier = (window.questApi?.rewardTiers || []).find(t => Number(t.id) === tierId) || { id: tierId, title: coupon.title || 'ハシゴ酒達成特典' };
    return this.openStoreCouponRedeemModal(tier, store, coupon.season_id);
  }

  /* ------------------------------------------------------------------------
   * アプリ内蔵 QRコードスキャナーモーダル（運営店舗のマイルストーン達成QR専用）
   * ------------------------------------------------------------------------ */
  openQrScannerModal() {
    this.playSelectSE();

    // 既存モーダルがあれば削除
    const existingModal = document.getElementById('qr-scanner-modal');
    if (existingModal) existingModal.remove();

    const overlay = document.createElement('div');
    overlay.className = 'rpg-modal-overlay';
    overlay.id = 'qr-scanner-modal';

    overlay.innerHTML = `
      <div class="rpg-modal-window gold-border" style="max-width:380px; width:92%; text-align:center;">
        <div class="rpg-window-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <span style="font-size:16px;">📷 特典達成QRコード読取</span>
          <button id="qr-modal-close-btn" style="background:none; border:none; color:#fff; font-size:20px; cursor:pointer;">✕</button>
        </div>

        <div style="font-size:13px; color:var(--text-yellow); margin-bottom:8px; font-weight:bold; line-height:1.4;">
          🏆 運営店舗（6店舗）に掲示された<br>「達成QRコード」を読み取ってください
        </div>

        <div class="qr-scanner-box" id="qr-scanner-view-box">
          <div id="qr-reader"></div>
          <div class="qr-scanner-reticle"></div>
        </div>

        <div id="qr-scanner-status-text" style="font-size:13px; color:#e2e8f0; margin-bottom:10px; min-height:16px;">
          カメラを起動中...
        </div>

        <div style="display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; gap:6px;">
            <button id="qr-modal-test-tier1" class="command-button" style="flex:1; background: rgba(217, 119, 6, 0.25); border: 1px dashed #f59e0b; color: #fbbf24; font-size: 11px; padding: 6px 2px; border-radius: 4px; cursor: pointer; font-weight: bold;">
              🏆 5軒達成
            </button>
            <button id="qr-modal-test-tier2" class="command-button" style="flex:1; background: rgba(217, 119, 6, 0.25); border: 1px dashed #f59e0b; color: #fbbf24; font-size: 11px; padding: 6px 2px; border-radius: 4px; cursor: pointer; font-weight: bold;">
              🏆 10軒達成
            </button>
            <button id="qr-modal-test-tier3" class="command-button" style="flex:1; background: rgba(217, 119, 6, 0.25); border: 1px dashed #f59e0b; color: #fbbf24; font-size: 11px; padding: 6px 2px; border-radius: 4px; cursor: pointer; font-weight: bold;">
              🏆 15軒達成
            </button>
          </div>
          <button id="qr-modal-cancel-btn" class="treasure-claim-btn" style="background:#333; border-color:#888; padding:8px; font-size:13px;">
            ✕ キャンセル
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    let html5QrCode = null;
    let isScanned = false;

    const stopCamera = async () => {
      if (html5QrCode) {
        try {
          if (html5QrCode.isScanning) {
            await html5QrCode.stop();
          }
          await html5QrCode.clear();
        } catch (err) {
          console.warn('QRスキャナー停止時エラー:', err);
        }
        html5QrCode = null;
      }
    };

    const closeModal = async () => {
      this.playBackSE();
      await stopCamera();
      overlay.remove();
    };

    document.getElementById('qr-modal-close-btn').addEventListener('click', closeModal);
    document.getElementById('qr-modal-cancel-btn').addEventListener('click', closeModal);

    const handleQrTierTest = async (tierIdx) => {
      const tiers = window.questApi?.rewardTiers || [];
      const targetTier = tiers[tierIdx] || tiers.find(t => (tierIdx === 0 && Number(t.required_visits) <= 5) || (tierIdx === 1 && Number(t.required_visits) <= 10) || (tierIdx === 2 && Number(t.required_visits) <= 15)) || { id: tierIdx + 1, title: `${(tierIdx + 1) * 5}軒達成特典` };
      await closeModal();
      await this.handleClaimMilestoneTier(targetTier.id);
    };

    const qT1 = document.getElementById('qr-modal-test-tier1');
    if (qT1) qT1.addEventListener('click', () => handleQrTierTest(0));
    const qT2 = document.getElementById('qr-modal-test-tier2');
    if (qT2) qT2.addEventListener('click', () => handleQrTierTest(1));
    const qT3 = document.getElementById('qr-modal-test-tier3');
    if (qT3) qT3.addEventListener('click', () => handleQrTierTest(2));

    // スキャナーの初期化
    const initScanner = async () => {
      const statusEl = document.getElementById('qr-scanner-status-text');
      if (typeof Html5Qrcode === 'undefined') {
        if (statusEl) statusEl.textContent = '❌ スキャナーライブラリをロードできませんでした';
        return;
      }

      try {
        html5QrCode = new Html5Qrcode('qr-reader');
        const config = {
          fps: 10,
          qrbox: { width: 200, height: 200 },
          aspectRatio: 1.0
        };

        const onScanSuccess = async (decodedText) => {
          if (isScanned) return;
          isScanned = true;

          this.playSelectSE();
          const claimTierId = extractClaimTierParam(decodedText);

          await stopCamera();
          overlay.remove();

          if (claimTierId) {
            await this.handleClaimMilestoneTier(claimTierId);
          } else {
            alert(`読み取ったQRコードの内容:\n${decodedText}\n\n⚠️ 有効な達成QRコードではありません。\n運営店舗（6店舗）に設置されたマイルストーン達成QRコードを読み取ってください。`);
          }
        };

        // 背面カメラ(facingMode: "environment")を優先起動
        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          onScanSuccess,
          () => {} // フレーム毎のエラーは無視
        );

        if (statusEl) statusEl.textContent = '🔍 QRコードをスキャンしています...';
      } catch (err) {
        console.warn('カメラ起動エラー:', err);
        if (statusEl) {
          statusEl.innerHTML = `<span style="color:#ff6b6b;">⚠️ カメラへのアクセスが許可されていないか、利用できません。</span>`;
        }
      }
    };

    // DOM描画完了後にスキャナー初期化
    setTimeout(initScanner, 200);
  }

  /* ------------------------------------------------------------------------
   * 🏆 マイルストーン達成特典カスケード付与処理 (運営店QRコードスキャン時)
   * ------------------------------------------------------------------------ */
  async handleClaimMilestoneTier(tierId) {
    if (!tierId) return;

    // スタート画面オーバーレイを確実に非表示にして冒険の書ビューにする
    const overlay = document.getElementById('start-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
    this.isStarted = true;
    this.currentView = 'quest-book';

    try {
      const activeSeasonId = window.questApi?.currentSeason?.id || 2;
      const res = await window.questApi.claimRewardTierCascade(tierId, activeSeasonId);

      // 冒険の書画面を最新状態で描画
      await this.render();

      // 同期ローダーをスムーズに非表示
      const syncLoader = document.getElementById('qr-claim-sync-loader');
      if (syncLoader) {
        syncLoader.style.opacity = '0';
        setTimeout(() => {
          syncLoader.style.display = 'none';
        }, 300);
      }

      if (res.success) {
        if (res.alreadyClaimed) {
          this.playCursorSE();
          this.showAlreadyClaimedMilestoneModal(res);
        } else {
          // 🎉 秘宝の宝箱発見モーダルを表示（タップで効果音アンロック＆ドラクエ風レベルアップ演出へ移行）
          this.showTreasureBoxOpenPrompt(res);
        }
      } else {
        alert(res.message || '特典の獲得処理に失敗しました。');
      }
    } catch (err) {
      console.error('Milestone claim error:', err);
      alert('エラーが発生しました: ' + err.message);
    }
  }

  /* ------------------------------------------------------------------------
   * 🎁 秘宝の宝箱 タップ開封演出モーダル (AudioContextアンロック＆演出トリガー)
   * ------------------------------------------------------------------------ */
  showTreasureBoxOpenPrompt(res = {}) {
    // 既存モーダルがあれば削除
    const existing = document.getElementById('treasure-box-prompt-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'rpg-modal-overlay treasure-open-overlay';
    overlay.id = 'treasure-box-prompt-modal';

    overlay.innerHTML = `
      <div class="rpg-modal-window gold-border treasure-open-window" id="treasure-window-content" style="max-width:360px; width:92%; max-height:88vh; overflow-y:auto; padding:20px 16px; box-sizing:border-box;">
        <div class="treasure-open-title" style="font-size:20px; font-weight:bold; color:var(--text-yellow); margin-bottom:14px; text-shadow:2px 2px 0 #000; text-align:center;">
          宝箱を手に入れた！
        </div>

        <div class="treasure-open-box-visual" id="treasure-box-click-target" style="max-width:130px; margin:0 auto 20px auto; cursor:pointer;">
          <img src="assets/treasure_box.png" alt="宝箱" class="treasure-box-img" style="width:100%; max-width:130px; max-height:130px; object-fit:contain; display:block; margin:0 auto; filter:drop-shadow(0 4px 15px rgba(245, 158, 11, 0.4));" onerror="this.src='assets/banner.png';">
        </div>

        <button class="start-game-btn treasure-open-action-btn" id="treasure-open-btn" style="width:100%; box-sizing:border-box; margin:0; animation:none; font-size:16px; padding:13px 20px; justify-content:center;">
          宝箱をあける
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    let isOpened = false;
    const triggerOpen = () => {
      if (isOpened) return;
      isOpened = true;

      // ユーザーのタップによりAudioContextの再生制限を確実に解除
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.audioCtx = new AudioContext();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      // 宝箱タップ時は効果音（ファンファーレはモーダル側で1回のみ再生して重複防止）
      this.playSelectSE();

      // 開封演出（白飛び点滅ではなくスムーズな拡大フェード）
      const windowContent = document.getElementById('treasure-window-content');
      if (windowContent) {
        windowContent.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        windowContent.style.transform = 'scale(1.04)';
        windowContent.style.opacity = '0';
      }

      // モーダルを削除し、詳細アンロック演出モーダルを表示
      setTimeout(() => {
        overlay.remove();
        this.showMilestoneUnlockModal(res);
      }, 300);
    };

    const clickTarget = document.getElementById('treasure-box-click-target');
    const openBtn = document.getElementById('treasure-open-btn');
    if (clickTarget) clickTarget.addEventListener('click', triggerOpen);
    if (openBtn) openBtn.addEventListener('click', triggerOpen);
  }

  /* ------------------------------------------------------------------------
   * 🌟 ドラクエ風 マイルストーン達成＆特典アンロック演出モーダル
   * ------------------------------------------------------------------------ */
  showMilestoneUnlockModal(res = {}) {
    const { claimedTiers, totalAddedSlots } = res;

    const overlay = document.createElement('div');
    overlay.className = 'rpg-modal-overlay';
    overlay.id = 'milestone-unlock-modal';

    const user = window.questApi?.currentUser || { displayName: '勇者', pictureUrl: 'assets/banner.png' };
    const avatarUrl = user.pictureUrl || 'assets/banner.png';
    const displayName = this.escapeHtml ? this.escapeHtml(user.displayName || '勇者') : (user.displayName || '勇者');

    // 獲得後の解放段階数からレベル・称号を計算
    const activeSeasonId = window.questApi?.currentSeason?.id || 2;
    const userCoupons = (window.questApi && window.questApi.userCoupons) ? window.questApi.userCoupons : [];
    const rewardTiers = (window.questApi && window.questApi.rewardTiers && window.questApi.rewardTiers.length > 0)
      ? window.questApi.rewardTiers.filter(t => Number(t.season_id) === Number(activeSeasonId))
      : (window.APP_CONFIG?.fallbackRewardTiers || []);
    const unlockedTiers = rewardTiers.filter(t => userCoupons.some(c => Number(c.reward_tier_id) === Number(t.id) || (t.reward_type === 'goods' && (c.goods_name === t.goods_name || c.goods_name === t.title))));
    const unlockedTierCount = unlockedTiers.length;
    const heroData = this.getHeroTitleForTierCount(unlockedTierCount);

    // メッセージテキスト配列の構築（称号は「手に入れた」、達成特典は「受け取った」に統一）
    const lines = [
      { text: `${displayName} は レベルが ${heroData.level} に あがった！`, cls: 'highlight' },
      { text: `称号 【${heroData.title || '駆け出しの呑兵衛'}】 を 手に入れた！`, cls: 'highlight' }
    ];

    if (claimedTiers && claimedTiers.length > 0) {
      claimedTiers.forEach(t => {
        const isGoods = t.reward_type === 'goods';
        const name = isGoods ? `『${t.goods_name || t.title}』` : `酒場クーポン ${t.selectable_count || 5}軒分`;
        lines.push({
          text: `${t.required_visits}軒達成: ${name} を 受け取った！`,
          cls: 'tier'
        });
      });
    }

    if (totalAddedSlots > 0) {
      lines.push({
        text: `酒場クーポンが 合計 +${totalAddedSlots}軒分 ふえた！`,
        cls: 'bonus'
      });
    }

    overlay.innerHTML = `
      <canvas id="milestone-confetti-canvas" style="position:fixed; top:0; left:0; width:100vw; height:100vh; pointer-events:none; z-index:20005;"></canvas>
      <div class="rpg-modal-window levelup-modal-window" id="levelup-modal-window" style="max-width:440px; width:95%; text-align:center; padding:16px 16px;">
        <div class="levelup-content-relative">
          <!-- ドラクエ風ステータスボックス（アバター＋[上段: なまえ & Lv / 下段: 称号プレート]） -->
          <div class="dq-status-box">
            <div class="dq-status-top-row">
              <div class="dq-status-avatar-wrap">
                <img src="${avatarUrl}" alt="${displayName}" class="dq-status-avatar" onerror="this.src='assets/banner.png';">
              </div>
              <div class="dq-status-profile">
                <div class="dq-status-header-row">
                  <div class="dq-status-name">${displayName}</div>
                  <div class="dq-status-lv-badge">Lv.${heroData.level}</div>
                </div>
                <div class="dq-status-title-badge" style="border-color:${heroData.badge_color || '#fde047'}; color:${heroData.badge_color || '#fde047'};">
                  👑 ${this.escapeHtml(heroData.title || '駆け出しの呑兵衛')}
                </div>
              </div>
            </div>
          </div>

          <!-- ドラクエ風メッセージログボックス（拡大・白文字・タップ一括表示対応） -->
          <div class="dq-message-window-wrap">
            <div id="dq-levelup-msg-box" class="dq-message-box"></div>
          </div>

          <!-- 冒険の書へ進むボタン（他画面と同様のRPGボタンスタイル） -->
          <button id="milestone-modal-close-btn" class="start-game-btn treasure-open-action-btn" style="margin-top:12px; width:100%; box-sizing:border-box; animation:none; font-size:16px; padding:13px 20px; justify-content:center;">
            冒険の書をひらく
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const msgBox = document.getElementById('dq-levelup-msg-box');
    const closeBtn = document.getElementById('milestone-modal-close-btn');

    let lineIdx = 0;
    let charIdx = 0;
    let currentLineEl = null;
    let typeTimer = null;
    let isFinished = false;

    // 一括全文表示（スキップ）関数
    const renderFullText = () => {
      if (isFinished) return;
      if (typeTimer) clearTimeout(typeTimer);
      isFinished = true;
      if (msgBox) {
        msgBox.innerHTML = lines.map(l => `<div class="dq-message-line ${l.cls}">${this.escapeHtml(l.text)}</div>`).join('');
        msgBox.scrollTop = msgBox.scrollHeight;
      }
    };

    // 自動文字送りタイピング関数（読みやすい適正ペースに調整）
    const typeNextChar = () => {
      if (isFinished || !msgBox) return;
      if (lineIdx >= lines.length) {
        isFinished = true;
        return;
      }

      const line = lines[lineIdx];
      if (charIdx === 0) {
        currentLineEl = document.createElement('div');
        currentLineEl.className = `dq-message-line ${line.cls}`;
        msgBox.appendChild(currentLineEl);
      }

      if (charIdx < line.text.length) {
        currentLineEl.textContent += line.text.charAt(charIdx);
        charIdx++;
        if (charIdx % 2 === 0 && this.soundEnabled && this.audioCtx) {
          this.playTone(430 + Math.random() * 60, 0.015, 'sine');
        }
        msgBox.scrollTop = msgBox.scrollHeight;
        typeTimer = setTimeout(typeNextChar, 30);
      } else {
        lineIdx++;
        charIdx = 0;
        typeTimer = setTimeout(typeNextChar, 240);
      }
    };

    // 初回文字送り開始
    typeTimer = setTimeout(typeNextChar, 120);

    // モーダルクローズ共通ヘルパー
    const closeModal = () => {
      if (typeTimer) clearTimeout(typeTimer);
      if (this._milestoneFireworksCleanup) {
        this._milestoneFireworksCleanup();
        this._milestoneFireworksCleanup = null;
      }
      this.playSelectSE();
      overlay.remove();
      this.navigateTo('quest-book');
    };

    // モーダル内タップでスキップ
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        // 背景タップで閉じる（フェイルセーフ）
        closeModal();
        return;
      }
      if (!isFinished && e.target !== closeBtn && !closeBtn.contains(e.target)) {
        renderFullText();
      }
    });

    // 決定ボタン押下時
    closeBtn.addEventListener('click', () => {
      closeModal();
    });

    // レベルアップファンファーレSE再生（ここで1度だけクリアに再生） & 打ち上げ花火パーティクル生成
    this.playLevelUpSE();
    setTimeout(() => {
      this._milestoneFireworksCleanup = this.launchLevelUpFireworks('milestone-confetti-canvas');
    }, 100);
  }

  /* ------------------------------------------------------------------------
   * 🎆 レベルアップ祝賀 打ち上げ花火＆祝彩スパーク エフェクト (HTML5 Canvas)
   * ------------------------------------------------------------------------ */
  launchLevelUpFireworks(canvasId = 'milestone-confetti-canvas') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    let animId = null;
    let spawnTimer = null;
    let isRunning = true;

    // 高解像度ディスプレイ対応（Retina）
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      if (!canvas || !canvas.parentElement) return;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      if (ctx.resetTransform) {
        ctx.resetTransform();
      } else {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    // 祝宴カラーパレット（金・紅・紫・空・緑・橙・純白）
    const PALETTES = [
      ['#ffd700', '#ffeb3b', '#fff59d', '#ffffff'], // ゴールドラッシュ
      ['#ff3366', '#ff758c', '#ff8da1', '#ffffff'], // ルビークリムゾン
      ['#00e5ff', '#80d8ff', '#e0f7fa', '#ffffff'], // ダイヤシアン
      ['#a855f7', '#c084fc', '#e9d5ff', '#ffffff'], // アメジストバイオレット
      ['#00ff88', '#69f0ae', '#b9f6ca', '#ffffff'], // エメラルドスター
      ['#ff9100', '#ffab40', '#ffe082', '#ffffff']  // トパーズオレンジ
    ];

    const rockets = [];
    const particles = [];

    // ロケット弾クラス
    class Rocket {
      constructor(startX, startY, targetX, targetY, colors) {
        this.x = startX;
        this.y = startY;
        this.startX = startX;
        this.startY = startY;
        this.targetX = targetX;
        this.targetY = targetY;
        this.colors = colors;
        this.distanceToTarget = Math.hypot(targetX - startX, targetY - startY);
        this.distanceTraveled = 0;
        this.angle = Math.atan2(targetY - startY, targetX - startX);
        this.speed = 10 + Math.random() * 4;
        this.history = [];
        this.dead = false;
      }

      update() {
        this.history.push({ x: this.x, y: this.y });
        if (this.history.length > 4) this.history.shift();

        const vx = Math.cos(this.angle) * this.speed;
        const vy = Math.sin(this.angle) * this.speed;
        this.x += vx;
        this.y += vy;
        this.distanceTraveled = Math.hypot(this.x - this.startX, this.y - this.startY);

        if (this.distanceTraveled >= this.distanceToTarget || this.y <= this.targetY) {
          this.dead = true;
          this.explode();
        }
      }

      explode() {
        const count = 55 + Math.floor(Math.random() * 25);
        for (let i = 0; i < count; i++) {
          particles.push(new Particle(this.targetX, this.targetY, this.colors));
        }
      }

      draw(c) {
        c.save();
        c.beginPath();
        if (this.history.length > 0) {
          c.moveTo(this.history[0].x, this.history[0].y);
          for (let i = 1; i < this.history.length; i++) {
            c.lineTo(this.history[i].x, this.history[i].y);
          }
          c.strokeStyle = '#ffd700';
          c.lineWidth = 2.5;
          c.stroke();
        }
        c.beginPath();
        c.arc(this.x, this.y, 2.5, 0, Math.PI * 2);
        c.fillStyle = '#ffffff';
        c.shadowColor = '#ffd700';
        c.shadowBlur = 8;
        c.fill();
        c.restore();
      }
    }

    // 炸裂スパーク・火花クラス
    class Particle {
      constructor(x, y, colors) {
        this.x = x;
        this.y = y;
        this.colors = colors;
        this.color = colors[Math.floor(Math.random() * colors.length)];
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.pow(Math.random(), 0.7) * 7.5 + 1.2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.friction = 0.955;
        this.gravity = 0.085;
        this.alpha = 1;
        this.decay = 0.012 + Math.random() * 0.014;
        this.size = 1.8 + Math.random() * 2.2;
        this.history = [];
        this.flicker = Math.random() > 0.3;
      }

      update() {
        this.history.push({ x: this.x, y: this.y });
        if (this.history.length > 3) this.history.shift();

        this.vx *= this.friction;
        this.vy *= this.friction;
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= this.decay;
      }

      draw(c) {
        if (this.alpha <= 0) return;
        c.save();
        c.globalAlpha = this.flicker && Math.random() < 0.2 ? this.alpha * 0.4 : this.alpha;

        if (this.history.length > 1) {
          c.beginPath();
          c.moveTo(this.history[0].x, this.history[0].y);
          for (let i = 1; i < this.history.length; i++) {
            c.lineTo(this.history[i].x, this.history[i].y);
          }
          c.strokeStyle = this.color;
          c.lineWidth = this.size;
          c.lineCap = 'round';
          c.stroke();
        }

        c.beginPath();
        c.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        c.fillStyle = this.color;
        c.shadowColor = this.color;
        c.shadowBlur = 6;
        c.fill();
        c.restore();
      }
    }

    // 花火打ち上げトリガー関数
    const launchRocket = (startX, targetX, targetY, colors) => {
      const sx = startX ?? (window.innerWidth * (0.2 + Math.random() * 0.6));
      const sy = window.innerHeight + 10;
      const tx = targetX ?? (window.innerWidth * (0.15 + Math.random() * 0.7));
      const ty = targetY ?? (window.innerHeight * (0.12 + Math.random() * 0.32));
      const pal = colors || PALETTES[Math.floor(Math.random() * PALETTES.length)];
      rockets.push(new Rocket(sx, sy, tx, ty, pal));
    };

    // 開幕直後の3連速射花火（左右・中央で祝宴を演出）
    setTimeout(() => {
      if (!isRunning) return;
      launchRocket(window.innerWidth * 0.25, window.innerWidth * 0.25, window.innerHeight * 0.22, PALETTES[0]);
      launchRocket(window.innerWidth * 0.75, window.innerWidth * 0.75, window.innerHeight * 0.20, PALETTES[1]);
      setTimeout(() => {
        if (!isRunning) return;
        launchRocket(window.innerWidth * 0.5, window.innerWidth * 0.5, window.innerHeight * 0.16, PALETTES[2]);
      }, 200);
    }, 60);

    // 継続的な時間差打ち上げループ（モーダル展開中）
    const scheduleNextRocket = () => {
      if (!isRunning) return;
      const delay = 450 + Math.random() * 550;
      spawnTimer = setTimeout(() => {
        if (!isRunning) return;
        launchRocket();
        if (Math.random() < 0.35) {
          // たまにダブル打ち上げ
          setTimeout(() => {
            if (isRunning) launchRocket();
          }, 120);
        }
        scheduleNextRocket();
      }, delay);
    };
    scheduleNextRocket();

    // 描画メインループ
    const loop = () => {
      if (!isRunning) return;
      const w = window.innerWidth;
      const h = window.innerHeight;

      // 前フレームの残像を残しつつ滑らかにクリア
      ctx.clearRect(0, 0, w, h);

      // ロケット更新＆描画
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.update();
        r.draw(ctx);
        if (r.dead) {
          rockets.splice(i, 1);
        }
      }

      // パーティクル更新＆描画
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        p.draw(ctx);
        if (p.alpha <= 0) {
          particles.splice(i, 1);
        }
      }

      animId = requestAnimationFrame(loop);
    };

    loop();

    // クリーンアップ関数
    const cleanup = () => {
      isRunning = false;
      if (animId) cancelAnimationFrame(animId);
      if (spawnTimer) clearTimeout(spawnTimer);
      window.removeEventListener('resize', resize);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    };

    return cleanup;
  }

  // 下位互換エイリアス
  launchLevelUpConfetti(canvasId) {
    return this.launchLevelUpFireworks(canvasId);
  }

  /* ------------------------------------------------------------------------
   * ⚠️ 既に獲得済みのマイルストーン達成モーダル
   * ------------------------------------------------------------------------ */
  showAlreadyClaimedMilestoneModal(res = {}) {
    const targetTier = res.targetTier;
    const tierTitle = targetTier?.title || 'このマイルストーン特典';

    const overlay = document.createElement('div');
    overlay.className = 'rpg-modal-overlay';
    overlay.id = 'milestone-already-claimed-modal';

    overlay.innerHTML = `
      <div class="rpg-modal-window gold-border" style="max-width:380px; width:92%; text-align:center;">
        <div class="rpg-window-header" style="margin-bottom:10px;">
          <span>📜 特典獲得確認</span>
        </div>
        <div style="font-size:36px; margin:8px 0;">🛡️✨</div>
        <div style="font-size:16px; font-weight:bold; color:var(--text-yellow); margin-bottom:6px;">
          獲得済みです
        </div>
        <div style="font-size:13px; color:#e2e8f0; line-height:1.5; margin-bottom:14px;">
          【${this.escapeHtml(tierTitle)}】および該当する特典は、すでに冒険の書に獲得済みです。<br>
          クーポンは冒険の書からご利用いただけます。
        </div>
        <button id="btn-already-claimed-close" class="command-button" style="width:100%; padding:10px; font-size:14px; background:#1e293b; border:1px solid var(--border-gold); color:#ffffff; border-radius:6px; cursor:pointer;">
          閉じる
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('btn-already-claimed-close').addEventListener('click', () => {
      this.playBackSE();
      overlay.remove();
      this.navigateTo('quest-book');
    });
  }


  /* ------------------------------------------------------------------------
   * 3.2 エリア一覧
   * ------------------------------------------------------------------------ */
  renderAreaView(container) {
    this.typeMessage('探したいエリアを選択してください。');

    const stores = this.getStores();
    const areas = this.getAreas();
    const areaItems = areas.map(area => {
      const count = stores.filter(s => s.area === area).length;
      return `
        <li class="command-item" data-area="${area}">
          <div class="command-item-left">
            <span class="command-cursor">▶</span>
            <span class="command-label">${area}</span>
          </div>
          <span class="command-badge">${count}軒</span>
        </li>
      `;
    }).join('');

    container.innerHTML = `
      <div class="rpg-window">
        <div class="rpg-window-header">
          <span>▶ エリア選択</span>
          <span class="header-badge">エリア</span>
        </div>
        <ul class="command-list">
          ${areaItems}
        </ul>
      </div>
    `;

    container.querySelectorAll('.command-item').forEach(item => {
      item.addEventListener('mouseenter', () => this.playCursorSE());
      item.addEventListener('click', () => {
        this.playSelectSE();
        this.resetFilters();
        this.filters.area = item.dataset.area;
        this.navigateTo('stores');
      });
    });
  }

  /* ------------------------------------------------------------------------
   * 3.3 酒場の種類一覧
   * ------------------------------------------------------------------------ */
  renderCategoryView(container) {
    this.typeMessage('探したい酒場のジャンルを選択してください。');

    const stores = this.getStores();
    const categories = this.getCategories();
    const categoryItems = categories.map(cat => {
      const count = stores.filter(s => s.category === cat).length;
      return `
        <li class="command-item" data-category="${cat}">
          <div class="command-item-left">
            <span class="command-cursor">▶</span>
            <span class="command-label">${cat}</span>
          </div>
          <span class="command-badge">${count}軒</span>
        </li>
      `;
    }).join('');

    container.innerHTML = `
      <div class="rpg-window">
        <div class="rpg-window-header">
          <span>▶ 酒場の種類</span>
          <span class="header-badge">ジャンル</span>
        </div>
        <ul class="command-list">
          ${categoryItems}
        </ul>
      </div>
    `;

    container.querySelectorAll('.command-item').forEach(item => {
      item.addEventListener('mouseenter', () => this.playCursorSE());
      item.addEventListener('click', () => {
        this.playSelectSE();
        this.resetFilters();
        this.filters.category = item.dataset.category;
        this.navigateTo('stores');
      });
    });
  }

  /* ------------------------------------------------------------------------
   * 3.4 スタイル一覧
   * ------------------------------------------------------------------------ */
  renderStyleView(container) {
    this.typeMessage('席のスタイルを選択してください。');

    const stores = this.getStores();
    const styles = this.getStyles();
    const styleItems = styles.map(style => {
      const count = stores.filter(s => s.style === style).length;
      return `
        <li class="command-item" data-style="${style}">
          <div class="command-item-left">
            <span class="command-cursor">▶</span>
            <span class="command-label">${style}</span>
          </div>
          <span class="command-badge">${count}軒</span>
        </li>
      `;
    }).join('');

    container.innerHTML = `
      <div class="rpg-window">
        <div class="rpg-window-header">
          <span>▶ 席スタイル</span>
          <span class="header-badge">スタイル</span>
        </div>
        <ul class="command-list">
          ${styleItems}
        </ul>
      </div>
    `;

    container.querySelectorAll('.command-item').forEach(item => {
      item.addEventListener('mouseenter', () => this.playCursorSE());
      item.addEventListener('click', () => {
        this.playSelectSE();
        this.resetFilters();
        this.filters.style = item.dataset.style;
        this.navigateTo('stores');
      });
    });
  }

  /* ------------------------------------------------------------------------
   * 3.5 酔いどれタイプ一覧
   * ------------------------------------------------------------------------ */
  renderTypeView(container) {
    this.typeMessage('気分に合わせた呑み方タイプを選択してください。');

    const stores = this.getStores();
    const types = this.getTypes();
    const typeItems = types.map(type => {
      const count = stores.filter(s => s.type === type).length;
      return `
        <li class="command-item" data-type="${type}">
          <div class="command-item-left">
            <span class="command-cursor">▶</span>
            <span class="command-label">${type}</span>
          </div>
          <span class="command-badge">${count}軒</span>
        </li>
      `;
    }).join('');

    container.innerHTML = `
      <div class="rpg-window">
        <div class="rpg-window-header">
          <span>▶ 酔いどれタイプ</span>
          <span class="header-badge">タイプ</span>
        </div>
        <ul class="command-list">
          ${typeItems}
        </ul>
      </div>
    `;

    container.querySelectorAll('.command-item').forEach(item => {
      item.addEventListener('mouseenter', () => this.playCursorSE());
      item.addEventListener('click', () => {
        this.playSelectSE();
        this.resetFilters();
        this.filters.type = item.dataset.type;
        this.navigateTo('stores');
      });
    });
  }

  /* ------------------------------------------------------------------------
   * 3.7 店舗一覧 (カード形式 & フィルター)
   * ------------------------------------------------------------------------ */
  renderStoresView(container) {
    const isFiltered = this.filters.area !== 'ALL' || 
                       this.filters.category !== 'ALL' || 
                       this.filters.style !== 'ALL' || 
                       this.filters.type !== 'ALL' || 
                       this.filters.takeout !== 'ALL' || 
                       this.filters.openToday || 
                       this.filters.organizer || 
                       this.filters.searchQuery !== '';

    const areasList = this.getAreas();
    const areaOptions = ['ALL', ...areasList].map(a => 
      `<option value="${a}" ${this.filters.area === a ? 'selected' : ''}>${a === 'ALL' ? '全エリア' : a}</option>`
    ).join('');

    const categoriesList = this.getCategories();
    const catOptions = ['ALL', ...categoriesList].map(c => 
      `<option value="${c}" ${this.filters.category === c ? 'selected' : ''}>${c === 'ALL' ? '全種類' : c}</option>`
    ).join('');

    const stylesList = this.getStyles();
    const styleOptions = ['ALL', ...stylesList].map(s => 
      `<option value="${s}" ${this.filters.style === s ? 'selected' : ''}>${s === 'ALL' ? '全スタイル' : s}</option>`
    ).join('');

    const typesList = this.getTypes();
    const OFFICIAL_TYPE_NAMES = ['サク飲み', '腹ごしらえ', 'ひと休み', '昼飲み', '夜遊び'];
    const allTypes = Array.from(new Set([...OFFICIAL_TYPE_NAMES, ...typesList]));
    const typeOptions = ['ALL', ...allTypes].map(t => 
      `<option value="${t}" ${this.filters.type === t ? 'selected' : ''}>${t === 'ALL' ? '全酔いどれタイプ' : t}</option>`
    ).join('');

    container.innerHTML = `
      <div class="rpg-window" id="store-filter-window">
        <div class="rpg-window-header">
          <span>▶ 絞り込み条件</span>
          <div class="filter-header-action">
            <button id="btn-reset-filters" class="filter-reset-btn ${isFiltered ? '' : 'hidden'}" type="button">✖ 条件クリア</button>
          </div>
        </div>
        <div class="filter-box">
          <div class="filter-row">
            <select id="filter-area" class="filter-select">${areaOptions}</select>
            <select id="filter-category" class="filter-select">${catOptions}</select>
          </div>
          <div class="filter-row">
            <select id="filter-style" class="filter-select">${styleOptions}</select>
            <select id="filter-type" class="filter-select">${typeOptions}</select>
          </div>
          <div class="filter-row">
            <input type="text" id="filter-search" class="search-input" placeholder="酒場名・キーワード検索..." value="${this.filters.searchQuery}">
          </div>
          <div class="filter-chip-group">
            <div class="filter-chip ${this.filters.openToday ? 'active' : ''}" id="chip-open-today">
              ${this.filters.openToday ? '✓ どれクエ対応中のみ' : 'どれクエ対象時間内のみ'}
            </div>
            <div class="filter-chip ${this.filters.takeout === 'YES' ? 'active' : ''}" id="chip-takeout">
              ${this.filters.takeout === 'YES' ? '✓ テイクアウト可のみ' : 'テイクアウト可のみ'}
            </div>
            <div class="filter-chip ${this.filters.organizer ? 'active' : ''}" id="chip-organizer">
              ${this.filters.organizer ? '✓ 運営店のみ' : '運営店のみ'}
            </div>
          </div>
        </div>
      </div>

      <div id="stores-card-list-container" class="store-card-list">
        <!-- JSで動的レンダリング -->
      </div>
    `;

    // 店舗カード一覧の部分更新関数（入力欄などのDOMを破棄しない）
    const updateStoreList = () => {
      let filtered = this.getStores().filter(store => {
        if (this.filters.organizer && !store.isOrganizer) return false;
        if (this.filters.area !== 'ALL' && store.area !== this.filters.area) return false;
        if (this.filters.category !== 'ALL' && store.category !== this.filters.category) return false;
        if (this.filters.style !== 'ALL' && store.style !== this.filters.style) return false;
        if (this.filters.type !== 'ALL' && store.type !== this.filters.type) return false;
        if (this.filters.takeout === 'YES' && !store.isTakeout) return false;
        if (this.filters.openToday && !store.isOpenToday) return false;
        if (this.filters.searchQuery) {
          const q = this.filters.searchQuery.toLowerCase().trim();
          return store.name.toLowerCase().includes(q) || 
                 store.catchphrase.toLowerCase().includes(q);
        }
        return true;
      });

      filtered.sort((a, b) => a.id.localeCompare(b.id, 'ja', { numeric: true }));

      const hasFilter = this.filters.area !== 'ALL' || this.filters.category !== 'ALL' || this.filters.style !== 'ALL' || this.filters.type !== 'ALL' || this.filters.takeout === 'YES' || this.filters.openToday || this.filters.organizer || Boolean(this.filters.searchQuery);
      if (this.filters.organizer) {
        if (filtered.length === 0) {
          this.typeMessage('条件に一致する運営店が見つかりませんでした。条件を変えて探してみよう！');
        } else {
          this.typeMessage(`達成QR設置・グッズ交換ができる運営店が ${filtered.length}軒あります！気になる酒場へ出発しよう！`);
        }
      } else if (hasFilter) {
        if (filtered.length === 0) {
          this.typeMessage('条件に一致する酒場が見つかりませんでした。条件を変えて探してみよう！');
        } else {
          this.typeMessage(`条件に一致する酒場が ${filtered.length}軒見つかりました！気になる酒場を決めて出発しよう！`);
        }
      } else {
        this.typeMessage(`大正区の酒場が ${filtered.length}軒集結！気になる酒場をタップしてメニューやクエストを確かめよう！`);
      }

      const cardsHtml = filtered.length > 0 ? filtered.map(store => {
        const isCoupon = Boolean(store.isCouponTarget);
        return `
        <div class="store-card" data-id="${store.id}">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
            <div class="store-name">
              <span>${store.name}</span>
            </div>
            <span class="store-status-badge ${store.isOpenToday ? 'status-open' : 'status-closed'}" style="flex-shrink:0;">
              ${store.isOpenToday ? 'どれクエ対応中' : 'どれクエ対象時間外'}
            </span>
          </div>

          <div class="store-previews" style="margin-top:6px;">
            ${store.yoidoreSet && store.yoidoreSet.title ? `
              <div class="store-set-preview">
                <div class="preview-header">
                  <span class="preview-label">🍺 酔いどれセット:</span>
                  ${store.yoidoreSet.price > 0 ? `
                    <span class="store-price">
                      ¥${store.yoidoreSet.price.toLocaleString()}
                      <span style="font-size:11px; color:var(--text-dim); font-weight:normal; margin-left:3px;">(税込${store.yoidoreSet.charge === '込' ? '・チャージ料込' : ''})</span>
                    </span>
                  ` : ''}
                </div>
                <div class="preview-title">${store.yoidoreSet.title}</div>
              </div>
            ` : ''}

            ${store.isQuestActive ? `
              <div class="store-quest-preview">
                <div class="preview-header">
                  <span class="preview-label">⚔️ クエスト:</span>
                  ${store.quest.price > 0 ? `
                    <span class="store-price">
                      ¥${store.quest.price.toLocaleString()}
                      <span style="font-size:11px; color:var(--text-dim); font-weight:normal; margin-left:3px;">(税込${store.quest.charge === '込' ? '・チャージ料込' : ''})</span>
                    </span>
                  ` : `
                    <span style="font-size:14px; color:#00ffaa; font-weight:bold;">
                      🟢 無料
                      ${store.quest.charge === '込' ? `<span style="font-size:11px; color:var(--text-dim); font-weight:normal; margin-left:3px;">(チャージ料込)</span>` : ''}
                    </span>
                  `}
                </div>
                <div class="preview-title">${store.quest.title || store.quest.content}</div>
              </div>
            ` : ''}
          </div>

          <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center; margin-top:8px; padding-top:8px; border-top:1px dashed rgba(255,255,255,0.15);">
            ${store.isOrganizer ? `<span class="tag" style="background:#1e3a8a; color:#93c5fd; border-color:#3b82f6;">運営店（QR設置）</span>` : ''}
            ${isCoupon ? `<span class="tag" style="background:#4d3800; color:#ffeeba; border-color:#ffc107;">🎁 特典対象</span>` : ''}
            ${store.area ? `<span class="tag tag-area">${store.area}</span>` : ''}
            ${store.category ? `<span class="tag">${store.category}</span>` : ''}
            ${store.style ? `<span class="tag tag-style">${store.style}</span>` : ''}
            ${store.type ? `<span class="tag tag-type">${store.type}</span>` : ''}
            ${store.isTakeout ? `<span class="tag tag-takeout">${store.takeout}</span>` : ''}
          </div>
        </div>
        `;
      }).join('') : `
        <div class="rpg-window text-center" style="padding: 20px; color: var(--text-dim);">
          条件に一致する酒場が見つかりませんでした。<br>フィルターを変更してください。
        </div>
      `;

      const listContainer = document.getElementById('stores-card-list-container');
      if (listContainer) {
        listContainer.innerHTML = cardsHtml;

        listContainer.querySelectorAll('.store-card').forEach(card => {
          card.addEventListener('mouseenter', () => this.playCursorSE());
          card.addEventListener('click', () => {
            this.playSelectSE();
            const storeId = card.dataset.id;
            const store = this.getStores().find(s => s.id === storeId);
            if (store) {
              this.navigateTo('detail', { store });
            }
          });
        });
      }

      // 条件クリアボタンの表示制御
      const currentFiltered = this.filters.area !== 'ALL' || 
                              this.filters.category !== 'ALL' || 
                              this.filters.style !== 'ALL' || 
                              this.filters.type !== 'ALL' || 
                              this.filters.takeout !== 'ALL' || 
                              this.filters.openToday || 
                              this.filters.organizer || 
                              Boolean(this.filters.searchQuery && this.filters.searchQuery.trim());
      const resetBtnElem = document.getElementById('btn-reset-filters');
      if (resetBtnElem) {
        resetBtnElem.classList.toggle('hidden', !currentFiltered);
      }

      this.updateStickyFilterBar();
      this.updateHistoryFilters();
    };

    // 初回レンダリング
    updateStoreList();

    // 条件リセットボタン
    const resetBtn = document.getElementById('btn-reset-filters');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.playSelectSE();
        this.resetFilters();
        this.renderStoresView(container);
      });
    }

    // ドロップダウン選択チェンジイベント
    const onFilterChange = () => {
      this.playSelectSE();
      this.filters.area = document.getElementById('filter-area').value;
      this.filters.category = document.getElementById('filter-category').value;
      this.filters.style = document.getElementById('filter-style').value;
      this.filters.type = document.getElementById('filter-type').value;
      this.lastStoresScrollY = 0;
      updateStoreList();
    };

    document.getElementById('filter-area').addEventListener('change', onFilterChange);
    document.getElementById('filter-category').addEventListener('change', onFilterChange);
    document.getElementById('filter-style').addEventListener('change', onFilterChange);
    document.getElementById('filter-type').addEventListener('change', onFilterChange);

    // キーワード検索（IME日本語入力変換対応）
    const searchInput = document.getElementById('filter-search');
    let isComposing = false;

    searchInput.addEventListener('compositionstart', () => {
      isComposing = true;
    });

    searchInput.addEventListener('compositionend', (e) => {
      isComposing = false;
      this.filters.searchQuery = e.target.value;
      this.lastStoresScrollY = 0;
      updateStoreList();
    });

    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      this.filters.searchQuery = e.target.value;
      if (isComposing) return; // 日本語入力・漢字変換中はリアルタイム検索によるカード更新をスキップ
      
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.lastStoresScrollY = 0;
        updateStoreList();
      }, 250);
    });

    // 今日営業のみチップ
    document.getElementById('chip-open-today').addEventListener('click', () => {
      this.playSelectSE();
      this.filters.openToday = !this.filters.openToday;
      const chip = document.getElementById('chip-open-today');
      if (chip) {
        chip.classList.toggle('active', this.filters.openToday);
        chip.textContent = this.filters.openToday ? '✓ どれクエ対応中のみ' : 'どれクエ対象時間内のみ';
      }
      this.lastStoresScrollY = 0;
      updateStoreList();
    });

    // テイクアウト可のみチップ
    document.getElementById('chip-takeout').addEventListener('click', () => {
      this.playSelectSE();
      this.filters.takeout = (this.filters.takeout === 'YES') ? 'ALL' : 'YES';
      const chip = document.getElementById('chip-takeout');
      if (chip) {
        chip.classList.toggle('active', this.filters.takeout === 'YES');
        chip.textContent = (this.filters.takeout === 'YES') ? '✓ テイクアウト可のみ' : 'テイクアウト可のみ';
      }
      this.lastStoresScrollY = 0;
      updateStoreList();
    });

    // 運営店のみチップ
    document.getElementById('chip-organizer').addEventListener('click', () => {
      this.playSelectSE();
      this.filters.organizer = !this.filters.organizer;
      const chip = document.getElementById('chip-organizer');
      if (chip) {
        chip.classList.toggle('active', this.filters.organizer);
        chip.textContent = this.filters.organizer ? '✓ 運営店のみ' : '運営店のみ';
      }
      this.lastStoresScrollY = 0;
      updateStoreList();
    });
  }

  /* ------------------------------------------------------------------------
   * 3.8 酒場詳細
   * ------------------------------------------------------------------------ */
  renderDetailView(container) {
    const store = this.selectedStore;
    if (!store) {
      this.navigateTo('stores');
      return;
    }

    // 最新日時に基づき「どれクエ対応中」フラグを動的再計算
    store.isOpenToday = checkIsOpenToday(store);

    const activeSeason = window.questApi?.currentSeason;
    const info = activeSeason?.statusInfo;
    const isCouponTarget = Boolean(store.isCouponTarget);

    if (store.isOrganizer) {
      this.typeMessage(`「${store.name}」は大正酔いどれクエストの運営店です！達成QRコードの読み取りやグッズ交換ができます。`);
    } else if (info && info.isExpired) {
      this.typeMessage(`「${store.name}」の店舗情報です。営業時間やメニューをご確認いただけます。`);
    } else if (info && info.isCouponActive && isCouponTarget) {
      this.typeMessage(`「${store.name}」の情報です。このお店では特典の酒場クーポンが使えます！`);
    } else {
      this.typeMessage(`「${store.name}」の情報です。「酔いどれセット」や「店舗クエスト」を楽しもう！`);
    }

    const conditions = store.conditions || {
      days: store.days,
      hours: store.hours,
      timeNotes: store.time_notes,
      limit: store.set_limit
    };

    const paymentMethods = Array.isArray(store.paymentMethods) && store.paymentMethods.length > 0
      ? store.paymentMethods
      : (store.payment ? String(store.payment).split(/[,、/|]/).map(p => p.trim()).filter(Boolean) : []);
    const paymentTagsHtml = paymentMethods.map(p => `<span class="tag" style="background:rgba(255,255,255,0.08); border-color:#8b7333; font-size:11px; padding:2px 6px;">${this.escapeHtml(p)}</span>`).join('');

    container.innerHTML = `
      <div class="detail-section">
        <!-- 1. 酒場基本情報枠 -->
        <div class="rpg-window gold-border">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
            <div>
              <h2 class="detail-store-name" style="margin:0;">${store.name}</h2>
              ${store.catchphrase ? `<div class="detail-catchphrase" style="margin-top:4px;">"${store.catchphrase}"</div>` : ''}
            </div>
            <span class="store-status-badge ${store.isOpenToday ? 'status-open' : 'status-closed'}" style="flex-shrink:0;">
              ${store.isOpenToday ? 'どれクエ対応中' : 'どれクエ対象時間外'}
            </span>
          </div>

          <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center; margin-top:10px;">
            ${store.isOrganizer ? `<span class="tag" style="background:#1e3a8a; color:#93c5fd; border-color:#3b82f6;">運営店（達成QR設置・グッズ交換）</span>` : ''}
            ${isCouponTarget ? `<span class="tag" style="background:#4d3800; color:#ffeeba; border-color:#ffc107;">🎁 特典対象</span>` : ''}
            ${store.area ? `<span class="tag tag-area">${store.area}</span>` : ''}
            ${store.category ? `<span class="tag">${store.category}</span>` : ''}
            ${store.style ? `<span class="tag tag-style">${store.style}</span>` : ''}
            ${store.type ? `<span class="tag tag-type">${store.type}</span>` : ''}
            ${store.isTakeout ? `<span class="tag tag-takeout">${store.takeout}</span>` : ''}
          </div>

          ${store.address ? `
            <div class="detail-address-row" style="margin-top:10px; font-size:13px; color:#cbd5e1; display:flex; align-items:flex-start; gap:6px; line-height:1.4;">
              <span style="color:var(--text-yellow); flex-shrink:0;">📍</span>
              <span style="word-break:break-all;">${this.escapeHtml(store.address)}</span>
            </div>
          ` : ''}

          ${paymentTagsHtml ? `
            <div style="margin-top:12px; padding-top:10px; border-top:1px dashed var(--border-gold, #8b7333); display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span style="font-size:13px; color:var(--text-yellow, #ffd700); font-weight:bold;">💳 支払い方法:</span>
              <div class="payment-tags" style="display:inline-flex; gap:6px; flex-wrap:wrap;">${paymentTagsHtml}</div>
            </div>
          ` : ''}
        </div>

        <!-- 運営店インフォメーション枠 -->
        ${store.isOrganizer ? `
          <div class="rpg-window" style="background: rgba(30, 58, 138, 0.25); border: 1px solid #3b82f6;">
            <div style="font-size:13px; color:#93c5fd; font-weight:bold;">【大正酔いどれクエスト 運営店】</div>
            <div style="font-size:12px; color:#cbd5e1; margin-top:4px; line-height:1.5;">
              この店舗には「達成QRコード」が設置されています。紙の冒険の書にサインが集まったら、店内の達成QRを読み取って特典解放やグッズ交換を行えます。
            </div>
          </div>
        ` : ''}

        <!-- 特典クーポン利用アクション (クーポン対象店舗の場合) -->
        ${isCouponTarget ? (() => {
          const activeSeasonId = window.questApi?.currentSeason?.id || 2;
          const userCoupons = (window.questApi && window.questApi.userCoupons) || [];
          const seasonCoupons = userCoupons.filter(c => (c.season_id === activeSeasonId || (!c.season_id && activeSeasonId === 2)) && c.reward_type !== 'goods');
          const isUsedHere = seasonCoupons.some(c => c.store_id === store.id && c.status === 'used');
          
          const rewardTiers = (window.questApi && window.questApi.rewardTiers) || [];
          const reachedCouponTiers = rewardTiers.filter(t => t.reward_type !== 'goods' && seasonCoupons.some(c => Number(c.reward_tier_id) === Number(t.id)));
          const totalEarnedSlots = reachedCouponTiers.reduce((sum, t) => sum + (Number(t.selectable_count) || 5), 0);
          const usedCount = seasonCoupons.filter(c => c.status === 'used').length;
          const availableCount = Math.max(0, totalEarnedSlots - usedCount);

          if (isUsedHere) {
            return `
              <div class="rpg-window" style="background: rgba(30, 41, 59, 0.7); border: 1px solid #475569;">
                <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                  <div>
                    <div style="font-size:14px; font-weight:bold; color:#cbd5e1;">特典クーポン利用済み</div>
                    <div style="font-size:12px; color:#94a3b8;">この酒場でのハシゴ達成クーポンはご利用済みです。</div>
                  </div>
                  <div class="stamp-hanko-badge" style="font-size:12px; padding:3px 9px;">USED</div>
                </div>
              </div>
            `;
          }

          if (availableCount > 0) {
            return `
              <div class="rpg-window gold-border" style="background: linear-gradient(135deg, rgba(120, 53, 15, 0.4) 0%, rgba(69, 26, 3, 0.4) 100%);">
                <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                  <div>
                    <div style="font-size:14px; font-weight:bold; color:var(--text-yellow); white-space:nowrap;">🎟️ 酒場特典クーポン利用可能</div>
                    <div style="font-size:12px; color:#fed7aa;">保有残枠: <strong>${availableCount} 軒分</strong> (お会計時に提示)</div>
                  </div>
                  <button id="btn-detail-use-coupon" class="treasure-claim-btn" style="padding:8px 12px; font-size:13px; margin:0; background:linear-gradient(180deg, #10b981 0%, #047857 100%); border-color:#34d399; white-space:nowrap; flex-shrink:0;">
                    🍺 クーポンを使う ▶
                  </button>
                </div>
              </div>
            `;
          }

          return `
            <div class="rpg-window" style="background: rgba(15, 23, 42, 0.6); border: 1px dashed var(--border-gold);">
              <div style="font-size:13px; color:var(--text-yellow); font-weight:bold;">🎁 酒場特典対象店</div>
              <div style="font-size:12px; color:#94a3b8; margin-top:2px;">運営店で達成QRコードを読み取って特典を獲得すると、この酒場のクーポンを利用できます。</div>
            </div>
          `;
        })() : ''}

        <!-- 2. どれクエ対象時間枠 -->
        <div class="rpg-window">
          <div class="rpg-window-header">
            <span>⏰ どれクエ対象時間</span>
          </div>
          <table class="info-table">
            ${conditions.days ? `
              <tr>
                <th>提供日</th>
                <td><strong style="color:#ffffff;">${conditions.days}</strong></td>
              </tr>
            ` : ''}
            ${conditions.hours ? `
              <tr>
                <th>提供時間</th>
                <td>
                  <strong style="color:#ffffff;">${conditions.hours}</strong>
                  ${conditions.timeNotes ? `
                    <div style="font-size:13px; color:#fde68a; margin-top:4px; line-height:1.4;">
                      💡 ${this.escapeHtml(conditions.timeNotes)}
                    </div>
                  ` : ''}
                </td>
              </tr>
            ` : ''}
            ${conditions.limit ? `
              <tr>
                <th>限定数</th>
                <td><span style="color:#ffffff;">${conditions.limit}</span> ${conditions.soldOutEnd ? '<span style="font-size:12px; color:var(--text-yellow);">（売切終了）</span>' : ''}</td>
              </tr>
            ` : ''}
            ${store.takeout ? `
              <tr>
                <th>テイクアウト</th>
                <td><span style="color:#ffffff;">${store.takeout}</span></td>
              </tr>
            ` : ''}
          </table>
        </div>

        <!-- 3. 酔いどれセット情報枠 -->
        ${store.yoidoreSet && store.yoidoreSet.title ? `
          <div class="rpg-window">
            <div class="rpg-window-header">
              <span>🍺 酔いどれセット情報</span>
            </div>
            <table class="info-table">
              <tr>
                <th>セット名</th>
                <td><span class="text-yellow" style="font-size:16px; font-weight:bold;">${store.yoidoreSet.title}</span></td>
              </tr>
              ${store.yoidoreSet.content ? `
                <tr>
                  <th>内容</th>
                  <td style="line-height:1.6; color:#ffffff; font-size:14px;">${store.yoidoreSet.content}</td>
                </tr>
              ` : ''}
              ${store.yoidoreSet.price > 0 ? `
                <tr>
                  <th>金額</th>
                  <td>
                    <div style="display:flex; align-items:baseline; gap:6px; flex-wrap:wrap;">
                      <strong class="text-green" style="font-size:19px;">¥${store.yoidoreSet.price.toLocaleString()}</strong>
                      <span style="font-size:12px; color:#cbd5e1;">(税込)</span>
                      ${store.yoidoreSet.charge ? `
                        <span style="font-size:12px; color:#ffffff; background:rgba(255,255,255,0.15); padding:2px 8px; border-radius:4px;">
                          チャージ: ${store.yoidoreSet.charge === '込' ? '込' : (store.yoidoreSet.charge === '不要' || store.yoidoreSet.charge === '0' || store.yoidoreSet.charge === '無し' ? 'なし' : store.yoidoreSet.charge)}
                        </span>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              ` : ''}
              ${store.yoidoreSet.notes ? `
                <tr>
                  <th>備考</th>
                  <td style="font-size:14px; color:#e2e8f0; line-height:1.5;">${store.yoidoreSet.notes}</td>
                </tr>
              ` : ''}
            </table>
          </div>
        ` : ''}

        <!-- 4. 酒場クエスト情報枠 -->
        ${(store.isQuestActive && store.quest && store.quest.title && store.quest.title !== '？？？？？') ? `
          <div class="rpg-window">
            <div class="rpg-window-header">
              <span>⚔️ 酒場クエスト情報</span>
            </div>
            <table class="info-table">
              <tr>
                <th>クエスト名</th>
                <td><span class="text-yellow" style="font-size:16px; font-weight:bold;">${store.quest.title}</span></td>
              </tr>
              ${store.quest.content ? `
                <tr>
                  <th>内容</th>
                  <td style="line-height:1.6; color:#ffffff; font-size:14px;">${store.quest.content}</td>
                </tr>
              ` : ''}
              <tr>
                <th>料金</th>
                <td>
                  <div style="display:flex; align-items:baseline; gap:6px; flex-wrap:wrap;">
                    ${store.quest.price > 0 ? `
                      <strong class="text-green" style="font-size:19px;">¥${store.quest.price.toLocaleString()}</strong>
                      <span style="font-size:12px; color:#cbd5e1;">(税込)</span>
                    ` : `
                      <span class="quest-fee-badge" style="font-size:12px;">🟢 参加無料</span>
                    `}
                    ${store.quest.charge && store.quest.charge !== '不要' && store.quest.charge !== '0' && store.quest.charge !== '無し' ? `
                      <span style="font-size:12px; color:#ffffff; background:rgba(255,255,255,0.15); padding:2px 8px; border-radius:4px;">
                        チャージ: ${store.quest.charge}
                      </span>
                    ` : ''}
                  </div>
                </td>
              </tr>
              ${store.quest.notes ? `
                <tr>
                  <th>備考</th>
                  <td style="font-size:14px; color:#e2e8f0; line-height:1.5;">${store.quest.notes}</td>
                </tr>
              ` : ''}
            </table>
          </div>
        ` : ''}

        <!-- 5. 酒場写真ギャラリー -->
        ${(store.photoUrl || store.photo_url) ? `
          <div class="rpg-window">
            <div class="rpg-window-header">
              <span>📷 オモロイ人</span>
            </div>
            <div class="detail-photo-box">
              <img src="${store.photoUrl || store.photo_url}" alt="${store.name}のオモロイ人写真" class="detail-photo-img" onerror="this.closest('.rpg-window').style.display='none';">
            </div>
          </div>
        ` : ''}

        <!-- 外部リンク (Googleマップ / Instagram) -->
        ${(() => {
          let directUrl = (store.googleMapUrl || store.map_url || '').trim();
          if (directUrl && directUrl.includes('google.com/maps/search')) {
            directUrl = '';
          }
          const rawQuery = store.address || (store.name ? (store.name.includes('大正') ? store.name : `大阪市大正区 ${store.name}`) : '大阪市大正区');
          const mapQuery = rawQuery.trim();
          const effectiveMapUrl = directUrl || store.effectiveMapUrl || (mapQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}` : 'https://www.google.com/maps');

          return `
            <div class="rpg-window">
              <div style="display:flex; flex-direction:column; gap:8px;">
                <a href="${effectiveMapUrl}" target="_blank" rel="noopener noreferrer" class="external-link-btn">
                  <span>📍 Googleマップで酒場へ行く</span>
                </a>
                ${store.instagramUrl ? `
                  <a href="${store.instagramUrl}" target="_blank" rel="noopener noreferrer" class="external-link-btn" style="background: linear-gradient(180deg, #801848 0%, #380820 100%);">
                    <span>📷 酒場のInstagramを開く</span>
                  </a>
                ` : ''}
              </div>
            </div>
          `;
        })()}

      </div>
    `;

    container.querySelectorAll('.external-link-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.playSelectSE();
      });
    });

    const detailCouponBtn = container.querySelector('#btn-detail-use-coupon');
    if (detailCouponBtn) {
      detailCouponBtn.addEventListener('click', () => {
        this.playSelectSE();
        const activeSeasonId = window.questApi?.currentSeason?.id || 2;
        const userCoupons = (window.questApi && window.questApi.userCoupons) || [];
        const seasonCoupons = userCoupons.filter(c => (c.season_id === activeSeasonId || (!c.season_id && activeSeasonId === 2)) && c.reward_type !== 'goods');
        const rewardTiers = window.questApi?.rewardTiers || [];
        const reachedCouponTiers = rewardTiers.filter(t => t.reward_type !== 'goods' && seasonCoupons.some(c => Number(c.reward_tier_id) === Number(t.id)));
        const tier = reachedCouponTiers[0] || rewardTiers.find(t => t.reward_type !== 'goods') || rewardTiers[0] || { id: 1, title: 'ハシゴ酒達成特典' };
        
        this.openStoreCouponRedeemModal(tier, store, activeSeasonId);
      });
    }
  }
}

window.YoidoreQuestApp = YoidoreQuestApp;

// DOM読み込み完了時にアプリ起動（タイミング問わず即座に確実に初期化）
function initYoidoreApp() {
  if (!window.app) {
    window.app = new YoidoreQuestApp();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initYoidoreApp);
} else {
  initYoidoreApp();
}
