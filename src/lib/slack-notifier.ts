export async function sendSlackNotification(webhookUrl: string, message: {
  title: string;
  passRate?: number;
  runName?: string;
  projectName?: string;
  type: "success" | "regression" | "error";
}) {
  const color = message.type === "success" ? "#4E9363" : message.type === "regression" ? "#dc2626" : "#D97706";
  const emoji = message.type === "success" ? "✅" : message.type === "regression" ? "🔴" : "⚠️";

  const blocks = [
    {
      type: "section",
      text: { type: "mrkdwn", text: `${emoji} *${message.title}*` },
    },
  ];

  const fields: any[] = [];
  if (message.projectName) fields.push({ type: "mrkdwn", text: `*Project:*\n${message.projectName}` });
  if (message.runName) fields.push({ type: "mrkdwn", text: `*Run:*\n${message.runName}` });
  if (message.passRate !== undefined) fields.push({ type: "mrkdwn", text: `*Pass Rate:*\n${message.passRate}%` });

  if (fields.length > 0) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: fields.map(f => f.text).join("\n") } });
  }

  const payload = { attachments: [{ color, blocks }] };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}
