const state = {
  token: localStorage.getItem("hw_token") || "",
  user: JSON.parse(localStorage.getItem("hw_user") || "null")
};

const loginCard = document.getElementById("loginCard");
const dashboard = document.getElementById("dashboard");
const authMsg = document.getElementById("authMsg");
const welcomeTitle = document.getElementById("welcomeTitle");
const roleBlockTitle = document.getElementById("roleBlockTitle");

function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  return fetch(path, { ...options, headers }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Request failed");
    return data;
  });
}

function htmlTable(rows) {
  if (!rows || !rows.length) return "<p>No data</p>";
  const cols = Object.keys(rows[0]);
  const head = `<tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr>`;
  const body = rows
    .slice(0, 20)
    .map((r) => `<tr>${cols.map((c) => `<td>${r[c] ?? ""}</td>`).join("")}</tr>`)
    .join("");
  return `<table>${head}${body}</table>`;
}

function showDashboard() {
  loginCard.classList.add("hidden");
  dashboard.classList.remove("hidden");
  welcomeTitle.textContent = `${state.user.name} (${state.user.role})`;
}

function showLogin() {
  dashboard.classList.add("hidden");
  loginCard.classList.remove("hidden");
}

async function loadData() {
  const [summary, drives] = await Promise.all([api("/api/dashboard/summary"), api("/api/drives")]);
  document.getElementById("summary").innerHTML = Object.entries(summary)
    .map(([k, v]) => `<div class="kpi"><div class="label">${k.replaceAll("_", " ")}</div><div class="value">${v}</div></div>`)
    .join("");
  document.getElementById("drivesTable").innerHTML = htmlTable(drives);

  if (state.user.role === "ADMIN") {
    roleBlockTitle.textContent = "Confidential Results (Admin)";
    const conf = await api("/api/dashboard/admin/confidential");
    document.getElementById("roleData").innerHTML = htmlTable(conf);
  } else {
    roleBlockTitle.textContent = "My Placement Progress (Student)";
    const me = await api("/api/dashboard/student/me");
    document.getElementById("roleData").innerHTML = htmlTable(me);
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
  const data = await api("/api/auth/google");
  authMsg.textContent = data.message;
});

document.getElementById("facebookLogin").addEventListener("click", async () => {
  const data = await api("/api/auth/facebook");
  authMsg.textContent = data.message;
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

let campusDisperse = false;
let dispersePower = 0;
let ringHover = false;
const raycaster = new THREE.Raycaster();

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
    campusDisperse = true;
    dispersePower = 1;
    for (const b of campusBlocks) {
      const dir = b.position.clone().sub(intersects[0].point).normalize();
      b.userData.velocity.copy(dir.multiplyScalar(0.12 + Math.random() * 0.18));
      b.userData.spin.set(
        (Math.random() - 0.5) * 0.12,
        (Math.random() - 0.5) * 0.12,
        (Math.random() - 0.5) * 0.12
      );
    }
  }
});

function animate(t) {
  const time = t * 0.001;
  group.rotation.y = time * 0.06;
  group.rotation.x = Math.sin(time * 0.24) * 0.08;
  camera.position.x += (mouse.x * 1.1 - camera.position.x) * 0.022;
  camera.position.y += (mouse.y * 0.6 - camera.position.y) * 0.022;
  camera.position.z = 10 + Math.sin(time * 0.4) * 0.6;
  pointA.position.x = 4 * Math.sin(time * 0.7);
  pointA.position.y = 3 * Math.cos(time * 0.5);
  pointB.position.x = 4 * Math.cos(time * 0.35);
  pointB.position.y = -2 + 2 * Math.sin(time * 0.6);
  camera.lookAt(scene.position);

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
