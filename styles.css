* {
  box-sizing: border-box;
}

:root {
  --bg: #f6f1ea;
  --panel: #fffdfb;
  --panel-alt: #f1e6df;
  --primary: #5a110d;
  --primary-strong: #3d0d0a;
  --primary-soft: #f5d9d1;
  --accent: #a84b2b;
  --accent-strong: #8a3a24;
  --copper: #be6b2e;
  --gold: #d9ad5d;
  --gold-soft: #f7e7bf;
  --warm-ivory: #f8f3ee;
  --warm-paper: #fffdf9;
  --success: #346e5f;
  --danger: #b64a3f;
  --warning: #b36b2b;
  --text: #241918;
  --muted: #685a58;
  --line: #e8d7cf;
  --shadow: 0 18px 46px rgba(74, 18, 13, 0.12);
  --radius: 18px;
}

html, body {
  margin: 0;
  min-height: 100%;
  background: linear-gradient(180deg, #f9f5f2 0%, #f2ece7 100%);
  font-family: 'Cairo', sans-serif;
  color: var(--text);
}

body {
  min-height: 100vh;
  transition: background 0.2s ease;
}

body[dir='rtl'] {
  direction: rtl;
}

body[dir='ltr'] {
  direction: ltr;
}

button, input, select, textarea {
  font-family: inherit;
}

button {
  cursor: pointer;
}

.app-shell {
  min-height: 100vh;
  display: flex;
}

.login-screen {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background:
    radial-gradient(circle at top left, rgba(90, 17, 13, 0.12), transparent 25%),
    radial-gradient(circle at bottom right, rgba(184, 107, 46, 0.12), transparent 20%),
    #f8f3ee;
}

.login-card {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  width: min(1100px, 100%);
  background: rgba(255,255,255,0.9);
  border: 1px solid rgba(232, 215, 207, 0.9);
  box-shadow: var(--shadow);
  border-radius: 28px;
  overflow: hidden;
  backdrop-filter: blur(8px);
}

.login-visual {
  background: linear-gradient(180deg, var(--primary) 0%, var(--primary-strong) 100%);
  position: relative;
  padding: 36px 32px;
  color: #fff8f4;
}

.login-visual::before,
.login-visual::after {
  content: "";
  position: absolute;
  border-radius: 50%;
  background: rgba(255,255,255,0.06);
}

.login-visual::before {
  width: 260px;
  height: 260px;
  top: -60px;
  right: -80px;
}

.login-visual::after {
  width: 150px;
  height: 150px;
  bottom: -40px;
  left: -16px;
}

.brand-block {
  position: relative;
  z-index: 1;
}

.brand-mark {
  width: 94px;
  height: 94px;
  margin-bottom: 18px;
  display: grid;
  place-items: center;
  border-radius: 22px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.04);
}

.brand-mark img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.brand-title {
  font-size: clamp(2rem, 3vw, 3rem);
  margin: 0;
  font-weight: 800;
  color: #fff8f3;
}

.brand-sub {
  margin-top: 12px;
  color: rgba(255,255,255,0.82);
  font-size: 1rem;
}

.login-feature-list {
  position: relative;
  z-index: 1;
  list-style: none;
  padding: 0;
  margin: 28px 0 0;
  display: grid;
  gap: 14px;
}

.login-feature-list li {
  display: flex;
  align-items: center;
  gap: 12px;
  color: rgba(255,255,255,0.86);
  font-weight: 600;
}

.login-feature-list li::before {
  content: "✓";
  width: 22px;
  height: 22px;
  display: inline-grid;
  place-items: center;
  border-radius: 50%;
  background: rgba(255,255,255,0.12);
  font-weight: 800;
}

.login-form-wrap {
  padding: 36px 28px;
  background: rgba(255,255,255,0.96);
}

.login-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 28px;
}

.login-head h2 {
  margin: 0;
  font-size: 2rem;
  color: var(--text);
}

