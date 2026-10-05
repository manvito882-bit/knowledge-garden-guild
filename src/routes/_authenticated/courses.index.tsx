import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PenLine } from "lucide-react";
import { coursesQuery, penColor } from "@/lib/school";

export const Route = createFileRoute("/_authenticated/courses/")({
  head: () => ({
    meta: [
      { title: "Все курсы — Luminary" },
      { name: "description", content: "Каталог курсов онлайн-школы Luminary." },
      { property: "og:title", content: "Все курсы — Luminary" },
      { property: "og:description", content: "Каталог курсов онлайн-школы Luminary." },
    ],
  }),
  component: CoursesPage,
});

function CoursesPage() {
  const { data, isLoading } = useQuery(coursesQuery);
  return (
    <div>
      <h1 className="text-2xl font-bold md:text-3xl">Все курсы</h1>
      <p className="mt-1 text-sm text-muted-foreground">Выбери курс и переходи к урокам</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading && [1, 2, 3].map((i) => <div key={i} className="panel h-44 animate-pulse" />)}
        {data?.map((c) => (
          <Link
            key={c.id}
            to="/courses/$courseId"
            params={{ courseId: c.id }}
            search={{}}
            className="panel flex flex-col p-5 transition-transform hover:-translate-y-0.5"
          >
            <span className="self-start rounded-full bg-tag px-3 py-1 text-xs font-semibold text-tag-foreground">{c.tag}</span>
            <h2 className="mt-4 text-lg font-bold">{c.title}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
            <div className="mt-auto flex items-center justify-between pt-5 text-sm">
              <span className="flex items-center gap-2 font-medium">
                <PenLine className={`h-4 w-4 ${penColor[c.teachers?.color ?? ""] ?? ""}`} />
                {c.teachers?.name}
              </span>
              <span className="rounded-lg bg-tile px-2 py-1 text-xs font-semibold">Уроки · {c.lessons.length}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
