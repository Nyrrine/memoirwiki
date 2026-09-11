begin;

create or replace function public.guard_wiki_page_write()
returns trigger as $body$
declare uid uuid := auth.uid();
begin
  if uid is null then return new; end if;
  if private.is_maintainer() then return new; end if;
  if tg_op = 'INSERT' then
    if new.status is distinct from 'draft' then
      raise exception 'New pages start as drafts. A maintainer publishes them.';
    end if;
    return new;
  end if;
  if old.created_by is distinct from uid then
    raise exception 'This page is not yours to edit. Propose changes instead.';
  end if;
  if old.status not in ('draft', 'in_review') then
    raise exception 'This page is live. Propose changes instead.';
  end if;
  if new.status not in ('draft', 'in_review') then
    raise exception 'Only a maintainer can publish or archive a page.';
  end if;
  if old.status = 'in_review' and new.status = 'in_review' then
    raise exception 'This page is locked while it is waiting for review.';
  end if;
  return new;
end;
$body$ language plpgsql security definer set search_path = '';

drop trigger if exists wiki_pages_guard on public.wiki_pages;
create trigger wiki_pages_guard before insert or update on public.wiki_pages
  for each row execute function public.guard_wiki_page_write();

drop policy if exists "editors update pages"    on public.wiki_pages;
drop policy if exists "moderators delete pages" on public.wiki_pages;
create policy "authors edit own drafts" on public.wiki_pages
  for update to authenticated
  using      (created_by = (select auth.uid()) and (select private.member_role()) >= 'editor')
  with check (created_by = (select auth.uid()));
create policy "maintainers edit any page" on public.wiki_pages
  for update to authenticated
  using ((select private.is_maintainer())) with check ((select private.is_maintainer()));
create policy "authors delete own drafts" on public.wiki_pages
  for delete to authenticated using (created_by = (select auth.uid()) and status = 'draft');
create policy "maintainers delete any page" on public.wiki_pages
  for delete to authenticated using ((select private.is_maintainer()));

drop policy if exists "editors update categories" on public.wiki_categories;
create policy "maintainers update categories" on public.wiki_categories
  for update to authenticated
  using ((select private.is_maintainer())) with check ((select private.is_maintainer()));

drop policy if exists "editors write links"  on public.wiki_links;
drop policy if exists "editors delete links" on public.wiki_links;
create policy "write links on own draft" on public.wiki_links
  for insert to authenticated
  with check ((select private.is_maintainer())
    or exists (select 1 from public.wiki_pages wp where wp.id = from_page
                and wp.created_by = (select auth.uid()) and wp.status = 'draft'));
create policy "delete links on own draft" on public.wiki_links
  for delete to authenticated
  using ((select private.is_maintainer())
    or exists (select 1 from public.wiki_pages wp where wp.id = from_page
                and wp.created_by = (select auth.uid()) and wp.status = 'draft'));

create temp table fx as
select (select id from public.profiles where role='editor' order by created_at limit 1) as author,
       (select id from public.profiles where role='editor' order by created_at offset 1 limit 1) as stranger,
       (select id from public.profiles where role>='moderator' order by created_at limit 1) as maint,
       gen_random_uuid() as p_draft, gen_random_uuid() as p_review,
       gen_random_uuid() as p_live, gen_random_uuid() as p_other;
create temp table results(seq serial, name text, ok boolean, detail text);

insert into public.wiki_pages (id,slug,title,status,created_by)
select p_draft,'v1b-d-'||substr(p_draft::text,1,8),'D','draft',author from fx;
insert into public.wiki_pages (id,slug,title,status,created_by)
select p_review,'v1b-r-'||substr(p_review::text,1,8),'R','in_review',author from fx;
insert into public.wiki_pages (id,slug,title,status,created_by)
select p_live,'v1b-l-'||substr(p_live::text,1,8),'L','published',author from fx;
insert into public.wiki_pages (id,slug,title,status,created_by)
select p_other,'v1b-o-'||substr(p_other::text,1,8),'O','published',stranger from fx;
insert into public.wiki_links (from_page,to_slug) select p_other,'target-slug' from fx;

create or replace function pg_temp.attempt(p_uid uuid, p_sql text) returns text as $body$
declare n int;
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('sub',p_uid,'role','authenticated')::text, true);
    set local role authenticated;
    execute p_sql;
    get diagnostics n = row_count;
    reset role;
    return case when n > 0 then 'DID IT ('||n||' rows)' else 'BLOCKED (rls filtered, 0 rows)' end;
  exception when others then
    reset role;
    return 'BLOCKED ('||sqlerrm||')';
  end;
