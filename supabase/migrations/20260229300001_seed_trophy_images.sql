/* Delete all seed tournament entries (keeps real user entries) */
DELETE FROM tournament_entries WHERE id LIKE 'seed%';
