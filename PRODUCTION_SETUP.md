# Production setup

## Supabase

Apply every SQL file in `supabase/migrations` in chronological order. The
onboarding flow requires `20260719_user_onboarding.sql`; durable background AI
jobs require `20260718_ai_generation_jobs.sql`.

In Supabase Authentication, add the final Netlify origin to **Site URL** and
add these redirect URLs:

- `https://YOUR-SITE.netlify.app/onboarding`
- `https://YOUR-DOMAIN/onboarding`

## Stripe live mode

Test and live Stripe objects are separate. In Stripe live mode, create the
three monthly recurring prices and configure the Netlify environment with:

- `STRIPE_MODE=live`
- `STRIPE_SECRET_KEY=sk_live_...`
- `STRIPE_PRICE_STARTER=price_...`
- `STRIPE_PRICE_CREATOR=price_...`
- `STRIPE_PRICE_STUDIO=price_...`
- `STRIPE_WEBHOOK_SECRET=whsec_...`
- `APP_URL=https://YOUR-DOMAIN`

Create a live webhook endpoint at:

`https://YOUR-DOMAIN/api/stripe/webhook`

Subscribe it to:

- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `charge.dispute.created`
- `charge.dispute.closed`

The application refuses to generate paid images in production if billing is
incomplete. It also refuses `STRIPE_MODE=live` with a `sk_test_` key.

Stripe revenue and OpenAI costs are not one shared wallet. Stripe collects the
subscription revenue; OpenAI separately invoices the API owner. The admin
billing dashboard attributes an internal cost to every produced image and
calculates per-user margin as revenue minus Stripe fees minus attributed OpenAI
costs. Set `OPENAI_IMAGE_COST_CENTS` to the current average unit cost in euro
cents and review it whenever model pricing or the exchange rate changes.

## Netlify environment

Configure these additional variables in **Project configuration > Environment
variables**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PULSENOTE_BACKEND_URL`
- `PULSENOTE_APP_TOKEN`
- `ADMIN_EMAILS`
- `OPENAI_IMAGE_COST_CENTS`

Never expose `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, or `PULSENOTE_APP_TOKEN` as `VITE_` variables.

The repository sets `STRIPE_MODE=live` only for Netlify's production context.
Deploy previews and branch deploys use test mode and reject live keys. Scope
test Stripe variables to those contexts if payment testing is needed there.

Netlify automatically sets `NETLIFY=true`, which selects its TanStack Start
adapter and produces `dist/client`. Other environments keep the Nitro Node
adapter, so the existing Render build (`npm ci && npm run build`) and start
command (`npm start`) remain compatible.
