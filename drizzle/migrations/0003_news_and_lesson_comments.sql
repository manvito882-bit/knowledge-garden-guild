CREATE TABLE public.news_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.news_posts TO authenticated;
GRANT ALL ON public.news_posts TO service_role;
ALTER TABLE public.news_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read news" ON public.news_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage news" ON public.news_posts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.lesson_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX lesson_comments_lesson_idx ON public.lesson_comments(lesson_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.lesson_comments TO authenticated;
GRANT ALL ON public.lesson_comments TO service_role;
ALTER TABLE public.lesson_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read comments" ON public.lesson_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Students add comments" ON public.lesson_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authors and admins delete comments" ON public.lesson_comments FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));