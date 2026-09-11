do $guard$
begin
  if coalesce(current_setting('app.apply_1b', true), '') <> 'yes' then
    raise exception 'REFUSED: this migration removes every editor''s ability to change a page they did not create, and must be applied in the SAME deploy as the contributor UI that replaces it. Applied early it strands 51 editors with nowhere to go. If that frontend is already live, run:  set app.apply_1b = ''yes'';  and then this file again.';
  end if;
end
$guard$;

create or replace function public.guard_wiki_page_write()
returns trigger as $$
declare
  uid uuid := auth.uid();
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
$$ language plpgsql security definer set search_path = '';

revoke execute on function public.guard_wiki_page_write() from public, anon, authenticated;

drop trigger if exists wiki_pages_guard on public.wiki_pages;
create trigger wiki_pages_guard
  before insert or update on public.wiki_pages
  for each row execute function public.guard_wiki_page_write();

drop policy if exists "editors update pages"    on public.wiki_pages;
drop policy if exists "moderators delete pages" on public.wiki_pages;

create policy "authors edit own drafts" on public.wiki_pages
  for update to authenticated
  using      (created_by = (select auth.uid())
              and (select private.member_role()) >= 'editor')
  with check (created_by = (select auth.uid()));

create policy "maintainers edit any page" on public.wiki_pages
  for update to authenticated
  using      ((select private.is_maintainer()))
  with check ((select private.is_maintainer()));

create policy "authors delete own drafts" on public.wiki_pages
  for delete to authenticated
  using (created_by = (select auth.uid()) and status = 'draft');

create policy "maintainers delete any page" on public.wiki_pages
  for delete to authenticated
  using ((select private.is_maintainer()));

drop policy if exists "editors link own projects" on public.wiki_page_projects;
drop policy if exists "editors update links"      on public.wiki_page_projects;
drop policy if exists "editors unlink"            on public.wiki_page_projects;

create policy "link cards on own draft" on public.wiki_page_projects
  for insert to authenticated
  with check (
    private.owns_project(project_id)
    and (
      (select private.is_maintainer())
      or exists (
        select 1 from public.wiki_pages wp
        where wp.id = wiki_page_id
          and wp.created_by = (select auth.uid())
          and wp.status = 'draft'
      )
    )
  );

create policy "update links on own draft" on public.wiki_page_projects
  for update to authenticated
  using (
    (select private.is_maintainer())
    or exists (
      select 1 from public.wiki_pages wp
      where wp.id = wiki_page_id and wp.created_by = (select auth.uid()) and wp.status = 'draft'
    )
  )
  with check (
    (select private.is_maintainer())
    or exists (
      select 1 from public.wiki_pages wp
      where wp.id = wiki_page_id and wp.created_by = (select auth.uid()) and wp.status = 'draft'
    )
  );

create policy "unlink on own draft" on public.wiki_page_projects
  for delete to authenticated
  using (
    (select private.is_maintainer())
    or exists (
      select 1 from public.wiki_pages wp
      where wp.id = wiki_page_id and wp.created_by = (select auth.uid()) and wp.status = 'draft'
    )
  );

drop policy if exists "editors write links"  on public.wiki_links;
drop policy if exists "editors delete links" on public.wiki_links;

create policy "write links on own draft" on public.wiki_links
  for insert to authenticated
  with check (
    (select private.is_maintainer())
    or exists (
      select 1 from public.wiki_pages wp
      where wp.id = from_page and wp.created_by = (select auth.uid()) and wp.status = 'draft'
    )
  );

create policy "delete links on own draft" on public.wiki_links
  for delete to authenticated
  using (
    (select private.is_maintainer())
    or exists (
      select 1 from public.wiki_pages wp
      where wp.id = from_page and wp.created_by = (select auth.uid()) and wp.status = 'draft'
    )
  );

drop policy if exists "editors tag pages"   on public.wiki_page_categories;
drop policy if exists "editors untag pages" on public.wiki_page_categories;

create policy "tag own draft" on public.wiki_page_categories
  for insert to authenticated
  with check (
    (select private.is_maintainer())
    or exists (
      select 1 from public.wiki_pages wp
      where wp.id = page_id and wp.created_by = (select auth.uid()) and wp.status = 'draft'
    )
  );

create policy "untag own draft" on public.wiki_page_categories
  for delete to authenticated
  using (
    (select private.is_maintainer())
    or exists (
      select 1 from public.wiki_pages wp
      where wp.id = page_id and wp.created_by = (select auth.uid()) and wp.status = 'draft'
    )
  );

drop policy if exists "editors update categories" on public.wiki_categories;
create policy "maintainers update categories" on public.wiki_categories
  for update to authenticated
  using      ((select private.is_maintainer()))
  with check ((select private.is_maintainer()));

drop policy if exists "wiki images editors update" on storage.objects;
create policy "wiki images editors update"
  on storage.objects for update to authenticated
  using (bucket_id = 'wiki-images'
         and (private.is_maintainer() or owner = auth.uid()))
  with check (bucket_id = 'wiki-images'
              and (private.is_maintainer() or owner = auth.uid()));

drop policy if exists "wiki images editors delete" on storage.objects;
create policy "wiki images editors delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'wiki-images'
         and (private.is_maintainer() or owner = auth.uid()));

