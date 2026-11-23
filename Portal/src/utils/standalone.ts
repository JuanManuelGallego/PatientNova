function iosStandaloneFlag(): boolean | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { standalone?: boolean }).standalone;
}

export function isIosHomeScreenApp(): boolean {
  return iosStandaloneFlag() === true;
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const byMedia = typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches;
  return byMedia || isIosHomeScreenApp();
}

export function isIosSafariBrowser(): boolean {
  return iosStandaloneFlag() === false;
}
