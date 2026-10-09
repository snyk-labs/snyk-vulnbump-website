import type { APIRoute } from "astro";
import { benchmark } from "../../data";

/** Full validated dataset, emitted as a static file at build time. */
export const GET: APIRoute = () =>
  new Response(`${JSON.stringify(benchmark, null, 2)}\n`, {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
