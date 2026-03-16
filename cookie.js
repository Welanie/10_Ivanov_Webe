"use strict";

const COOKIE_CONSENT_NAME = "cookie_consent";
const REVIEW_COOKIE_NAME = "site_reviews";
const LOCAL_STORAGE_CONSENT_KEY = "site_cookie_consent";
const LOCAL_STORAGE_REVIEWS_KEY = "site_reviews_fallback";
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

function readLocalStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function writeLocalStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    return false;
  }
}

function removeLocalStorage(key) {
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    return;
  }
}

function readConsent() {
  const cookieValue = getCookie(COOKIE_CONSENT_NAME);

  if (cookieValue === "accepted" || cookieValue === "rejected") {
    return cookieValue;
  }

  const localStorageValue = readLocalStorage(LOCAL_STORAGE_CONSENT_KEY);

  if (localStorageValue === "accepted" || localStorageValue === "rejected") {
    return localStorageValue;
  }

  return "unknown";
}

function saveConsent(value) {
  if (value !== "accepted" && value !== "rejected") {
    return "unknown";
  }

  writeLocalStorage(LOCAL_STORAGE_CONSENT_KEY, value);
  setCookie(COOKIE_CONSENT_NAME, value, CONSENT_COOKIE_OPTIONS);

  if (value === "rejected") {
    deleteCookie(REVIEW_COOKIE_NAME, REVIEW_COOKIE_OPTIONS);
    removeLocalStorage(LOCAL_STORAGE_REVIEWS_KEY);
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

  const rawValue = getCookie(REVIEW_COOKIE_NAME) || readLocalStorage(LOCAL_STORAGE_REVIEWS_KEY);

  try {
    const parsedValue = rawValue ? JSON.parse(rawValue) : [];
    return normalizeStoredReviews(parsedValue);
  } catch (error) {
    deleteCookie(REVIEW_COOKIE_NAME, REVIEW_COOKIE_OPTIONS);
    removeLocalStorage(LOCAL_STORAGE_REVIEWS_KEY);
    return [];
  }
}

function saveReviews(reviews) {
  if (readConsent() !== "accepted") {
    return [];
  }

  const normalizedReviews = normalizeStoredReviews(reviews);
  const serializedReviews = JSON.stringify(normalizedReviews);

  writeLocalStorage(LOCAL_STORAGE_REVIEWS_KEY, serializedReviews);
  setCookie(
    REVIEW_COOKIE_NAME,
    serializedReviews,
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
    removeLocalStorage(LOCAL_STORAGE_REVIEWS_KEY);
  }
});
