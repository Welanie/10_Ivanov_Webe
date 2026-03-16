"use strict";

const defaultReviews = [
  {
    name: "Ян, 18 лет",
    text: "Хотел посмотреть 2 минуты, в итоге пересматривал три раза и опоздал на пару.",
    meta: "Отзыв по умолчанию"
  },
  {
    name: "Алина, 24 года",
    text: "Слишком громко, слишком пафосно, слишком круто. Да, я в восторге.",
    meta: "Отзыв по умолчанию"
  },
  {
    name: "Никита, 27 лет",
    text: "Теперь каждое утро включаю этот ролик вместо будильника. Соседи тоже в курсе.",
    meta: "Отзыв по умолчанию"
  }
];

const reviewStorage = window.reviewCookieStore;
const reviewLimits = reviewStorage
  ? reviewStorage.limits
  : {
      maxStoredReviews: 8,
      nameLength: 40,
      textLength: 280
    };

const themeToggleButton = document.querySelector("#theme-toggle");
const reviewsList = document.querySelector("#reviews-list");
const reviewForm = document.querySelector("#review-form");
const reviewStatus = document.querySelector("#review-status");
const nameInput = document.querySelector("#review-name");
const textInput = document.querySelector("#review-text");
const hoverVideos = document.querySelectorAll(".hover-play");
const cookieBanner = document.querySelector("#cookie-banner");
const cookieAcceptButton = document.querySelector("#cookie-accept");
const cookieRejectButton = document.querySelector("#cookie-reject");

let userReviews = reviewStorage ? reviewStorage.readReviews() : [];

function normalizeName(value) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeText(value) {
  return value.trim().replace(/\s+/g, " ");
}

