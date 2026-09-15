export interface BookPublisher {
  id: string;
  preview(slug: string): Promise<unknown>;
  status(slug: string): Promise<unknown>;
  publish(slug: string, releaseNotes: string): Promise<unknown>;
}
export function leanpub(
  apiKey: string,
  request: typeof fetch = fetch,
): BookPublisher {
  const send = async (
    slug: string,
    action: string,
    method: "GET" | "POST",
    extra: Record<string, string> = {},
  ) => {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug))
      throw Error("Invalid Leanpub book slug");
    const url = new URL(`https://leanpub.com/${slug}/${action}.json`);
    if (method === "GET") url.searchParams.set("api_key", apiKey);
    let response: Response;
    try {
      response = await request(url, {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(30000),
        ...(method === "POST"
          ? {
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({ api_key: apiKey, ...extra }),
            }
          : {}),
      });
    } catch {
      throw Error(
        "Leanpub request could not complete; check status before retrying",
      );
    }
    if (!response.ok) throw Error(`Leanpub returned status ${response.status}`);
    const result = await response.json();
    if (result.success === false) throw Error("Leanpub rejected the operation");
    return result;
  };
  return {
    id: "leanpub",
    preview: (slug) => send(slug, "preview", "POST"),
    status: (slug) => send(slug, "job_status", "GET"),
    publish: (slug, releaseNotes) =>
      send(slug, "publish", "POST", {
        "publish[email_readers]": "false",
        "publish[release_notes]": releaseNotes,
      }),
  };
}
