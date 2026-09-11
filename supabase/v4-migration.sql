do $replay_guard$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'wiki_pages'
      and policyname = 'authors edit own drafts'
  ) and coalesce(current_setting('app.replay_over_1b', true), '') <> 'yes' then
    raise exception 'REFUSED: this database already has v4-1b-protect-main.sql applied, and replaying this file would revert the two wiki-images policies on storage.objects to the pre-1b form, handing every editor update and delete over every other editor''s uploaded images. Nothing would raise. If you mean to do it anyway, run:  set app.replay_over_1b = ''yes'';  then this file, then v4-1b-protect-main.sql again immediately.';
  end if;
end
$replay_guard$;

alter type public.member_role add value if not exists 'banned' before 'reader';

alter table public.profiles
  add column if not exists banned_at          timestamptz,
  add column if not exists banned_reason      text,
  add column if not exists banned_by          uuid references public.profiles(id) on delete set null,
  add column if not exists role_locked        boolean not null default false,
  add column if not exists show_read_receipts boolean not null default true;

comment on column public.profiles.role_locked is
  'Set when a maintainer decides a role by hand. api/auth/guild-check.ts must '
  'not auto-promote a locked profile, or a demotion is undone at next sign-in.';

comment on column public.profiles.show_read_receipts is
  'Off means no NEW view is recorded, and everything already recorded for '
  'this member is deleted. It is not a filter over rows that still exist. '
  'One caveat, deliberately stated: record_page_view reads this flag without '
  'a lock, so a view already in flight when the switch is thrown can still '
  'land afterwards. Such a row is hidden from every reader by the '
  'wiki_page_views SELECT policy, and opting out again deletes it.';

alter table public.profiles drop constraint if exists banned_reason_length;
alter table public.profiles add constraint banned_reason_length
  check (banned_reason is null or char_length(banned_reason) <= 500);

alter table public.wiki_pages
  add column if not exists is_memoir boolean not null default false;

create index if not exists wiki_pages_memoir_idx
  on public.wiki_pages (is_memoir) where is_memoir;

create index if not exists profiles_banned_by_idx on public.profiles (banned_by);

alter table public.wiki_pages drop constraint if exists slug_not_empty;
alter table public.wiki_pages add constraint slug_not_empty
  check (char_length(btrim(slug)) >= 1);

alter table public.wiki_pages drop constraint if exists title_not_empty;
alter table public.wiki_pages add constraint title_not_empty
  check (char_length(btrim(title)) >= 1);

alter table public.wiki_pages drop constraint if exists wiki_pages_status_check;
alter table public.wiki_pages add constraint wiki_pages_status_check
  check (status in ('draft', 'in_review', 'published', 'archived'));

create table if not exists public.wiki_page_proposals (
  id                  uuid primary key default gen_random_uuid(),
  page_id             uuid not null references public.wiki_pages(id) on delete cascade,
  author_id           uuid not null references public.profiles(id)   on delete cascade,
  base_updated_at     timestamptz not null,
  title               text not null,
  subtitle            text,
  cover_image         text,
  sections            jsonb not null default '[]'::jsonb,
  search_text         text not null default '',
  link_slugs          text[] not null default '{}',
  kind                text not null default 'lore',
  is_memoir           boolean not null default false,
  category_slugs      text[] not null default '{}',
  summary             text,
  state               text not null default 'open',
  reviewer_id         uuid references public.profiles(id) on delete set null,
  review_note         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  decided_at          timestamptz,
  global_bg_color     text,
  global_accent_color text,
  global_text_color   text,
  global_font         text,
  base_sections       jsonb
);

comment on column public.wiki_page_proposals.base_sections is
  'The page sections this proposal was written against, captured server-side '
  'at submit time and only when base_updated_at still matched the page. NULL '
  'means the base is unknown and a rebase cannot attribute changes.';

alter table public.wiki_page_proposals drop constraint if exists wiki_page_proposals_kind_check;
alter table public.wiki_page_proposals add constraint wiki_page_proposals_kind_check
  check (kind in ('lore', 'character', 'guide'));

alter table public.wiki_page_proposals drop constraint if exists wiki_page_proposals_state_check;
alter table public.wiki_page_proposals add constraint wiki_page_proposals_state_check
  check (state in ('open', 'changes_requested', 'merged', 'rejected', 'withdrawn'));

alter table public.wiki_page_proposals drop constraint if exists proposal_title_length;
alter table public.wiki_page_proposals add constraint proposal_title_length
  check (char_length(title) <= 255);

alter table public.wiki_page_proposals drop constraint if exists proposal_subtitle_length;
alter table public.wiki_page_proposals add constraint proposal_subtitle_length
  check (char_length(subtitle) <= 1000);

alter table public.wiki_page_proposals drop constraint if exists proposal_summary_length;
alter table public.wiki_page_proposals add constraint proposal_summary_length
  check (char_length(summary) <= 500);

alter table public.wiki_page_proposals drop constraint if exists proposal_note_length;
alter table public.wiki_page_proposals add constraint proposal_note_length
  check (char_length(review_note) <= 1000);

alter table public.wiki_page_proposals drop constraint if exists proposal_cover_length;
alter table public.wiki_page_proposals add constraint proposal_cover_length
  check (char_length(cover_image) <= 2048);

alter table public.wiki_page_proposals drop constraint if exists proposal_search_text_length;
alter table public.wiki_page_proposals add constraint proposal_search_text_length
  check (char_length(search_text) <= 100000);

alter table public.wiki_page_proposals drop constraint if exists proposal_sections_size;
alter table public.wiki_page_proposals add constraint proposal_sections_size
  check (octet_length(sections::text) < 2097152);

