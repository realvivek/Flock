/** Line icons shared by the Journey and Data pages (24 x 24, stroke in currentColor). */
export const ICONS: Record<string, string> = {
  pole: '<path d="M12 3v18M8 21h8M9 6h6v5H9z"/><path d="M15 8h3" />',
  tower: '<path d="M12 8v13M8 21h8M9.5 21l2.5-9 2.5 9"/><path d="M8 6a5.5 5.5 0 0 1 8 0M5.5 3.5a9 9 0 0 1 13 0"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.6-7.95A5.5 5.5 0 0 1 17 8.5a3.8 3.8 0 0 1 .5 7.5H7z"/><path d="M9 14h6M9 11.5h6" />',
  list: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 12.5h8M8 16h5"/><path d="M6.5 9l-1 1"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/><path d="M3.5 6.5a6 6 0 0 1 0 11M20.5 6.5a6 6 0 0 1 0 11" stroke-dasharray="1.5 2"/>',
  search: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="M14.5 14.5 20 20"/>',
  bin: '<path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13"/><path d="M10 10v7M14 10v7"/>',
};
export const icon = (name: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ""}</svg>`;
