const STORAGE_KEY = 'ab_group_demo_state_v3';
const LOCALE_KEY = 'ab_group_demo_locale';

const translations = {
  ar: {
    appName: 'AB Group',
    loginTitle: 'تسجيل الدخول',
    username: 'اسم المستخدم',
    password: 'كلمة المرور',
    show: 'إظهار',
    hide: 'إخفاء',
    signIn: 'تسجيل الدخول',
    demoAccess: 'الحسابات التجريبية',
    owner: 'مالك النظام',
    gm: 'المدير العام',
    regionManager: 'مدير المنطقة',
    employee: 'موظف',
    investor: 'مستثمر',
    loginError: 'اسم المستخدم أو كلمة المرور غير صحيحة.',
    inactiveError: 'هذا الحساب غير نشط.',
    dashboard: 'لوحة التحكم',
    userManagement: 'إدارة المستخدمين',
    roles: 'الأدوار',
    departments: 'الأقسام',
    companies: 'الشركات والكيانات',
    tasks: 'المهام',
    reports: 'التقارير',
    notifications: 'الإشعارات',
    logout: 'تسجيل الخروج',
    users: 'المستخدمون',
    addUser: 'إضافة مستخدم',
    addCompany: 'إضافة شركة',
    fullName: 'الاسم الكامل',
    phone: 'رقم الهاتف',
    status: 'الحالة',
    role: 'الدور',
    department: 'القسم',
    createUser: 'إنشاء مستخدم',
    recentActivity: 'النشاط الأخير',
    task: 'المهمة',
    assignee: 'المسؤول',
    priority: 'الأولوية',
    active: 'نشط',
    inactive: 'غير نشط',
    pending: 'قيد الانتظار',
    suspended: 'موقوف مؤقتاً',
    disabled: 'معطل',
    enable: 'تفعيل',
    disable: 'تعطيل',
    message: 'الرسالة',
    type: 'النوع',
    ownerAccountReady: 'حساب المالك جاهز',
    userManagementEnabled: 'إدارة المستخدمين مفعلة',
    rolePermissionsAssigned: 'تم تعيين صلاحيات الأدوار',
    noReports: 'واجهة التقارير جاهزة للمرحلة التالية. النسخة الحالية تشمل لوحات التحكم وتدفق المستخدمين.',
    sideFeatures: 'هيكل نظام موحد',
    feature2: 'صلاحيات حسب الدور',
    feature3: 'إدارة المديرين والموظفين',
    feature4: 'هيكل الأقسام والشركات',
    readMore: 'المزيد',
    english: 'English',
    arabic: 'العربية',
    switchLanguage: 'تبديل اللغة',
    welcome: 'مرحباً',
    screenTitle: 'لوحة إدارة AB Group',
    openTasks: 'المهام المفتوحة',
    activeAccounts: 'الحسابات النشطة',
    departmentsCount: 'الأقسام',
    usersCount: 'المستخدمون',
    thisMonth: 'هذا الشهر',
    companyManagement: 'إدارة الشركات والكيانات القانونية',
    companyCode: 'كود الشركة',
    companyArabicName: 'الاسم التجاري بالعربية',
    companyEnglishName: 'الاسم التجاري بالإنجليزية',
    shortName: 'الاسم المختصر',
    companyLogo: 'شعار الشركة',
    legalLicense: 'بيانات الرخصة التجارية',
    tradeLicenseNumber: 'رقم الرخصة التجارية',
    issuingAuthority: 'جهة إصدار الرخصة',
    emirate: 'الإمارة',
    issueDate: 'تاريخ الإصدار',
    expiryDate: 'تاريخ الانتهاء',
    legalType: 'نوع الرخصة / الشكل القانوني',
    businessActivities: 'الأنشطة التجارية المرخصة',
    contactDetails: 'بيانات التواصل والموقع',
    companyAddress: 'عنوان الشركة',
    region: 'المنطقة',
    street: 'الشارع والمبنى',
    email: 'البريد الإلكتروني',
    website: 'الموقع الإلكتروني',
    taxNumber: 'الرقم الضريبي (TRN)',
    entityNumber: 'رقم المنشأة',
    establishmentDate: 'تاريخ التأسيس',
    responsiblePerson: 'اسم الشخص المسؤول',
    notes: 'ملاحظات إدارية',
    documents: 'المستندات والوثائق',
    uploadLogo: 'رفع شعار',
    optional: 'اختياري',
    filterSearch: 'بحث باسم الشركة أو الكود أو الإمارة',
    allStatuses: 'كل الحالات',
    allEmirates: 'كل الإمارات',
    createCompany: 'إضافة شركة جديدة',
    companyTableCode: 'الكود',
    companyTableArabic: 'الاسم العربي',
    companyTableEnglish: 'الاسم الإنجليزي',
    companyTableLicense: 'رقم الرخصة',
    companyTableEmirate: 'الإمارة',
    companyTableExpiry: 'تاريخ الانتهاء',
    companyTableStatus: 'الحالة',
    companyTableActions: 'الإجراءات',
    legalEntitiesDesc: 'سجل مركزي لجميع الشركات التابعة للمجموعة، مع الحفاظ على استقلالية كل كيان قانوني.',
    companySaved: 'تم حفظ الشركة بنجاح.',
    companyStatusUpdated: 'تم تحديث حالة الشركة.',
    search: 'بحث',
    clear: 'مسح',
    documentsHint: 'يمكن رفع مستندات الرخصة والتأسيس والضرائب.'
  },
  en: {
    appName: 'AB Group',
    loginTitle: 'Login',
    username: 'Username',
    password: 'Password',
    show: 'Show',
    hide: 'Hide',
    signIn: 'Sign in',
    demoAccess: 'Demo accounts',
    owner: 'Owner',
    gm: 'General Manager',
    regionManager: 'Regional Manager',
    employee: 'Employee',
    investor: 'Investor',
    loginError: 'Incorrect username or password.',
    inactiveError: 'This account is inactive.',
    dashboard: 'Dashboard',
    userManagement: 'User Management',
    roles: 'Roles',
    departments: 'Departments',
    companies: 'Companies & Legal Entities',
    tasks: 'Tasks',
    reports: 'Reports',
    notifications: 'Notifications',
    logout: 'Logout',
    users: 'Users',
    addUser: 'Add user',
    addCompany: 'Add company',
    fullName: 'Full name',
    phone: 'Phone',
    status: 'Status',
    role: 'Role',
    department: 'Department',
    createUser: 'Create user',
    recentActivity: 'Recent activity',
    task: 'Task',
    assignee: 'Assignee',
    priority: 'Priority',
    active: 'Active',
    inactive: 'Inactive',
    pending: 'Pending',
    suspended: 'Suspended',
    disabled: 'Disabled',
    enable: 'Enable',
    disable: 'Disable',
    message: 'Message',
    type: 'Type',
    ownerAccountReady: 'Owner account ready',
    userManagementEnabled: 'User management enabled',
    rolePermissionsAssigned: 'Role permissions assigned',
    noReports: 'Reports screen is ready for the next phase. The current version includes dashboard and user flow screens.',
    sideFeatures: 'Unified system structure',
    feature2: 'Role-based access',
    feature3: 'Manager and staff management',
    feature4: 'Department and company structure',
    readMore: 'Read more',
    english: 'English',
    arabic: 'العربية',
    switchLanguage: 'Switch language',
    welcome: 'Welcome',
    screenTitle: 'AB Group Control Panel',
    openTasks: 'Open tasks',
    activeAccounts: 'Active accounts',
    departmentsCount: 'Departments',
    usersCount: 'Users',
    thisMonth: 'this month',
    companyManagement: 'Companies & Legal Entities Management',
    companyCode: 'Company Code',
    companyArabicName: 'Arabic Trade Name',
    companyEnglishName: 'English Trade Name',
    shortName: 'Short Name',
    companyLogo: 'Company Logo',
    legalLicense: 'Trade License Details',
    tradeLicenseNumber: 'Trade License Number',
    issuingAuthority: 'Issuing Authority',
    emirate: 'Emirate',
    issueDate: 'Issue Date',
    expiryDate: 'Expiry Date',
    legalType: 'License Type / Legal Form',
    businessActivities: 'Licensed Business Activities',
    contactDetails: 'Contact & Location Details',
    companyAddress: 'Company Address',
    region: 'Region',
    street: 'Street / Building',
    email: 'Email',
    website: 'Website',
    taxNumber: 'Tax Number (TRN)',
    entityNumber: 'Entity Number',
    establishmentDate: 'Establishment Date',
    responsiblePerson: 'Responsible Person',
    notes: 'Administrative Notes',
    documents: 'Documents & Files',
    uploadLogo: 'Upload Logo',
    optional: 'Optional',
    filterSearch: 'Search by company name, code or emirate',
    allStatuses: 'All statuses',
    allEmirates: 'All emirates',
    createCompany: 'Create new company',
    companyTableCode: 'Code',
    companyTableArabic: 'Arabic Name',
    companyTableEnglish: 'English Name',
    companyTableLicense: 'License No.',
    companyTableEmirate: 'Emirate',
    companyTableExpiry: 'Expiry',
    companyTableStatus: 'Status',
    companyTableActions: 'Actions',
    legalEntitiesDesc: 'Central registry for all companies within the group while preserving entity-level legal independence.',
    companySaved: 'Company saved successfully.',
    companyStatusUpdated: 'Company status updated.',
    search: 'Search',
    clear: 'Clear',
    documentsHint: 'You can upload trade license, tax, and legal documents.'
  }
};

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
  companyCode: 'AB',
  arabicName: 'مجموعة AB',
  englishName: 'AB Group',
  shortName: 'AB',
  logo: 'assets/logo.svg',
  status: 'Active',
  tradeLicenseNumber: 'TRD-AB-001',
  issuingAuthority: 'Department of Economic Development',
  emirate: 'Dubai',
  issueDate: '2020-01-15',
  expiryDate: '2035-01-15',
  legalType: 'Holding Company',
  businessActivities: 'Management, investment, logistics and operations',
  address: 'Business Bay',
  region: 'Dubai',
  street: 'Al Khail Road',
  phone: '+971000000000',
  email: 'info@abgroup.local',
  website: 'https://abgroup.local',
  taxNumber: 'TRN-AB-1000',
  entityNumber: 'ENT-001',
  establishmentDate: '2015-05-12',
  responsiblePerson: 'Ahmed Alhaj',
  notes: 'Main holding entity for the group.',
  documents: ['Trade License', 'Tax Registration'],
  createdAt: '2020-01-15'
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
  companyFilters: { query: '', status: 'all', emirate: 'all' },
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
  ui: { showPassword: false }
};

