const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

function createWindow() {
  const win = new BrowserWindow({
    width: 1500,
    height: 980,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

function getBackendCommand() {
  if (app.isPackaged) {
    return {
      command: path.join(process.resourcesPath, "backend", "replace_address.exe"),
      argsPrefix: []
    };
  }

  return {
    command: "python",
    argsPrefix: [path.join(__dirname, "..", "backend", "replace_address.py")]
  };
}

ipcMain.handle("select-pdf", async () => {
  const result = await dialog.showOpenDialog({
    title: "Open PDF",
    properties: ["openFile"],
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  });

  if (result.canceled || !result.filePaths?.length) {
    return { ok: false };
  }

  return { ok: true, path: result.filePaths[0] };
});

ipcMain.handle("read-pdf", async (_event, filePath) => {
  try {
    const data = fs.readFileSync(filePath);
    return { ok: true, base64: data.toString("base64") };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("replace-address", async (_event, payload) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "Save corrected PDF",
      defaultPath: path.basename(payload.inputPath).replace(/\.pdf$/i, "_corrected.pdf"),
      filters: [{ name: "PDF", extensions: ["pdf"] }]
    });

    if (canceled || !filePath) {
      return { ok: false, error: "Save cancelled." };
    }

    const backend = getBackendCommand();
    const args = [
      ...backend.argsPrefix,
      "--input", payload.inputPath,
      "--output", filePath,
      "--page", String(payload.page),
      "--x0", String(payload.pdfRectangle.x0),
      "--y0", String(payload.pdfRectangle.y0),
      "--x1", String(payload.pdfRectangle.x1),
      "--y1", String(payload.pdfRectangle.y1),
      "--new-address", payload.newAddress
    ];

    return await new Promise((resolve) => {
      const child = spawn(backend.command, args, { windowsHide: true });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (d) => {
        stdout += d.toString();
      });

      child.stderr.on("data", (d) => {
        stderr += d.toString();
      });

      child.on("error", (err) => {
        resolve({ ok: false, error: err.message });
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve({ ok: true, outputPath: filePath, log: stdout });
        } else {
          resolve({
            ok: false,
            error: stderr || stdout || `Process failed with code ${code}`
          });
        }
      });
    });
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("save-config", async (_event, payload) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "Save config bundle",
      defaultPath: "pdf-address-editor-config.json",
      filters: [{ name: "JSON", extensions: ["json"] }]
    });

    if (canceled || !filePath) {
      return { ok: false, error: "Save cancelled." };
    }

    fs.writeFileSync(filePath, JSON.stringify(payload.jsonPayload, null, 2), "utf8");

    const base = filePath.replace(/\.json$/i, "");
    fs.writeFileSync(`${base}.pyconfig.txt`, payload.pythonConfig, "utf8");
    fs.writeFileSync(`${base}.script.py`, payload.fullPythonScript, "utf8");

    return { ok: true, savedTo: filePath };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
