import type { APIRoute } from "astro";
import { benchmark } from "../../data";
import { ecosystemsCsv } from "../../lib/csv";

export const GET: APIRoute = () =>
  new Response(ecosystemsCsv(benchmark), {
    headers: { "Content-Type": "text/csv; charset=utf-8" },
  });
