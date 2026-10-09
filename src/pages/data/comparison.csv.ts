import type { APIRoute } from "astro";
import { benchmark } from "../../data";
import { comparisonCsv } from "../../lib/csv";

export const GET: APIRoute = () =>
  new Response(comparisonCsv(benchmark), {
    headers: { "Content-Type": "text/csv; charset=utf-8" },
  });
