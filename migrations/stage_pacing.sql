-- 关系阶段限速：每自然日（Asia/Shanghai）最多 +2，且需当日有实质情感卷入（arousal 达标）
-- stage_date：最近一次加分所在的自然日（上海时区），用于判断"今天已加了几分"
-- stage_day_count：当日已加分数，达到 STAGE_DAILY_CAP(2) 后当天不再推进
alter table public.companions
  add column if not exists stage_date date,
  add column if not exists stage_day_count smallint not null default 0;
