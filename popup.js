document.getElementById("magicBtn").addEventListener("click", () => {
  const status = document.getElementById("status");
  status.innerText = "Running... Please wait.";
  status.style.color = "blue";
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      files: ["content.js"]
    }, () => {
      // Send the single "run_all" command
      chrome.tabs.sendMessage(tabs[0].id, { action: "run_all" });
    });
  });
});
