import { chevronDownIcon } from "../../icons";

export interface DropdownOption {
  value: string;
  label: string;
}

export function renderDropdown(
  parent: HTMLElement,
  label: string,
  defaultValue: string,
  options: DropdownOption[],
  currentValue: string,
  onChange: (value: string) => void,
  addDocumentClickHandler: (handler: () => void) => void,
): void {
  const wrapper = parent.createDiv({ cls: "zen-scrap-dropdown" });

  const isDefault = currentValue === defaultValue;
  const displayText = isDefault ? label : options.find((o) => o.value === currentValue)?.label || label;

  const btn = wrapper.createEl("button", { cls: "zen-scrap-dropdown-btn" });
  btn.createSpan({ text: displayText });
  const arrow = btn.createSpan({ cls: "zen-scrap-dropdown-arrow" });
  arrow.innerHTML = chevronDownIcon(12);

  if (!isDefault) {
    btn.classList.add("is-filtered");
  }

  const menu = wrapper.createDiv({ cls: "zen-scrap-dropdown-menu" });

  for (const opt of options) {
    const item = menu.createDiv({ cls: "zen-scrap-dropdown-item" });
    item.setText(opt.label);
    if (opt.value === currentValue) {
      item.addClass("zen-scrap-dropdown-item-active");
    }
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.remove("is-open");
      onChange(opt.value);
    });
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = menu.classList.contains("is-open");
    parent.querySelectorAll<HTMLElement>(".zen-scrap-dropdown-menu").forEach((m) => {
      m.classList.remove("is-open");
    });
    if (!isOpen) menu.classList.add("is-open");
  });

  // 外側クリックで閉じる
  const closeDropdown = () => { menu.classList.remove("is-open"); };
  document.addEventListener("click", closeDropdown);
  addDocumentClickHandler(closeDropdown);
}
