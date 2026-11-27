document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("bookGrid");
  const searchInput = document.getElementById("searchInput");
  const resultsTitle = document.getElementById("resultsTitle");
  const resultsCount = document.getElementById("resultsCount");
  const viewToggle = document.getElementById("viewToggle");
  const menuButton = document.getElementById("menuButton");
  const booksRailLink = document.getElementById("booksRailLink");
  const savedRailLink = document.getElementById("savedRailLink");

  const params = new URLSearchParams(window.location.search);
  const isSavedView = params.get("saved") === "1";

  if (isSavedView) {
    if (booksRailLink) booksRailLink.removeAttribute("aria-current");
    if (savedRailLink) savedRailLink.setAttribute("aria-current", "page");
    document.title = "Saved Books - Bestselling Books";
  }

  const sortedBooks = books.slice().sort(
    (a, b) => (Number(b.approximateSalesInMillions) || 0) - (Number(a.approximateSalesInMillions) || 0)
  );
  const maxSales = Math.max(...sortedBooks.map((b) => Number(b.approximateSalesInMillions) || 0), 1);

  function readSavedBooks() {
    try {
      const list = JSON.parse(localStorage.getItem("savedBooks_v1"));
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return [];
    }
  }

  const baseBooks = isSavedView
    ? sortedBooks.filter((b) => readSavedBooks().includes(String(b.book).trim()))
    : sortedBooks;

  const AUTHOR_STORAGE_KEY = "authorPhotoCache_v1";
  let authorCache = {};
  try {
    authorCache = JSON.parse(localStorage.getItem(AUTHOR_STORAGE_KEY)) || {};
  } catch (err) {
    authorCache = {};
  }

  function saveAuthorCache() {
    try {
      localStorage.setItem(AUTHOR_STORAGE_KEY, JSON.stringify(authorCache));
    } catch (err) {}
  }

  const preloadedImages = {};
  function preloadImage(url) {
    if (!url || preloadedImages[url]) return;
    preloadedImages[url] = true;
    const preload = new Image();
    preload.src = url;
  }

  const COVER_STORAGE_KEY = "bookCoverCache_v1";
  let coverCache = {};
  try {
    coverCache = JSON.parse(localStorage.getItem(COVER_STORAGE_KEY)) || {};
  } catch (err) {
    coverCache = {};
  }

  function saveCoverCache() {
    try {
      localStorage.setItem(COVER_STORAGE_KEY, JSON.stringify(coverCache));
    } catch (err) {}
  }

  function createLimiter(maxConcurrent) {
    let active = 0;
    const queue = [];

    function next() {
      while (active < maxConcurrent && queue.length > 0) {
        const job = queue.shift();
        active++;
        job().finally(() => {
          active--;
          next();
        });
      }
    }

    return function enqueue(task, urgent) {
      return new Promise((resolve) => {
        const job = () => task().then(resolve, () => resolve(null));
        if (urgent) {
          queue.unshift(job);
        } else {
          queue.push(job);
        }
        next();
      });
    };
  }

  const enqueueCover = createLimiter(6);
  const enqueueAuthor = createLimiter(4);
  const pendingCovers = {};
  const pendingAuthors = {};

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

  const tooltip = document.createElement("div");
  tooltip.className = "author-tooltip";
  document.body.appendChild(tooltip);

  function escapeHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function stripDiacritics(text) {
    return String(text ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function firstAuthor(authors) {
    return String(authors ?? "").split(/,| and | & |;/)[0].trim();
  }

  function fetchCover(title, authors) {
    const key = title + "|" + authors;
    if (key in coverCache) {
      return Promise.resolve(coverCache[key] || null);
    }
    if (key in pendingCovers) return pendingCovers[key];

    const cleanTitle = String(title).replace(/\s*\(.*?\)\s*/g, " ").trim();
    const author = firstAuthor(authors);

    pendingCovers[key] = enqueueCover(async () => {
      try {
        const url =
          "https://openlibrary.org/search.json?limit=1&fields=cover_i" +
          "&title=" + encodeURIComponent(cleanTitle) +
          "&author=" + encodeURIComponent(author);
        const res = await fetch(url);
        const data = await res.json();
        const id = data.docs && data.docs[0] && data.docs[0].cover_i;
        coverCache[key] = id
          ? "https://covers.openlibrary.org/b/id/" + id + "-M.jpg"
          : "";
        saveCoverCache();
        return coverCache[key] || null;
      } catch (err) {
        return null;
      } finally {
        delete pendingCovers[key];
      }
    });

    return pendingCovers[key];
  }

  function fetchAuthorPhoto(authors, urgent) {
    const name = firstAuthor(authors);
    if (name in authorCache) {
      return Promise.resolve(authorCache[name] || null);
    }
    if (name in pendingAuthors) return pendingAuthors[name];

    pendingAuthors[name] = enqueueAuthor(async () => {
      try {
        const url =
          "https://en.wikipedia.org/api/rest_v1/page/summary/" +
          encodeURIComponent(name.replace(/ /g, "_"));
        const res = await fetch(url);
        const data = await res.json();
        authorCache[name] = (data.thumbnail && data.thumbnail.source) || "";
        saveAuthorCache();
        return authorCache[name] || null;
      } catch (err) {
        return null;
      } finally {
        delete pendingAuthors[name];
      }
    }, urgent);

    return pendingAuthors[name];
  }

  function showPlaceholder(img) {
    img.onerror = null;
    img.classList.remove("has-cover");
    img.classList.add("no-cover");
    img.alt = "No cover available";
    img.src = NO_COVER_IMG;
  }

  function onCoverVisible(entries, observer) {
    entries.forEach(async (entry) => {
      if (!entry.isIntersecting) return;
      const img = entry.target;
      observer.unobserve(img);

      fetchAuthorPhoto(img.dataset.authors).then(preloadImage);

      const src = await fetchCover(img.dataset.title, img.dataset.authors);
      if (src) {
        img.onerror = () => showPlaceholder(img);
        img.classList.remove("no-cover");
        img.classList.add("has-cover");
        img.src = src;
      } else {
        showPlaceholder(img);
      }
    });
  }

  const rowObserver = new IntersectionObserver(onCoverVisible, {
    root: grid,
    rootMargin: "0px 1500px"
  });

  const pageObserver = new IntersectionObserver(onCoverVisible, {
    rootMargin: "1500px 0px"
  });

  function observeCover(img) {
    (document.body.classList.contains("view-grid") ? pageObserver : rowObserver).observe(img);
  }

  function positionAuthorTooltip(target) {
    const rect = target.getBoundingClientRect();
    const tipHeight = tooltip.offsetHeight || 190;
    const tipWidth = tooltip.offsetWidth || 152;

    let left = rect.left;
    if (left + tipWidth > window.innerWidth - 8) {
      left = window.innerWidth - tipWidth - 8;
    }

    let top = rect.bottom + 8;
    if (top + tipHeight > window.innerHeight - 8) {
      top = rect.top - tipHeight - 8;
    }

    tooltip.style.left = Math.max(8, left) + "px";
    tooltip.style.top = Math.max(8, top) + "px";
  }

  function renderBooks(list) {
    grid.innerHTML = "";
    grid.scrollLeft = 0;

    if (list.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-message";
      empty.textContent = isSavedView && !searchInput.value.trim()
        ? "You haven't saved any books yet. Open any book cover and click Save to bookmark it here."
        : "No matching books found.";
      grid.appendChild(empty);
      return;
    }

    list.forEach((book) => {
      const sales = Number(book.approximateSalesInMillions) || 0;
      const barWidth = Math.max(4, Math.round((sales / maxSales) * 100));
      const card = document.createElement("article");
      card.className = "book-card";

      card.innerHTML = `
        <a class="cover-link" draggable="false"
           href="detail.html?title=${encodeURIComponent(String(book.book).trim())}"
           aria-label="Open the details of ${escapeHtml(book.book)}">
          <img class="book-cover no-cover" draggable="false"
               src="${NO_COVER_IMG}"
               alt="${escapeHtml(book.book)}"
               data-title="${escapeHtml(book.book)}"
               data-authors="${escapeHtml(book.authors)}">
        </a>
        <div class="book-info">
          <h3 class="book-title">${escapeHtml(book.book)}</h3>
          <div class="book-author">
            <span class="author-hover" data-author="${escapeHtml(book.authors)}">${escapeHtml(book.authors)}</span>
          </div>
          <div class="sales">
            <div class="sales-bar"><span style="width: ${barWidth}%"></span></div>
            <div class="sales-text">About ${escapeHtml(sales)} million copies sold</div>
          </div>
          <div class="book-meta">First published ${escapeHtml(book.firstPublished)} &middot; ${escapeHtml(book.originalLanguage)}</div>
          ${book.genre ? `<div class="book-genre">${escapeHtml(book.genre)}</div>` : ""}
        </div>
      `;

      grid.appendChild(card);
      observeCover(card.querySelector(".book-cover"));
    });
  }

  let hoveredAuthor = null;

  function showAuthorTooltip(target, html) {
    if (hoveredAuthor !== target) return;
    tooltip.innerHTML = html;
    tooltip.style.display = "block";
    positionAuthorTooltip(target);
  }

  grid.addEventListener("mouseover", async (event) => {
    const target = event.target.closest(".author-hover");
    if (!target) return;

    hoveredAuthor = target;
    const authors = target.dataset.author;

    const photo = await fetchAuthorPhoto(authors, true);
    if (hoveredAuthor !== target) return;

    if (!photo) {
      showAuthorTooltip(target, `<div class="tooltip-empty">No photo available</div>`);
      return;
    }

    const probe = new Image();
    probe.onload = () => {
      showAuthorTooltip(target, `<img src="${photo}" alt="${escapeHtml(authors)}">`);
    };
    probe.onerror = () => {
      showAuthorTooltip(target, `<div class="tooltip-empty">No photo available</div>`);
    };
    probe.src = photo;
  });

  grid.addEventListener("mouseout", (event) => {
    if (event.target.closest(".author-hover")) {
      hoveredAuthor = null;
      tooltip.style.display = "none";
    }
  });

  function hideFloating() {
    tooltip.style.display = "none";
  }
  grid.addEventListener("scroll", hideFloating);
  window.addEventListener("scroll", hideFloating);

  function applySearch() {
    const typed = searchInput.value.trim();
    const query = stripDiacritics(typed);

    const filtered = !query
      ? baseBooks
      : baseBooks.filter((book) => {
          const hay = stripDiacritics(
            `${book.book ?? ""} ${book.authors ?? ""} ${book.originalLanguage ?? ""} ${book.firstPublished ?? ""} ${book.approximateSalesInMillions ?? ""} ${book.genre ?? ""}`
          );
          return hay.includes(query);
        });

    if (isSavedView) {
      resultsTitle.textContent = typed ? "Saved Search Results" : "Saved Books";
      resultsCount.textContent = filtered.length === 0
        ? (typed ? "No saved books match your search" : "No saved books yet")
        : `${filtered.length} saved ${filtered.length === 1 ? "book" : "books"}`;
    } else {
      resultsTitle.textContent = typed ? "Search results" : "Most Popular Picks";
      resultsCount.textContent = typed
        ? filtered.length + " of " + baseBooks.length + " books"
        : baseBooks.length + " best-selling books, from the most to the least sold";
    }

    renderBooks(filtered);
  }

  const initialSearch = params.get("search");
  if (initialSearch) searchInput.value = initialSearch;

  applySearch();
  searchInput.addEventListener("input", applySearch);

  viewToggle.addEventListener("click", () => {
    const isGrid = document.body.classList.toggle("view-grid");
    viewToggle.setAttribute("aria-pressed", String(isGrid));
    applySearch();
  });

  const prevButton = document.getElementById("prevButton");
  const nextButton = document.getElementById("nextButton");
  function scrollRow(direction) {
    grid.scrollBy({ left: direction * Math.max(300, grid.clientWidth * 0.8), behavior: "smooth" });
  }
  if (prevButton) prevButton.addEventListener("click", () => scrollRow(-1));
  if (nextButton) nextButton.addEventListener("click", () => scrollRow(1));

  let drag = null;
  let suppressClick = false;
  grid.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    if (document.body.classList.contains("view-grid")) return;
    drag = { x: event.clientX, left: grid.scrollLeft, moved: false };
  });
  window.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    if (Math.abs(dx) > 4) {
      drag.moved = true;
      grid.classList.add("dragging");
    }
    if (drag.moved) grid.scrollLeft = drag.left - dx;
  });
  window.addEventListener("pointerup", () => {
    if (drag && drag.moved) {
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
    }
    drag = null;
    grid.classList.remove("dragging");
  });
  grid.addEventListener("click", (event) => {
    if (suppressClick) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  if (window.innerWidth < 900) document.body.classList.add("rail-hidden");
  menuButton.addEventListener("click", () => {
    document.body.classList.toggle("rail-hidden");
  });

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let navigatingToDetail = false;

  function runReturnEntrance() {
    document.body.classList.remove("page-exit-left", "page-exit-right");
    document.querySelectorAll(".book-cover").forEach((el) => { el.style.opacity = ""; });
    document.documentElement.classList.remove("page-transition-lock");
    navigatingToDetail = false;

    let backCoverData = null;
    try {
      const rawBack = sessionStorage.getItem("bookCoverBackTransition");
      if (rawBack) {
        backCoverData = JSON.parse(rawBack);
        sessionStorage.removeItem("bookCoverBackTransition");
      }
    } catch (err) {}

    if (sessionStorage.getItem("bookTransition") === "back-to-list") {
      sessionStorage.removeItem("bookTransition");
      const existingFloater = document.getElementById("sharedCoverFloater");

      try {
        const savedScroll = Number(sessionStorage.getItem("bookGridScrollLeft") || "0");
        if (savedScroll > 0) grid.scrollLeft = savedScroll;
      } catch (err) {}

      if (reduceMotion) {
        if (existingFloater) existingFloater.remove();
        document.documentElement.classList.remove("page-enter-from-right", "page-enter-active", "rail-reveal-active", "cover-back-flying");
        return;
      }

      document.documentElement.classList.add("page-transition-lock", "page-enter-from-right");

      let targetCoverEl = null;
      if (backCoverData && backCoverData.title) {
        const wantedTitle = String(backCoverData.title).trim();
        const allImgs = grid.querySelectorAll("img.book-cover");
        for (const el of allImgs) {
          if (String(el.dataset.title || "").trim() === wantedTitle) {
            targetCoverEl = el;
            break;
          }
        }
      }

      if (backCoverData && targetCoverEl) {
        targetCoverEl.classList.add("book-cover-return-hidden");
        if (backCoverData.hasCover) {
          targetCoverEl.classList.remove("no-cover");
          targetCoverEl.src = backCoverData.src;
        }
        const pageEl = document.querySelector(".page");
        const box = targetCoverEl.getBoundingClientRect();
        let offsetX = 0;
        let offsetY = 0;
        if (pageEl) {
          const tStr = window.getComputedStyle(pageEl).transform;
          if (tStr && tStr !== "none") {
            const m = new DOMMatrix(tStr);
            offsetX = m.m41;
            offsetY = m.m42;
          }
        }
        const settledBox = {
          left: box.left - offsetX,
          top: box.top - offsetY,
          width: box.width,
          height: box.height,
        };
        const toRect = backCoverData.hasCover
          ? getContainedRect(settledBox, backCoverData.naturalWidth, backCoverData.naturalHeight, "top")
          : settledBox;

        const floater = existingFloater || (() => {
          const el = document.createElement("img");
          el.id = "sharedCoverFloater";
          el.src = backCoverData.src;
          el.alt = "";
          el.referrerPolicy = "no-referrer";
          el.style.cssText =
            "position:fixed;left:0;top:0;z-index:9999;pointer-events:none;display:block;will-change:transform,width,height;" +
            "transform:translate3d(" + backCoverData.fromRect.left + "px," + backCoverData.fromRect.top + "px,0);" +
            "width:" + backCoverData.fromRect.width + "px;height:" + backCoverData.fromRect.height + "px;" +
            "object-fit:" + (backCoverData.hasCover ? "contain" : "cover") + ";" +
            "border-radius:" + (backCoverData.hasCover ? "0" : "2px") + ";" +
            "filter:" + (backCoverData.hasCover ? "drop-shadow(0 18px 28px rgba(0,0,0,0.28))" : "drop-shadow(0 18px 40px rgba(0,0,0,0.3))") + ";";
          document.body.appendChild(el);
          return el;
        })();

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            document.documentElement.classList.add("page-enter-active", "rail-reveal-active");
            floater.style.transition =
              "transform 1.05s cubic-bezier(0.22,1,0.36,1),width 1.05s cubic-bezier(0.22,1,0.36,1),height 1.05s cubic-bezier(0.22,1,0.36,1),filter 1.05s cubic-bezier(0.22,1,0.36,1)";
            floater.style.transform = "translate3d(" + toRect.left + "px," + toRect.top + "px,0)";
            floater.style.width = toRect.width + "px";
            floater.style.height = toRect.height + "px";
            floater.style.filter = backCoverData.hasCover
              ? "drop-shadow(0 6px 12px rgba(0,0,0,0.16))"
              : "none";
          });
        });

        setTimeout(() => {
          document.documentElement.classList.add("cover-back-handoff");
          document.documentElement.classList.remove("cover-back-flying");
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              floater.remove();
              targetCoverEl.classList.remove("book-cover-return-hidden");
              document.documentElement.classList.remove("cover-back-handoff");
            });
          });
        }, 1070);
      } else {
        if (existingFloater) existingFloater.remove();
        document.documentElement.classList.remove("cover-back-flying");
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            document.documentElement.classList.add("page-enter-active", "rail-reveal-active");
          });
        });
      }

      setTimeout(() => {
        document.documentElement.classList.remove(
          "page-transition-lock",
          "page-enter-from-right",
          "page-enter-active"
        );
      }, 1080);
      setTimeout(() => {
        document.documentElement.classList.remove("rail-reveal-active");
      }, 1480);
    } else {
      const existingFloater = document.getElementById("sharedCoverFloater");
      if (existingFloater) existingFloater.remove();
      document.documentElement.classList.remove("page-enter-from-right", "page-enter-active", "rail-reveal-active", "cover-back-flying");
    }
  }

  window.addEventListener("pageshow", runReturnEntrance);
  runReturnEntrance();

  function getContainedRect(box, nw, nh, alignY) {
    if (!nw || !nh || !box.width || !box.height) {
      return { left: box.left, top: box.top, width: box.width, height: box.height };
    }
    const scale = Math.min(box.width / nw, box.height / nh);
    const width = nw * scale;
    const height = nh * scale;
    const left = box.left + (box.width - width) / 2;
    const top = alignY === "top" ? box.top : box.top + (box.height - height) / 2;
    return { left, top, width, height };
  }

  grid.addEventListener("click", (event) => {
    const link = event.target.closest(".cover-link");
    if (!link || suppressClick) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    if (navigatingToDetail) return;
    navigatingToDetail = true;

    const targetHref = link.href;
    if (reduceMotion) {
      window.location.href = targetHref;
      return;
    }

    try { sessionStorage.setItem("bookGridScrollLeft", String(grid.scrollLeft || 0)); } catch (err) {}
    const coverImg = link.querySelector(".book-cover");
    if (coverImg) {
      const box = coverImg.getBoundingClientRect();
      const hasCover = !coverImg.classList.contains("no-cover");
      const nw = coverImg.naturalWidth || 100;
      const nh = coverImg.naturalHeight || 150;
      const fromRect = hasCover
        ? getContainedRect(box, nw, nh, "top")
        : { left: box.left, top: box.top, width: box.width, height: box.height };
      const src = coverImg.currentSrc || coverImg.src;

      try {
        sessionStorage.setItem(
          "bookCoverTransition",
          JSON.stringify({ src, hasCover, fromRect, naturalWidth: nw, naturalHeight: nh })
        );
      } catch (err) {}

      coverImg.style.opacity = "0";
      const floater = document.createElement("img");
      floater.src = src;
      floater.alt = "";
      floater.referrerPolicy = "no-referrer";
      floater.style.cssText =
        "position:fixed;left:0;top:0;z-index:9999;pointer-events:none;display:block;" +
        "transform:translate3d(" + fromRect.left + "px," + fromRect.top + "px,0);" +
        "width:" + fromRect.width + "px;height:" + fromRect.height + "px;" +
        "object-fit:" + (hasCover ? "contain" : "cover") + ";" +
        "border-radius:" + (hasCover ? "0" : "2px") + ";" +
        "filter:" + (hasCover ? "drop-shadow(0 6px 12px rgba(0,0,0,0.16))" : "none") + ";" +
        "transition:filter 0.48s ease;";
      document.body.appendChild(floater);
      requestAnimationFrame(() => {
        floater.style.filter = hasCover
          ? "drop-shadow(0 14px 24px rgba(0,0,0,0.22))"
          : "drop-shadow(0 14px 28px rgba(0,0,0,0.24))";
      });
    }

    sessionStorage.setItem("bookTransition", "to-detail");
    document.documentElement.classList.add("page-transition-lock");
    document.body.classList.add("page-exit-right");

    setTimeout(() => {
      window.location.href = targetHref;
    }, 480);
  });
});
