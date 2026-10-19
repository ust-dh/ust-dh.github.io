/* ============================================================
 * Home page feed: retired.
 *
 * This used to fetch /news/ and /events/ and rebuild the home
 * carousel, the latest-news cards and the events band in the
 * browser. The replacement nodes were inserted already finished
 * (opacity 1, no transform), so they never animated, and the whole
 * pass duplicated markup the page already contains.
 *
 * The home cards are generated at build time by tools/build_lists.py
 * and refreshed by the "Refresh listings" workflow, so the markup is
 * authoritative and the scroll reveal in main.js works on it
 * normally.
 *
 * The script tag is left in place so no page has to change; this
 * file does nothing.
 * ============================================================ */
