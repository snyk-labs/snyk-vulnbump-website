import type { APIRoute } from "astro";
import { benchmark } from "../../data";
import { breakdownsCsv } from "../../lib/csv";

export const GET: APIRoute = () =>
  new Response(breakdownsCsv(benchmark), {
    headers: { "Content-Type": "text/csv; charset=utf-8" },
  });