end $body$ language plpgsql;

do $t$
declare f record;
begin
  select * into f from fx;

  insert into results(name, ok, detail) values ('01 author edits own draft', true,
    pg_temp.attempt(f.author, format('update public.wiki_pages set subtitle=''x'' where id=%L', f.p_draft)));
  insert into results(name, ok, detail) values ('02 author edits own page while it is in review', false,
    pg_temp.attempt(f.author, format('update public.wiki_pages set subtitle=''x'' where id=%L', f.p_review)));
  insert into results(name, ok, detail) values ('03 author sends own draft for review', true,
    pg_temp.attempt(f.author, format('update public.wiki_pages set status=''in_review'' where id=%L', f.p_draft)));
  insert into results(name, ok, detail) values ('04 author withdraws own page from review', true,
    pg_temp.attempt(f.author, format('update public.wiki_pages set status=''draft'' where id=%L', f.p_review)));
  insert into results(name, ok, detail) values ('05 author publishes own draft', false,
    pg_temp.attempt(f.author, format('update public.wiki_pages set status=''published'' where id=%L', f.p_review)));
  insert into results(name, ok, detail) values ('06 stranger edits a draft they do not own', false,
    pg_temp.attempt(f.stranger, format('update public.wiki_pages set subtitle=''hijack'' where id=%L', f.p_review)));
  insert into results(name, ok, detail) values ('07 author edits their own PUBLISHED page', false,
    pg_temp.attempt(f.author, format('update public.wiki_pages set subtitle=''x'' where id=%L', f.p_live)));
  insert into results(name, ok, detail) values ('08 stranger edits a published page', false,
    pg_temp.attempt(f.stranger, format('update public.wiki_pages set subtitle=''hijack'' where id=%L', f.p_live)));
  insert into results(name, ok, detail) values ('09 maintainer edits any page', true,
    pg_temp.attempt(f.maint, format('update public.wiki_pages set subtitle=''ok'' where id=%L', f.p_live)));
  insert into results(name, ok, detail) values ('10 new page created already published', false,
    pg_temp.attempt(f.author, format('insert into public.wiki_pages (slug,title,status,created_by) values (%L,''N'',''published'',%L)','v1b-n-'||substr(gen_random_uuid()::text,1,8), f.author)));
  insert into results(name, ok, detail) values ('11 author deletes their own PUBLISHED page', false,
    pg_temp.attempt(f.author, format('delete from public.wiki_pages where id=%L', f.p_live)));
  insert into results(name, ok, detail) values ('12 stranger deletes a live page', false,
    pg_temp.attempt(f.stranger, format('delete from public.wiki_pages where id=%L', f.p_live)));
  insert into results(name, ok, detail) values ('13 stranger writes a link on a live page', false,
    pg_temp.attempt(f.stranger, format('insert into public.wiki_links (from_page,to_slug) values (%L,''x'')', f.p_live)));
  insert into results(name, ok, detail) values ('14 stranger deletes links on a live page', false,
    pg_temp.attempt(f.stranger, format('delete from public.wiki_links where from_page=%L', f.p_other)));
  insert into results(name, ok, detail) values ('15 stranger renames every category', false,
    pg_temp.attempt(f.stranger, 'update public.wiki_categories set name=''hijacked'''));
  insert into results(name, ok, detail) values ('16 maintainer renames a category', true,
    pg_temp.attempt(f.maint, 'update public.wiki_categories set name=name'));
  insert into results(name, ok, detail) values ('17 author deletes their own draft', true,
    pg_temp.attempt(f.author, format('delete from public.wiki_pages where id=%L', f.p_review)));
end
$t$;

do $t$
declare report text; bad int;
begin
  select string_agg(
    case when (ok and detail like 'DID IT%') or (not ok and detail like 'BLOCKED%') then 'PASS  ' else 'FAIL  ' end
    || name || '  ->  ' || detail, chr(10) order by seq) into report from results;
  select count(*) into bad from results
   where not ((ok and detail like 'DID IT%') or (not ok and detail like 'BLOCKED%'));
  raise exception E'\n=== 1b STATE MACHINE (rolled back) ===\n%\n=== % of % landed where intended ===',
    report, (select count(*) from results) - bad, (select count(*) from results);
end
$t$;
