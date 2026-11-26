document.addEventListener("DOMContentLoaded", () => {
  const menuButton = document.getElementById("menuButton");
  if (window.innerWidth < 900) document.body.classList.add("rail-hidden");
  if (menuButton) {
    menuButton.addEventListener("click", () => {
      document.body.classList.toggle("rail-hidden");
    });
  }

  if (typeof Chart === "undefined" || typeof books === "undefined") return;

  const searchInput = document.getElementById("searchInput");
  const topBooksCanvas = document.getElementById("topBooksChart");
  const decadeCanvas = document.getElementById("decadeChart");
  const languageCanvas = document.getElementById("languageChart");
  const topBooksNote = document.getElementById("topBooksNote");

  const TEXT_COLOR = "#5c5752";
  const GRID_COLOR = "rgba(0, 0, 0, 0.06)";
  const BLUE = "rgba(43, 138, 165, 0.85)";
  const ORANGE = "#f5a623";
  const PALETTE = [
    "#2b8aa5", "#f5a623", "#5fb0b7", "#3d7a5a", "#9b5c3e",
    "#6b5b95", "#c46d5e", "#4f6d7a", "#b8b0a8"
  ];

  function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  function shortTitle(title, max) {
    const clean = String(title ?? "").replace(/\s*\(.*?\)\s*/g, " ").trim();
    return clean.length > max ? clean.slice(0, max - 1).trimEnd() + "…" : clean;
  }

  let currentTop = [];

  function filterBooks(query) {
    if (!query) return books;
    return books.filter((book) =>
      String(book.book ?? "").toLowerCase().includes(query) ||
      String(book.authors ?? "").toLowerCase().includes(query) ||
      String(book.originalLanguage ?? "").toLowerCase().includes(query) ||
      String(book.firstPublished ?? "").toLowerCase().includes(query) ||
      String(book.approximateSalesInMillions ?? "").toLowerCase().includes(query) ||
      String(book.genre ?? "").toLowerCase().includes(query)
    );
  }

  let topBooksChart = null;
  if (topBooksCanvas) {
    topBooksChart = new Chart(topBooksCanvas, {
      type: "bar",
      data: {
        labels: [],
        datasets: [{
          label: "Approximate sales (millions)",
          data: [],
          backgroundColor: BLUE,
          borderRadius: 6,
          maxBarThickness: 26
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => (currentTop[items[0].dataIndex] || {}).book || "",
              afterTitle: (items) => (currentTop[items[0].dataIndex] || {}).authors || "",
              label: (item) => " " + item.parsed.x + " million copies"
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { color: TEXT_COLOR },
            grid: { color: GRID_COLOR },
            title: { display: true, text: "Sales (millions)", color: TEXT_COLOR }
          },
          y: {
            ticks: { color: "#3a3a3a", autoSkip: false },
            grid: { display: false }
          }
        }
      }
    });
  }

  function refreshTopBooks() {
    if (!topBooksChart) return;

    const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
    const matches = filterBooks(query);

    currentTop = matches
      .slice()
      .sort((a, b) => toNumber(b.approximateSalesInMillions) - toNumber(a.approximateSalesInMillions))
      .slice(0, 10);

    topBooksChart.data.labels = currentTop.map((b) => shortTitle(b.book, 30));
    topBooksChart.data.datasets[0].data = currentTop.map((b) => toNumber(b.approximateSalesInMillions));
    topBooksChart.update();

    if (topBooksNote) {
      if (matches.length === 0) {
        topBooksNote.textContent = "No matching books.";
      } else if (!query) {
        topBooksNote.textContent = "The 10 best sellers out of " + books.length + " books. Use the top search bar to filter by genre, author or language.";
      } else {
        topBooksNote.textContent = "Top " + currentTop.length + " among the " + matches.length + " books matching \"" + searchInput.value.trim() + "\".";
      }
    }
  }

  refreshTopBooks();
  if (searchInput) searchInput.addEventListener("input", refreshTopBooks);

  if (decadeCanvas) {
    const EARLY_LIMIT = 1900;
    const early = { sales: 0, count: 0 };
    const decades = {};

    books.forEach((book) => {
      const year = Number(book.firstPublished);
      if (!Number.isFinite(year)) return;
      const sales = toNumber(book.approximateSalesInMillions);

      if (year < EARLY_LIMIT) {
        early.sales += sales;
        early.count += 1;
      } else {
        const decade = Math.floor(year / 10) * 10;
        decades[decade] = decades[decade] || { sales: 0, count: 0 };
        decades[decade].sales += sales;
        decades[decade].count += 1;
      }
    });

    const decadeKeys = Object.keys(decades).map(Number);
    const labels = ["Before " + EARLY_LIMIT];
    const salesData = [round1(early.sales)];
    const countData = [early.count];

    if (decadeKeys.length > 0) {
      for (let d = Math.min(...decadeKeys); d <= Math.max(...decadeKeys); d += 10) {
        const item = decades[d] || { sales: 0, count: 0 };
        labels.push(d + "s");
        salesData.push(round1(item.sales));
        countData.push(item.count);
      }
    }

    const decadeLegendLabels = { color: "#3a3a3a" };
    if (Chart.defaults && Chart.defaults.plugins && Chart.defaults.plugins.legend) {
      const defaultGenerate = Chart.defaults.plugins.legend.labels.generateLabels;
      decadeLegendLabels.generateLabels = (chart) => {
        const items = defaultGenerate(chart);
        items.forEach((item) => {
          if (item.datasetIndex === 0) {
            item.fillStyle = BLUE;
            item.strokeStyle = BLUE;
          }
        });
        return items;
      };
    }

    const decadeNote = document.getElementById("decadeNote");
    if (decadeNote) {
      decadeNote.textContent = "The gray bar groups the " + early.count + " books published before " + EARLY_LIMIT +
        " (several centuries), so it is not comparable to a single decade.";
    }

    new Chart(decadeCanvas, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            type: "bar",
            label: "Total sales (millions)",
            data: salesData,
            backgroundColor: (context) => (context.dataIndex === 0 ? "rgba(125, 118, 112, 0.65)" : BLUE),
            borderRadius: 6,
            yAxisID: "y",
            order: 2
          },
          {
            type: "line",
            label: "Number of books",
            data: countData,
            borderColor: ORANGE,
            backgroundColor: ORANGE,
            pointRadius: 4,
            tension: 0,
            yAxisID: "y1",
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "bottom", labels: decadeLegendLabels }
        },
        scales: {
          x: { ticks: { color: TEXT_COLOR }, grid: { display: false } },
          y: {
            beginAtZero: true,
            position: "left",
            ticks: { color: TEXT_COLOR },
            grid: { color: GRID_COLOR },
            title: { display: true, text: "Sales (millions)", color: TEXT_COLOR }
          },
          y1: {
            beginAtZero: true,
            position: "right",
            ticks: { color: TEXT_COLOR, precision: 0 },
            grid: { drawOnChartArea: false },
            title: { display: true, text: "Books", color: TEXT_COLOR }
          }
        }
      }
    });
  }

  if (languageCanvas) {
    const languages = {};
    books.forEach((book) => {
      const name = String(book.originalLanguage ?? "").trim() || "Unknown";
      languages[name] = languages[name] || { sales: 0, count: 0 };
      languages[name].sales += toNumber(book.approximateSalesInMillions);
      languages[name].count += 1;
    });

    const sorted = Object.entries(languages).sort((a, b) => b[1].sales - a[1].sales);
    const MAX_SLICES = 8;
    const top = sorted.slice(0, MAX_SLICES);
    const rest = sorted.slice(MAX_SLICES);

    const labels = top.map(([name]) => name);
    const sales = top.map(([, v]) => round1(v.sales));
    const counts = top.map(([, v]) => v.count);

    if (rest.length > 0) {
      labels.push("Other (" + rest.length + " languages)");
      sales.push(round1(rest.reduce((sum, [, v]) => sum + v.sales, 0)));
      counts.push(rest.reduce((sum, [, v]) => sum + v.count, 0));
    }

    const totalSales = sales.reduce((a, b) => a + b, 0);

    new Chart(languageCanvas, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [{
          data: sales,
          backgroundColor: PALETTE.slice(0, labels.length),
          borderColor: "#ffffff",
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "55%",
        plugins: {
          legend: { position: "bottom", labels: { color: "#3a3a3a" } },
          tooltip: {
            callbacks: {
              label: (item) => {
                const percent = totalSales ? Math.round((item.parsed / totalSales) * 1000) / 10 : 0;
                return " " + item.label + ": " + item.parsed + "M (" + percent + "%), " + counts[item.dataIndex] + " books";
              }
            }
          }
        }
      }
    });
  }
});
