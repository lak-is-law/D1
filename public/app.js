const state = {
  token: localStorage.getItem("hw_token") || "",
  user: JSON.parse(localStorage.getItem("hw_user") || "null")
};

const params = new URLSearchParams(window.location.search);
const queryApiBase = params.get("apiBase");
if (queryApiBase) {
  localStorage.setItem("hw_api_base", queryApiBase.replace(/\/+$/, ""));
}
const FALLBACK_API_BASE = window.location.hostname.endsWith("onrender.com")
  ? window.location.origin
  : "https://d1-backend-x7eg.onrender.com";
const API_BASE = (queryApiBase || localStorage.getItem("hw_api_base") || FALLBACK_API_BASE).replace(/\/+$/, "");
const IS_GITHUB_PAGES = window.location.hostname.endsWith("github.io");

const loginCard = document.getElementById("loginCard");
const dashboard = document.getElementById("dashboard");
const authMsg = document.getElementById("authMsg");
const welcomeTitle = document.getElementById("welcomeTitle");
const roleBlockTitle = document.getElementById("roleBlockTitle");
const dataPanel = document.getElementById("dataPanel");
const profileName = document.getElementById("profileName");
const profileRole = document.getElementById("profileRole");
const profileEmail = document.getElementById("profileEmail");
const profileAvatar = document.getElementById("profileAvatar");
const drivesCards = document.getElementById("drivesCards");
const chip3d = document.getElementById("chip3d");
const chipRole = document.getElementById("chipRole");
const chipData = document.getElementById("chipData");
const chipDisperse = document.getElementById("chipDisperse");
const campusControls = document.getElementById("campusControls");
const exitCampusBtn = document.getElementById("exitCampusBtn");
const openDataBtn = document.getElementById("openDataBtn");
const appShell = document.querySelector(".shell");
const featureLab = document.getElementById("featureLab");
const drivesTable = document.getElementById("drivesTable");
const auditTable = document.getElementById("auditTable");
const auditPanel = document.getElementById("auditPanel");
const adminWritePanel = document.getElementById("adminWritePanel");
const addDriveForm = document.getElementById("addDriveForm");
const addUserForm = document.getElementById("addUserForm");
const tabOverview = document.getElementById("tabOverview");
const tabData = document.getElementById("tabData");
const tabFeatures = document.getElementById("tabFeatures");
const overviewPanel = document.getElementById("overviewPanel");
const featurePanel = document.getElementById("featurePanel");
const scanlinesLayer = document.querySelector(".scanlines");
const heroSub = document.querySelector(".hero-sub");
let modelMode = false;
const fx = {
  sfx: true,
  ambient: false,
  rain: false,
  stars: false,
  autopilot: false,
  slowmo: false,
  neonPulse: false,
  wireframe: false,
  glitch: false,
  typing: false,
  adminEdit: false
};

function cleanUrlParams() {
  const url = new URL(window.location.href);
  url.searchParams.delete("token");
  url.searchParams.delete("oauth");
  url.searchParams.delete("authError");
  window.history.replaceState({}, "", url.toString());
}

function parseJwt(token) {
  const base64Url = token.split(".")[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return JSON.parse(atob(padded));
}

let audioCtx;
let ambientNodes;
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playSfx(freq = 420, dur = 0.08, type = "sine") {
  if (!fx.sfx) return;
  const ctx = ensureAudio();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = 0.0001;
  osc.connect(gain);
  gain.connect(ctx.destination);
  const now = ctx.currentTime;
  gain.gain.exponentialRampToValueAtTime(0.05, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.start(now);
  osc.stop(now + dur + 0.01);
}

function toggleAmbientMusic() {
  const ctx = ensureAudio();
  if (ambientNodes) {
    ambientNodes.osc1.stop();
    ambientNodes.osc2.stop();
    ambientNodes = null;
    fx.ambient = false;
    return false;
  }
  const master = ctx.createGain();
  master.gain.value = 0.018;
  master.connect(ctx.destination);
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  osc1.type = "sawtooth";
  osc2.type = "triangle";
  osc1.frequency.value = 110;
  osc2.frequency.value = 164.81;
  osc1.connect(master);
  osc2.connect(master);
  osc1.start();
  osc2.start();
  ambientNodes = { osc1, osc2 };
  fx.ambient = true;
  return true;
}

function api(path, options = {}) {
  if (IS_GITHUB_PAGES && !API_BASE && path.startsWith("/api/")) {
    return Promise.reject(
      new Error("Backend not configured. Open with ?apiBase=https://your-backend-url")
    );
  }
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const url = `${API_BASE}${path}`;
  return fetch(url, { ...options, headers }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Request failed");
    return data;
  });
}

function htmlTable(rows) {
  if (!rows || !rows.length) return "<p>No data</p>";
  const cols = Object.keys(rows[0]);
  const formatHeader = (key) =>
    String(key)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (ch) => ch.toUpperCase());
  const head = `<tr>${cols.map((c) => `<th>${formatHeader(c)}</th>`).join("")}</tr>`;
  const body = rows
    .slice(0, 20)
    .map((r) => `<tr>${cols.map((c) => `<td>${r[c] ?? ""}</td>`).join("")}</tr>`)
    .join("");
  return `<table>${head}${body}</table>`;
}

