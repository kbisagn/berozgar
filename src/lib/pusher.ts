import Pusher from "pusher";

let pusherInstance: Pusher | null = null;

const appId = process.env.PUSHER_APP_ID;
const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
const secret = process.env.PUSHER_SECRET;
const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "ap2";

if (appId && key && secret) {
  pusherInstance = new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });
} else {
  console.warn("Pusher environment variables missing. Real-time fallback polling will be active.");
}

export async function triggerPusherEvent(channel: string, event: string, data: any) {
  if (pusherInstance) {
    try {
      await pusherInstance.trigger(channel, event, data);
    } catch (error) {
      console.error("Pusher trigger failed:", error);
    }
  } else {
    // If Pusher isn't configured, we just log it. The client polling will catch up.
    console.log(`[Pusher Offline] Event triggered on ${channel} -> ${event}:`, JSON.stringify(data));
  }
}
