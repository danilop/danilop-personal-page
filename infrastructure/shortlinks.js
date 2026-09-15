import cf from 'cloudfront';
const store = cf.kvs();
const missing = () => ({statusCode: 404, headers: {'content-type': {value: 'text/plain; charset=utf-8'}}, body: 'Short link not found.'});
const redirect = target => ({statusCode: 302, headers: {location: {value: target}, 'cache-control': {value: 'public, max-age=60'}}});
async function handler(event) {
  const request = event.request;
  if (request.method !== 'GET' && request.method !== 'HEAD') return missing();
  if (request.uri === '/') return redirect('https://www.danilop.net/');
  const key = request.uri.replace(/^\//, '').replace(/\/$/, '');
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(key)) return missing();
  try {
    const target = await store.get(key);
    if (!target.startsWith('https://www.danilop.net/')) return missing();
    return redirect(target);
  } catch (_) {
    return missing();
  }
}
