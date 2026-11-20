document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("tableBody");
  const searchInput = document.getElementById("searchInput");

  // ----- Added: image helpers (covers from Open Library, author photos from Wikipedia) -----
  const coverCache = {};
  const authorCache = {};

  // Floating element for the author photo (outside the table so it is never clipped)
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

  // If there are several authors, use the first one
  function firstAuthor(authors) {
    return String(authors ?? "").split(/,| and | & |;/)[0].trim();
  }

  async function fetchCover(title, authors) {
    const key = title + "|" + authors;
    if (key in coverCache) return coverCache[key];

    // Remove text inside parentheses, e.g. (Le Petit Prince)
    const cleanTitle = String(title).replace(/\s*\(.*?\)\s*/g, " ").trim();
    const author = firstAuthor(authors);

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
        : null;
    } catch (err) {
      coverCache[key] = null;
    }
    return coverCache[key];
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

  // Covers are loaded only when their row becomes visible
  const coverObserver = new IntersectionObserver((entries) => {
    entries.forEach(async (entry) => {
      if (!entry.isIntersecting) return;
      const img = entry.target;
      coverObserver.unobserve(img);

      const src = await fetchCover(img.dataset.title, img.dataset.authors);
      if (src) {
        img.src = src;
      } else {
        img.classList.add("no-cover");
        img.alt = "No cover";
      }
    });
  });

  function positionTooltip(event) {
    tooltip.style.left = event.clientX + 16 + "px";
    tooltip.style.top = event.clientY + 16 + "px";
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
