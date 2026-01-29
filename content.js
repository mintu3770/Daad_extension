(async function() {
  // --- CONFIGURATION ---
  const DELAY_MS = 1500; // Wait 1.5 seconds between each page to avoid bans
  
  // 1. FIND ALL LINKS
  // We look for links that contain "/detail/" (DAAD's pattern for course pages)
  const allLinks = Array.from(document.querySelectorAll('a[href*="/detail/"]'));
  
  // Filter duplicates (DAAD puts the link on both the Image and the Title)
  const uniqueUrls = new Set();
  const tasks = [];

  allLinks.forEach(link => {
    // Only process if we haven't seen this URL yet
    if (!uniqueUrls.has(link.href)) {
      uniqueUrls.add(link.href);
      
      // Find the "card" container to get the basic info (Title/Uni)
      const card = link.closest('.list-entry') || link.closest('div');
      const title = link.innerText.trim().replace(/,/g, " -");
      
      let uni = "N/A";
      if (card) {
        const uniEl = card.querySelector('.list-entry__institution') || card.querySelector('li');
        if (uniEl) uni = uniEl.innerText.trim().replace(/,/g, " -");
      }

      if (title.length > 2) { // Skip empty/garbage links
        tasks.push({ url: link.href, title: title, uni: uni });
      }
    }
  });

  if (tasks.length === 0) {
    alert("No courses found! Please scroll down to load the list first.");
    return;
  }

  // 2. NOTIFY USER (Because this takes time!)
  const confirmStart = confirm(`Found ${tasks.length} courses.\n\nThis will take about ${Math.ceil((tasks.length * 1.5)/60)} minutes to scrape deep details.\n\nPress OK to start (Check Console for progress).`);
  if (!confirmStart) return;

  console.log("🚀 Starting Deep Scrape...");
  let csvContent = "\uFEFFCourse Name,University,Deadline,Language,Tuition,Link\n";

  // 3. DEEP SCRAPE LOOP
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    console.log(`[${i + 1}/${tasks.length}] Visiting: ${task.title.substring(0, 20)}...`);

    try {
      // A. Fetch the HTML of the detail page
      const response = await fetch(task.url);
      const htmlText = await response.text();
      
      // B. Parse it into a virtual document
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, "text/html");

      // C. Helper to find text by header
      const findInfo = (keywords) => {
        // Try Definition Lists <dt>
        const dts = doc.querySelectorAll('dt');
        for (const dt of dts) {
          if (keywords.some(k => dt.textContent.toLowerCase().includes(k))) {
            return dt.nextElementSibling ? dt.nextElementSibling.textContent.trim().replace(/(\r\n|\n|\r)/gm, " ").replace(/,/g, ";") : "N/A";
          }
        }
        // Try Headers <h3>
        const h3s = doc.querySelectorAll('h3, h4');
        for (const h3 of h3s) {
          if (keywords.some(k => h3.textContent.toLowerCase().includes(k))) {
             // Grab the next paragraph or div
             let next = h3.nextElementSibling;
             return next ? next.textContent.trim().replace(/(\r\n|\n|\r)/gm, " ").replace(/,/g, ";") : "N/A";
          }
        }
        return "Check Link";
      };

      // D. Extract the specific data points
      const deadline = findInfo(['deadline', 'application']);
      const lang = findInfo(['language', 'instruction']);
      const tuition = findInfo(['tuition', 'cost', 'fees']);

      // E. Add to CSV
      csvContent += `"${task.title}","${task.uni}","${deadline}","${lang}","${tuition}","${task.url}"\n`;

    } catch (err) {
      console.error("Failed to fetch", task.url, err);
      csvContent += `"${task.title}","${task.uni}","Error","Error","Error","${task.url}"\n`;
    }

    // F. SLEEP (Crucial to avoid crash/ban)
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  // 4. DOWNLOAD
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.setAttribute("href", url);
  downloadLink.setAttribute("download", "DAAD_Deep_Results.csv");
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  
  alert("Done! Your deep-scrape file has been downloaded.");

})();
