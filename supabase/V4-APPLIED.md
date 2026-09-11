# V4 - what is applied to `ukxgghiknvewuyqsrmhl`

**Thirty-three migrations**, applied 2026-09-08 (nineteen), 2026-09-10 (ten)
and 2026-09-11 (four). Versions are UTC; the dates above are local (+0800),
so the nineteen include nine rows whose version begins `20260907`.

Supabase's own `supabase_migrations.schema_migrations` holds each step
verbatim and is the authority. This table is the readable version of it.

`supabase/v4-migration.sql` is the consolidated final state, **rebuilt from
the live catalogue on 2026-09-10 and verified against it**. The verification
is the point, and it is repeatable: replay the file inside a transaction,
snapshot the catalogue before and after, take the symmetric difference, and
roll back. A no-op diff is what proves it matches. Function bodies are
compared with comments stripped and whitespace collapsed, or every explanatory
comment in the file reads as a difference. Run section by section if a single
statement is unwieldy; each of sections 1-2, 3-4, 5 and 6-7 was verified
separately and all four came back with no differences.

**What the method does not cover, stated plainly.** It proves the statements
that actually *executed* left no trace. Against a database that already has
everything, `create table if not exists` (3), `create index if not exists`
(12, including the unique partial one that enforces one open proposal per
author), `add column if not exists` (6), `enable row level security` (3),
`comment on` (3) and **every one of the 53 grants and revokes** are no-ops and
prove nothing - which is exactly why migration 26's table-level revokes sat
missing from the file through every earlier pass. `update storage.buckets`
cannot be verified this way on any database: it changes table *data*, and no
catalogue snapshot holds bucket rows. For the create-table half, replay
section 2 into a throwaway schema in the same transaction and diff it against
`public`; that is what caught the missing `reviewer_id` foreign key.

**And the fresh-v3 path has never been exercised.** Every run was against a
database that already had everything, so "replaying it on a v3 database
reproduces the current schema" is the file's intent, checked by reading it
against `supabase/migration.sql`, not by running it. Related: **`migration.sql`
itself has never been verified the way this file now has.** The v4 file's
assumptions about it - the `private` schema and its USAGE grants, the three
buckets, the column-level `status` check that auto-names to
`wiki_pages_status_check` - were each traced by hand and hold today.

Do that again after any schema change rather than editing the file by hand.
The previous version was hand-maintained and had drifted **fourteen
migrations** behind without anyone noticing. Replayed against the live
database it would have silently reverted them - including reopening the read
trail to the open internet, because its `drop policy if exists` named a policy
that no longer existed and its `create policy` then sat *alongside* the
current one, and permissive policies OR.

A full data backup is at `backups/db-2026-09-11.json` (gitignored), retaken
before migration 32. Re-take
one with `node scripts/backup-db.mjs` before any schema change. That script
originally listed nine tables (the v3 set, plus auth users fetched
separately), so backups taken before 2026-09-10 contain **no**
`wiki_page_proposals`, `wiki_page_views` or `moderation_log`; all three were
empty at the time, so nothing was actually lost.

