create table if not exists public.ai_generation_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  workspace text not null,
  operation_type text not null,
  model text not null,
  quality text,
  dimensions text,
  images_produced integer not null default 1 check (images_produced > 0),
  cost_usd numeric(12, 6),
  cost_source text not null check (cost_source in ('backend_reported', 'official_output_estimate')),
  usage_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_generation_metrics_created_idx
  on public.ai_generation_metrics (created_at desc);

alter table public.ai_generation_metrics enable row level security;

-- Read/write access is intentionally restricted to service-role server functions.
