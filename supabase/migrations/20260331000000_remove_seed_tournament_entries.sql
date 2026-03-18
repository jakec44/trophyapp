-- Remove all seed tournament entries that auto-enrolled real users.
-- Placeholder/mock data should only come from client-side (ENABLE_MOCK_USERS + getMockTournamentEntries).
-- Seed migrations (tournaments_seed, seed_redfish_mock_users, seed_six_mock_per_tournament) used real profile IDs;
-- this cleanup un-enrolls those users and stops tournament win spam.

DELETE FROM tournament_entries
WHERE id LIKE 'seed-%';
