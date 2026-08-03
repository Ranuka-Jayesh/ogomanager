-- Manager Pro: admin security columns for PIN + biometric preference
-- Run in Supabase SQL Editor once.

alter table public.admin
  add column if not exists pin_hash text,
  add column if not exists pin_enabled boolean default false,
  add column if not exists biometric_enabled boolean default false;

comment on column public.admin.pin_hash is 'PBKDF2 hash of login PIN (never plain PIN)';
comment on column public.admin.pin_enabled is 'Allow PIN unlock / login';
comment on column public.admin.biometric_enabled is 'Prefer device biometrics when registered on device';
