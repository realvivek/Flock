/** Root-relative asset prefix that works from the main page and from the nested components page. */
const raw = import.meta.env.BASE_URL.replace(/\/?$/, "/");
const nested = /\/components\/?$/.test(location.pathname);
/** "" on the main page, "../" on the components page, or the absolute base when the build sets one. */
export const BASE = raw.startsWith(".") ? (nested ? "../" : "") + raw.replace(/^\.\//, "") : raw;
/** Path to the site root from the current page. */
export const ROOT = raw.startsWith(".") ? (nested ? "../" : "./") : raw;
