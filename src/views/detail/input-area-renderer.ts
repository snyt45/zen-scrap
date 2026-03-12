import { App, Modal, Scope } from "obsidian";
import { Scrap } from "../../data/types";
import { ScrapRepository } from "../../data/scrap-repository";
import { EmbedModal, EmbedType } from "../../ui/embed-modal";
import { MarkdownRenderer } from "./markdown-renderer";
import markdownGuideRaw from "../../../docs/markdown-guide.md";
import sampleImageUrl from "../../../assets/sample.png";
import type { ZenScrapSettings } from "../../settings";

const EMPTY_PREVIEW_HTML = '<p style="color: var(--text-muted)">プレビューする内容がありません</p>';

export interface InputAreaDeps {
  scrap: Scrap;
  repo: ScrapRepository;
  app: App;
  settings: ZenScrapSettings;
  scope: Scope | null;
  markdownRenderer: MarkdownRenderer;
  render: () => Promise<void>;
  addDocumentClickHandler: (handler: () => void) => void;
  setScrap: (scrap: Scrap) => void;
}

export interface EntryEditorDeps extends InputAreaDeps {
  entryEl: HTMLElement;
  entryBody: HTMLElement;
  index: number;
}

export function renderInputArea(container: HTMLElement, deps: InputAreaDeps): void {
  const { scrap, repo, app, markdownRenderer, render } = deps;
  const inputArea = container.createDiv({ cls: "zen-scrap-input-area" });

  const tabHeader = inputArea.createDiv({ cls: "zen-scrap-pill-tabs" });
  const mdTab = tabHeader.createEl("button", { text: "Markdown", cls: "zen-scrap-pill-tab zen-scrap-pill-tab-active" });
  const pvTab = tabHeader.createEl("button", { text: "Preview", cls: "zen-scrap-pill-tab" });
  renderMarkdownGuideLink(tabHeader, deps);

  const textarea = inputArea.createEl("textarea", {
    placeholder: "スクラップにコメントを追加",
    cls: "zen-scrap-textarea",
  });
  setupAutoGrow(textarea);
  setupImageDrop(textarea, deps);

  const preview = inputArea.createDiv({ cls: "zen-scrap-preview znc" });
  preview.style.display = "none";

  mdTab.addEventListener("click", () => {
    mdTab.addClass("zen-scrap-pill-tab-active");
    pvTab.removeClass("zen-scrap-pill-tab-active");
    textarea.style.display = "";
    preview.style.display = "none";
  });

  pvTab.addEventListener("click", async () => {
    pvTab.addClass("zen-scrap-pill-tab-active");
    mdTab.removeClass("zen-scrap-pill-tab-active");
    textarea.style.display = "none";
    preview.style.display = "";
    if (textarea.value.trim()) {
      preview.innerHTML = await markdownRenderer.renderBody(textarea.value);
      markdownRenderer.addCopyButtons(preview);
      markdownRenderer.addLinkHandler(preview);
    } else {
      preview.innerHTML = EMPTY_PREVIEW_HTML;
    }
  });

  const actionBar = inputArea.createDiv({ cls: "zen-scrap-action-bar" });

  const imgBtn = actionBar.createEl("button", { text: "画像", cls: "zen-scrap-img-btn" });
  imgBtn.addEventListener("click", () => handleImageUpload(textarea, deps));

  renderEmbedButton(actionBar, textarea, deps);

  const submitBtn = actionBar.createEl("button", { text: "ポストする", cls: "zen-scrap-submit-btn-new zen-scrap-ml-auto" });
  submitBtn.addEventListener("click", async () => {
    const body = textarea.value.trim();
    if (!body || !scrap) return;
    const updated = await repo.addEntry(scrap, body);
    deps.setScrap(updated);
    await render();
  });

  const submitScope = new Scope(deps.scope ?? undefined);
  submitScope.register(["Mod"], "Enter", (e: KeyboardEvent) => {
    e.preventDefault();
    submitBtn.click();
    return false;
  });
  textarea.addEventListener("focus", () => app.keymap.pushScope(submitScope));
  textarea.addEventListener("blur", () => app.keymap.popScope(submitScope));
}

