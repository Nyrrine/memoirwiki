<h1 align="center">Memoir Wiki &amp; OC ToolKit</h1>

<p align="center">
  <em>Identity card builder and community lore wiki for Limbus Company original characters.<br />
  Fan-made. Not affiliated with or endorsed by Project Moon.</em>
</p>

<p align="center">
  <img src="https://i.pinimg.com/1200x/c8/f8/c8/c8f8c85aabaaf995ad019518fbc71559.jpg" alt="Memoir" width="640" />
</p>

<p align="center">
  <img src="https://sloc.xyz/github/Nyrrine/memoirwiki" alt="Lines of code" />
  <img src="https://img.shields.io/github/languages/top/Nyrrine/memoirwiki?color=d4af37" alt="Top language" />
  <img src="https://img.shields.io/github/repo-size/Nyrrine/memoirwiki?color=d4af37" alt="Repo size" />
  <img src="https://img.shields.io/github/last-commit/Nyrrine/memoirwiki?color=d4af37" alt="Last commit" />
</p>

---

## ToolKit

Design full identity cards for your OCs: portrait, stats, resistances,
skills with coin effects, passives, sanity, and rich text with close to
900 status tokens and 2,800+ skill art assets. Cards save to your account
and export as PNG.

## Wiki

A shared lore wiki for the whole server. Global page namespace,
`[[wikilinks]]` with backlinks, full-text search, categories, revision
history with restore, and identity showcases that embed live card renders
on character pages. Published pages are readable by anyone.

## Contributing to the wiki

The live wiki works like a repository. Your own drafts are yours to edit
freely. Anything already published is a maintainer's decision, whoever wrote
it - so editing a live page sends your version for review instead of changing
it, and a maintainer sees a section-by-section diff before it is merged. A
merged change is credited to whoever wrote it, not to whoever pressed merge.

"My Proposals" shows what happened to yours. If the page moved on while you
were working, the proposal can be rebased onto the current version: anything
you changed that nobody else touched carries across on its own, and only real
collisions are put to you as a question.

## Moderation

Maintainers get a panel over the whole wiki - a review queue, pages, people,
cards, statuses and an activity log. Every destructive action is recorded with
the action itself, in the same transaction, so the log cannot disagree with
what happened.

## Privacy

Pages show who has contributed and who has recently read them. Read receipts
are on by default and can be switched off from the editor sidebar or from the
trail itself; switching them off stops new visits being recorded and deletes
what was already stored, rather than hiding it.

## Sign-in

Discord OAuth only. Server members are granted editing automatically.

## Running your own instance

Create a Supabase project, then run these in the SQL Editor in order:

1. `supabase/migration.sql` - the v3 base schema. Its section 0 is a
   greenfield reset: it drops every table and deletes every account. The file
   refuses to run if the project already has any, so a fresh one needs no
   extra step and a populated one cannot be wiped by accident.
2. `supabase/v4-migration.sql` - the maintainer build. **Its section 0 must be
   run on its own first**, because Postgres will not let a new enum value be
   used in the transaction that adds it. Run section 0, then the rest.
3. Sign in through the app once so your profile row exists, then seed yourself
   as admin:

   ```sql
   update public.profiles set role = 'admin' where username = '<your name>';
   ```

   Nothing else grants admin. The moderation panel is gated on it,
   `set_member_role` refuses to promote anyone to admin, and both it and
   `ban_member` refuse to touch an admin at all, which is what keeps one in
   existence.

4. `supabase/v4-1b-protect-main.sql` **last, and only once the app is
   deployed**. It removes every editor's ability to change a page they did not
   create, so applied before the proposal flow is live it leaves contributors
   with nowhere to go. The file refuses to run unless you set `app.apply_1b`
   first, deliberately.

   Once it is on, do not replay `v4-migration.sql`. Both files write the two
   `wiki-images` policies on `storage.objects`, and both drop before they
   create, so a replay quietly reverts them and gives every editor update and
   delete over everyone else's uploaded images. If you have to replay it,
   apply this file again straight after.

Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` (server-side only), and `DISCORD_GUILD_ID` if you
want guild-gated editor promotion.

## Rights

All rights reserved - there is deliberately no licence. This is a fan project
built on Project Moon's assets, which are not ours to license to anyone else.
The source is public to read and audit, not offered for reuse. `NOTICE.md` sets
out what belongs to whom, including every bundled font.
