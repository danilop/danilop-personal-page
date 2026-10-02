// Destinations remain on private S3 objects; this function only translates metadata.
function handler(event) {
  var request = event.request;
  var response = event.response;
  var statusQuery = request.querystring && request.querystring.__link_status;
  var checkStatus = statusQuery && statusQuery.value === "1";
  var uri = request.uri;
  var header = response.headers["x-amz-website-redirect-location"];
  var target = header && header.value;
  var validPath =
    uri === "/" ||
    uri === "/index" ||
    /^\/[a-z0-9][a-z0-9-]{0,63}\/?$/.test(uri);
  var validTarget =
    typeof target === "string" &&
    target.indexOf("https://www.danilop.net/") === 0 &&
    !target.split("").some(function (character) {
      return (
        character.charCodeAt(0) < 33 ||
        character.charCodeAt(0) === 127 ||
        character === "\\"
      );
    });
  delete response.headers["x-amz-website-redirect-location"];
  // CloudFront rejects removing these read-only headers, even when rebuilding a response.
  function safeHeaders(headers) {
    // Only public destinations are exposed; no credentials or private S3 body.
    if (checkStatus) headers["access-control-allow-origin"] = { value: "*" };
    if (response.headers.via) headers.via = response.headers.via;
    if (response.headers.warning) headers.warning = response.headers.warning;
    return headers;
  }
  if (
    (request.method !== "GET" && request.method !== "HEAD") ||
    // Crawlers can request a byte range; the redirect metadata is still valid on 206.
    (response.statusCode !== 200 && response.statusCode !== 206) ||
    !validPath ||
    !validTarget
  ) {
    return {
      statusCode: 404,
      headers: safeHeaders({
        "cache-control": { value: "no-store" },
        "content-type": { value: "text/plain; charset=utf-8" },
      }),
      body: request.method === "HEAD" ? "" : "Short link not found.",
    };
  }
  if (checkStatus) {
    return {
      statusCode: 200,
      headers: safeHeaders({
        "cache-control": { value: "no-store" },
        "content-type": { value: "application/json; charset=utf-8" },
      }),
      body: request.method === "HEAD" ? "" : JSON.stringify({ target: target }),
    };
  }
  // Rebuild headers so S3's entity validators and internal metadata do not leak.
  return {
    statusCode: 302,
    statusDescription: "Found",
    headers: safeHeaders({
      location: { value: target },
      "cache-control": { value: "no-store" },
      "content-length": { value: "0" },
    }),
    body: "",
  };
}
