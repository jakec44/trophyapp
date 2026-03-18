# Finding users in Supabase

Name and username live in the **profiles** table, not in Authentication. Use this to tell who’s who.

## Where to look

1. **Table Editor → `profiles`**
   - **`name`** = display name (e.g. `jakec`)
   - **`username`** = handle (e.g. `user_jakec44`)
   - **`id`** = same as the user’s ID in Authentication

To find yourself (jakec / user_jakec44):

- Filter **username** = `user_jakec44`, or  
- Filter **name** = `jakec`

That row’s **id** is your auth user id. You can copy it and use it in the rest of the dashboard (e.g. to find the same user under Authentication).

## Linking to Authentication

- **Authentication → Users** lists users by **email** and **User UID**.
- **User UID** in that list = **id** in `profiles`.
- So: find the profile by name/username in `profiles` → take its `id` → in Authentication → Users, find the user with that same UID (or search by that id if the UI allows).

## Quick reference

| What you see in the app | Where in Supabase |
|-------------------------|-------------------|
| Display name (e.g. jakec) | `profiles.name` and `profiles.display_name` |
| Username (e.g. user_jakec44) | `profiles.username` |
| Same user in Auth | `profiles.id` = Authentication user’s **User UID** |
