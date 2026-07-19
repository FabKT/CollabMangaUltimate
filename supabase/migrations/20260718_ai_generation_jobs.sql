create table if not exists public.ai_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace text not null,
  endpoint text not null,
  request_payload jsonb not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  result_payload jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists ai_generation_jobs_user_created_idx
  on public.ai_generation_jobs (user_id, created_at desc);

alter table public.ai_generation_jobs enable row level security;

-- The application accesses this table only through its service-role server API.
-- No browser-facing RLS policy is intentionally created.
