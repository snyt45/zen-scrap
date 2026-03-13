const MINIMAP_WIDTH = 90;
const SCALE_X = MINIMAP_WIDTH / 700;
const MIN_LINE_HEIGHT = 1;
const VIEWPORT_COLOR = "rgba(120, 120, 120, 0.25)";
const TEXT_COLOR = "rgba(140, 140, 140, 0.6)";
const HEADING_COLOR = "rgba(140, 140, 140, 0.9)";
const SEPARATOR_COLOR = "rgba(140, 140, 140, 0.3)";

const EMBED_COLORS: Record<string, string> = {
  youtube: "rgba(255, 0, 0, 0.3)",
  card: "rgba(59, 130, 246, 0.3)",
  github: "rgba(34, 197, 94, 0.3)",
  tweet: "rgba(29, 155, 240, 0.3)",
};

interface MinimapState {
  canvas: HTMLCanvasElement;
  wrapper: HTMLElement;
  timeline: HTMLElement;
  scrollContainer: HTMLElement;
  visible: boolean;
  isDragging: boolean;
  contentHeight: number;
  resizeObserver: ResizeObserver | null;
  abortController: AbortController;
}

export function createMinimap(
  parentContainer: HTMLElement,
  timeline: HTMLElement,
  scrollContainer: HTMLElement,
): MinimapState {
  const wrapper = parentContainer.createDiv({ cls: "zen-scrap-minimap-wrapper" });
  const canvas = wrapper.createEl("canvas", { cls: "zen-scrap-minimap-canvas" });
  canvas.width = MINIMAP_WIDTH;

  const state: MinimapState = {
    canvas,
    wrapper,
    timeline,
    scrollContainer,
    visible: false,
    isDragging: false,
    contentHeight: 0,
    resizeObserver: null,
    abortController: new AbortController(),
  };

  setupMinimapInteraction(state);
  setupScrollSync(state);

  return state;
}

export function showMinimap(state: MinimapState): void {
  state.visible = true;
  state.wrapper.style.display = "";
  state.timeline.style.paddingRight = (MINIMAP_WIDTH + 8) + "px";
  drawMinimap(state);
  setupResizeObserver(state);
}

export function hideMinimap(state: MinimapState): void {
  state.visible = false;
  state.wrapper.style.display = "none";
  state.timeline.style.paddingRight = "";
  if (state.resizeObserver) {
    state.resizeObserver.disconnect();
    state.resizeObserver = null;
  }
}

export function toggleMinimap(state: MinimapState): void {
  if (state.visible) {
    hideMinimap(state);
  } else {
    showMinimap(state);
  }
}

export function destroyMinimap(state: MinimapState): void {
  hideMinimap(state);
  state.abortController.abort();
  state.wrapper.remove();
}

export function redrawMinimap(state: MinimapState): void {
  if (!state.visible) return;
  drawMinimap(state);
}

function drawMinimap(state: MinimapState): void {
  const { canvas, timeline, scrollContainer } = state;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const timelineHeight = timeline.scrollHeight;
  if (timelineHeight === 0) return;

  const containerHeight = scrollContainer.clientHeight;
  const canvasDisplayHeight = Math.min(containerHeight, 600);

  if (canvas.height !== canvasDisplayHeight) {
    canvas.height = canvasDisplayHeight;
    canvas.style.height = canvasDisplayHeight + "px";
  } else {
    ctx.clearRect(0, 0, MINIMAP_WIDTH, canvasDisplayHeight);
  }

  const scaleY = canvasDisplayHeight / timelineHeight;
  state.contentHeight = timelineHeight;

  const entries = Array.from(timeline.querySelectorAll(".zen-scrap-entry")) as HTMLElement[];
  entries.forEach((entry) => {
    const entryTop = (entry.offsetTop - timeline.offsetTop) * scaleY;

    const header = entry.querySelector(".zen-scrap-entry-header") as HTMLElement | null;
    if (header) {
      const y = entryTop;
      ctx.fillStyle = HEADING_COLOR;
      ctx.fillRect(2, y, MINIMAP_WIDTH * 0.4, Math.max(2, 3 * scaleY));
    }

    const body = entry.querySelector(".zen-scrap-entry-body") as HTMLElement | null;
    if (body) {
      drawBodyContent(ctx, body, timeline.offsetTop, entryTop, scaleY);
    }
  });

  entries.forEach((entry) => {
    const bottom = (entry.offsetTop - timeline.offsetTop + entry.offsetHeight) * scaleY;
    ctx.fillStyle = SEPARATOR_COLOR;
    ctx.fillRect(0, bottom, MINIMAP_WIDTH, 1);
  });

  const scrollTop = scrollContainer.scrollTop;
  const vpTop = scrollTop * scaleY;
  const vpHeight = containerHeight * scaleY;
  ctx.fillStyle = VIEWPORT_COLOR;
  ctx.fillRect(0, vpTop, MINIMAP_WIDTH, vpHeight);
}