function showDashboard() {
  loginCard.classList.add("hidden");
  if (!modelMode) dashboard.classList.remove("hidden");
  welcomeTitle.textContent = `${state.user.name} (${state.user.role})`;
  switchDashboardTab("overview");
  if (profileName) profileName.textContent = state.user.name;
  if (profileRole) profileRole.textContent = state.user.role;
  if (profileEmail) profileEmail.textContent = state.user.email;
  if (profileAvatar) {
    const initials = state.user.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase() || "")
      .join("");
    profileAvatar.textContent = initials || "HW";
  }
  renderFeatureLab();
}

function showLogin() {
  modelMode = false;
  if (campusControls) campusControls.classList.add("hidden");
  if (appShell) appShell.classList.remove("hidden");
  dashboard.classList.add("hidden");
  dashboard.style.display = "";
  if (profileName) profileName.textContent = "Candidate";
  if (profileRole) profileRole.textContent = "STUDENT";
  if (profileEmail) profileEmail.textContent = "name@hw.uk";
  if (profileAvatar) profileAvatar.textContent = "HW";
  loginCard.classList.remove("hidden");
}

function enterModelMode() {
  modelMode = true;
  document.body.classList.add("campus-mode");
  if (appShell) appShell.classList.add("hidden");
  dashboard.classList.add("hidden");
  dashboard.style.display = "none";
  loginCard.classList.add("hidden");
  if (campusControls) campusControls.classList.remove("hidden");
}

function exitModelMode() {
  modelMode = false;
  document.body.classList.remove("campus-mode");
  if (campusControls) campusControls.classList.add("hidden");
  if (appShell) appShell.classList.remove("hidden");
  if (state.token && state.user) {
    dashboard.style.display = "";
    dashboard.classList.remove("hidden");
  } else {
    dashboard.style.display = "";
    loginCard.classList.remove("hidden");
  }
}

function switchDashboardTab(tab) {
  if (!overviewPanel || !dataPanel || !featurePanel) return;
  overviewPanel.classList.toggle("hidden", tab !== "overview");
  dataPanel.classList.toggle("hidden", tab !== "data");
  featurePanel.classList.toggle("hidden", tab !== "features");
  tabOverview?.classList.toggle("active", tab === "overview");
  tabData?.classList.toggle("active", tab === "data");
  tabFeatures?.classList.toggle("active", tab === "features");
}

async function loadData() {
  const [summary, drives, audit] = await Promise.all([
    api("/api/dashboard/summary"),
    api("/api/drives"),
    api("/api/dashboard/audit").catch(() => [])
  ]);
  document.getElementById("summary").innerHTML = Object.entries(summary)
    .map(([k, v]) => `<div class="kpi"><div class="label">${k.replaceAll("_", " ")}</div><div class="value">${v}</div></div>`)
    .join("");
  if (drivesCards) {
    drivesCards.innerHTML = drives
      .slice(0, 8)
      .map(
        (d) => `
          <article class="drive-card">
            <h4>${d.company_name}</h4>
            <p>${d.role}</p>
            <p>Package: ${d.package_lpa} LPA</p>
            <p>Eligibility CGPA: ${d.eligibility_cgpa}</p>
          </article>
        `
      )
      .join("");
  }
  if (drivesTable) drivesTable.innerHTML = htmlTable(drives);
  if (auditTable) auditTable.innerHTML = htmlTable(audit);

  if (state.user.role === "ADMIN") {
    roleBlockTitle.textContent = "Confidential Results (Admin)";
    const conf = await api("/api/dashboard/admin/confidential");
    document.getElementById("roleData").innerHTML = htmlTable(conf);
    if (adminWritePanel) adminWritePanel.classList.remove("hidden");
    if (auditPanel) auditPanel.classList.remove("hidden");
  } else {
    roleBlockTitle.textContent = "My Placement Progress (Student)";
    const me = await api("/api/dashboard/student/me");
    document.getElementById("roleData").innerHTML = htmlTable(me);
    if (adminWritePanel) adminWritePanel.classList.add("hidden");
    if (auditPanel) auditPanel.classList.add("hidden");
  }
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  authMsg.textContent = "Authenticating...";
  try {
    const body = {
      email: document.getElementById("email").value.trim(),
      password: document.getElementById("password").value,
      role: document.getElementById("role").value
    };
    const data = await api("/api/auth/login", { method: "POST", body: JSON.stringify(body) });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem("hw_token", state.token);
    localStorage.setItem("hw_user", JSON.stringify(state.user));
    authMsg.textContent = "Login successful.";
    showDashboard();
    await loadData();
  } catch (err) {
    authMsg.textContent = err.message;
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  state.token = "";
  state.user = null;
  localStorage.removeItem("hw_token");
  localStorage.removeItem("hw_user");
  showLogin();
});

