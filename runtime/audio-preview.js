import { controlIcon } from "./control-icons.js";
import { bindPlaybackButton } from "./audio-playback.js";

const clock = (value) => {
  const seconds = Number.isFinite(value) ? Math.max(0, value) : 0;
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
};

/** Enhance private audio without changing source selection or audition jobs.
 * @param {HTMLAudioElement} audio
 */
export function mountVoicePreview(audio) {
  const panel = audio.ownerDocument.createElement("div");
  panel.className = "voice-preview audio-surface";
  panel.hidden = audio.hidden;
  panel.innerHTML = `<p class="listening-heading icon-label-button">${controlIcon("headphones")}<span>Listen to preview</span></p><button type="button" data-preview-play></button>
    <div class="voice-preview-controls">
      <button type="button" data-preview-back aria-label="Back 15 seconds">−15s</button>
      <input type="range" data-preview-seek min="0" max="0" step="0.1" value="0" aria-label="Playback position">
      <button type="button" data-preview-forward aria-label="Forward 15 seconds">+15s</button>
      <output data-preview-time>0:00 / 0:00</output>
      <select data-preview-speed aria-label="Playback speed">${[0.8, 1, 1.1, 1.2, 1.5, 2].map((v) => `<option value="${v}" ${v === 1.1 ? "selected" : ""}>${v}×</option>`).join("")}</select>
    </div>
    <p data-preview-error role="status" hidden>Audio could not be loaded. <button type="button" data-preview-retry>Retry</button></p>`;
  const get = (selector) => panel.querySelector(selector);
  const error = get("[data-preview-error]");
  const start = async () => {
    try {
      await audio.play();
      error.hidden = true;
    } catch {
      error.hidden = false;
    }
  };
  bindPlaybackButton(get("[data-preview-play]"), audio, {
    label: "Listen to preview",
    title: audio.getAttribute("aria-label") || "Voice preview",
    start,
  });
  const seek = get("[data-preview-seek]");
  function update() {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    seek.max = String(duration);
    seek.value = String(audio.currentTime);
    seek.disabled = duration === 0;
    seek.setAttribute(
      "aria-valuetext",
      `${clock(audio.currentTime)} of ${clock(duration)}`,
    );
    get("[data-preview-time]").textContent =
      `${clock(audio.currentTime)} / ${clock(duration)}`;
  }
  const jump = (time) => {
    if (Number.isFinite(audio.duration))
      audio.currentTime = Math.max(0, Math.min(audio.duration, time));
    update();
  };
  seek.oninput = () => jump(Number(seek.value));
  get("[data-preview-back]").onclick = () => jump(audio.currentTime - 15);
  get("[data-preview-forward]").onclick = () => jump(audio.currentTime + 15);
  get("[data-preview-speed]").onchange = (event) => {
    audio.defaultPlaybackRate = Number(event.target.value);
    audio.playbackRate = audio.defaultPlaybackRate;
  };
  get("[data-preview-retry]").onclick = () => {
    audio.load();
    void start();
  };
  for (const event of ["timeupdate", "loadedmetadata", "emptied"])
    audio.addEventListener(event, update);
  audio.addEventListener("error", () => {
    error.hidden = false;
  });
  audio.addEventListener("emptied", () => {
    error.hidden = true;
  });
  const visibility = new MutationObserver(() => {
    panel.hidden = audio.hidden;
  });
  visibility.observe(audio, { attributes: true, attributeFilter: ["hidden"] });
  audio.before(panel);
  audio.dataset.enhancedPreview = "";
  audio.controls = false;
  audio.defaultPlaybackRate = 1.1;
  audio.playbackRate = 1.1;
  update();
  return panel;
}

for (const audio of document.querySelectorAll("audio[data-voice-preview]"))
  mountVoicePreview(audio);
