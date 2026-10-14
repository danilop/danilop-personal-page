import workerSource from "./python-worker.js?raw";

// No allow-same-origin: Python/JS interop cannot access the site's storage or DOM.
// The CSP is inherited by the data-URL Worker; only the pinned runtime can be fetched.
export function pythonSandbox() {
  const source = JSON.stringify(workerSource).replaceAll("<", "\\u003c");
  return `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval' data: https://cdn.jsdelivr.net/pyodide/v314.0.7/full/; connect-src https://cdn.jsdelivr.net/pyodide/v314.0.7/full/; worker-src data:; child-src 'none'; form-action 'none'; base-uri 'none'"><script>
  const workerSource = ${source};
  let worker;
  addEventListener('message', (event) => {
    if (event.source !== parent || worker || typeof event.data?.code !== 'string' || event.data.code.length > 16000) return;
    const url = 'data:text/javascript;charset=utf-8,' + encodeURIComponent(workerSource);
    worker = new Worker(url, { type: 'module' });
    worker.onmessage = ({data}) => parent.postMessage(data, '*');
    worker.onerror = (event) => parent.postMessage({phase: 'error', error: event.message || 'Python could not start. Check your connection and try again.'}, '*');
    worker.postMessage({code: event.data.code});
  });
  parent.postMessage({phase: 'ready'}, '*');
  </script>`;
}
