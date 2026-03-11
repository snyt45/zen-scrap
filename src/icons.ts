function stroke(size: number, strokeWidth = 2) {
  return `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"`;
}

export function chevronDownIcon(size: number, strokeWidth = 2) {
  return `<svg ${stroke(size, strokeWidth)}><polyline points="6 9 12 15 18 9"></polyline></svg>`;
}

export function chevronLeftIcon(size: number) {
  return `<svg ${stroke(size)}><polyline points="15 18 9 12 15 6"></polyline></svg>`;
}

export const EXPAND_ICON = `<svg ${stroke(16)}><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>`;

export const SHRINK_ICON = `<svg ${stroke(16)}><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>`;

export const TRIANGLE_DOWN_ICON = '<svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor"><path d="M5 8l5 5 5-5z"/></svg>';

export const EDIT_ICON = `<svg ${stroke(16)}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
