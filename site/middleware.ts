import { defineMiddleware } from "astro:middleware";
import { deploymentHtml } from "../core/deployment-html";

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  if (!response.headers.get("content-type")?.includes("text/html"))
    return response;
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(deploymentHtml(await response.text()), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});