document.getElementById("googleLogin").addEventListener("click", async () => {
  if (!API_BASE) {
    authMsg.textContent = "Set backend URL with ?apiBase=https://your-backend-url";
    return;
  }
  const role = document.getElementById("role").value || "STUDENT";
  window.location.href = `${API_BASE}/api/auth/google?role=${encodeURIComponent(role)}`;
});

document.getElementById("facebookLogin").addEventListener("click", async () => {
  const data = await api("/api/auth/facebook");
  authMsg.textContent = `${data.message} (Google is fully enabled now)`;
});

// 3D dynamic CGI-like background
const canvas = document.getElementById("bg3d");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = 10;

const ambient = new THREE.AmbientLight(0x9cb7ff, 0.45);
const pointA = new THREE.PointLight(0x8ba8ff, 2.2, 80);
const pointB = new THREE.PointLight(0xd8be8a, 1.8, 70);
pointA.position.set(3, 3, 6);
pointB.position.set(-4, -2, 8);
scene.add(ambient, pointA, pointB);

const group = new THREE.Group();
scene.add(group);

const nodes = [];
const nodeGeo = new THREE.IcosahedronGeometry(0.22, 1);
for (let i = 0; i < 120; i += 1) {
  const hue = 0.08 + Math.random() * 0.55;
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(hue, 0.65, 0.62),
    emissive: new THREE.Color().setHSL(hue, 0.72, 0.22),
    metalness: 0.75,
    roughness: 0.24
  });
  const mesh = new THREE.Mesh(nodeGeo, mat);
  mesh.position.set((Math.random() - 0.5) * 24, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 10);
  mesh.userData.speed = 0.002 + Math.random() * 0.008;
  mesh.userData.seed = Math.random() * 6.283;
  nodes.push(mesh);
  group.add(mesh);
}

const starGroup = new THREE.Group();
starGroup.visible = false;
scene.add(starGroup);
for (let i = 0; i < 180; i += 1) {
  const star = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xbfd2ff, transparent: true, opacity: 0.8 })
  );
  star.position.set((Math.random() - 0.5) * 34, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 18);
  starGroup.add(star);
}

const rainDrops = [];
const rainGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.25, 4);
const rainMat = new THREE.MeshBasicMaterial({ color: 0x89b4ff, transparent: true, opacity: 0.65 });
for (let i = 0; i < 180; i += 1) {
  const drop = new THREE.Mesh(rainGeo, rainMat);
  drop.rotation.x = Math.PI / 2;
  drop.position.set((Math.random() - 0.5) * 20, Math.random() * 12 + 1, (Math.random() - 0.5) * 10);
  drop.visible = false;
  rainDrops.push(drop);
  scene.add(drop);
}

const meteorGroup = new THREE.Group();
scene.add(meteorGroup);

// Floating "campus hologram" cluster
const campusGroup = new THREE.Group();
campusGroup.position.set(0, -0.3, 0);
scene.add(campusGroup);

const campusBlocks = [];
const campusEdgeLines = [];
const campusPlan = [
  [-2.8, -0.4, 0.8, 1.4, 0.7, 1.1], // central hall
  [-1.2, -0.4, 0.55, 1.0, 0.55, 0.9],
  [0.2, -0.4, 0.95, 1.35, 0.7, 1.2],
  [1.9, -0.4, 0.65, 1.0, 0.55, 1.0],
  [-3.8, -0.4, 0.38, 0.6, 0.45, 0.7],
  [3.1, -0.4, 0.45, 0.7, 0.45, 0.75],
  [-0.5, 0.25, 0.65, 0.75, 0.5, 0.8],
  [1.3, 0.28, 0.55, 0.65, 0.45, 0.7]
];

