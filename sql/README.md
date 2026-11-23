# Database setup

Pak Globe Unified Platform ka active database MySQL 8+ hai. Node/Express runtime `mysql2` ke through `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS` aur `DB_NAME` use karta hai.

Fresh MySQL database setup:

```powershell
npm.cmd run db:setup
```

Existing database par pending/compatible migrations:

```powershell
npm.cmd run db:migrate
```

`schema.sql` base tables create karta hai aur `migrations/` quotation workflow, packages, settings options aur compatibility columns add karta hai. `supabase_full_project.sql` sirf historical PostgreSQL/Supabase reference hai; application us file ko load nahi karti.

Important: Supabase se existing live rows import karne ke liye Supabase ka data export/dump ya credentials required honge. Schema conversion alone remote Supabase data ko automatically copy nahi karta.
