import { createFileRoute } from "@tanstack/react-router";
import { Mail, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({
    meta: [
      { title: "Поддержка — Luminary" },
      { name: "description", content: "Ответы на частые вопросы и связь с поддержкой." },
      { property: "og:title", content: "Поддержка — Luminary" },
      { property: "og:description", content: "Ответы на частые вопросы и связь с поддержкой." },
    ],
  }),
  component: SupportPage,
});

const faq = [
  ["Где смотреть запись эфира?", "Запись появляется на странице урока через несколько часов после эфира."],
  ["Как сдать домашнее задание?", "Скачай файл в блоке «Домашнее задание», выполни и отправь куратору."],
  ["Можно ли сменить курс?", "Да — напиши в поддержку, и мы всё переключим."],
];

function SupportPage() {
  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold md:text-3xl">Поддержка</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        <a href="mailto:support@luminary.school" className="panel flex items-center gap-3 p-5 font-semibold">
          <Mail className="h-5 w-5" /> support@luminary.school
        </a>
        <a href="https://t.me/" target="_blank" rel="noreferrer" className="panel flex items-center gap-3 p-5 font-semibold">
          <MessageCircle className="h-5 w-5" /> Написать в Telegram
        </a>
      </div>
      <div className="panel space-y-2 p-3">
        {faq.map(([q, a]) => (
          <details key={q} className="rounded-xl bg-tile px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold">{q}</summary>
            <p className="mt-2 text-sm text-muted-foreground">{a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
