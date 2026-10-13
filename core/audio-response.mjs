/** Byte ranges for private/local MP3 previews; the production CDN handles these. */
export function audioResponse(req, res, bytes) {
  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Accept-Ranges", "bytes");
  const requested = req.headers.range;
  if (!requested) {
    res.setHeader("Content-Length", bytes.length);
    res.end(req.method === "HEAD" ? undefined : bytes);
    return;
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(requested);
  let start = 0,
    end = bytes.length - 1;
  if (match?.[1]) start = Number(match[1]);
  if (match?.[2]) {
    if (match[1]) end = Math.min(Number(match[2]), end);
    else start = Math.max(0, bytes.length - Number(match[2]));
  }
  if (
    !match ||
    (!match[1] && !match[2]) ||
    start > end ||
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end)
  ) {
    res.statusCode = 416;
    res.setHeader("Content-Range", `bytes */${bytes.length}`);
    res.end();
    return;
  }
  res.statusCode = 206;
  res.setHeader("Content-Range", `bytes ${start}-${end}/${bytes.length}`);
  res.setHeader("Content-Length", end - start + 1);
  res.end(req.method === "HEAD" ? undefined : bytes.subarray(start, end + 1));
}