export function renderEntryEditor(deps: EntryEditorDeps): void {
  const { scrap, repo, app, markdownRenderer, render, entryEl, entryBody, index } = deps;
  const entry = scrap.entries[index];

  entryBody.style.display = "none";
  const editArea = entryEl.createDiv({ cls: "zen-scrap-entry-edit" });

  const tabHeader = editArea.createDiv({ cls: "zen-scrap-pill-tabs" });
  const mdTab = tabHeader.createEl("button", { text: "Markdown", cls: "zen-scrap-pill-tab zen-scrap-pill-tab-active" });
  const pvTab = tabHeader.createEl("button", { text: "Preview", cls: "zen-scrap-pill-tab" });
  renderMarkdownGuideLink(tabHeader, deps);

  const textarea = editArea.createEl("textarea", {
    cls: "zen-scrap-textarea",
  });
  textarea.value = entry.body;
  setupAutoGrow(textarea);
  setupImageDrop(textarea, deps);
  requestAnimationFrame(() => {
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  });

  const preview = editArea.createDiv({ cls: "zen-scrap-preview znc" });
  preview.style.display = "none";

  mdTab.addEventListener("click", () => {
    mdTab.addClass("zen-scrap-pill-tab-active");
    pvTab.removeClass("zen-scrap-pill-tab-active");
    textarea.style.display = "";
    preview.style.display = "none";
  });

  pvTab.addEventListener("click", async () => {
    pvTab.addClass("zen-scrap-pill-tab-active");
    mdTab.removeClass("zen-scrap-pill-tab-active");
    textarea.style.display = "none";
    preview.style.display = "";
    if (textarea.value.trim()) {
      preview.innerHTML = await markdownRenderer.renderBody(textarea.value);
      markdownRenderer.addCopyButtons(preview);
      markdownRenderer.addLinkHandler(preview);
    } else {
      preview.innerHTML = EMPTY_PREVIEW_HTML;
    }
  });

  const actionBar = editArea.createDiv({ cls: "zen-scrap-action-bar" });

  const imgBtn = actionBar.createEl("button", { text: "画像", cls: "zen-scrap-img-btn" });
  imgBtn.addEventListener("click", () => handleImageUpload(textarea, deps));

  renderEmbedButton(actionBar, textarea, deps);

  const cancelBtn = actionBar.createEl("button", { text: "キャンセル", cls: "zen-scrap-edit-cancel-btn" });

  const updateBtn = actionBar.createEl("button", { text: "更新する", cls: "zen-scrap-submit-btn-new" });

  cancelBtn.addEventListener("click", () => {
    editArea.remove();
    entryBody.style.display = "";
  });

  updateBtn.addEventListener("click", async () => {
    const body = textarea.value.trim();
    if (!body || !scrap) return;
    scrap.entries[index].body = body;
    scrap.updated = new Date().toISOString();
    await repo.save(scrap);
    await render();
  });

  const updateScope = new Scope(deps.scope ?? undefined);
  updateScope.register(["Mod"], "Enter", (e: KeyboardEvent) => {
    e.preventDefault();
    updateBtn.click();
    return false;
  });
  textarea.addEventListener("focus", () => app.keymap.pushScope(updateScope));
  textarea.addEventListener("blur", () => app.keymap.popScope(updateScope));

  textarea.focus();
}

async function uploadAndInsert(file: File, textarea: HTMLTextAreaElement, deps: InputAreaDeps): Promise<void> {
  const buffer = await file.arrayBuffer();
  const fileName = `${Date.now()}-${file.name}`;
  const folderPath = deps.settings.imagesFolder;

  if (!deps.app.vault.getAbstractFileByPath(folderPath)) {
    await deps.app.vault.createFolder(folderPath);
  }

  const filePath = `${folderPath}/${fileName}`;
  await deps.app.vault.createBinary(filePath, buffer);

  const syntax = `![](${filePath})`;
  const pos = textarea.selectionStart;
  const before = textarea.value.substring(0, pos);
  const after = textarea.value.substring(pos);
  textarea.value = before + syntax + "\n" + after;
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = pos + syntax.length + 1;
}

function handleImageUpload(textarea: HTMLTextAreaElement, deps: InputAreaDeps): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    await uploadAndInsert(file, textarea, deps);
  });
  input.click();
}

