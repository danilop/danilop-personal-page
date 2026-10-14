// Shared by public players and private voice auditions. SVGs are decorative;
// the visible action is also the button's accessible name.
export const playbackIcons = `<svg data-audio-play-icon aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg><svg data-audio-pause-icon aria-hidden="true" focusable="false" viewBox="0 0 24 24" hidden><path d="M6 5h4v14H6zm8 0h4v14h-4z" fill="currentColor"/></svg>`;
const listeningDocuments = new WeakSet();

/**
 * @param {HTMLButtonElement} button
 * @param {HTMLAudioElement} audio
 * @param {{label: string, title: string, position?: () => number, start: () => void | Promise<void>}} options
 */
export function bindPlaybackButton(button, audio, options) {
  button.classList.add("audio-playback-button");
  button.innerHTML = playbackIcons + "<span data-play-label></span>";
  const label = button.querySelector("[data-play-label]");
  const play = button.querySelector("[data-audio-play-icon]");
  const pause = button.querySelector("[data-audio-pause-icon]");
  const update = () => {
    const playing = !audio.paused && !audio.ended;
    const action = playing
      ? "Pause"
      : audio.ended
        ? "Listen again"
        : (options.position?.() ?? audio.currentTime) > 0
          ? "Continue listening"
          : options.label;
    label.textContent = action;
    button.setAttribute("aria-label", `${action}: ${options.title}`);
    button.dataset.playbackState = playing ? "playing" : "paused";
    play.toggleAttribute("hidden", playing);
    pause.toggleAttribute("hidden", !playing);
  };
  button.onclick = () => {
    if (audio.paused || audio.ended) void options.start();
    else audio.pause();
  };
  for (const event of [
    "play",
    "pause",
    "ended",
    "emptied",
    "loadedmetadata",
    "timeupdate",
  ])
    audio.addEventListener(event, update);
  const doc = audio.ownerDocument;
  if (!listeningDocuments.has(doc)) {
    doc.addEventListener(
      "play",
      (event) => {
        for (const media of doc.querySelectorAll("audio,video"))
          if (media !== event.target) media.pause();
      },
      true,
    );
    listeningDocuments.add(doc);
  }
  update();
  return update;
}
