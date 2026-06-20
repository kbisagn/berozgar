import webpush from "web-push";
import { Resend } from "resend";

// Resend initialization
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Web Push VAPID initialization
const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

let webpushConfigured = false;
if (vapidPublic && vapidPrivate) {
  try {
    webpush.setVapidDetails(
      "mailto:admin@berozgar.com",
      vapidPublic,
      vapidPrivate
    );
    webpushConfigured = true;
  } catch (error) {
    console.error("Failed to initialize web-push details:", error);
  }
} else {
  console.warn("Web Push VAPID keys missing. Service Worker push notifications will fall back to local UI mocks.");
}

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  if (resend) {
    try {
      await resend.emails.send({
        from: "FlatMate <onboarding@resend.dev>",
        to,
        subject,
        html,
      });
      console.log(`[Resend Email] Successfully sent to ${to}: "${subject}"`);
    } catch (error) {
      console.error("Resend email sending failed:", error);
    }
  } else {
    console.log(`\n============== [MOCK EMAIL SENT] ==============`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:\n${html.replace(/<[^>]*>/g, "")}`);
    console.log(`================================================\n`);
  }
}

export async function sendPushNotification(subscription: any, payload: string) {
  if (webpushConfigured && subscription) {
    try {
      await webpush.sendNotification(subscription, payload);
      console.log(`[WebPush] Successfully sent push payload.`);
    } catch (error) {
      console.error("WebPush sending failed:", error);
    }
  } else {
    console.log(`\n============== [MOCK PUSH NOTIFICATION SENT] ==============`);
    console.log(`Subscription:`, JSON.stringify(subscription));
    console.log(`Payload: ${payload}`);
    console.log(`===========================================================\n`);
  }
}
