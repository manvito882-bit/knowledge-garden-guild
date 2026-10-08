create or replace function public.student_card(_id uuid)
returns table(id uuid, display_name text, avatar_path text, created_at timestamptz, is_curator boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.avatar_path, p.created_at, public.has_role(p.id, 'curator')
  from public.profiles p where p.id = _id and auth.uid() is not null
$$;

create or replace function public.student_progress(_id uuid)
returns table(course_id uuid, watched boolean, homework_done boolean)
language sql stable security definer set search_path = public as $$
  select l.course_id, lp.watched, lp.homework_done
  from public.lesson_progress lp join public.lessons l on l.id = lp.lesson_id
  where lp.user_id = _id and auth.uid() is not null
$$;

create or replace function public.leaderboard()
returns table(id uuid, display_name text, avatar_path text, watched bigint, homework bigint, score bigint)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.avatar_path,
    count(*) filter (where lp.watched), count(*) filter (where lp.homework_done),
    count(*) filter (where lp.watched) + 2 * count(*) filter (where lp.homework_done)
  from public.profiles p join public.lesson_progress lp on lp.user_id = p.id
  where auth.uid() is not null
  group by p.id having count(*) filter (where lp.watched or lp.homework_done) > 0
  order by 6 desc, 5 desc limit 50
$$;

revoke execute on function public.student_card(uuid), public.student_progress(uuid), public.leaderboard() from public, anon;
grant execute on function public.student_card(uuid), public.student_progress(uuid), public.leaderboard() to authenticated;

create policy "avatar read school members" on storage.objects for select to authenticated using (bucket_id = 'avatars');