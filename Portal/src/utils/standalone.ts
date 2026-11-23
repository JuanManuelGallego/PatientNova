/** `navigator.standalone` is defined only by iOS WebKit: true in the home-screen app, false in Safari. */
function iosStandaloneFlag(): boolean | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { standalone?: boolean }).standalone;
}

/** True inside the iOS home-screen app, where `<a download>` does nothing. */
export function isIosHomeScreenApp(): boolean {
  return iosStandaloneFlag() === true;
}

/** True when the app runs installed (any platform): display-mode standalone, or iOS `navigator.standalone`. */
export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const byMedia = typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches;
  return byMedia || isIosHomeScreenApp();
}

/** True in iOS Safari (a tab, not installed): the only place `navigator.standalone` is defined and false. */
export function isIosSafariBrowser(): boolean {
  return iosStandaloneFlag() === false;
}
