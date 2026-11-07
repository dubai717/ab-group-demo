const STORAGE_KEY = 'ab_group_demo_state_v3';
const LEGACY_STORAGE_KEY = 'ab_group_demo_state_v2';
// Never replace an unreadable saved state with demo data.
let stateStorageWritable = true;
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
  { id: 'u-owner', fullName: 'Ahmed Alhaj', username: 'owner', email: 'owner@abgroup.local', phone: '966500000001', passwordVerifier: {"algorithm":"PBKDF2-SHA256","iterations":600000,"salt":"b067b24dc8d2fe7596d10fc78b7430b6","hash":"835609c78f78bee02b1cc4ca4f062614d6c9a1657bb85b89e211853bd30ca0dd"}, roleId: 'owner', departmentId: 'dept-management', companyId: 'company-ab', status: 'Active', language: 'ar', managerId: null },
  { id: 'u-gm', fullName: 'Khalid Ahmed', username: 'gm', email: 'gm@abgroup.local', phone: '966500000002', passwordVerifier: {"algorithm":"PBKDF2-SHA256","iterations":600000,"salt":"5df49df45c4f4b70baae3dd75c5f66b4","hash":"32d8839b289ab97d222de93b2382b029daed691eb47825453c96acd586c32b2b"}, roleId: 'general_manager', departmentId: 'dept-management', companyId: 'company-ab', status: 'Active', language: 'ar', managerId: 'u-owner' },
  { id: 'u-region', fullName: 'Samir Hassan', username: 'region_manager', email: 'region1@abgroup.local', phone: '966500000003', passwordVerifier: {"algorithm":"PBKDF2-SHA256","iterations":600000,"salt":"904e435e176066c887d78f6e46dfff4e","hash":"147127970549a7ec830dbcedd5e87570caefa001b206d7528c913a0f597f7662"}, roleId: 'regional_manager', departmentId: 'dept-regional', companyId: 'company-ab', status: 'Active', language: 'ar', managerId: 'u-gm' },
  { id: 'u-hr', fullName: 'Nora Alsaeed', username: 'hr_manager', email: 'hr@abgroup.local', phone: '966500000004', passwordVerifier: {"algorithm":"PBKDF2-SHA256","iterations":600000,"salt":"c6fa6d72e3056326c32ddb6ee4ae9d47","hash":"933826cfa4a2c4a6482d19b688bb97ed92074d3576369765050c711f7e0af122"}, roleId: 'hr_manager', departmentId: 'dept-hr', companyId: 'company-ab', status: 'Active', language: 'ar', managerId: 'u-gm' },
  { id: 'u-pr', fullName: 'Omar Younis', username: 'pr_manager', email: 'pr@abgroup.local', phone: '966500000005', passwordVerifier: {"algorithm":"PBKDF2-SHA256","iterations":600000,"salt":"66512050591985d0f83890f1c68211c8","hash":"30dfcff15518233bb2afdf8931bf7ffd1d6e1353641889ec5ad6faf08c29cad5"}, roleId: 'pr_manager', departmentId: 'dept-pr', companyId: 'company-ab', status: 'Active', language: 'ar', managerId: 'u-gm' },
  { id: 'u-marketing', fullName: 'Faisal Hadi', username: 'marketing_manager', email: 'marketing@abgroup.local', phone: '966500000006', passwordVerifier: {"algorithm":"PBKDF2-SHA256","iterations":600000,"salt":"9fc36b2bb8e141774b79276bd3066b72","hash":"7999c3f8fb90db3f1a96a2e77cef2ca9b12605bbcd28489fe4bad50271144693"}, roleId: 'marketing_manager', departmentId: 'dept-marketing', companyId: 'company-ab', status: 'Active', language: 'ar', managerId: 'u-gm' },
  { id: 'u-finance', fullName: 'Ali Mustafa', username: 'finance_manager', email: 'finance@abgroup.local', phone: '966500000007', passwordVerifier: {"algorithm":"PBKDF2-SHA256","iterations":600000,"salt":"f2b50751bdb79417745fbc5d0a9e0142","hash":"26a0f78e6aab09bb1c7a7543da4daaa7cc302f33db228f625360ced75cad0acd"}, roleId: 'finance_manager', departmentId: 'dept-finance', companyId: 'company-ab', status: 'Active', language: 'ar', managerId: 'u-gm' },
  { id: 'u-employee', fullName: 'Hassan Saleh', username: 'employee1', email: 'employee1@abgroup.local', phone: '966500000008', passwordVerifier: {"algorithm":"PBKDF2-SHA256","iterations":600000,"salt":"5531787dd85cb82d954204efd94c7ba6","hash":"76e19c47ec54a596830b342d12501ea8fa18f72ddef6db25ae74dec74c365b89"}, roleId: 'employee', departmentId: 'dept-operations', companyId: 'company-ab', status: 'Active', language: 'ar', managerId: 'u-region' },
  { id: 'u-investor', fullName: 'Investor Trial', username: 'investor1', email: 'investor1@abgroup.local', phone: '966500000009', passwordVerifier: {"algorithm":"PBKDF2-SHA256","iterations":600000,"salt":"b15c91ecc4375e468437a3ac0c9f5be0","hash":"0556fe79a27191208f29a809871c3654afd19ffbe4c6eb1dd0f812e797e07d14"}, roleId: 'investor', departmentId: 'dept-investor', companyId: 'company-ab', status: 'Active', language: 'ar', managerId: null },
  { id: 'u-partner', fullName: 'Marketing Company Trial', username: 'marketing_company', email: 'marketingcompany@abgroup.local', phone: '966500000010', passwordVerifier: {"algorithm":"PBKDF2-SHA256","iterations":600000,"salt":"2c5867085b267c0a1e08c7a2b0679ef5","hash":"1ea4f86b565bc6afdd6a9b151ab6b192d9ba4fb0126e3390ca291bdc7fcc43a7"}, roleId: 'marketing_company', departmentId: 'dept-external', companyId: 'company-ab', status: 'Active', language: 'ar', managerId: null }
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
  if(globalThis.ABCentral?.enabled)return globalThis.ABCentral.emptyState();
  let raw;
  let needsMigration = false;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      needsMigration = raw !== null;
    }
    const parsed = raw === null ? JSON.parse(JSON.stringify(initialState)) : JSON.parse(raw);
    if (!parsed || !['users', 'roles', 'departments', 'companies', 'tasks', 'notificationList']
      .every(key => Array.isArray(parsed[key]))) {
      throw new Error('Invalid saved application state');
    }
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
    if (needsMigration) {
      // Create v3 only when absent. Keep the original v2 string untouched.
      try {
        if (localStorage.getItem(STORAGE_KEY) === null && !parsed.users.some(u=>typeof u.password==='string') && !parsed.currentUser?.password) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        }
      } catch (error) {
        // The loaded v2 state remains usable if storage is full or unavailable.
        console.warn('Could not persist migrated state; v2 remains unchanged.', error);
      }
    }
    return parsed;
  } catch (error) {
    stateStorageWritable = false;
    console.warn('Saved state could not be read; automatic writes are disabled.', error);
    return JSON.parse(JSON.stringify(initialState));
  }
}

