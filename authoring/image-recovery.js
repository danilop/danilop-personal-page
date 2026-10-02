/* Persist only image names, not prose. Pins survive preview/browser restarts. */
(() => {
  const storageKey = "author-image-recovery-client:" + location.origin;
  const client = localStorage.getItem(storageKey) || crypto.randomUUID();
  localStorage.setItem(storageKey, client);
  const sessionKey = storageKey + ":session";
  const session = sessionStorage.getItem(sessionKey) || crypto.randomUUID();
  sessionStorage.setItem(sessionKey, session);
  let serial = Promise.resolve(),
    timer;
  function names() {
    const texts = [];
    const prefix = "author-recovery:" + location.origin + ":";
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const record = JSON.parse(localStorage.getItem(key));
      if (!record || typeof record.text !== "string")
        throw Error("Cannot protect images: browser recovery is unreadable.");
      texts.push(record.text);
    }
    const references = (texts) => [
      ...new Set(
        texts.flatMap(
          (text) =>
            text.match(/[a-zA-Z0-9_.%-]+\.(?:png|jpe?g|webp)\b/gi) || [],
        ),
      ),
    ];
    return {
      names: references([...texts, editor.value]),
      undoNames: references(stack),
    };
  }
  window.protectAuthorImages = () => {
    clearTimeout(timer);
    const next = serial
      .catch(() => {})
      .then(() => api("image-recovery", { client, session, ...names() }));
    serial = next;
    return next;
  };
  document.addEventListener("author-image-recovery", () => {
    clearTimeout(timer);
    timer = setTimeout(() => window.protectAuthorImages().catch(error), 250);
  });
  window.addEventListener("storage", () =>
    window.protectAuthorImages().catch(error),
  );
  window.protectAuthorImages().catch(error);
  setInterval(() => window.protectAuthorImages().catch(error), 30000);
})();
