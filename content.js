(function() {
  // --- METHOD: THE LINK HUNTER ---
  // Instead of looking for "cards", we look for links containing "detail" 
  // which is how DAAD structures all their course pages.
  
  // 1. Find all links that point to a course detail page
  const resultLinks = document.querySelectorAll('a[href*="/detail/"]');
  
  // 2. Filter out duplicates (DAAD sometimes puts the link on the image AND the title)
  const uniqueRows = new Map();

  resultLinks.forEach(link => {
    // Navigate up to find the container (the "box" holding the info)
    // We look for the closest div that looks like a list entry
    const card = link.closest('div.list-entry') || link.closest('div'); 
    
    if (card) {
      // CLEANUP: Get text and remove weird spacing/commas
      const rawTitle = link.innerText.trim();
      if (rawTitle === "") return; // Skip empty links

      const title = rawTitle.replace(/,/g, " -").replace(/\n/g, " ");
      const url = link.href;
      
      // Try to find University Name nearby
      // We search inside the same 'card' for common university class names
      const uniElement = card.querySelector('.list-entry__institution') || card.querySelector('li');
      const uni = uniElement ? uniElement.innerText.replace(/,/g, " -").trim() : "Check Link";

      // Use URL as a unique key so we don't save the same course twice
      if (!uniqueRows.has(url)) {
        uniqueRows.set(url, `"${title}","${uni}","${url}"`);
      }
    }
  });

  // 3. CHECKPOINT: Did we find anything?
  if (uniqueRows.size === 0) {
    alert("Still found 0 results. \n\nIMPORTANT: \n1. Make sure you are on the 'International Programmes' search page.\n2. Scroll down so the courses are actually visible on screen.");
    return;
  }

  // 4. Build CSV
  let csvContent = "\uFEFFCourse Name,University,Link\n";
  uniqueRows.forEach(row => {
    csvContent += row + "\n";
  });

  // 5. Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.setAttribute("href", url);
  downloadLink.setAttribute("download", `DAAD_Results_${uniqueRows.size}_items.csv`);
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);

  // Success Message
  alert(`Success! Downloaded ${uniqueRows.size} courses.`);

})();
