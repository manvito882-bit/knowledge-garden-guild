import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/chat";
import { CuratorChat } from "@/lib/curator";

export const Route = createFileRoute("/_authenticated/curator")({
  head: () => ({
    meta: [
      { title: "Мой куратор — Luminary" },
      { name: "description", content: "Личный чат с куратором: вопросы по урокам и домашкам." },
      { property: "og:title", content: "Мой куратор — Luminary" },
      { property: "og:description", content: "Личный чат с куратором в онлайн-школе Luminary." },
    ],
  }),
  component: CuratorPage,
});

function CuratorPage() {
  const { data: me } = useQuery(meQuery);
  const { data: curator, isLoading } = useQuery({
    queryKey: ["my-curator", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data: a } = await supabase.from("curator_assignments").select("curator_id").eq("student_id", me!.id!).maybeSingle();
      if (!a) return null;
      const { data: p } = await supabase.from("profiles").select("display_name,email").eq("id", a.curator_id).maybeSingle();
      return { id: a.curator_id, name: p?.display_name ?? p?.email ?? "Куратор" };
    },
  });

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold md:text-3xl">Мой куратор</h1>
      {isLoading || !me?.id ? (
        <div className="panel h-64 animate-pulse" />
      ) : curator ? (
        <>
          <div className="panel flex items-center gap-3 p-4">
            <span className="rounded-full bg-primary p-3 text-primary-foreground"><UserRound className="h-5 w-5" /></span>
            <div>
              <div className="font-bold">{curator.name}</div>
              <div className="text-xs text-muted-foreground">Помогает с уроками, домашками и мотивацией</div>
            </div>
          </div>
          <CuratorChat studentId={me.id} meId={me.id} otherName={curator.name} />
        </>
      ) : (
        <div className="panel p-6 text-sm text-muted-foreground">Куратор пока не назначен. Как только школа закрепит его за вами, здесь появится чат.</div>
      )}
    </div>
  );
}
