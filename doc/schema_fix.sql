-- ============================================================================
-- 大正酔いどれクエスト - user_coupons テーブル制約修復＆完全最適化SQL
-- ============================================================================
-- 特典達成時のクーポン枠保存（store_id: NULL、未消費状態）および
-- 複数枚クーポンの一括獲得を許可するためのスキーマ修正です。

-- 1. store_id の NOT NULL 制約を解除（未消込・未選択クーポン枠の保存を許可）
ALTER TABLE public.user_coupons ALTER COLUMN store_id DROP NOT NULL;

-- 2. 旧制約 UNIQUE(user_id, store_id) を削除（同一店舗・同一ユーザーでの複数クーポン保有を許可）
ALTER TABLE public.user_coupons DROP CONSTRAINT IF EXISTS user_coupons_user_id_store_id_key;

-- 3. season_id, reward_tier_id, reward_type などの必要カラムを追加（未存在時のみ）
ALTER TABLE public.user_coupons ADD COLUMN IF NOT EXISTS season_id INT DEFAULT 2;
ALTER TABLE public.user_coupons ADD COLUMN IF NOT EXISTS reward_tier_id INT;
ALTER TABLE public.user_coupons ADD COLUMN IF NOT EXISTS reward_type TEXT DEFAULT 'store_coupon';
ALTER TABLE public.user_coupons ADD COLUMN IF NOT EXISTS goods_name TEXT;
ALTER TABLE public.user_coupons ADD COLUMN IF NOT EXISTS exchange_location TEXT;
ALTER TABLE public.user_coupons ADD COLUMN IF NOT EXISTS exchange_notice TEXT;

-- 4. RLS ポリシーの確認・再設定
ALTER TABLE public.user_coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read user_coupons" ON public.user_coupons;
DROP POLICY IF EXISTS "Allow public insert user_coupons" ON public.user_coupons;
DROP POLICY IF EXISTS "Allow public update user_coupons" ON public.user_coupons;
DROP POLICY IF EXISTS "Allow public delete user_coupons" ON public.user_coupons;

CREATE POLICY "Allow public read user_coupons" ON public.user_coupons FOR SELECT USING (true);
CREATE POLICY "Allow public insert user_coupons" ON public.user_coupons FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update user_coupons" ON public.user_coupons FOR UPDATE USING (true);
CREATE POLICY "Allow public delete user_coupons" ON public.user_coupons FOR DELETE USING (true);
