const STORAGE_KEY = 'ab_group_demo_state';

const seedRoles = [
  { id: 'owner', name: 'Owner', description: 'System owner', permissions: ['view_dashboard', 'create_user', 'edit_user', 'deactivate_user', 'view_company', 'create_company', 'edit_company', 'view_tasks', 'create_task', 'edit_task', 'update_task_status', 'view_reports', 'export_reports', 'view_investors', 'create_investment', 'view_finance', 'edit_finance', 'view_marketing', 'create_campaign', 'view_customer_data', 'create_customer', 'manage_notifications', 'assign_task', 'approve_request', 'reject_request', 'delegate_access'] },
  { id: 'general_manager', name: 'General Manager', description: 'Administrative leadership', permissions: ['view_dashboard', 'view_company', 'edit_company', 'view_tasks', 'create_task', 'edit_task', 'update_task_status', 'view_reports', 'export_reports', 'view_investors', 'view_finance', 'view_marketing', 'manage_notifications', 'assign_task', 'approve_request', 'reject_request'] },
  { id: 'regional_manager', name: 'Regional Manager', description: 'Regional leadership', permissions: ['view_dashboard', 'view_tasks', 'create_task', 'edit_task', 'update_task_status', 'view_reports', 'manage_notifications', 'assign_task', 'approve_request'] },
  { id: 'hr_manager', name: 'HR Manager', description: 'Human resources', permissions: ['view_dashboard', 'view_users', 'create_user', 'edit_user', 'view_company', 'view_reports', 'manage_notifications'] },
  { id: 'pr_manager', name: 'Public Relations Manager', description: 'Public relations', permissions: ['view_dashboard', 'view_company', 'view_tasks', 'create_task', 'manage_notifications', 'view_reports'] },
  { id: 'marketing_manager', name: 'Development & Marketing Manager', description: 'Marketing and growth', permissions: ['view_dashboard', 'view_company', 'view_marketing', 'create_campaign', 'view_reports', 'manage_notifications'] },
  { id: 'finance_manager', name: 'Finance Manager', description: 'Finance and accounts', permissions: ['view_dashboard', 'view_finance', 'edit_finance', 'view_reports', 'export_reports', 'manage_notifications'] },
  { id: 'employee', name: 'Employee', description: 'Operational staff', permissions: ['view_dashboard', 'view_tasks', 'create_task', 'edit_task', 'update_task_status', 'manage_notifications'] },
  { id: 'investor', name: 'Investor', description: 'External investor', permissions: ['view_dashboard', 'view_investors', 'view_reports'] },
  { id: 'marketing_company', name: 'Marketing Company', description: 'External partner', permissions: ['view_dashboard', 'view_company', 'view_reports'] }
];

const seedDepartments = [
  { id: 'dept-management', name: 'Management', companyId: 'company-ab', managerId: null },
  { id: 'dept-regional', name: 'Regional Management', companyId: 'company-ab', managerId: null },
  { id: 'dept-pr', name: 'Public Relations', companyId: 'company-ab', managerId: null },
  { id: 'dept-hr', name: 'Human Resources', companyId: 'company-ab', managerId: null },
  { id: 'dept-finance', name: 'Finance', companyId: 'company-ab', managerId: null },
  { id: 'dept-operations', name: 'Operations', companyId: 'company-ab', managerId: null },
  { id: 'dept-marketing', name: 'Marketing', companyId: 'company-ab', managerId: null },
  { id: 'dept-investor', name: 'Investor Management', companyId: 'company-ab', managerId: null },
  { id: 'dept-external', name: 'External Partners', companyId: 'company-ab', managerId: null },
  { id: 'dept-customer', name: 'Customer Service', companyId: 'company-ab', managerId: null }
];

const seedCompany = {
  id: 'company-ab',
  name: 'AB Group',
  companyType: 'Holding / Corporate Group',
  industry: 'Transportation / Logistics / Operations',
  city: 'Riyadh',
  country: 'Saudi Arabia',
  status: 'Active',
  email: 'info@abgroup.local',
  phone: '+966500000000'
};

