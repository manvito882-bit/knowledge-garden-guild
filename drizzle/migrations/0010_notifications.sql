CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notif read" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own notif update" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own notif delete" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

CREATE OR REPLACE FUNCTION public.notify_support_reply() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.from_admin THEN
    INSERT INTO notifications(user_id,title,body,link) VALUES (NEW.user_id,'Ответ техподдержки',left(NEW.body,120),'/support');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_support AFTER INSERT ON public.support_messages FOR EACH ROW EXECUTE FUNCTION public.notify_support_reply();

CREATE OR REPLACE FUNCTION public.notify_curator_msg() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.sender_id <> NEW.student_id THEN
    INSERT INTO notifications(user_id,title,body,link) VALUES (NEW.student_id,'Сообщение от куратора',left(NEW.body,120),'/curator');
  ELSE
    INSERT INTO notifications(user_id,title,body,link)
      SELECT curator_id,'Сообщение от ученика',left(NEW.body,120),'/students' FROM curator_assignments WHERE student_id = NEW.student_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_curator AFTER INSERT ON public.curator_messages FOR EACH ROW EXECUTE FUNCTION public.notify_curator_msg();

CREATE OR REPLACE FUNCTION public.notify_news() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO notifications(user_id,title,body,link) SELECT id,'Новость: '||NEW.title,left(NEW.body,120),'/news' FROM profiles;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_news AFTER INSERT ON public.news_posts FOR EACH ROW EXECUTE FUNCTION public.notify_news();
REVOKE EXECUTE ON FUNCTION public.notify_support_reply(), public.notify_curator_msg(), public.notify_news() FROM PUBLIC, anon, authenticated;