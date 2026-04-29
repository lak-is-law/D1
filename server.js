const path = require("path");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
require("dotenv").config();

const db = require("./db");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL || "https://d1-backend-x7eg.onrender.com/api/auth/google/callback";
const GOOGLE_ALLOWED_DOMAIN = (process.env.GOOGLE_ALLOWED_DOMAIN || "").trim().toLowerCase();

app.set("trust proxy", 1);
app.use(cors());
app.use(express.json());
app.use(
  session({
    secret: JWT_SECRET,
    resave: false,
    saveUninitialized: false
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, "public")));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
        proxy: true
      },
      (accessToken, refreshToken, profile, done) => {
        done(null, profile);
      }
    )
  );
}

function signToken(user) {
  return jwt.sign(
    {
      user_id: user.user_id,
      role: user.role,
      email: user.email,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: "8h" }
  );
}

function auth(requiredRole) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return res.status(401).json({ message: "Missing token" });
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = payload;
      if (requiredRole && payload.role !== requiredRole) {
        return res.status(403).json({ message: "Forbidden for this role" });
      }
      return next();
    } catch (err) {
      return res.status(401).json({ message: "Invalid/expired token" });
    }
  };
}

app.post("/api/auth/login", async (req, res) => {
  const { email, password, role } = req.body || {};
  if (!email || !password || !role) {
    return res.status(400).json({ message: "email, password, role are required" });
  }
  if (!email.endsWith("@hw.uk")) {
    return res.status(400).json({ message: "Use Heriot-Watt domain (@hw.uk)" });
  }

  try {
    const [rows] = await db.query(
      "SELECT user_id, name, email, role, password FROM USERS WHERE email = ? AND role = ? LIMIT 1",
      [email, role]
    );

    if (!rows.length) return res.status(401).json({ message: "User not found for role" });
    const user = rows[0];
    if (user.password !== password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = signToken(user);
    return res.json({
      token,
      user: {
        user_id: user.user_id,
        name: user.name,
        role: user.role,
        email: user.email
      }
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.get("/api/auth/google", (_req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.status(500).json({
      message: "Google OAuth is not configured on backend"
    });
  }
  _req.session.oauthRole = _req.query.role === "ADMIN" ? "ADMIN" : "STUDENT";
  return passport.authenticate("google", {
    scope: ["openid", "email", "profile"],
    prompt: "select_account",
    accessType: "offline",
    includeGrantedScopes: true
  })(_req, res);
});

app.get("/api/auth/facebook", (_req, res) => {
  res.json({
    provider: "facebook",
    message: "OAuth hook ready. Configure Facebook app credentials and callback."
  });
});

app.get(
  "/api/auth/google/callback",
  (req, res, next) => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res.redirect(`${FRONTEND_URL}?authError=google_not_configured`);
    }
    return next();
  },
  passport.authenticate("google", { failureRedirect: `${FRONTEND_URL}?authError=google_failed` }),
  async (req, res) => {
    try {
      const profile = req.user;
      const email = profile?.emails?.[0]?.value?.toLowerCase();
      const name = profile?.displayName || "Google User";
      if (!email) {
        return res.redirect(`${FRONTEND_URL}?authError=missing_google_email`);
      }
      if (GOOGLE_ALLOWED_DOMAIN && !email.endsWith(`@${GOOGLE_ALLOWED_DOMAIN}`)) {
        return res.redirect(`${FRONTEND_URL}?authError=domain_not_allowed`);
      }
      const role = req.session.oauthRole === "ADMIN" ? "ADMIN" : "STUDENT";

      let user;
      const [existing] = await db.query(
        "SELECT user_id, name, email, role, password FROM USERS WHERE email = ? LIMIT 1",
        [email]
      );
      if (existing.length) {
        user = existing[0];
        if (user.role !== role) {
          await db.query("UPDATE USERS SET role = ?, name = ? WHERE user_id = ?", [role, name, user.user_id]);
          user.role = role;
          user.name = name;
        }
      } else {
        const [maxRows] = await db.query("SELECT COALESCE(MAX(user_id), 0) + 1 AS next_id FROM USERS");
        const nextId = maxRows[0].next_id;
        await db.query(
          "INSERT INTO USERS (user_id, name, email, password, role) VALUES (?, ?, ?, ?, ?)",
          [nextId, name, email, "google_oauth", role]
        );
        user = { user_id: nextId, name, email, role };
      }

      const token = signToken(user);
      const redirectUrl = `${FRONTEND_URL}?token=${encodeURIComponent(token)}&oauth=google`;
      return res.redirect(redirectUrl);
    } catch (err) {
      return res.redirect(`${FRONTEND_URL}?authError=${encodeURIComponent(err.message)}`);
    }
  }
);

app.get("/api/dashboard/summary", auth(), async (_req, res) => {
  try {
    const [studentsQ, drivesQ, appsQ, offersQ] = await Promise.all([
      db.query("SELECT COUNT(*) AS count FROM STUDENT"),
      db.query("SELECT COUNT(*) AS count FROM DRIVE"),
      db.query("SELECT COUNT(*) AS count FROM APPLICATION"),
      db.query("SELECT COUNT(*) AS count FROM RESULT WHERE final_status = 'SELECTED'")
    ]);
    return res.json({
      total_students: studentsQ[0][0].count,
      total_drives: drivesQ[0][0].count,
      total_applications: appsQ[0][0].count,
      selected_results: offersQ[0][0].count
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.get("/api/dashboard/admin/confidential", auth("ADMIN"), async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         u.name AS student_name,
         u.email,
         s.cgpa,
         c.company_name,
         d.role,
         r.final_status,
         r.offer_ctc_lpa
       FROM RESULT r
       JOIN INTERVIEW i ON i.interview_id = r.interview_id
       JOIN APPLICATION a ON a.application_id = i.application_id
       JOIN STUDENT s ON s.student_id = a.student_id
       JOIN USERS u ON u.user_id = s.user_id
       JOIN DRIVE d ON d.drive_id = a.drive_id
       JOIN COMPANY c ON c.company_id = d.company_id
       ORDER BY r.result_date DESC, r.offer_ctc_lpa DESC`
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.get("/api/dashboard/student/me", auth("STUDENT"), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         u.name AS student_name,
         s.department,
         s.cgpa,
         c.company_name,
         d.role,
         a.status AS application_status,
         r.final_status,
         r.offer_ctc_lpa
       FROM USERS u
       JOIN STUDENT s ON s.user_id = u.user_id
       LEFT JOIN APPLICATION a ON a.student_id = s.student_id
       LEFT JOIN DRIVE d ON d.drive_id = a.drive_id
       LEFT JOIN COMPANY c ON c.company_id = d.company_id
       LEFT JOIN INTERVIEW i ON i.application_id = a.application_id
       LEFT JOIN RESULT r ON r.interview_id = i.interview_id
       WHERE u.user_id = ?
       ORDER BY a.applied_on DESC`,
      [req.user.user_id]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.get("/api/drives", auth(), async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT d.drive_id, c.company_name, d.role, d.package_lpa, d.drive_date, d.eligibility_cgpa
       FROM DRIVE d
       JOIN COMPANY c ON c.company_id = d.company_id
       ORDER BY d.drive_date DESC`
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "d1-backend" });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`HW 3D portal running on http://localhost:${PORT}`);
});
