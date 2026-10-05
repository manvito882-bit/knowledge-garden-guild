import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const isAdminQuery = queryOptions({
  queryKey: ["is-admin"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return false;
    const { data } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
    return !!data;
  },
});

export async function openLessonFile(url: string | null) {
  if (!url) return false;
  if (url.startsWith("storage:")) {
    const { data } = await supabase.storage.from("lesson-files").createSignedUrl(url.slice(8), 600);
    if (!data) return false;
    window.open(data.signedUrl, "_blank");
    return true;
  }
  window.open(url, "_blank");
  return true;
}