for (const [x, y, z, sx, sy, sz] of campusPlan) {
  const geo = new THREE.BoxGeometry(sx, sy, sz);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xa7baff,
    emissive: 0x2e56ff,
    emissiveIntensity: 0.5,
    transmission: 0.35,
    transparent: true,
    opacity: 0.8,
    roughness: 0.2,
    metalness: 0.65
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.userData.origin = mesh.position.clone();
  mesh.userData.velocity = new THREE.Vector3();
  mesh.userData.spin = new THREE.Vector3();
  campusBlocks.push(mesh);
  campusGroup.add(mesh);

  const edges = new THREE.EdgesGeometry(geo);
  const line = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: 0xe4ecff, transparent: true, opacity: 0.5 })
  );
  line.position.copy(mesh.position);
  line.userData.parentBlock = mesh;
  campusEdgeLines.push(line);
  campusGroup.add(line);
}

const campusBase = new THREE.Mesh(
  new THREE.RingGeometry(3.8, 4.25, 88),
  new THREE.MeshBasicMaterial({
    color: 0x85a4ff,
    transparent: true,
    opacity: 0.32,
    side: THREE.DoubleSide
  })
);
campusBase.rotation.x = -Math.PI / 2;
campusBase.position.set(0, -1.07, 0);
scene.add(campusBase);

const campusCore = new THREE.Mesh(
  new THREE.SphereGeometry(0.28, 24, 24),
  new THREE.MeshBasicMaterial({ color: 0xf2ddb0, transparent: true, opacity: 0.95 })
);
campusCore.position.set(0, -0.1, 0);
scene.add(campusCore);

// Modern Heriot-Watt-inspired building model (image-based style)
const buildingModelGroup = new THREE.Group();
buildingModelGroup.position.set(0, -0.1, 2.6);
buildingModelGroup.visible = false;
scene.add(buildingModelGroup);

const concreteMat = new THREE.MeshStandardMaterial({
  color: 0xcfd4df,
  metalness: 0.28,
  roughness: 0.6
});
const darkMat = new THREE.MeshStandardMaterial({
  color: 0x1f2536,
  metalness: 0.4,
  roughness: 0.42
});
const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0x8cc8ff,
  transmission: 0.62,
  transparent: true,
  opacity: 0.78,
  roughness: 0.12,
  metalness: 0.35
});

const podium = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.42, 2.6), concreteMat);
podium.position.set(0, -1.0, 0);
buildingModelGroup.add(podium);

const core = new THREE.Mesh(new THREE.BoxGeometry(1.05, 3.0, 1.2), darkMat);
core.position.set(0.2, 0.42, -0.2);
buildingModelGroup.add(core);

const leftWing = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.72, 1.25), concreteMat);
leftWing.position.set(-1.3, 1.24, 0.25);
buildingModelGroup.add(leftWing);

const rightWing = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.68, 1.2), concreteMat);
rightWing.position.set(1.55, 1.35, 0.2);
buildingModelGroup.add(rightWing);

const cantileverA = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.55, 1.05), concreteMat);
cantileverA.position.set(-0.9, 2.0, 0.25);
buildingModelGroup.add(cantileverA);

const cantileverB = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.52, 1.0), concreteMat);
cantileverB.position.set(1.4, 2.2, 0.18);
buildingModelGroup.add(cantileverB);

const glassBand1 = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.42, 0.08), glassMat);
glassBand1.position.set(-0.4, 0.38, 1.0);
buildingModelGroup.add(glassBand1);

const glassBand2 = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.38, 0.08), glassMat);
glassBand2.position.set(0.5, 1.2, 0.85);
buildingModelGroup.add(glassBand2);

const glassBand3 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.34, 0.08), glassMat);
glassBand3.position.set(1.15, 2.0, 0.72);
buildingModelGroup.add(glassBand3);

const palmMat = new THREE.MeshBasicMaterial({ color: 0x3ccf88, transparent: true, opacity: 0.92 });
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a3c, roughness: 0.8, metalness: 0.05 });
function addPalm(x, z) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.45, 8), trunkMat);
  trunk.position.set(x, -0.8, z);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), palmMat);
  crown.position.set(x, -0.53, z);
  buildingModelGroup.add(trunk, crown);
}
addPalm(-1.7, 0.95);
addPalm(1.7, 0.88);

