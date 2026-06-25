-- ─────────────────────────────────────────────────────────────────────────────
-- Popcorn — atomic article-like toggle (mirrors the comment-vote `cast_vote` RPC)
-- Run this once in the Supabase SQL editor.
--
-- Article likes used to be written by the client doing a direct insert/delete
-- on `user_likes`, with the displayed count computed separately as
-- seed (articles.likes) + count(user_likes). That split was fragile:
--   • unlikes silently failed when the user_likes DELETE RLS policy wasn't set
--     (Supabase returns no error but removes 0 rows);
--   • the count only reflected reality after a feed re-fetch.
--
-- This function does the toggle in ONE atomic, authoritative step and returns
-- the true count + the viewer's new like state — exactly like `cast_vote` does
-- for comments. SECURITY DEFINER means it runs with elevated rights, so the
-- insert/delete always succeed regardless of the table's RLS policies (auth is
-- still enforced: it acts only on auth.uid()'s own row).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function toggle_article_like(p_article_id bigint)
returns table(likes integer, liked boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_has   boolean;
  v_seed  integer;
  v_real  integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select exists(
    select 1 from user_likes
    where user_id = v_user and article_id = p_article_id
  ) into v_has;

  if v_has then
    -- Currently liked → unlike.
    delete from user_likes
    where user_id = v_user and article_id = p_article_id;
    liked := false;
  else
    -- Not liked → like (idempotent on the (user_id, article_id) PK).
    insert into user_likes(user_id, article_id)
    values (v_user, p_article_id)
    on conflict (user_id, article_id) do nothing;
    liked := true;
  end if;

  -- Displayed total = the article's seed + the number of real likers, matching
  -- what the feed API serves.
  select coalesce(a.likes, 0) into v_seed from articles a where a.id = p_article_id;
  select count(*) into v_real from user_likes ul where ul.article_id = p_article_id;

  likes := v_seed + v_real;
  return next;
end;
$$;

grant execute on function toggle_article_like(bigint) to authenticated;
