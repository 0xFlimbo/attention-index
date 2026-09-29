/**
 * What a fetched article says about itself — its timestamp, byline and
 * publisher — read from the page's machine-readable metadata before the HTML
 * is flattened to text (`toText` drops every `<script>`, and JSON-LD lives in
 * one).
 *
 * ---------------------------------------------------------------------------
 * **Why it exists.** Deciding a media record needs a date, and a syndicated
 * one needs the outlet it credits (docs/DATA.md §7). Both were read by hand
 * off the pages' JSON-LD until the tool learned to: NewsBreak's page names The
 * American Bazaar as publisher there and carries the full article body behind a
 * visible teaser; the Tennessee Star's only timestamp is in UTC and falls on
 * the next day. The tool prints what the page states and flags what needs a
 * person. It never writes a record.
 * ---------------------------------------------------------------------------
 */
import { toText } from "./mention-patterns";
import { outletIdentity } from "../validation/publication-name";

export interface ArticleMetadata {
  /** The timestamp exactly as the page publishes it. */
  publishedAt: string | null;
  author: string | null;
  /** The outlet the metadata names as publisher, which may not be the site's own. */
  publisher: string | null;
  /** The site's own name (`og:site_name`). */
  siteName: string | null;
  headline: string | null;
  /** The article's full text when the metadata carries it, as plain text. */
  articleBody: string | null;
  source: "json-ld" | "meta" | "msn";
}

type JsonObject = Record<string, unknown>;

const ARTICLE_TYPE = /(^|\s)(Article|NewsArticle|ReportageNewsArticle|AnalysisNewsArticle|OpinionNewsArticle|BlogPosting)$/;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function typesOf(item: JsonObject): string[] {
  const type = item["@type"];
  if (typeof type === "string") return [type];
  if (Array.isArray(type)) return type.filter((entry): entry is string => typeof entry === "string");
  return [];
}

function stringOf(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function jsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  for (const match of html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      blocks.push(JSON.parse(match[1] ?? ""));
    } catch {
      // A malformed block is common on real pages and says nothing about the others.
    }
  }
  return blocks;
}

/** Every object in every block, `@graph` members and top-level arrays flattened. */
function jsonLdItems(html: string): JsonObject[] {
  const items: JsonObject[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (isObject(value)) {
      if (Array.isArray(value["@graph"])) value["@graph"].forEach(visit);
      else items.push(value);
    }
  };
  jsonLdBlocks(html).forEach(visit);
  return items;
}

/**
 * A person or organisation's name, whether given inline or as an `@id`
 * reference to another member of the graph (the Yoast shape: the article's
 * `author` is `{ "@id": "…#/schema/person/…" }`, the name is on the Person).
 */
function nameOf(value: unknown, byId: Map<string, JsonObject>): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first === "string") return stringOf(first);
  if (!isObject(first)) return null;
  const inline = stringOf(first.name);
  if (inline !== null) return inline;
  const id = stringOf(first["@id"]);
  return id !== null ? stringOf(byId.get(id)?.name) : null;
}

/** True when the timestamp carries no local offset: `Z` or `+00:00`. */
function isUtc(timestamp: string): boolean {
  return /(Z|[+-]00:?00)$/i.test(timestamp.trim());
}

function metaContent(html: string, key: string): string | null {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const name = /\b(?:property|name)=["']([^"']+)["']/i.exec(tag)?.[1];
    if (name?.toLowerCase() !== key) continue;
    const content = /\bcontent=["']([^"']*)["']/i.exec(tag)?.[1];
    if (content !== undefined && content.trim().length > 0) return decodeEntities(content.trim());
  }
  return null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;/gi, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/**
 * The article's metadata, from JSON-LD first and meta tags second. `null` when
 * the page states neither a timestamp nor a publisher, author or headline.
 *
 * When several article items carry a timestamp, one with a local offset wins
 * over a UTC one: The American Bazaar publishes the same moment as
 * `14:07:22+00:00` in one block and `10:07:22-04:00` in another, and only the
 * second says which day it was in the newsroom.
 */