let campusDisperse = false;
let dispersePower = 0;
let ringHover = false;
let sceneBoostUntil = 0;
const raycaster = new THREE.Raycaster();

function setActiveChip(chip) {
  [chip3d, chipRole, chipData, chipDisperse].forEach((c) => c && c.classList.remove("active"));
  if (chip) chip.classList.add("active");
}

function triggerCampusDisperse() {
  campusDisperse = true;
  dispersePower = 1;
  const blastPoint = new THREE.Vector3(0, 0, 0);
  for (const b of campusBlocks) {
    const dir = b.position.clone().sub(blastPoint).normalize();
    b.userData.velocity.copy(dir.multiplyScalar(0.12 + Math.random() * 0.18));
    b.userData.spin.set(
      (Math.random() - 0.5) * 0.12,
      (Math.random() - 0.5) * 0.12,
      (Math.random() - 0.5) * 0.12
    );
  }
}

chip3d?.addEventListener("click", () => {
  setActiveChip(chip3d);
  enterModelMode();
  buildingModelGroup.visible = true;
  sceneBoostUntil = performance.now() + 4000;
  authMsg.textContent = "3D building model launched.";
});

chipRole?.addEventListener("click", () => {
  setActiveChip(chipRole);
  const roleField = document.getElementById("role");
  roleField.value = roleField.value === "STUDENT" ? "ADMIN" : "STUDENT";
  authMsg.textContent = `Role switched to ${roleField.value}.`;
  if (dashboard.classList.contains("hidden")) {
    loginCard.scrollIntoView({ behavior: "smooth", block: "center" });
  }
});

chipData?.addEventListener("click", async () => {
  setActiveChip(chipData);
  exitModelMode();
  buildingModelGroup.visible = false;
  if (!state.token) {
    authMsg.textContent = "Login first to load real-time placement data.";
    return;
  }
  authMsg.textContent = "Refreshing live dashboard data...";
  try {
    await loadData();
    switchDashboardTab("data");
    authMsg.textContent = "Dashboard data updated.";
  } catch (err) {
    authMsg.textContent = `Data refresh failed: ${err.message}`;
  }
});

chipDisperse?.addEventListener("click", () => {
  setActiveChip(chipDisperse);
  enterModelMode();
  if (dataPanel) dataPanel.classList.add("hidden");
  buildingModelGroup.visible = false;
  triggerCampusDisperse();
  playSfx(220, 0.2, "square");
  authMsg.textContent = "Campus view mode enabled with area labels.";
});

exitCampusBtn?.addEventListener("click", () => {
  exitModelMode();
  buildingModelGroup.visible = false;
});

openDataBtn?.addEventListener("click", async () => {
  setActiveChip(chipData);
  exitModelMode();
  buildingModelGroup.visible = false;
  if (!state.token) {
    authMsg.textContent = "Login first to load real-time placement data.";
    return;
  }
  authMsg.textContent = "Refreshing live dashboard data...";
  try {
    await loadData();
    switchDashboardTab("data");
    authMsg.textContent = "Dashboard data updated.";
  } catch (err) {
    authMsg.textContent = `Data refresh failed: ${err.message}`;
  }
});

tabOverview?.addEventListener("click", () => switchDashboardTab("overview"));
tabData?.addEventListener("click", () => switchDashboardTab("data"));
tabFeatures?.addEventListener("click", () => switchDashboardTab("features"));

addDriveForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/admin/drives", {
      method: "POST",
      body: JSON.stringify({
        company_name: document.getElementById("driveCompany").value.trim(),
        role: document.getElementById("driveRole").value.trim(),
        package_lpa: Number(document.getElementById("drivePackage").value),
        drive_date: document.getElementById("driveDate").value,
        eligibility_cgpa: Number(document.getElementById("driveCgpa").value)
      })
    });
    authMsg.textContent = "Drive added successfully.";
    addDriveForm.reset();
    await loadData();
    switchDashboardTab("data");
  } catch (err) {
    authMsg.textContent = `Add drive failed: ${err.message}`;
  }
});

addUserForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        name: document.getElementById("newUserName").value.trim(),
        email: document.getElementById("newUserEmail").value.trim(),
        role: document.getElementById("newUserRole").value,
        password: document.getElementById("newUserPassword").value
      })
    });
    authMsg.textContent = "User added successfully.";
    addUserForm.reset();
  } catch (err) {
    authMsg.textContent = `Add user failed: ${err.message}`;
  }
});

