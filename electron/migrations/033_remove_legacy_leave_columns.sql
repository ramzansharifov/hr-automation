-- Final cleanup of the abandoned leave-balance / production-calendar model.
-- Migration 032 removes its permissions, tables and runtime surface first; this
-- follow-up removes the two calculated vacation columns only after all historical
-- vacation data and enterprise snapshots have already been preserved.

ALTER TABLE vacations DROP COLUMN working_days_count;
ALTER TABLE vacations DROP COLUMN entitlement_year;
