document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("tableBody");
  const searchInput = document.getElementById("searchInput");

  // ----- Added: image helpers (covers from Open Library, author photos from Wikipedia) -----
  const authorCache = {};

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

  // Run several requests at the same time, but not too many
  const MAX_CONCURRENT = 6;
  let activeRequests = 0;
  const requestQueue = [];

  function runNextRequest() {
    while (activeRequests < MAX_CONCURRENT && requestQueue.length > 0) {
      const job = requestQueue.shift();
      activeRequests++;
      job().finally(() => {
        activeRequests--;
        runNextRequest();
      });
    }
  }

  function enqueue(task) {
    return new Promise((resolve) => {
      requestQueue.push(() => task().then(resolve, () => resolve(null)));
      runNextRequest();
    });
  }

  // Avoid sending the same request twice
  const pendingCovers = {};

  // Blank book cover (no text) used when a book has no cover image
  const NO_COVER_IMG =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="150" viewBox="0 0 100 150">' +
        '<rect width="100" height="150" rx="6" fill="#a0aec0"/>' +
        '<rect x="0" y="0" width="10" height="150" rx="3" fill="#718096"/>' +
        '<circle cx="56" cy="75" r="18" fill="none" stroke="#e2e8f0" stroke-width="4"/>' +
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

    pendingCovers[key] = enqueue(async () => {
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

  async function fetchAuthorPhoto(authors) {
    const name = firstAuthor(authors);
    if (name in authorCache) return authorCache[name];

    try {
      const url =
        "https://en.wikipedia.org/api/rest_v1/page/summary/" +
        encodeURIComponent(name.replace(/ /g, "_"));
      const res = await fetch(url);
      const data = await res.json();
      authorCache[name] = (data.thumbnail && data.thumbnail.source) || null;
    } catch (err) {
      authorCache[name] = null;
    }
    return authorCache[name];
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

  function positionTooltip(event) {
    tooltip.style.left = event.clientX + 16 + "px";
    tooltip.style.top = event.clientY + 16 + "px";
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
  tableBody.addEventListener("mouseover", async (event) => {
    const target = event.target.closest(".author-hover");
    if (!target) return;

    const authors = target.dataset.author;
    tooltip.innerHTML = "";
    tooltip.style.display = "block";
    positionTooltip(event);

    const photo = await fetchAuthorPhoto(authors);
    // If the mouse already left, do nothing
    if (tooltip.style.display === "none") return;

    if (photo) {
      tooltip.innerHTML = `<img src="${photo}" alt="${escapeHtml(authors)}">`;
    } else {
      tooltip.innerHTML = `<div class="tooltip-empty">No photo available</div>`;
    }
  });

  tableBody.addEventListener("mousemove", (event) => {
    if (event.target.closest(".author-hover")) positionTooltip(event);
  });

  tableBody.addEventListener("mouseout", (event) => {
    if (event.target.closest(".author-hover")) {
      tooltip.style.display = "none";
    }
  });
  // ----- End of added hover logic -----

  // ----- Added: enlarge book cover on hover (only real covers, not the blank one) -----
  tableBody.addEventListener("mouseover", (event) => {
    const img = event.target.closest(".book-cover.has-cover");
    if (!img) return;

    // Use the large version of the same cover for a sharper preview
    const largeSrc = img.src.replace("-M.jpg", "-L.jpg");
    coverPreview.innerHTML = `<img src="${largeSrc}" alt="${escapeHtml(img.alt)}">`;
    coverPreview.style.display = "block";
    positionCoverPreview(img);
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
