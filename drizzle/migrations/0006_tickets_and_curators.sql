CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  status text NOT NULL DEFAULT 'open',
  assignee_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tickets read" ON public.support_tickets FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "tickets create" ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'open' AND assignee_id IS NULL);
CREATE POLICY "tickets admin update" ON public.support_tickets FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX ON public.support_tickets(user_id);
CREATE INDEX ON public.support_tickets(status, updated_at);

ALTER TABLE public.support_messages ADD COLUMN ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE CASCADE;
ALTER TABLE public.support_messages ADD COLUMN attachment_path text;
ALTER TABLE public.support_messages ADD COLUMN attachment_name text;
CREATE INDEX ON public.support_messages(ticket_id, created_at);

-- bump ticket time on new message, reopen resolved ticket when student writes
CREATE OR REPLACE FUNCTION public.touch_ticket() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  if new.ticket_id is not null then
    update public.support_tickets
      set updated_at = now(),
          status = case when not new.from_admin and status = 'resolved' then 'open' else status end
      where id = new.ticket_id;
  end if;
  return new;
end; $$;
CREATE TRIGGER support_messages_touch AFTER INSERT ON public.support_messages FOR EACH ROW EXECUTE FUNCTION public.touch_ticket();

CREATE TABLE public.curator_assignments (
  student_id uuid PRIMARY KEY,
  curator_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.curator_assignments TO authenticated;
GRANT ALL ON public.curator_assignments TO service_role;
ALTER TABLE public.curator_assignments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_curator_of(_curator uuid, _student uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select exists (select 1 from public.curator_assignments where curator_id = _curator and student_id = _student)
$$;

CREATE POLICY "assignments read" ON public.curator_assignments FOR SELECT TO authenticated
  USING (auth.uid() = student_id OR auth.uid() = curator_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "assignments admin" ON public.curator_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.curator_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  body text NOT NULL DEFAULT '',
  attachment_path text,
  attachment_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.curator_messages TO authenticated;
GRANT ALL ON public.curator_messages TO service_role;
ALTER TABLE public.curator_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "curator chat read" ON public.curator_messages FOR SELECT TO authenticated
  USING (auth.uid() = student_id OR public.is_curator_of(auth.uid(), student_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "curator chat write" ON public.curator_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND (auth.uid() = student_id OR public.is_curator_of(auth.uid(), student_id)));
CREATE INDEX ON public.curator_messages(student_id, created_at);

-- curators see their students' profiles and progress; students see their curator's profile
CREATE POLICY "curator reads student profile" ON public.profiles FOR SELECT TO authenticated
  USING (public.is_curator_of(auth.uid(), id) OR public.is_curator_of(id, auth.uid()));
CREATE POLICY "curator reads student progress" ON public.lesson_progress FOR SELECT TO authenticated
  USING (public.is_curator_of(auth.uid(), user_id) OR public.has_role(auth.uid(), 'admin'));

-- admins manage roles
CREATE POLICY "admin reads roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin adds roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin removes roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
GRANT INSERT, DELETE ON public.user_roles TO authenticated;

-- chat attachments: path = <student_id>/<file>
CREATE POLICY "chat files upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-files' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_curator_of(auth.uid(), ((storage.foldername(name))[1])::uuid)));
CREATE POLICY "chat files read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-files' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_curator_of(auth.uid(), ((storage.foldername(name))[1])::uuid)));