function getLocale() {
  const stored = localStorage.getItem(LOCALE_KEY);
  return stored || 'ar';
}

function setLocale(locale) {
  localStorage.setItem(LOCALE_KEY, locale);
  document.body.dir = locale === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = locale;
  document.body.setAttribute('data-locale', locale);
  render();
}

function localeText(key) {
  const locale = getLocale();
  return translations[locale][key] || translations.en[key] || key;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('ab_group_demo_state_v2');
    const parsed = raw ? JSON.parse(raw) : initialState;
    if (!parsed.companyFilters) {
      parsed.companyFilters = { query: '', status: 'all', emirate: 'all' };
    }
    parsed.companies = parsed.companies.map(company => ({
      ...company,
      companyCode: company.companyCode ?? company.id,
      arabicName: company.arabicName ?? company.name ?? '',
      englishName: company.englishName ?? company.name ?? '',
      shortName: company.shortName ?? company.name ?? '',
      emirate: company.emirate ?? company.city ?? '',
      tradeLicenseNumber: company.tradeLicenseNumber ?? ''
    }));
    const locale = getLocale();
    if (parsed.currentUser && parsed.currentUser.password) {
      parsed.currentUser.language = locale;
    }
    return parsed;
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
  if (user.roleId === 'owner') return true;
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
    { id: 'dashboard', label: localeText('dashboard'), permission: 'view_dashboard' },
    { id: 'users', label: localeText('users'), permission: 'view_users' },
    { id: 'roles', label: localeText('roles'), permission: 'view_dashboard' },
    { id: 'departments', label: localeText('departments'), permission: 'view_company' },
    { id: 'companies', label: localeText('companies'), permission: 'view_company' },
    { id: 'tasks', label: localeText('tasks'), permission: 'view_tasks' },
    { id: 'reports', label: localeText('reports'), permission: 'view_reports' },
    { id: 'notifications', label: localeText('notifications'), permission: 'manage_notifications' }
  ];

  if (!user) return [];

  if (user.roleId === 'owner' || user.roleId === 'general_manager' || user.roleId === 'hr_manager') {
    return allItems;
  }

  if (user.roleId === 'regional_manager' || user.roleId === 'employee') {
    return allItems.filter(item => ['dashboard', 'tasks', 'notifications'].includes(item.id));
  }

  if (user.roleId === 'investor' || user.roleId === 'marketing_company') {
    return allItems.filter(item => ['dashboard', 'reports'].includes(item.id));
  }

  return allItems.filter(item => isUserAllowed(user, item.permission));
}