function saveState() {
  if(globalThis.ABCentral?.enabled)return false;
  if (!stateStorageWritable) return false;
  try {
    const serialized = JSON.stringify(app.state);
    localStorage.setItem(STORAGE_KEY, serialized);
    if (localStorage.getItem(STORAGE_KEY) !== serialized) throw new Error('Storage verification failed');
    return true;
  } catch (error) {
    console.warn('Could not save application state; existing storage is unchanged.', error);
    return false;
  }
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
  if(globalThis.ABCentral?.enabled)return globalThis.ABCentral.actor;
  const user = UserManagement.effectiveUser(app.state.currentUser);
  return user?.status === 'Active' ? user : null;
}

function getCanonicalActor() {
  if(globalThis.ABCentral?.enabled)return globalThis.ABCentral.actor;
  return UserManagement.actorForModules(getCurrentUser());
}

function setCurrentUser(user) {
  // Persist only the selected demo ID, never a session profile or new credential.
  app.state.currentUser = user ? {id:user.id} : null;
  saveState();
}

function getSidebarItems(user) {
  const allItems = [
    { id: 'dashboard', label: localeText('dashboard'), permission: 'view_dashboard' },
    { id: 'users', label: localeText('users'), permission: 'view_users' },
    { id: 'roles', label: localeText('roles'), permission: 'view_dashboard' },
    { id: 'departments', label: localeText('departments'), permission: 'view_company' },
    { id: 'companies', label: localeText('companies'), permission: 'view_company' },
    { id: 'bankAccounts', label: BankAccounts.text('title'), permission: 'view_finance' },
    { id: 'tasks', label: localeText('tasks'), permission: 'view_tasks' },
    { id: 'reports', label: localeText('reports'), permission: 'view_reports' },
    { id: 'notifications', label: localeText('notifications'), permission: 'manage_notifications' }
  ].filter(item => item.id !== 'bankAccounts' || BankAccounts.canEnter());

  if (!user) return [];

  if (user.roleId === 'owner' || user.roleId === 'general_manager' || user.roleId === 'hr_manager') {
    return allItems;
  }

  if (user.roleId === 'regional_manager' || user.roleId === 'employee') {
    return allItems.filter(item => item.id === 'bankAccounts' || ['dashboard', 'users', 'tasks', 'notifications'].includes(item.id));
  }

  if (user.roleId === 'investor' || user.roleId === 'marketing_company') {
    return allItems.filter(item => item.id === 'bankAccounts' || ['dashboard', 'users', 'reports'].includes(item.id));
  }

  return allItems.filter(item => ['bankAccounts', 'users'].includes(item.id) || isUserAllowed(user, item.permission));
}

