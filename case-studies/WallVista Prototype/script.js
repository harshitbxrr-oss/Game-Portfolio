const screens = [
  ["01", "Home", "01Home.png", "01 Home — Wireframe.png"],
  ["02", "Upload wall", "02 Upload.png", "02 Upload — Wireframe.png"],
  ["03", "AI analysis", "03 Analysis.png", "03 Analysis — Wireframe.png"],
  ["04", "AI suggestions", "04 Suggestions.png", "04 Suggestions — Wireframe.png"],
  ["05", "Design preview", "05 Priview.png", "05 Preview — Wireframe.png"],
  ["06", "Find a pro", "06 Find pro.png", "06 Find pro — Wireframe.png"],
  ["07", "Compare quotes", "07 Compare.png", "07 Compare — Wireframe.png"],
  ["08", "Choose a date", "08 Choose date.png", "08 Choose date — Wireframe.png"],
  ["09", "Review & book", "09 Review and Book.png", "09 Review and Book — Wireframe.png"],
  ["10", "Booking confirmed", "10 Booking Confirmed.png", "10 Booking Confirmed — Wireframe.png"],
  ["11", "Your project", "11 Your Project.png", "11 Your Project — Wireframe.png"],
  ["12", "Profile", "12 Profile.png", "12 Profile — Wireframe.png"],
  ["13", "Settings", "13 Settings.png", "13 Settings — Wireframe.png"]
];

const grid = document.querySelector("#screen-grid");
const dialog = document.querySelector("#screen-dialog");
const dialogImage = dialog.querySelector(".dialog-image-wrap img");
const dialogTitle = dialog.querySelector(".dialog-title");
const dialogCounter = dialog.querySelector(".dialog-bottom span");
const tabs = [...document.querySelectorAll(".gallery-tab")];
const imageFolder = "./Wall%20Vista%20Screens/";
const wireframeFolder = "./Wireframes/";
let galleryMode = "screens";
let selectedScreen = 0;

function imagePath(index, mode = galleryMode) {
  const [, , screenImage, wireframeImage] = screens[index];
  if (mode === "wireframes") {
    return wireframeFolder + encodeURIComponent(wireframeImage).replaceAll("%2F", "/");
  }
  return imageFolder + encodeURIComponent(screenImage).replaceAll("%2F", "/");
}

function renderGallery() {
  if (!grid) return;
  grid.replaceChildren();
  screens.forEach(([number, title], index) => {
    const button = document.createElement("button");
    button.className = "screen-card";
    button.type = "button";
    button.setAttribute("aria-label", `View ${title} ${galleryMode === "wireframes" ? "wireframe" : "screen"}`);

    const thumb = document.createElement("span");
    thumb.className = "screen-thumb";
    const image = document.createElement("img");
    image.src = imagePath(index);
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    const view = document.createElement("span");
    view.className = "screen-view";
    view.setAttribute("aria-hidden", "true");
    view.textContent = "↗";
    thumb.append(image, view);

    const caption = document.createElement("span");
    caption.className = "screen-caption";
    const count = document.createElement("span");
    count.textContent = number;
    const label = document.createElement("strong");
    label.textContent = title;
    caption.append(count, label);
    button.append(thumb, caption);

    button.addEventListener("click", () => openScreen(index));
    grid.append(button);
  });
}

function updateDialog() {
  if (!dialog) return;
  const [number, title] = screens[selectedScreen];
  dialogImage.src = imagePath(selectedScreen);
  dialogImage.alt = `WallVista ${title} ${galleryMode === "wireframes" ? "wireframe" : "screen"}`;
  dialogTitle.textContent = `${number} ${title} · ${galleryMode === "wireframes" ? "Wireframe" : "Screen"}`;
  dialogCounter.textContent = `${selectedScreen + 1} / ${screens.length}`;
}

function openScreen(index) {
  selectedScreen = index;
  updateDialog();
  if (dialog && !dialog.open) {
    dialog.showModal();
    document.body.style.overflow = "hidden";
  }
}

function closeScreen() {
  if (dialog && dialog.open) {
    dialog.close();
    document.body.style.overflow = "";
  }
}

function stepScreen(delta) {
  selectedScreen = (selectedScreen + delta + screens.length) % screens.length;
  updateDialog();
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => {
      t.classList.remove("active");
      t.setAttribute("aria-pressed", "false");
    });
    tab.classList.add("active");
    tab.setAttribute("aria-pressed", "true");
    galleryMode = tab.dataset.mode;
    renderGallery();
    if (dialog && dialog.open) updateDialog();
  });
});

if (dialog) {
  dialog.querySelector(".dialog-close")?.addEventListener("click", closeScreen);
  dialog.querySelector(".dialog-prev")?.addEventListener("click", () => stepScreen(-1));
  dialog.querySelector(".dialog-next")?.addEventListener("click", () => stepScreen(1));
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeScreen();
  });
}

