document.addEventListener("DOMContentLoaded", () => {
  if (typeof books === "undefined") return;

  const $ = (id) => document.getElementById(id);
  const stage = $("stage");

  // ---------------------------------------------------------------------------
  // Find the book: detail.html?title=The%20Hobbit
  // ---------------------------------------------------------------------------
  const wanted = (new URLSearchParams(window.location.search).get("title") || "").trim().toLowerCase();
  const book = books.find((b) => String(b.book ?? "").trim().toLowerCase() === wanted);

  if (!book) {
    $("detailCard").hidden = true;
    $("salesNote").hidden = true;
    $("notFound").hidden = false;
    document.title = "Book not found - Bestselling Books";
    return;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const title = String(book.book).trim();
  const authors = String(book.authors ?? "").trim();
  const sales = Number(book.approximateSalesInMillions) || 0;

  // If there are several authors, use the first one
  function firstAuthor(text) {
    return String(text ?? "").split(/,| and | & |;/)[0].trim();
  }

  // Title without the text in parentheses, used for the outside links
  const cleanTitle = title.replace(/\s*\(.*?\)\s*/g, " ").trim();

  // Blank cover with a book icon, used when a book has no cover image
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

  // ---------------------------------------------------------------------------
  // Text
  // ---------------------------------------------------------------------------
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

  // Rank by sales (books with the same sales share the same rank)
  const rank = books.filter((b) => (Number(b.approximateSalesInMillions) || 0) > sales).length + 1;
  $("rankText").textContent = "Ranked #" + rank + " of " + books.length + " books by sales";

  // ---------------------------------------------------------------------------
  // Links to outside pages (open in a new tab)
  // ---------------------------------------------------------------------------
  const searchText = encodeURIComponent((cleanTitle + " " + firstAuthor(authors)).trim());
  $("wikiLink").href = "https://en.wikipedia.org/wiki/Special:Search?search=" + searchText;
  $("findLink").href = "https://openlibrary.org/search?q=" + searchText;

  // ---------------------------------------------------------------------------
  // Back button: go back to the list exactly as it was (same search), if we came from it
  // ---------------------------------------------------------------------------
  $("backLink").addEventListener("click", (event) => {
    let cameFromSite = false;
    try {
      cameFromSite = document.referrer && new URL(document.referrer).origin === window.location.origin;
    } catch (err) {
      cameFromSite = false;
    }
    if (cameFromSite && window.history.length > 1) {
      event.preventDefault();
      window.history.back();
    }
  });

  // ---------------------------------------------------------------------------
  // Save button (kept in this browser only)
  // ---------------------------------------------------------------------------
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
    } catch (err) {
      // Storage may be blocked; the button still changes for this visit
    }
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

  // ---------------------------------------------------------------------------
  // Author photo: shown when the mouse is on the author name
  // (uses the same saved photo addresses as the Book List page)
  // ---------------------------------------------------------------------------
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
        } catch (err) {
          // Storage may be full or blocked
        }
        return photo || null;
      } catch (err) {
        // Network error: try again next time
        authorPhotoPromise = null;
        return null;
      }
    })();
    return authorPhotoPromise;
  }

  // Floating photo (outside the card, so it is never clipped)
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

    // Under the name; if there is no room, above it
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

    // Show the photo only when it is fully loaded (instant if it was preloaded)
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

  // Get the photo ready in the background so the hover is instant
  findAuthorPhoto().then((photo) => {
    if (photo) new Image().src = photo;
  });

  // ---------------------------------------------------------------------------
  // Cover: uses the same saved cover addresses as the Book List page
  // ---------------------------------------------------------------------------
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
      } catch (err) {
        // Storage may be full or blocked
      }
      return cache[key] || null;
    } catch (err) {
      return null;
    }
  }

  function showPlaceholder() {
    coverImg.onerror = null;
    coverImg.alt = "No cover available";
    coverImg.src = NO_COVER_IMG;
  }

  coverImg.alt = title;
  coverImg.src = NO_COVER_IMG;

  findCoverUrl().then((mediumUrl) => {
    if (!mediumUrl) return;

    const largeUrl = mediumUrl.replace("-M.jpg", "-L.jpg");
    const loader = new Image();
    loader.onload = () => {
      coverImg.alt = title;
      coverImg.src = largeUrl;
      $("heroArt").style.backgroundImage = 'url("' + largeUrl + '")';
      $("heroArt").classList.add("ready");
    };
    loader.onerror = () => {
      // The large version is missing: try the medium one, otherwise keep the icon
      const fallback = new Image();
      fallback.onload = () => {
        coverImg.src = mediumUrl;
        $("heroArt").style.backgroundImage = 'url("' + mediumUrl + '")';
        $("heroArt").classList.add("ready");
      };
      fallback.src = mediumUrl;
    };
    loader.src = largeUrl;
  });
});
