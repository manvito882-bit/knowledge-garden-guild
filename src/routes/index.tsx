import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, PlayCircle, FileText, Heart } from "lucide-react";
import cover from "@/assets/lesson-cover.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Luminary — онлайн-школа подготовки к ЕГЭ" },
      { name: "description", content: "Прямые эфиры, записи уроков, конспекты и домашние задания от лучших преподавателей." },
      { property: "og:title", content: "Luminary — онлайн-школа подготовки к ЕГЭ" },
      { property: "og:description", content: "Прямые эфиры, записи уроков, конспекты и домашние задания." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen px-4 py-6 md:px-10">
      <header className="mx-auto flex max-w-6xl items-center justify-between">
        <span className="font-display text-xl font-bold">luminary</span>
        <Link to="/auth" className="rounded-xl bg-card px-4 py-2 text-sm font-semibold border">
          Войти
        </Link>
      </header>

      <main className="mx-auto mt-10 grid max-w-6xl gap-6 md:mt-16 md:grid-cols-2 md:items-center">
        <div>
          <span className="inline-block rounded-full bg-tag px-3 py-1 text-xs font-semibold text-tag-foreground">
            ЕГЭ 2027 · набор открыт
          </span>
          <h1 className="mt-4 font-display text-4xl font-bold leading-tight md:text-6xl">
            Учись у тех, кто сдал на сотку
          </h1>
          <p className="mt-4 max-w-md text-muted-foreground">
            Эфиры, записи, конспекты и домашки — всё по каждому уроку в одном месте.
          </p>
          <Link
            to="/auth"
            className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-4 font-bold text-primary-foreground"
          >
            Начать учиться <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="panel overflow-hidden p-3">
          <img src={cover} width={1280} height={720} alt="Обложка урока" className="aspect-video w-full rounded-2xl object-cover" />
          <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <Feature icon={<PlayCircle className="h-4 w-4" />} label="Эфиры" />
            <Feature icon={<FileText className="h-4 w-4" />} label="Материалы" />
            <Feature icon={<Heart className="h-4 w-4" />} label="Домашки" />
          </div>
        </div>
      </main>
    </div>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-tile px-3 py-3 font-semibold">
      {icon}
      {label}
    </div>
  );
}
