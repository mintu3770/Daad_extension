chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scrape") {
    const data = scrapeData();
    if (data.length > 0) {
      downloadCSV(data);
      sendResponse({ count: data.length });
    } else {
      // If we fail, try to log why for the user to see in Console
      console.warn("DAAD Scraper: No items found. Current selectors tried: .list-entry, .js-result-card, .result-item");
      sendResponse({ count: 0 });
    }
  }
});

function scrapeData() {
  const results = [];
  
  // ---------------------------------------------------------
  // STRATEGY 1: "International Programmes" Layout (Most common)
  // ---------------------------------------------------------
  let cards = document.querySelectorAll('.list-entry');

  // ---------------------------------------------------------
  // STRATEGY 2: "Scholarship Database" Layout
  // ---------------------------------------------------------
  if (cards.length === 0) {
    cards = document.querySelectorAll('.result-item, .js-result-card, [id^="result-"]');
  }

  // ---------------------------------------------------------
  // STRATEGY 3: Generic fallback (Look for any large list items)
  // ---------------------------------------------------------
  if (cards.length === 0) {
    // Sometimes DAAD uses simple 'media' bootstrap classes
    cards = document.querySelectorAll('.srp-result-list .row, .media');
  }

  console.log(`DAAD Scraper: Found ${cards.length} cards.`);

  cards.forEach((card) => {
    // 1. Get Title
    const titleEl = card.querySelector('h3, h4, .list-entry__title, .c-srp-result-card__title a');
    const title = titleEl ? titleEl.innerText.trim() : "N/A";

    // 2. Get University / Subtitle
    const uniEl = card.querySelector('.list-entry__subtitle, .c-srp-result-card__subtitle, .university-name');
    const university = uniEl ? uniEl.innerText.trim() : "N/A";

    // 3. Get Link
    const linkEl = card.querySelector('a');
    let link = "N/A";
    if (linkEl) {
      link = linkEl.href.startsWith("http") ? linkEl.href : "https://www2.daad.de" + linkEl.getAttribute("href");
    }

    // 4. Get "hard to reach" details (Location, Language, etc.)
    // We grab all text in the card, replace newlines with pipes " | "
    const fullText = card.innerText.replace(/(\r\n|\n|\r)/gm, " | ");

    // Only add if it looks like a valid result
    if (title !== "N/A" && title !== "") {
      results.push({
        "Course/Scholarship Name": title,
        "University / Institution": university,
        "Link": link,
        "Full Details": fullText
      });
    }
  });

  return results;
}

function downloadCSV(data) {
  if (!data || !data.length) return;

  const headers = Object.keys(data[0]);
  const csvRows = [];
  
  // Header
  csvRows.push(headers.join(","));

  // Rows
  for (const row of data) {
    const values = headers.map(header => {
      const escaped = ('' + row[header]).replace(/"/g, '\\"');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(","));
  }

  const csvString = csvRows.join("\n");
  const blob = new Blob([csvString], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = "daad_results.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
