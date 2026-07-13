-- Let the app insert an issue without inventing a number for it.
--
-- `issues.number` is assigned by the `assign_issue_number` BEFORE INSERT trigger,
-- which takes it from the project's counter under a row lock. The column is
-- therefore NOT NULL with no DEFAULT — and to anything reading the schema (Postgres
-- itself, PostgREST, our generated TypeScript types) that reads as "the caller must
-- supply this". So `createIssue` was forced to send a number it has no business
-- knowing, purely to satisfy a type.
--
-- The default below makes the column optional to every such reader, and the CHECK
-- makes sure the default can never survive: constraints are evaluated AFTER BEFORE
-- ROW triggers, so by the time `number > 0` is tested, the trigger has already
-- replaced the 0 with the real number. If the trigger were ever dropped, every
-- insert would fail loudly on this constraint rather than quietly numbering every
-- issue in the project 0.
--
-- So: a default that is never used, guarded by a constraint that proves it.

alter table public.issues alter column number set default 0;

alter table public.issues
  add constraint issues_number_assigned check (number > 0);
