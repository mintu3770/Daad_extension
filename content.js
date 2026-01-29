(function() {
  // --- CONFIGURATION ---
  // These are the classes DAAD typically uses.
  const SELECTORS = {
    // The box that holds one result
    card: ".list-entry, .c-srp-list__item, .js-result-list-entry", 
    // The course title
    title: "h3, .c-ad-srp-entry__title",
    // The university name
    uni: ".c-ad-srp-entry__organization, .list-entry__institution",
    // The subject/details
    details: ".list-entry__sub-header, .c-ad-srp-entry__content"
  };

  // --- LOGIC ---
  const cards = document.querySelectorAll(SELECTORS.card);
  
  if (cards.length === 0) {
    alert("No results found! Make sure you are on the DAAD 'Result List' page.");
    return;
  }

  // Build CSV Header
  let csvContent = "\uFEFF"; // Universal BOM for Excel to read characters correctly
  csvContent += "Course Name,University,Link,Details\n"; 

  cards.forEach(card => {
    // 1. Get Title and Link
    const titleEl = card.querySelector(SELECTORS.title);
    const linkEl = card.querySelector("a"); // Usually the title itself is the link or wraps it
    
    // Clean text: Remove commas to prevent breaking CSV, remove extra spaces
    const title = titleEl ? titleEl.innerText.replace(/,/g, " -").trim() : "N/A";
    const link = linkEl ? linkEl.href : "N/A";
    
    // 2. Get University
    const uniEl = card.querySelector(SELECTORS.uni);
    const uni = uniEl ? uniEl.innerText.replace(/,/g, " -").trim() : "N/A";

    // 3. Get Details (optional extra info)
    const detailEl = card.querySelector(SELECTORS.details);
    const detail = detailEl ? detailEl.innerText.replace(/(\r\n|\n|\r)/gm, " | ").replace(/,/g, ";") : "";

    // Add Row
    csvContent += `"${title}","${uni}","${link}","${detail}"\n`;
  });

  // --- DOWNLOAD TRIGGER ---
  const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
  const downloadLink = document.createElement("a");
  downloadLink.setAttribute("href", encodedUri);
  downloadLink.setAttribute("download", "DAAD_Results.csv");
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);

})();