alter table public.wiki_page_proposals drop constraint if exists proposal_base_sections_size;
alter table public.wiki_page_proposals add constraint proposal_base_sections_size
  check (base_sections is null or octet_length(base_sections::text) < 2097152);

alter table public.wiki_page_proposals drop constraint if exists proposal_slug_counts;
alter table public.wiki_page_proposals add constraint proposal_slug_counts
  check (coalesce(array_length(link_slugs, 1), 0) <= 500
     and coalesce(array_length(category_slugs, 1), 0) <= 50
     and octet_length(link_slugs::text) <= 60000
     and octet_length(category_slugs::text) <= 6000);

alter table public.wiki_page_proposals drop constraint if exists proposal_style_lengths;
alter table public.wiki_page_proposals add constraint proposal_style_lengths
  check (char_length(coalesce(global_bg_color, '')) <= 64
     and char_length(coalesce(global_accent_color, '')) <= 64
     and char_length(coalesce(global_text_color, '')) <= 64
     and char_length(coalesce(global_font, '')) <= 64);

create unique index if not exists wiki_proposals_one_open_per_author
  on public.wiki_page_proposals (page_id, author_id)
  where state in ('open', 'changes_requested');

create index if not exists wiki_proposals_page_idx     on public.wiki_page_proposals (page_id);
create index if not exists wiki_proposals_queue_idx    on public.wiki_page_proposals (state, created_at desc);
create index if not exists wiki_proposals_author_idx   on public.wiki_page_proposals (author_id, created_at desc);
create index if not exists wiki_proposals_reviewer_idx on public.wiki_page_proposals (reviewer_id);

alter table public.wiki_page_proposals enable row level security;

create table if not exists public.wiki_page_views (
  page_id         uuid not null references public.wiki_pages(id) on delete cascade,
  user_id         uuid not null references public.profiles(id)   on delete cascade,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at  timestamptz not null default now(),
  view_count      integer not null default 1,
  primary key (page_id, user_id)
);

create index if not exists wiki_page_views_recent_idx on public.wiki_page_views (page_id, last_viewed_at desc);
create index if not exists wiki_page_views_user_idx   on public.wiki_page_views (user_id);

alter table public.wiki_page_views enable row level security;

create table if not exists public.moderation_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  target_type text not null,
  target_id   uuid,
  detail      jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists moderation_log_recent_idx on public.moderation_log (created_at desc);
create index if not exists moderation_log_target_idx on public.moderation_log (target_type, target_id, created_at desc);
create index if not exists moderation_log_actor_idx  on public.moderation_log (actor_id);

alter table public.moderation_log enable row level security;

create or replace function private.is_maintainer()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.member_role(), 'reader'::public.member_role) >= 'moderator'
$$;

create or replace function private.read_receipts_on(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select p.show_read_receipts from public.profiles p where p.id = p_user), false)
$$;

create or replace function private.sections_problem(p jsonb)
returns text
language sql stable set search_path = ''
as $$
  select case
    when p is null then null
    when jsonb_typeof(p) <> 'array' then 'Sections must be a list.'
    when jsonb_array_length(p) > 100 then 'A page cannot have more than 100 sections.'
    when jsonb_path_exists(p, '$[*] ? (@.type() != "object")')
      then 'Every section must be an object.'
    when jsonb_path_exists(p, '$[*] ? (!exists(@.id) || @.id.type() != "string" || @.id == "")')
      then 'Every section needs an id.'
    when jsonb_path_exists(p, '$[*] ? (!exists(@.type) || (@.type != "infobox" && @.type != "richtext"
           && @.type != "identity-showcase" && @.type != "image-gallery" && @.type != "collapsible"
           && @.type != "divider" && @.type != "quote" && @.type != "stat-table"))')
      then 'Unrecognised section type.'
    when jsonb_path_exists(p, '$.**{48 to 56}')
      then 'Sections are nested too deeply.'
    else null
  end
$$;

