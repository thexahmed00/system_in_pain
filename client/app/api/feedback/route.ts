import { auth0 } from "@/app/lib/auth0";
import { supabaseAdmin } from "@/app/lib/supabase-server";
import { resend, FEEDBACK_TO_EMAIL, FEEDBACK_FROM_EMAIL } from "@/app/lib/resend";

interface FeedbackRequest {
  message: string;
  email?: string;
  name?: string;
  /** Where this came from (e.g. "level-3-prompt" vs the standalone /feedback page) — tag only, not user-facing. */
  source?: string;
}

const MAX_MESSAGE_LENGTH = 4000;

export async function POST(req: Request) {
  let body: FeedbackRequest;
  try {
    body = (await req.json()) as FeedbackRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return Response.json({ error: "Feedback message is required" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return Response.json({ error: "Feedback message is too long" }, { status: 400 });
  }

  const session = await auth0.getSession();
  const name = body.name?.trim() || session?.user?.name || null;
  const email = body.email?.trim() || session?.user?.email || null;

  const source = body.source?.trim() || null;

  const { error: dbError } = await supabaseAdmin.from("feedback").insert({
    message,
    name,
    email,
    user_id: session?.user?.sub ?? null,
    source,
  });

  if (dbError) {
    console.error("[feedback] failed to save to Supabase:", dbError.message);
    return Response.json({ error: "Failed to save feedback" }, { status: 500 });
  }

  try {
    await resend.emails.send({
      from: FEEDBACK_FROM_EMAIL,
      to: FEEDBACK_TO_EMAIL,
      replyTo: email ?? undefined,
      subject: `systemInPain feedback${name ? ` from ${name}` : ""}${source ? ` (${source})` : ""}`,
      text: `${message}\n\n---\nFrom: ${name ?? "Anonymous"} ${email ? `<${email}>` : "(no email)"}`,
    });
  } catch (err) {
    // The feedback is already durably saved in Supabase — a failed email
    // notification shouldn't fail the user-facing request.
    console.error("[feedback] failed to send email notification:", err);
  }

  return Response.json({ ok: true });
}
