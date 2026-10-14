import { bindPlaybackButton } from "./audio-playback.js";
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
for (const panel of document.querySelectorAll<HTMLElement>(
  "[data-narration]",
)) {
  const get = <T extends HTMLElement>(selector: string) =>
    panel.querySelector<T>(selector)!;
  const audio = get<HTMLAudioElement>("audio"),
    play = get<HTMLButtonElement>("[data-play]"),
    seek = get<HTMLInputElement>("[data-seek]"),
    speed = get<HTMLSelectElement>("[data-speed]");
  const duration = Number(panel.dataset.duration),
    key = "narration:" + panel.dataset.hash;
  let resume = 0,
    restored = false,
    lastSaved = 0;
  try {
    resume = Number(localStorage.getItem(key) ?? 0);
  } catch {
    /* Storage may be disabled. */
  }
  if (!Number.isFinite(resume) || resume <= 0 || resume >= duration - 3)
    resume = 0;
  const error = get("[data-error]");
  const start = async () => {
    get("[data-controls]").hidden = false;
    try {
      await audio.play();
      error.hidden = true;
    } catch {
      error.hidden = false;
    }
  };
  bindPlaybackButton(play, audio, {
    label: "Listen to this article",
    title: panel.dataset.title!,
    position: () => (restored ? audio.currentTime : resume),
    start,
  });
  get<HTMLButtonElement>("[data-retry]").onclick = () => {
    audio.load();
    void start();
  };
  audio.addEventListener("loadedmetadata", () => {
    seek.max = String(audio.duration);
    if (
      !restored &&
      Number.isFinite(resume) &&
      resume > 0 &&
      resume < audio.duration - 3
    )
      audio.currentTime = resume;
    restored = true;
  });
  function savePosition() {
    // A visit without loading audio must preserve the previous listening position.
    if (!restored) return;
    try {
      localStorage.setItem(key, String(audio.ended ? 0 : audio.currentTime));
    } catch {
      /* Reading remains available without storage. */
    }
  }
  audio.addEventListener("pause", () => {
    savePosition();
  });
  audio.addEventListener("ended", () => {
    savePosition();
  });
  audio.addEventListener("error", () => {
    error.hidden = false;
  });
  audio.addEventListener("timeupdate", () => {
    seek.value = String(audio.currentTime);
    const label = `${clock(audio.currentTime)} / ${clock(duration)}`;
    get<HTMLOutputElement>("[data-time]").value = label;
    seek.setAttribute(
      "aria-valuetext",
      `${clock(audio.currentTime)} of ${clock(duration)}`,
    );
    if (Date.now() - lastSaved > 5000) {
      savePosition();
      lastSaved = Date.now();
    }
  });
  const jump = (value: number) => {
    if (Number.isFinite(audio.duration))
      audio.currentTime = Math.min(audio.duration, Math.max(0, value));
  };
  seek.oninput = () => jump(Number(seek.value));
  get<HTMLButtonElement>("[data-back]").onclick = () =>
    jump(audio.currentTime - 15);
  get<HTMLButtonElement>("[data-forward]").onclick = () =>
    jump(audio.currentTime + 15);
  const applySpeed = () => {
    audio.defaultPlaybackRate = Number(speed.value);
    audio.playbackRate = audio.defaultPlaybackRate;
    get("[data-listening-duration]").textContent =
      `${clock(duration / audio.playbackRate)} listen at ${audio.playbackRate}×`;
  };
  speed.onchange = applySpeed;
  applySpeed();
  window.addEventListener("pagehide", () => {
    savePosition();
    audio.pause();
  });
  audio.controls = false;
  audio.hidden = true;
  play.hidden = false;
  get("[data-native-label]").hidden = true;
}
export {};
