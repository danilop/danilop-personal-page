import { bindPlaybackButton } from "./audio-playback.js";
import {
  audioClock,
  captureProgress,
  readProgress,
  restoreProgress,
  segmentAt,
  type AudioMap,
} from "./audiobook-progress";
type PlayerBook = AudioMap & { title: string; author: string; bookId: string };
function mount(panel: HTMLElement) {
  const get = <T extends HTMLElement>(s: string) => panel.querySelector<T>(s)!;
  const book = JSON.parse(get("[data-book-map]").textContent) as PlayerBook;
  const audio = get<HTMLAudioElement>("audio"),
    play = get<HTMLButtonElement>("[data-book-play]"),
    seek = get<HTMLInputElement>("[data-book-seek]"),
    speed = get<HTMLSelectElement>("[data-book-speed]");
  const key = "audiobook:v1:" + book.bookId;
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
  const current = () => (loaded ? audio.currentTime : pending);
  const updatePlayback = bindPlaybackButton(play, audio, {
    label: "Listen to this book",
    title: book.title,
    position: current,
    start,
  });
  function save() {
    if (!engaged || !loaded) return;
    try {
      localStorage.setItem(
        key,
        JSON.stringify(captureProgress(book, audio.currentTime, audio.ended)),
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
    for (const button of panel.querySelectorAll<HTMLButtonElement>(
      "[data-book-chapter]",
    ))
      button.setAttribute(
        "aria-current",
        String(Number(button.dataset.bookChapter) === navigationIndex(i)),
      );
  }
  const chapters = [
    ...panel.querySelectorAll<HTMLButtonElement>("[data-book-chapter]"),
  ].map((b) => Number(b.dataset.bookChapter));
  function navigationIndex(i: number) {
    return chapters.filter((n) => n <= i).at(-1) ?? 0;
  }
  function jump(time: number) {
    pending = Math.min(book.audio.duration, Math.max(0, time));
    if (loaded) {
      audio.currentTime = pending;
      engaged = true;
      save();
    }
    render();
  }
  async function start() {
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
    audio.currentTime = pending;
    render();
  });
  audio.addEventListener("timeupdate", () => {
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
  get<HTMLButtonElement>("[data-book-previous]").onclick = () =>
    jump(
      book.audio.timings[
        chapters
          .filter((i) => book.audio.timings[i].start < current() - 1)
          .at(-1) ?? 0
      ].start,
    );
  get<HTMLButtonElement>("[data-book-next]").onclick = () => {
    const n = chapters.find(
      (i) => book.audio.timings[i].start > current() + 0.1,
    );
    if (n !== undefined) jump(book.audio.timings[n].start);
  };
  for (const button of panel.querySelectorAll<HTMLButtonElement>(
    "[data-book-chapter]",
  ))
    button.onclick = () => {
      jump(book.audio.timings[Number(button.dataset.bookChapter)].start);
      void start();
    };
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
  get("[data-book-chapters]").hidden = false;
  render();
}
for (const panel of document.querySelectorAll<HTMLElement>("[data-audiobook]"))
  mount(panel);
