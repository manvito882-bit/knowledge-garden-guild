import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { scheduleQuery, fmtDate } from "@/lib/school";

export const Route = createFileRoute("/_authenticated/schedule")({
  head: () => ({
    meta: [
      { title: "Расписание — Luminary" },
      { name: "description", content: "Расписание эфиров по всем курсам." },
      { property: "og:title", content: "Расписание — Luminary" },
      { property: "og:description", content: "Расписание эфиров по всем курсам." },
    ],
  }),
  component: SchedulePage,
});

function SchedulePage() {
  const { data } = useQuery(scheduleQuery);
  const groups = new Map<string, NonNullable<typeof data>>();
  data?.forEach((l) => {
    const key = new Date(l.starts_at).toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
    groups.set(key, [...(groups.get(key) ?? []), l]);
  });

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold md:text-3xl">Расписание</h1>
      {[...groups].map(([month, items]) => (
        <section key={month} className="mt-6">
          <h2 className="mb-3 text-sm font-semibold capitalize text-muted-foreground">{month}</h2>
          <div className="panel space-y-2 p-3">
            {items.map((l) => {
              const f = fmtDate(l.starts_at);
              return (
                <Link
                  key={l.id}
                  to="/courses/$courseId"
                  params={{ courseId: l.course_id }}
                  search={{ lesson: l.number }}
                  className="flex items-center gap-4 rounded-xl bg-tile px-4 py-3"
                >
                  <div className="w-14 text-center">
                    <div className="text-lg font-bold">{f.short.slice(0, 2)}</div>
                    <div className="text-xs text-muted-foreground">{f.time}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">{l.courses?.tag}</div>
                    <div className="truncate text-sm font-semibold">{l.title}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
