document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("bookGrid");
  const searchInput = document.getElementById("searchInput");
  const resultsTitle = document.getElementById("resultsTitle");
  const resultsCount = document.getElementById("resultsCount");
  const viewToggle = document.getElementById("viewToggle");
  const menuButton = document.getElementById("menuButton");

  // Most popular first (stable sort: books with equal sales keep the order of data.js)
  const sortedBooks = books.slice().sort(
    (a, b) => (Number(b.approximateSalesInMillions) || 0) - (Number(a.approximateSalesInMillions) || 0)
  );
  const maxSales = Math.max(...sortedBooks.map((b) => Number(b.approximateSalesInMillions) || 0), 1);

  // ----- Added: image helpers (covers from Open Library, author photos from Wikipedia) -----
  // Author photo URLs are remembered in the browser too
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
    } catch (err) {
      // Storage may be full or blocked; the page still works without it
    }
  }

  // Download an image in the background so it is ready when it is needed
  const preloadedImages = {};
  function preloadImage(url) {
    if (!url || preloadedImages[url]) return;
    preloadedImages[url] = true;
    const preload = new Image();
    preload.src = url;
  }


  // Cover URLs are remembered in the browser, so next visits are almost instant
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
    } catch (err) {
      // Storage may be full or blocked; the page still works without it
    }
  }

  // Run several requests at the same time, but not too many.
  // "urgent" jobs (like a hover) jump to the front of the queue.
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

  // Avoid sending the same request twice
  const pendingCovers = {};
  const pendingAuthors = {};

  // Book icon on a plain cover, used when a book has no cover image
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

  // Floating element for the author photo (outside the table so it is never clipped)
  const tooltip = document.createElement("div");
  tooltip.className = "author-tooltip";
  document.body.appendChild(tooltip);

  // Floating element for the enlarged book cover
  const coverPreview = document.createElement("div");
  coverPreview.className = "cover-preview";
  document.body.appendChild(coverPreview);

  function escapeHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // If there are several authors, use the first one
  function firstAuthor(authors) {
    return String(authors ?? "").split(/,| and | & |;/)[0].trim();
  }

  function fetchCover(title, authors) {
    const key = title + "|" + authors;

    // Already known (a string means a cover was found, "" means there is none)
    if (key in coverCache) {
      return Promise.resolve(coverCache[key] || null);
    }
    if (key in pendingCovers) return pendingCovers[key];

    // Remove text inside parentheses, e.g. (Le Petit Prince)
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
        // Network error: do not remember it, so it can be tried again later
        return null;
      } finally {
        delete pendingCovers[key];
      }
    });

    return pendingCovers[key];
  }

  function fetchAuthorPhoto(authors, urgent) {
    const name = firstAuthor(authors);

    // Already known (a string means a photo was found, "" means there is none)
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
        // Network error: do not remember it, so it can be tried again later
        return null;
      } finally {
        delete pendingAuthors[name];
      }
    }, urgent);

    return pendingAuthors[name];
  }

  // Show the blank cover and make sure it does not enlarge on hover
  function showPlaceholder(img) {
    img.onerror = null;
    img.classList.remove("has-cover");
    img.classList.add("no-cover");
    img.alt = "No cover available";
    img.src = NO_COVER_IMG;
  }

  // Covers are loaded shortly before they come into view
  function onCoverVisible(entries, observer) {
    entries.forEach(async (entry) => {
      if (!entry.isIntersecting) return;
      const img = entry.target;
      observer.unobserve(img);

      // Get the author's photo ready in the background for the hover
      fetchAuthorPhoto(img.dataset.authors).then(preloadImage);

      const src = await fetchCover(img.dataset.title, img.dataset.authors);
      if (src) {
        // If the image fails to load, fall back to the blank cover
        img.onerror = () => showPlaceholder(img);
        img.classList.add("has-cover");
        img.src = src;
      } else {
        showPlaceholder(img);
      }
    });
  }

  // Row (carousel) view: the row scrolls sideways, so it is the "root" of the observer
  const rowObserver = new IntersectionObserver(onCoverVisible, {
    root: grid,
    rootMargin: "0px 1500px"
  });

  // Grid view: the whole page scrolls up and down
  const pageObserver = new IntersectionObserver(onCoverVisible, {
    rootMargin: "1500px 0px"
  });

  function observeCover(img) {
    (document.body.classList.contains("view-grid") ? pageObserver : rowObserver).observe(img);
  }

  // Place the author photo under the author name (fixed, does not follow the mouse)
  function positionAuthorTooltip(target) {
    const rect = target.getBoundingClientRect();
    const tipHeight = tooltip.offsetHeight || 190;
    const tipWidth = tooltip.offsetWidth || 152;

    let left = rect.left;
    if (left + tipWidth > window.innerWidth - 8) {
      left = window.innerWidth - tipWidth - 8;
    }

    // Show below the name; if there is no room, show above it
    let top = rect.bottom + 8;
    if (top + tipHeight > window.innerHeight - 8) {
      top = rect.top - tipHeight - 8;
    }

    tooltip.style.left = Math.max(8, left) + "px";
    tooltip.style.top = Math.max(8, top) + "px";
  }

  // Place the enlarged cover next to the small one, kept inside the screen
  function positionCoverPreview(img) {
    const rect = img.getBoundingClientRect();
    const previewWidth = 220;
    const previewHeight = 330;

    let left = rect.right + 12;
    if (left + previewWidth > window.innerWidth) {
      left = rect.left - previewWidth - 12;
    }

    let top = rect.top + rect.height / 2 - previewHeight / 2;
    top = Math.max(8, Math.min(top, window.innerHeight - previewHeight - 8));

    coverPreview.style.left = left + "px";
    coverPreview.style.top = top + "px";
  }
  // ----- End of added helpers -----

  function renderBooks(list) {
    grid.innerHTML = "";
    grid.scrollLeft = 0;

    if (list.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-message";
      empty.textContent = "No matching books found.";
      grid.appendChild(empty);
      return;
    }

    list.forEach((book) => {
      const sales = Number(book.approximateSalesInMillions) || 0;
      const barWidth = Math.max(4, Math.round((sales / maxSales) * 100));
      const card = document.createElement("article");
      card.className = "book-card";

      card.innerHTML = `
        <img class="book-cover"
             alt="${escapeHtml(book.book)}"
             data-title="${escapeHtml(book.book)}"
             data-authors="${escapeHtml(book.authors)}">
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
          ${book.genre ? `<span class="book-genre">${escapeHtml(book.genre)}</span>` : ""}
        </div>
      `;

      grid.appendChild(card);
      observeCover(card.querySelector(".book-cover"));
    });
  }

  // ----- Added: show author photo on hover -----
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
    // If the mouse already left (or moved to another author), do nothing
    if (hoveredAuthor !== target) return;

    if (!photo) {
      showAuthorTooltip(target, `<div class="tooltip-empty">No photo available</div>`);
      return;
    }

    // Show the photo only when it is fully loaded (instant if it was preloaded)
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
  // ----- End of added hover logic -----

  // ----- Added: enlarge book cover on hover (only real covers, not the blank one) -----
  grid.addEventListener("mouseover", (event) => {
    const img = event.target.closest(".book-cover.has-cover");
    if (!img) return;

    // Show the already loaded cover instantly, then switch to the sharper large version
    const mediumSrc = img.src;
    const largeSrc = mediumSrc.replace("-M.jpg", "-L.jpg");

    coverPreview.innerHTML = `<img src="${mediumSrc}" alt="${escapeHtml(img.alt)}">`;
    coverPreview.style.display = "block";
    positionCoverPreview(img);

    if (largeSrc !== mediumSrc) {
      const previewImg = coverPreview.querySelector("img");
      const big = new Image();
      big.onload = () => {
        // Swap only if this preview is still the one on screen
        if (coverPreview.contains(previewImg)) previewImg.src = largeSrc;
      };
      big.src = largeSrc;
    }
  });

  grid.addEventListener("mouseout", (event) => {
    if (event.target.closest(".book-cover")) {
      coverPreview.style.display = "none";
    }
  });

  // Hide the floating photos if the page is scrolled while hovering
  function hideFloating() {
    coverPreview.style.display = "none";
    tooltip.style.display = "none";
  }
  grid.addEventListener("scroll", hideFloating);
  window.addEventListener("scroll", () => {
    coverPreview.style.display = "none";
    tooltip.style.display = "none";
  });
  // ----- End of added cover hover logic -----

  function applySearch() {
    const typed = searchInput.value.trim();
    const query = typed.toLowerCase();

    const filtered = !query
      ? sortedBooks
      : sortedBooks.filter((book) =>
          String(book.book ?? "").toLowerCase().includes(query) ||
          String(book.authors ?? "").toLowerCase().includes(query) ||
          String(book.originalLanguage ?? "").toLowerCase().includes(query) ||
          String(book.firstPublished ?? "").toLowerCase().includes(query) ||
          String(book.approximateSalesInMillions ?? "").toLowerCase().includes(query) ||
          String(book.genre ?? "").toLowerCase().includes(query)
        );

    resultsTitle.textContent = typed ? "Search results" : "Most Popular Picks";
    resultsCount.textContent = typed
      ? filtered.length + " of " + sortedBooks.length + " books"
      : sortedBooks.length + " best-selling books, from the most to the least sold";

    renderBooks(filtered);
  }

  // A link like books.html?search=The%20Hobbit opens the page already filtered
  const initialSearch = new URLSearchParams(window.location.search).get("search");
  if (initialSearch) searchInput.value = initialSearch;

  applySearch();
  searchInput.addEventListener("input", applySearch);

  // Row view (default, like the design) <-> grid view with all the books
  viewToggle.addEventListener("click", () => {
    const isGrid = document.body.classList.toggle("view-grid");
    viewToggle.setAttribute("aria-pressed", String(isGrid));
    applySearch();
  });

  // Arrow buttons for the row
  const prevButton = document.getElementById("prevButton");
  const nextButton = document.getElementById("nextButton");
  function scrollRow(direction) {
    grid.scrollBy({ left: direction * Math.max(300, grid.clientWidth * 0.8), behavior: "smooth" });
  }
  if (prevButton) prevButton.addEventListener("click", () => scrollRow(-1));
  if (nextButton) nextButton.addEventListener("click", () => scrollRow(1));

  // Drag the row with the mouse (touch screens already scroll with a swipe)
  let drag = null;
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
    drag = null;
    grid.classList.remove("dragging");
  });

  // Side menu: hidden by default on small screens
  if (window.innerWidth < 900) document.body.classList.add("rail-hidden");
  menuButton.addEventListener("click", () => {
    document.body.classList.toggle("rail-hidden");
  });
});