create or replace function private.sections_search_text(p_sections jsonb)
returns text
language sql stable set search_path = ''
as $$
  with paths(ord, p) as (
    values
      (1,  '$[*] ? (@.type == "infobox").characterName'),
      (2,  '$[*] ? (@.type == "infobox").subtitle'),
      (3,  '$[*] ? (@.type == "infobox").fields[*].label'),
      (4,  '$[*] ? (@.type == "infobox").fields[*].value'),
      (5,  '$[*] ? (@.type == "infobox").fields[*].value.**{0 to 40}.text'),
      (6,  '$[*] ? (@.type == "richtext").heading'),
      (7,  '$[*] ? (@.type == "richtext").content.**{0 to 40}.text'),
      (8,  '$[*] ? (@.type == "collapsible").heading'),
      (9,  '$[*] ? (@.type == "collapsible").content.**{0 to 40}.text'),
      (10, '$[*] ? (@.type == "quote").text'),
      (11, '$[*] ? (@.type == "quote").text.**{0 to 40}.text'),
      (12, '$[*] ? (@.type == "quote").attribution'),
      (13, '$[*] ? (@.type == "stat-table").heading'),
      (14, '$[*] ? (@.type == "stat-table").rows[*].label'),
      (15, '$[*] ? (@.type == "stat-table").rows[*].value'),
      (16, '$[*] ? (@.type == "stat-table").rows[*].value.**{0 to 40}.text'),
      (17, '$[*] ? (@.type == "image-gallery").heading'),
      (18, '$[*] ? (@.type == "image-gallery").images[*].caption'),
      (19, '$[*] ? (@.type == "image-gallery").images[*].caption.**{0 to 40}.text'),
      (20, '$[*] ? (@.type == "identity-showcase").heading')
  )
  select left(coalesce(string_agg(v #>> '{}', ' ' order by paths.ord, q.n), ''), 100000)
  from paths
  cross join lateral jsonb_path_query(p_sections, paths.p::jsonpath)
    with ordinality as q(v, n)
  where jsonb_typeof(v) = 'string'
    and v #>> '{}' <> ''
$$;

revoke execute on function private.read_receipts_on(uuid)      from public;
revoke execute on function private.sections_problem(jsonb)     from public, anon, authenticated;
revoke execute on function private.sections_search_text(jsonb) from public, anon, authenticated;

grant execute on function private.is_maintainer()        to authenticated;
grant execute on function private.member_role()          to authenticated;
grant execute on function private.read_receipts_on(uuid) to authenticated;

create or replace function public.stamp_wiki_page()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  acting uuid := coalesce(
    nullif(current_setting('app.acting_author', true), '')::uuid,
    auth.uid()
  );
begin
  if tg_op = 'INSERT' then
    new.created_by = coalesce(acting, new.created_by);
  end if;
  new.updated_by = coalesce(acting, new.updated_by);
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.write_wiki_revision()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  last_rev record;
  acting uuid := coalesce(
    nullif(current_setting('app.acting_author', true), '')::uuid,
    auth.uid()
  );
  force_new boolean := coalesce(current_setting('app.force_new_revision', true), '') = 'on';
begin
  if tg_op = 'UPDATE'
     and new.sections is not distinct from old.sections
     and new.title    is not distinct from old.title
     and new.subtitle is not distinct from old.subtitle then
    return new;
  end if;

  select id, author_id, created_at into last_rev
    from public.wiki_revisions
    where page_id = new.id
    order by created_at desc
    limit 1;

  if not force_new
     and last_rev.id is not null
     and last_rev.author_id is not distinct from acting
     and last_rev.created_at > now() - interval '10 minutes' then
    update public.wiki_revisions
      set title = new.title, subtitle = new.subtitle, sections = new.sections,
          comment = coalesce(new.edit_comment, comment)
      where id = last_rev.id;
  else
    insert into public.wiki_revisions (page_id, title, subtitle, sections, author_id, comment)
    values (new.id, new.title, new.subtitle, new.sections, acting, new.edit_comment);
  end if;
  return new;
end;
$$;

create or replace function public.prevent_role_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  via_rpc boolean := coalesce(current_setting('app.role_change_ok', true), '') = 'on';
begin
  if auth.role() = 'authenticated'
     and not via_rpc
     and (new.role          is distinct from old.role
       or new.banned_at     is distinct from old.banned_at
       or new.banned_by     is distinct from old.banned_by
       or new.banned_reason is distinct from old.banned_reason
       or new.role_locked   is distinct from old.role_locked) then
    raise exception 'Role and ban state change only through set_member_role or ban_member.';
  end if;

  if auth.role() = 'authenticated'
     and new.show_read_receipts is distinct from old.show_read_receipts
     and new.id is distinct from auth.uid() then
    raise exception 'Read receipts are the account holder''s own setting.';
  end if;

  return new;
end;
$$;

create or replace function public.purge_read_trail_on_optout()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not new.show_read_receipts then
    delete from public.wiki_page_views where user_id = new.id;
  end if;
  return null;
end;
$$;

create or replace function public.check_section_shape()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  problem text;
  target  jsonb;
  row_js  jsonb;
begin
  if tg_nargs < 1 or tg_argv[0] is null or tg_argv[0] = '' then
    raise exception 'check_section_shape needs the name of the column to validate';
  end if;
  row_js := to_jsonb(new);
  if not (row_js ? tg_argv[0]) then
    raise exception 'check_section_shape: % has no column %', tg_table_name, tg_argv[0];
  end if;
  target := row_js -> tg_argv[0];
  problem := private.sections_problem(target);
  if problem is not null then
    raise exception '%', problem;
  end if;
  return new;
end;
$$;

create or replace function public.derive_wiki_search_text()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.search_text = private.sections_search_text(new.sections);
  return new;
end;
$$;

create or replace function public.clear_proposal_base_on_close()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.state in ('merged', 'rejected', 'withdrawn') and new.base_sections is not null then
    new.base_sections := null;
  end if;
  return new;
end;
$$;

revoke execute on function public.stamp_wiki_page()               from public, anon, authenticated;
revoke execute on function public.write_wiki_revision()           from public, anon, authenticated;
revoke execute on function public.prevent_role_change()           from public, anon, authenticated;
revoke execute on function public.purge_read_trail_on_optout()    from public, anon, authenticated;
revoke execute on function public.check_section_shape()           from public, anon, authenticated;
revoke execute on function public.derive_wiki_search_text()       from public, anon, authenticated;
revoke execute on function public.clear_proposal_base_on_close()  from public, anon, authenticated;

drop trigger if exists prevent_role_change on public.profiles;
create trigger prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change();

drop trigger if exists profiles_purge_read_trail on public.profiles;
create trigger profiles_purge_read_trail
  after update of show_read_receipts on public.profiles
  for each row execute function public.purge_read_trail_on_optout();

drop trigger if exists wiki_pages_a_section_shape on public.wiki_pages;
create trigger wiki_pages_a_section_shape
  before insert or update on public.wiki_pages
  for each row execute function public.check_section_shape('sections');

drop trigger if exists wiki_pages_search_text on public.wiki_pages;
create trigger wiki_pages_search_text
  before insert or update on public.wiki_pages
  for each row execute function public.derive_wiki_search_text();

drop trigger if exists wiki_pages_stamp on public.wiki_pages;
create trigger wiki_pages_stamp
  before insert or update on public.wiki_pages
  for each row execute function public.stamp_wiki_page();

drop trigger if exists wiki_pages_revision on public.wiki_pages;
create trigger wiki_pages_revision
  after insert or update on public.wiki_pages
  for each row execute function public.write_wiki_revision();

drop trigger if exists wiki_proposals_clear_base on public.wiki_page_proposals;
create trigger wiki_proposals_clear_base
  before insert or update on public.wiki_page_proposals
  for each row execute function public.clear_proposal_base_on_close();

drop trigger if exists wiki_proposals_section_shape on public.wiki_page_proposals;
create trigger wiki_proposals_section_shape
  before insert or update on public.wiki_page_proposals
  for each row execute function public.check_section_shape('sections');

drop trigger if exists wiki_page_projects_section_shape on public.wiki_page_projects;
create trigger wiki_page_projects_section_shape
  before insert or update on public.wiki_page_projects
  for each row execute function public.check_section_shape('detail_sections');

drop policy if exists "maintainers read all projects" on public.projects;
create policy "maintainers read all projects" on public.projects
  for select to authenticated
  using ((select private.is_maintainer()));

drop policy if exists "insert own projects" on public.projects;
create policy "insert own projects" on public.projects
  for insert to authenticated
  with check ((select auth.uid()) = user_id and (select private.member_role()) >= 'reader');

drop policy if exists "update own projects" on public.projects;
create policy "update own projects" on public.projects
  for update to authenticated
  using      ((select auth.uid()) = user_id and (select private.member_role()) >= 'reader')
  with check ((select auth.uid()) = user_id and (select private.member_role()) >= 'reader');

drop policy if exists "delete own or moderator" on public.projects;
create policy "delete own or moderator" on public.projects
  for delete to authenticated
  using (((select auth.uid()) = user_id and (select private.member_role()) >= 'reader')
         or (select private.member_role()) >= 'moderator');

drop policy if exists "admins update any profile" on public.profiles;
create policy "admins update any profile" on public.profiles
  for update to authenticated
  using      ((select private.member_role()) = 'admin')
  with check ((select private.member_role()) = 'admin');

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated
  using      ((select auth.uid()) = id and (select private.member_role()) >= 'reader')
  with check ((select auth.uid()) = id and (select private.member_role()) >= 'reader');

drop policy if exists "members create own statuses" on public.custom_statuses;
create policy "members create own statuses" on public.custom_statuses
  for insert to authenticated
  with check ((select auth.uid()) = user_id and (select private.member_role()) >= 'reader');

drop policy if exists "update own or moderator" on public.custom_statuses;
create policy "update own or moderator" on public.custom_statuses
  for update to authenticated
  using      (((select auth.uid()) = user_id and (select private.member_role()) >= 'reader')
              or (select private.member_role()) >= 'moderator')
  with check (((select auth.uid()) = user_id and (select private.member_role()) >= 'reader')
              or (select private.member_role()) >= 'moderator');

drop policy if exists "delete own or moderator" on public.custom_statuses;
create policy "delete own or moderator" on public.custom_statuses
  for delete to authenticated
  using (((select auth.uid()) = user_id and (select private.member_role()) >= 'reader')
         or (select private.member_role()) >= 'moderator');

drop policy if exists "authors read own proposals" on public.wiki_page_proposals;
create policy "authors read own proposals" on public.wiki_page_proposals
  for select to authenticated using (author_id = (select auth.uid()));

drop policy if exists "maintainers read all proposals" on public.wiki_page_proposals;
create policy "maintainers read all proposals" on public.wiki_page_proposals
  for select to authenticated using ((select private.is_maintainer()));

revoke select on public.wiki_page_proposals from anon;
revoke insert, update, delete on public.wiki_page_proposals from anon, authenticated;
grant  select on public.wiki_page_proposals to authenticated;

drop policy if exists "view trail readable by anyone"  on public.wiki_page_views;
drop policy if exists "view trail readable by members" on public.wiki_page_views;
create policy "view trail readable by members" on public.wiki_page_views
  for select to authenticated
  using (private.read_receipts_on(user_id));

revoke select on public.wiki_page_views from anon;
revoke insert, update, delete on public.wiki_page_views from anon, authenticated;
grant  select on public.wiki_page_views to authenticated;

drop policy if exists "maintainers read the log" on public.moderation_log;
create policy "maintainers read the log" on public.moderation_log
  for select to authenticated using ((select private.is_maintainer()));

revoke select on public.moderation_log from anon;
revoke insert, update, delete on public.moderation_log from anon, authenticated;
grant  select on public.moderation_log to authenticated;

revoke select on public.wiki_revisions from anon;
revoke insert, update, delete on public.wiki_revisions from anon;
revoke insert, update on public.wiki_revisions from authenticated;

revoke select on public.profiles from anon;
grant  select (id, username, avatar_icon, created_at) on public.profiles to anon;

update storage.buckets
   set public = true,
       file_size_limit = 10485760,
       allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif']
 where id in ('project-images', 'wiki-images', 'custom-status-icons');

drop policy if exists "project images write own folder" on storage.objects;
create policy "project images write own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'project-images'
              and auth.uid()::text = (storage.foldername(name))[1]
              and private.member_role() >= 'reader');

drop policy if exists "project images update own folder" on storage.objects;
create policy "project images update own folder" on storage.objects
  for update to authenticated
  using      (bucket_id = 'project-images'
              and auth.uid()::text = (storage.foldername(name))[1]
              and private.member_role() >= 'reader')
  with check (bucket_id = 'project-images'
              and auth.uid()::text = (storage.foldername(name))[1]
              and private.member_role() >= 'reader');

drop policy if exists "project images delete own folder" on storage.objects;
create policy "project images delete own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'project-images'
         and auth.uid()::text = (storage.foldername(name))[1]
         and private.member_role() >= 'reader');

drop policy if exists "status icons write own folder" on storage.objects;
create policy "status icons write own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'custom-status-icons'
              and auth.uid()::text = (storage.foldername(name))[1]
              and private.member_role() >= 'reader');