.lang-badge {
  background: linear-gradient(135deg, var(--gold-soft), #f3e8cf);
  color: var(--primary-strong);
  font-weight: 800;
  padding: 8px 12px;
  border-radius: 999px;
  font-size: 0.78rem;
  border: 0;
  box-shadow: 0 8px 18px rgba(184, 107, 46, 0.1);
}

.form-group {
  margin-bottom: 18px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--text);
}

.input {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 14px 16px;
  background: #fffdfc;
  font-size: 1rem;
  color: var(--text);
  transition: border-color 0.2s, box-shadow 0.2s;
}

textarea.input {
  min-height: 90px;
  resize: vertical;
}

.input:focus {
  outline: none;
  border-color: rgba(90, 17, 13, 0.65);
  box-shadow: 0 0 0 4px rgba(90, 17, 13, 0.08);
}

.password-wrap {
  display: flex;
  align-items: center;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fffdfc;
  overflow: hidden;
}

.password-wrap .input {
  border: none;
  background: transparent;
}

.password-wrap button {
  border: none;
  background: transparent;
  padding: 0 14px;
  color: var(--muted);
  cursor: pointer;
  font-weight: 700;
}

.primary-btn, .secondary-btn, .ghost-btn, .danger-btn {
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 700;
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.primary-btn:hover, .secondary-btn:hover, .ghost-btn:hover, .danger-btn:hover {
  transform: translateY(-1px);
}

.primary-btn {
  display: block;
  width: 100%;
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
  color: #fff8f4;
  padding: 15px 18px;
  font-size: 1rem;
  margin-top: 10px;
  box-shadow: 0 10px 24px rgba(90, 17, 13, 0.18);
}

.secondary-btn {
  background: linear-gradient(135deg, var(--gold-soft), #f4dcc1);
  color: var(--primary-strong);
  padding: 12px 18px;
  border: 1px solid rgba(184, 107, 46, 0.12);
}

.ghost-btn {
  background: linear-gradient(135deg, #f7efe2, #f4e2d7);
  color: var(--primary);
  padding: 10px 14px;
  border: 1px solid rgba(90, 17, 13, 0.08);
}

.danger-btn {
  background: rgba(182, 74, 63, 0.08);
  color: var(--danger);
  padding: 10px 14px;
}

.demo-box {
  margin-top: 22px;
  border: 1px solid var(--line);
  background: linear-gradient(180deg, #fff9f4, #f9efe9);
  border-radius: 14px;
  padding: 14px;
}

.demo-box h4 {
  margin: 0 0 12px;
  font-size: 0.95rem;
  color: var(--muted);
}

.demo-users {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.demo-user-button {
  border: 1px solid rgba(184, 107, 46, 0.2);
  background: #fffefb;
  border-radius: 999px;
  padding: 8px 12px;
  cursor: pointer;
  color: var(--primary);
  font-weight: 700;
}

.error-box {
  margin-top: 12px;
  background: rgba(182, 74, 63, 0.08);
  border: 1px solid rgba(182, 74, 63, 0.18);
  color: var(--danger);
  border-radius: 12px;
  padding: 10px 12px;
  font-weight: 700;
  display: none;
}

.error-box.visible {
  display: block;
}

.app-shell {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 280px;
  background: linear-gradient(180deg, var(--primary) 0%, var(--primary-strong) 100%);
  color: #fff8f5;
  padding: 22px 18px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  border-right: 1px solid rgba(255,255,255,0.08);
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px 18px;
  border-bottom: 1px solid rgba(255,255,255,0.12);
}

.sidebar-logo-badge {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  background: rgba(255,255,255,0.08);
  display: grid;
  place-items: center;
  font-weight: 800;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.14);
}

.sidebar-logo-badge img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.sidebar-logo h3 {
  margin: 0;
  font-size: 1.2rem;
  color: #fff6f2;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-item {
  border: none;
  background: transparent;
  color: rgba(255,255,255,0.8);
  border-radius: 12px;
  padding: 12px 14px;
  text-align: left;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}

body[dir='rtl'] .nav-item {
  text-align: right;
}

.nav-item.active {
  background: linear-gradient(135deg, rgba(216,173,93,0.16), rgba(255,255,255,0.08));
  color: white;
  border: 1px solid rgba(216,173,93,0.18);
}

.sidebar-footer {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid rgba(255,255,255,0.12);
}

.main {
  flex: 1;
  min-width: 0;
  padding: 26px;
  background: linear-gradient(180deg, #fffdfb 0%, #f5efe9 100%);
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.user-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.lang-switch {
  border: 1px solid rgba(90, 17, 13, 0.12);
  background: #fff8f3;
  border-radius: 999px;
  padding: 10px 12px;
  color: var(--primary-strong);
  font-weight: 800;
}

.topbar h1 {
  margin: 0;
  font-size: clamp(1.7rem, 3vw, 2.5rem);
  color: var(--primary-strong);
}

.user-pill {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fffdfb;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 10px 14px;
  font-weight: 700;
  box-shadow: 0 10px 20px rgba(90, 17, 13, 0.04);
}

.user-pill .avatar {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--gold-soft), #f3d7bb);
  color: var(--primary);
  font-weight: 800;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(180px, 1fr));
  gap: 18px;
  margin-bottom: 24px;
}

.stat-card {
  background: linear-gradient(180deg, #fffdfb 0%, #fffaf4 100%);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 18px 18px 16px;
  box-shadow: 0 10px 24px rgba(90, 17, 13, 0.04);
}

.stat-label {
  color: var(--muted);
  font-size: 0.9rem;
  margin-bottom: 10px;
  display: block;
}

.stat-value {
  font-size: 2rem;
  font-weight: 800;
  color: var(--primary);
  margin: 0;
}

.stat-foot {
  margin-top: 14px;
  color: var(--success);
  font-weight: 700;
  font-size: 0.9rem;
}

.content-panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: 0 10px 24px rgba(74, 18, 13, 0.04);
  padding: 20px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
}

.section-head h2 {
  margin: 0;
  font-size: 1.6rem;
  color: var(--primary-strong);
}

.table-wrap {
  overflow: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  text-align: left;
  padding: 14px 12px;
  border-bottom: 1px solid var(--line);
}

body[dir='rtl'] th,
body[dir='rtl'] td {
  text-align: right;
}

th {
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 96px;
  padding: 7px 10px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 800;
}

.badge.active {
  background: rgba(52, 110, 95, 0.12);
  color: var(--success);
}

.badge.pending {
  background: rgba(179, 107, 43, 0.12);
  color: var(--warning);
}

.badge.disabled {
  background: rgba(182, 74, 63, 0.08);
  color: var(--danger);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(180px, 1fr));
  gap: 16px;
}

.form-grid .full {
  grid-column: 1 / -1;
}

.split-title {
  font-weight: 800;
  color: var(--primary-strong);
  border-bottom: 1px solid var(--line);
  padding-bottom: 12px;
  margin-top: 8px;
}

.row-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.muted {
  color: var(--muted);
}

.empty-state {
  padding: 24px;
  border: 1px dashed var(--line);
  border-radius: 14px;
  text-align: center;
  color: var(--muted);
  background: linear-gradient(180deg, #fffefc, #f7f0ea);
}

.company-panel {
  display: grid;
  gap: 18px;
}

.company-desc {
  color: var(--muted);
  background: linear-gradient(180deg, #fff9f5, #faf1ea);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 14px 16px;
}

.company-form {
  padding: 10px 0 0;
}

.filter-row {
  display: grid;
  grid-template-columns: minmax(220px, 1.5fr) minmax(160px, 0.8fr) minmax(160px, 0.8fr);
  gap: 12px;
  margin-top: 8px;
  margin-bottom: 12px;
}

.company-table-wrap {
  margin-top: 10px;
}

.empty-state-table {
  text-align: center;
  color: var(--muted);
  padding: 20px;
  background: #fffaf6;
}

.controls-row {
  display: flex;
  justify-content: stretch;
}

@media (max-width: 960px) {
  .login-card {
    grid-template-columns: 1fr;
  }

  .app-shell {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
  }

  .stats-grid {
    grid-template-columns: 1fr 1fr;
  }

  .filter-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .stats-grid,
  .form-grid {
    grid-template-columns: 1fr;
  }

  .main {
    padding: 14px;
  }
}

