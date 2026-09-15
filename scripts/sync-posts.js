const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');

const dataDir = path.join(__dirname, '..', 'data');
const read = name => JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'));
const write = (name, data) => fs.writeFileSync(path.join(dataDir, name), JSON.stringify(data, null, 2) + '\n');
const clean = text => text.replace(/\s+/g, ' ').trim();

async function request(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'danilop-personal-page content sync' },
      signal: AbortSignal.timeout(30000)
    });
    if (response.ok) return response;
    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
      continue;
    }
    throw new Error(`${response.status} fetching ${url}`);
  }
}

function parseAwsArchive(html, pageUrl) {
  const $ = cheerio.load(html);
  if (!$('h1').text().includes('Danilo Poccia')) throw new Error(`Unexpected author archive: ${pageUrl}`);
  const posts = [];
  $('article').each((_, element) => {
    const article = $(element);
    const titleLink = article.find('h2 a[rel="bookmark"]').first();
    const authors = article.find('[property="author"]').text();
    if (!authors.includes('Danilo Poccia')) return;
    const url = new URL(titleLink.attr('href'), pageUrl).href;
    const publishedAt = article.find('time').attr('datetime');
    const title = clean(titleLink.text());
    if (!title || !Number.isFinite(Date.parse(publishedAt))) throw new Error(`Invalid article in ${pageUrl}`);
    const imageUrl = article.find('meta[property="image"]').attr('content');
    posts.push({
      url,
      metadata: {
        ogTitle: title,
        ogDescription: clean(article.find('[property="description"]').text()),
        ogUrl: url,
        ogSiteName: 'Amazon Web Services',
        ...(imageUrl ? { ogImage: { url: new URL(imageUrl, pageUrl).href } } : {}),
        publishedAt,
        source: pageUrl
      }
    });
  });
  if (!posts.length) throw new Error(`No authored posts found in ${pageUrl}`);
  const nextLink = $('a').filter((_, element) => /Older posts/i.test($(element).text())).first().attr('href');
  const next = nextLink ? new URL(nextLink, pageUrl).href : null;
  if (next && !next.startsWith(pageUrl.split('/page/')[0].replace(/\/$/, '') + '/page/')) {
    throw new Error(`Unexpected pagination URL: ${next}`);
  }
  return { posts, next };
}

async function awsArchive(start) {
  const posts = [];
  const visited = new Set();
  let next = start;
  while (next) {
    if (visited.has(next) || visited.size >= 100) throw new Error(`Pagination loop at ${next}`);
    visited.add(next);
    const parsed = parseAwsArchive(await (await request(next)).text(), next);
    posts.push(...parsed.posts);
    console.log(`AWS: ${posts.length} posts from ${visited.size} page(s): ${start}`);
    next = parsed.next;
  }
  return posts;
}

async function awsPost(url) {
  const $ = cheerio.load(await (await request(url)).text());
  if (!$('[property="author"]').text().includes('Danilo Poccia')) throw new Error(`Authorship not verified: ${url}`);
  const meta = name => $(`meta[property="${name}"]`).attr('content');
  const title = clean($('h1').first().text());
  const publishedAt = $('time').first().attr('datetime');
  if (!title || !Number.isFinite(Date.parse(publishedAt))) throw new Error(`Missing post title/date: ${url}`);
  return { url, metadata: {
    ogTitle: title, ogDescription: meta('og:description') || '', ogUrl: url,
    ogSiteName: 'Amazon Web Services',
    ...(meta('og:image') ? { ogImage: { url: meta('og:image') } } : {}),
    publishedAt, source: url
  } };
}

async function devPosts(username) {
  const posts = [];
  const ids = new Set();
  for (let page = 1; page <= 100; page++) {
    const source = `https://dev.to/api/articles?username=${encodeURIComponent(username)}&per_page=100&page=${page}`;
    const articles = await (await request(source)).json();
    if (!Array.isArray(articles)) throw new Error('Unexpected DEV API response');
    if (!articles.length) return posts;
    for (const article of articles) {
      if (article.user.username !== username || ids.has(article.id)) throw new Error('Unexpected author or duplicate DEV page');
      if (!article.title || !Number.isFinite(Date.parse(article.published_at))) throw new Error('Invalid DEV article');
      ids.add(article.id);
      const imageUrl = article.cover_image || article.social_image;
      posts.push({ url: article.url, metadata: {
        ogTitle: article.title, ogDescription: article.description, ogUrl: article.url,
        ogSiteName: 'DEV Community', ...(imageUrl ? { ogImage: { url: imageUrl } } : {}),
        publishedAt: article.published_at, canonicalUrl: article.canonical_url || article.url, source
      } });
    }
  }
  throw new Error('DEV pagination exceeded 100 pages');
}

function mergePosts(existing, discovered, previousMetadata) {
  const metadata = { ...previousMetadata };
  const urls = new Set(existing);
  for (const post of discovered) {
    urls.add(post.url);
    metadata[post.url] = { ...metadata[post.url], ...post.metadata };
  }
  const posts = [...urls].sort((a, b) => {
    const date = url => Date.parse(metadata[url]?.publishedAt || '') || 0;
    return date(b) - date(a);
  });
  return { posts, metadata };
}

async function main() {
  const sources = read('post-sources.json');
  const existing = read('posts.json');
  const metadata = read('link-metadata.json');
  const discovered = [];
  for (const source of sources.awsAuthorArchives) discovered.push(...await awsArchive(source));
  for (const url of sources.awsAdditionalPosts) discovered.push(await awsPost(url));
  const dev = await devPosts(sources.devUsername);
  if (!dev.length) throw new Error('DEV returned no posts; refusing to update');
  discovered.push(...dev);
  const merged = mergePosts(existing, discovered, metadata);
  // Write only after every source completes; never replace the manual overrides.
  write('link-metadata.json', merged.metadata);
  write('posts.json', merged.posts);
  console.log(`Saved ${merged.posts.length} posts (${merged.posts.length - existing.length} added); ${dev.length} from DEV.`);
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { parseAwsArchive, mergePosts };