| # | Version | Name | What it does |
|---|---|---|---|
| 1 | 20260907174906 | `v4_add_banned_role` | `'banned'` into the role enum below `'reader'`, so the ordering makes every `>= editor` check refuse a banned account. Alone in its own migration because Postgres will not let a new enum value be used in the transaction that adds it. |
| 2 | 20260907174925 | `v4_maintainer_schema` | `wiki_page_proposals`, `wiki_page_views`, `moderation_log`; `wiki_pages.is_memoir`; `'in_review'` status; ban bookkeeping on `profiles`. |
| 3 | 20260907174950 | `v4_maintainer_functions_and_reach` | `private.is_maintainer()`; `stamp_wiki_page` / `write_wiki_revision` gain the `app.acting_author` override so a merge credits the author; maintainers read all cards; admins update any profile; role floor on card and status inserts. |
| 4 | 20260907175031 | `v4_proposal_and_moderation_rpcs` | `submit_proposal`, `merge_proposal`, `review_proposal`, `withdraw_proposal`, `record_page_view`, `set_member_role`, `ban_member`. |
| 5 | 20260907180449 | `v4_fix_revision_collapse` | **Regression fix.** `current_setting(name, true)` returns NULL when unset, so `NULL = 'on'` was NULL and `not NULL` never took the collapse branch: every save wrote a fresh revision holding a full copy of `sections`. Autosave would have made ~80 rows/hour/editor instead of ~6. Caught before any page had been saved. |
| 6 | 20260907180534 | `v4_close_ban_bypasses` | Five surfaces checked ownership and no role, so a banned account could still rewrite or delete its own cards (cascading showcases off live pages), rewrite its globally-readable status tokens, rename itself, clear its own ban record, replace images in the public buckets, and keep writing itself into the read trail. All closed, plus `profiles.role_locked`. |
| 7 | 20260907180621 | `v4_harden_proposals_and_admin` | Caps on `search_text` / `cover_image` / slug arrays (only `sections` was bounded, so the "2 MB limit" was illusory); total-proposal accounting, a 5s rate limit and a 30-day purge, since submit->withdraw->submit left a permanent multi-MB row each time and freed the cap to do it again; `merge_proposal` pins the reviewed version so a resubmission cannot swap content between reading the diff and clicking Merge; admins cannot be demoted or banned through the app; missing FK indexes. |
| 8 | 20260907181806 | `v4_bound_slug_arrays_and_audit_role_changes` | The slug caps bounded element *count*, not size: 500 elements of 20 000 chars is ~9.8 MB in one column and passed, walking past both the sections and search_text caps. Now bounded by `octet_length`. And every guard added to `set_member_role`/`ban_member` was reachable around via `PATCH /profiles`, because `admins update any profile` had no column restriction and `member_role()` is STABLE - the sole admin could demote themselves out of their own site with nothing in the audit log. Moderation state now moves only through the audited RPCs. |
| 9 | 20260907181847 | `v4_keep_review_records_and_purge_rpc` | The 30-day purge included `'merged'`, so the record of an accepted contribution was deleted at the *author's* own initiative (it runs inside `submit_proposal`). Merged proposals are kept, the merge log carries `summary`/`page_slug`/`review_note` so it stands alone, `review_proposal` no-ops on an unchanged call (a repeat loop would have permanently rate-limited its subject), and `purge_proposals` exists so "a maintainer can clear them" is actually true. |
| 10 | 20260908011416 | `v4_logged_moderator_actions` | The panel's most destructive buttons - delete a page, a card, a status, publish or unpublish - went straight through PostgREST and wrote nothing to `moderation_log`; only the proposal and role RPCs logged. A moderator could delete every page and card on the site and the Activity tab, which presents itself as the record, would stay empty. Adds `admin_delete_page`, `admin_delete_card`, `admin_delete_status`, `admin_set_page_status`, each doing the damage and its log entry in one transaction. |
| 11 | 20260908013110 | `v4_derive_search_text_server_side` | `search_text` was whatever the client sent: written verbatim, feeding the generated `search_tsv`, matched by site search, and **rendered nowhere**. A contributor could carry 100 KB of slurs in a proposal whose visible diff was a one-word change, and after the merge the page ranked for every one of those terms with no trace. Deriving it from `sections` removes the channel rather than asking a moderator to read a 100 KB blob. Covers both an author saving their own page and a maintainer merging a proposal. |
| 12 | 20260908013139 | `v4_ban_reason_edit_preserves_timestamp` | Correcting a typo in a ban reason re-ran `banned_at = now()`, silently rewriting when the ban happened. The timestamp is evidence; only a fresh ban sets it. |
| 13 | 20260908013400 | `v4_fix_search_text_trigger_privileges` | **Regression fix.** The derivation trigger ran as the invoking role and called `private.sections_search_text`, whose EXECUTE had been revoked from everyone but the owner - so **every write to `wiki_pages` failed with a permission error**. Making the trigger function `SECURITY DEFINER` keeps the helper itself off the API surface and still lets the trigger use it. (The definer is `derive_wiki_search_text`; `private.sections_search_text` is not itself definer.) |
| 14 | 20260908014638 | `v4_search_text_type_anchored_paths` | The previous derivation traded one problem for two. It walked the whole jsonb with a recursive CTE whose work table carries entire subtrees - O(depth x size), not O(nodes): 99 KB nested 3500 deep took **3.1 seconds** against an 8s statement timeout, so any editor could make a page permanently expensive to write with a body three orders of magnitude under the cap. And it matched whitelisted *key names* at any depth, so a `"text"` key smuggled onto a divider was indexed - the same invisible channel it was written to close. Type-anchored jsonpath fixes both: same payload, 0.2 ms. |
| 15 | 20260908014749 | `v4_stop_storing_proposal_search_text` | `wiki_pages.search_text` is derived on write now, so a proposal's copy is never read by anything. `submit_proposal` stops storing what it is handed rather than leaving a caller-controlled 100 KB column for some future path to start trusting. The parameter stays, so every existing caller keeps working. **Correction:** it did at the time, and migration 18 then replaced the whole signature - live `submit_proposal` takes 15 arguments and none of them is a search text. |
| 16 | 20260908022240 | `v4_validate_section_shape` | Nothing had ever validated the *shape* of `sections` on write - the check constraint counts bytes, and `sanitizeWikiPage` runs in the browser on read. Refuses an unknown section type (dropped silently by the renderer, a blank row in the review diff), a section with no id (the diff cannot match it, so every section shows as added-and-removed), and nesting deep enough to blow a browser's stack. Verified against every existing row first: nothing stored is rejected. |
| 17 | 20260908024025 | `v4_fix_section_shape_trigger_column_access` | **Regression fix, and the worst one.** The validator picked its column with `case tg_argv[0] when 'detail_sections' then new.detail_sections else new.sections end`; plpgsql prepares the whole `CASE` as one expression, so *both* field references must resolve against the row type. `wiki_pages` has no `detail_sections`, so **every insert and update to `wiki_pages` failed for ~30 minutes on the live site.** `to_jsonb(new) -> key` needs no column to exist at compile time. The function had been tested directly and the trigger on nothing. |
| 18 | 20260908025823 | `v4_proposal_fidelity_and_validator_fail_closed` | Three Phase 3 review findings. (1) A proposal could not carry the page's global colours or font, so a contributor who changed only those produced a row byte-identical to the live page and the maintainer saw an empty diff - `submit_proposal` grows to 15 arguments. (2) `base_updated_at` was read *inside* the RPC rather than sent by the client, so it recorded when the proposal was submitted, not what it was written against: an hour's work on a page that moved meanwhile looked current, the stale badge never fired, and `merge_proposal`'s guard passed - silently overwriting the other edit with the exact machinery built to prevent it. (3) `check_section_shape` failed **open**: `TG_ARGV[i]` is NULL past `tg_nargs`, `to_jsonb(row) -> NULL` is NULL, and `sections_problem(NULL)` returns NULL, so a trigger created without its column argument validated nothing and said nothing. |
| 19 | 20260908030245 | `v4_public_contributor_trail` | The contributor trail read `wiki_revisions` directly, whose only SELECT policy is members-only. RLS filters rather than errors, so an anonymous visitor to a published page got an empty list and the whole block silently vanished - for exactly the audience a published page exists for, and invisibly to the 52 of 60 members who can edit (51 editors and the admin). Replaced by `page_contributors`, which returns who and how many, never content, and only for pages already public. Also grants `anon` EXECUTE on `record_page_view`: its body no-ops for a null uid, but without the grant the call 403'd before reaching that branch, so every anonymous page load posted a failed request. |
| 20 | 20260910012950 | `v4_read_receipts` | Closes the read trail. `wiki_page_views` stops being `anon`-readable - the anon key ships in the client bundle by design, so `using (true)` meant two lines of curl returned the full reader list for any page joined to usernames and avatars, which no UI gate can affect. Adds `profiles.show_read_receipts` (default **on**), an opt-out that *prevents recording* rather than filtering on read: `record_page_view` returns early so the row never exists, the SELECT policy filters to owners who have it on, and `profiles_purge_read_trail` deletes that member's existing rows the moment the flag goes false. The purge is a trigger rather than a step inside `set_read_receipts` because `update own profile` still lets a member PATCH the column straight over the REST API - in the RPC alone the guarantee would hold for the app and quietly not hold for anything else. |
| 21 | 20260910015817 | `v4_read_receipts_review_fixes` | Three defects the adversarial review found in migration 20. (1) `admins update any profile` has no column restriction, so an **admin could flip another member's `show_read_receipts`** - off to irreversibly delete their trail, on to override the choice and resume recording them - with nothing in `moderation_log`, the same unaudited destructive lever migration 10 existed to close. The column cannot simply join `prevent_role_change`'s list, because that branch refuses every `authenticated` write when `app.role_change_ok` is unset and `SECURITY DEFINER` does not change the JWT claim `auth.role()` reads, so the guard would refuse the account holder too; it is scoped to cross-account writes instead, and lives in the trigger because a policy `WITH CHECK` cannot see `OLD`. (2) The purge tested for a true→false **transition**, so it could never be re-run - and `record_page_view` reads the flag without a lock, so under READ COMMITTED a view that began before the opt-out committed lands after the purge. The row was hidden by the policy, but the member's only route to removing it was to switch receipts **on**, publishing it, and off again. Purging whenever the flag is false makes opting out idempotent, so pressing it again repairs. (3) A banned account was refused **both** directions, and the comment saying that cost them nothing was false: `ban_member` does not purge, and the `update own profile` policy also requires `>= reader`, so their existing rows stayed visible to every signed-in member for good. Off is a delete-only direction and is now open to them; on stays shut. |
| 22 | 20260910021849 | `v4_read_receipts_bound_the_banned_write` | Two consequences of migration 21, found by the second review round. Making the purge idempotent meant `set_read_receipts` wrote to `profiles` on **every** call, and opening the off direction to banned accounts handed a suspended account the only write it has - unbounded and un-rate-limited. Nothing of anyone else's is destroyed, but each call leaves a dead tuple in `profiles`, the table `private.member_role()` reads on essentially every RLS check on the site; `submit_proposal` got a 5s rate limit for less. Both properties are kept without the write: the purge moves **into** the RPC so it no longer depends on the flag changing, the trigger stays for the direct-PATCH path, and the `profiles` UPDATE fires only when the value actually differs. Also corrects the column comment, which still claimed no row is ever recorded - what `\d+ profiles` shows a future maintainer. |
| 23 | 20260910022305 | `v4_proposal_base_sections` | `wiki_page_proposals.base_sections`, so a stale proposal can be rebased instead of redone by hand. A three-way merge needs the base, the author's version and the page as it stands, and only the base was missing - and it cannot be recovered after the fact: `write_wiki_revision` collapses consecutive saves by one author inside ten minutes into a single row, updating its content but leaving `created_at` at the first save of the run, so a revision's timestamp stops matching what it holds; metadata-only saves bump `wiki_pages.updated_at` and write no revision at all; and revisions never carried `cover_image`, `kind`, `is_memoir` or the global colours. Deriving a base from that would be inferring a state nobody observed, which is the mistake that cost this project cross-tab draft adoption. `submit_proposal` records it instead, server-side, and **only when the author's stamp still matched the page** - a proposal that was already stale when it was sent gets NULL and the rebase says it is working blind. Carries the same 2 MB ceiling as `sections`, because without it a proposal's base would be unbounded. **Correction, from the review of migration 24:** the sentence in this migration's own comment claiming the constraint keeps a proposal at 2 MB is wrong. It bounds the *column*, not the row - a proposal row can now hold ~4 MB where it held ~2 MB, and `submit_proposal`'s per-author `total_count >= 100` ceiling was sized when a row was 2 MB, so the worst case per author quietly doubled. Migration 24 shrinks the long-lived half of that. |
| 24 | 20260910024527 | `v4_clear_proposal_base_when_closed` | `base_sections` is only ever read to rebase an **open** proposal, so on a merged, rejected or withdrawn row it is data with no reader - kept as long as the row is, and merged proposals are kept deliberately and for good (migration 9). A `before insert or update` trigger nulls it on any terminal state: one object rather than three edits to `merge_proposal` / `review_proposal` / `withdraw_proposal`, and it covers any future path to a terminal state rather than only the three that exist now. Name order matters on this table - `wiki_proposals_clear_base` sorts before `wiki_proposals_section_shape`, which is harmless because it touches `base_sections` while the validator reads `sections`. |
| 25 | 20260910030807 | `v4_merge_refusal_points_at_the_rebase` | `merge_proposal` had refused a stale proposal with "Ask for a rebase" since Phase 1a, when there was no rebase to ask for. There is one now and the author performs it themselves. The maintainer reads this text in the review queue and relays it, so it is the only instruction the contributor gets - it now names where to go. |
| 26 | 20260910033046 | `v4_revoke_anon_select_on_members_only_tables` | `anon` still held the default SELECT **grant** on `wiki_page_proposals`, `moderation_log` and `wiki_revisions`. RLS gives it nothing on any of them - all three are members-only by policy - so this changes no behaviour. It buys the same thing the `wiki_page_views` revoke bought in migration 20: a future SELECT policy written without `to authenticated` cannot silently reopen the table, because the grant is not there to fall back on. Doing it for one table and not the rest left an asymmetry that read as an oversight. `wiki_revisions` was the one missing from my own list of this, and it holds the full content history of every page. Checked first that no client path reads any of them anonymously, because a revoke turns an empty list into a 401 - which is the defect migration 19 existed to fix. |
| 27 | 20260910040117 | `v4_close_ban_bookkeeping_and_rpc_only_writes` | Two exposures RLS was never going to catch, because both are about **grants** rather than policies. (1) **Ban bookkeeping was readable by the open internet.** `profiles readable by anyone` is `using (true)` for `anon`, and a table-level SELECT grant covers every column - so `banned_reason`, a moderator's free-text note about a named person, was public, along with `banned_by`, `banned_at`, `role_locked`, and `role`, from which "who is banned" reads directly. Zero members are banned today; the first ban would have published it. A table-level grant cannot have columns revoked from it, so the grant is replaced with the four columns an anonymous visitor needs - `id`, `username`, `avatar_icon`, `created_at`. Checked every anonymous read of `profiles` first, because a column-level revoke turns `select('*')` into a 403: all of them name their columns, and the only `select('*')` is `fetchProfile`, which runs signed in. (2) **`anon` and `authenticated` held INSERT/UPDATE/DELETE on the four tables whose every write goes through a SECURITY DEFINER RPC** - RLS default-deny was the only thing between an anonymous request and an INSERT into the moderation log. Same argument as migration 26, except that on the write side the accident forges audit entries rather than leaking reads. `authenticated` keeps DELETE on `wiki_revisions`, which `moderators delete revisions` needs. |
| 28 | 20260910121049 | `v4_slug_cannot_be_empty` | A page with an empty slug routes to `/wiki/page/` and cannot be opened by anyone, its author included. One exists, and nothing prevented a second: neither `slugify()` helper can return empty - both fall back to `'untitled'` - so the only way in is clearing the slug field by hand in the builder, which had no guard. **NOT VALID** on purpose: the existing row is somebody's page and repairing it is their call, so this binds every new write and leaves that row alone. Its owner cannot save that page again until they give it a slug, which is the repair rather than a new obstacle - it is already unopenable - and the builder now says so in words before the database has to. `btrim`, because `'   '` is not a slug either. **Superseded by migration 30:** `NOT VALID` had a consequence nobody had thought through, and the constraint is ordinary now. |
| 29 | 20260910152612 | `v4_plain_punctuation_in_the_rate_limit_message` | `submit_proposal`'s rate-limit refusal was the only string in the whole schema carrying an em dash, and it is one a contributor actually reads. Typographic dashes were removed from everything that ships, so live had to follow or the consolidated file would stop matching the database it claims to describe. Body otherwise identical to migration 23. |
| 30 | 20260911034212 | `v4_give_the_slugless_page_an_address` | Migration 28's `NOT VALID` left one row stuck for everyone. A `NOT VALID` check is still evaluated on **every** update of the offending row, not only on updates touching the column - so `admin_set_page_status`, which never sets `slug`, raised `23514` on it, and a maintainer could no longer archive, publish or move that page from `/wiki/admin`. `merge_proposal` is the same shape. Compounding it, the new bundle sets `autoSlug = false`, so the owner could no longer fix it by typing a title either. The row was empty - no slug, no title, no sections, no linked cards, one revision which is its own creation - so it was given an address rather than deleted: nothing to preserve, nothing to destroy, and both the owner and maintainers get control back. With no violating row left, `slug_not_empty` is **validated** and stops being an exception. Targeted by predicate rather than a hardcoded id, so it is idempotent. |
| 31 | 20260911050856 | `v4_1b_protect_main` | Phase 1b, applied in the same deploy as the contributor UI that replaces it. An editor can no longer change a page they did not create, publish anything, or touch the shared furniture. `guard_wiki_page_write` holds `wiki_pages` to draft-on-insert and creator-only-on-update, with status moves reserved to a maintainer; `wiki_page_projects`, `wiki_links`, `wiki_page_categories`, `wiki_categories` and the `wiki-images` bucket get the same treatment. What an editor keeps is their own draft and the proposal flow. The file carries an **executable** refusal rather than a warning comment - it raises unless `app.apply_1b` is `'yes'` - so it survives the comment stripping the published copy goes through and cannot be replayed by accident onto a database still serving the old bundle. This migration sets that flag itself, in the same statement, deliberately. Verified 8 of 8 by effect in a rolled-back transaction: an editor still edits their own draft and sends it for review, cannot edit someone else's draft, cannot edit a live page, cannot publish; a maintainer still edits anything; strangers cannot deface links or rename categories. `test-rls-v4.mjs`'s first assertion flipped to a refusal in the same commit, as that file had predicted it would, and fourteen assertions were added for sections 3 and 5 - the identity-card links, the junction tables and the image bucket - which had no coverage at all until an audit pointed out that the half of 1b making "nothing reaches main without a maintainer" true was the untested half. Two of those fourteen exist because a second pass asked what was still missing: overwriting an image in the public bucket, which leaves the object in place and every `img` URL on every page pointing at whatever replaced it, and the card links of section 3, where stapling your own OC onto somebody else's live showcase never touches the page row at all. |
| 32 | 20260911084056 | `v4_title_cannot_be_empty` | A page saved with a blank title rendered a nameless card in the wiki listing, which reads as a rendering fault rather than as somebody's unfinished draft. `slugify()` falls back to `'untitled'` so a slug can never be blank and migration 28 made that a constraint; the title had no equivalent, so clearing the field by hand in the builder was all it took, and one page was in that state. **Named before constrained, deliberately.** Migration 28 shipped the slug version `NOT VALID` and migration 30 had to undo the consequence, so this order is the lesson applied: with no offending row left there is nothing to strand and the constraint is validated immediately, which also means it binds the rows that already existed rather than only new writes. `'Untitled'` rather than a slug-derived guess, because the wiki card already falls back to exactly that word and inventing a name for somebody else's draft is worse than admitting it has none. Targeted by predicate, so it is idempotent. Verified 4 of 4 in a rolled-back transaction, including that a status-only update of the renamed row still works, which is the exact failure migration 30 existed to repair. The builder says so before the database has to, on save and on send-for-review. |
| 33 | 20260911091738 | `v4_smarter_wiki_search` | `search_tsv` has carried weights since it was created - title `A`, subtitle `B`, body `C` - and nothing had ever used them: the client called `websearch_to_tsquery` and took the rows in whatever order they arrived, so a page that mentions a word in passing sorted level with the page named after it. `websearch_to_tsquery` also has no prefix operator, so a half-typed word matched nothing, which in a box that searches on every keystroke is most of the keystrokes. `public.search_wiki_pages(query, kind, memoir_only, limit)` ANDs every token, prefixes the last one (the one still being typed), and orders by `ts_rank_cd`, so a title hit outranks a body hit. When that finds nothing it falls back to a plain `ilike` on the title, which catches a query landing mid-token or one the english dictionary stems away. Tokens are split on anything that is not alphanumeric, so a query can never carry tsquery syntax into `to_tsquery`. **SECURITY INVOKER, deliberately**: it reads `wiki_pages` as the caller so RLS still decides which rows exist, and a definer version would publish every draft on the site to anyone who could guess a word in one. `test-rls-v4.mjs` asserts exactly that, along with the prefix behaviour and the operator handling. |

