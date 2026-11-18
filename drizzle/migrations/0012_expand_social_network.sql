alter table public.posts
  add column if not exists updated_at timestamptz,
  add column if not exists repost_of uuid references public.posts(id) on delete set null;

alter table public.profiles
  add column if not exists cover_path text,
  add column if not exists links jsonb not null default '[]'::jsonb;

alter table public.communities
  add column if not exists avatar_path text,
  add column if not exists cover_path text,
  add column if not exists rules text,
  add column if not exists links jsonb not null default '[]'::jsonb;

alter table public.community_members
  add column if not exists role text not null default 'member';
alter table public.community_members
  add constraint community_members_role_check check (role in ('owner','moderator','member')) not valid;

create table public.post_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  path text not null,
  position integer not null default 0,
  unique(post_id, path)
);
grant select, insert, delete on public.post_images to authenticated;
grant all on public.post_images to service_role;
alter table public.post_images enable row level security;
create policy "post images read" on public.post_images for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy "post images insert own post" on public.post_images for insert to authenticated
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()) and not public.is_banned(auth.uid()));
create policy "post images delete own or moderated post" on public.post_images for delete to authenticated
  using (exists (
    select 1 from public.posts p
    left join public.communities c on c.id = p.community_id
    left join public.community_members m on m.community_id = p.community_id and m.user_id = auth.uid()
    where p.id = post_id and (p.author_id = auth.uid() or public.has_role(auth.uid(),'admin') or c.owner_id = auth.uid() or m.role = 'moderator')
  ));

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  body text not null,
  position integer not null default 0
);
grant select, insert, delete on public.poll_options to authenticated;
grant all on public.poll_options to service_role;
alter table public.poll_options enable row level security;
create policy "poll options read" on public.poll_options for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy "poll options insert own post" on public.poll_options for insert to authenticated
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()) and not public.is_banned(auth.uid()));
create policy "poll options delete own post" on public.poll_options for delete to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));

create table public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  unique(post_id, user_id)
);
grant select, insert, delete on public.poll_votes to authenticated;
grant all on public.poll_votes to service_role;
alter table public.poll_votes enable row level security;
create policy "poll votes read" on public.poll_votes for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy "poll votes insert" on public.poll_votes for insert to authenticated
  with check (
    auth.uid() = user_id and not public.is_banned(auth.uid())
    and exists (select 1 from public.posts p where p.id = post_id)
    and exists (select 1 from public.poll_options o where o.id = option_id and o.post_id = post_id)
  );
create policy "poll votes delete own" on public.poll_votes for delete to authenticated using (auth.uid() = user_id);

create table public.post_bookmarks (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key(post_id, user_id)
);
grant select, insert, delete on public.post_bookmarks to authenticated;
grant all on public.post_bookmarks to service_role;
alter table public.post_bookmarks enable row level security;
create policy "bookmarks read own" on public.post_bookmarks for select to authenticated using (auth.uid() = user_id);
create policy "bookmarks insert own" on public.post_bookmarks for insert to authenticated
  with check (auth.uid() = user_id and exists (select 1 from public.posts p where p.id = post_id));
create policy "bookmarks delete own" on public.post_bookmarks for delete to authenticated using (auth.uid() = user_id);

create policy "posts update own" on public.posts for update to authenticated
  using (auth.uid() = author_id and not public.is_banned(auth.uid()))
  with check (auth.uid() = author_id and not public.is_banned(auth.uid()));

alter table public.direct_messages
  add column if not exists reply_to uuid references public.direct_messages(id) on delete set null;

create table public.dm_reactions (
  message_id uuid not null references public.direct_messages(id) on delete cascade,
  user_id uuid not null,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key(message_id, user_id, emoji),
  constraint dm_reactions_emoji_length check (char_length(emoji) between 1 and 16)
);
grant select, insert, delete on public.dm_reactions to authenticated;
grant all on public.dm_reactions to service_role;
alter table public.dm_reactions enable row level security;
create policy "dm reactions read participants" on public.dm_reactions for select to authenticated
  using (exists (select 1 from public.direct_messages m where m.id = message_id and (m.sender_id = auth.uid() or m.recipient_id = auth.uid())));
create policy "dm reactions insert participants" on public.dm_reactions for insert to authenticated
  with check (auth.uid() = user_id and not public.is_banned(auth.uid()) and exists (select 1 from public.direct_messages m where m.id = message_id and (m.sender_id = auth.uid() or m.recipient_id = auth.uid())));
create policy "dm reactions delete own" on public.dm_reactions for delete to authenticated using (auth.uid() = user_id);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.conversations to authenticated;
grant all on public.conversations to service_role;
alter table public.conversations enable row level security;

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null,
  last_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key(conversation_id, user_id)
);
grant select, insert, update, delete on public.conversation_members to authenticated;
grant all on public.conversation_members to service_role;
alter table public.conversation_members enable row level security;

create or replace function public.is_conversation_member(_conversation uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversation_members where conversation_id = _conversation and user_id = _user)
$$;
revoke execute on function public.is_conversation_member(uuid,uuid) from public, anon;
grant execute on function public.is_conversation_member(uuid,uuid) to authenticated;

create policy "conversations read members" on public.conversations for select to authenticated
  using (public.is_conversation_member(id, auth.uid()));
