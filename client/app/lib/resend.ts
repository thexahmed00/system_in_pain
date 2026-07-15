import "server-only";
import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY!);

export const FEEDBACK_TO_EMAIL = "mustafaa2k1@gmail.com";
// Resend requires a verified sending domain for a custom "from" address.
// Until systeminpain.com is verified in the Resend dashboard, their shared
// onboarding domain works for any destination.
export const FEEDBACK_FROM_EMAIL = "systemInPain Feedback <onboarding@resend.dev>";
