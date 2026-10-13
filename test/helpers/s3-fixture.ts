import http from "node:http";
import { createHash } from "node:crypto";

const sha = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("base64");
export async function s3Fixture() {
  const objects = new Map<string, Buffer>();
  const uploads = new Map<string, Map<number, Buffer>>();
  const writes: {
    key: string;
    headers: http.IncomingHttpHeaders;
    operation: string;
  }[] = [];
  let deny = false;
  const server = http.createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url!, "http://localhost");
      const key = url.pathname.replace(/^\/fixture\/?/, "");
      const alreadyExists = () =>
        objects.has(key) && request.headers["if-none-match"] === "*";
      const xml = (body: string, status = 200) => {
        response.writeHead(status, { "Content-Type": "application/xml" });
        response.end(body);
      };
      if (deny)
        return xml(
          "<Error><Code>AccessDenied</Code><Message>Fixture denied</Message></Error>",
          403,
        );
      if (request.method === "GET" && url.searchParams.has("list-type")) {
        const prefix = url.searchParams.get("prefix") ?? "";
        const contents = [...objects]
          .filter(([name]) => name.startsWith(prefix))
          .map(
            ([name, bytes]) =>
              `<Contents><Key>${name}</Key><LastModified>2020-01-01T00:00:00.000Z</LastModified><ETag>"fixture"</ETag><Size>${bytes.length}</Size><StorageClass>STANDARD</StorageClass></Contents>`,
          )
          .join("");
        return xml(
          `<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>fixture</Name><Prefix>${prefix}</Prefix><IsTruncated>false</IsTruncated>${contents}</ListBucketResult>`,
        );
      }
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const bytes = Buffer.concat(chunks);
      const id = url.searchParams.get("uploadId");
      if (request.method === "POST" && url.searchParams.has("uploads")) {
        uploads.set(key, new Map());
        writes.push({ key, headers: request.headers, operation: "create" });
        return xml(
          `<InitiateMultipartUploadResult><Bucket>fixture</Bucket><Key>${key}</Key><UploadId>upload</UploadId></InitiateMultipartUploadResult>`,
        );
      }
      if (request.method === "PUT" && id) {
        uploads
          .get(key)!
          .set(Number(url.searchParams.get("partNumber")), bytes);
        response.writeHead(200, {
          ETag: '"part"',
          "x-amz-checksum-sha256": sha(bytes),
        });
        return response.end();
      }
      if (request.method === "DELETE" && id) {
        uploads.delete(key);
        response.writeHead(204);
        return response.end();
      }
      if (request.method === "POST" && id) {
        writes.push({ key, headers: request.headers, operation: "complete" });
        if (alreadyExists())
          return xml("<Error><Code>PreconditionFailed</Code></Error>", 412);
        const parts = [...uploads.get(key)!]
          .sort(([a], [b]) => a - b)
          .map(([, value]) => value);
        objects.set(key, Buffer.concat(parts));
        const composite =
          sha(
            Buffer.concat(
              parts.map((part) => Buffer.from(sha(part), "base64")),
            ),
          ) +
          "-" +
          parts.length;
        return xml(
          `<CompleteMultipartUploadResult><Bucket>fixture</Bucket><Key>${key}</Key><ETag>"multipart"</ETag><ChecksumSHA256>${composite}</ChecksumSHA256><ChecksumType>COMPOSITE</ChecksumType></CompleteMultipartUploadResult>`,
        );
      }
      const put = () => {
        writes.push({ key, headers: request.headers, operation: "put" });
        if (alreadyExists())
          return xml("<Error><Code>PreconditionFailed</Code></Error>", 412);
        objects.set(key, bytes);
        response.writeHead(200, {
          ETag: '"single"',
          "x-amz-checksum-sha256": sha(bytes),
        });
        return response.end();
      };
      if (request.method === "PUT") return put();
      xml("<Error><Code>NotImplemented</Code></Error>", 501);
    })().catch((error: unknown) => {
      response.writeHead(500);
      response.end(String(error));
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as import("node:net").AddressInfo;
  return {
    objects,
    writes,
    endpoint: `http://127.0.0.1:${address.port}`,
    deny: () => {
      deny = true;
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
}
