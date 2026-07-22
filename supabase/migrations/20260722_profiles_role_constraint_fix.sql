-- Keep the database constraint aligned with the public onboarding/profile UI.
-- The UI stores the four canonical French labels, while a few legacy rows may
-- still contain older English or unaccented values.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles drop constraint if exists profiles_secondary_role_check;

update public.profiles
set role = case lower(trim(role))
  when 'artiste' then 'Dessinateur'
  when 'artist' then 'Dessinateur'
  when 'illustrateur' then 'Dessinateur'
  when 'illustrator' then 'Dessinateur'
  when 'drawer' then 'Dessinateur'
  when 'dessinnateur' then 'Dessinateur'
  when 'scenariste' then 'Scénariste'
  when 'scriptwriter' then 'Scénariste'
  when 'writer' then 'Scénariste'
  when 'createur de contenu' then 'Créateur de contenu'
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
  when 'dessinnateur' then 'Dessinateur'
  when 'scenariste' then 'Scénariste'
  when 'scriptwriter' then 'Scénariste'
  when 'writer' then 'Scénariste'
  when 'createur de contenu' then 'Créateur de contenu'
  when 'content creator' then 'Créateur de contenu'
  when 'lecteur' then 'Lecteur'
  when 'reader' then 'Lecteur'
  else secondary_role
end
where secondary_role is not null;

alter table public.profiles
  add constraint profiles_role_check
  check (
    role is null
    or role in (
      'Dessinateur',
      'Scénariste',
      'Créateur de contenu',
      'Lecteur',
      'Artist',
      'Writer',
      'Content creator',
      'Reader'
    )
  ) not valid;

alter table public.profiles
  add constraint profiles_secondary_role_check
  check (
    secondary_role is null
    or secondary_role in (
      'Dessinateur',
      'Scénariste',
      'Créateur de contenu',
      'Lecteur',
      'Artist',
      'Writer',
      'Content creator',
      'Reader'
    )
  ) not valid;
