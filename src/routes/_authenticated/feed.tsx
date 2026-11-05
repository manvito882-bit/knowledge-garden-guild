import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Composer, Feed } from "@/lib/social";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({
    meta: [
      { title: "Лента — Luminary" },
      { name: "description", content: "Посты учеников онлайн-школы Luminary." },
      { property: "og:title", content: "Лента — Luminary" },
      { property: "og:description", content: "Делитесь успехами и общайтесь с другими учениками." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FeedPage,
});

function FeedPage() {
  const [tab, setTab] = useState<"all" | "following">("all");
  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-8">
      <h1 className="text-2xl font-bold md:text-3xl">Лента</h1>
      <Composer />
      <div className="flex gap-2">
        {([["all", "Все ученики"], ["following", "Мои подписки"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === k ? "bg-primary text-primary-foreground" : "border bg-card"}`}>{l}</button>
        ))}
      </div>
      <Feed scope={{ kind: tab }} empty={tab === "following" ? "Подпишитесь на учеников, чтобы видеть их посты здесь." : "Пока нет постов. Напишите первый!"} />
    </div>
  );
}
