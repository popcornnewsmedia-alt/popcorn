-- ─────────────────────────────────────────────────────────────────────────────
-- Popcorn — keep articles.real_likes perfectly in sync with user_likes
-- Run this once in the Supabase SQL editor.
--
-- The toggle_article_like RPC already maintains real_likes for normal likes/
-- unlikes. But rows can also leave user_likes WITHOUT the RPC — most notably an
-- ON DELETE CASCADE when an account (auth.users) or an article is deleted. This
-- trigger keeps the denormalised counter correct no matter how a row appears or
-- disappears, so a deleted account's likes also decrement the live count.
--
-- (The RPC's absolute recompute still runs and self-heals any drift, so the two
-- are belt-and-suspenders.)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function sync_article_real_likes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update articles set real_likes = real_likes + 1 where id = new.article_id;
    return new;
  elsif tg_op = 'DELETE' then
    update articles set real_likes = greatest(0, real_likes - 1) where id = old.article_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_sync_article_real_likes on user_likes;
create trigger trg_sync_article_real_likes
  after insert or delete on user_likes
  for each row execute function sync_article_real_likes();

-- Reset to an exact baseline now; the trigger maintains it from here.
update articles a
set real_likes = coalesce(
  (select count(*) from user_likes ul where ul.article_id = a.id), 0
);
