document.getElementById("downloadBtn").addEventListener("click", () => {
  const msg = document.getElementById("msg");
  msg.innerText = "Scanning page...";
  msg.style.color = "blue";

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      files: ["content.js"]
    }).catch(err => {
      msg.innerText = "Error: " + err.message;
      msg.style.color = "red";
    });
  });
});
