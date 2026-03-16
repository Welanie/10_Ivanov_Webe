"use strict";

const COOKIE_CONSENT_NAME = "cookie_consent";
const REVIEW_COOKIE_NAME = "site_reviews";
const REVIEW_LIMITS = Object.freeze({
  maxStoredReviews: 8,
  nameLength: 40,
  textLength: 280
});

function resolveCookiePath() {
  const { pathname } = window.location;

  if (!pathname || pathname === "/") {
    return "/";
  }

  const lastSlashIndex = pathname.lastIndexOf("/");
  const basePath = pathname.slice(0, lastSlashIndex + 1);

  return basePath || "/";
}

const REVIEW_COOKIE_OPTIONS = Object.freeze({
  path: resolveCookiePath(),
  maxAge: 60 * 60 * 24 * 30,
  sameSite: "Lax"
});

const CONSENT_COOKIE_OPTIONS = Object.freeze({
  path: resolveCookiePath(),
  maxAge: 60 * 60 * 24 * 180,
  sameSite: "Lax"
});

function setCookie(name, value, options = {}) {
  const normalizedOptions = {
    path: "/",
    ...options
  };

  const parts = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`
  ];

  if (typeof normalizedOptions.maxAge === "number") {
    parts.push(`Max-Age=${Math.max(0, Math.floor(normalizedOptions.maxAge))}`);
  }

  if (normalizedOptions.expires instanceof Date) {
    parts.push(`Expires=${normalizedOptions.expires.toUTCString()}`);
  }

  if (normalizedOptions.path) {
    parts.push(`Path=${normalizedOptions.path}`);
  }

  if (normalizedOptions.sameSite) {
    parts.push(`SameSite=${normalizedOptions.sameSite}`);
  }

  if (normalizedOptions.secure) {
    parts.push("Secure");
  }

  document.cookie = parts.join("; ");
}

function getCookie(name) {
  const encodedName = `${encodeURIComponent(name)}=`;
  const cookieParts = document.cookie ? document.cookie.split(/;\s*/) : [];

  for (const cookiePart of cookieParts) {
    if (cookiePart.startsWith(encodedName)) {
      return decodeURIComponent(cookiePart.slice(encodedName.length));
    }
  }

  return null;
}

function deleteCookie(name, options = {}) {
  setCookie(name, "", {
    ...options,
    maxAge: 0
  });
}

function readConsent() {
  const value = getCookie(COOKIE_CONSENT_NAME);

  if (value === "accepted" || value === "rejected") {
    return value;
  }

  return "unknown";
}

function saveConsent(value) {
  if (value !== "accepted" && value !== "rejected") {
    return "unknown";
  }

  setCookie(COOKIE_CONSENT_NAME, value, CONSENT_COOKIE_OPTIONS);

  if (value === "rejected") {
    deleteCookie(REVIEW_COOKIE_NAME, REVIEW_COOKIE_OPTIONS);
  }

  return value;
}

function normalizeWhitespace(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function normalizeStoredReview(review) {
  if (!review || typeof review !== "object") {
    return null;
  }

  const name = normalizeWhitespace(review.name).slice(0, REVIEW_LIMITS.nameLength);
  const text = normalizeWhitespace(review.text).slice(0, REVIEW_LIMITS.textLength);
  const date = normalizeWhitespace(review.date).slice(0, 60);

  if (!name || !text) {
    return null;
  }

  return { name, text, date };
}

function normalizeStoredReviews(reviews) {
  if (!Array.isArray(reviews)) {
    return [];
  }

  return reviews
    .map(normalizeStoredReview)
    .filter(Boolean)
    .slice(0, REVIEW_LIMITS.maxStoredReviews);
}

function readReviews() {
  if (readConsent() !== "accepted") {
    return [];
  }

  const rawValue = getCookie(REVIEW_COOKIE_NAME);

  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(rawValue);
    return normalizeStoredReviews(parsedValue);
  } catch (error) {
    deleteCookie(REVIEW_COOKIE_NAME, REVIEW_COOKIE_OPTIONS);
    return [];
  }
}

function saveReviews(reviews) {
  if (readConsent() !== "accepted") {
    return [];
  }

  const normalizedReviews = normalizeStoredReviews(reviews);
  setCookie(
    REVIEW_COOKIE_NAME,
    JSON.stringify(normalizedReviews),
    REVIEW_COOKIE_OPTIONS
  );

  return normalizedReviews;
}

window.reviewCookieStore = Object.freeze({
  limits: REVIEW_LIMITS,
  getConsent: readConsent,
  setConsent: saveConsent,
  readReviews,
  saveReviews,
  clearReviews() {
    deleteCookie(REVIEW_COOKIE_NAME, REVIEW_COOKIE_OPTIONS);
  }
});
