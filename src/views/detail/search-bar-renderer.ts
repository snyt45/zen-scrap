export interface SearchBarDeps {
  container: HTMLElement;
  scrollContainer: HTMLElement;
}

export class SearchBar {
  private barEl: HTMLElement | null = null;
  private input: HTMLInputElement | null = null;
  private countEl: HTMLElement | null = null;
  private marks: HTMLElement[] = [];
  private currentIndex = -1;
  private deps: SearchBarDeps;

  constructor(deps: SearchBarDeps) {
    this.deps = deps;
  }

  toggle(): void {
    if (this.barEl) {
      this.close();
    } else {
      this.open();
    }
  }

  isOpen(): boolean {
    return this.barEl !== null;
  }

  private open(): void {
    const bar = document.createElement("div");
    bar.className = "zen-scrap-search-bar";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "zen-scrap-search-input";
    input.placeholder = "検索...";

    const countEl = document.createElement("span");
    countEl.className = "zen-scrap-search-count";

    const prevBtn = document.createElement("button");
    prevBtn.className = "zen-scrap-search-nav-btn";
    prevBtn.innerHTML = "&#8593;";
    prevBtn.addEventListener("click", () => this.navigate(-1));

    const nextBtn = document.createElement("button");
    nextBtn.className = "zen-scrap-search-nav-btn";
    nextBtn.innerHTML = "&#8595;";
    nextBtn.addEventListener("click", () => this.navigate(1));

    const closeBtn = document.createElement("button");
    closeBtn.className = "zen-scrap-search-nav-btn";
    closeBtn.innerHTML = "&#10005;";
    closeBtn.addEventListener("click", () => this.close());

    bar.appendChild(input);
    bar.appendChild(countEl);
    bar.appendChild(prevBtn);
    bar.appendChild(nextBtn);
    bar.appendChild(closeBtn);

    this.deps.container.insertBefore(bar, this.deps.container.firstChild);
    this.barEl = bar;
    this.input = input;
    this.countEl = countEl;

    input.addEventListener("input", () => this.search(input.value));
    input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        this.close();
      } else if (e.key === "Enter") {
        e.preventDefault();
        this.navigate(e.shiftKey ? -1 : 1);
      }
    });

    input.focus();
  }

  close(): void {
    this.clearHighlights();
    this.barEl?.remove();
    this.barEl = null;
    this.input = null;
    this.countEl = null;
    this.marks = [];
    this.currentIndex = -1;
  }

  private search(query: string): void {
    this.clearHighlights();
    this.marks = [];
    this.currentIndex = -1;

    if (!query) {
      this.updateCount();
      return;
    }

    const timeline = this.deps.scrollContainer.querySelector(".zen-scrap-timeline");
    if (!timeline) return;

    const walker = document.createTreeWalker(timeline, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest(".zen-scrap-search-bar")) return NodeFilter.FILTER_REJECT;
        if (parent.tagName === "SCRIPT" || parent.tagName === "STYLE") return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const textNodes: Text[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      textNodes.push(node as Text);
    }

    const queryLower = query.toLowerCase();
    for (const textNode of textNodes) {
      const text = textNode.textContent || "";
      const textLower = text.toLowerCase();
      let startPos = 0;
      const fragments: (string | HTMLElement)[] = [];
      let lastEnd = 0;

      while (startPos < textLower.length) {
        const idx = textLower.indexOf(queryLower, startPos);
        if (idx === -1) break;
        if (idx > lastEnd) {
          fragments.push(text.slice(lastEnd, idx));
        }
        const mark = document.createElement("mark");
        mark.className = "zen-scrap-search-highlight";
        mark.textContent = text.slice(idx, idx + query.length);
        fragments.push(mark);
        this.marks.push(mark);
        lastEnd = idx + query.length;
        startPos = lastEnd;
      }

      if (fragments.length > 0) {
        if (lastEnd < text.length) {
          fragments.push(text.slice(lastEnd));
        }
        const parent = textNode.parentNode!;
        for (const frag of fragments) {
          if (typeof frag === "string") {
            parent.insertBefore(document.createTextNode(frag), textNode);
          } else {
            parent.insertBefore(frag, textNode);
          }
        }
        parent.removeChild(textNode);
      }
    }

    if (this.marks.length > 0) {
      this.currentIndex = 0;
      this.setCurrent(0);
    }
    this.updateCount();
  }

  private navigate(direction: number): void {
    if (this.marks.length === 0) return;
    this.marks[this.currentIndex]?.classList.remove("is-current");
    this.currentIndex = (this.currentIndex + direction + this.marks.length) % this.marks.length;
    this.setCurrent(this.currentIndex);
    this.updateCount();
  }

  private setCurrent(index: number): void {
    const mark = this.marks[index];
    if (!mark) return;
    mark.classList.add("is-current");
    mark.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  private updateCount(): void {
    if (!this.countEl) return;
    if (this.marks.length === 0) {
      this.countEl.textContent = this.input?.value ? "0件" : "";
    } else {
      this.countEl.textContent = `${this.currentIndex + 1}/${this.marks.length}`;
    }
  }

  private clearHighlights(): void {
    for (const mark of this.marks) {
      const parent = mark.parentNode;
      if (!parent) continue;
      parent.replaceChild(document.createTextNode(mark.textContent || ""), mark);
      parent.normalize();
    }
    this.marks = [];
    this.currentIndex = -1;
  }
}