window.addEventListener("keydown", (event) => {
  if (!dialog || !dialog.open) return;
  if (event.key === "ArrowLeft") stepScreen(-1);
  if (event.key === "ArrowRight") stepScreen(1);
});

renderGallery();

// Theme and Navigation Handling
const themeToggle = document.querySelector(".theme-toggle");
const themeIcon = themeToggle?.querySelector(".theme-icon");
const themeLabel = themeToggle?.querySelector(".theme-label");
const themeColor = document.querySelector('meta[name="theme-color"]');
const prototypeFrame = document.querySelector(".prototype-embed iframe");
const menuToggle = document.querySelector(".menu-toggle");
const siteNav = document.querySelector(".site-nav");
const themeStorageKey = "portfolio-theme";
const systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

function readThemePreference() {
  try {
    const savedTheme = window.localStorage.getItem(themeStorageKey) || window.localStorage.getItem("wv_theme");
    return savedTheme === "dark" || savedTheme === "light" ? savedTheme : null;
  } catch (error) {
    return null;
  }
}

function resizePrototypeFrame(frameDocument) {
  try {
    if (!frameDocument || !prototypeFrame) return;
    const bodyHeight = frameDocument.body ? frameDocument.body.scrollHeight : 0;
    const docHeight = frameDocument.documentElement ? frameDocument.documentElement.scrollHeight : 0;
    const contentHeight = Math.max(bodyHeight, docHeight);
    if (contentHeight > 300) {
      prototypeFrame.style.height = `${contentHeight + 10}px`;
    }
  } catch (e) {}
}

function syncPrototypeTheme() {
  try {
    if (!prototypeFrame) return;
    const frameDocument = prototypeFrame.contentDocument;
    if (frameDocument && frameDocument.documentElement) {
      const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      frameDocument.documentElement.dataset.theme = currentTheme;
      resizePrototypeFrame(frameDocument);
    }
  } catch (e) {
    // Cross-origin fallback
  }
}

if (prototypeFrame) {
  prototypeFrame.addEventListener("load", () => {
    syncPrototypeTheme();
    // Re-check size after styles settle
    setTimeout(syncPrototypeTheme, 300);
  });
}
window.addEventListener("resize", syncPrototypeTheme);

const sunIcon = '<circle cx="12" cy="12" r="4.3"/><line x1="12" y1="2.5" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="21.5"/><line x1="4.2" y1="4.2" x2="6" y2="6"/><line x1="18" y1="18" x2="19.8" y2="19.8"/><line x1="2.5" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="21.5" y2="12"/><line x1="4.2" y1="19.8" x2="6" y2="18"/><line x1="18" y1="6" x2="19.8" y2="4.2"/>';
const moonIcon = '<path d="M20 14.2A8.5 8.5 0 1 1 9.8 4a7 7 0 0 0 10.2 10.2z"/>';

function applyTheme(theme, persist = false) {
  const enableDarkMode = theme === "dark";
  document.documentElement.dataset.theme = enableDarkMode ? "dark" : "light";
  if (themeToggle) {
    themeToggle.setAttribute("aria-pressed", String(enableDarkMode));
    themeToggle.setAttribute("aria-label", `Switch to ${enableDarkMode ? "light" : "dark"} mode`);
  }
  if (themeIcon) {
    themeIcon.innerHTML = enableDarkMode ? sunIcon : moonIcon;
  }
  if (themeLabel) {
    themeLabel.textContent = enableDarkMode ? "Light mode" : "Dark mode";
  }
  if (themeColor) {
    themeColor.content = enableDarkMode ? "#171715" : "#f7f5f0";
  }
  if (persist) {
    try {
      window.localStorage.setItem(themeStorageKey, theme);
      window.localStorage.setItem("wv_theme", theme);
    } catch (e) {}
  }
  syncPrototypeTheme();
}

// Initial theme resolution
const urlParams = new URLSearchParams(window.location.search);
const fromGame = urlParams.get("from") === "game";
const explicitTheme = urlParams.get("theme");

let initialTheme = explicitTheme || readThemePreference();
if (!initialTheme) {
  initialTheme = fromGame || systemDark ? "dark" : "light";
}
applyTheme(initialTheme);

// Handle return navigation and labels
const returnLinks = document.querySelectorAll('.portfolio-return, a[href*="index.html"]');
if (fromGame) {
  returnLinks.forEach((link) => {
    link.textContent = link.textContent.replace('Back to portfolio', 'Back to road');
  });
}

returnLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const path = window.location.pathname;
    const base = path.includes('/case-studies/') 
      ? path.slice(0, path.indexOf('/case-studies/')) 
      : '';
    window.location.href = (base || '') + (fromGame ? '/index.html?return=road' : '/index.html#home');
  });
});

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme, true);
  });
}

if (menuToggle && siteNav) {
  menuToggle.addEventListener("click", () => {
    const open = siteNav.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(open));
  });
}
