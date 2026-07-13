-- Give every issue a distinct position, so the board has somewhere to drop a card.
--
-- `position` is the sort key within a board column, and it is fractional so that
-- dropping a card between two others writes ONE row — the midpoint of its new
-- neighbours — instead of renumbering everything below it.
--
-- That only works if neighbours have DIFFERENT positions. Every issue defaulted to
-- 0, so the midpoint of two cards was 0 as well: drag a card into the middle of a
-- column, and it would compute a new position identical to the old one, write it,
-- change nothing, and snap back. The feature would look haunted.
--
-- The default below is the current epoch as a double: distinct per row, and
-- increasing, so a new issue lands at the bottom of its column — which is where a
-- newly filed issue belongs. `clock_timestamp()` rather than `now()`, because
-- `now()` is the transaction's start time and is identical for every row inserted in
-- the same statement.
--
-- The magnitude (~1.8e9) is deliberate: a double carries about 15-16 significant
-- digits, so there is room for roughly 40 successive halvings of the same gap before
-- two positions become indistinguishable. See `moveIssue` in lib/data/issues.ts.

alter table public.issues
  alter column position set default extract(epoch from clock_timestamp());

-- Existing issues are all sitting on 0. Spread them out in the order they were
-- created, which is the order they are already displayed in.
update public.issues
   set position = extract(epoch from created_at)
 where position = 0;
