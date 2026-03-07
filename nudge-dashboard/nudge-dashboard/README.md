# Nudge Dashboard

A financial guardian app built with React + Vite + Tailwind CSS.

## Features
- 🟢 Home dashboard with animated ECG & liquidity tracking
- 💳 BNPL debt stack overview
- 🧮 Purchase simulation with risk analysis
- ⭐ Wishlist with savings tracker
- 👤 Profile / Guardian Hub
- 🔴 Critical state mode — dashboard turns red when user ignores high-risk warnings

---

## Getting Started

### 1. Clone the repo
```bash
git clone 
cd nudge-dashboard
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run the dev server
```bash
npm run dev
```

Then open **http://localhost:5173** in your browser.

---

## Build for production
```bash
npm run build
```
Output will be in the `dist/` folder.

---

## Project Structure
```
nudge-dashboard/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── .gitignore
└── src/
    ├── main.jsx        ← React entry point
    ├── index.css       ← Tailwind base styles
    └── Dashboard.jsx   ← Main app component
```

---

## Tech Stack
- [React 18](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