function drawBodyContent(
  ctx: CanvasRenderingContext2D,
  body: HTMLElement,
  timelineOffsetTop: number,
  _entryTop: number,
  scaleY: number,
): void {
  const entryEl = body.closest(".zen-scrap-entry") as HTMLElement;
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT);
  let node: Node | null = walker.currentNode;

  while (node) {
    const el = node as HTMLElement;

    const embedMatch = detectEmbedElement(el);
    if (embedMatch) {
      const rect = el.getBoundingClientRect();
      const top = (el.offsetTop + body.offsetTop - timelineOffsetTop + entryEl.offsetTop) * scaleY;
      const height = Math.max(4, rect.height * scaleY);
      ctx.fillStyle = EMBED_COLORS[embedMatch] || EMBED_COLORS.card;
      ctx.fillRect(4, top, MINIMAP_WIDTH - 8, height);
      node = walker.nextNode();
      continue;
    }

    if (isTextBlock(el)) {
      const top = (el.offsetTop + body.offsetTop - timelineOffsetTop + entryEl.offsetTop) * scaleY;
      const height = Math.max(MIN_LINE_HEIGHT, el.offsetHeight * scaleY);
      const indent = getIndentLevel(el, body) * 4;
      const width = Math.min(MINIMAP_WIDTH - 4 - indent, el.scrollWidth * SCALE_X);

      ctx.fillStyle = el.tagName.match(/^H[1-6]$/) ? HEADING_COLOR : TEXT_COLOR;
      ctx.fillRect(2 + indent, top, Math.max(8, width), Math.max(MIN_LINE_HEIGHT, height * 0.6));
    }

    node = walker.nextNode();
  }
}

function detectEmbedElement(el: HTMLElement): string | null {
  const cls = el.className;
  if (typeof cls !== "string") return null;
  if (!cls && !el.dataset.embedType && el.tagName !== "IFRAME") return null;
  if (cls.includes("embed-youtube") || (el.tagName === "IFRAME" && el.getAttribute("src")?.includes("youtube"))) return "youtube";
  if (cls.includes("embed-tweet") || el.dataset.embedType === "tweet") return "tweet";
  if (cls.includes("embed-card") || el.dataset.embedType === "card") return "card";
  if (cls.includes("embed-github") || el.dataset.embedType === "github") return "github";
  return null;
}

function isTextBlock(el: HTMLElement): boolean {
  return /^(P|LI|H[1-6]|TD|TH|BLOCKQUOTE|PRE)$/.test(el.tagName);
}

function getIndentLevel(el: HTMLElement, boundary: HTMLElement): number {
  let level = 0;
  let parent = el.parentElement;
  while (parent && parent !== boundary) {
    if (parent.tagName === "UL" || parent.tagName === "OL" || parent.tagName === "BLOCKQUOTE") level++;
    parent = parent.parentElement;
  }
  return level;
}

function setupMinimapInteraction(state: MinimapState): void {
  const { canvas, scrollContainer } = state;
  const signal = state.abortController.signal;

  const scrollToPosition = (clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    const ratio = (clientY - rect.top) / rect.height;
    const targetScroll = ratio * state.contentHeight - scrollContainer.clientHeight / 2;
    scrollContainer.scrollTop = Math.max(0, targetScroll);
  };

  canvas.addEventListener("mousedown", (e: MouseEvent) => {
    e.preventDefault();
    state.isDragging = true;
    scrollToPosition(e.clientY);
  }, { signal });

  document.addEventListener("mousemove", (e: MouseEvent) => {
    if (!state.isDragging) return;
    e.preventDefault();
    scrollToPosition(e.clientY);
  }, { signal });

  document.addEventListener("mouseup", () => {
    state.isDragging = false;
  }, { signal });
}

function setupScrollSync(state: MinimapState): void {
  let ticking = false;
  state.scrollContainer.addEventListener("scroll", () => {
    if (!state.visible || ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      drawMinimap(state);
      ticking = false;
    });
  }, { signal: state.abortController.signal });
}

function setupResizeObserver(state: MinimapState): void {
  if (state.resizeObserver) state.resizeObserver.disconnect();
  let debounceTimer: number;
  state.resizeObserver = new ResizeObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      if (state.visible) drawMinimap(state);
    }, 150);
  });
  state.resizeObserver.observe(state.timeline);
}
