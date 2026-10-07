import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChatThread, uploadChatFile } from "@/lib/chat";

/** Chat between a student and their curator. `meId` is the viewer. */
export function CuratorChat({ studentId, meId, otherName, disabled }: { studentId: string; meId: string; otherName: string; disabled?: string | undefined }) {
  const qc = useQueryClient();
  const key = ["curator-msgs", studentId];
  const { data } = useQuery({
    queryKey: key,
    refetchInterval: 5000,
    queryFn: async () =>
      (await supabase
        .from("curator_messages")
        .select("id,sender_id,body,created_at,attachment_path,attachment_name")
        .eq("student_id", studentId)
        .order("created_at")).data ?? [],
  });
  return (
    <ChatThread
      empty="Напишите первое сообщение"
      disabled={disabled}
      messages={(data ?? []).map((m) => ({ ...m, mine: m.sender_id === meId, author: m.sender_id === studentId ? otherName : otherName }))}
      onSend={async (body, file) => {
        const att = file ? await uploadChatFile(studentId, file) : {};
        const { error } = await supabase.from("curator_messages").insert({ student_id: studentId, sender_id: meId, body, ...att });
        if (error) throw error;
        qc.invalidateQueries({ queryKey: key });
      }}
    />
  );
}
