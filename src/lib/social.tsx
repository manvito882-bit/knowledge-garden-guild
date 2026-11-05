import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Flag, Heart, ImagePlus, MessageCircle, Send, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { avatarQuery } from "@/lib/profile";
import { meQuery } from "@/lib/chat";
import { isAdminQuery } from "@/lib/admin";

export type Card = { id: string; display_name: string | null; avatar_path: string | null };

export async function fetchCards(ids: string[]) {
  const uniq = [...new Set(ids)];
  if (!uniq.length) return new Map<string, Card>();
  const { data, error } = await supabase.rpc("profile_cards", { _ids: uniq });
  if (error) throw error;
  return new Map((data ?? []).map((c) => [c.id, c as Card]));
}

export function initials(name: string | null | undefined) {
  return (name || "У").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

export function Avatar({ card, size = "h-10 w-10" }: { card?: Card | null | undefined; size?: string }) {
  const url = useQuery(avatarQuery(card?.avatar_path));
  return url.data ? (
    <img src={url.data} alt={card?.display_name ?? ""} className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <div className={`${size} flex shrink-0 items-center justify-center rounded-full bg-lilac text-xs font-bold text-lilac-foreground`}>
      {initials(card?.display_name)}
    </div>
  );
}

export type FeedScope = { kind: "all" } | { kind: "following" } | { kind: "community"; id: string } | { kind: "author"; id: string };

export const feedQuery = (scope: FeedScope) =>
  queryOptions({
    queryKey: ["feed", scope],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const me = auth.user?.id ?? "";
      let q = supabase.from("posts").select("id,author_id,community_id,body,image_path,created_at").order("created_at", { ascending: false }).limit(50);
      if (scope.kind === "community") q = q.eq("community_id", scope.id);
      else if (scope.kind === "author") q = q.eq("author_id", scope.id).is("community_id", null);
      else if (scope.kind === "following") {
        const { data: f } = await supabase.from("follows").select("following_id").eq("follower_id", me);
        q = q.in("author_id", [me, ...(f ?? []).map((r) => r.following_id)]).is("community_id", null);
      } else q = q.is("community_id", null);
      const { data: posts, error } = await q;
      if (error) throw error;
      const ids = (posts ?? []).map((p) => p.id);
      const [likes, comments] = await Promise.all([
        ids.length ? supabase.from("post_likes").select("post_id,user_id").in("post_id", ids) : Promise.resolve({ data: [] as { post_id: string; user_id: string }[] }),
        ids.length ? supabase.from("post_comments").select("id,post_id,user_id,body,created_at").in("post_id", ids).order("created_at") : Promise.resolve({ data: [] as { id: string; post_id: string; user_id: string; body: string; created_at: string }[] }),
      ]);
      const cards = await fetchCards([...(posts ?? []).map((p) => p.author_id), ...(comments.data ?? []).map((c) => c.user_id)]);
      return (posts ?? []).map((p) => ({
        ...p,
        author: cards.get(p.author_id) ?? null,
        likes: (likes.data ?? []).filter((l) => l.post_id === p.id).length,
        liked: (likes.data ?? []).some((l) => l.post_id === p.id && l.user_id === me),
        comments: (comments.data ?? []).filter((c) => c.post_id === p.id).map((c) => ({ ...c, author: cards.get(c.user_id) ?? null })),
      }));
    },
  });

export type Post = Awaited<ReturnType<NonNullable<ReturnType<typeof feedQuery>["queryFn"]>>>[number];

