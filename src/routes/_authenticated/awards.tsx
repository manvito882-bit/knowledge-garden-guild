import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { badgesQuery, myProgressQuery, badgeProgress, conditionLabel, BadgeImage } from "@/lib/rewards";

export const Route = createFileRoute("/_authenticated/awards")({
  head: () => ({
    meta: [
      { title: "Мои награды — Luminary" },
      { name: "description", content: "Значки за просмотренные уроки и сданные домашние задания." },
      { property: "og:title", content: "Мои награды — Luminary" },
      { property: "og:description", content: "Значки за учёбу в онлайн-школе Luminary." },
    ],
  }),
  component: AwardsPage,
});

function AwardsPage() {
  const { data: badges } = useQuery(badgesQuery);
  const { data: progress } = useQuery(myProgressQuery);
  const list = (badges ?? []).map((b) => ({ ...b, ...badgeProgress(b, progress ?? []) }));
  const earned = list.filter((b) => b.earned).length;

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Мои награды</h1>
        <p className="mt-1 text-sm text-muted-foreground">Получено {earned} из {list.length}. Отмечай уроки просмотренными и сдавай домашки — значки откроются сами.</p>
      </div>
      {list.length === 0 && <div className="panel p-6 text-sm text-muted-foreground">Наград пока нет — скоро появятся.</div>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((b) => (
          <div key={b.id} className={`panel flex flex-col items-center p-5 text-center ${b.earned ? "" : "opacity-60"}`}>
            <BadgeImage url={b.image_url} className={`h-24 w-24 rounded-full ${b.earned ? "" : "grayscale"}`} />
            <div className="mt-3 font-bold">{b.title}</div>
            {b.description && <p className="mt-1 text-xs text-muted-foreground">{b.description}</p>}
            <p className="mt-2 text-xs text-muted-foreground">
              {b.threshold} {conditionLabel(b.condition)}{b.courses ? ` · ${b.courses.title}` : ""}
            </p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-tile">
              <div className="h-full bg-primary" style={{ width: `${(b.done / b.threshold) * 100}%` }} />
            </div>
            <span className="mt-1 text-xs font-semibold">{b.earned ? "Получено!" : `${b.done} / ${b.threshold}`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
