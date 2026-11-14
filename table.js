document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("tableBody");
  const searchInput = document.getElementById("searchInput");

  function renderTable(books) {
    tableBody.innerHTML = "";

    if (books.length === 0) {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td colspan="6" class="empty-message">
          No matching books found.
        </td>
     ` ;

      tableBody.appendChild(row);
      return;
    }

    books.forEach((book) => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td><strong>${book.book ?? ""}</strong></td>
        <td>${book.authors ?? ""}</td>
        <td>${book.originalLanguage ?? ""}</td>
        <td>${book.firstPublished ?? ""}</td>
        <td>${book.approximateSalesInMillions ?? ""}</td>
        <td>${book.genre ?? ""}</td>
      `;

      tableBody.appendChild(row);
    });
  }

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
