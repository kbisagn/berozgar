import PusherClient from "pusher-js";

const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "ap2";

let clientInstance: PusherClient | null = null;

export function getPusherClient(): PusherClient | null {
  if (typeof window === "undefined") return null;

  if (!pusherKey) {
    return null;
  }

  if (!clientInstance) {
    clientInstance = new PusherClient(pusherKey, {
      cluster: pusherCluster,
      forceTLS: true,
    });
  }

  return clientInstance;
}