## Phase 1b

`supabase/v4-1b-protect-main.sql` is **applied**, as migration 31, in the same
deploy as the contributor UI that replaces it. It removes every editor's
ability to edit a page they did not create, so on its own - against a site
still serving the old bundle - it would have stranded 51 editors with nowhere
to go. That is why it sat unapplied through Phases 1a to 3, and why its
refusal is executable rather than a comment.

It is **not** in `supabase/v4-migration.sql`, and live and that file therefore
differ on this one point on purpose. The consolidated file describes the
database a fresh instance should start from: the frontend has to be up before
the lock makes sense. Run that file, deploy, then apply 1b as its own step
with `set app.apply_1b = 'yes';` ahead of it.

**That divergence has a trap in it, and it is the read-trail defect inverted.**
Ten of the twelve policies 1b drops are v3's, and `v4-migration.sql` never
creates any of them, so replaying it cannot resurrect them. The other two are
the exception: `wiki images editors update` and `wiki images editors delete`
on `storage.objects` are written by **both** files, and both
copies open with `drop policy if exists`. So a replay of the consolidated file
against a post-1b database does not sit alongside 1b's versions the way the
stale read-trail policy did - it replaces them, and every editor gets update
and delete over every other editor's uploaded image back. Nothing raises.
Verified by reading both files rather than by replaying anything, because the
catalogue diff cannot see it either: a `drop` and a `create` of the same name
leave the policy present before and after, and only its *body* changed. Since
the file's stated method is "replay it into a transaction and diff", this is
written down where whoever does that will read it first. Both files now carry
the warning.

