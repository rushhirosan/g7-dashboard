import type { FetchNewsResult } from "./fetch-news";
import { getSiteUrl } from "./site-url";

type DiscordEmbed = {
  title: string;
  description?: string;
  color: number;
  fields?: { name: string; value: string; inline?: boolean }[];
};

async function postDiscordWebhook(payload: {
  content: string;
  embeds: DiscordEmbed[];
}): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

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

function formatUpdatedAtJst(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export async function notifyDiscordPartialFetch(result: FetchNewsResult): Promise<void> {
  if (result.countriesWritten === result.totalSources) return;

  const siteUrl = getSiteUrl();
  await postDiscordWebhook({
    content: "⚠️ World Front Page cron succeeded with partial data",
    embeds: [
      {
        title: "Fetch news completed with partial data",
        color: 16763904,
        fields: [
          {
            name: "Countries",
            value: `${result.countriesWritten}/${result.totalSources}`,
            inline: true,
          },
          {
            name: "Updated (JST)",
            value: formatUpdatedAtJst(result.updatedAt),
            inline: true,
          },
          {
            name: "Site",
            value: siteUrl,
            inline: false,
          },
        ],
      },
    ],
  });
}

export async function notifyDiscordFailure(message: string): Promise<void> {
  await postDiscordWebhook({
    content: "❌ World Front Page cron failed",
    embeds: [
      {
        title: "Fetch news failed",
        description: message.slice(0, 2000),
        color: 15158332,
      },
    ],
  });
}
