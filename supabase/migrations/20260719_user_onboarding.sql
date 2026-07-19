alter table public.profiles
  add column if not exists secondary_role text,
  add column if not exists site_locale text not null default 'fr',
  add column if not exists onboarding_completed boolean not null default false;

-- Normalize labels used by earlier versions before enforcing the canonical
-- four-role model. Unknown legacy values remain readable but force onboarding.
update public.profiles
set role = case lower(trim(role))
  when 'artiste' then 'Dessinateur'
  when 'artist' then 'Dessinateur'
  when 'illustrateur' then 'Dessinateur'
  when 'illustrator' then 'Dessinateur'
  when 'drawer' then 'Dessinateur'
  when 'scenariste' then 'Scénariste'
  when 'scénariste' then 'Scénariste'
  when 'scriptwriter' then 'Scénariste'
  when 'writer' then 'Scénariste'
  when 'createur de contenu' then 'Créateur de contenu'
  when 'créateur de contenu' then 'Créateur de contenu'
  when 'content creator' then 'Créateur de contenu'
  when 'lecteur' then 'Lecteur'
  when 'reader' then 'Lecteur'
  else role
end
where role is not null;

update public.profiles
set secondary_role = case lower(trim(secondary_role))
  when 'artiste' then 'Dessinateur'
  when 'artist' then 'Dessinateur'
  when 'illustrateur' then 'Dessinateur'
  when 'illustrator' then 'Dessinateur'
  when 'drawer' then 'Dessinateur'
  when 'scenariste' then 'Scénariste'
  when 'scénariste' then 'Scénariste'
  when 'scriptwriter' then 'Scénariste'
  when 'writer' then 'Scénariste'
  when 'createur de contenu' then 'Créateur de contenu'
  when 'créateur de contenu' then 'Créateur de contenu'
  when 'content creator' then 'Créateur de contenu'
  when 'lecteur' then 'Lecteur'
  when 'reader' then 'Lecteur'
  else secondary_role
end
where secondary_role is not null;

alter table public.profiles drop constraint if exists profiles_site_locale_check;
alter table public.profiles
  add constraint profiles_site_locale_check check (site_locale in ('fr', 'en'));

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role is null or role in ('Dessinateur', 'Scénariste', 'Créateur de contenu', 'Lecteur'))
  not valid;

alter table public.profiles drop constraint if exists profiles_secondary_role_check;
alter table public.profiles
  add constraint profiles_secondary_role_check
  check (
    secondary_role is null
    or secondary_role in ('Dessinateur', 'Scénariste', 'Créateur de contenu', 'Lecteur')
  ) not valid;

-- Existing configured accounts keep access. New accounts retain the default
-- false value until the onboarding form has been completed.
update public.profiles
set onboarding_completed = true
where onboarding_completed = false
  and role in ('Dessinateur', 'Scénariste', 'Créateur de contenu', 'Lecteur')
  and nullif(trim(username), '') is not null;

create index if not exists profiles_onboarding_completed_idx
  on public.profiles (onboarding_completed);
