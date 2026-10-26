// Wait for the DOM content to finish loading before running script logic
document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("tableBody");
  const searchInput = document.getElementById("searchInput");

  // Renders the provided list of books into the table body
  function renderTable(books) {
    // Clear previous rows
    tableBody.innerHTML = "";

    // Show a message if no books match the filter
    if (books.length === 0) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="6" class="empty-message">No matching books found.</td>`;
      tableBody.appendChild(row);
      return;
    }

    // Build a table row for each book
    books.forEach((book) => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td><strong>${book["Book"] ?? ""}</strong></td>
        <td>${book["Author(s)"] ?? ""}</td>
        <td>${book["Original language"] ?? ""}</td>
        <td>${book["First published"] ?? ""}</td>
        <td>${book["Approximate sales in millions"] ?? ""}</td>
        <td>${book["Genre"] ?? ""}</td>
      `;

      tableBody.appendChild(row);
    });
  }

  // Filters the global "data" array based on the user's search text
  function handleSearch(event) {
    const query = event.target.value.trim().toLowerCase();

    // If search is empty, show all items
    if (!query) {
      renderTable(data);
      return;
    }

    // Match query against any property of a book object
    const filtered = data.filter((book) => {
      return (
        String(book["Book"] ?? "").toLowerCase().includes(query) ||
        String(book["Author(s)"] ?? "").toLowerCase().includes(query) ||
        String(book["Original language"] ?? "").toLowerCase().includes(query) ||
        String(book["First published"] ?? "").toLowerCase().includes(query) ||
        String(book["Approximate sales in millions"] ?? "").toLowerCase().includes(query) ||
        String(book["Genre"] ?? "").toLowerCase().includes(query)
      );
    });

    renderTable(filtered);
  }

  // Initial render using the global "data" array
  renderTable(data);

  // Listen for typing events in the search input
  searchInput.addEventListener("input", handleSearch);
});
