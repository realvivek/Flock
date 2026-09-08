/** Root-relative asset prefix that works from the home page and from every nested page. Each page states its
 *  distance to the site root in `<body data-root>` ("./" or "../"). */
const raw = import.meta.env.BASE_URL.replace(/\/?$/, "/");
const stated = document.body?.dataset.root ?? "./";
/** Path to the site root from the current page. */
export const ROOT = raw.startsWith(".") ? stated : raw;
/** Prefix for public assets (stills, models, images). "" on the home page, "../" on nested pages. */
export const BASE = raw.startsWith(".") ? (stated === "./" ? "" : stated) + raw.replace(/^\.\//, "") : raw;
/** The page id from `<body data-page>`. */
export const PAGE = document.body?.dataset.page ?? "home";