**Replaying v3's `supabase/migration.sql` is a different hazard, and a louder
one.** That file creates all twelve of the policies 1b drops, but its section 0
drops every public table first, so the ten table policies go with their tables
rather than sitting alongside 1b's. It has no `drop policy if exists` for the
two `wiki-images` policies, so it halts on `42710 policy already exists` -
after section 0 has already deleted every table and every account. Loud,
catastrophic and self-halting rather than silent, which is why it is a note
here and not a redesign. It now refuses to run at all on a project that has
any accounts, for the same reason 1b does: its `!!! DESTRUCTIVE` banner was a
comment, and comments do not survive into the published copy.

Its state machine is verified by **`supabase/verify-1b-state-machine.sql`**,
which applies 1b inside a transaction, exercises it as real roles, reports, and
rolls back by raising. Last run 2026-09-10: **17 of 17 landed where intended.**
Re-run it if 1b changes. The SQL used to exist only in a session that ended,
which is why this file previously said to write it fresh.

One thing that script had to get right, and got wrong first: **RLS filters, it
does not raise.** An UPDATE or DELETE no policy admits touches zero rows and
reports success, so treating "no exception" as "allowed" produced four false
passes - a stranger editing a draft, an author deleting a live page, a stranger
deleting links, a stranger renaming every category - all of which are in fact
blocked. Every case now asks what actually happened, and an exception or a zero
row count both count as blocked. It is the same mistake this file records
against the first version of `test-rls-v4.mjs`.

