(function() {
  // Try multiple selector types used by different DAAD pages
  const cards = document.querySelectorAll('.list-entry, .c-srp-list__item, .result-item');

  if (cards.length === 0) {
    alert("Extension Error: No results found.\n\n1. Are you on the DAAD search results page?\n2. Did you scroll down to load the courses?");
    return;
  }

  let csvContent = "\uFEFFCourse Name,University,Link\n"; 

  cards.forEach(card => {
    // Attempt to find title in h3, h4, or specific classes
    const titleEl = card.querySelector('h3, h4, .c-ad-srp-entry__title a');
    const uniEl = card.querySelector('.list-entry__institution, .c-ad-srp-entry__organization');
    
    // Fallback: If no specific title link found, grab the first link in the card
    const linkEl = titleEl ? titleEl.closest('a') : card.querySelector('a');

    let title = titleEl ? titleEl.innerText.replace(/,/g, " -").trim() : "Unknown Title";
    let uni = uniEl ? uniEl.innerText.replace(/,/g, " -").trim() : "Unknown Uni";
    let link = linkEl ? linkEl.href : "No Link";

    csvContent += `"${title}","${uni}","${link}"\n`;
  });

  // Create Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.setAttribute("href", url);
  downloadLink.setAttribute("download", "DAAD_Shortlist.csv");
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
})();
