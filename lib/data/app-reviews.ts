import { cache } from "react";

export const APP_STORE_URL = "https://apps.shopify.com/origin-utm-tracking";
export const APP_STORE_REVIEW_URL = `${APP_STORE_URL}#modal-show=ReviewListingModal`;

const REVIEWS_TTL_MS = 60 * 60 * 1000;
const MAX_PAGES = 50;

export type AppReview = {
  id: string;
  shopName: string;
  rating: number;
  date: string;
  body: string;
};

let cachedReviews: Array<AppReview> = [];
let cachedAtMs = 0;

const decodeEntities = (value: string) => {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
};

// Pulls the reviewer name, star rating, date and body out of one
// `data-merchant-review` block of the App Store reviews page.
const parseReview = ({ id, html }: { id: string; html: string }): AppReview | null => {
  const rating = html.match(/aria-label="(\d) out of 5 stars"/);
  const date = html.match(
    /class="tw-text-body-xs tw-text-fg-tertiary">\s*([A-Za-z]+ \d{1,2}, \d{4})\s*</,
  );
  const shopName = html.match(/<span[^>]*\btitle="([^"]*)"/);
  const body = html.match(/data-truncate-content-copy[^>]*>([\s\S]*?)<\/div>/);

  if (!rating || !date || !shopName || !body) {
    return null;
  }

  const paragraphs = Array.from(body[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)).map(
    (match) => decodeEntities(match[1].replace(/<[^>]+>/g, "").trim()),
  );

  return {
    id,
    shopName: decodeEntities(shopName[1].trim()),
    rating: Number(rating[1]),
    date: new Date(`${date[1]} UTC`).toISOString(),
    body: paragraphs.join("\n\n"),
  };
};

const parseReviewsPage = (html: string): Array<AppReview> => {
  const reviews: Array<AppReview> = [];
  const blocks = html.split(/(?=<div data-merchant-review="")/).slice(1);

  for (const block of blocks) {
    const id = block.match(/data-review-content-id="(\d+)"/);
    if (!id) {
      continue;
    }

    // Everything up to the merchant reply, so the reply's own paragraphs
    // aren't mistaken for the review body.
    const reviewOnly = block.split("data-merchant-review-reply")[0];
    const review = parseReview({ id: id[1], html: reviewOnly });
    if (review) {
      reviews.push(review);
    }
  }

  return reviews;
};

const fetchAllReviews = async (): Promise<Array<AppReview>> => {
  if (Date.now() - cachedAtMs < REVIEWS_TTL_MS) {
    return cachedReviews;
  }

  const reviews: Array<AppReview> = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const response = await fetch(`${APP_STORE_URL}/reviews?page=${page}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`Error fetching app reviews page ${page}`, response.status);
      throw new Error(`App Store reviews request failed (${response.status})`);
    }

    const pageReviews = parseReviewsPage(await response.text());
    if (pageReviews.length === 0) {
      break;
    }

    reviews.push(...pageReviews);
  }

  cachedReviews = reviews;
  cachedAtMs = Date.now();

  return reviews;
};

const normalizeName = (value: string) => {
  return value.trim().toLowerCase();
};

// App Store reviews are attributed to the store's display name, so that is
// the only thing we can match on.
export const getShopReview = cache(
  async ({ shopName }: { shopName: string | null }): Promise<AppReview | null> => {
    if (!shopName) {
      return null;
    }

    const reviews = await fetchAllReviews();
    const target = normalizeName(shopName);

    return reviews.find((review) => normalizeName(review.shopName) === target) ?? null;
  },
);