const seedUsers = [
  { id: 'u-owner', fullName: 'Ahmed Alhaj', username: 'owner', email: 'owner@abgroup.local', phone: '966500000001', password: 'Owner@12345', roleId: 'owner', departmentId: 'dept-management', companyId: 'company-ab', status: 'Active', language: 'ar', managerId: null },
  { id: 'u-gm', fullName: 'Khalid Ahmed', username: 'gm', email: 'gm@abgroup.local', phone: '966500000002', password: 'Gm@12345', roleId: 'general_manager', departmentId: 'dept-management', companyId: 'company-ab', status: 'Active', language: 'ar', managerId: 'u-owner' },
  { id: 'u-region', fullName: 'Samir Hassan', username: 'region_manager', email: 'region1@abgroup.local', phone: '966500000003', password: 'Region@12345', roleId: 'regional_manager', departmentId: 'dept-regional', companyId: 'company-ab', status: 'Active', language: 'ar', managerId: 'u-gm' },
  { id: 'u-hr', fullName: 'Nora Alsaeed', username: 'hr_manager', email: 'hr@abgroup.local', phone: '966500000004', password: 'Hr@12345', roleId: 'hr_manager', departmentId: 'dept-hr', companyId: 'company-ab', status: 'Active', language: 'ar', managerId: 'u-gm' },
  { id: 'u-pr', fullName: 'Omar Younis', username: 'pr_manager', email: 'pr@abgroup.local', phone: '966500000005', password: 'Pr@12345', roleId: 'pr_manager', departmentId: 'dept-pr', companyId: 'company-ab', status: 'Active', language: 'ar', managerId: 'u-gm' },
  { id: 'u-marketing', fullName: 'Faisal Hadi', username: 'marketing_manager', email: 'marketing@abgroup.local', phone: '966500000006', password: 'Mkt@12345', roleId: 'marketing_manager', departmentId: 'dept-marketing', companyId: 'company-ab', status: 'Active', language: 'ar', managerId: 'u-gm' },
  { id: 'u-finance', fullName: 'Ali Mustafa', username: 'finance_manager', email: 'finance@abgroup.local', phone: '966500000007', password: 'Fin@12345', roleId: 'finance_manager', departmentId: 'dept-finance', companyId: 'company-ab', status: 'Active', language: 'ar', managerId: 'u-gm' },
  { id: 'u-employee', fullName: 'Hassan Saleh', username: 'employee1', email: 'employee1@abgroup.local', phone: '966500000008', password: 'Emp@12345', roleId: 'employee', departmentId: 'dept-operations', companyId: 'company-ab', status: 'Active', language: 'ar', managerId: 'u-region' },
  { id: 'u-investor', fullName: 'Investor Trial', username: 'investor1', email: 'investor1@abgroup.local', phone: '966500000009', password: 'Inv@12345', roleId: 'investor', departmentId: 'dept-investor', companyId: 'company-ab', status: 'Active', language: 'ar', managerId: null },
  { id: 'u-partner', fullName: 'Marketing Company Trial', username: 'marketing_company', email: 'marketingcompany@abgroup.local', phone: '966500000010', password: 'MCompany@12345', roleId: 'marketing_company', departmentId: 'dept-external', companyId: 'company-ab', status: 'Active', language: 'ar', managerId: null }
];

const initialState = {
  users: seedUsers,
  roles: seedRoles,
  departments: seedDepartments,
  companies: [seedCompany],
  currentPage: 'dashboard',
  currentUser: null,
  notificationList: [
    { id: 1, text: 'Owner account ready', type: 'info' },
    { id: 2, text: 'User management enabled', type: 'success' },
    { id: 3, text: 'Role permissions assigned', type: 'warning' }
  ],
  tasks: [
    { id: 't1', title: 'Review monthly report', assignee: 'Khalid Ahmed', status: 'In Progress', priority: 'High' },
    { id: 't2', title: 'Create HR onboarding form', assignee: 'Nora Alsaeed', status: 'Pending', priority: 'Medium' },
    { id: 't3', title: 'Regional follow-up call', assignee: 'Samir Hassan', status: 'Pending', priority: 'High' },
    { id: 't4', title: 'Company profile review', assignee: 'Ahmed Alhaj', status: 'Completed', priority: 'Low' }
  ]
};

