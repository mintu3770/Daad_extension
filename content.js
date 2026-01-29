(async function() {
  // --- CONFIGURATION ---
  // Slower delay to prevent the "Stopped at 16" crash
  const MIN_DELAY = 2000; // 2 seconds minimum
  const MAX_DELAY = 4000; // 4 seconds maximum

  // --- 1. SETUP UI OVERLAY (So you know it's working) ---
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.bottom = '20px';
  overlay.style.right = '20px';
  overlay.style.padding = '15px';
  overlay.style.backgroundColor = '#222';
  overlay.style.color = '#fff';
  overlay.style.zIndex = '9999';
  overlay.style.borderRadius = '8px';
  overlay.style.fontFamily = 'monospace';
  overlay.style.fontSize = '12px';
  overlay.innerHTML = '<b>DAAD Scraper Initialized...</b><br>Please wait.';
  document.body.appendChild(overlay);

  function updateStatus(text) {
    overlay.innerHTML = text;
  }

  // --- 2. GATHER LINKS ---
  updateStatus("Scanning for courses...");
  const allLinks = Array.from(document.querySelectorAll('a[href*="/detail/"]'));
  const uniqueUrls = new Set();
  const tasks = [];

  allLinks.forEach(link => {
    if (!uniqueUrls.has(link.href)) {
      uniqueUrls.add(link.href);
      const title = link.innerText.trim().replace(/,/g, " -");
      if (title.length > 2) tasks.push({ url: link.href, title: title });
    }
  });

  if (tasks.length === 0) {
    alert("No courses found! Scroll down to load the list first.");
    overlay.remove();
    return;
  }

  // --- 3. THE "FORENSIC" SCRAPER FUNCTION ---
  async function scrapeDetails(url) {
    try {
      const response = await fetch(url);
      const text = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "text/html");

      // Helper to clean text
      const clean = (txt) => txt ? txt.replace(/(\r\n|\n|\r)/gm, " ").replace(/\s+/g, ' ').replace(/,/g, ";").trim() : "N/A";

      // Helper to find text near a header (Robust)
      const getSection = (keywords) => {
        // Look in Description Lists <dt>
        const dts = Array.from(doc.querySelectorAll('dt'));
        const foundDt = dts.find(dt => keywords.some(k => dt.textContent.toLowerCase().includes(k)));
        if (foundDt && foundDt.nextElementSibling) return clean(foundDt.nextElementSibling.textContent);

        // Look in Headers <h3>/<h4>
        const headers = Array.from(doc.querySelectorAll('h3, h4, h5'));
        const foundH = headers.find(h => keywords.some(k => h.textContent.toLowerCase().includes(k)));
        if (foundH) {
            // Try to find the next paragraph or list
            let sibling = foundH.nextElementSibling;
            while(sibling && sibling.tagName === 'DIV') sibling = sibling.firstElementChild; // Drill down
            return sibling ? clean(sibling.textContent) : "N/A";
        }
        return "N/A";
      };

      // Helper to scan ENTIRE page text for boolean flags (VPD, GRE, etc.)
      const bodyText = doc.body.innerText;
      const scanFor = (regex) => regex.test(bodyText) ? "Yes/Mentioned" : "No";

      // --- EXTRACTION LOGIC ---
      
      // 1. Basic Info
      const uni = clean(doc.querySelector('.c-detail-header__institution')?.textContent) || "N/A";
      const city = clean(doc.querySelector('.c-detail-header__city')?.textContent).replace('Germany', '').trim() || "N/A";
      const website = doc.querySelector('a.c-button-course-website')?.href || "N/A";
      
      // 2. Deadlines & Fees
      const winterDL = getSection(['deadline winter', 'winter semester']);
      const summerDL = getSection(['deadline summer', 'summer semester']);
      if (winterDL === "N/A" && summerDL === "N/A") {
          // Fallback to generic deadline
          var genericDL = getSection(['deadline', 'application period']);
      }
      const tuition = getSection(['tuition', 'semester contribution', 'fees']);

      // 3. Admission Specs
      const lang = getSection(['teaching language', 'instruction language']);
      const langScore = getSection(['language requirements', 'english', 'toefl', 'ielts']);
      const ects = getSection(['ects', 'credits']);
      const gpa = getSection(['grade', 'gpa', 'average']);
      
      // 4. "Hidden" Boolean Checks (Regex Scan)
      const gre = scanFor(/GRE|GMAT/i);
      const vpd = scanFor(/VPD|Vorprüfungsdokumentation|uni-assist/i);
      const aps = scanFor(/APS|Akademische Prüfstelle/i);
      const nc = scanFor(/NC|Numerus Clausus|limited admission/i);
      const sop = scanFor(/motivation letter|statement of purpose|SOP/i);
      const lor = scanFor(/recommendation letter|reference letter|LOR/i);

      // 5. Application Portal
      const portal = doc.querySelector('a[href*="uni-assist"]') ? "Uni-Assist" : "University Portal";

      return {
        uni, type: "See Website", // DAAD rarely lists "Type" (FH vs Uni) explicitly in metadata
        program: tasks.find(t => t.url === url).title,
        city, state: "Germany", // DAAD does not list State
        website, lang, langScore,
        nc, gpa, ects, gre,
        portal, winterDL: winterDL === "N/A" ? genericDL : winterDL, summerDL,
        vpd, aps, sop, lor,
        fees: tuition,
        raw_tuition: getSection(['tuition fees per semester'])
      };

    } catch (err) {
      console.error(err);
      return { uni: "ERROR", program: "ERROR" }; // Return error row so loop continues
    }
  }

  // --- 4. EXECUTION LOOP ---
  let csvContent = "\uFEFFUniversity,Type,Program,City,State,Website,Language,Lang Score,Admission Type,Min GPA,ECTS,GRE/GMAT,Portal,Winter Deadline,Summer Deadline,VPD,APS,SOP,LORs,Tuition,Fees Link\n";

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    
    // UPDATE OVERLAY
    updateStatus(`<b>Processing ${i + 1}/${tasks.length}</b><br>${task.title.substring(0, 30)}...<br><span style="color:yellow">Do not close this tab.</span>`);
    
    // SCRAPE
    const data = await scrapeDetails(task.url);

    // ADD TO CSV
    const row = [
        data.uni, data.type, data.program, data.city, data.state, data.website,
        data.lang, data.langScore, data.nc, data.gpa, data.ects, data.gre,
        data.portal, data.winterDL, data.summerDL, data.vpd, data.aps, data.sop, 
        data.lor, data.raw_tuition, task.url
    ].map(item => `"${(item || 'N/A').toString().replace(/"/g, '""')}"`).join(",");
    
    csvContent += row + "\n";

    // RANDOM WAIT (Crucial for avoiding the "16 Limit")
    const waitTime = Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1) + MIN_DELAY);
    await new Promise(r => setTimeout(r, waitTime));
  }

  // --- 5. DOWNLOAD ---
  updateStatus("<b>Done! Downloading...</b>");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.setAttribute("href", url);
  downloadLink.setAttribute("download", "DAAD_Deep_Analysis.csv");
  document.body.appendChild(downloadLink);
  downloadLink.click();
  
  setTimeout(() => overlay.remove(), 5000);

})();