function formatReviewDate(date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

function createReviewCard(review, isUserReview) {
  const article = document.createElement("article");
  article.className = "review";

  if (isUserReview) {
    article.classList.add("review-user");
  }

  const name = document.createElement("p");
  name.className = "review-name";
  name.textContent = review.name;

  const meta = document.createElement("p");
  meta.className = "review-meta";
  meta.textContent = isUserReview
    ? `Сохранено в cookie • ${review.date}`
    : review.meta;

  const text = document.createElement("p");
  text.className = "review-text";
  text.textContent = review.text;

  article.append(name, meta, text);
  return article;
}

function renderReviews() {
  const allReviews = [
    ...userReviews.map((review) => ({ ...review, meta: "Ваш отзыв" })),
    ...defaultReviews
  ];

  const cards = allReviews.map((review, index) =>
    createReviewCard(review, index < userReviews.length)
  );

  reviewsList.replaceChildren(...cards);
}

function setFieldError(fieldName, message) {
  const field = fieldName === "name" ? nameInput : textInput;
  const errorNode = document.querySelector(`[data-error-for="${fieldName}"]`);

  field.setAttribute("aria-invalid", message ? "true" : "false");
  errorNode.textContent = message;
}

function setStatus(message, state = "") {
  reviewStatus.textContent = message;
  reviewStatus.dataset.state = state;
}

function validateReview(values) {
  const errors = {};

  if (!values.name) {
    errors.name = "Введите имя.";
  } else if (values.name.length < 2) {
    errors.name = "Имя должно содержать минимум 2 символа.";
  } else if (values.name.length > reviewLimits.nameLength) {
    errors.name = `Имя должно быть короче ${reviewLimits.nameLength + 1} символа.`;
  }

  if (!values.text) {
    errors.text = "Введите текст отзыва.";
  } else if (values.text.length < 10) {
    errors.text = "Отзыв должен содержать минимум 10 символов.";
  } else if (values.text.length > reviewLimits.textLength) {
    errors.text = `Отзыв должен быть короче ${reviewLimits.textLength + 1} символа.`;
  }

  return errors;
}

function readThemePreference() {
  try {
    const storedTheme = window.localStorage.getItem("preferred-theme");

    if (storedTheme === "light" || storedTheme === "dark") {
      return storedTheme;
    }
  } catch (error) {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme) {
  const isDarkTheme = theme === "dark";

  document.body.dataset.theme = isDarkTheme ? "dark" : "light";
  themeToggleButton.textContent = isDarkTheme ? "Светлая тема" : "Тёмная тема";
  themeToggleButton.setAttribute("aria-pressed", String(isDarkTheme));

  try {
    window.localStorage.setItem("preferred-theme", isDarkTheme ? "dark" : "light");
  } catch (error) {
    return;
  }
}

function handleThemeToggle() {
  const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
}

function syncReviewsFromCookies() {
  userReviews = reviewStorage ? reviewStorage.readReviews() : [];
  renderReviews();
}

function updateCookieBanner() {
  const consent = reviewStorage ? reviewStorage.getConsent() : "unknown";
  const shouldShowBanner = consent === "unknown";

  cookieBanner.hidden = !shouldShowBanner;
}

function handleCookieAccept() {
  if (!reviewStorage) {
    return;
  }

  reviewStorage.setConsent("accepted");
  updateCookieBanner();
  syncReviewsFromCookies();
  setStatus("Вы приняли cookie. Теперь отзывы будут сохраняться в браузере.", "success");
}

function handleCookieReject() {
  if (!reviewStorage) {
    return;
  }

  reviewStorage.setConsent("rejected");
  reviewStorage.clearReviews();
  syncReviewsFromCookies();
  updateCookieBanner();
  setStatus("Вы отклонили необязательные cookie. Отзывы сохраняться не будут.", "error");
}

function handleReviewSubmit(event) {
  event.preventDefault();

  const values = {
    name: normalizeName(nameInput.value),
    text: normalizeText(textInput.value)
  };

  const errors = validateReview(values);

  setFieldError("name", errors.name || "");
  setFieldError("text", errors.text || "");

  if (errors.name || errors.text) {
    setStatus("Исправьте ошибки в форме, чтобы добавить отзыв.", "error");
    return;
  }

  if (!reviewStorage || reviewStorage.getConsent() !== "accepted") {
    setStatus("Чтобы сохранить отзыв в cookie, сначала примите их в баннере внизу страницы.", "error");
    updateCookieBanner();
    cookieBanner.scrollIntoView({ behavior: "smooth", block: "end" });
    return;
  }

  const review = {
    ...values,
    date: formatReviewDate(new Date())
  };

  userReviews = [review, ...userReviews].slice(0, reviewLimits.maxStoredReviews);

  if (reviewStorage) {
    userReviews = reviewStorage.saveReviews(userReviews);
  }

  renderReviews();
  reviewForm.reset();
  setFieldError("name", "");
  setFieldError("text", "");
  setStatus("Отзыв добавлен и сохранён в cookie.", "success");
  nameInput.focus();
}

function attachValidationHandlers() {
  nameInput.addEventListener("input", () => {
    setFieldError("name", "");
    setStatus("", "");
  });

  textInput.addEventListener("input", () => {
    setFieldError("text", "");
    setStatus("", "");
  });
}

function attachVideoHoverPlayback() {
  hoverVideos.forEach((video) => {
    video.addEventListener("mouseenter", () => {
      video.play().catch(() => {});
    });

    video.addEventListener("mouseleave", () => {
      video.pause();
      video.currentTime = 0;
    });
  });
}

function init() {
  renderReviews();
  applyTheme(readThemePreference());
  updateCookieBanner();
  attachValidationHandlers();
  attachVideoHoverPlayback();

  themeToggleButton.addEventListener("click", handleThemeToggle);
  reviewForm.addEventListener("submit", handleReviewSubmit);
  cookieAcceptButton.addEventListener("click", handleCookieAccept);
  cookieRejectButton.addEventListener("click", handleCookieReject);
}

init();
