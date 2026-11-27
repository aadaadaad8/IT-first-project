document.addEventListener("DOMContentLoaded", () => {
  if (typeof books === "undefined") return;

  const $ = (id) => document.getElementById(id);

  const wanted = (new URLSearchParams(window.location.search).get("title") || "").trim().toLowerCase();
  const book = books.find((b) => String(b.book ?? "").trim().toLowerCase() === wanted);

  if (!book) {
    $("detailCard").hidden = true;
    $("salesNote").hidden = true;
    $("notFound").hidden = false;
    document.title = "Book not found - Bestselling Books";
    return;
  }

  const title = String(book.book).trim();
  const authors = String(book.authors ?? "").trim();
  const sales = Number(book.approximateSalesInMillions) || 0;

  function firstAuthor(text) {
    return String(text ?? "").split(/,| and | & |;/)[0].trim();
  }

  const cleanTitle = title.replace(/\s*\(.*?\)\s*/g, " ").trim();

  const NO_COVER_IMG =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="150" viewBox="0 0 100 150">' +
        '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#3b7f86"/><stop offset="1" stop-color="#21474d"/>' +
        "</linearGradient></defs>" +
        '<rect width="100" height="150" rx="6" fill="url(#g)"/>' +
        '<rect width="10" height="150" rx="3" fill="#183a3f"/>' +
        '<g transform="translate(29 54)" fill="none" stroke="#f3e9d2" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M26 8 C20 3 10 2 2 4 V40 C10 38 20 39 26 44 C32 39 42 38 50 40 V4 C42 2 32 3 26 8 Z"/>' +
          '<path d="M26 8 V44"/>' +
        "</g>" +
      "</svg>"
    );

  document.title = title + " - Bestselling Books";
  $("bookTitle").textContent = title;
  const authorName = document.createElement("span");
  authorName.className = "author-hover";
  authorName.tabIndex = 0;
  authorName.textContent = authors;
  $("bookAuthor").appendChild(authorName);
  $("factYear").textContent = String(book.firstPublished ?? "") || "Not listed";
  $("factLang").textContent = String(book.originalLanguage ?? "").trim() || "Not listed";
  $("factGenre").textContent = String(book.genre ?? "").trim() || "Not listed in the dataset";

  $("salesBig").textContent = sales + " million";

  const rank = books.filter((b) => (Number(b.approximateSalesInMillions) || 0) > sales).length + 1;
  $("rankText").textContent = "Ranked #" + rank + " of " + books.length + " books by sales";

  const searchText = encodeURIComponent((cleanTitle + " " + firstAuthor(authors)).trim());
  $("wikiLink").href = "https://en.wikipedia.org/wiki/Special:Search?search=" + searchText;
  $("findLink").href = "https://openlibrary.org/search?q=" + searchText;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rootEl = document.documentElement;
  let coverFlightData = null;
  try {
    const rawFlight = sessionStorage.getItem("bookCoverTransition");
    if (rawFlight) {
      coverFlightData = JSON.parse(rawFlight);
      sessionStorage.removeItem("bookCoverTransition");
    }
  } catch (err) {}

  let flightInProgress = Boolean(coverFlightData && !reduceMotion);
  let deferredUpgrade = null;

  if (rootEl.classList.contains("detail-enter-pending")) {
    sessionStorage.removeItem("bookTransition");
    if (reduceMotion) {
      rootEl.classList.remove("detail-enter-pending", "detail-cover-flying");
      flightInProgress = false;
    } else {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          rootEl.classList.add("detail-enter-active");
        });
      });
      setTimeout(() => {
        rootEl.classList.remove("detail-enter-pending", "detail-enter-active");
      }, 1070);
    }
  } else if (!flightInProgress) {
    rootEl.classList.remove("detail-cover-flying");
  }

  let exitingBack = false;
  $("backLink").addEventListener("click", (event) => {
    let cameFromSite = false;
    try {
      cameFromSite = document.referrer && new URL(document.referrer).origin === window.location.origin;
    } catch (err) {
      cameFromSite = false;
    }

    if (reduceMotion) {
      if (cameFromSite && window.history.length > 1) {
        event.preventDefault();
        window.history.back();
      }
      return;
    }

    event.preventDefault();
    if (exitingBack) return;
    exitingBack = true;

    const cBox = coverImg.getBoundingClientRect();
    const nw = coverImg.naturalWidth || 100;
    const nh = coverImg.naturalHeight || 150;
    const hasCoverNow = !coverImg.classList.contains("no-cover");
    const fromRect = hasCoverNow
      ? getContainedRect(cBox, nw, nh)
      : { left: cBox.left, top: cBox.top, width: cBox.width, height: cBox.height };
    const coverCurrentSrc = coverImg.currentSrc || coverImg.src;

    try {
      sessionStorage.setItem(
        "bookCoverBackTransition",
        JSON.stringify({ title, src: coverCurrentSrc, hasCover: hasCoverNow, fromRect, naturalWidth: nw, naturalHeight: nh })
      );
    } catch (err) {}

    coverImg.style.opacity = "0";
    coverImg.style.transition = "none";

    const backFloater = document.createElement("img");
    backFloater.src = coverCurrentSrc;
    backFloater.alt = "";
    backFloater.referrerPolicy = "no-referrer";
    backFloater.style.cssText =
      "position:fixed;left:0;top:0;z-index:9999;pointer-events:none;display:block;" +
      "transform:translate3d(" + fromRect.left + "px," + fromRect.top + "px,0);" +
      "width:" + fromRect.width + "px;height:" + fromRect.height + "px;" +
      "object-fit:" + (hasCoverNow ? "contain" : "cover") + ";" +
      "border-radius:" + (hasCoverNow ? "0" : "2px") + ";" +
      "filter:" + (hasCoverNow ? "drop-shadow(0 18px 28px rgba(0,0,0,0.28))" : "drop-shadow(0 18px 40px rgba(0,0,0,0.3))") + ";";
    document.body.appendChild(backFloater);

    sessionStorage.setItem("bookTransition", "back-to-list");
    rootEl.classList.add("detail-exiting-info", "detail-exiting-card");

    setTimeout(() => {
      if (cameFromSite && window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = $("backLink").href;
      }
    }, 480);
  });

  const SAVED_KEY = "savedBooks_v1";

  function readSaved() {
    try {
      const list = JSON.parse(localStorage.getItem(SAVED_KEY));
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return [];
    }
  }

  function writeSaved(list) {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(list));
    } catch (err) {}
  }

  const saveButton = $("saveButton");

  function showSaved(isSaved) {
    saveButton.setAttribute("aria-pressed", String(isSaved));
    $("saveLabel").textContent = isSaved ? "Saved" : "Save";
  }

  showSaved(readSaved().includes(title));

  saveButton.addEventListener("click", () => {
    const list = readSaved();
    const index = list.indexOf(title);
    if (index === -1) {
      list.push(title);
    } else {
      list.splice(index, 1);
    }
    writeSaved(list);
    showSaved(index === -1);
  });

  const AUTHOR_STORAGE_KEY = "authorPhotoCache_v1";
  const authorKey = firstAuthor(authors);

  function readAuthorCache() {
    try {
      return JSON.parse(localStorage.getItem(AUTHOR_STORAGE_KEY)) || {};
    } catch (err) {
      return {};
    }
  }

  let authorPhotoPromise = null;
  function findAuthorPhoto() {
    if (authorPhotoPromise) return authorPhotoPromise;

    const cache = readAuthorCache();
    if (authorKey in cache) {
      authorPhotoPromise = Promise.resolve(cache[authorKey] || null);
      return authorPhotoPromise;
    }

    authorPhotoPromise = (async () => {
      try {
        const url =
          "https://en.wikipedia.org/api/rest_v1/page/summary/" +
          encodeURIComponent(authorKey.replace(/ /g, "_"));
        const res = await fetch(url);
        const data = await res.json();
        const photo = (data.thumbnail && data.thumbnail.source) || "";
        const latest = readAuthorCache();
        latest[authorKey] = photo;
        try {
          localStorage.setItem(AUTHOR_STORAGE_KEY, JSON.stringify(latest));
        } catch (err) {}
        return photo || null;
      } catch (err) {
        authorPhotoPromise = null;
        return null;
      }
    })();
    return authorPhotoPromise;
  }

  const tooltip = document.createElement("div");
  tooltip.className = "author-tooltip";
  document.body.appendChild(tooltip);

  let hovering = false;

  function placeTooltip() {
    const rect = authorName.getBoundingClientRect();
    const tipHeight = tooltip.offsetHeight || 190;
    const tipWidth = tooltip.offsetWidth || 152;

    let left = rect.left;
    if (left + tipWidth > window.innerWidth - 8) left = window.innerWidth - tipWidth - 8;

    let top = rect.bottom + 8;
    if (top + tipHeight > window.innerHeight - 8) top = rect.top - tipHeight - 8;

    tooltip.style.left = Math.max(8, left) + "px";
    tooltip.style.top = Math.max(8, top) + "px";
  }

  function showTooltip(html) {
    if (!hovering) return;
    tooltip.innerHTML = html;
    tooltip.style.display = "block";
    placeTooltip();
  }

  function hideTooltip() {
    hovering = false;
    tooltip.style.display = "none";
  }

  async function onAuthorEnter() {
    hovering = true;
    const photo = await findAuthorPhoto();
    if (!hovering) return;

    if (!photo) {
      showTooltip('<div class="tooltip-empty">No photo available</div>');
      return;
    }

    const probe = new Image();
    probe.onload = () => {
      const img = document.createElement("img");
      img.src = photo;
      img.alt = firstAuthor(authors);
      tooltip.innerHTML = "";
      tooltip.appendChild(img);
      if (hovering) {
        tooltip.style.display = "block";
        placeTooltip();
      }
    };
    probe.onerror = () => showTooltip('<div class="tooltip-empty">No photo available</div>');
    probe.src = photo;
  }

  authorName.addEventListener("mouseenter", onAuthorEnter);
  authorName.addEventListener("mouseleave", hideTooltip);
  authorName.addEventListener("focus", onAuthorEnter);
  authorName.addEventListener("blur", hideTooltip);
  window.addEventListener("scroll", hideTooltip);

  findAuthorPhoto().then((photo) => {
    if (photo) new Image().src = photo;
  });

  const COVER_STORAGE_KEY = "bookCoverCache_v1";
  const coverImg = $("detailCover");

  function readCoverCache() {
    try {
      return JSON.parse(localStorage.getItem(COVER_STORAGE_KEY)) || {};
    } catch (err) {
      return {};
    }
  }

  async function findCoverUrl() {
    const key = title + "|" + authors;
    const cache = readCoverCache();
    if (key in cache) return cache[key] || null;

    try {
      const url =
        "https://openlibrary.org/search.json?limit=1&fields=cover_i" +
        "&title=" + encodeURIComponent(cleanTitle) +
        "&author=" + encodeURIComponent(firstAuthor(authors));
      const res = await fetch(url);
      const data = await res.json();
      const id = data.docs && data.docs[0] && data.docs[0].cover_i;
      cache[key] = id ? "https://covers.openlibrary.org/b/id/" + id + "-M.jpg" : "";
      try {
        localStorage.setItem(COVER_STORAGE_KEY, JSON.stringify(cache));
      } catch (err) {}
      return cache[key] || null;
    } catch (err) {
      return null;
    }
  }

  function getContainedRect(box, nw, nh) {
    if (!nw || !nh || !box.width || !box.height) {
      return { left: box.left, top: box.top, width: box.width, height: box.height };
    }
    const scale = Math.min(box.width / nw, box.height / nh);
    const width = nw * scale;
    const height = nh * scale;
    const left = box.left + (box.width - width) / 2;
    const top = box.top + (box.height - height) / 2;
    return { left, top, width, height };
  }

  coverImg.alt = title;
  if (flightInProgress && coverFlightData) {
    if (coverFlightData.hasCover) {
      coverImg.classList.remove("no-cover");
      coverImg.style.aspectRatio = coverFlightData.naturalWidth + " / " + coverFlightData.naturalHeight;
      $("heroArt").style.backgroundImage = 'url("' + coverFlightData.src + '")';
      $("heroArt").classList.add("ready");
    } else {
      coverImg.classList.add("no-cover");
    }
    coverImg.src = coverFlightData.src;

    const detailCardEl = $("detailCard");
    const coverBox = coverImg.getBoundingClientRect();
    const transformStr = window.getComputedStyle(detailCardEl).transform;
    let offsetX = 0;
    let offsetY = 0;
    if (transformStr && transformStr !== "none") {
      const matrix = new DOMMatrix(transformStr);
      offsetX = matrix.m41;
      offsetY = matrix.m42;
    }
    const settledBox = {
      left: coverBox.left - offsetX,
      top: coverBox.top - offsetY,
      width: coverBox.width,
      height: coverBox.height,
    };
    const toRect = coverFlightData.hasCover
      ? getContainedRect(settledBox, coverFlightData.naturalWidth, coverFlightData.naturalHeight)
      : settledBox;

    let floater = document.getElementById("sharedCoverFloater");
    if (!floater) {
      floater = document.createElement("img");
      floater.src = coverFlightData.src;
      floater.alt = "";
      floater.referrerPolicy = "no-referrer";
      floater.style.cssText =
        "position:fixed;left:0;top:0;z-index:9999;pointer-events:none;display:block;will-change:transform,width,height;" +
        "transform:translate3d(" + coverFlightData.fromRect.left + "px," + coverFlightData.fromRect.top + "px,0);" +
        "width:" + coverFlightData.fromRect.width + "px;height:" + coverFlightData.fromRect.height + "px;" +
        "object-fit:" + (coverFlightData.hasCover ? "contain" : "cover") + ";" +
        "border-radius:" + (coverFlightData.hasCover ? "0" : "2px") + ";" +
        "filter:" + (coverFlightData.hasCover ? "drop-shadow(0 14px 24px rgba(0,0,0,0.22))" : "drop-shadow(0 14px 28px rgba(0,0,0,0.24))") + ";";
      document.body.appendChild(floater);
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        floater.style.transition =
          "transform 1.05s cubic-bezier(0.22,1,0.36,1),width 1.05s cubic-bezier(0.22,1,0.36,1),height 1.05s cubic-bezier(0.22,1,0.36,1),filter 1.05s cubic-bezier(0.22,1,0.36,1)";
        floater.style.transform = "translate3d(" + toRect.left + "px," + toRect.top + "px,0)";
        floater.style.width = toRect.width + "px";
        floater.style.height = toRect.height + "px";
        floater.style.filter = coverFlightData.hasCover
          ? "drop-shadow(0 18px 28px rgba(0,0,0,0.28))"
          : "drop-shadow(0 18px 40px rgba(0,0,0,0.3))";
      });
    });

    setTimeout(() => {
      flightInProgress = false;
      rootEl.classList.add("detail-cover-handoff");
      rootEl.classList.remove("detail-cover-flying");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          floater.remove();
          if (deferredUpgrade) {
            const nextUrl = deferredUpgrade;
            deferredUpgrade = null;
            const decoder = new Image();
            decoder.src = nextUrl;
            const applyUpgrade = () => {
              coverImg.classList.remove("no-cover");
              coverImg.src = nextUrl;
            };
            if (typeof decoder.decode === "function") {
              decoder.decode().then(applyUpgrade, applyUpgrade);
            } else {
              decoder.onload = applyUpgrade;
            }
          }
          setTimeout(() => {
            rootEl.classList.remove("detail-cover-handoff");
          }, 30);
        });
      });
    }, 1070);
  } else {
    coverImg.classList.add("no-cover");
    coverImg.src = NO_COVER_IMG;
  }

  findCoverUrl().then((mediumUrl) => {
    if (!mediumUrl) return;
    const largeUrl = mediumUrl.replace("-M.jpg", "-L.jpg");
    const loader = new Image();
    loader.onload = () => {
      coverImg.alt = title;
      $("heroArt").style.backgroundImage = 'url("' + largeUrl + '")';
      $("heroArt").classList.add("ready");
      if (flightInProgress) {
        deferredUpgrade = largeUrl;
      } else {
        coverImg.classList.remove("no-cover");
        coverImg.src = largeUrl;
      }
    };
    loader.onerror = () => {
      const fallback = new Image();
      fallback.onload = () => {
        $("heroArt").style.backgroundImage = 'url("' + mediumUrl + '")';
        $("heroArt").classList.add("ready");
        if (flightInProgress) {
          deferredUpgrade = mediumUrl;
        } else {
          coverImg.classList.remove("no-cover");
          coverImg.src = mediumUrl;
        }
      };
      fallback.src = mediumUrl;
    };
    loader.src = largeUrl;
  });
});
