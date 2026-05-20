export function releaseMobileInputViewport() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement) {
    const tagName = activeElement.tagName.toLowerCase();
    const editable = activeElement.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";
    if (editable) activeElement.blur();
  }

  resetHorizontalScroll();
  window.setTimeout(resetHorizontalScroll, 80);
}

function resetHorizontalScroll() {
  document.documentElement.scrollLeft = 0;
  document.body.scrollLeft = 0;
  window.scrollTo({
    left: 0,
    top: window.scrollY,
    behavior: "auto"
  });
}