function render() {
  const currentUser = getCurrentUser();
  document.body.dir = getLocale() === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = getLocale();
  document.body.setAttribute('data-locale', getLocale());

  const appEl = document.getElementById('app');

  if (!currentUser) {
    renderLogin();
    return;
  }

  const sidebarItems = getSidebarItems(currentUser);
  appEl.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="sidebar-logo">
          <div class="sidebar-logo-badge">
            <img src="assets/logo.svg" alt="AB Group logo" />
          </div>
          <div>
            <h3>${localeText('appName')}</h3>
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
          <button class="nav-item" data-action="logout">${localeText('logout')}</button>
        </div>
      </aside>

      <main class="main">
        <header class="topbar">
          <h1>${pageTitle(app.state.currentPage)}</h1>
          <div class="user-controls">
            <button class="lang-switch" data-action="toggle-language">
              ${getLocale() === 'ar' ? 'English' : 'العربية'}
            </button>
            <div class="user-pill">
              <div class="avatar">${currentUser.fullName.slice(0,1).toUpperCase()}</div>
              <div>
                <div>${currentUser.fullName}</div>
                <div class="muted">${getRoleName(currentUser.roleId)}</div>
              </div>
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
    dashboard: localeText('dashboard'),
    users: localeText('userManagement'),
    roles: localeText('roles'),
    departments: localeText('departments'),
    companies: localeText('companyManagement'),
    tasks: localeText('tasks'),
    reports: localeText('reports'),
    notifications: localeText('notifications')
  };
  return titles[page] || localeText('dashboard');
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
        <span class="stat-label">${localeText('usersCount')}</span>
        <p class="stat-value">${totalUsers}</p>
        <div class="stat-foot">+ 3 ${localeText('thisMonth')}</div>
      </div>
      <div class="stat-card">
        <span class="stat-label">${localeText('activeAccounts')}</span>
        <p class="stat-value">${activeUsers}</p>
        <div class="stat-foot">Healthy</div>
      </div>
      <div class="stat-card">
        <span class="stat-label">${localeText('departmentsCount')}</span>
        <p class="stat-value">${departments}</p>
        <div class="stat-foot">${departments} configured</div>
      </div>
      <div class="stat-card">
        <span class="stat-label">${localeText('openTasks')}</span>
        <p class="stat-value">${tasks}</p>
        <div class="stat-foot">2 urgent</div>
      </div>
    </div>

    <section class="content-panel">
      <div class="section-head">
        <h2>${localeText('recentActivity')}</h2>
        <button class="secondary-btn" data-action="quick-task">${localeText('addUser')}</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>${localeText('task')}</th>
              <th>${localeText('assignee')}</th>
              <th>${localeText('status')}</th>
              <th>${localeText('priority')}</th>
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
        <h2>${localeText('userManagement')}</h2>
        ${canCreateUser ? `<button class="secondary-btn" data-action="open-user-form">${localeText('addUser')}</button>` : ''}
      </div>

      ${canCreateUser ? `
        <form id="user-form" style="margin-bottom: 20px;">
          <div class="form-grid">
            <div>
              <label>${localeText('fullName')}</label>
              <input class="input" name="fullName" placeholder="${localeText('fullName')}" required />
            </div>
            <div>
              <label>${localeText('username')}</label>
              <input class="input" name="username" placeholder="${localeText('username')}" required />
            </div>
            <div>
              <label>Email</label>
              <input class="input" name="email" type="email" placeholder="email@example.com" required />
            </div>
            <div>
              <label>${localeText('phone')}</label>
              <input class="input" name="phone" placeholder="${localeText('phone')}" />
            </div>
            <div>
              <label>${localeText('password')}</label>
              <input class="input" name="password" type="password" placeholder="${localeText('password')}" required />
            </div>
            <div>
              <label>${localeText('role')}</label>
              <select class="input" name="roleId">
                ${app.state.roles.map(role => `<option value="${role.id}">${role.name}</option>`).join('')}
              </select>
            </div>
            <div>
              <label>${localeText('department')}</label>
              <select class="input" name="departmentId">
                ${app.state.departments.map(dept => `<option value="${dept.id}">${dept.name}</option>`).join('')}
              </select>
            </div>
            <div>
              <label>${localeText('status')}</label>
              <select class="input" name="status">
                <option value="Active">${localeText('active')}</option>
                <option value="Pending">${localeText('pending')}</option>
                <option value="Disabled">${localeText('disabled')}</option>
              </select>
            </div>
            <div class="full">
              <button type="submit" class="primary-btn">${localeText('createUser')}</button>
            </div>
          </div>
        </form>
      ` : ''}

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>${localeText('users')}</th>
              <th>${localeText('role')}</th>
              <th>${localeText('department')}</th>
              <th>${localeText('status')}</th>
              <th>${localeText('type')}</th>
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
                    ${canEditUser ? `<button class="ghost-btn" data-action="toggle-status" data-user-id="${userRow.id}">${userRow.status === 'Active' ? localeText('disable') : localeText('enable')}</button>` : ''}
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