`1b` protects `wiki_pages` and `wiki_page_projects` in sections 1-3, and its
section 5 covers `wiki_links`, `wiki_page_categories`, `wiki_categories` and
the `wiki-images` bucket. An earlier note in this file said section 5 was
missing and that those surfaces still needed the same treatment; that note
predated section 5 being written and is no longer true.

## Verification

`node scripts/test-rls-v4.mjs` - 107 assertions against the live database.
`node --experimental-strip-types scripts/test-rebase.ts` - 49 assertions, no
database. The three-way merge is the one pure piece of the rebase flow and the
one where a wrong answer destroys an author's work silently; everything else
in that flow is a question asked of a person.
`node scripts/test-admin-panel.mjs` - 54 assertions against the live database.

The two database suites cover who is refused *and* what someone allowed can
actually reach; the first version only tested refusals, and the two worst
defects found in review involved no refusal at all. `test-rebase.ts` is a pure
unit test and does neither - it tests the merge, which is the one piece of
that flow with no person in the loop.

## Expected advisor warnings

Checked 2026-09-10, and every one is expected:

- **14 × `authenticated_security_definer_function_executable`**, one per RPC.
  They exist to be called by signed-in users and each authorises internally;
  the test script asserts every one of those refusals rather than assuming it.
- **2 × `anon_security_definer_function_executable`** - `page_contributors`
  and `record_page_view`. Both are deliberate, and granting `anon` EXECUTE on
  the second was the point of migration 19: the body no-ops for a null uid,
  but without the grant the call 403'd before reaching that branch.
  `page_contributors` returns who and how many, never content, and only for a
  page that is already published.
