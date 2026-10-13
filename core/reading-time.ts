// Reading labels use the recording at 1×, independently of playback preferences.
export function readingMinutes(body: string, audioDuration?: number): number {
  const minutes =
    audioDuration !== undefined &&
    Number.isFinite(audioDuration) &&
    audioDuration > 0
      ? audioDuration / 60
      : body.split(/\s+/).length / 220;
  return Math.max(1, Math.ceil(minutes));
}
