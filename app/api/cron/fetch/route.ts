import { Receiver } from "@upstash/qstash";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { fetchAndStoreNews } from "@/lib/fetch-news";
import { notifyDiscordFailure } from "@/lib/notify-discord";

export const maxDuration = 300;

async function verifyQStash(req: NextRequest, body: string): Promise<boolean> {
  const current = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const next = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!current || !next) return false;

  const signature = req.headers.get("upstash-signature");
  if (!signature) return false;

  const receiver = new Receiver({ currentSigningKey: current, nextSigningKey: next });
  try {
    await receiver.verify({ signature, body, url: req.url });
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text();

  if (!(await verifyQStash(req, body))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await fetchAndStoreNews();
    revalidatePath("/");
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/cron/fetch]", message);
    await notifyDiscordFailure(message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
