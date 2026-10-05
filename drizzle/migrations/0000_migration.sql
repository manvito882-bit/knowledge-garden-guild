
create type public.app_role as enum ('admin','user');

create table public.profiles (
  id uuid primary key,
  display_name text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default 'lime',
  position int not null default 0
);
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  title text not null,
  tag text not null,
  description text,
  created_at timestamptz not null default now()
);
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  number int not null,
  title text not null,
  starts_at timestamptz not null,
  video_url text
);
create table public.lesson_files (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  kind text not null default 'material',
  name text not null,
  url text
);
create table public.lesson_likes (
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (lesson_id, user_id)
);

grant select on public.teachers, public.courses, public.lessons, public.lesson_files to authenticated;
grant insert, update, delete on public.teachers, public.courses, public.lessons, public.lesson_files to authenticated;
grant select, insert, delete on public.lesson_likes to authenticated;
grant all on public.teachers, public.courses, public.lessons, public.lesson_files, public.lesson_likes to service_role;

alter table public.teachers enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_files enable row level security;
alter table public.lesson_likes enable row level security;

create policy "read teachers" on public.teachers for select to authenticated using (true);
create policy "read courses" on public.courses for select to authenticated using (true);
create policy "read lessons" on public.lessons for select to authenticated using (true);
create policy "read files" on public.lesson_files for select to authenticated using (true);
create policy "admin teachers" on public.teachers for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "admin courses" on public.courses for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "admin lessons" on public.lessons for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "admin files" on public.lesson_files for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "read likes" on public.lesson_likes for select to authenticated using (true);
create policy "own like insert" on public.lesson_likes for insert to authenticated with check (auth.uid() = user_id);
create policy "own like delete" on public.lesson_likes for delete to authenticated using (auth.uid() = user_id);

-- seed
insert into public.teachers (id,name,color,position) values
('11111111-0000-0000-0000-000000000001','Маша Птипца','lime',1),
('11111111-0000-0000-0000-000000000002','Оксана Кудлай','lime',2),
('11111111-0000-0000-0000-000000000003','Легион Ильича','orange',3),
('11111111-0000-0000-0000-000000000004','ЛАМАРК','teal',4),
('11111111-0000-0000-0000-000000000005','ХИМФАК','blue',5),
('11111111-0000-0000-0000-000000000006','Информатика','blue',6);

insert into public.courses (id,teacher_id,title,tag,description) values
('22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','Курс Маша Птипца 2027 ЕГЭ','русский язык · ЕГЭ 2027','Полная подготовка к ЕГЭ по русскому языку: задания 1–27 и итоговое сочинение.'),
('22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000002','Обществознание с нуля','обществознание · ЕГЭ 2027','Теория, практика и разбор каждого задания.'),
('22222222-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000004','Биология: годовой курс','биология · ЕГЭ 2027','Ботаника, зоология, анатомия и генетика.'),
('22222222-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000005','Химия на 100','химия · ЕГЭ 2027','Органика, неорганика и расчётные задачи.');

insert into public.lessons (id,course_id,number,title,starts_at) values
('33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001',1,'Установочный стрим. Задание 4','2026-09-14 15:00+00'),
('33333333-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000001',2,'Задание 5. Паронимы','2026-09-16 13:00+00'),
('33333333-0000-0000-0000-000000000003','22222222-0000-0000-0000-000000000001',3,'Что такое ИС? Структура экзамена, критерии, примеры','2026-09-19 13:00+00'),
('33333333-0000-0000-0000-000000000004','22222222-0000-0000-0000-000000000001',4,'Задание 6. Плеоназмы, тавтология','2026-09-21 15:00+00'),
('33333333-0000-0000-0000-000000000005','22222222-0000-0000-0000-000000000001',5,'Задание 7. Грамматические нормы. Часть 1','2026-09-23 15:00+00'),
('33333333-0000-0000-0000-000000000006','22222222-0000-0000-0000-000000000001',6,'ИС2: Разбираем универсальное произведение','2026-09-26 13:00+00'),
('33333333-0000-0000-0000-000000000007','22222222-0000-0000-0000-000000000001',7,'Задание 7. Грамматические нормы. Часть 2','2026-09-28 15:00+00'),
('33333333-0000-0000-0000-000000000008','22222222-0000-0000-0000-000000000001',8,'Задание 8. Часть 1','2026-09-30 13:00+00'),
('33333333-0000-0000-0000-000000000009','22222222-0000-0000-0000-000000000001',9,'Практика. Задания 4–8','2026-10-07 13:00+00'),
('33333333-0000-0000-0000-000000000010','22222222-0000-0000-0000-000000000002',1,'Человек и общество','2026-09-15 15:00+00'),
('33333333-0000-0000-0000-000000000011','22222222-0000-0000-0000-000000000002',2,'Экономика: спрос и предложение','2026-09-22 15:00+00'),
('33333333-0000-0000-0000-000000000012','22222222-0000-0000-0000-000000000003',1,'Клетка: строение и функции','2026-09-17 14:00+00'),
('33333333-0000-0000-0000-000000000013','22222222-0000-0000-0000-000000000004',1,'Строение атома','2026-09-18 14:00+00');

insert into public.lesson_files (lesson_id,kind,name) values
('33333333-0000-0000-0000-000000000003','material','Список литературы'),
('33333333-0000-0000-0000-000000000003','material','Обязательно к прочтению'),
('33333333-0000-0000-0000-000000000003','material','Конспект'),
('33333333-0000-0000-0000-000000000003','homework','ДЗ_ИС_1'),
('33333333-0000-0000-0000-000000000001','material','Конспект'),
('33333333-0000-0000-0000-000000000001','homework','ДЗ_задание_4');
