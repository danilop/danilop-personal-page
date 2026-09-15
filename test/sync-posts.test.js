const test = require('node:test');
const assert = require('node:assert/strict');
const { parseAwsArchive, mergePosts } = require('../scripts/sync-posts');

test('AWS archive parser scopes links to authored articles and follows older pages', () => {
  const page = 'https://aws.amazon.com/blogs/aws/author/danilop/';
  const html = `<h1>Author: Danilo Poccia</h1><article>
    <h2><a rel="bookmark" href="/blogs/aws/example/">A &amp; B</a></h2>
    <span property="author">Danilo Poccia</span><time datetime="2026-01-12T09:00:00Z"></time>
    <section property="description">A description</section></article>
    <a href="/blogs/aws/author/danilop/page/2/">← Older posts</a>`;
  const result = parseAwsArchive(html, page);
  assert.equal(result.posts.length, 1);
  assert.equal(result.posts[0].metadata.ogTitle, 'A & B');
  assert.equal(result.next, page + 'page/2/');
  assert.throws(() => parseAwsArchive('<h1>Unexpected response</h1>', page), /Unexpected author/);
});

test('sync preserves old links, deduplicates, and sorts both sources by publication date', () => {
  const found = [
    { url: 'dev', metadata: { publishedAt: '2026-04-09T12:00:00Z' } },
    { url: 'aws', metadata: { publishedAt: '2026-01-12T12:00:00Z' } },
    { url: 'aws', metadata: { publishedAt: '2026-01-12T12:00:00Z' } }
  ];
  const result = mergePosts(['old', 'aws'], found, { old: { ogTitle: 'Preserved' } });
  assert.deepEqual(result.posts, ['dev', 'aws', 'old']);
  assert.equal(result.metadata.old.ogTitle, 'Preserved');
  assert.deepEqual(mergePosts(result.posts, found, result.metadata), result);
});
