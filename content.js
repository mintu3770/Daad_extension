// Listen for the message from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scrape") {
    const data = scrapeData();
    if (data.length > 0) {
      downloadCSV(data);
      sendResponse({ count: data.length });
    } else {
      sendResponse({ count: 0 });
    }
  }
});

function scrapeData() {
  const results = [];
  
  // SELECTOR STRATEGY:
  // DAAD usually lists items in container blocks. 
  // We look for the main result container.
  // Note: These class names (.list-inline, .c-srp-result-card) are best guesses 
  // based on standard DAAD structure. 
  
  // Try to find all result cards.
  // Common pattern in DAAD: IDs starting with "result-" or classes like "js-result-card"
  let cards = document.querySelectorAll('.js-result-card, [id^="result-"], .list-entry');

  if (cards.length === 0) {
      // Fallback: Try to find generic list items if specific classes fail
      cards = document.querySelectorAll('.result-display .media'); 
  }

  cards.forEach((card) => {
    // Extract Title
    const titleEl = card.querySelector('h3, h4, .c-srp-result-card__title, .list-entry__title');
    const title = titleEl ? titleEl.innerText.trim() : "N/A";

    // Extract Link
    const linkEl = card.querySelector('a');
    const link = linkEl ? linkEl.href : "N/A";

    // Extract Subtitle / University Name
    const uniEl = card.querySelector('.c-srp-result-card__subtitle, .list-entry__subtitle, span.university');
    const university = uniEl ? uniEl.innerText.trim() : "N/A";

    // Extract other meta details (Location, Deadline, etc.)
    // We grab all text and clean it up because specific class names vary wildly per page
    const allText = card.innerText.replace(/\n/g, " | ");

    results.push({
      "Program Title": title,
      "University": university,
      "Link": link,
      "Raw Details": allText // Useful backup if specific fields fail
    });
  });

  return results;
}

function downloadCSV(data) {
  // Convert JSON to CSV
  const headers = Object.keys(data[0]);
  const csvRows = [];
  
  // Add Header Row
  csvRows.push(headers.join(","));

  // Add Data Rows
  for (const row of data) {
    const values = headers.map(header => {
      const escaped = ('' + row[header]).replace(/"/g, '\\"');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(","));
  }

  const csvString = csvRows.join("\n");

  // Trigger Download
  const blob = new Blob([csvString], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.setAttribute("hidden", "");
  a.setAttribute("href", url);
  a.setAttribute("download", "daad_shortlist.csv");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
