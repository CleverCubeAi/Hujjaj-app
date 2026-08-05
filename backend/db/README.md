# Database (self-hosted)

`schema.sql` is the consolidated PostgreSQL schema for Hujjaj. It replaces the old `supabase/migrations/` set for new installs: no `auth.*`, no RLS, no Storage buckets. Users store `email` + `password_hash` directly.

Apply with:

```bash
npm run migrate
```

(from `backend/`, with `DATABASE_URL` set)
