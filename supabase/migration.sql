do $greenfield_guard$
declare
  members bigint := 0;
begin
  if coalesce(current_setting('app.greenfield', true), '') = 'yes' then
    return;
  end if;
  select count(*) into members from auth.users;
  if members > 0 or to_regclass('public.wiki_pages') is not null then
    raise exception 'REFUSED: this project already has data (% account(s)), and section 0 of this file deletes every table and every user account. That is what it is for - it is the greenfield v3 reset - but it is not something to run twice. If you mean it, run:  set app.greenfield = ''yes'';  and then this file again.', members;
  end if;
end
$greenfield_guard$;

drop table if exists public.wiki_page_categories cascade;
drop table if exists public.wiki_categories cascade;
drop table if exists public.wiki_links cascade;
drop table if exists public.wiki_revisions cascade;
drop table if exists public.wiki_page_projects cascade;
drop table if exists public.wiki_pages cascade;
drop table if exists public.custom_statuses cascade;
drop table if exists public.projects cascade;
drop table if exists public.profiles cascade;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop function if exists public.is_admin();
drop function if exists public.update_updated_at();
drop function if exists public.prevent_role_change();
drop function if exists public.check_project_limit();
drop function if exists public.check_wiki_page_limit();
drop function if exists public.check_custom_status_limit();
drop function if exists private.member_role();
drop function if exists private.owns_project(uuid);
drop function if exists private.project_is_linked(uuid);
drop type if exists public.member_role;

drop policy if exists "Allow user access INSERT" on storage.objects;
drop policy if exists "Allow user access SELECT" on storage.objects;
drop policy if exists "Allow user update" on storage.objects;
drop policy if exists "Allow user access DELETE" on storage.objects;
drop policy if exists "Wiki images INSERT" on storage.objects;
drop policy if exists "Wiki images SELECT" on storage.objects;
drop policy if exists "Wiki images UPDATE" on storage.objects;
drop policy if exists "Wiki images DELETE" on storage.objects;
drop policy if exists "Custom status icons INSERT" on storage.objects;
drop policy if exists "Custom status icons SELECT" on storage.objects;
drop policy if exists "Custom status icons UPDATE" on storage.objects;
drop policy if exists "Custom status icons DELETE" on storage.objects;

delete from auth.users;

create type public.member_role as enum ('reader', 'editor', 'moderator', 'admin');

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  role        public.member_role not null default 'reader',
  avatar_icon text,
  created_at  timestamptz not null default now(),
  constraint username_length check (char_length(username) <= 64)
);

create or replace function public.handle_new_user()
returns trigger as $$
declare
  base_name text;
