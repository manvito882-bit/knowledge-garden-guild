ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS posts_visibility text NOT NULL DEFAULT 'all';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dm_policy text NOT NULL DEFAULT 'all';

CREATE TABLE public.user_bans (user_id uuid PRIMARY KEY, reason text, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, DELETE ON public.user_bans TO authenticated;
GRANT ALL ON public.user_bans TO service_role;
ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bans admin" ON public.user_bans FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "bans own read" ON public.user_bans FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.is_banned(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.user_bans WHERE user_id = _uid) $$;

CREATE TABLE public.follows (follower_id uuid NOT NULL, following_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (follower_id, following_id), CHECK (follower_id <> following_id));
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follows read" ON public.follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "follows insert" ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id AND NOT public.is_banned(auth.uid()));
CREATE POLICY "follows delete" ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

CREATE OR REPLACE FUNCTION public.are_friends(_a uuid, _b uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.follows WHERE follower_id=_a AND following_id=_b) AND EXISTS (SELECT 1 FROM public.follows WHERE follower_id=_b AND following_id=_a) $$;

CREATE OR REPLACE FUNCTION public.can_see_posts(_viewer uuid, _author uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _viewer = _author OR public.has_role(_viewer,'admin') OR COALESCE((SELECT CASE p.posts_visibility WHEN 'all' THEN true WHEN 'friends' THEN public.are_friends(_viewer,_author) ELSE false END FROM public.profiles p WHERE p.id=_author), true) $$;

CREATE OR REPLACE FUNCTION public.can_message(_sender uuid, _to uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _sender <> _to AND NOT public.is_banned(_sender) AND (public.has_role(_sender,'admin') OR COALESCE((SELECT CASE p.dm_policy WHEN 'all' THEN true WHEN 'friends' THEN public.are_friends(_sender,_to) ELSE false END FROM public.profiles p WHERE p.id=_to), true)) $$;

CREATE TABLE public.communities (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, description text, owner_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communities TO authenticated;
GRANT ALL ON public.communities TO service_role;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comm read" ON public.communities FOR SELECT TO authenticated USING (true);
CREATE POLICY "comm insert" ON public.communities FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id AND NOT public.is_banned(auth.uid()));
CREATE POLICY "comm update" ON public.communities FOR UPDATE TO authenticated USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "comm delete" ON public.communities FOR DELETE TO authenticated USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.community_members (community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE, user_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (community_id, user_id));
GRANT SELECT, INSERT, DELETE ON public.community_members TO authenticated;
GRANT ALL ON public.community_members TO service_role;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cm read" ON public.community_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "cm join" ON public.community_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cm leave" ON public.community_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.posts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), author_id uuid NOT NULL, community_id uuid REFERENCES public.communities(id) ON DELETE CASCADE, body text NOT NULL DEFAULT '', image_path text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX posts_created_idx ON public.posts (created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts read" ON public.posts FOR SELECT TO authenticated USING (community_id IS NOT NULL OR public.can_see_posts(auth.uid(), author_id));
CREATE POLICY "posts insert" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id AND NOT public.is_banned(auth.uid()) AND (community_id IS NULL OR EXISTS (SELECT 1 FROM public.community_members m WHERE m.community_id = posts.community_id AND m.user_id = auth.uid())));
CREATE POLICY "posts delete" ON public.posts FOR DELETE TO authenticated USING (auth.uid() = author_id OR public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.communities c WHERE c.id = posts.community_id AND c.owner_id = auth.uid()));

CREATE TABLE public.post_likes (post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE, user_id uuid NOT NULL, PRIMARY KEY (post_id, user_id));
GRANT SELECT, INSERT, DELETE ON public.post_likes TO authenticated;
GRANT ALL ON public.post_likes TO service_role;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pl read" ON public.post_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "pl insert" ON public.post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pl delete" ON public.post_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.post_comments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE, user_id uuid NOT NULL, body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, DELETE ON public.post_comments TO authenticated;
GRANT ALL ON public.post_comments TO service_role;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pc read" ON public.post_comments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id));
CREATE POLICY "pc insert" ON public.post_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND NOT public.is_banned(auth.uid()) AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id));
CREATE POLICY "pc delete" ON public.post_comments FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.post_reports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE, reporter_id uuid NOT NULL, reason text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'open', created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_reports TO authenticated;
GRANT ALL ON public.post_reports TO service_role;
ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pr insert" ON public.post_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id AND status = 'open');
CREATE POLICY "pr admin" ON public.post_reports FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.direct_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sender_id uuid NOT NULL, recipient_id uuid NOT NULL, body text NOT NULL DEFAULT '', attachment_path text, attachment_name text, read boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX dm_pair_idx ON public.direct_messages (sender_id, recipient_id, created_at);
CREATE INDEX dm_recipient_idx ON public.direct_messages (recipient_id, created_at);
GRANT SELECT, INSERT, UPDATE ON public.direct_messages TO authenticated;
GRANT ALL ON public.direct_messages TO service_role;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dm read" ON public.direct_messages FOR SELECT TO authenticated USING (auth.uid() IN (sender_id, recipient_id));
CREATE POLICY "dm send" ON public.direct_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id AND read = false AND public.can_message(auth.uid(), recipient_id));
CREATE POLICY "dm mark read" ON public.direct_messages FOR UPDATE TO authenticated USING (auth.uid() = recipient_id) WITH CHECK (auth.uid() = recipient_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;

CREATE OR REPLACE FUNCTION public.profile_cards(_ids uuid[]) RETURNS TABLE(id uuid, display_name text, avatar_path text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.display_name, p.avatar_path FROM public.profiles p WHERE p.id = ANY(_ids) AND auth.uid() IS NOT NULL $$;

CREATE OR REPLACE FUNCTION public.search_people(_q text) RETURNS TABLE(id uuid, display_name text, avatar_path text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.display_name, p.avatar_path FROM public.profiles p
  WHERE auth.uid() IS NOT NULL AND p.display_name IS NOT NULL AND (_q = '' OR p.display_name ILIKE '%' || _q || '%')
  ORDER BY p.display_name LIMIT 50 $$;

CREATE OR REPLACE FUNCTION public.social_card(_id uuid) RETURNS TABLE(bio text, followers bigint, following bigint, i_follow boolean, follows_me boolean, can_dm boolean, can_see boolean, banned boolean) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT p.bio FROM public.profiles p WHERE p.id=_id),
    (SELECT count(*) FROM public.follows WHERE following_id=_id),
    (SELECT count(*) FROM public.follows WHERE follower_id=_id),
    EXISTS (SELECT 1 FROM public.follows WHERE follower_id=auth.uid() AND following_id=_id),
    EXISTS (SELECT 1 FROM public.follows WHERE follower_id=_id AND following_id=auth.uid()),
    public.can_message(auth.uid(), _id), public.can_see_posts(auth.uid(), _id), public.is_banned(_id)
  WHERE auth.uid() IS NOT NULL $$;

REVOKE EXECUTE ON FUNCTION public.profile_cards(uuid[]), public.search_people(text), public.social_card(uuid), public.are_friends(uuid,uuid), public.can_see_posts(uuid,uuid), public.can_message(uuid,uuid), public.is_banned(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profile_cards(uuid[]), public.search_people(text), public.social_card(uuid), public.are_friends(uuid,uuid), public.can_see_posts(uuid,uuid), public.can_message(uuid,uuid), public.is_banned(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_dm() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications(user_id, title, body, link)
  VALUES (NEW.recipient_id, 'Новое сообщение от ' || COALESCE((SELECT display_name FROM public.profiles WHERE id=NEW.sender_id),'ученика'), left(NEW.body, 120), '/messages?to=' || NEW.sender_id);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_dm AFTER INSERT ON public.direct_messages FOR EACH ROW EXECUTE FUNCTION public.notify_dm();

CREATE OR REPLACE FUNCTION public.notify_follow() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications(user_id, title, link)
  VALUES (NEW.following_id, COALESCE((SELECT display_name FROM public.profiles WHERE id=NEW.follower_id),'Ученик') || ' подписался на вас', '/u/' || NEW.follower_id);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_follow AFTER INSERT ON public.follows FOR EACH ROW EXECUTE FUNCTION public.notify_follow();
REVOKE EXECUTE ON FUNCTION public.notify_dm(), public.notify_follow() FROM PUBLIC, anon, authenticated;

CREATE POLICY "post images read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'post-images');
CREATE POLICY "post images upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'post-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "post images delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'post-images' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));