- **1 × `auth_leaked_password_protection`**, unrelated: this project is
  Discord OAuth only and has no passwords.

## Known gaps, not yet addressed

- **The read trail is closed at the API, but 51 of 60 members are editors**
  (plus the admin, so 52 of 60 can edit).
  After both layers, anonymous access is gone and the opt-out genuinely
  prevents recording - but for a member who leaves it on (the default), their
  reading is still visible to every other signed-in member, which is most of
  the server. Only the opt-out addresses "who saw that I read this".
- **`profiles.show_read_receipts` is itself world-readable**, because
  `profiles readable by anyone` grants the whole row. Whether someone has the
  trail switched off is public; what they read is not. Hiding the flag would
  need column-level grants, which would break `select('*')` in `fetchProfile`.
- **A moderator's Activity tab under-counts once anyone opts out.** Those rows
  are deleted, not hidden, and there is deliberately no maintainer bypass -
  the brigading signal degrades by exactly as much as the privacy promise is
  worth. The tab now says so on screen rather than only here.
- **A view can still race in behind an opt-out.** `record_page_view` reads the
  flag without a lock, so an insert that began first can land after the purge.
  The policy hides the row from every reader, and opting out again deletes it;
  what is not true is the phrase "the row never exists".
- `stamp_wiki_page` is not `SECURITY DEFINER` and trusts `app.acting_author`.
  No client can set it today (PostgREST cannot set arbitrary `app.*` GUCs,
  `set_config` is not exposed, and no `db-pre-request` hook is configured),
  but adding either would let an editor forge authorship. Do not add a
  pre-request hook, or any RPC that calls `set_config` on caller input,
  without revisiting this.
