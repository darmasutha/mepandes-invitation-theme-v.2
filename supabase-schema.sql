-- ============================================================
-- Undangan Mepandes — tabel RSVP & ucapan (Supabase / PostgreSQL)
-- Jalankan di Supabase Dashboard → SQL Editor.
-- ============================================================

-- 1. Tabel ---------------------------------------------------
create table if not exists public.rsvp_comments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null
              check (char_length(btrim(name)) between 1 and 80),
  attendance  text not null
              check (attendance in ('hadir', 'tidak')),
  message     text not null default ''
              check (char_length(message) <= 500),
  created_at  timestamptz not null default now()
);

create index if not exists rsvp_comments_created_at_idx
  on public.rsvp_comments (created_at desc);

-- 2. Row Level Security -------------------------------------
alter table public.rsvp_comments enable row level security;

-- Siapa pun (tamu) boleh membaca ucapan.
drop policy if exists "baca publik" on public.rsvp_comments;
create policy "baca publik"
  on public.rsvp_comments
  for select
  to anon, authenticated
  using (true);

-- Siapa pun (tamu) boleh mengirim konfirmasi.
-- Validasi isi dijaga oleh constraint tabel di atas.
drop policy if exists "kirim publik" on public.rsvp_comments;
create policy "kirim publik"
  on public.rsvp_comments
  for insert
  to anon, authenticated
  with check (true);

-- Hanya akun admin yang boleh menghapus.
-- GANTI email di bawah dengan email akun admin Anda (Supabase Auth).
drop policy if exists "hapus admin" on public.rsvp_comments;
create policy "hapus admin"
  on public.rsvp_comments
  for delete
  to authenticated
  using ((select auth.jwt() ->> 'email') = 'admin@example.com');

-- Tidak ada policy UPDATE: komentar tidak bisa diubah oleh siapa pun
-- lewat API publik.

-- ============================================================
-- Langkah manual di Dashboard (bukan SQL):
-- 1. Authentication → Users → Add user: buat satu akun admin
--    (email + password), centang "Auto Confirm User".
-- 2. Authentication → Sign In / Providers → matikan
--    "Allow new users to sign up" agar tidak ada yang bisa
--    mendaftar sendiri.
-- ============================================================
