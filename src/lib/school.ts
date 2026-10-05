import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const teachersQuery = queryOptions({
  queryKey: ["teachers"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("teachers")
      .select("id,name,color,position,courses(id,title)")
      .order("position");
    if (error) throw error;
    return data;
  },
});

export const coursesQuery = queryOptions({
  queryKey: ["courses"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("courses")
      .select("id,title,tag,description,teachers(name,color),lessons(id)")
      .order("created_at");
    if (error) throw error;
    return data;
  },
});

export const courseQuery = (id: string) =>
  queryOptions({
    queryKey: ["course", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id,title,tag,description,teachers(name),lessons(id,number,title,starts_at,video_url,lesson_files(id,kind,name,url))")
        .eq("id", id)
        .single();
      if (error) throw error;
      data.lessons.sort((a, b) => a.number - b.number);
      return data;
    },
  });

export const scheduleQuery = queryOptions({
  queryKey: ["schedule"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("lessons")
      .select("id,number,title,starts_at,course_id,courses(title,tag)")
      .order("starts_at");
    if (error) throw error;
    return data;
  },
});

export const likesQuery = (lessonId: string) =>
  queryOptions({
    queryKey: ["likes", lessonId],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { count } = await supabase
        .from("lesson_likes")
        .select("*", { count: "exact", head: true })
        .eq("lesson_id", lessonId);
      const { data: mine } = await supabase
        .from("lesson_likes")
        .select("lesson_id")
        .eq("lesson_id", lessonId)
        .eq("user_id", u.user?.id ?? "")
        .maybeSingle();
      return { count: count ?? 0, liked: !!mine };
    },
  });

export const newsQuery = queryOptions({
  queryKey: ["news"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("news_posts")
      .select("id,title,body,created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const commentsQuery = (lessonId: string) =>
  queryOptions({
    queryKey: ["comments", lessonId],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("lesson_comments")
        .select("id,user_id,author_name,body,created_at")
        .eq("lesson_id", lessonId)
        .order("created_at");
      if (error) throw error;
      return { comments: data, me: u.user?.id ?? "" };
    },
  });

export const penColor: Record<string, string> = {
  lime: "text-pen-lime",
  orange: "text-pen-orange",
  teal: "text-pen-teal",
  blue: "text-pen-blue",
};

export function fmtDate(iso: string) {
  const d = new Date(iso);
  return {
    short: d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }),
    time: d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
    long: d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" }),
  };
}
