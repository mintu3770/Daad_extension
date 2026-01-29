(function() {
  // 1. SELECTORS (You must verify these using 'Inspect Element' on daad.de)
  // Look for the container that wraps ONE scholarship result.
  const CARD_SELECTOR = ".list-entry"; 
  
  // Look for the title inside that card
  const TITLE_SELECTOR = "h3"; 
  
  // Look for the link inside that card
  const LINK_SELECTOR = "a"; 

  // 2. Data Extraction
  const cards = document.querySelectorAll(CARD_SELECTOR);
  
  if (cards.length === 0) {
    alert("No results found! Please check the CSS Selectors in content.js");
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Title,URL,Details\n"; // Header row

  cards.forEach(card => {
    // Extract Title
    const titleElement = card.querySelector(TITLE_SELECTOR);
    let title = titleElement ? titleElement.innerText.replace(/,/g, "") : "N/A";

    // Extract Link
    const linkElement = card.querySelector(LINK_SELECTOR);
    let link = linkElement ? linkElement.href : "N/A";

    // Extract Extra Info (Optional: Modify this to grab deadlines/funding)
    // Example: const deadline = card.querySelector(".deadline-class")?.innerText;

    // Add to CSV string
    csvContent += `${title},${link}\n`;
  });

  // 3. Trigger Download
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "daad_shortlist.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

})();
