-- ─────────────────────────────────────────────────────────────────────────────
-- Popcorn — realtime article likes (so likes cross devices live, like comments)
-- Run this once in the Supabase SQL editor.
--
-- The toggle already records likes atomically. To make a like appear on OTHER
-- devices instantly (instead of only on refresh), there has to be a publicly-
-- watchable value that changes on every like. `user_likes` can't be it — its
-- RLS scopes each row to its owner, so realtime would never deliver another
-- user's like. So we keep a live counter on the ARTICLE row (which every client
-- can already read) and broadcast that.
--
-- Seeds are untouched: `articles.likes` stays the seed; `real_likes` is a
-- separate counter. Displayed total = likes (seed) + real_likes.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Live real-likes counter on the article (seed stays in `likes`).
alter table articles add column if not exists real_likes integer not null default 0;

-- 2. Backfill from existing real likes.
update articles a
set real_likes = coalesce(
  (select count(*) from user_likes ul where ul.article_id = a.id), 0
);

-- 3. Toggle keeps real_likes in sync — the UPDATE here is what fires the
--    realtime event every other device listens for.
create or replace function toggle_article_like(p_article_id bigint)
returns table(likes integer, liked boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_has  boolean;
  v_seed integer;
  v_real integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select exists(
    select 1 from user_likes
    where user_id = v_user and article_id = p_article_id
  ) into v_has;

  if v_has then
    delete from user_likes
    where user_id = v_user and article_id = p_article_id;
    liked := false;
  else
    insert into user_likes(user_id, article_id)
    values (v_user, p_article_id)
    on conflict (user_id, article_id) do nothing;
    liked := true;
  end if;

  -- Recompute from the source of truth (idempotent) and publish it.
  select count(*) into v_real from user_likes ul where ul.article_id = p_article_id;
  update articles set real_likes = v_real where id = p_article_id;

  select coalesce(a.likes, 0) into v_seed from articles a where a.id = p_article_id;
  likes := v_seed + v_real;
  return next;
end;
$$;

grant execute on function toggle_article_like(bigint) to authenticated;

-- 4. Turn on live updates for the articles table (same switch `comments` has).
--    Guarded so re-running is safe.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'articles'
  ) then
    alter publication supabase_realtime add table articles;
  end if;
end $$;
