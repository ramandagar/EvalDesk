"use client";
import { useState } from "react";
import { createId } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

interface Props {
  projectId: string;
  onSave: (conversationId: string) => void;
}

export function ConversationEditor({ projectId, onSave }: Props) {
  const [title, setTitle] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { id: createId(), role: "user", content: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const addMessage = (role: "user" | "assistant" | "system") => {
    setMessages([...messages, { id: createId(), role, content: "" }]);
  };

  const updateMessage = (id: string, content: string) => {
    setMessages(messages.map(m => m.id === id ? { ...m, content } : m));
  };

  const removeMessage = (id: string) => {
    setMessages(messages.filter(m => m.id !== id));
  };

  const setRole = (id: string, role: "user" | "assistant" | "system") => {
    setMessages(messages.map(m => m.id === id ? { ...m, role } : m));
  };

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title,
          messages: messages.filter(m => m.content.trim()).map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = await res.json();
      onSave(data.id);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const roleColor = (r: string) => r === "user" ? "text-[#4E9363]" : r === "system" ? "text-[#6D75A6]" : "text-[#ABC83A]";

  return (
    <div className="space-y-3">
      <input
        type="text" value={title} onChange={e => setTitle(e.target.value)}
        placeholder="Conversation title..."
        className="w-full px-3 py-2 rounded-lg border border-black/[0.06] dark:border-white/[0.08] bg-transparent text-[13px] text-[#0a0a0a] dark:text-[#f7f8f8] placeholder:text-[#62666d]"
      />

      <div className="space-y-2">
        {messages.map((m, i) => (
          <div key={m.id} className="flex gap-2 items-start">
            <select value={m.role} onChange={e => setRole(m.id, e.target.value as any)}
              className="text-[11px] rounded border border-black/[0.06] dark:border-white/[0.08] bg-transparent px-1.5 py-1">
              <option value="user">User</option>
              <option value="assistant">Assistant</option>
              <option value="system">System</option>
            </select>
            <textarea
              value={m.content} onChange={e => updateMessage(m.id, e.target.value)}
              placeholder={`${m.role} message...`}
              rows={2}
              className="flex-1 px-2 py-1.5 rounded border border-black/[0.06] dark:border-white/[0.08] bg-transparent text-[12px] text-[#0a0a0a] dark:text-[#f7f8f8] placeholder:text-[#62666d] resize-none"
            />
            {messages.length > 1 && (
              <button onClick={() => removeMessage(m.id)} className="text-[10px] text-red-400 hover:text-red-500">x</button>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={() => addMessage("user")} className="text-[11px] text-[#4E9363] hover:underline">+ User</button>
        <button onClick={() => addMessage("assistant")} className="text-[11px] text-[#ABC83A] hover:underline">+ Assistant</button>
        <button onClick={() => addMessage("system")} className="text-[11px] text-[#6D75A6] hover:underline">+ System</button>
        <div className="flex-1" />
        <button onClick={save} disabled={saving || !title.trim()}
          className="btn-primary text-[12px] px-3 py-1.5 disabled:opacity-50">
          {saving ? "Saving..." : "Save Conversation"}
        </button>
      </div>
    </div>
  );
}