drop policy if exists "status icons update own folder" on storage.objects;
create policy "status icons update own folder" on storage.objects
  for update to authenticated
  using      (bucket_id = 'custom-status-icons'
              and auth.uid()::text = (storage.foldername(name))[1]
              and private.member_role() >= 'reader')
  with check (bucket_id = 'custom-status-icons'
              and auth.uid()::text = (storage.foldername(name))[1]
              and private.member_role() >= 'reader');

drop policy if exists "status icons delete own folder" on storage.objects;
create policy "status icons delete own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'custom-status-icons'
         and auth.uid()::text = (storage.foldername(name))[1]
         and private.member_role() >= 'reader');

drop policy if exists "wiki images editors write" on storage.objects;
create policy "wiki images editors write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'wiki-images' and private.member_role() >= 'editor');

do $replay_guard$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'wiki_pages'
      and policyname = 'authors edit own drafts'
  ) and coalesce(current_setting('app.replay_over_1b', true), '') <> 'yes' then
    raise exception 'REFUSED: replaying these two policies over v4-1b-protect-main.sql reverts them to the pre-1b form, handing every editor update and delete over every other editor''s uploaded images. See the guard at the top of this file.';
  end if;
end
$replay_guard$;

drop policy if exists "wiki images editors update" on storage.objects;
create policy "wiki images editors update" on storage.objects
  for update to authenticated
  using      (bucket_id = 'wiki-images' and private.member_role() >= 'editor')
  with check (bucket_id = 'wiki-images' and private.member_role() >= 'editor');

