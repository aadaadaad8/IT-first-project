// Wait for the DOM content to finish loading before rendering the chart
document.addEventListener("DOMContentLoaded", () => {
  const chartContainer = document.getElementById("chartContainer");
  const canvas = document.getElementById("salesChart");

  // Create a copy of the global data and sort from highest to lowest sales
  const sortedData = [...data].sort((a, b) => {
    const salesA = Number(a["Approximate sales in millions"]) || 0;
    const salesB = Number(b["Approximate sales in millions"]) || 0;
    return salesB - salesA;
  });

  // Calculate dynamic height to ensure bars stay readable (approx. 28px per item)
  const itemHeight = 28;
  const calculatedHeight = Math.max(400, sortedData.length * itemHeight);
  chartContainer.style.height = `${calculatedHeight}px`;

  // Prepare labels (book titles) and data points (sales in millions)
  const labels = sortedData.map((item) => item["Book"]);
  const salesValues = sortedData.map((item) => Number(item["Approximate sales in millions"]) || 0);

  // Create horizontal bar chart with Chart.js
  new Chart(canvas, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Approximate Sales (Millions)",
          data: salesValues,
          backgroundColor: "rgba(49, 130, 206, 0.75)",
          borderColor: "rgba(49, 130, 206, 1)",
          borderWidth: 1,
          borderRadius: 4
        }
      ]
    },
    options: {
      // indexAxis: 'y' turns the default vertical bar chart into a horizontal one
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top"
        },
        tooltip: {
          callbacks: {
            label: (context) => ` ${context.parsed.x} million copies sold`
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Sales in Millions"
          }
        },
        y: {
          ticks: {
            autoSkip: false // Keep all book titles visible along the Y-axis
          }
        }
      }
    }
  });
});