function PostImage({ path }: { path: string }) {
  const q = useQuery({
    queryKey: ["post-image", path],
    staleTime: 500_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("post-images").createSignedUrl(path, 600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  return q.data ? <img src={q.data} alt="" className="mt-3 max-h-[480px] w-full rounded-xl object-cover" /> : <div className="mt-3 h-56 animate-pulse rounded-xl bg-tile" />;
}

export function Composer({ communityId, placeholder = "Что нового?" }: { communityId?: string; placeholder?: string }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const submit = async () => {
    if ((!text.trim() && !file) || busy) return;
    if (file && file.size > 10 * 1024 * 1024) return toast.error("Картинка больше 10 МБ");
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user!.id;
      let image_path: string | null = null;
      if (file) {
        image_path = `${uid}/${crypto.randomUUID()}.${file.name.split(".").pop() ?? "jpg"}`;
        const up = await supabase.storage.from("post-images").upload(image_path, file);
        if (up.error) throw up.error;
      }
      const { error } = await supabase.from("posts").insert({ author_id: uid, body: text.trim(), image_path, community_id: communityId ?? null });
      if (error) throw error;
      setText(""); setFile(null);
      qc.invalidateQueries({ queryKey: ["feed"] });
    } catch (e) {
      toast.error("Не опубликовалось: " + (e as Error).message);
    }
    setBusy(false);
  };
  return (
    <div className="panel p-4">
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} rows={3} maxLength={3000}
        className="w-full resize-none rounded-xl border bg-tile px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
      {file && <div className="mt-2 flex items-center justify-between rounded-xl bg-tile px-3 py-1.5 text-xs"><span className="truncate">🖼 {file.name}</span><button onClick={() => setFile(null)} aria-label="Убрать"><X className="h-3.5 w-3.5" /></button></div>}
      <div className="mt-2 flex justify-between">
        <button onClick={() => ref.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl border bg-card px-3 py-2 text-sm text-muted-foreground"><ImagePlus className="h-4 w-4" /> Фото</button>
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        <button onClick={submit} disabled={busy} className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">{busy ? "Публикуем…" : "Опубликовать"}</button>
      </div>
    </div>
  );
}

export function PostCard({ post, canModerate }: { post: Post; canModerate?: boolean }) {
  const { data: me } = useQuery(meQuery);
  const { data: isAdmin } = useQuery(isAdminQuery);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["feed"] });
  const mine = me?.id === post.author_id;

  const like = async () => {
    if (!me?.id) return;
    const r = post.liked
      ? await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", me.id)
      : await supabase.from("post_likes").insert({ post_id: post.id, user_id: me.id });
    if (r.error) toast.error(r.error.message); else refresh();
  };
  const remove = async () => {
    if (!confirm("Удалить пост?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) toast.error(error.message); else { if (post.image_path) await supabase.storage.from("post-images").remove([post.image_path]); refresh(); }
  };
  const reportPost = async () => {
    const reason = prompt("Почему вы жалуетесь на этот пост?");
    if (reason === null || !me?.id) return;
    const { error } = await supabase.from("post_reports").insert({ post_id: post.id, reporter_id: me.id, reason: reason.slice(0, 500) });
    if (error) toast.error(error.message); else toast.success("Жалоба отправлена модераторам");
  };
  const sendComment = async () => {
    if (!comment.trim() || !me?.id) return;
    const { error } = await supabase.from("post_comments").insert({ post_id: post.id, user_id: me.id, body: comment.trim().slice(0, 1000) });
    if (error) toast.error("Не отправилось: " + error.message); else { setComment(""); refresh(); }
  };
  const delComment = async (id: string) => {
    const { error } = await supabase.from("post_comments").delete().eq("id", id);
    if (error) toast.error(error.message); else refresh();
  };

  return (
    <article className="panel p-4">
      <div className="flex items-center gap-3">
        <Link to="/u/$userId" params={{ userId: post.author_id }}><Avatar card={post.author} /></Link>
        <div className="min-w-0 flex-1">
          <Link to="/u/$userId" params={{ userId: post.author_id }} className="font-bold hover:underline">{post.author?.display_name || "Ученик"}</Link>
          <p className="text-xs text-muted-foreground">{new Date(post.created_at).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</p>
        </div>
        {(mine || isAdmin || canModerate) && <button onClick={remove} aria-label="Удалить" className="rounded-lg p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
        {!mine && <button onClick={reportPost} aria-label="Пожаловаться" title="Пожаловаться" className="rounded-lg p-2 text-muted-foreground hover:text-destructive"><Flag className="h-4 w-4" /></button>}
      </div>
      {post.body && <p className="mt-3 whitespace-pre-wrap break-words text-sm">{post.body}</p>}
      {post.image_path && <PostImage path={post.image_path} />}
      <div className="mt-3 flex gap-2">
        <button onClick={like} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm ${post.liked ? "bg-like-soft text-like" : "bg-tile"}`}><Heart className={`h-4 w-4 ${post.liked ? "fill-current" : ""}`} /> {post.likes}</button>
        <button onClick={() => setOpen(!open)} className="inline-flex items-center gap-1.5 rounded-xl bg-tile px-3 py-1.5 text-sm"><MessageCircle className="h-4 w-4" /> {post.comments.length}</button>
      </div>
      {open && (
        <div className="mt-3 space-y-2 border-t pt-3">
          {post.comments.map((c) => (
            <div key={c.id} className="flex gap-2">
              <Link to="/u/$userId" params={{ userId: c.user_id }}><Avatar card={c.author} size="h-7 w-7" /></Link>
              <div className="min-w-0 flex-1 rounded-xl bg-tile px-3 py-1.5 text-sm">
                <Link to="/u/$userId" params={{ userId: c.user_id }} className="text-xs font-bold hover:underline">{c.author?.display_name || "Ученик"}</Link>
                <p className="whitespace-pre-wrap break-words">{c.body}</p>
              </div>
              {(c.user_id === me?.id || isAdmin) && <button onClick={() => delComment(c.id)} aria-label="Удалить комментарий" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}
            </div>
          ))}
          <div className="flex gap-2">
            <input value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendComment()} placeholder="Комментарий…"
              className="w-full rounded-xl border bg-tile px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <button onClick={sendComment} aria-label="Отправить" className="rounded-xl bg-primary px-3 text-primary-foreground"><Send className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </article>
  );
}

export function Feed({ scope, canModerate, empty = "Пока нет постов." }: { scope: FeedScope; canModerate?: boolean; empty?: string }) {
  const q = useQuery(feedQuery(scope));
  if (q.isPending) return <div className="panel h-40 animate-pulse" />;
  if (q.isError) return <p className="text-sm text-destructive">Не удалось загрузить посты.</p>;
  if (!q.data.length) return <p className="panel p-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return <div className="space-y-4">{q.data.map((p) => <PostCard key={p.id} post={p} canModerate={canModerate} />)}</div>;
}

export const socialCardQuery = (id: string) =>
  queryOptions({
    queryKey: ["social-card", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("social_card", { _id: id });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
