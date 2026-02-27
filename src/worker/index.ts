export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") {
      return Response.json({ status: "ok", timestamp: new Date().toISOString() });
    }
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

interface Env {}
