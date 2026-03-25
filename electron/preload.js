const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pdfAddressEditor", {
  selectPdf: () => ipcRenderer.invoke("select-pdf"),
  readPdf: (filePath) => ipcRenderer.invoke("read-pdf", filePath),
  replaceAddress: (payload) => ipcRenderer.invoke("replace-address", payload),
  saveConfig: (payload) => ipcRenderer.invoke("save-config", payload)
});