begin
  base_name := coalesce(
    nullif(new.raw_user_meta_data -> 'custom_claims' ->> 'global_name', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(split_part(new.email, '@', 1), ''),
    'traveler'
  );
  base_name := left(base_name, 48);
  begin
    insert into public.profiles (id, username) values (new.id, base_name);
  exception when unique_violation then
    insert into public.profiles (id, username)
    values (new.id, base_name || '-' || left(new.id::text, 6));
  end;
  return new;
end;
$$ language plpgsql security definer set search_path = '';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create schema if not exists private;

create or replace function private.member_role()
returns public.member_role
language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = (select auth.uid()) $$;

grant usage on schema private to anon, authenticated;
grant execute on function private.member_role() to anon, authenticated;

create or replace function private.owns_project(pid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.projects
    where id = pid and user_id = (select auth.uid())
  )
$$;

create or replace function private.project_is_linked(pid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.wiki_page_projects where project_id = pid
  )
$$;

grant execute on function private.owns_project(uuid) to authenticated;
grant execute on function private.project_is_linked(uuid) to anon, authenticated;

create or replace function public.prevent_role_change()
returns trigger as $$
begin
  if new.role is distinct from old.role
     and auth.role() = 'authenticated'
     and private.member_role() is distinct from 'admin' then
    raise exception 'Cannot change role';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = '';

create trigger prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change();

alter table public.profiles enable row level security;

create policy "profiles readable by anyone" on public.profiles
  for select to anon, authenticated using (true);

create policy "update own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

grant select on public.profiles to anon, authenticated;
grant update on public.profiles to authenticated;

create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = '';

create table public.projects (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  data         jsonb not null,
  name         text not null default '',
  rarity       smallint not null default 1,
  portrait_url text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint data_size_limit check (octet_length(data::text) < 2097152)
);

create index idx_projects_user_id on public.projects(user_id);

create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.update_updated_at();

create or replace function public.check_project_limit()
returns trigger as $$
begin
  if (select count(*) from public.projects where user_id = new.user_id) >= 25 then
    raise exception 'Project limit reached (25)';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = '';

create trigger enforce_project_limit
  before insert on public.projects
  for each row execute function public.check_project_limit();

alter table public.projects enable row level security;

create policy "select own projects" on public.projects
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "insert own projects" on public.projects
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "update own projects" on public.projects
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "delete own or moderator" on public.projects
  for delete to authenticated
  using ((select auth.uid()) = user_id
         or (select private.member_role()) >= 'moderator');

grant select on public.projects to anon, authenticated;
grant insert, update, delete on public.projects to authenticated;

create table public.wiki_pages (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null default 'Untitled Page',
  subtitle     text,
  cover_image  text,
  sections     jsonb not null default '[]',
  search_text  text not null default '',
  kind         text not null default 'lore'
               check (kind in ('lore', 'character', 'guide')),
  status       text not null default 'draft'
               check (status in ('draft', 'published', 'archived')),
  edit_comment text,
  created_by   uuid references public.profiles(id) on delete set null,
  updated_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  global_bg_color     text,
  global_accent_color text,
  global_text_color   text,
  global_font         text,
  constraint sections_size_limit check (octet_length(sections::text) < 2097152),
  constraint title_length    check (char_length(title) <= 255),
  constraint slug_length     check (char_length(slug) <= 100),
  constraint subtitle_length check (char_length(subtitle) <= 1000),
  constraint comment_length  check (char_length(edit_comment) <= 500)
);

alter table public.wiki_pages add column search_tsv tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')),       'A') ||
    setweight(to_tsvector('english', coalesce(subtitle, '')),    'B') ||
    setweight(to_tsvector('english', coalesce(search_text, '')), 'C')
  ) stored;

create index wiki_pages_search_idx  on public.wiki_pages using gin (search_tsv);
create index wiki_pages_status_idx  on public.wiki_pages (status) where status = 'published';
create index wiki_pages_updated_idx on public.wiki_pages (updated_at desc);
create index wiki_pages_kind_idx    on public.wiki_pages (kind);

create or replace function public.stamp_wiki_page()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    new.created_by = coalesce(auth.uid(), new.created_by);
  end if;
  new.updated_by = coalesce(auth.uid(), new.updated_by);
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = '';

create trigger wiki_pages_stamp
  before insert or update on public.wiki_pages
  for each row execute function public.stamp_wiki_page();

alter table public.wiki_pages enable row level security;

create policy "published readable by anyone" on public.wiki_pages
  for select to anon, authenticated
  using (status = 'published');

create policy "members read all pages" on public.wiki_pages
  for select to authenticated
  using ((select private.member_role()) >= 'editor');

create policy "editors create pages" on public.wiki_pages
  for insert to authenticated
  with check ((select private.member_role()) >= 'editor');

create policy "editors update pages" on public.wiki_pages
  for update to authenticated
  using      ((select private.member_role()) >= 'editor')
  with check ((select private.member_role()) >= 'editor');

create policy "moderators delete pages" on public.wiki_pages
  for delete to authenticated
  using ((select private.member_role()) >= 'moderator');

grant select on public.wiki_pages to anon, authenticated;
grant insert, update, delete on public.wiki_pages to authenticated;

create table public.wiki_revisions (
  id         uuid primary key default gen_random_uuid(),
  page_id    uuid not null references public.wiki_pages(id) on delete cascade,
  title      text not null,
  subtitle   text,
  sections   jsonb not null,
  author_id  uuid references public.profiles(id) on delete set null,
  comment    text,
  created_at timestamptz not null default now()
);

create index wiki_revisions_page_idx
  on public.wiki_revisions (page_id, created_at desc);

create or replace function public.write_wiki_revision()
returns trigger as $$
declare
  last_rev record;
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

  if last_rev.id is not null
     and last_rev.author_id is not distinct from auth.uid()
     and last_rev.created_at > now() - interval '10 minutes' then
    update public.wiki_revisions
      set title = new.title, subtitle = new.subtitle, sections = new.sections,
          comment = coalesce(new.edit_comment, comment)
      where id = last_rev.id;
  else
    insert into public.wiki_revisions (page_id, title, subtitle, sections, author_id, comment)
    values (new.id, new.title, new.subtitle, new.sections, auth.uid(), new.edit_comment);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = '';