function render() {
  if (['testData','testUsers','test-data','test-users'].includes(app.state.currentPage)) app.state.currentPage = 'dashboard';
  if(globalThis.ABCentral?.enabled&&!globalThis.ABCentral.ready){globalThis.ABCentral.loading();return;}
  const currentUser = getCurrentUser();
  document.body.dir = getLocale() === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = getLocale();
  document.body.setAttribute('data-locale', getLocale());

  const appEl = document.getElementById('app');

  if (!currentUser) {
    renderLogin();
    return;
  }

  const sidebarItems = getSidebarItems(currentUser).filter(i=>!['roles','departments'].includes(i.id));
  if(CustomerUI.canEnter())sidebarItems.push({id:'customers',label:getLocale()==='ar'?'العملاء':'Customers'});
  if(PersonnelUI.canEnter())sidebarItems.push({id:'personnel',label:getLocale()==='ar'?'شؤون الموظفين':'Personnel'});
  if(LedgerUI.canEnter())sidebarItems.push({id:'financialManagement',label:getLocale()==='ar'?'الإدارة المالية والخزينة':'Finance & treasury'});
  if(VehicleUI.canEnter())sidebarItems.push({id:'vehicles',label:getLocale()==='ar'?'المركبات':'Vehicles'});
  sidebarItems.push(...BusinessCenters.sidebar());
  if(ContractingCompaniesUI.canEnter())sidebarItems.push({id:'contractingCompanies',label:getLocale()==='ar'?'الشركات المتعاقدة':'Contracting Companies'});
  if(MarketingUI.canEnter())sidebarItems.push({id:'marketing',label:getLocale()==='ar'?'التسويق وتطوير الأعمال':'Marketing & business development'});
  if(InvestorUI.canEnter())sidebarItems.push({id:'investors',label:getLocale()==='ar'?'المستثمرون':'Investors'});
  if(globalThis.ABCentral?.enabled&&currentUser.roleId==='investor'){sidebarItems.splice(0,sidebarItems.length,{id:'investors',label:getLocale()==='ar'?'لوحة المستثمر':'Investor portal'});if(app.state.currentPage==='dashboard')app.state.currentPage='investors';}
  appEl.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="sidebar-logo">
          <div class="sidebar-logo-badge">
            <img src="assets/Untitled.png" alt="AB Group logo" />
          </div>
          <div>
            <h3>${localeText('appName')}</h3>
          </div>
        </div>

        <button type="button" class="ws-menu-toggle" data-ws-menu aria-expanded="false">${getLocale()==='ar'?'القائمة الرئيسية':'Main menu'}</button><nav class="sidebar-nav">
          ${sidebarItems.map(item => `
            <button class="nav-item ${WorkspaceUI.group(app.state.currentPage) === item.id ? 'active' : ''}" data-page="${item.id}">
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
          <h1>${AuthFlows.isSettings() ? AuthFlows.text('accountSettings') : pageTitle(app.state.currentPage)}</h1>
          <div class="user-controls">
            <button class="lang-switch" data-action="toggle-language">
              ${getLocale() === 'ar' ? 'English' : 'العربية'}
            </button>
            <details class="account-menu">
              <summary class="user-pill">
                <span class="avatar">${AuthFlows.escape(currentUser.fullName.slice(0,1).toUpperCase())}</span>
                <span><span>${AuthFlows.escape(currentUser.fullName)}</span><span class="muted account-role">${getRoleName(currentUser.roleId)}</span></span>
              </summary>
              <div class="account-popover"><button class="ghost-btn" type="button" data-auth="settings">${AuthFlows.text('accountSettings')}</button></div>
            </details>
          </div>
        </header>

        ${ViewAsUI.banner()}
        ${AuthFlows.isSettings() ? AuthFlows.renderSettings() : WorkspaceUI.toolbar(app.state.currentPage)+renderCurrentPage()}
      </main>
    </div>
  `;

  bindGlobalEvents();
}

function pageTitle(page) {
  const titles = {personnel:getLocale()==='ar'?'شؤون الموظفين':'Personnel',financialManagement:getLocale()==='ar'?'الإدارة المالية والخزينة':'Finance & treasury',customers:getLocale()==='ar'?'العملاء':'Customers',vehicles:getLocale()==='ar'?'المركبات':'Vehicles',
    dashboard: localeText('dashboard'),
    users: localeText('userManagement'),
    roles: localeText('roles'),
    departments: localeText('departments'),
    companies: localeText('companyManagement'),
    bankAccounts: BankAccounts.text('title'),
    tasks: localeText('tasks'),
    reports: localeText('reports'),
    notifications: localeText('notifications')
  };
  return BusinessCenters.title(page) || titles[page] || localeText('dashboard');
}

function renderCurrentPage() {
  const user = getCurrentUser();
  const page = app.state.currentPage;

  if(page==='contractingCompanies')return ContractingCompaniesUI.render();
  if(page==='marketing')return MarketingUI.render();
  if(page==='investors')return InvestorUI.render();
  if (['documentCenter','approvalCenter'].includes(page)) return BusinessCenters.render(page);
  if (page === 'dashboard') return renderDashboard(user);
  if (page === 'users') return renderUsers(user);
  if (page === 'roles') return renderRoles(user);
  if (page === 'departments') return renderDepartments(user);
  if (page === 'companies') return renderCompanies(user);
  if (page === 'bankAccounts') return FinanceWorkbench.isAccounts()?BankAccounts.render():FinanceWorkbench.render();
  if(page==='customers')return CustomerUI.render();
  if(page==='vehicles')return VehicleUI.render();
  if(page==='personnel')return PersonnelUI.render();
  if(page==='financialManagement')return LedgerUI.render();
  if (page === 'tasks') return globalThis.ABCentral?.enabled?PersonnelUI.renderTasks():renderTasks(user);
  if (page === 'reports') return globalThis.ABCentral?.enabled?ReportUI.render():renderReports(user);
  if (page === 'notifications') return globalThis.ABCentral?.enabled?CommunicationsUI.render():renderNotifications(user)+CustomerUI.notificationHTML();
  return renderDashboard(user);
}

function renderDashboard(user) {
  if(globalThis.ABCentral?.enabled)return DashboardUI.render();
  const summary = UserManagement.summary();
  const totalUsers = summary.total;
  const activeUsers = summary.active;
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
                <td>${UserManagement.escape(task.assignee)}</td>
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
  return UserManagement.render();
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
                  <td>${CompanyDocuments.escape(app.state.companies[0].name || app.state.companies[0].englishName)}</td>
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
  const grid=RegisterStore.get('companies',['arabicName','englishName','tradeLicenseNumber','emirate','expiryDate','licenseStatus','status'],{grid:{version:2}});if(!app.state.companyFormOpen)grid.ensure();
  const companyRows=grid.rows;
  const columnTitles={arabicName:localeText('companyTableArabic'),englishName:localeText('companyTableEnglish'),tradeLicenseNumber:localeText('companyTableLicense'),emirate:localeText('companyTableEmirate'),expiryDate:localeText('companyTableExpiry'),licenseStatus:getLocale()==='ar'?'حالة الرخصة':'Licence status',status:localeText('companyTableStatus')};grid.labels=columnTitles;
  return `
    <section class="content-panel company-panel">
      <div class="section-head">
        <h2>${localeText('companyManagement')}</h2>
        ${app.state.companyFormOpen?`<button type="button" class="ghost-btn" data-company-back>${getLocale()==='ar'?'الرجوع للسجل':'Back to register'}</button>`:canManage?`<button class="secondary-btn" data-action="open-company-form">${localeText('addCompany')}</button>`:''}
      </div>

      <div class="company-desc">${localeText('legalEntitiesDesc')}</div>
      ${CompanyDocuments.renderSaveNotice()}

      ${canManage && app.state.companyFormOpen ? `
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
            <input type="hidden" name="companyCode" value="CO-${crypto.randomUUID()}" />
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
            ${CompanyDocuments.licenseFields({},true)}

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
              <label for="company-emirate">${localeText('emirate')}</label>
              <select class="input" id="company-emirate" name="emirate">${AreaReference.emirateOptions()}</select>
            </div>
            ${AreaReference.renderFields()}
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

            ${CompanyDocuments.creationFields()}
            <div class="full controls-row">
              <button type="submit" class="primary-btn">${CompanyDocuments.text('saveData')}</button>
            </div>
          </div>
        </form>
      ` : ''}

      ${!app.state.companyFormOpen ? `      <div class="register-actions">${grid.search()}${['excel','pdf','print'].map(format=>`<button type="button" class="ghost-btn" data-register-export="${format}">${format==='print'?(getLocale()==='ar'?'طباعة':'Print'):format.toUpperCase()}</button>`).join('')}</div><p role="status">${grid.busy?(getLocale()==='ar'?'جارٍ تحميل السجل…':'Loading register…'):grid.error?CompanyDocuments.text(grid.error):''}</p>
      <div class="table-wrap company-table-wrap">
        <table>
          <thead>
            <tr>

              ${grid.columns.map(key=>`<th>${RegisterTools.head(key,columnTitles[key],grid.facets[key]||[],grid.grid,v=>v,key==='expiryDate'?'date':'text')}</th>`).join('')}
              <th>${localeText('companyTableActions')}</th>
            </tr>
          </thead>
          <tbody>
            ${companyRows.length ? companyRows.map(company => `
              <tr data-company-row="${CompanyDocuments.escape(company.id)}">

                <td>${CompanyDocuments.escape(company.arabicName)}</td>
                <td>${CompanyDocuments.escape(company.englishName)}</td>
                <td>${CompanyDocuments.escape(company.tradeLicenseNumber)}</td>
                <td>${CompanyDocuments.escape(company.emirate)}</td>
                <td>${CompanyDocuments.escape(company.expiryDate || '-')}</td>
                <td>${CompanyDocuments.escape(company.licenseStatus||'Active')}</td>
                <td><span class="badge ${company.status === 'Active' ? 'active' : company.status === 'Inactive' ? 'pending' : 'disabled'}">${CompanyDocuments.escape(company.status)}</span></td>
                <td>
                  <div class="row-actions">
                    ${CompanyDocuments.profileButton(company.id)}
                    ${CompanyDocuments.canAction(company.status==='Active'?'deactivate':'activate')?`<button type="button" class="ghost-btn" data-action="toggle-company-status" data-company-id="${company.id}" data-next-status="${company.status==='Active'?'Inactive':'Active'}">${company.status === 'Active' ? localeText('disable') : localeText('enable')}</button>`:''}
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
      </div>${grid.pages()}` : ''}
    </section>
  ` + CompanyDocuments.renderProfile();
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
                <td>${UserManagement.escape(task.assignee)}</td>
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
      ${CompanyDocuments.renderReport() || `<div class="empty-state">${localeText('noReports')}</div>`}
    </section>
  `;
}

function renderNotifications() {
  return `
    <section class="content-panel">
      <div class="section-head"><h2>${localeText('notifications')}</h2></div>
      ${CompanyDocuments.renderAlerts()}
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
    { username: 'owner', label: locale === 'ar' ? 'مالك النظام' : 'Owner' },
    { username: 'gm', label: locale === 'ar' ? 'المدير العام' : 'General Manager' },
    { username: 'region_manager', label: locale === 'ar' ? 'مدير المنطقة' : 'Regional Manager' },
    { username: 'employee1', label: locale === 'ar' ? 'موظف' : 'Employee' },
    { username: 'investor1', label: locale === 'ar' ? 'مستثمر' : 'Investor' }
  ];

  appEl.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="login-visual">
          <div class="brand-block">
            <div class="brand-mark"><img src="assets/Untitled.png" alt="AB Group" /></div>
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
              <label for="username">${localeText('username')}</label>
              <input id="username" autocomplete="username" class="input" name="username" placeholder="${localeText('username')}" required />
            </div>

            <div class="form-group">
              <label for="password">${localeText('password')}</label>
              <div class="password-wrap">
                <input id="password" autocomplete="current-password" class="input" name="password" type="${app.ui.showPassword ? 'text' : 'password'}" placeholder="${localeText('password')}" required />
                <button type="button" id="toggle-password">${app.ui.showPassword ? localeText('hide') : localeText('show')}</button>
              </div>
            </div>

            <button class="auth-link" type="button" data-auth="forgot">${AuthFlows.text('forgot')}</button>
            <button class="primary-btn" type="submit">${localeText('signIn')}</button>
            <div id="login-error" class="error-box" role="alert" aria-live="polite"></div>
          </form>

          <div class="demo-box">
            <h4>${localeText('demoAccess')}</h4>
            <div class="demo-users">
              ${demoAccounts.map(acc => `
                <button class="demo-user-button" data-demo-user="${acc.username}">${acc.label}</button>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  AuthFlows.mountLogin();
  globalThis.ABCentral?.enabled&&globalThis.ABCentral.bind();
  const form = document.getElementById('login-form');
  if (form) form.addEventListener('submit', handleLogin);

  const togglePw = document.getElementById('toggle-password');
  if (togglePw) {
    togglePw.addEventListener('click', () => {
      app.ui.showPassword = !app.ui.showPassword;
      const input = document.getElementById('password');
      input.type = app.ui.showPassword ? 'text' : 'password';
      togglePw.textContent = app.ui.showPassword ? localeText('hide') : localeText('show');
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
      document.getElementById('username').value = username;
      document.getElementById('password').value = '';
      document.getElementById('password').focus();
    });
  });
}

let loginAttempt = 0;
async function handleLogin(event) {
  event.preventDefault();
  const form = document.getElementById('login-form');
  if (!form || form.dataset.busy === 'true') return;
  form.dataset.busy = 'true';
  const attempt = ++loginAttempt;
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const errBox = document.getElementById('login-error');
  try {
    // Keep legacy demo credentials intact. New local accounts use a separate verifier.
    const legacy = app.state.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    let user = legacy && legacy.username === username && await DemoCredentials.verifyLegacy(legacy,password) ? legacy : null;
    if (!legacy) user = await DemoCredentials.authenticate(username, password);
    if (attempt !== loginAttempt || !form.isConnected) return;
    if (!user || legacy && legacy.status !== 'Active' || UserManagement.effectiveUser(user)?.status !== 'Active') throw new Error('login');
    AuthFlows.leave();
    AuthFlows.record('login_succeeded', user.id);
    setCurrentUser(user);
    app.state.currentPage = 'dashboard';
    render();
  } catch {
    if (attempt === loginAttempt && form.isConnected) {
      AuthFlows.record('login_failed');
      errBox.textContent = localeText('loginError');
      errBox.classList.add('visible');
    }
  } finally {
    if (form.isConnected) delete form.dataset.busy;
  }
}

function bindGlobalEvents() {
  ViewAsUI.bind();
  BusinessCenters.bind();
  CommunicationsUI.bind();
  DashboardUI.bind();
  ReportUI.bind();
  MarketingUI.bind();
  ContractingCompaniesUI.bind();
  InvestorUI.bind();
  WorkspaceUI.bind();
  CustomerUI.bind();
  VehicleUI.bind();
  FinanceWorkbench.bind();
  LedgerUI.bind();
  PersonnelUI.bind();
  globalThis.ABCentral?.enabled&&globalThis.ABCentral.bind();
  AuthFlows.bindApp();
  BankAccounts.bind();
  CompanyDocuments.bind();
  document.querySelectorAll('[data-page]').forEach(button => {
    button.addEventListener('click', async () => {
      if(!CustomerUI.leave()||!CompanyDocuments.leave())return;
      AuthFlows.leave();
      UserManagement.cleanup();
      BankAccounts.cleanup();
      CompanyDocuments.cleanupPreview();
      const page = button.dataset.page;
      if(page==='companies'){CompanyDocuments.centralSelect(null);app.state.companyFormOpen=false;}
      app.state.currentPage = page;
      if(page==='customers'){await CustomerUI.select('list',true);return;}
      if(page==='vehicles'){await VehicleUI.select('list');return;}
      saveState();
      render();
    });
  });

  document.querySelectorAll('[data-action="logout"]').forEach(button => {
    button.addEventListener('click', () => {
      FinanceWorkbench.reset();
      LedgerUI.reset();
      PersonnelUI.reset();
      CustomerUI.reset();
      VehicleUI.reset();
      BankAccounts.logout();
      CompanyDocuments.logout();
      UserManagement.logout();
      AuthFlows.logout();
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

  document.querySelectorAll('[data-action="toggle-company-status"]').forEach(button => {
    button.addEventListener('click', () => {
      const actor = getCanonicalActor();
      if(!actor || actor.status!=='Active' || !(actor.roleId==='owner'||isUserAllowed(actor,'edit_company'))) return;
      const companyId = button.dataset.companyId;
      const target = app.state.companies.find(c => c.id === companyId);
      if (!target) return;
      if(!confirm(getLocale()==='ar'?'تأكيد تغيير حالة الشركة؟':'Confirm company status change?'))return;
      CompanyDocuments.updateStatus(companyId,button.dataset.nextStatus||(target.status==='Active'?'Inactive':'Active'));
      render();
    });
  });

  UserManagement.bind();

  AreaReference.bind();
  const companyForm = document.getElementById('company-form');
  if (companyForm) {
    companyForm.addEventListener('input', () => CompanyDocuments.beginCreate());
    companyForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submitButton = companyForm.querySelector('button[type=submit]');
      if (submitButton.disabled) return;
      submitButton.disabled = true;
      CompanyDocuments.beginCreate();
      try {
      const fd = new FormData(companyForm);
      const logoFile = fd.get('logo');
      const docs = fd.getAll('documents');

      let logoData = '';
      if (logoFile && logoFile.name) {
        logoData = await readFileAsDataUrl(logoFile);
      }

      const actor = getCurrentUser();
      if (!actor || actor.status !== 'Active' || !(actor.roleId === 'owner' || isUserAllowed(actor, 'create_company') || isUserAllowed(actor, 'edit_company'))) return;
      let location;
      try { location = AreaReference.selected(companyForm); } catch (error) {
        companyForm.querySelector('#area-message').textContent = getLocale() === 'ar' ? 'تعذر حفظ الموقع. تحقق من الإمارة والمنطقة والمرجع المحلي.' : 'Location could not be saved. Check the emirate, area and local reference.';
        return;
      }
      let documentData;
      try { documentData = CompanyDocuments.prepareCreation(companyForm); } catch (error) {
        companyForm.querySelector('#company-doc-message').textContent = CompanyDocuments.text(error.message);
        return;
      }
      const newCompany = {
        id: `company-${crypto.randomUUID()}`,
        ...documentData.data,
        companyCode: String(fd.get('companyCode') || '').trim(),
        arabicName: String(fd.get('arabicName') || '').trim(),
        englishName: String(fd.get('englishName') || '').trim(),
        shortName: String(fd.get('shortName') || '').trim(),
        logo: 'assets/Untitled.png',
        ...CompanyDocuments.licenseData(Object.fromEntries(fd)),
        status: String(fd.get('status') || 'Active'),
        tradeLicenseNumber: String(fd.get('tradeLicenseNumber') || '').trim(),
        issuingAuthority: String(fd.get('issuingAuthority') || '').trim(),
        ...location,
        issueDate: String(fd.get('issueDate') || '').trim(),
        expiryDate: String(fd.get('expiryDate') || '').trim(),
        legalType: String(fd.get('legalType') || '').trim(),
        businessActivities: String(fd.get('businessActivities') || '').trim(),
        address: String(fd.get('address') || '').trim(),
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

      const previousFilters = app.state.companyFilters;
      app.state.companies.push(newCompany);
      app.state.companyFilters = { query: '', status: 'all', emirate: 'all' };
      if (!saveState()) {
        app.state.companies.pop();
        app.state.companyFilters = previousFilters;
        companyForm.querySelector('#company-doc-message').textContent = CompanyDocuments.text('storageFailed');
        return;
      }
      CompanyDocuments.captureNew(newCompany.id, documentData.files);
      CompanyDocuments.markCreated();app.state.companyFormOpen=false;
      render();
      } catch (error) {
        const message = companyForm.querySelector('#company-doc-message');
        if (message) message.textContent = CompanyDocuments.text('storageFailed');
      } finally {
        if (submitButton.isConnected) submitButton.disabled = false;
      }
    });
  }

  document.querySelector('[data-company-back]')?.addEventListener('click',()=>{app.state.companyFormOpen=false;render();});
  const companyGridHost=document.querySelector('.company-panel');if(companyGridHost&&!app.state.companyFormOpen)RegisterStore.get('companies').bind(companyGridHost);
  document.querySelectorAll('[data-company-row]').forEach(row=>row.addEventListener('click',ev=>{if(!ev.target.closest('button,a,input,select,summary,details'))row.querySelector('[data-cd=profile]')?.click();}));
  const openCompanyBtn = document.querySelector('[data-action="open-company-form"]');
  if (openCompanyBtn) {
    openCompanyBtn.addEventListener('click', () => {
      const form = document.getElementById('company-form');
      if(!form){CompanyDocuments.centralSelect(null);app.state.companyFormOpen=true;render();document.querySelector('#company-form input:not([type=hidden])')?.focus();}else form.scrollIntoView({ behavior:'smooth',block:'start' });
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

window.addEventListener('DOMContentLoaded', async () => {
  if(!globalThis.ABCentral?.enabled){try{if(await DemoCredentials.upgradeLegacyState(app.state))saveState();}catch{stateStorageWritable=false;}}
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
