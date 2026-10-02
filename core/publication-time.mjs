// Compare publication instants independently of timezone formatting.
const day = /^\d{4}-\d{2}-\d{2}$/;
const instant =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
export function validPublicationDate(value) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
    return false;
  if (day.test(value))
    return new Date(value).toISOString().slice(0, 10) === value;
  if (!instant.test(value) || Number(value.slice(11, 13)) > 23) return false;
  // Reject dates JavaScript would silently roll into the following month.
  return validPublicationDate(value.slice(0, 10));
}
export function publicationOrder(a, b) {
  const left = a.publishedAt ? Date.parse(a.publishedAt) : -Infinity;
  const right = b.publishedAt ? Date.parse(b.publishedAt) : -Infinity;
  return (
    (left === right ? 0 : left > right ? -1 : 1) || a.id.localeCompare(b.id)
  );
}
