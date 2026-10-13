import test from "node:test";
import assert from "node:assert/strict";
import { audioResponse } from "../core/audio-response.mjs";
test("local MP3 delivery supports byte ranges, suffixes, HEAD and invalid requests", () => {
  function request(range, method = "GET") {
    const headers = {},
      response = {
        statusCode: 200,
        setHeader(k, v) {
          headers[k] = v;
        },
        end(body) {
          this.body = body;
        },
      };
    audioResponse(
      { headers: { range }, method },
      response,
      Buffer.from("0123456789"),
    );
    return { ...response, headers };
  }
  assert.equal(request().body.toString(), "0123456789");
  assert.equal(request("bytes=2-4").body.toString(), "234");
  assert.equal(request("bytes=-3").body.toString(), "789");
  assert.equal(request("bytes=7-").headers["Content-Range"], "bytes 7-9/10");
  assert.equal(request("bytes=2-4", "HEAD").body, undefined);
  for (const value of [
    "bytes=50-",
    "bytes=4-2",
    "bytes=-",
    "bytes=0-1,4-5",
    "bytes=-0",
  ])
    assert.equal(request(value).statusCode, 416);
});