create trigger wiki_pages_revision
  after insert or update on public.wiki_pages
  for each row execute function public.write_wiki_revision();

alter table public.wiki_revisions enable row level security;

create policy "revisions readable by members" on public.wiki_revisions
  for select to authenticated
  using ((select private.member_role()) >= 'editor');

create policy "moderators delete revisions" on public.wiki_revisions
  for delete to authenticated
  using ((select private.member_role()) >= 'moderator');

grant select, delete on public.wiki_revisions to authenticated;

create table public.wiki_links (
  from_page uuid not null references public.wiki_pages(id) on delete cascade,
  to_slug   text not null,
  primary key (from_page, to_slug)
);
create index wiki_links_to_slug_idx on public.wiki_links (to_slug);

alter table public.wiki_links enable row level security;

create policy "links readable by anyone" on public.wiki_links
  for select to anon, authenticated using (true);

create policy "editors write links" on public.wiki_links
  for insert to authenticated
  with check ((select private.member_role()) >= 'editor');

create policy "editors delete links" on public.wiki_links
  for delete to authenticated
  using ((select private.member_role()) >= 'editor');

grant select on public.wiki_links to anon, authenticated;
grant insert, delete on public.wiki_links to authenticated;

create table public.wiki_categories (
  slug        text primary key,
  name        text not null,
  description text,
  constraint category_slug_length check (char_length(slug) <= 100),
  constraint category_name_length check (char_length(name) <= 100)
);

create table public.wiki_page_categories (
  page_id       uuid not null references public.wiki_pages(id) on delete cascade,
  category_slug text not null references public.wiki_categories(slug) on delete cascade,
  primary key (page_id, category_slug)
);
create index wiki_page_categories_cat_idx on public.wiki_page_categories (category_slug);

alter table public.wiki_categories      enable row level security;
alter table public.wiki_page_categories enable row level security;

create policy "categories readable by anyone" on public.wiki_categories
  for select to anon, authenticated using (true);
create policy "editors manage categories" on public.wiki_categories
  for insert to authenticated with check ((select private.member_role()) >= 'editor');
create policy "editors update categories" on public.wiki_categories
  for update to authenticated
  using ((select private.member_role()) >= 'editor')
  with check ((select private.member_role()) >= 'editor');
create policy "moderators delete categories" on public.wiki_categories
  for delete to authenticated using ((select private.member_role()) >= 'moderator');

create policy "page categories readable by anyone" on public.wiki_page_categories
  for select to anon, authenticated using (true);
create policy "editors tag pages" on public.wiki_page_categories
  for insert to authenticated with check ((select private.member_role()) >= 'editor');
create policy "editors untag pages" on public.wiki_page_categories
  for delete to authenticated using ((select private.member_role()) >= 'editor');

grant select on public.wiki_categories, public.wiki_page_categories to anon, authenticated;
grant insert, update, delete on public.wiki_categories to authenticated;
grant insert, delete on public.wiki_page_categories to authenticated;