const app = {
  state: loadState(),
  currentUser: null,
  ui: { showPassword: false }
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : initialState;
  } catch {
    return initialState;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(app.state));
}

function isUserAllowed(user, permission) {
  if (!user) return false;
  const role = app.state.roles.find(r => r.id === user.roleId);
  if (!role) return false;
  return role.permissions.includes(permission);
}

function getRoleName(roleId) {
  const role = app.state.roles.find(r => r.id === roleId);
  return role ? role.name : 'Unknown';
}

function getDepartmentName(deptId) {
  const dept = app.state.departments.find(d => d.id === deptId);
  return dept ? dept.name : 'Unassigned';
}

function getUserById(id) {
  return app.state.users.find(u => u.id === id);
}

function getCurrentUser() {
  return app.state.currentUser || null;
}

function setCurrentUser(user) {
  app.state.currentUser = user;
  saveState();
}

function getSidebarItems(user) {
  const allItems = [
    { id: 'dashboard', label: 'Dashboard', permission: 'view_dashboard' },
    { id: 'users', label: 'Users', permission: 'view_users' },
    { id: 'roles', label: 'Roles', permission: 'view_dashboard' },
    { id: 'departments', label: 'Departments', permission: 'view_company' },
    { id: 'companies', label: 'Companies', permission: 'view_company' },
    { id: 'tasks', label: 'Tasks', permission: 'view_tasks' },
    { id: 'reports', label: 'Reports', permission: 'view_reports' },
    { id: 'notifications', label: 'Notifications', permission: 'manage_notifications' }
  ];

  if (!user) return [];
  return allItems.filter(item => isUserAllowed(user, item.permission) || item.id === 'dashboard');
}

