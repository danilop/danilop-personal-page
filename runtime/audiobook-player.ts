import { bindPlaybackButton } from "./audio-playback.js";
import {
  audioClock,
  captureProgress,
  readProgress,
  restoreProgress,
  segmentAt,
  type AudioMap,
} from "./audiobook-progress";
type PlayerBook = AudioMap & {
  title: string;
  author: string;
  bookId: string;
  offset?: number;
  scope?: string;
  listenLabel?: string;
};
export function mountAudiobook(panel: HTMLElement) {
  const get = <T extends HTMLElement>(s: string) => panel.querySelector<T>(s)!;
  const book = JSON.parse(get("[data-book-map]").textContent) as PlayerBook;
  const audio = get<HTMLAudioElement>("audio"),
    play = get<HTMLButtonElement>("[data-book-play]"),
    seek = get<HTMLInputElement>("[data-book-seek]"),
    speed = get<HTMLSelectElement>("[data-book-speed]");
  const offset = book.offset ?? 0;
  const key =
    "audiobook:v1:" + book.bookId + (book.scope ? ":" + book.scope : "");
  let saved;
  try {
    saved = readProgress(localStorage.getItem(key));
  } catch {
    /* Private storage can be unavailable. */
  }
  const restored = restoreProgress(book, saved);
  let pending = restored.time,
    loaded = false,
    engaged = false,
    lastSaved = 0;
  get("[data-book-notice]").textContent = restored.message;
  const current = () =>
    Math.min(
      book.audio.duration,
      Math.max(0, loaded ? audio.currentTime - offset : pending),
    );
  const updatePlayback = bindPlaybackButton(play, audio, {
    label: book.listenLabel ?? "Listen to this book",
    title: book.title,
    position: current,
    ended: () => audio.ended || current() >= book.audio.duration,
    start,
  });
  function save() {
    if (!engaged || !loaded) return;
    try {
      localStorage.setItem(
        key,
        JSON.stringify(
          captureProgress(
            book,
            current(),
            audio.ended || current() >= book.audio.duration,
          ),
        ),
      );
    } catch {
      /* Playback remains available. */
    }
  }
  function render() {
    const time = current(),
      i = segmentAt(book, time);
    get("[data-book-position]").textContent =
      `${book.segments[i].label} · ${audioClock(time)}`;
    get("[data-book-time]").textContent =
      `${audioClock((book.audio.duration - time) / Number(speed.value))} remaining at ${speed.value}×`;
    updatePlayback();
    seek.value = String(time);
    seek.setAttribute(
      "aria-valuetext",
      `${audioClock(time)} of ${audioClock(book.audio.duration)}`,
    );
  }
  function jump(time: number) {
    pending = Math.min(book.audio.duration, Math.max(0, time));
    if (loaded) {
      audio.currentTime = offset + pending;
      engaged = true;
      save();
    }
    render();
  }
  async function start() {
    if (current() >= book.audio.duration) jump(0);
    engaged = true;
    get("[data-book-controls]").hidden = false;
    try {
      await audio.play();
      get("[data-book-error]").hidden = true;
    } catch {
      get("[data-book-error]").hidden = false;
    }
  }
  audio.addEventListener("loadedmetadata", () => {
    loaded = true;
    audio.currentTime = offset + pending;
    render();
  });
  audio.addEventListener("timeupdate", () => {
    if (
      book.scope &&
      loaded &&
      current() >= book.audio.duration &&
      !audio.paused
    ) {
      audio.pause();
      audio.currentTime = offset + book.audio.duration;
    }
    render();
    if (Date.now() - lastSaved > 5000) {
      save();
      lastSaved = Date.now();
    }
  });
  audio.addEventListener("play", () => {
    render();
  });
  audio.addEventListener("pause", () => {
    save();
    render();
  });
  audio.addEventListener("ended", () => {
    save();
    render();
    get("[data-book-notice]").textContent =
      "You have reached the end of this edition.";
  });
  audio.addEventListener("error", () => {
    get("[data-book-error]").hidden = false;
  });
  get<HTMLButtonElement>("[data-book-retry]").onclick = () => {
    pending = current();
    loaded = false;
    audio.load();
    void start();
  };
  seek.oninput = () => jump(Number(seek.value));
  get<HTMLButtonElement>("[data-book-back]").onclick = () =>
    jump(current() - 15);
  get<HTMLButtonElement>("[data-book-forward]").onclick = () =>
    jump(current() + 15);
  speed.onchange = () => {
    audio.defaultPlaybackRate = Number(speed.value);
    audio.playbackRate = Number(speed.value);
    render();
  };
  audio.defaultPlaybackRate = 1.1;
  audio.playbackRate = 1.1;
  window.addEventListener("pagehide", () => {
    save();
    audio.pause();
  });
  const target = new URL(location.href).searchParams.get("listen");
  const selected = book.segments.findIndex((s) => s.placement === target);
  if (selected >= 0) pending = book.audio.timings[selected].start;
  audio.controls = false;
  audio.hidden = true;
  play.hidden = false;
  get("[data-book-controls]").hidden = false;
  get("[data-book-native]").hidden = true;
  render();
}
for (const panel of document.querySelectorAll<HTMLElement>("[data-audiobook]"))
  mountAudiobook(panel);
