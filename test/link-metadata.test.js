const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs-extra');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { getLinkData, escapeHtml } = require('../lib/link-metadata');

const link = 'https://example.com/talk';
async function fixture(t, cached) {
  const cacheFolderName = await fs.mkdtemp(path.join(os.tmpdir(), 'homepage-test-'));
  t.after(() => fs.remove(cacheFolderName));
  const cacheFile = path.join(cacheFolderName, crypto.createHash('sha256').update(link).digest('hex'));
  if (cached) await fs.writeJson(cacheFile, cached);
  return { cacheFolderName, cacheFile };
}

test('partial corrections override imported and cached fields without losing other metadata or changing the cache', async t => {
  const cached = { ogTitle: 'Stale', ogDescription: 'Original description', ogImage: { url: 'https://example.com/image.jpg' } };
  const fixtureData = await fixture(t, cached);
  const options = { ...fixtureData, imported: { [link]: { ogTitle: 'Imported' } }, overrides: { [link]: { title: 'Corrected', subtitle: 'Conference' } }, scrape: () => assert.fail('Should not fetch') };
  const result = await getLinkData(link, options);
  assert.equal(result.title, 'Corrected');
  assert.equal(result.description, 'Original description');
  assert.equal(result.imageUrl, cached.ogImage.url);
  assert.deepEqual(await fs.readJson(fixtureData.cacheFile), cached);
  assert.equal((await getLinkData(link, { ...options, overrides: {} })).title, 'Imported');
  assert.equal((await getLinkData(link, { ...options, imported: {}, overrides: {} })).title, 'Stale');
});

test('fresh Open Graph metadata is cached raw and the correction is applied after fetching', async t => {
  const state = await fixture(t);
  const raw = { ogTitle: 'Talk - A meaningful subtitle', ogDescription: 'Fetched', ogImage: [{ url: 'https://example.com/image.jpg' }] };
  const result = await getLinkData(link, { ...state, overrides: { [link]: { description: 'Corrected', imageUrl: null } }, scrape: async () => ({ result: raw }) });
  assert.equal(result.title, raw.ogTitle);
  assert.equal(result.description, 'Corrected');
  assert.equal(result.imageUrl, null);
  assert.deepEqual(await fs.readJson(state.cacheFile), raw);
});

test('current Open Graph scraper output preserves source metadata and editorial overrides', async t => {
  const state = await fixture(t);
  const ogs = require('open-graph-scraper');
  const html = '<html><head><meta property="og:title" content="Source title"><meta property="og:description" content="Source description"><meta property="og:image" content="https://example.com/photo.png"></head></html>';
  const result = await getLinkData(link, {
    ...state,
    overrides: { [link]: { description: 'Edited description' } },
    scrape: async options => {
      assert.equal(options.timeout, 20);
      return ogs({ html });
    },
  });
  assert.equal(result.title, 'Source title');
  assert.equal(result.description, 'Edited description');
  assert.equal(result.imageUrl, 'https://example.com/photo.png');
  assert.equal((await fs.readJson(state.cacheFile)).ogTitle, 'Source title');
  assert.equal((await fs.readJson(state.cacheFile)).ogDescription, 'Source description');
});

test('saved YouTube metadata and corrections work with an empty build cache', async t => {
  const state = await fixture(t);
  const imported = require('../data/link-metadata.json');
  const overrides = require('../data/link-overrides.json');
  for (const url of require('../data/videos.json')) {
    const result = await getLinkData(url, { ...state, imported, overrides, scrape: () => assert.fail('YouTube must not require network access') });
    assert.equal(result.title, overrides[url].title);
    assert.match(result.url, /^https:\/\/www.youtube.com\/watch\?v=/);
    assert.ok(result.description && result.imageUrl);
  }
});

test('invalid source metadata fails without poisoning the cache', async t => {
  const state = await fixture(t);
  await assert.rejects(getLinkData(link, { ...state, scrape: async () => ({ result: { ogTitle: 'YouTube' } }) }), /generic title/);
  assert.equal(await fs.pathExists(state.cacheFile), false);
  await assert.rejects(getLinkData(link, { ...state, overrides: { [link]: { title: 'Talk', url: 'javascript:alert(1)' } } }), /Unsafe url/);
});

test('metadata is escaped for HTML text and attributes', () => {
  assert.equal(escapeHtml('A & B <script> "quoted"'), 'A &amp; B &lt;script&gt; &quot;quoted&quot;');
});
