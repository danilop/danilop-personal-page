// Decorative icons shared by audio playback and executable article examples.
const paths = {
  play: '<path d="M8 5v14l11-7z" fill="currentColor"/>',
  pause: '<path d="M6 5h4v14H6zm8 0h4v14h-4z" fill="currentColor"/>',
  step: '<path d="M5 5v14l10-7zM17 5h2v14h-2z" fill="currentColor"/>',
  reset:
    '<path d="M4 10a8 8 0 1 1 1 7M4 4v6h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
};

/** @param {keyof typeof paths} name @param {boolean} [hidden] */
export function controlIcon(name, hidden = false) {
  return `<svg class="control-icon" data-control-icon="${name}" aria-hidden="true" focusable="false" viewBox="0 0 24 24"${hidden ? " hidden" : ""}>${paths[name]}</svg>`;
}