create table public.wiki_page_projects (
  id              uuid primary key default gen_random_uuid(),
  wiki_page_id    uuid not null references public.wiki_pages(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  display_order   smallint not null default 0,
  detail_sections jsonb not null default '[]',
  constraint unique_page_project unique (wiki_page_id, project_id),
  constraint detail_size_limit check (octet_length(detail_sections::text) < 2097152)
);

create index idx_wiki_page_projects_page    on public.wiki_page_projects(wiki_page_id);
create index idx_wiki_page_projects_project on public.wiki_page_projects(project_id);

alter table public.wiki_page_projects enable row level security;

create policy "junction readable with page" on public.wiki_page_projects
  for select to anon, authenticated
  using (exists (
    select 1 from public.wiki_pages wp
    where wp.id = wiki_page_id
      and (wp.status = 'published' or (select private.member_role()) >= 'editor')
  ));

create policy "editors link own projects" on public.wiki_page_projects
  for insert to authenticated
  with check (
    (select private.member_role()) >= 'editor'
    and private.owns_project(project_id)
  );

create policy "editors update links" on public.wiki_page_projects
  for update to authenticated
  using ((select private.member_role()) >= 'editor')
  with check ((select private.member_role()) >= 'editor');

create policy "editors unlink" on public.wiki_page_projects
  for delete to authenticated
  using ((select private.member_role()) >= 'editor');

grant select on public.wiki_page_projects to anon, authenticated;
grant insert, update, delete on public.wiki_page_projects to authenticated;

create policy "linked projects readable" on public.projects
  for select to anon, authenticated
  using (private.project_is_linked(id));

create table public.custom_statuses (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  name           text not null,
  key            text not null unique,
  icon_url       text,
  classification text not null default 'standard'
                 check (classification in ('standard', 'neutral', 'positive', 'negative')),
  created_at     timestamptz not null default now(),
  constraint status_name_length check (char_length(name) <= 100),
  constraint status_key_length  check (char_length(key) <= 50)
);

create index idx_custom_statuses_user on public.custom_statuses(user_id);

create or replace function public.check_custom_status_limit()
returns trigger as $$
begin
  if (select count(*) from public.custom_statuses where user_id = new.user_id) >= 50 then
    raise exception 'Custom status limit reached (50)';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = '';

create trigger enforce_custom_status_limit
  before insert on public.custom_statuses
  for each row execute function public.check_custom_status_limit();

alter table public.custom_statuses enable row level security;

create policy "statuses readable by anyone" on public.custom_statuses
  for select to anon, authenticated using (true);

create policy "members create own statuses" on public.custom_statuses
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "update own or moderator" on public.custom_statuses
  for update to authenticated
  using ((select auth.uid()) = user_id
         or (select private.member_role()) >= 'moderator')
  with check ((select auth.uid()) = user_id
              or (select private.member_role()) >= 'moderator');

create policy "delete own or moderator" on public.custom_statuses
  for delete to authenticated
  using ((select auth.uid()) = user_id
         or (select private.member_role()) >= 'moderator');

grant select on public.custom_statuses to anon, authenticated;
grant insert, update, delete on public.custom_statuses to authenticated;

insert into storage.buckets (id, name, public)
values ('project-images', 'project-images', true),
       ('wiki-images', 'wiki-images', true),
       ('custom-status-icons', 'custom-status-icons', true)
on conflict (id) do update set public = true;

create policy "project images select own folder"
  on storage.objects for select to authenticated
  using (bucket_id = 'project-images'
         and (auth.uid())::text = (storage.foldername(name))[1]);
create policy "project images write own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'project-images'
              and (auth.uid())::text = (storage.foldername(name))[1]);
create policy "project images update own folder"
  on storage.objects for update to authenticated
  using (bucket_id = 'project-images'
         and (auth.uid())::text = (storage.foldername(name))[1])
  with check (bucket_id = 'project-images'
              and (auth.uid())::text = (storage.foldername(name))[1]);
create policy "project images delete own folder"
  on storage.objects for delete to authenticated
  using (bucket_id = 'project-images'
         and (auth.uid())::text = (storage.foldername(name))[1]);

create policy "wiki images editors select"
  on storage.objects for select to authenticated
  using (bucket_id = 'wiki-images' and private.member_role() >= 'editor');
create policy "wiki images editors write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'wiki-images' and private.member_role() >= 'editor');
create policy "wiki images editors update"
  on storage.objects for update to authenticated
  using (bucket_id = 'wiki-images' and private.member_role() >= 'editor')
  with check (bucket_id = 'wiki-images' and private.member_role() >= 'editor');
create policy "wiki images editors delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'wiki-images' and private.member_role() >= 'editor');

create policy "status icons select own folder"
  on storage.objects for select to authenticated
  using (bucket_id = 'custom-status-icons'
         and (auth.uid())::text = (storage.foldername(name))[1]);
create policy "status icons write own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'custom-status-icons'
              and (auth.uid())::text = (storage.foldername(name))[1]);
create policy "status icons update own folder"
  on storage.objects for update to authenticated
  using (bucket_id = 'custom-status-icons'
         and (auth.uid())::text = (storage.foldername(name))[1])
  with check (bucket_id = 'custom-status-icons'
              and (auth.uid())::text = (storage.foldername(name))[1]);
create policy "status icons delete own folder"
  on storage.objects for delete to authenticated
  using (bucket_id = 'custom-status-icons'
         and (auth.uid())::text = (storage.foldername(name))[1]);

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.prevent_role_change() from public, anon, authenticated;
revoke execute on function public.write_wiki_revision() from public, anon, authenticated;
revoke execute on function public.check_project_limit() from public, anon, authenticated;
revoke execute on function public.check_custom_status_limit() from public, anon, authenticated;
revoke execute on function public.update_updated_at() from public, anon, authenticated;
revoke execute on function public.stamp_wiki_page() from public, anon, authenticated;