function featureButton(label, handler, isActive = false) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `feature-btn${isActive ? " active" : ""}`;
  btn.textContent = label;
  btn.addEventListener("click", async () => {
    try {
      await handler(btn);
    } catch (err) {
      authMsg.textContent = `Feature failed: ${err.message}`;
    }
  });
  return btn;
}

function addMockDriveCard() {
  if (!drivesCards) return;
  const card = document.createElement("article");
  card.className = "drive-card demo-added";
  card.innerHTML = `
    <h4>Meta Reality Labs</h4>
    <p>Immersive Systems Engineer</p>
    <p>Package: 32 LPA</p>
    <p>Eligibility CGPA: 8.8</p>
  `;
  drivesCards.prepend(card);
}

function removeLastAddedCard() {
  const card = drivesCards?.querySelector(".demo-added");
  if (card) card.remove();
}

function exportDashboardData() {
  const payload = {
    user: state.user,
    summaryCards: Array.from(document.querySelectorAll(".kpi .value")).map((n) => n.textContent.trim()),
    timestamp: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "dashboard-export.json";
  a.click();
  URL.revokeObjectURL(url);
}

function triggerMeteorShower() {
  meteorGroup.clear();
  for (let i = 0; i < 18; i += 1) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.06 + Math.random() * 0.06, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffd79c, transparent: true, opacity: 0.95 })
    );
    m.position.set(-8 - Math.random() * 4, 4 + Math.random() * 7, -5 + Math.random() * 10);
    m.userData.vx = 0.14 + Math.random() * 0.16;
    m.userData.vy = -0.08 - Math.random() * 0.08;
    meteorGroup.add(m);
  }
}

function speak(msg) {
  if (!("speechSynthesis" in window)) return;
  const utter = new SpeechSynthesisUtterance(msg);
  utter.rate = 1;
  utter.pitch = 1;
  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
}

function startTypewriter() {
  if (!heroSub) return;
  const target = "Immersive talent platform with cinematic campus intelligence and smart placement insights.";
  heroSub.textContent = "";
  let i = 0;
  fx.typing = true;
  const timer = setInterval(() => {
    if (!fx.typing || i >= target.length) {
      clearInterval(timer);
      fx.typing = false;
      return;
    }
    heroSub.textContent += target[i];
    i += 1;
  }, 28);
}

function renderFeatureLab() {
  if (!featureLab) return;
  featureLab.innerHTML = "";
  const groupedFeatures = [
    {
      title: "Audio",
      items: [
        ["Ambient Music", () => { const on = toggleAmbientMusic(); playSfx(360); authMsg.textContent = on ? "Ambient score ON" : "Ambient score OFF"; }],
        ["Interaction SFX", (btn) => { fx.sfx = !fx.sfx; btn.classList.toggle("active", fx.sfx); playSfx(520); }],
        ["Voice Announce", () => { speak(`${state.user.role} dashboard activated. Welcome ${state.user.name}`); }]
      ]
    },
    {
      title: "Visual FX",
      items: [
        ["Rain FX", (btn) => { fx.rain = !fx.rain; btn.classList.toggle("active", fx.rain); playSfx(300); }],
        ["Starfield FX", (btn) => { fx.stars = !fx.stars; starGroup.visible = fx.stars; btn.classList.toggle("active", fx.stars); playSfx(330); }],
        ["Neon Pulse", (btn) => { fx.neonPulse = !fx.neonPulse; btn.classList.toggle("active", fx.neonPulse); }],
        ["Glitch Scanlines", (btn) => { fx.glitch = !fx.glitch; btn.classList.toggle("active", fx.glitch); }],
        ["Meteor Shower", () => { triggerMeteorShower(); playSfx(250, 0.18, "square"); }],
        ["Theme Shift", () => { document.body.style.filter = document.body.style.filter ? "" : "hue-rotate(45deg) saturate(1.15)"; }]
      ]
    },
    {
      title: "3D Camera & Motion",
      items: [
        ["Auto Camera", (btn) => { fx.autopilot = !fx.autopilot; btn.classList.toggle("active", fx.autopilot); }],
        ["Slow Motion", (btn) => { fx.slowmo = !fx.slowmo; btn.classList.toggle("active", fx.slowmo); }],
        ["Hyper Burst", () => { sceneBoostUntil = performance.now() + 9000; playSfx(180, 0.25, "sawtooth"); }],
        ["Wireframe View", (btn) => { fx.wireframe = !fx.wireframe; [...nodes, ...campusBlocks].forEach((m) => { m.material.wireframe = fx.wireframe; }); btn.classList.toggle("active", fx.wireframe); }],
        ["Campus Spin", () => { campusGroup.rotation.y += Math.PI / 2; playSfx(290); }]
      ]
    },
    {
      title: "Tools",
      items: [
        ["Screenshot PNG", () => { const a = document.createElement("a"); a.href = renderer.domElement.toDataURL("image/png"); a.download = "hw-3d-shot.png"; a.click(); playSfx(500); }],
        ["Fullscreen", () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); }],
        ["Export Dashboard JSON", () => { exportDashboardData(); playSfx(350); }],
        ["Typewriter Hero", (btn) => { startTypewriter(); btn.classList.add("active"); playSfx(420); }]
      ]
    }
  ];
  for (const group of groupedFeatures) {
    const wrap = document.createElement("section");
    wrap.className = "feature-group";
    const title = document.createElement("h4");
    title.textContent = group.title;
    const grid = document.createElement("div");
    grid.className = "feature-group-grid";
    for (const [name, handler] of group.items) {
      grid.appendChild(featureButton(name, handler));
    }
    wrap.append(title, grid);
    featureLab.appendChild(wrap);
  }
}

