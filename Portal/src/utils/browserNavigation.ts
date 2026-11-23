/** A mockable wrapper: jsdom cannot navigate, and tests assert the destination instead. */
export function assignLocation(url: string): void {
  window.location.assign(url);
}
