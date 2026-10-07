import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const myProfileQuery = queryOptions({
  queryKey: ["my-profile"],
  queryFn: async () => {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!auth.user) throw new Error("Войдите в аккаунт");
    const { data, error } = await supabase.from("profiles")
      .select("id,display_name,avatar_path,created_at").eq("id", auth.user.id).single();
    if (error) throw error;
    return data;
  },
});

export const avatarQuery = (path: string | null | undefined) => queryOptions({
  queryKey: ["avatar", path],
  enabled: Boolean(path),
  staleTime: 500_000,
  refetchInterval: 500_000,
  queryFn: async () => {
    if (!path) return null;
    const { data, error } = await supabase.storage.from("avatars").createSignedUrl(path, 600);
    if (error) throw error;
    return data.signedUrl;
  },
});