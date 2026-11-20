/**
 * Which stored objects a push starts to depend on. The asset manifest records
 * private originals (`originals/…`) and public copies (stored under
 * `published/`). A commit can add records before `npm run release` uploads
 * their bytes, so a plain `git push` could publish a manifest that other
 * checkouts cannot restore from. The pre-push hook checks the new records.
 */
export type StoredObject = { key: string; bytes?: number };

function storageKey(key: string) {
  return key.startsWith("originals/") ? key : "published/" + key;
}

/** Every object a manifest refers to, keyed by its bucket key. */
export function manifestObjects(manifest: unknown) {
  const objects = new Map<string, StoredObject>();
  const add = (key: unknown, bytes: unknown) => {
    if (typeof key !== "string" || !key) return;
    const stored = storageKey(key);
    objects.set(stored, {
      key: stored,
      ...(typeof bytes === "number" ? { bytes } : {}),
    });
  };
  const walk = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    add(record.key, record.bytes);
    add(record.publicKey, record.bytes);
    Object.values(record).forEach(walk);
  };
  walk(manifest);
  return objects;
}

/** Objects referenced by `next` that `previous` did not already reference. */
export function addedObjects(previous: unknown, next: unknown) {
  const before = manifestObjects(previous);
  return [...manifestObjects(next).values()].filter(
    (object) => before.get(object.key)?.bytes !== object.bytes,
  );
}

/** Parse `git push` hook input: one line per ref being updated. */
export function pushedRefs(input: string) {
  return input
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length === 4)
    .map(([localRef, localSha, remoteRef, remoteSha]) => ({
      localRef,
      localSha,
      remoteRef,
      remoteSha,
    }))
    .filter((ref) => !/^0+$/.test(ref.localSha));
}