export function extractArticleMetadata(html: string): ArticleMetadata | null {
  const items = jsonLdItems(html);
  const byId = new Map<string, JsonObject>();
  for (const item of items) {
    const id = stringOf(item["@id"]);
    if (id !== null) byId.set(id, item);
  }
  const articles = items.filter((item) => typesOf(item).some((type) => ARTICLE_TYPE.test(type)));

  const timestamps = articles
    .map((article) => stringOf(article.datePublished) ?? stringOf(article.dateCreated))
    .filter((timestamp): timestamp is string => timestamp !== null);
  const pick = <T>(read: (article: JsonObject) => T | null): T | null => {
    for (const article of articles) {
      const value = read(article);
      if (value !== null) return value;
    }
    return null;
  };

  const siteName = metaContent(html, "og:site_name");
  const jsonLd = {
    publishedAt: timestamps.find((timestamp) => !isUtc(timestamp)) ?? timestamps[0] ?? null,
    author: pick((article) => nameOf(article.author, byId)),
    publisher: pick((article) => nameOf(article.publisher, byId)),
    headline: pick((article) => stringOf(article.headline)),
    articleBody: pick((article) => {
      const body = stringOf(article.articleBody);
      return body !== null ? toText(body) : null;
    }),
  };

  if (articles.length > 0 && (jsonLd.publishedAt !== null || jsonLd.publisher !== null)) {
    return {
      ...jsonLd,
      author: jsonLd.author ?? metaContent(html, "author"),
      headline: jsonLd.headline ?? metaContent(html, "og:title"),
      siteName,
      source: "json-ld",
    };
  }

  const meta = {
    publishedAt: metaContent(html, "article:published_time"),
    author: metaContent(html, "author"),
    headline: metaContent(html, "og:title"),
  };
  if (meta.publishedAt === null && meta.author === null && siteName === null) return null;
  return { ...meta, publisher: null, siteName, articleBody: null, source: "meta" };
}

/** The date a URL carries in a `/YYYY/MM/DD/` path, or `null`. */
export function dateFromUrl(url: string): string | null {
  const match = /\/(20\d{2})\/(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])(?=\/|$)/.exec(url);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

/**
 * MSN renders its articles in the browser, so the page a server fetches holds
 * none of the text. MSN's own content endpoint serves the article as JSON,
 * keyed by the id at the end of an `ar-` URL and the locale in its path
 * (docs/TOOLS.md §6). A `gm-` item is refused: it answered HTTP 410 there.
 */
export function msnContentUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!/(^|\.)msn\.com$/i.test(parsed.hostname)) return null;
  const match = /^\/([a-z]{2}-[a-z]{2})\/.*\/ar-([A-Za-z0-9]+)\/?$/i.exec(parsed.pathname);
  if (!match) return null;
  return `https://assets.msn.com/content/view/v2/Detail/${match[1]!.toLowerCase()}/${match[2]}`;
}

/** The fields of an MSN content-endpoint answer, in this module's shape. */
export function metadataFromMsnDetail(detail: unknown): ArticleMetadata | null {
  if (!isObject(detail)) return null;
  const body = stringOf(detail.body);
  const provider = isObject(detail.provider) ? stringOf(detail.provider.name) : null;
  const authors = Array.isArray(detail.authors) ? detail.authors : [];
  const author = authors.length > 0 && isObject(authors[0]) ? stringOf(authors[0].name) : null;
  if (body === null && provider === null) return null;
  return {
    publishedAt: stringOf(detail.publishedDateTime),
    author,
    publisher: provider,
    siteName: "MSN",
    headline: stringOf(detail.title),
    articleBody: body !== null ? toText(body) : null,
    source: "msn",
  };
}