function renderRoles() {
  return `
    <section class="content-panel">
      <div class="section-head"><h2>${localeText('roles')}</h2></div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>${localeText('role')}</th>
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

function renderDepartments() {
  return `
    <section class="content-panel">
      <div class="section-head"><h2>${localeText('departments')}</h2></div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>${localeText('department')}</th>
              <th>${localeText('companies')}</th>
              <th>Manager</th>
            </tr>
          </thead>
          <tbody>
            ${app.state.departments.map(dept => {
              const manager = getUserById(dept.managerId);
              return `
                <tr>
                  <td>${dept.name}</td>
                  <td>${app.state.companies[0].name || app.state.companies[0].englishName}</td>
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
  const canManage = user.roleId === 'owner' || isUserAllowed(user, 'create_company') || isUserAllowed(user, 'edit_company');
  const filters = app.state.companyFilters || { query: '', status: 'all', emirate: 'all' };
  const companyRows = app.state.companies.filter((company) => {
    const query = filters.query.trim().toLowerCase();
    const matchesQuery = !query || [company.companyCode, company.arabicName, company.englishName, company.shortName, company.emirate].join(' ').toLowerCase().includes(query);
    const matchesStatus = filters.status === 'all' || company.status === filters.status;
    const matchesEmirate = filters.emirate === 'all' || company.emirate === filters.emirate;
    return matchesQuery && matchesStatus && matchesEmirate;
  });

  const emirates = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'];

  return `
    <section class="content-panel company-panel">
      <div class="section-head">
        <h2>${localeText('companyManagement')}</h2>
        ${canManage ? `<button class="secondary-btn" data-action="open-company-form">${localeText('addCompany')}</button>` : ''}
      </div>

      <div class="company-desc">${localeText('legalEntitiesDesc')}</div>

      ${canManage ? `
        <form id="company-form" class="company-form">
          <div class="form-grid">
            <div>
              <label>${localeText('companyArabicName')}</label>
              <input class="input" name="arabicName" required />
            </div>
            <div>
              <label>${localeText('companyEnglishName')}</label>
              <input class="input" name="englishName" required />
            </div>
            <div>
              <label>${localeText('companyCode')}</label>
              <input class="input" name="companyCode" required />
            </div>
            <div>
              <label>${localeText('shortName')}</label>
              <input class="input" name="shortName" />
            </div>
            <div>
              <label>${localeText('status')}</label>
              <select class="input" name="status">
                <option value="Active">${localeText('active')}</option>
                <option value="Inactive">${localeText('inactive')}</option>
                <option value="Suspended">${localeText('suspended')}</option>
              </select>
            </div>
            <div>
              <label>${localeText('companyLogo')}</label>
              <input class="input" type="file" name="logo" accept="image/*" />
            </div>

            <div class="full split-title">${localeText('legalLicense')}</div>
            <div>
              <label>${localeText('tradeLicenseNumber')}</label>
              <input class="input" name="tradeLicenseNumber" required />
            </div>
            <div>
              <label>${localeText('issuingAuthority')}</label>
              <input class="input" name="issuingAuthority" />
            </div>
            <div>
              <label>${localeText('emirate')}</label>
              <select class="input" name="emirate">
                ${emirates.map(v => `<option value="${v}">${v}</option>`).join('')}
              </select>
            </div>
            <div>
              <label>${localeText('issueDate')}</label>
              <input class="input" type="date" name="issueDate" />
            </div>
            <div>
              <label>${localeText('expiryDate')}</label>
              <input class="input" type="date" name="expiryDate" />
            </div>
            <div>
              <label>${localeText('legalType')}</label>
              <input class="input" name="legalType" />
            </div>
            <div class="full">
              <label>${localeText('businessActivities')}</label>
              <textarea class="input" name="businessActivities" rows="3"></textarea>
            </div>

            <div class="full split-title">${localeText('contactDetails')}</div>
            <div>
              <label>${localeText('companyAddress')}</label>
              <input class="input" name="address" />
            </div>
            <div>
              <label>${localeText('region')}</label>
              <input class="input" name="region" />
            </div>
            <div>
              <label>${localeText('street')}</label>
              <input class="input" name="street" />
            </div>
            <div>
              <label>${localeText('phone')}</label>
              <input class="input" name="phone" />
            </div>
            <div>
              <label>${localeText('email')}</label>
              <input class="input" type="email" name="email" />
            </div>
            <div>
              <label>${localeText('website')}</label>
              <input class="input" name="website" />
            </div>

            <div class="full split-title">${localeText('documents')}</div>
            <div>
              <label>${localeText('taxNumber')}</label>
              <input class="input" name="taxNumber" />
            </div>
            <div>
              <label>${localeText('entityNumber')}</label>
              <input class="input" name="entityNumber" />
            </div>
            <div>
              <label>${localeText('establishmentDate')}</label>
              <input class="input" type="date" name="establishmentDate" />
            </div>
            <div>
              <label>${localeText('responsiblePerson')}</label>
              <input class="input" name="responsiblePerson" />
            </div>
            <div class="full">
              <label>${localeText('notes')}</label>
              <textarea class="input" name="notes" rows="3"></textarea>
            </div>
            <div class="full">
              <label>${localeText('documentsHint')}</label>
              <input class="input" type="file" name="documents" multiple />
            </div>

            <div class="full controls-row">
              <button type="submit" class="primary-btn">${localeText('createCompany')}</button>
            </div>
          </div>
        </form>
      ` : ''}

      <div class="filter-row">
        <input id="company-search" class="input" placeholder="${localeText('filterSearch')}" value="${filters.query}" />
        <select id="company-status-filter" class="input">
          <option value="all">${localeText('allStatuses')}</option>
          <option value="Active" ${filters.status === 'Active' ? 'selected' : ''}>${localeText('active')}</option>
          <option value="Inactive" ${filters.status === 'Inactive' ? 'selected' : ''}>${localeText('inactive')}</option>
          <option value="Suspended" ${filters.status === 'Suspended' ? 'selected' : ''}>${localeText('suspended')}</option>
        </select>
        <select id="company-emirate-filter" class="input">
          <option value="all">${localeText('allEmirates')}</option>
          ${emirates.map(v => `<option value="${v}" ${filters.emirate === v ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
      </div>

      <div class="table-wrap company-table-wrap">
        <table>
          <thead>
            <tr>
              <th>${localeText('companyTableCode')}</th>
              <th>${localeText('companyTableArabic')}</th>
              <th>${localeText('companyTableEnglish')}</th>
              <th>${localeText('companyTableLicense')}</th>
              <th>${localeText('companyTableEmirate')}</th>
              <th>${localeText('companyTableExpiry')}</th>
              <th>${localeText('companyTableStatus')}</th>
              <th>${localeText('companyTableActions')}</th>
            </tr>
          </thead>
          <tbody>
            ${companyRows.length ? companyRows.map(company => `
              <tr>
                <td><strong>${company.companyCode}</strong></td>
                <td>${company.arabicName}</td>
                <td>${company.englishName}</td>
                <td>${company.tradeLicenseNumber}</td>
                <td>${company.emirate}</td>
                <td>${company.expiryDate || '-'}</td>
                <td><span class="badge ${company.status === 'Active' ? 'active' : company.status === 'Inactive' ? 'pending' : 'disabled'}">${company.status}</span></td>
                <td>
                  <div class="row-actions">
                    <button class="ghost-btn" data-action="toggle-company-status" data-company-id="${company.id}">${company.status === 'Active' ? localeText('disable') : localeText('enable')}</button>
                  </div>
                </td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="8" class="empty-state-table">${localeText('noReports')}</td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderTasks() {
  return `
    <section class="content-panel">
      <div class="section-head">
        <h2>${localeText('tasks')}</h2>
        <button class="secondary-btn" data-action="quick-task">Add task</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>${localeText('task')}</th>
              <th>${localeText('assignee')}</th>
              <th>${localeText('status')}</th>
              <th>${localeText('priority')}</th>
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

function renderReports() {
  return `
    <section class="content-panel">
      <div class="section-head"><h2>${localeText('reports')}</h2></div>
      <div class="empty-state">${localeText('noReports')}</div>
    </section>
  `;
}

function renderNotifications() {
  return `
    <section class="content-panel">
      <div class="section-head"><h2>${localeText('notifications')}</h2></div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>${localeText('message')}</th>
              <th>${localeText('type')}</th>
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
  const locale = getLocale();
  const demoAccounts = [
    { username: 'owner', password: 'Owner@12345', label: locale === 'ar' ? 'مالك النظام' : 'Owner' },
    { username: 'gm', password: 'Gm@12345', label: locale === 'ar' ? 'المدير العام' : 'General Manager' },
    { username: 'region_manager', password: 'Region@12345', label: locale === 'ar' ? 'مدير المنطقة' : 'Regional Manager' },
    { username: 'employee1', password: 'Emp@12345', label: locale === 'ar' ? 'موظف' : 'Employee' },
    { username: 'investor1', password: 'Inv@12345', label: locale === 'ar' ? 'مستثمر' : 'Investor' }
  ];

  appEl.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="login-visual">
          <div class="brand-block">
            <div class="brand-mark"><img src="assets/logo.svg" alt="AB Group" /></div>
            <h1 class="brand-title">${localeText('appName')}</h1>
            <div class="brand-sub">${locale === 'ar' ? 'نظام إداري ومالي وتشغيلي متكامل' : 'Administrative, Financial and Operational Management System'}</div>
          </div>
          <ul class="login-feature-list">
            <li>${localeText('sideFeatures')}</li>
            <li>${localeText('feature2')}</li>
            <li>${localeText('feature3')}</li>
            <li>${localeText('feature4')}</li>
          </ul>
        </div>

        <div class="login-form-wrap">
          <div class="login-head">
            <h2>${localeText('loginTitle')}</h2>
            <button class="lang-badge" data-action="toggle-language">${getLocale() === 'ar' ? 'English' : 'العربية'}</button>
          </div>

          <form id="login-form">
            <div class="form-group">
              <label>${localeText('username')}</label>
              <input id="username" class="input" name="username" placeholder="${localeText('username')}" required />
            </div>

            <div class="form-group">
              <label>${localeText('password')}</label>
              <div class="password-wrap">
                <input id="password" class="input" name="password" type="${app.ui.showPassword ? 'text' : 'password'}" placeholder="${localeText('password')}" required />
                <button type="button" id="toggle-password">${app.ui.showPassword ? localeText('hide') : localeText('show')}</button>
              </div>
            </div>

            <button class="primary-btn" type="submit">${localeText('signIn')}</button>
            <div id="login-error" class="error-box"></div>
          </form>

          <div class="demo-box">
            <h4>${localeText('demoAccess')}</h4>
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
  if (form) form.addEventListener('submit', handleLogin);

  const togglePw = document.getElementById('toggle-password');
  if (togglePw) {
    togglePw.addEventListener('click', () => {
      app.ui.showPassword = !app.ui.showPassword;
      renderLogin();
    });
  }

  const toggles = document.querySelectorAll('[data-action="toggle-language"]');
  toggles.forEach(button => {
    button.addEventListener('click', () => {
      const nextLocale = getLocale() === 'ar' ? 'en' : 'ar';
      setLocale(nextLocale);
    });
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
    errBox.textContent = localeText('loginError');
    errBox.classList.add('visible');
    return;
  }

  if (user.status !== 'Active') {
    errBox.textContent = localeText('inactiveError');
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

  document.querySelectorAll('[data-action="toggle-language"]').forEach(button => {
    button.addEventListener('click', () => {
      const nextLocale = getLocale() === 'ar' ? 'en' : 'ar';
      setLocale(nextLocale);
    });
  });

  document.querySelectorAll('[data-action="quick-task"]').forEach(button => {
    button.addEventListener('click', () => {
      const title = prompt(localeText('task') || 'Task title');
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

  document.querySelectorAll('[data-action="toggle-company-status"]').forEach(button => {
    button.addEventListener('click', () => {
      const companyId = button.dataset.companyId;
      const target = app.state.companies.find(c => c.id === companyId);
      if (!target) return;
      target.status = target.status === 'Active' ? 'Inactive' : 'Active';
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
        language: getLocale(),
        managerId: null
      };

      app.state.users.push(newUser);
      saveState();
      render();
    });
  }

  const companyForm = document.getElementById('company-form');
  if (companyForm) {
    companyForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const fd = new FormData(companyForm);
      const logoFile = fd.get('logo');
      const docs = fd.getAll('documents');

      let logoData = '';
      if (logoFile && logoFile.name) {
        logoData = await readFileAsDataUrl(logoFile);
      }

      const newCompany = {
        id: `company-${Date.now()}`,
        companyCode: String(fd.get('companyCode') || '').trim(),
        arabicName: String(fd.get('arabicName') || '').trim(),
        englishName: String(fd.get('englishName') || '').trim(),
        shortName: String(fd.get('shortName') || '').trim(),
        logo: logoData || 'assets/logo.svg',
        status: String(fd.get('status') || 'Active'),
        tradeLicenseNumber: String(fd.get('tradeLicenseNumber') || '').trim(),
        issuingAuthority: String(fd.get('issuingAuthority') || '').trim(),
        emirate: String(fd.get('emirate') || '').trim(),
        issueDate: String(fd.get('issueDate') || '').trim(),
        expiryDate: String(fd.get('expiryDate') || '').trim(),
        legalType: String(fd.get('legalType') || '').trim(),
        businessActivities: String(fd.get('businessActivities') || '').trim(),
        address: String(fd.get('address') || '').trim(),
        region: String(fd.get('region') || '').trim(),
        street: String(fd.get('street') || '').trim(),
        phone: String(fd.get('phone') || '').trim(),
        email: String(fd.get('email') || '').trim(),
        website: String(fd.get('website') || '').trim(),
        taxNumber: String(fd.get('taxNumber') || '').trim(),
        entityNumber: String(fd.get('entityNumber') || '').trim(),
        establishmentDate: String(fd.get('establishmentDate') || '').trim(),
        responsiblePerson: String(fd.get('responsiblePerson') || '').trim(),
        notes: String(fd.get('notes') || '').trim(),
        documents: docs.filter(f => f && f.name).map(f => f.name),
        createdAt: new Date().toISOString()
      };

      app.state.companies.push(newCompany);
      app.state.companyFilters = { query: '', status: 'all', emirate: 'all' };
      saveState();
      render();
    });
  }

  const companySearch = document.getElementById('company-search');
  if (companySearch) {
    companySearch.addEventListener('input', (event) => {
      app.state.companyFilters.query = event.target.value;
      saveState();
      render();
    });
  }

  const companyStatusFilter = document.getElementById('company-status-filter');
  if (companyStatusFilter) {
    companyStatusFilter.addEventListener('change', (event) => {
      app.state.companyFilters.status = event.target.value;
      saveState();
      render();
    });
  }

  const companyEmirateFilter = document.getElementById('company-emirate-filter');
  if (companyEmirateFilter) {
    companyEmirateFilter.addEventListener('change', (event) => {
      app.state.companyFilters.emirate = event.target.value;
      saveState();
      render();
    });
  }

  const openCompanyBtn = document.querySelector('[data-action="open-company-form"]');
  if (openCompanyBtn) {
    openCompanyBtn.addEventListener('click', () => {
      const form = document.getElementById('company-form');
      if (form) {
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }
}

async function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.name) {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject('Failed to load file');
    reader.readAsDataURL(file);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  const storedLocale = localStorage.getItem(LOCALE_KEY);
  if (storedLocale) {
    document.body.dir = storedLocale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = storedLocale;
  } else {
    localStorage.setItem(LOCALE_KEY, 'ar');
    document.body.dir = 'rtl';
    document.documentElement.lang = 'ar';
  }

  if (!app.state.companyFilters) {
    app.state.companyFilters = { query: '', status: 'all', emirate: 'all' };
  }

  render();
});
