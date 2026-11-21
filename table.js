document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("tableBody");
  const searchInput = document.getElementById("searchInput");

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

  // Blank book cover (no text) used when a book has no cover image
  const NO_COVER_IMG =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="150" viewBox="0 0 100 150">' +
        '<rect width="100" height="150" rx="6" fill="#a0aec0"/>' +
        '<rect x="0" y="0" width="10" height="150" rx="3" fill="#718096"/>' +
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

  // Covers are loaded only when their row becomes visible
  const coverObserver = new IntersectionObserver((entries) => {
    entries.forEach(async (entry) => {
      if (!entry.isIntersecting) return;
      const img = entry.target;
      coverObserver.unobserve(img);

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
  }, {
    // Start loading covers about 1500px before they scroll into view
    root: document.querySelector(".table-container"),
    rootMargin: "1500px 0px"
  });

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

  function renderTable(books) {
    tableBody.innerHTML = "";

    if (books.length === 0) {
      const row = document.createElement("tr");

      row.innerHTML =`
        <td colspan="7" class="empty-message">
          No matching books found.
        </td>
     `;

      tableBody.appendChild(row);
      return;
    }

    books.forEach((book) => {
      const row = document.createElement("tr");

      row.innerHTML =`
        <td><strong>${book.book ?? ""}</strong></td>
        <td>
          <img class="book-cover"
               alt="${escapeHtml(book.book)}"
               data-title="${escapeHtml(book.book)}"
               data-authors="${escapeHtml(book.authors)}">
        </td>
        <td><span class="author-hover" data-author="${escapeHtml(book.authors)}">${book.authors ?? ""}</span></td>
        <td>${book.originalLanguage ?? ""}</td>
        <td>${book.firstPublished ?? ""}</td>
        <td>${book.approximateSalesInMillions ?? ""}</td>
        <td>${book.genre ?? ""}</td>
      `;

      tableBody.appendChild(row);
      coverObserver.observe(row.querySelector(".book-cover"));
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

  tableBody.addEventListener("mouseover", async (event) => {
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

  tableBody.addEventListener("mouseout", (event) => {
    if (event.target.closest(".author-hover")) {
      hoveredAuthor = null;
      tooltip.style.display = "none";
    }
  });
  // ----- End of added hover logic -----

  // ----- Added: enlarge book cover on hover (only real covers, not the blank one) -----
  tableBody.addEventListener("mouseover", (event) => {
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

  tableBody.addEventListener("mouseout", (event) => {
    if (event.target.closest(".book-cover")) {
      coverPreview.style.display = "none";
    }
  });

  // Hide the preview if the table is scrolled while hovering
  document.querySelector(".table-container").addEventListener("scroll", () => {
    coverPreview.style.display = "none";
    tooltip.style.display = "none";
  });
  // ----- End of added cover hover logic -----

  function handleSearch(event) {
    const query = event.target.value.trim().toLowerCase();

    if (!query) {
      renderTable(books);
      return;
    }

    const filtered = books.filter((book) =>
      String(book.book ?? "").toLowerCase().includes(query) ||
      String(book.authors ?? "").toLowerCase().includes(query) ||
      String(book.originalLanguage ?? "").toLowerCase().includes(query) ||
      String(book.firstPublished ?? "").toLowerCase().includes(query) ||
      String(book.approximateSalesInMillions ?? "").toLowerCase().includes(query) ||
      String(book.genre ?? "").toLowerCase().includes(query)
    );

    renderTable(filtered);
  }

  renderTable(books);

  searchInput.addEventListener("input", handleSearch);
});
