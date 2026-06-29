export async function notifyDiscordFailure(message: string): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const payload = {
    content: "❌ World Front Page cron failed",
    embeds: [
      {
        title: "Fetch news failed",
        description: message.slice(0, 2000),
        color: 15158332,
      },
    ],
  };

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    console.error("[notify-discord] Failed to send:", err);
  }
}
