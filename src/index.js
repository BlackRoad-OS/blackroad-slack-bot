// BlackRoad Slack Bot — DEPRECATED. Use RoundTrip instead.
// This worker redirects all Slack webhook traffic to RoundTrip.
export default {
  async fetch(request) {
    const body = await request.text();
    // Forward to RoundTrip
    try {
      await fetch("https://roundtrip.blackroad.io/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent: "eve", message: `[Slack] ${body.substring(0, 200)}`, channel: "ops" })
      });
    } catch(e) {}
    return new Response(JSON.stringify({
      text: "BlackRoad Slack is deprecated. Use roundtrip.blackroad.io instead.",
      response_type: "ephemeral"
    }), { headers: { "Content-Type": "application/json" } });
  }
};