create policy "conversations create" on public.conversations for insert to authenticated
  with check (auth.uid() = created_by and not public.is_banned(auth.uid()));
create policy "conversations update creator" on public.conversations for update to authenticated
  using (auth.uid() = created_by) with check (auth.uid() = created_by);

create policy "conversation members read" on public.conversation_members for select to authenticated
  using (public.is_conversation_member(conversation_id, auth.uid()));
create policy "conversation members creator adds" on public.conversation_members for insert to authenticated
  with check (exists (select 1 from public.conversations c where c.id = conversation_id and c.created_by = auth.uid()));
create policy "conversation members leave or creator removes" on public.conversation_members for delete to authenticated
  using (auth.uid() = user_id or exists (select 1 from public.conversations c where c.id = conversation_id and c.created_by = auth.uid()));
create policy "conversation members own read receipt" on public.conversation_members for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null,
  body text not null default '',
  reply_to uuid references public.conversation_messages(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert on public.conversation_messages to authenticated;
grant all on public.conversation_messages to service_role;
alter table public.conversation_messages enable row level security;
create policy "conversation messages read members" on public.conversation_messages for select to authenticated
  using (public.is_conversation_member(conversation_id, auth.uid()));
create policy "conversation messages send members" on public.conversation_messages for insert to authenticated
  with check (auth.uid() = sender_id and not public.is_banned(auth.uid()) and public.is_conversation_member(conversation_id, auth.uid()));

create table public.conversation_message_reactions (
  message_id uuid not null references public.conversation_messages(id) on delete cascade,
  user_id uuid not null,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key(message_id, user_id, emoji),
  constraint conversation_reactions_emoji_length check (char_length(emoji) between 1 and 16)
);
grant select, insert, delete on public.conversation_message_reactions to authenticated;
grant all on public.conversation_message_reactions to service_role;
alter table public.conversation_message_reactions enable row level security;
create policy "conversation reactions read members" on public.conversation_message_reactions for select to authenticated
  using (exists (select 1 from public.conversation_messages m where m.id = message_id and public.is_conversation_member(m.conversation_id, auth.uid())));
create policy "conversation reactions insert members" on public.conversation_message_reactions for insert to authenticated
  with check (auth.uid() = user_id and not public.is_banned(auth.uid()) and exists (select 1 from public.conversation_messages m where m.id = message_id and public.is_conversation_member(m.conversation_id, auth.uid())));
create policy "conversation reactions delete own" on public.conversation_message_reactions for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "cm join" on public.community_members;
create policy "cm join" on public.community_members for insert to authenticated
  with check (auth.uid() = user_id and (role = 'member' or exists (select 1 from public.communities c where c.id = community_id and (c.owner_id = auth.uid() or public.has_role(auth.uid(),'admin')))));
create policy "community owner manages member roles" on public.community_members for update to authenticated
  using (exists (select 1 from public.communities c where c.id = community_id and (c.owner_id = auth.uid() or public.has_role(auth.uid(),'admin'))))
  with check (exists (select 1 from public.communities c where c.id = community_id and (c.owner_id = auth.uid() or public.has_role(auth.uid(),'admin'))));
create policy "community owner removes members" on public.community_members for delete to authenticated
  using (exists (select 1 from public.communities c where c.id = community_id and (c.owner_id = auth.uid() or public.has_role(auth.uid(),'admin'))));
create policy "community moderators delete posts" on public.posts for delete to authenticated
  using (exists (select 1 from public.community_members m where m.community_id = community_id and m.user_id = auth.uid() and m.role = 'moderator'));

create or replace function public.student_profile(_id uuid)
returns table(id uuid, display_name text, avatar_path text, cover_path text, bio text, links jsonb, created_at timestamptz, is_curator boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.avatar_path, p.cover_path, p.bio, p.links, p.created_at, public.has_role(p.id,'curator')
  from public.profiles p where p.id = _id and auth.uid() is not null
$$;
revoke execute on function public.student_profile(uuid) from public, anon;
grant execute on function public.student_profile(uuid) to authenticated;

create or replace function public.notify_group_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications(user_id,title,body,link)
  select m.user_id, 'Новое сообщение в «' || c.title || '»', left(new.body,160), '/messages?chat=' || c.id
  from public.conversation_members m join public.conversations c on c.id = m.conversation_id
  where m.conversation_id = new.conversation_id and m.user_id <> new.sender_id;
  return new;
end;
$$;
revoke execute on function public.notify_group_message() from public, anon, authenticated;
create trigger trg_notify_group_message after insert on public.conversation_messages
for each row execute function public.notify_group_message();

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='direct_messages') then
    alter publication supabase_realtime add table public.direct_messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='conversation_messages') then
    alter publication supabase_realtime add table public.conversation_messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='dm_reactions') then
    alter publication supabase_realtime add table public.dm_reactions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='conversation_message_reactions') then
    alter publication supabase_realtime add table public.conversation_message_reactions;
  end if;
end $$;

create index post_images_post_idx on public.post_images(post_id, position);
create index poll_options_post_idx on public.poll_options(post_id, position);
create index poll_votes_post_idx on public.poll_votes(post_id);
create index conversation_messages_room_idx on public.conversation_messages(conversation_id, created_at);
create index conversation_members_user_idx on public.conversation_members(user_id);
