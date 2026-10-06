import { queryOptions, useQuery } from "@tanstack/react-query";
import { Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const badgesQuery = queryOptions({
  queryKey: ["badges"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("badges")
      .select("id,title,description,image_url,course_id,condition,threshold,courses(title)")
      .order("created_at");
    if (error) throw error;
    return data;
  },
});

export const myProgressQuery = queryOptions({
  queryKey: ["my-progress"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return [];
    const { data, error } = await supabase
      .from("lesson_progress")
      .select("lesson_id,watched,homework_done,lessons(course_id)")
      .eq("user_id", u.user.id);
    if (error) throw error;
    return data;
  },
});

type Badge = { course_id: string | null; condition: string; threshold: number };
type Prog = { watched: boolean; homework_done: boolean; lessons: { course_id: string } | null };

export function badgeProgress(b: Badge, progress: Prog[]) {
  const rows = progress.filter((p) => !b.course_id || p.lessons?.course_id === b.course_id);
  const done = rows.filter((p) => (b.condition === "homework" ? p.homework_done : p.watched)).length;
  return { done: Math.min(done, b.threshold), earned: done >= b.threshold };
}

export const conditionLabel = (c: string) => (c === "homework" ? "сданных домашек" : "просмотренных уроков");

export function BadgeImage({ url, className = "" }: { url: string | null; className?: string }) {
  const { data } = useQuery({
    queryKey: ["badge-img", url],
    enabled: !!url,
    staleTime: 500_000,
    queryFn: async () => {
      if (!url) return null;
      if (!url.startsWith("storage:")) return url;
      const { data } = await supabase.storage.from("lesson-files").createSignedUrl(url.slice(8), 600);
      return data?.signedUrl ?? null;
    },
  });
  if (!data)
    return (
      <div className={`flex items-center justify-center bg-primary text-primary-foreground ${className}`}>
        <Award className="h-1/2 w-1/2" />
      </div>
    );
  return <img src={data} alt="" className={`object-cover ${className}`} />;
}