- `merge_proposal` writes `wiki_links.to_slug` from proposal data. Red links
  are deliberate so slugs are not validated against existing pages, only
  length-bounded, de-duplicated and capped at 500.
- `review_proposal` has no content pin, unlike `merge_proposal`.
- The 1000-row PostgREST ceiling is unhandled in `listAllCards` and
  `listPageActivity`. Fine at 95 cards.
- `wiki_page_proposals.search_text` is a dead column that could be dropped.
- **`banned_reason` is still readable by every signed-in member.** Migration 27
  closed it to `anon` by scoping that role's grant to four columns, but
  `authenticated` keeps table-level SELECT and `profiles readable by anyone` is
  `using (true)` for both roles - so any of the 60 can fetch
  `username, role, banned_reason, banned_by`. Closing it properly means either
  the same column-scoped grant for `authenticated` (which would stop a banned
  member reading their own reason, so the app would need an RPC for that) or
  moving ban bookkeeping to a maintainers-only table.
- **`anon` and `authenticated` still hold table-level INSERT/UPDATE/DELETE on
  the other eight `public` tables.** Nothing is exposed - there is not one
  non-SELECT `anon` policy anywhere in the schema, so every such write is
  default-denied - but it is the same defence-in-depth asymmetry migration 27
  closed on four tables and not the rest.
- **`set_member_role` rewrites `banned_at = now()` whenever `p_role = 'banned'`**,
  which is the behaviour migration 12 removed from `ban_member`. Not reachable
  from the panel, whose role dropdown deliberately omits `banned`, but an admin
  calling the RPC directly rewrites the timestamp row 12 calls evidence.