function render() {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    renderLogin();
    return;
  }

  const sidebarItems = getSidebarItems(currentUser);
  const appEl = document.getElementById('app');
  appEl.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="sidebar-logo">
          <div class="sidebar-logo-badge">AB</div>
          <div>
            <h3>AB Group</h3>
          </div>
        </div>

        <nav class="sidebar-nav">
          ${sidebarItems.map(item => `
            <button class="nav-item ${app.state.currentPage === item.id ? 'active' : ''}" data-page="${item.id}">
              ${item.label}
            </button>
          `).join('')}
        </nav>

        <div class="sidebar-footer">
          <button class="nav-item" data-action="logout">Logout</button>
        </div>
      </aside>

      <main class="main">
        <header class="topbar">
          <h1>${pageTitle(app.state.currentPage)}</h1>
          <div class="user-pill">
            <div class="avatar">${currentUser.fullName.slice(0,1).toUpperCase()}</div>
            <div>
              <div>${currentUser.fullName}</div>
              <div class="muted">${getRoleName(currentUser.roleId)}</div>
            </div>
          </div>
        </header>

        ${renderCurrentPage()}
      </main>
    </div>
  `;

  bindGlobalEvents();
}

function pageTitle(page) {
  const titles = {
    dashboard: 'Dashboard',
    users: 'User Management',
    roles: 'Roles',
    departments: 'Departments',
    companies: 'Companies',
    tasks: 'Tasks',
    reports: 'Reports',
    notifications: 'Notifications'
  };
  return titles[page] || 'Dashboard';
}

function renderCurrentPage() {
  const user = getCurrentUser();
  const page = app.state.currentPage;

  if (page === 'dashboard') return renderDashboard(user);
  if (page === 'users') return renderUsers(user);
  if (page === 'roles') return renderRoles(user);
  if (page === 'departments') return renderDepartments(user);
  if (page === 'companies') return renderCompanies(user);
  if (page === 'tasks') return renderTasks(user);
  if (page === 'reports') return renderReports(user);
  if (page === 'notifications') return renderNotifications(user);
  return renderDashboard(user);
}

function renderDashboard(user) {
  const totalUsers = app.state.users.length;
  const activeUsers = app.state.users.filter(u => u.status === 'Active').length;
  const departments = app.state.departments.length;
  const companies = app.state.companies.length;
  const tasks = app.state.tasks.length;

  return `
    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-label">Users</span>
        <p class="stat-value">${totalUsers}</p>
        <div class="stat-foot">+ 3 this month</div>
      </div>
      <div class="stat-card">
        <span class="stat-label">Active Accounts</span>
        <p class="stat-value">${activeUsers}</p>
        <div class="stat-foot">Healthy</div>
      </div>
      <div class="stat-card">
        <span class="stat-label">Departments</span>
        <p class="stat-value">${departments}</p>
        <div class="stat-foot">${departments} configured</div>
      </div>
      <div class="stat-card">
        <span class="stat-label">Open Tasks</span>
        <p class="stat-value">${tasks}</p>
        <div class="stat-foot">2 urgent</div>
      </div>
    </div>

    <section class="content-panel">
      <div class="section-head">
        <h2>Recent activity</h2>
        <button class="secondary-btn" data-action="quick-task">New task</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Task</th>
              <th>Assignee</th>
              <th>Status</th>
              <th>Priority</th>
            </tr>
          </thead>
          <tbody>
            ${app.state.tasks.map(task => `
              <tr>
                <td>${task.title}</td>
                <td>${task.assignee}</td>
                <td><span class="badge ${task.status === 'Completed' ? 'active' : task.status === 'Pending' ? 'pending' : 'disabled'}">${task.status}</span></td>
                <td>${task.priority}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderUsers(user) {
  const canCreateUser = isUserAllowed(user, 'create_user') || user.roleId === 'owner';
  const canEditUser = isUserAllowed(user, 'edit_user') || user.roleId === 'owner';

  return `
    <section class="content-panel">
      <div class="section-head">
        <h2>User Management</h2>
        ${canCreateUser ? '<button class="secondary-btn" data-action="open-user-form">Add user</button>' : ''}
      </div>

      ${canCreateUser ? `
        <form id="user-form" style="margin-bottom: 20px;">
          <div class="form-grid">
            <div>
              <label>Full name</label>
              <input class="input" name="fullName" placeholder="Full name" required />
            </div>
            <div>
              <label>Username</label>
              <input class="input" name="username" placeholder="username" required />
            </div>
            <div>
              <label>Email</label>
              <input class="input" name="email" type="email" placeholder="email@example.com" required />
            </div>
            <div>
              <label>Phone</label>
              <input class="input" name="phone" placeholder="Phone" />
            </div>
            <div>
              <label>Password</label>
              <input class="input" name="password" type="password" placeholder="Password" required />
            </div>
            <div>
              <label>Role</label>
              <select class="input" name="roleId">
                ${app.state.roles.map(role => `<option value="${role.id}">${role.name}</option>`).join('')}
              </select>
            </div>
            <div>
              <label>Department</label>
              <select class="input" name="departmentId">
                ${app.state.departments.map(dept => `<option value="${dept.id}">${dept.name}</option>`).join('')}
              </select>
            </div>
            <div>
              <label>Status</label>
              <select class="input" name="status">
                <option value="Active">Active</option>
                <option value="Pending">Pending</option>
                <option value="Disabled">Disabled</option>
              </select>
            </div>
            <div class="full">
              <button type="submit" class="primary-btn">Create user</button>
            </div>
          </div>
        </form>
      ` : ''}

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Department</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${app.state.users.map(userRow => `
              <tr>
                <td>
                  <strong>${userRow.fullName}</strong><br>
                  <span class="muted">${userRow.email}</span>
                </td>
                <td>${getRoleName(userRow.roleId)}</td>
                <td>${getDepartmentName(userRow.departmentId)}</td>
                <td><span class="badge ${userRow.status === 'Active' ? 'active' : userRow.status === 'Pending' ? 'pending' : 'disabled'}">${userRow.status}</span></td>
                <td>
                  <div class="row-actions">
                    ${canEditUser ? `<button class="ghost-btn" data-action="toggle-status" data-user-id="${userRow.id}">${userRow.status === 'Active' ? 'Disable' : 'Enable'}</button>` : ''}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderRoles(user) {
  return `
    <section class="content-panel">
      <div class="section-head">
        <h2>Roles</h2>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Role</th>
              <th>Description</th>
              <th>Permissions</th>
            </tr>
          </thead>
          <tbody>
            ${app.state.roles.map(role => `
              <tr>
                <td>${role.name}</td>
                <td>${role.description}</td>
                <td>${role.permissions.slice(0, 3).join(', ')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderDepartments(user) {
  return `
    <section class="content-panel">
      <div class="section-head">
        <h2>Departments</h2>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Department</th>
              <th>Company</th>
              <th>Manager</th>
            </tr>
          </thead>
          <tbody>
            ${app.state.departments.map(dept => {
              const manager = getUserById(dept.managerId);
              return `
                <tr>
                  <td>${dept.name}</td>
                  <td>${app.state.companies[0].name}</td>
                  <td>${manager ? manager.fullName : 'Unassigned'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderCompanies(user) {
  return `
    <section class="content-panel">
      <div class="section-head">
        <h2>Companies</h2>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>City</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${app.state.companies.map(company => `
              <tr>
                <td>${company.name}</td>
                <td>${company.companyType}</td>
                <td>${company.city}</td>
                <td><span class="badge active">${company.status}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderTasks(user) {
  return `
    <section class="content-panel">
      <div class="section-head">
        <h2>Tasks</h2>
        <button class="secondary-btn" data-action="quick-task">Add task</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Assignee</th>
              <th>Status</th>
              <th>Priority</th>
            </tr>
          </thead>
          <tbody>
            ${app.state.tasks.map(task => `
              <tr>
                <td>${task.title}</td>
                <td>${task.assignee}</td>
                <td><span class="badge ${task.status === 'Completed' ? 'active' : task.status === 'Pending' ? 'pending' : 'disabled'}">${task.status}</span></td>
                <td>${task.priority}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderReports(user) {
  return `
    <section class="content-panel">
      <div class="section-head">
        <h2>Reports</h2>
      </div>
      <div class="empty-state">
        Reports view is ready for the next phase. This demo currently includes dashboards and core user access flows.
      </div>
    </section>
  `;
}

function renderNotifications(user) {
  return `
    <section class="content-panel">
      <div class="section-head">
        <h2>Notifications</h2>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Message</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            ${app.state.notificationList.map(item => `
              <tr>
                <td>${item.text}</td>
                <td>${item.type}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderLogin() {
  const appEl = document.getElementById('app');
  const demoAccounts = [
    { username: 'owner', password: 'Owner@12345', label: 'Owner' },
    { username: 'gm', password: 'Gm@12345', label: 'General Manager' },
    { username: 'region_manager', password: 'Region@12345', label: 'Regional Manager' },
    { username: 'employee1', password: 'Emp@12345', label: 'Employee' },
    { username: 'investor1', password: 'Inv@12345', label: 'Investor' }
  ];

  appEl.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="login-visual">
          <div class="brand-block">
            <div class="brand-mark"><span>AB</span></div>
            <h1 class="brand-title">AB Group</h1>
            <div class="brand-sub">Administrative, Financial and Operational Management System</div>
          </div>
          <ul class="login-feature-list">
            <li>Unified system structure</li>
            <li>Role-based access</li>
            <li>Manager and user management</li>
            <li>Department and company structure</li>
          </ul>
        </div>

        <div class="login-form-wrap">
          <div class="login-head">
            <h2>Login</h2>
            <div class="lang-badge">AR / EN</div>
          </div>

          <form id="login-form">
            <div class="form-group">
              <label>Username</label>
              <input id="username" class="input" name="username" placeholder="Enter username" required />
            </div>

            <div class="form-group">
              <label>Password</label>
              <div class="password-wrap">
                <input id="password" class="input" name="password" type="${app.ui.showPassword ? 'text' : 'password'}" placeholder="Enter password" required />
                <button type="button" id="toggle-password">${app.ui.showPassword ? 'Hide' : 'Show'}</button>
              </div>
            </div>

            <button class="primary-btn" type="submit">Sign in</button>
            <div id="login-error" class="error-box"></div>
          </form>

          <div class="demo-box">
            <h4>Demo access</h4>
            <div class="demo-users">
              ${demoAccounts.map(acc => `
                <button class="demo-user-button" data-demo-user="${acc.username}" data-demo-pass="${acc.password}">${acc.label}</button>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const form = document.getElementById('login-form');
  form.addEventListener('submit', handleLogin);

  document.getElementById('toggle-password').addEventListener('click', () => {
    app.ui.showPassword = !app.ui.showPassword;
    renderLogin();
  });

  document.querySelectorAll('[data-demo-user]').forEach(button => {
    button.addEventListener('click', () => {
      const username = button.dataset.demoUser;
      const password = button.dataset.demoPass;
      document.getElementById('username').value = username;
      document.getElementById('password').value = password;
      handleLogin({ preventDefault: () => {} });
    });
  });
}

function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const user = app.state.users.find(u => u.username === username);
  const errBox = document.getElementById('login-error');

  if (!user || user.password !== password) {
    errBox.textContent = 'Incorrect username or password.';
    errBox.classList.add('visible');
    return;
  }

  if (user.status !== 'Active') {
    errBox.textContent = 'This account is inactive.';
    errBox.classList.add('visible');
    return;
  }

  errBox.classList.remove('visible');
  setCurrentUser(user);
  app.state.currentPage = 'dashboard';
  render();
}

function bindGlobalEvents() {
  document.querySelectorAll('[data-page]').forEach(button => {
    button.addEventListener('click', () => {
      const page = button.dataset.page;
      app.state.currentPage = page;
      saveState();
      render();
    });
  });

  document.querySelectorAll('[data-action="logout"]').forEach(button => {
    button.addEventListener('click', () => {
      setCurrentUser(null);
      app.state.currentPage = 'dashboard';
      render();
    });
  });

  document.querySelectorAll('[data-action="quick-task"]').forEach(button => {
    button.addEventListener('click', () => {
      const title = prompt('Task title');
      if (!title) return;
      app.state.tasks.unshift({
        id: `t${Date.now()}`,
        title,
        assignee: getCurrentUser().fullName,
        status: 'Pending',
        priority: 'Medium'
      });
      saveState();
      render();
    });
  });

  document.querySelectorAll('[data-action="toggle-status"]').forEach(button => {
    button.addEventListener('click', () => {
      const userId = button.dataset.userId;
      const target = app.state.users.find(u => u.id === userId);
      if (!target) return;
      target.status = target.status === 'Active' ? 'Disabled' : 'Active';
      saveState();
      render();
    });
  });

  const userForm = document.getElementById('user-form');
  if (userForm) {
    userForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const fd = new FormData(userForm);
      const newUser = {
        id: `u-${Date.now()}`,
        fullName: fd.get('fullName'),
        username: fd.get('username'),
        email: fd.get('email'),
        phone: fd.get('phone') || '',
        password: fd.get('password'),
        roleId: fd.get('roleId'),
        departmentId: fd.get('departmentId'),
        companyId: 'company-ab',
        status: fd.get('status'),
        language: 'ar',
        managerId: null
      };

      app.state.users.push(newUser);
      saveState();
      render();
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    app.state = JSON.parse(saved);
  }
  render();
});
