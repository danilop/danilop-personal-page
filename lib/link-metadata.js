const fs = require('fs-extra');
const path = require('node:path');
const crypto = require('node:crypto');
const ogs = require('open-graph-scraper');

function getImageUrl(image) {
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) return image.length ? getImageUrl(image[0]) : null;
  return image?.url || null;
}

function normalize(link, metadata) {
  let title = metadata.ogTitle;
  // Remove only a known publisher suffix, never split a talk's title at a dash.
  if (metadata.ogSiteName === 'Amazon Web Services' && title) title = title.replace(/ \| (AWS News Blog|AWS .* Blog)$/, '');
  return {
    title,
    subtitle: metadata.ogSiteName === 'Speaker Deck' ? (metadata.ogDescription || '').split('\n')[0] : null,
    url: metadata.ogUrl || link,
    description: metadata.ogDescription || null,
    imageUrl: getImageUrl(metadata.ogImage),
    publishedAt: metadata.publishedAt || metadata.articlePublishedTime || metadata.ogDate || null
  };
}

function validate(record, link) {
  if (typeof record.title !== 'string' || !record.title.trim() || record.title === 'YouTube') {
    throw new Error(`Missing or generic title for ${link}; add a correction in data/link-overrides.json`);
  }
  for (const field of ['url', 'imageUrl']) {
    if (field === 'imageUrl' && !record[field]) continue;
    let url;
    try { url = new URL(record[field]); } catch { throw new Error(`Invalid ${field} for ${link}`); }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`Unsafe ${field} for ${link}`);
  }
  return record;
}

async function getLinkData(link, { cacheFolderName, imported = {}, overrides = {}, scrape = ogs }) {
  const cacheFile = path.join(cacheFolderName, crypto.createHash('sha256').update(link).digest('hex'));
  let cached = {};
  try { cached = await fs.readJson(cacheFile); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  // Fresh imported fields supersede the old cache. Curated fields are applied last.
  let metadata = { ...cached, ...imported[link] };
  const correction = overrides[link] || {};
  if (!metadata.ogTitle && !correction.title) {
    // open-graph-scraper 6 uses seconds, rather than the old millisecond option.
    const response = await scrape({ url: link, timeout: 20 });
    const fetched = response.result;
    if (!fetched || response.error || fetched.success === false) throw new Error(`Open Graph lookup failed: ${link}`);
    metadata = { ...fetched, ...imported[link] };
    validate({ ...normalize(link, metadata), ...correction }, link);
    await fs.ensureDir(cacheFolderName);
    // Store source metadata only, so removing a correction reveals the original again.
    await fs.writeJson(cacheFile, fetched);
  }
  return validate({ ...normalize(link, metadata), ...correction }, link);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

module.exports = { getLinkData, getImageUrl, escapeHtml };