function setupImageDrop(textarea: HTMLTextAreaElement, deps: InputAreaDeps): void {
  textarea.addEventListener("dragover", (e) => {
    e.preventDefault();
    textarea.addClass("zen-scrap-textarea-dragover");
  });

  textarea.addEventListener("dragleave", () => {
    textarea.removeClass("zen-scrap-textarea-dragover");
  });

  textarea.addEventListener("drop", async (e) => {
    e.preventDefault();
    textarea.removeClass("zen-scrap-textarea-dragover");
    const files = e.dataTransfer?.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      if (!files[i].type.startsWith("image/")) continue;
      await uploadAndInsert(files[i], textarea, deps);
    }
  });
}

function renderEmbedButton(parent: HTMLElement, textarea: HTMLTextAreaElement, deps: InputAreaDeps): void {
  const wrapper = parent.createDiv({ cls: "zen-scrap-embed-wrapper" });
  const embedBtn = wrapper.createEl("button", { text: "+ 埋め込み", cls: "zen-scrap-embed-btn" });

  const menu = wrapper.createDiv({ cls: "zen-scrap-embed-menu" });
  menu.style.display = "none";

  const items: { label: string; type: EmbedType }[] = [
    { label: "X (Twitter)", type: "tweet" },
    { label: "YouTube", type: "youtube" },
    { label: "Web記事", type: "card" },
    { label: "GitHub", type: "github" },
  ];

  for (const item of items) {
    const menuItem = menu.createDiv({ cls: "zen-scrap-dropdown-item", text: item.label });
    menuItem.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.style.display = "none";
      new EmbedModal(deps.app, item.type, (syntax) => {
        const pos = textarea.selectionStart;
        const before = textarea.value.substring(0, pos);
        const after = textarea.value.substring(pos);
        textarea.value = before + syntax + "\n" + after;
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = pos + syntax.length + 1;
      }).open();
    });
  }

  embedBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.style.display = menu.style.display === "none" ? "" : "none";
  });

  const closeEmbedMenu = () => { menu.style.display = "none"; };
  deps.addDocumentClickHandler(closeEmbedMenu);
}

function renderMarkdownGuideLink(parent: HTMLElement, deps: InputAreaDeps): void {
  const link = parent.createEl("a", {
    text: "Markdownガイド",
    cls: "zen-scrap-md-guide-link",
    href: "#",
  });
  link.addEventListener("click", async (e) => {
    e.preventDefault();
    const content = markdownGuideRaw;
    const modal = new Modal(deps.app);
    modal.titleEl.setText("Markdown ガイド");
    modal.modalEl.addClass("zen-scrap-guide-modal");

    const tabHeader = modal.contentEl.createDiv({ cls: "zen-scrap-pill-tabs" });
    const pvTab = tabHeader.createEl("button", { text: "Preview", cls: "zen-scrap-pill-tab zen-scrap-pill-tab-active" });
    const mdTab = tabHeader.createEl("button", { text: "Markdown", cls: "zen-scrap-pill-tab" });

    const previewEl = modal.contentEl.createDiv({ cls: "znc zen-scrap-guide-content" });
    let guideHtml = await deps.markdownRenderer.renderBody(content);
    guideHtml = guideHtml.replace(/src="zen-scrap-sample-image"/, `src="${sampleImageUrl}"`);
    previewEl.innerHTML = guideHtml;
    deps.markdownRenderer.addCopyButtons(previewEl);
    deps.markdownRenderer.addLinkHandler(previewEl);

    const markdownEl = modal.contentEl.createEl("pre", { cls: "zen-scrap-guide-content zen-scrap-guide-raw" });
    markdownEl.createEl("code", { text: content });
    markdownEl.style.display = "none";

    pvTab.addEventListener("click", () => {
      pvTab.addClass("zen-scrap-pill-tab-active");
      mdTab.removeClass("zen-scrap-pill-tab-active");
      previewEl.style.display = "";
      markdownEl.style.display = "none";
    });
    mdTab.addEventListener("click", () => {
      mdTab.addClass("zen-scrap-pill-tab-active");
      pvTab.removeClass("zen-scrap-pill-tab-active");
      previewEl.style.display = "none";
      markdownEl.style.display = "";
    });

    modal.open();
  });
}

function setupAutoGrow(textarea: HTMLTextAreaElement): void {
  const adjust = () => {
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  };
  textarea.addEventListener("input", adjust);
}
