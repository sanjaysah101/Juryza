import { type NextRequest, NextResponse } from "next/server";

/**
 * Built-in local webhook sink for testing and demonstrations.
 * Organizers running locally can point their webhooks to:
 *   http://localhost:3000/api/webhooks/test-sink
 * without needing an external service or ngrok tunnel.
 */
export async function POST(req: NextRequest) {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = await req.text();
  }

  const eventType = req.headers.get("x-juryza-event");
  const signature = req.headers.get("x-juryza-signature");

  return NextResponse.json({
    ok: true,
    message: "Webhook received successfully by Juryza test sink",
    eventType,
    hasSignature: Boolean(signature),
    receivedAt: new Date().toISOString(),
    payloadSummary: typeof body === "object" && body !== null ? Object.keys(body) : "text",
  });
}

export async function GET() {
  return NextResponse.json({
    status: "ready",
    description:
      "Juryza local webhook test sink is active. Send POST requests here to test webhooks.",
  });
}
