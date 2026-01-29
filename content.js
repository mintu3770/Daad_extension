(async function() {
  // --- CONFIGURATION ---
  // A safe delay to prevent the "Stopped at 16" error.
  // 1.5 seconds is usually the sweet spot for DAAD.
  const DELAY_MS = 1500; 

  // --- 1. SETUP STATUS BOX ---
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed', bottom: '20px', right: '20px', padding: '15px',
    backgroundColor: '#004d9e', color: '#fff', zIndex: '9999',
    borderRadius: '8px', fontFamily: 'sans-serif', fontSize: '14px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
  });
  overlay.innerHTML = '<b>DAAD Scraper Started...</b>';
  document.body.appendChild(overlay);

  function updateStatus(count, total, title) {
    overlay.innerHTML = `<b>Scraping: ${count} / ${total}</b><br><span style="font-size:12px">${title}</span>`;
  }

  // --- 2. COLLECT LINKS ---
  const allLinks = Array.from(document.querySelectorAll('a[href*="/detail/"]'));
  const uniqueUrls = new Set();
  const tasks = [];

  allLinks.forEach(link => {
    // Only process new URLs
    if (!uniqueUrls.has(link.href)) {
      uniqueUrls.add(link.href);
      const title = link.innerText.trim().replace(/,/g, " -");
      // Basic check to ensure it's a real title
      if (title.length > 5) {
        tasks.push({ url: link.href, title: title });
      }
    }
  });

  if (tasks.length === 0) {
    alert("No courses found! Please scroll down to load the list first.");
    overlay.remove();
    return;
  }

  // --- 3. SCRAPER LOGIC (Optimized for Standard Fields) ---
  async function scrapeCourse(url) {
    try {
      const response = await fetch(url);
      const text = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "text/html");

      // Helper to clean text
      const clean = (txt) => txt ? txt.replace(/(\r\n|\n|\r)/gm, " ").replace(/\s+/g, ' ').replace(/,/g, ";").trim() : "N/A";

      // Helper to find data in Definition Lists (DAAD's standard way)
      const getDefinition = (keywords) => {
        const dts = Array.from(doc.querySelectorAll('dt'));
        const target = dts.find(dt => keywords.some(k => dt.textContent.toLowerCase().includes(k)));
        return target && target.nextElementSibling ? clean(target.nextElementSibling.textContent) : "N/A";
      };

      // Helper to find data in Headers (for Requirements/Deadlines)
      const getSectionText = (keywords) => {
        const headers = Array.from(doc.querySelectorAll('h3, h4'));
        const target = headers.find(h => keywords.some(k => h.textContent.toLowerCase().includes(k)));
        if (target) {
            let content = target.nextElementSibling;
            // Grab the first 300 characters of the section (enough to see GPA/Degree reqs)
            return content ? clean(content.textContent).substring(0, 300) + "..." : "N/A";
        }
        return "N/A";
      };

      // --- EXTRACTION FIELDS ---
      return {
        uni: clean(doc.querySelector('.c-detail-header__institution')?.textContent) || "N/A",
        city: clean(doc.querySelector('.c-detail-header__city')?.textContent).replace(/Germany/i, '').trim() || "N/A",
        
        // The "Big 3" Factors
        tuition: getDefinition(['tuition', 'semester contribution', 'fees']),
        language: getDefinition(['teaching language', 'instruction language']),
        deadline: getDefinition(['deadline', 'application']),

        // The "Details" (Grab the text block, don't hunt for specific numbers)
        requirements: getSectionText(['academic admission', 'requirements']),
        english_score: getSectionText(['language', 'toefl', 'ielts']), // Usually in a separate section
        
        link: url
      };

    } catch (err) {
      console.error(err);
      return { uni: "Error", link: url };
    }
  }

  // --- 4. EXECUTION LOOP ---
  let csvContent = "\uFEFFCourse Name,University,City,Tuition/Fees,Teaching Language,Deadline,Admission Requirements (Summary),Language Requirements,Link\n";

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    updateStatus(i + 1, tasks.length, task.title); // Update UI
    
    const data = await scrapeCourse(task.url);

    // Build CSV Row
    const row = [
        task.title,
        data.uni,
        data.city,
        data.tuition,
        data.language,
        data.deadline,
        data.requirements,  // This will contain the text about GPA/Degree
        data.english_score, // This will contain text about IELTS/TOEFL
        data.link
    ].map(item => `"${(item || 'N/A').toString().replace(/"/g, '""')}"`).join(",");
    
    csvContent += row + "\n";

    // Wait to avoid blocking
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  // --- 5. DOWNLOAD ---
  updateStatus(tasks.length, tasks.length, "Downloading...");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.setAttribute("href", url);
  downloadLink.setAttribute("download", "DAAD_Shortlist.csv");
  document.body.appendChild(downloadLink);
  downloadLink.click();
  
  setTimeout(() => overlay.remove(), 4000);

})();