drop policy if exists "wiki images editors delete" on storage.objects;
create policy "wiki images editors delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'wiki-images' and private.member_role() >= 'editor');

create or replace function public.submit_proposal(
  p_page_id uuid, p_base_updated_at timestamptz, p_title text, p_subtitle text,
  p_cover_image text, p_sections jsonb, p_link_slugs text[], p_kind text,
  p_is_memoir boolean, p_category_slugs text[], p_summary text,
  p_bg_color text default null, p_accent_color text default null,
  p_text_color text default null, p_font text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid         uuid := auth.uid();
  page        public.wiki_pages;
  prop_id     uuid;
  open_count  integer;
  total_count integer;
  last_touch  timestamptz;
  base_at     timestamptz;
  base_secs   jsonb;
begin
  if uid is null then raise exception 'Sign in to propose changes.'; end if;
  if coalesce(private.member_role(), 'reader'::public.member_role) < 'editor' then
    raise exception 'Editing requires server membership.';
  end if;

  select * into page from public.wiki_pages where id = p_page_id;
  if not found then raise exception 'Page not found.'; end if;
  if page.status = 'archived' then raise exception 'That page is archived.'; end if;

  base_at := coalesce(p_base_updated_at, page.updated_at);

  if p_base_updated_at is not null and page.updated_at = p_base_updated_at then
    base_secs := page.sections;
  else
    base_secs := null;
  end if;

  select max(updated_at) into last_touch
    from public.wiki_page_proposals where author_id = uid;
  if last_touch is not null and last_touch > now() - interval '5 seconds' then
    raise exception 'Slow down - wait a few seconds before proposing again.';
  end if;

  delete from public.wiki_page_proposals
    where author_id = uid
      and state in ('rejected', 'withdrawn')
      and decided_at < now() - interval '30 days';

  update public.wiki_page_proposals set
      title = p_title, subtitle = p_subtitle, cover_image = p_cover_image,
      sections = coalesce(p_sections, '[]'::jsonb),
      search_text = '',
      link_slugs = coalesce(p_link_slugs, '{}'),
      kind = coalesce(p_kind, kind),
      is_memoir = coalesce(p_is_memoir, false),
      category_slugs = coalesce(p_category_slugs, '{}'),
      global_bg_color = p_bg_color, global_accent_color = p_accent_color,
      global_text_color = p_text_color, global_font = p_font,
      summary = p_summary,
      base_updated_at = base_at,
      base_sections = base_secs,
      state = 'open', reviewer_id = null, review_note = null,
      decided_at = null, updated_at = now()
    where page_id = p_page_id
      and author_id = uid
      and state in ('open', 'changes_requested')
    returning id into prop_id;

  if prop_id is not null then return prop_id; end if;

  select
    count(*) filter (where state in ('open', 'changes_requested')),
    count(*)
    into open_count, total_count
    from public.wiki_page_proposals where author_id = uid;

  if open_count >= 25 then
    raise exception 'You already have 25 proposals waiting for review.';
  end if;
  if total_count >= 100 then
    raise exception 'You have too many stored proposals. A maintainer can clear them.';
  end if;

  insert into public.wiki_page_proposals (
    page_id, author_id, base_updated_at, base_sections, title, subtitle, cover_image,
    sections, search_text, link_slugs, kind, is_memoir, category_slugs,
    global_bg_color, global_accent_color, global_text_color, global_font, summary
  ) values (
    p_page_id, uid, base_at, base_secs, p_title, p_subtitle, p_cover_image,
    coalesce(p_sections, '[]'::jsonb), '',
    coalesce(p_link_slugs, '{}'), coalesce(p_kind, 'lore'),
    coalesce(p_is_memoir, false), coalesce(p_category_slugs, '{}'),
    p_bg_color, p_accent_color, p_text_color, p_font, p_summary
  ) returning id into prop_id;

  return prop_id;
end;
$$;

create or replace function public.merge_proposal(
  p_id uuid, p_expected_updated_at timestamptz, p_note text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  prop public.wiki_page_proposals;
  page public.wiki_pages;
begin
  if not private.is_maintainer() then
    raise exception 'Only a maintainer can merge a proposal.';
  end if;

  select * into prop from public.wiki_page_proposals where id = p_id for update;
  if not found then raise exception 'Proposal not found.'; end if;
  if prop.state not in ('open', 'changes_requested') then
    raise exception 'This proposal is already %.', prop.state;
  end if;
  if p_expected_updated_at is null or prop.updated_at is distinct from p_expected_updated_at then
    raise exception 'This proposal changed since you opened it. Review it again.';
  end if;
  if coalesce(
       (select role from public.profiles where id = prop.author_id),
       'reader'::public.member_role
     ) < 'editor' then
    raise exception 'The author of this proposal is no longer an editor.';
  end if;

  select * into page from public.wiki_pages where id = prop.page_id for update;
  if not found then raise exception 'That page no longer exists.'; end if;
  if page.status = 'archived' then raise exception 'That page is archived.'; end if;
  if page.updated_at is distinct from prop.base_updated_at then
    raise exception 'The page changed after this proposal was written. Its author can rebase it onto the current version from My Proposals, then resubmit.';
  end if;

  perform set_config('app.acting_author', prop.author_id::text, true);
  perform set_config('app.force_new_revision', 'on', true);

  update public.wiki_pages set
      title = prop.title, subtitle = prop.subtitle, cover_image = prop.cover_image,
      sections = prop.sections,
      kind = prop.kind, is_memoir = prop.is_memoir,
      global_bg_color = prop.global_bg_color,
      global_accent_color = prop.global_accent_color,
      global_text_color = prop.global_text_color,
      global_font = prop.global_font,
      edit_comment = prop.summary
    where id = prop.page_id;

  delete from public.wiki_page_categories where page_id = prop.page_id;
  insert into public.wiki_page_categories (page_id, category_slug)
    select prop.page_id, s from unnest(prop.category_slugs) s
     where exists (select 1 from public.wiki_categories c where c.slug = s)
    on conflict do nothing;

  delete from public.wiki_links where from_page = prop.page_id;
  insert into public.wiki_links (from_page, to_slug)
    select distinct prop.page_id, s from unnest(prop.link_slugs) s
     where s is not null and s <> '' and char_length(s) <= 100
    on conflict do nothing;

  update public.wiki_page_proposals set
      state = 'merged', reviewer_id = auth.uid(), review_note = p_note,
      decided_at = now(), updated_at = now()
    where id = p_id;

  insert into public.moderation_log (actor_id, action, target_type, target_id, detail)
  values (auth.uid(), 'proposal.merge', 'wiki_page', prop.page_id,
          jsonb_build_object(
            'proposal_id', p_id, 'author_id', prop.author_id,
            'page_slug', page.slug, 'summary', prop.summary, 'review_note', p_note));

  return prop.page_id;
end;
$$;

create or replace function public.review_proposal(p_id uuid, p_state text, p_note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare prop public.wiki_page_proposals;
begin
  if not private.is_maintainer() then
    raise exception 'Only a maintainer can review a proposal.';
  end if;
  if p_state not in ('changes_requested', 'rejected') then
    raise exception 'Use merge_proposal to accept a proposal.';
  end if;

  select * into prop from public.wiki_page_proposals where id = p_id for update;
  if not found then raise exception 'Proposal not found.'; end if;
  if prop.state not in ('open', 'changes_requested') then
    raise exception 'This proposal is already %.', prop.state;
  end if;
  if prop.state = p_state and prop.review_note is not distinct from p_note then
    return;
  end if;

  update public.wiki_page_proposals set
      state = p_state, reviewer_id = auth.uid(), review_note = p_note,
      decided_at = case when p_state = 'rejected' then now() else null end,
      updated_at = now()
    where id = p_id;

  insert into public.moderation_log (actor_id, action, target_type, target_id, detail)
  values (auth.uid(), 'proposal.' || p_state, 'wiki_page', prop.page_id,
          jsonb_build_object('proposal_id', p_id, 'author_id', prop.author_id,
                             'summary', prop.summary, 'review_note', p_note));
end;
$$;

create or replace function public.withdraw_proposal(p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare touched integer;
begin
  update public.wiki_page_proposals set
      state = 'withdrawn', decided_at = now(), updated_at = now()
    where id = p_id
      and author_id = auth.uid()
      and state in ('open', 'changes_requested');
  get diagnostics touched = row_count;
  if touched = 0 then raise exception 'No open proposal of yours with that id.'; end if;
end;
$$;

create or replace function public.purge_proposals(p_author_id uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare removed integer;
begin
  if not private.is_maintainer() then
    raise exception 'Only a maintainer can clear proposals.';
  end if;
  delete from public.wiki_page_proposals
    where author_id = p_author_id
      and state in ('merged', 'rejected', 'withdrawn');
  get diagnostics removed = row_count;

  insert into public.moderation_log (actor_id, action, target_type, target_id, detail)
  values (auth.uid(), 'proposal.purge', 'profile', p_author_id,
          jsonb_build_object('removed', removed));
  return removed;
end;
$$;

create or replace function public.record_page_view(p_page_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid      uuid := auth.uid();
  r        public.member_role;
  receipts boolean;
begin
  if uid is null then return; end if;

  select p.role, p.show_read_receipts into r, receipts
  from public.profiles p where p.id = uid;

  if coalesce(r, 'reader'::public.member_role) < 'reader' then return; end if;
  if not coalesce(receipts, false) then return; end if;

  if not exists (
    select 1 from public.wiki_pages where id = p_page_id and status = 'published'
  ) then return; end if;

  insert into public.wiki_page_views (page_id, user_id)
  values (p_page_id, uid)
  on conflict (page_id, user_id) do update
    set last_viewed_at = now(),
        view_count = public.wiki_page_views.view_count + 1
    where public.wiki_page_views.last_viewed_at < now() - interval '1 minute';
end;
$$;

create or replace function public.set_read_receipts(p_on boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sign in to change this.'; end if;
  if p_on is null then raise exception 'Read receipts are either on or off.'; end if;
  if coalesce(private.member_role(), 'reader'::public.member_role) < 'reader' and p_on then
    raise exception 'This account is suspended.';
  end if;

  if not p_on then
    delete from public.wiki_page_views where user_id = uid;
  end if;

  update public.profiles set show_read_receipts = p_on
    where id = uid and show_read_receipts is distinct from p_on;
end;
$$;

create or replace function public.page_contributors(p_page_id uuid)
returns table(id uuid, username text, avatar_icon text, edits bigint, last_edit timestamptz)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.username, p.avatar_icon, count(*) as edits, max(r.created_at) as last_edit
  from public.wiki_revisions r
  join public.profiles p on p.id = r.author_id
  where r.page_id = p_page_id
    and exists (
      select 1 from public.wiki_pages w
      where w.id = p_page_id
        and (w.status = 'published'
             or coalesce(private.member_role(), 'reader'::public.member_role) >= 'editor')
    )
  group by p.id, p.username, p.avatar_icon
  order by count(*) desc, max(r.created_at) desc
  limit 24
$$;

create or replace function public.set_member_role(p_user_id uuid, p_role public.member_role)
returns void
language plpgsql security definer set search_path = ''
as $$
declare old_role public.member_role;
begin
  if coalesce(private.member_role(), 'reader'::public.member_role) <> 'admin' then
    raise exception 'Only an admin can change roles.';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot change your own role.';
  end if;

  select role into old_role from public.profiles where id = p_user_id;
  if not found then raise exception 'No such member.'; end if;

  if old_role = 'admin' then
    raise exception 'An admin cannot be demoted from here. Use the SQL editor deliberately.';
  end if;

  perform set_config('app.role_change_ok', 'on', true);

  update public.profiles set
      role = p_role,
      role_locked = true,
      banned_at     = case when p_role = 'banned' then now()      else null end,
      banned_by     = case when p_role = 'banned' then auth.uid() else null end,
      banned_reason = case when p_role = 'banned' then banned_reason else null end
    where id = p_user_id;

  insert into public.moderation_log (actor_id, action, target_type, target_id, detail)
  values (auth.uid(), 'member.role', 'profile', p_user_id,
          jsonb_build_object('from', old_role, 'to', p_role));
end;
$$;

create or replace function public.ban_member(p_user_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare old_role public.member_role;
begin
  if coalesce(private.member_role(), 'reader'::public.member_role) <> 'admin' then
    raise exception 'Only an admin can ban a member.';
  end if;
  if p_user_id = auth.uid() then raise exception 'You cannot ban yourself.'; end if;

  select role into old_role from public.profiles where id = p_user_id;
  if not found then raise exception 'No such member.'; end if;
  if old_role = 'admin' then
    raise exception 'An admin cannot be banned from here. Use the SQL editor deliberately.';
  end if;

  perform set_config('app.role_change_ok', 'on', true);

  update public.profiles set
      role = 'banned',
      role_locked = true,
      banned_at = case when role = 'banned' then banned_at else now() end,
      banned_by = case when role = 'banned' then banned_by else auth.uid() end,
      banned_reason = p_reason
    where id = p_user_id;

  insert into public.moderation_log (actor_id, action, target_type, target_id, detail)
  values (auth.uid(),
          case when old_role = 'banned' then 'member.ban_reason' else 'member.ban' end,
          'profile', p_user_id,
          jsonb_build_object('reason', p_reason, 'from', old_role));
end;
$$;

create or replace function public.admin_delete_page(p_page_id uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  page       public.wiki_pages;
  lost_props integer;
begin
  if not private.is_maintainer() then
    raise exception 'Only a maintainer can delete a page.';
  end if;

  select * into page from public.wiki_pages where id = p_page_id;
  if not found then raise exception 'That page no longer exists.'; end if;

  select count(*) into lost_props
    from public.wiki_page_proposals where page_id = p_page_id;

  delete from public.wiki_pages where id = p_page_id;

  insert into public.moderation_log (actor_id, action, target_type, target_id, detail)
  values (auth.uid(), 'page.delete', 'wiki_page', p_page_id,
          jsonb_build_object('slug', page.slug, 'title', page.title,
                             'status', page.status, 'author_id', page.created_by,
                             'proposals_lost', lost_props, 'reason', p_reason));
end;
$$;

create or replace function public.admin_delete_card(p_card_id uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  card   public.projects;
  linked integer;
begin
  if not private.is_maintainer() then
    raise exception 'Only a maintainer can delete someone else''s card.';
  end if;

  select * into card from public.projects where id = p_card_id;
  if not found then raise exception 'That card no longer exists.'; end if;

  select count(*) into linked
    from public.wiki_page_projects where project_id = p_card_id;

  delete from public.projects where id = p_card_id;

  insert into public.moderation_log (actor_id, action, target_type, target_id, detail)
  values (auth.uid(), 'card.delete', 'profile', card.user_id,
          jsonb_build_object('card_id', p_card_id, 'name', card.name,
                             'pages_affected', linked, 'reason', p_reason));
end;
$$;

create or replace function public.admin_delete_status(p_status_id uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare st public.custom_statuses;
begin
  if not private.is_maintainer() then
    raise exception 'Only a maintainer can delete someone else''s status.';
  end if;

  select * into st from public.custom_statuses where id = p_status_id;
  if not found then raise exception 'That status no longer exists.'; end if;

  delete from public.custom_statuses where id = p_status_id;

  insert into public.moderation_log (actor_id, action, target_type, target_id, detail)
  values (auth.uid(), 'status.delete', 'profile', st.user_id,
          jsonb_build_object('status_id', p_status_id, 'name', st.name,
                             'key', st.key, 'reason', p_reason));
end;
$$;

create or replace function public.admin_set_page_status(p_page_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare page public.wiki_pages;
begin
  if not private.is_maintainer() then
    raise exception 'Only a maintainer can change a page''s status.';
  end if;
  if p_status not in ('draft', 'in_review', 'published', 'archived') then
    raise exception 'Unknown status %.', p_status;
  end if;

  select * into page from public.wiki_pages where id = p_page_id;
  if not found then raise exception 'That page no longer exists.'; end if;
  if page.status = p_status then return; end if;

  update public.wiki_pages set status = p_status where id = p_page_id;

  insert into public.moderation_log (actor_id, action, target_type, target_id, detail)
  values (auth.uid(), 'page.status', 'wiki_page', p_page_id,
          jsonb_build_object('slug', page.slug, 'title', page.title,
                             'from', page.status, 'to', p_status));
end;
$$;

create or replace function public.search_wiki_pages(
  p_query       text,
  p_kind        text    default null,
  p_memoir_only boolean default false,
  p_limit       int     default 30
)
returns table (
  id uuid, slug text, title text, subtitle text, cover_image text,
  kind text, status text, is_memoir boolean,
  created_at timestamptz, updated_at timestamptz
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_tsq   tsquery;
  v_limit int := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_found int;
begin
  if coalesce(btrim(p_query), '') = '' then
    return;
  end if;

  select to_tsquery(
           'english',
           string_agg(
             case when rn = n then w || ':*' else w end,
             ' & ' order by rn
           )
         )
    into v_tsq
    from (
      select w,
             row_number() over () as rn,
             count(*)    over ()  as n
        from regexp_split_to_table(lower(btrim(p_query)), '[^a-z0-9]+') as t(w)
       where t.w <> ''
    ) tokens;

  if v_tsq is not null then
    return query
      select p.id, p.slug, p.title, p.subtitle, p.cover_image,
             p.kind, p.status, p.is_memoir, p.created_at, p.updated_at
        from public.wiki_pages p
       where p.search_tsv @@ v_tsq
         and (p_kind is null or p.kind = p_kind)
         and (not p_memoir_only or p.is_memoir)
       order by ts_rank_cd(p.search_tsv, v_tsq) desc, p.title asc
       limit v_limit;
    get diagnostics v_found = row_count;
    if v_found > 0 then
      return;
    end if;
  end if;

  return query
    select p.id, p.slug, p.title, p.subtitle, p.cover_image,
           p.kind, p.status, p.is_memoir, p.created_at, p.updated_at
      from public.wiki_pages p
     where p.title ilike '%' || replace(replace(btrim(p_query), '\', '\\'), '%', '\%') || '%'
       and (p_kind is null or p.kind = p_kind)
       and (not p_memoir_only or p.is_memoir)
     order by length(p.title) asc, p.title asc
     limit v_limit;
end;
$$;

revoke all on function public.submit_proposal(uuid, timestamptz, text, text, text, jsonb, text[], text, boolean, text[], text, text, text, text, text) from public, anon;
revoke all on function public.merge_proposal(uuid, timestamptz, text)      from public, anon;
revoke all on function public.review_proposal(uuid, text, text)            from public, anon;
revoke all on function public.withdraw_proposal(uuid)                      from public, anon;
revoke all on function public.purge_proposals(uuid)                        from public, anon;
revoke all on function public.set_read_receipts(boolean)                   from public, anon;
revoke all on function public.set_member_role(uuid, public.member_role)    from public, anon;
revoke all on function public.ban_member(uuid, text)                       from public, anon;
revoke all on function public.admin_delete_page(uuid, text)                from public, anon;
revoke all on function public.admin_delete_card(uuid, text)                from public, anon;
revoke all on function public.admin_delete_status(uuid, text)              from public, anon;
revoke all on function public.admin_set_page_status(uuid, text)            from public, anon;

grant execute on function public.submit_proposal(uuid, timestamptz, text, text, text, jsonb, text[], text, boolean, text[], text, text, text, text, text) to authenticated;
grant execute on function public.merge_proposal(uuid, timestamptz, text)   to authenticated;
grant execute on function public.review_proposal(uuid, text, text)         to authenticated;
grant execute on function public.withdraw_proposal(uuid)                   to authenticated;
grant execute on function public.purge_proposals(uuid)                     to authenticated;
grant execute on function public.set_read_receipts(boolean)                to authenticated;
grant execute on function public.set_member_role(uuid, public.member_role) to authenticated;
grant execute on function public.ban_member(uuid, text)                    to authenticated;
grant execute on function public.admin_delete_page(uuid, text)             to authenticated;
grant execute on function public.admin_delete_card(uuid, text)             to authenticated;
grant execute on function public.admin_delete_status(uuid, text)           to authenticated;
grant execute on function public.admin_set_page_status(uuid, text)         to authenticated;

grant execute on function public.record_page_view(uuid)   to anon, authenticated;
grant execute on function public.page_contributors(uuid)  to anon, authenticated;

revoke all on function public.search_wiki_pages(text, text, boolean, int) from public;
grant execute on function public.search_wiki_pages(text, text, boolean, int) to anon, authenticated;
