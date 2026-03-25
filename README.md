# 📄 PDF Address Editor (Desktop App)

![React](https://img.shields.io/badge/Frontend-React-blue?style=for-the-badge\&logo=react)
![Electron](https://img.shields.io/badge/Desktop-Electron-2C2E3A?style=for-the-badge\&logo=electron)
![Python](https://img.shields.io/badge/Backend-Python-yellow?style=for-the-badge\&logo=python)
![Status](https://img.shields.io/badge/Status-Active-success?style=for-the-badge)

---

## 📸 Preview

![App Screenshot](./screenshot.png)

---

## 🚀 Overview

A desktop tool for visually editing address fields in PDF invoices using a simple and interactive interface.

> 🧠 *Inspired by 1952. Built on 1971.*

---

## 🧠 Problem

Updating addresses in PDF invoices is typically:

* ❌ Manual
* ❌ Time-consuming
* ❌ Error-prone

This tool enables **fast, repeatable, and visual editing** of address fields without modifying the original document structure.

---

## ⚙️ Features

* 📄 Upload and preview PDF invoices
* 🖱️ Draw a rectangle to select the address region
* ✏️ Replace with a new address dynamically
* 🔄 Auto-fit text for varying address lengths
* 💾 Export corrected PDF
* 🖥️ Packaged as a Windows desktop application

---

## 🛠️ Tech Stack

| Layer       | Technology                     |
| ----------- | ------------------------------ |
| Frontend    | React + Vite                   |
| Desktop App | Electron                       |
| Backend     | Python (PyMuPDF)               |
| Packaging   | PyInstaller + Electron Builder |

---

## 🧩 Architecture

```text
React UI → Electron → Python Backend → PDF Output
```

---

## 🚀 Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Run the app

```bash
npm run electron
```

---

## 📦 Build Desktop App

```bash
npm run dist
```

Output:

```
release/
```

---

## 📦 Download

Download the latest Windows build from the **Releases** section.

---

## 🎯 Use Cases

* Invoice correction workflows
* Internal business tools
* Data engineering automation pipelines
* Bulk PDF processing

---

## 🔥 Future Improvements

* Auto-detect address regions
* Supplier templates (e.g. CEF invoices)
* Batch processing for multiple PDFs
* Cloud integration (AWS / Azure)

---

## 👨‍💻 Author

**Munir Uddin**
Data Engineer | AI & Automation

---

## ⭐ Support

If you find this project useful, consider giving it a ⭐ on GitHub!
