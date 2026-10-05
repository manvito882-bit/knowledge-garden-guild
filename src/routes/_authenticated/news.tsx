import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Newspaper } from "lucide-react";
import { newsQuery, fmtDate } from "@/lib/school";

export const Route = createFileRoute("/_authenticated/news")({
  head: () => ({
    meta: [
      { title: "Новости — Luminary" },
      { name: "description", content: "Новости и объявления онлайн-школы Luminary." },
      { property: "og:title", content: "Новости — Luminary" },
      { property: "og:description", content: "Новости и объявления онлайн-школы Luminary." },
    ],
  }),
  component: NewsPage,
});

function NewsPage() {
  const { data: posts, isLoading } = useQuery(newsQuery);

  return (
    <div className="max-w-2xl">
      <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
        <Newspaper className="h-6 w-6" /> Новости школы
      </h1>
      {isLoading ? (
        <div className="panel mt-5 h-64 animate-pulse" />
      ) : posts?.length === 0 ? (
        <div className="panel mt-5 p-6 text-sm text-muted-foreground">Пока нет ни одной новости — загляните позже.</div>
      ) : (
        <div className="mt-5 space-y-4">
          {posts?.map((p) => {
            const f = fmtDate(p.created_at);
            return (
              <article key={p.id} className="panel p-5">
                <time className="text-xs font-semibold text-muted-foreground">
                  {f.long} · {f.time}
                </time>
                <h2 className="mt-1 text-lg font-bold">{p.title}</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{p.body}</p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