const lineMat = new THREE.LineBasicMaterial({ color: 0xbccfff, transparent: true, opacity: 0.24 });
for (let i = 0; i < 90; i += 1) {
  const a = nodes[Math.floor(Math.random() * nodes.length)];
  const b = nodes[Math.floor(Math.random() * nodes.length)];
  const geo = new THREE.BufferGeometry().setFromPoints([a.position, b.position]);
  const line = new THREE.Line(geo, lineMat);
  line.userData.a = a;
  line.userData.b = b;
  scene.add(line);
}

const mouse = new THREE.Vector2();
window.addEventListener("pointermove", (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const ringHit = raycaster.intersectObject(campusBase, false);
  ringHover = ringHit.length > 0;
});

window.addEventListener("pointerdown", (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(campusBlocks, false);
  if (intersects.length) {
    triggerCampusDisperse();
  }
});

function animate(t) {
  const time = t * 0.001;
  const speedFactor = fx.slowmo ? 0.45 : 1;
  const boosted = performance.now() < sceneBoostUntil;
  const speedMul = boosted ? 1.9 : 1;
  group.rotation.y = time * 0.06 * speedMul * speedFactor;
  group.rotation.x = Math.sin(time * 0.24 * speedMul * speedFactor) * 0.08;
  const camTargetX = fx.autopilot ? Math.sin(time * 0.5) * 1.3 : mouse.x * 1.1;
  const camTargetY = fx.autopilot ? Math.cos(time * 0.38) * 0.7 : mouse.y * 0.6;
  camera.position.x += (camTargetX - camera.position.x) * 0.022;
  camera.position.y += (camTargetY - camera.position.y) * 0.022;
  camera.position.z = 10 + Math.sin(time * 0.4) * 0.6;
  pointA.position.x = 4 * Math.sin(time * 0.7);
  pointA.position.y = 3 * Math.cos(time * 0.5);
  pointB.position.x = 4 * Math.cos(time * 0.35);
  pointB.position.y = -2 + 2 * Math.sin(time * 0.6);
  if (fx.neonPulse) {
    pointA.intensity = 2 + Math.sin(time * 4.2) * 0.8;
    pointB.intensity = 1.8 + Math.cos(time * 3.8) * 0.7;
  } else {
    pointA.intensity = 2.2;
    pointB.intensity = 1.8;
  }
  if (scanlinesLayer) {
    scanlinesLayer.style.opacity = fx.glitch ? String(0.65 + Math.sin(time * 10) * 0.28) : "1";
  }
  camera.lookAt(scene.position);

  if (buildingModelGroup.visible) {
    buildingModelGroup.rotation.y += 0.008;
    buildingModelGroup.position.y = -0.1 + Math.sin(time * 1.8) * 0.06;
    const s = 1.05 + Math.sin(time * 3.2) * 0.03;
    buildingModelGroup.scale.set(s, s, s);
  }

  campusGroup.rotation.y = Math.sin(time * 0.2) * 0.12;
  campusGroup.position.y = -0.25 + Math.sin(time * 1.2) * 0.08;
  const baseOpacity = 0.24 + Math.sin(time * 1.9) * 0.08;
  campusBase.material.opacity += ((ringHover ? 0.62 : baseOpacity) - campusBase.material.opacity) * 0.08;
  const targetScale = ringHover ? 1.14 : 1;
  campusBase.scale.x += (targetScale - campusBase.scale.x) * 0.08;
  campusBase.scale.y += (targetScale - campusBase.scale.y) * 0.08;
  campusBase.scale.z += (targetScale - campusBase.scale.z) * 0.08;
  campusBase.rotation.z += ringHover ? 0.02 : 0.006;
  campusCore.material.opacity = 0.65 + Math.sin(time * 3.5) * 0.3;
  const hoverBoost = ringHover ? 0.22 : 0;
  campusCore.scale.setScalar(1 + Math.sin(time * 3.5) * (0.16 + hoverBoost));

  if (campusDisperse) {
    dispersePower -= 0.012;
    for (const b of campusBlocks) {
      b.position.add(b.userData.velocity);
      b.rotation.x += b.userData.spin.x;
      b.rotation.y += b.userData.spin.y;
      b.rotation.z += b.userData.spin.z;
      b.userData.velocity.multiplyScalar(0.982);
    }
    if (dispersePower <= 0) {
      campusDisperse = false;
    }
  } else {
    for (const b of campusBlocks) {
      const lift = Math.sin(time * 1.4 + b.userData.origin.x) * 0.03;
      const target = b.userData.origin.clone();
      target.y += lift;
      b.position.lerp(target, 0.07);
      b.rotation.x *= 0.9;
      b.rotation.y *= 0.9;
      b.rotation.z *= 0.9;
    }
  }

  for (const edge of campusEdgeLines) {
    edge.position.copy(edge.userData.parentBlock.position);
    edge.rotation.copy(edge.userData.parentBlock.rotation);
  }

  for (const n of nodes) {
    n.position.y += Math.sin(time + n.userData.seed) * n.userData.speed;
    n.rotation.x += 0.01;
    n.rotation.y += 0.013;
  }

  for (const drop of rainDrops) {
    drop.visible = fx.rain;
    if (!fx.rain) continue;
    drop.position.y -= 0.16;
    if (drop.position.y < -2.2) {
      drop.position.y = 8 + Math.random() * 5;
      drop.position.x = (Math.random() - 0.5) * 20;
      drop.position.z = (Math.random() - 0.5) * 10;
    }
  }

  if (meteorGroup.children.length) {
    for (const m of meteorGroup.children) {
      m.position.x += m.userData.vx;
      m.position.y += m.userData.vy;
      m.material.opacity *= 0.992;
    }
    while (meteorGroup.children.length && meteorGroup.children[0].material.opacity < 0.06) {
      meteorGroup.remove(meteorGroup.children[0]);
    }
  }

  scene.traverse((obj) => {
    if (obj.type === "Line") {
      if (obj.userData.parentBlock) {
        obj.position.copy(obj.userData.parentBlock.position);
        obj.rotation.copy(obj.userData.parentBlock.rotation);
        return;
      }
      const positions = obj.geometry.attributes.position.array;
      positions[0] = obj.userData.a.position.x;
      positions[1] = obj.userData.a.position.y;
      positions[2] = obj.userData.a.position.z;
      positions[3] = obj.userData.b.position.x;
      positions[4] = obj.userData.b.position.y;
      positions[5] = obj.userData.b.position.z;
      obj.geometry.attributes.position.needsUpdate = true;
    }
  });

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

if (state.token && state.user) {
  showDashboard();
  loadData().catch((err) => {
    authMsg.textContent = err.message;
    showLogin();
  });
} else {
  showLogin();
}

const oauthToken = params.get("token");
const oauthError = params.get("authError");
if (oauthError) {
  authMsg.textContent = `OAuth error: ${oauthError}`;
  cleanUrlParams();
} else if (oauthToken) {
  state.token = oauthToken;
  localStorage.setItem("hw_token", state.token);
  api("/api/dashboard/summary")
    .then(() => {
      const payload = parseJwt(state.token);
      state.user = {
        user_id: payload.user_id,
        name: payload.name,
        email: payload.email,
        role: payload.role
      };
      localStorage.setItem("hw_user", JSON.stringify(state.user));
      showDashboard();
      return loadData();
    })
    .catch((err) => {
      authMsg.textContent = `OAuth sign-in failed: ${err.message}`;
      showLogin();
    })
    .finally(() => cleanUrlParams());
}
