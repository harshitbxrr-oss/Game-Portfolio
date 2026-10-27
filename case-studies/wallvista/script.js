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
const imageFolder = "./Wall Vista Screens/";
const wireframeFolder = "./Wireframes/";
let galleryMode = "screens";
let selectedScreen = 0;

function imagePath(index, mode = galleryMode) {
  const [, , screenImage, wireframeImage] = screens[index];
  const folder = mode === "wireframes" ? wireframeFolder : imageFolder;
  const file = mode === "wireframes" ? wireframeImage : screenImage;
  // encodeURI handles spaces in folder names; encodeURIComponent handles filename spaces
  return encodeURI(folder + encodeURIComponent(file).replaceAll("%2F", "/"));
}

function renderGallery() {
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
    image.onerror = () => {
      image.style.display = "none";
      thumb.style.background = "#e9e6dd";
      thumb.style.color = "#817e76";
      thumb.textContent = "Image not found";
      thumb.style.display = "flex";
      thumb.style.alignItems = "center";
      thumb.style.justifyContent = "center";
      thumb.style.fontSize = "10px";
    };
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
  const [number, title] = screens[selectedScreen];
  const modeLabel = galleryMode === "wireframes" ? "Wireframe" : "Designed screen";
  dialogImage.src = imagePath(selectedScreen);
  dialogImage.onerror = () => {
    dialogImage.style.display = "none";
    dialogImage.parentElement.style.background = "#e9e6dd";
    dialogImage.parentElement.style.display = "flex";
    dialogImage.parentElement.style.alignItems = "center";
    dialogImage.parentElement.style.justifyContent = "center";
    const fallback = document.createElement("div");
    fallback.textContent = "Image not found";
    fallback.style.color = "#817e76";
    fallback.style.fontSize = "14px";
    dialogImage.parentElement.appendChild(fallback);
  };
  dialogImage.alt = `${modeLabel}: ${title}`;
  dialogTitle.textContent = `${number} / ${String(screens.length).padStart(2, "0")}  ·  ${title} — ${modeLabel}`;
  dialogCounter.textContent = `${number} / ${String(screens.length).padStart(2, "0")}`;
  dialog.querySelector(".dialog-prev").disabled = selectedScreen === 0;
  dialog.querySelector(".dialog-next").disabled = selectedScreen === screens.length - 1;
}

function openScreen(index) {
  selectedScreen = index;
  updateDialog();
  dialog.showModal();
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    galleryMode = tab.dataset.galleryMode;
    tabs.forEach((item) => {
      const active = item === tab;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    renderGallery();
  });
});

dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
dialog.querySelector(".dialog-prev").addEventListener("click", () => {
  if (selectedScreen > 0) {
    selectedScreen -= 1;
    updateDialog();
  }
});
dialog.querySelector(".dialog-next").addEventListener("click", () => {
  if (selectedScreen < screens.length - 1) {
    selectedScreen += 1;
    updateDialog();
  }
});
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
dialog.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    dialog.close();
    return;
  }
  if (event.key === "ArrowLeft" && selectedScreen > 0) {
    selectedScreen -= 1;
    updateDialog();
  }
  if (event.key === "ArrowRight" && selectedScreen < screens.length - 1) {
    selectedScreen += 1;
    updateDialog();
  }
});

const menuToggle = document.querySelector(".menu-toggle");
const siteNav = document.querySelector("#site-nav");
const themeToggle = document.querySelector(".theme-toggle");
const themeIcon = themeToggle.querySelector(".theme-icon");
const themeLabel = themeToggle.querySelector(".theme-label");
const themeColor = document.querySelector('meta[name="theme-color"]');
const prototypeFrame = document.querySelector(".prototype-embed iframe");

function syncPrototypeTheme() {
  try {
    if (!prototypeFrame) return;
    const frameDocument = prototypeFrame.contentDocument;
    if (frameDocument && frameDocument.documentElement) {
      frameDocument.documentElement.dataset.theme =
        document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      const protoEl = document.querySelector(".prototype");
      if (protoEl) {
        frameDocument.body.style.backgroundColor =
          getComputedStyle(protoEl).backgroundColor;
      }
      resizePrototypeFrame(frameDocument);
    }
  } catch (e) {
    // Cross-origin or sandbox safeguard
  }
}

function resizePrototypeFrame(frameDocument) {
  try {
    if (!frameDocument || !prototypeFrame) return;
    const contentHeight = Math.max(
      frameDocument.documentElement.scrollHeight,
      frameDocument.body.scrollHeight,
      750
    );
    prototypeFrame.style.height = `${contentHeight}px`;
  } catch (e) {}
}

prototypeFrame.addEventListener("load", syncPrototypeTheme);
window.addEventListener("resize", syncPrototypeTheme);

const sunIcon = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
const moonIcon = '<path d="M20 14.2A8.5 8.5 0 1 1 9.8 4a7 7 0 0 0 10.2 10.2z"/>';

function applyTheme(enableDarkMode) {
  document.documentElement.dataset.theme = enableDarkMode ? "dark" : "light";

  if (themeToggle) {
    themeToggle.setAttribute("aria-pressed", String(enableDarkMode));
    themeToggle.setAttribute("aria-label", enableDarkMode ? "Switch to light mode" : "Switch to dark mode");
  }

  if (themeIcon) themeIcon.innerHTML = enableDarkMode ? sunIcon : moonIcon;
  if (themeLabel) themeLabel.textContent = enableDarkMode ? "Light mode" : "Dark mode";
  if (themeColor) themeColor.content = enableDarkMode ? "#171715" : "#f7f5f0";
  syncPrototypeTheme();
}

const urlParams = new URLSearchParams(window.location.search);
const savedTheme = localStorage.getItem("wv_theme");
const isDarkInit = urlParams.get("theme") === "dark" || urlParams.get("from") === "game" || savedTheme === "dark" || (!savedTheme && urlParams.get("theme") !== "light");
applyTheme(isDarkInit);

document.querySelectorAll('.portfolio-return, a[href*="index.html"], a[href*="return=road"]').forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const path = window.location.pathname;
    const base = path.includes('/case-studies/') 
      ? path.slice(0, path.indexOf('/case-studies/')) 
      : '';
    window.location.href = (base || '') + '/index.html?return=road';
  });
});

themeToggle.addEventListener("click", () => {
  const enableDarkMode = document.documentElement.dataset.theme !== "dark";
  applyTheme(enableDarkMode);
  localStorage.setItem("wv_theme", enableDarkMode ? "dark" : "light");
});

menuToggle.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Open navigation" : "Close navigation");
  siteNav.classList.toggle("is-open", !isOpen);
});
siteNav.addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation");
    siteNav.classList.remove("is-open");
  }
});

const revealObserver = "IntersectionObserver" in window
  ? new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 })
  : null;

document.querySelectorAll(".section-index, .intro-grid, .problem-grid, .context-heading, .persona-card, .journey-heading, .journey-step, .screens-heading, .decision-row, .validation-grid, .prototype-heading").forEach((element) => {
  element.classList.add("reveal");
  if (revealObserver) revealObserver.observe(element);
  else element.classList.add("is-visible");
});

renderGallery();
