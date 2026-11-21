import type { Instrumentation } from "next";

/**
 * Every error Next catches on the server (a page, a route handler, a server action) is written here as one line
 * of JSON, with the route and the error's digest: the same digest the visitor sees on the error page, so a report
 * can be matched to its log line. Hosts (Vercel...) keep these lines in their log search.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const err = error as Error & { digest?: string };
  console.error(
    JSON.stringify({
      level: "error",
      at: new Date().toISOString(),
      digest: err.digest,
      message: err.message,
      method: request.method,
      path: request.path.split("?")[0],
      route: context.routePath,
      kind: context.routeType,
    }),
  );
};
