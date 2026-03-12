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

  const menu = wrapper.createDiv({ cls: "zen-scrap-dropdown-menu" });
  menu.style.display = "none";

  for (const opt of options) {
    const item = menu.createDiv({ cls: "zen-scrap-dropdown-item" });
    item.setText(opt.label);
    if (opt.value === currentValue) {
      item.addClass("zen-scrap-dropdown-item-active");
    }
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.style.display = "none";
      onChange(opt.value);
    });
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = menu.style.display !== "none";
    // 他のドロップダウンを閉じる
    parent.querySelectorAll<HTMLElement>(".zen-scrap-dropdown-menu").forEach((m) => {
      m.style.display = "none";
    });
    menu.style.display = isOpen ? "none" : "";
  });

  // 外側クリックで閉じる
  const closeDropdown = () => { menu.style.display = "none"; };
  document.addEventListener("click", closeDropdown);
  addDocumentClickHandler(closeDropdown);
}