export interface DateReading {
  /** The day the timestamp states, in its own offset — the value a record would take. */
  proposed: string | null;
  urlDate: string | null;
  /** Reasons a person must confirm the day before it is written. */
  flags: string[];
}

/** Hours on either side of midnight inside which a UTC timestamp's day is doubtful. */
const MIDNIGHT_MARGIN_HOURS = 6;

/**
 * The publication day a record would take, and whether a person must confirm it.
 * A UTC timestamp near midnight is flagged because the newsroom's own day may
 * differ: the Tennessee Star's `2026-04-23T01:40:56+00:00` is the evening of
 * 22 April in Nashville, the day its URL and the press page both carry.
 */
export function readPublicationDate(metadata: ArticleMetadata | null, url: string): DateReading {
  const urlDate = dateFromUrl(url);
  const timestamp = metadata?.publishedAt ?? null;
  const proposed = timestamp !== null && /^\d{4}-\d{2}-\d{2}/.test(timestamp) ? timestamp.slice(0, 10) : null;
  const flags: string[] = [];

  if (proposed !== null && urlDate !== null && proposed !== urlDate) {
    flags.push(`timestamp says ${proposed}, URL says ${urlDate}`);
  }
  if (timestamp !== null && proposed !== null && isUtc(timestamp)) {
    const hour = Number(/T(\d{2})/.exec(timestamp)?.[1] ?? NaN);
    if (hour < MIDNIGHT_MARGIN_HOURS || hour >= 24 - MIDNIGHT_MARGIN_HOURS) {
      flags.push("UTC timestamp near midnight: the newsroom's own day may differ");
    }
  }
  if (proposed === null) flags.push("no publication timestamp in the page's metadata");
  return { proposed, urlDate, flags };
}

/** `www.americanbazaaronline.com` → `americanbazaaronline`. */
function hostCore(url: string): string | null {
  try {
    const labels = new URL(url).hostname.replace(/^www\./i, "").split(".");
    return labels.length > 1 ? labels.slice(0, -1).join("") : null;
  } catch {
    return null;
  }
}

/**
 * The outlet the metadata credits, when it is not the site's own — the likely
 * `syndicated_from` of a republication. Printed for a person to confirm, never written.
 *
 * "The site's own" is its `og:site_name`, the record's publication when there
 * is one, or its host: a publisher whose name and one of those contain one
 * another is the site itself (`The American Bazaar` on `americanbazaaronline.com`).
 */
export function creditedPublisher(
  metadata: ArticleMetadata | null,
  url: string,
  ownName?: string,
): string | null {
  if (metadata?.publisher == null) return null;
  const publisher = outletIdentity(metadata.publisher);
  if (publisher.length === 0) return null;
  const own = [ownName, metadata.siteName]
    .filter((name): name is string => typeof name === "string")
    .map(outletIdentity);
  const host = hostCore(url);
  if (host !== null) own.push(host);
  const same = own.some((name) => name.length > 0 && (name.includes(publisher) || publisher.includes(name)));
  return same ? null : metadata.publisher;
}

/** The lines both reports print under a page that names the project. */
export function metadataLines(
  metadata: ArticleMetadata | null,
  url: string,
  ownName?: string,
): string[] {
  if (metadata === null) return ["no article metadata on the page"];
  const date = readPublicationDate(metadata, url);
  const lines = [
    `date      ${date.proposed ?? "—"}` +
      (metadata.publishedAt !== null ? `  (published ${metadata.publishedAt}, ${metadata.source})` : "") +
      (date.urlDate !== null ? `  · URL ${date.urlDate}` : ""),
  ];
  if (metadata.author !== null) lines.push(`author    ${metadata.author}`);
  const credited = creditedPublisher(metadata, url, ownName);
  if (credited !== null) lines.push(`credited publisher  ${credited}  — the likely syndicated_from`);
  for (const flag of date.flags) lines.push(`CHECK     ${flag}`);
  return lines;
}
