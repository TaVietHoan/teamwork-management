/**
 * TEAM WORK MANAGEMENT - FRONTEND SPA CORE
 * Architecture: Modular Vanilla JS with Lucide Icons & Chart.js
 */

const APP_CONFIG = {
  APP_NAME: "TEAM WORK MANAGEMENT",
  // Đổi thành URL Web App GAS của bạn hoặc giữ đường dẫn proxy "/api/proxy"
  GAS_API_URL: "https://script.google.com/macros/s/AKfycbyxmn7SwdUM5kYF5vNFqmIYVp1BSlPz5CCUwkGFcjId0sqBkpuGqqaU-MlOj5HiQwUx7w/exec",
  APP_VERSION: "1.0.0",
  USE_PROXY: false // Đặt true nếu host trên Vercel có api/proxy.js
};

// Application State Store
const state = {
  token: localStorage.getItem("twm_token") || "",
  user: JSON.parse(localStorage.getItem("twm_user") || "null"),
  currentView: "dashboard",
  tasks: [],
  metadata: {
    departments: [],
    teams: [],
    bases: [],
    planGroups: [],
    statuses: []
  },
  users: [],
  filters: {
    search: "",
    statusCode: "",
    baseId: "",
    planGroupId: "",
    month: "",
    myTasksOnly: false,
    retractedOnly: false
  },
  activeTaskId: null,
  activeKanbanView: false,
  charts: {}
};

// ==========================================
// 1. API CLIENT SERVICE
// ==========================================

async function callApi(action, data = {}) {
  showGlobalLoading(true);
  try {
    const payload = {
      action: action,
      sessionToken: state.token,
      ...data
    };

    let url = APP_CONFIG.USE_PROXY ? "/api/proxy" : APP_CONFIG.GAS_API_URL;
    
    // Đảm bảo tương thích CORS trên GAS
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Mã lỗi mạng: ${response.status}`);
    }

    const resData = await response.json();

    if (resData.code === "UNAUTHORIZED") {
      logout(false);
      showToast("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", "error");
      throw new Error("UNAUTHORIZED");
    }

    return resData;
  } catch (error) {
    if (error.message !== "UNAUTHORIZED") {
      showToast(error.message || "Không thể kết nối đến máy chủ", "error");
    }
    throw error;
  } finally {
    showGlobalLoading(false);
  }
}

// ==========================================
// 2. LIFECYCLE & INITIALIZATION
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
  initLucide();
  checkAuthAndRoute();
});

function initLucide() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

async function checkAuthAndRoute() {
  if (state.token) {
    try {
      const res = await callApi("getMe");
      if (res.success && res.user) {
        state.user = res.user;
        localStorage.setItem("twm_user", JSON.stringify(res.user));
        await loadInitialData();
        renderMainApp();
      } else {
        logout(false);
      }
    } catch (e) {
      logout(false);
    }
  } else {
    renderAuthScreen("login");
  }
}

async function loadInitialData() {
  try {
    const [metaRes, usersRes] = await Promise.all([
      callApi("getMetadata"),
      callApi("getUsers")
    ]);
    if (metaRes.success) state.metadata = metaRes;
    if (usersRes.success) state.users = usersRes.users;
  } catch (e) {
    console.error("Lỗi nạp metadata ban đầu", e);
  }
}

// ==========================================
// 3. AUTHENTICATION & UI FLOWS
// ==========================================

function renderAuthScreen(mode = "login") {
  const root = document.getElementById("app-root");
  root.innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div class="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 border border-slate-100">
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-xl text-white mb-4 shadow-lg shadow-indigo-200">
            <i data-lucide="layers" class="w-8 h-8"></i>
          </div>
          <h1 class="text-2xl font-bold text-slate-800">${APP_CONFIG.APP_NAME}</h1>
          <p class="text-slate-500 text-sm mt-1">Hệ thống quản lý công việc và mục tiêu nội bộ</p>
        </div>

        <div id="auth-form-container">
          ${mode === "login" ? getLoginFormHtml() : mode === "register" ? getRegisterFormHtml() : getForgotPasswordFormHtml()}
        </div>
      </div>
    </div>
  `;
  initLucide();
}

function getLoginFormHtml() {
  return `
    <form id="login-form" onsubmit="handleLoginSubmit(event)" class="space-y-4">
      <div>
        <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Tài khoản / Email</label>
        <input type="text" id="login-username" required class="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition text-sm" placeholder="Nhập email hoặc username">
      </div>
      <div>
        <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Mật khẩu</label>
        <div class="relative">
          <input type="password" id="login-password" required class="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition text-sm" placeholder="••••••••">
          <button type="button" onclick="togglePasswordVisibility('login-password')" class="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
            <i data-lucide="eye" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
      <div class="flex items-center justify-between text-xs">
        <label class="flex items-center text-slate-600 cursor-pointer">
          <input type="checkbox" checked class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mr-2"> Ghi nhớ đăng nhập
        </label>
        <a href="javascript:void(0)" onclick="renderAuthScreen('forgot')" class="text-indigo-600 hover:underline font-medium">Quên mật khẩu?</a>
      </div>
      <button type="submit" id="btn-login" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg shadow-md shadow-indigo-200 transition text-sm">
        Đăng nhập
      </button>
      <div class="text-center pt-2 text-xs text-slate-600">
        Chưa có tài khoản? <a href="javascript:void(0)" onclick="renderAuthScreen('register')" class="text-indigo-600 font-semibold hover:underline">Đăng ký thành viên</a>
      </div>
    </form>
  `;
}

function getRegisterFormHtml() {
  return `
    <form id="register-form" onsubmit="handleRegisterSubmit(event)" class="space-y-3">
      <div>
        <label class="block text-xs font-semibold text-slate-700 mb-1">Họ và tên *</label>
        <input type="text" id="reg-fullname" required class="w-full px-3 py-2 rounded-lg border text-sm" placeholder="Nguyễn Văn A">
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Tên đăng nhập *</label>
          <input type="text" id="reg-username" required class="w-full px-3 py-2 rounded-lg border text-sm" placeholder="nguyenvana">
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Mã nhân viên</label>
          <input type="text" id="reg-empcode" class="w-full px-3 py-2 rounded-lg border text-sm" placeholder="NV-001">
        </div>
      </div>
      <div>
        <label class="block text-xs font-semibold text-slate-700 mb-1">Email nội bộ *</label>
        <input type="email" id="reg-email" required class="w-full px-3 py-2 rounded-lg border text-sm" placeholder="vana@company.com">
      </div>
      <div>
        <label class="block text-xs font-semibold text-slate-700 mb-1">Số điện thoại</label>
        <input type="text" id="reg-phone" class="w-full px-3 py-2 rounded-lg border text-sm" placeholder="0901234567">
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Mật khẩu *</label>
          <input type="password" id="reg-password" required minlength="6" class="w-full px-3 py-2 rounded-lg border text-sm" placeholder="••••••••">
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Xác nhận *</label>
          <input type="password" id="reg-confirm" required minlength="6" class="w-full px-3 py-2 rounded-lg border text-sm" placeholder="••••••••">
        </div>
      </div>
      <button type="submit" id="btn-reg" class="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg text-sm shadow">
        Đăng ký tài khoản
      </button>
      <div class="text-center pt-2 text-xs text-slate-600">
        Đã có tài khoản? <a href="javascript:void(0)" onclick="renderAuthScreen('login')" class="text-indigo-600 font-semibold hover:underline">Quay lại đăng nhập</a>
      </div>
    </form>
  `;
}

function getForgotPasswordFormHtml() {
  return `
    <div class="space-y-4">
      <div id="forgot-step-1">
        <p class="text-xs text-slate-500 mb-3">Nhập email tài khoản để nhận mã OTP khôi phục mật khẩu.</p>
        <div class="space-y-3">
          <input type="email" id="forgot-email" class="w-full px-4 py-2.5 rounded-lg border text-sm" placeholder="your-email@company.com">
          <button type="button" onclick="handleSendResetOtp()" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg text-sm">
            Gửi mã xác nhận OTP
          </button>
        </div>
      </div>
      <div id="forgot-step-2" class="space-y-3 hidden">
        <input type="text" id="forgot-code" class="w-full px-4 py-2 rounded-lg border text-sm" placeholder="Nhập 6 số mã xác nhận">
        <input type="password" id="forgot-newpass" class="w-full px-4 py-2 rounded-lg border text-sm" placeholder="Mật khẩu mới (tối thiểu 6 ký tự)">
        <button type="button" onclick="handleConfirmResetPass()" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 rounded-lg text-sm">
          Xác nhận đặt lại mật khẩu
        </button>
      </div>
      <div class="text-center pt-2 text-xs">
        <a href="javascript:void(0)" onclick="renderAuthScreen('login')" class="text-slate-500 hover:text-slate-800">Quay lại đăng nhập</a>
      </div>
    </div>
  `;
}

function togglePasswordVisibility(fieldId) {
  const el = document.getElementById(fieldId);
  if (el) el.type = el.type === "password" ? "text" : "password";
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const u = document.getElementById("login-username").value.trim();
  const p = document.getElementById("login-password").value;
  const btn = document.getElementById("btn-login");
  btn.disabled = true;
  btn.innerText = "Đang kiểm tra...";

  try {
    const res = await callApi("login", { usernameOrEmail: u, password: p, userAgent: navigator.userAgent });
    if (res.success) {
      state.token = res.sessionToken;
      state.user = res.user;
      localStorage.setItem("twm_token", res.sessionToken);
      localStorage.setItem("twm_user", JSON.stringify(res.user));
      showToast("Đăng nhập thành công!", "success");
      await loadInitialData();
      renderMainApp();
    } else {
      showToast(res.message, "error");
    }
  } catch (err) {
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Đăng nhập";
    }
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const pass = document.getElementById("reg-password").value;
  const conf = document.getElementById("reg-confirm").value;

  if (pass !== conf) {
    showToast("Mật khẩu và xác nhận mật khẩu không trùng khớp", "error");
    return;
  }

  const payload = {
    fullName: document.getElementById("reg-fullname").value.trim(),
    username: document.getElementById("reg-username").value.trim(),
    employeeCode: document.getElementById("reg-empcode").value.trim(),
    email: document.getElementById("reg-email").value.trim(),
    phone: document.getElementById("reg-phone").value.trim(),
    password: pass
  };

  const res = await callApi("register", payload);
  if (res.success) {
    showToast(res.message, "success");
    renderAuthScreen("login");
  } else {
    showToast(res.message, "error");
  }
}

async function handleSendResetOtp() {
  const email = document.getElementById("forgot-email").value.trim();
  if (!email) return showToast("Vui lòng nhập email", "warning");

  const res = await callApi("requestPasswordReset", { email: email });
  if (res.success) {
    showToast(res.message, "info");
    document.getElementById("forgot-step-1").classList.add("hidden");
    document.getElementById("forgot-step-2").classList.remove("hidden");
  } else {
    showToast(res.message, "error");
  }
}

async function handleConfirmResetPass() {
  const email = document.getElementById("forgot-email").value.trim();
  const code = document.getElementById("forgot-code").value.trim();
  const pass = document.getElementById("forgot-newpass").value;

  const res = await callApi("resetPassword", { email: email, tokenCode: code, newPassword: pass });
  if (res.success) {
    showToast(res.message, "success");
    renderAuthScreen("login");
  } else {
    showToast(res.message, "error");
  }
}

function logout(callBackend = true) {
  if (callBackend && state.token) {
    callApi("logout").catch(() => {});
  }
  state.token = "";
  state.user = null;
  localStorage.removeItem("twm_token");
  localStorage.removeItem("twm_user");
  renderAuthScreen("login");
}

// ==========================================
// 4. MAIN APP LAYOUT & NAVIGATION
// ==========================================

function renderMainApp() {
  const root = document.getElementById("app-root");
  root.innerHTML = `
    <div class="flex h-screen bg-slate-100 overflow-hidden text-slate-800 antialiased font-sans">
      <!-- SIDEBAR -->
      <aside id="main-sidebar" class="w-64 bg-slate-900 text-slate-300 flex flex-col transition-all duration-200 z-30 shadow-xl">
        <div class="p-4 border-b border-slate-800 flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow">
              <i data-lucide="layers" class="w-5 h-5"></i>
            </div>
            <span class="font-bold text-sm tracking-wide text-white uppercase">${APP_CONFIG.APP_NAME}</span>
          </div>
        </div>

        <nav class="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div class="text-[10px] uppercase tracking-wider text-slate-500 font-bold px-3 mb-2">Điều hướng</div>
          <button onclick="navigateView('dashboard')" class="nav-item w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${state.currentView === 'dashboard' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}">
            <i data-lucide="layout-dashboard" class="w-4 h-4"></i>
            <span>Tổng quan</span>
          </button>
          <button onclick="navigateView('tasks')" class="nav-item w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${state.currentView === 'tasks' && !state.filters.myTasksOnly && !state.filters.retractedOnly ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}">
            <i data-lucide="check-square" class="w-4 h-4"></i>
            <span>Tất cả công việc</span>
          </button>
          <button onclick="setQuickFilter('myTasks')" class="nav-item w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${state.filters.myTasksOnly ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}">
            <i data-lucide="user-check" class="w-4 h-4"></i>
            <span>Việc của tôi</span>
          </button>
          <button onclick="setQuickFilter('retracted')" class="nav-item w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${state.filters.retractedOnly ? 'bg-rose-900/40 text-rose-300' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}">
            <i data-lucide="undo-2" class="w-4 h-4"></i>
            <span>Đã rút lại lời hứa</span>
          </button>

          <div class="text-[10px] uppercase tracking-wider text-slate-500 font-bold px-3 pt-4 mb-2">Báo cáo & Phân tích</div>
          <button onclick="navigateView('reports')" class="nav-item w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${state.currentView === 'reports' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}">
            <i data-lucide="pie-chart" class="w-4 h-4"></i>
            <span>Báo cáo thống kê</span>
          </button>

          ${(state.user && state.user.Role === "ADMIN") ? `
            <div class="text-[10px] uppercase tracking-wider text-slate-500 font-bold px-3 pt-4 mb-2">Quản trị</div>
            <button onclick="navigateView('admin-users')" class="nav-item w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${state.currentView === 'admin-users' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}">
              <i data-lucide="users" class="w-4 h-4"></i>
              <span>Quản lý thành viên</span>
            </button>
          ` : ""}
        </nav>

        <div class="p-3 border-t border-slate-800 flex items-center justify-between">
          <div class="flex items-center space-x-3 min-w-0">
            <div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs text-white">
              ${state.user.FullName.charAt(0)}
            </div>
            <div class="truncate">
              <p class="text-xs font-semibold text-white truncate">${state.user.FullName}</p>
              <p class="text-[10px] text-slate-400 uppercase">${state.user.Role}</p>
            </div>
          </div>
          <button onclick="logout()" title="Đăng xuất" class="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition">
            <i data-lucide="log-out" class="w-4 h-4"></i>
          </button>
        </div>
      </aside>

      <!-- MAIN CONTENT WRAPPER -->
      <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
        <!-- TOPBAR -->
        <header class="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-10">
          <div class="flex items-center space-x-4">
            <h2 id="topbar-title" class="text-lg font-bold text-slate-800">Tổng quan</h2>
          </div>
          <div class="flex items-center space-x-3">
            <button onclick="openTaskModal()" class="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-sm shadow-indigo-200 transition">
              <i data-lucide="plus" class="w-4 h-4"></i>
              <span>Tạo công việc mới</span>
            </button>
            <div class="relative">
              <button onclick="toggleNotifications()" id="btn-notif" class="p-2 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100 relative">
                <i data-lucide="bell" class="w-5 h-5"></i>
                <span id="notif-badge" class="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white hidden"></span>
              </button>
              <div id="notif-dropdown" class="hidden absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50">
                <div class="px-4 py-2 border-b flex justify-between items-center">
                  <span class="font-bold text-xs text-slate-700">Thông báo mới</span>
                  <button onclick="markAllNotificationsRead()" class="text-[11px] text-indigo-600 hover:underline">Đã đọc tất cả</button>
                </div>
                <div id="notif-list" class="max-h-80 overflow-y-auto divide-y divide-slate-50 text-xs"></div>
              </div>
            </div>
          </div>
        </header>

        <!-- ROUTER VIEW CONTENT -->
        <main id="content-view" class="flex-1 overflow-y-auto p-6 bg-slate-50">
          <!-- Dynamically Rendered -->
        </main>
      </div>

      <!-- SIDE DRAWER FOR TASK DETAIL -->
      <div id="task-drawer" class="fixed inset-y-0 right-0 w-full max-w-xl bg-white shadow-2xl z-50 transform translate-x-full transition-transform duration-300 border-l border-slate-200 flex flex-col">
        <!-- Rendered dynamically -->
      </div>
      <div id="drawer-overlay" onclick="closeDrawer()" class="fixed inset-0 bg-slate-900/40 z-40 hidden backdrop-blur-sm transition-opacity"></div>

      <!-- MODAL FOR CREATE/EDIT -->
      <div id="task-modal" class="fixed inset-0 z-50 flex items-center justify-center p-4 hidden">
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onclick="closeTaskModal()"></div>
        <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto z-10 border border-slate-100">
          <!-- Modal content rendered dynamically -->
        </div>
      </div>
    </div>
  `;

  initLucide();
  navigateView(state.currentView);
  pollNotifications();
}

function navigateView(viewName) {
  state.currentView = viewName;
  const titleMap = {
    "dashboard": "Tổng quan vận hành",
    "tasks": "Danh sách công việc",
    "reports": "Báo cáo tiến độ & cam kết",
    "admin-users": "Quản trị tài khoản & phân quyền"
  };
  const titleEl = document.getElementById("topbar-title");
  if (titleEl) titleEl.innerText = titleMap[viewName] || APP_CONFIG.APP_NAME;

  if (viewName === "dashboard") renderDashboardView();
  else if (viewName === "tasks") renderTasksView();
  else if (viewName === "reports") renderReportsView();
  else if (viewName === "admin-users") renderAdminUsersView();

  initLucide();
}

function setQuickFilter(type) {
  if (type === "myTasks") {
    state.filters.myTasksOnly = !state.filters.myTasksOnly;
    state.filters.retractedOnly = false;
  } else if (type === "retracted") {
    state.filters.retractedOnly = !state.filters.retractedOnly;
    state.filters.myTasksOnly = false;
  }
  navigateView("tasks");
}

// ==========================================
// 5. DASHBOARD VIEW
// ==========================================

async function renderDashboardView() {
  const container = document.getElementById("content-view");
  container.innerHTML = `
    <div class="space-y-6">
      <!-- KPI CARDS -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4" id="kpi-container">
        <div class="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs animate-pulse h-24"></div>
        <div class="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs animate-pulse h-24"></div>
        <div class="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs animate-pulse h-24"></div>
        <div class="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs animate-pulse h-24"></div>
        <div class="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs animate-pulse h-24"></div>
        <div class="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs animate-pulse h-24"></div>
      </div>

      <!-- CHARTS SECTION -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <h3 class="font-bold text-sm text-slate-800 mb-4">Cơ cấu trạng thái công việc</h3>
          <div class="h-64"><canvas id="chart-status"></canvas></div>
        </div>
        <div class="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <h3 class="font-bold text-sm text-slate-800 mb-4">Phân bổ công việc theo cơ sở</h3>
          <div class="h-64"><canvas id="chart-base"></canvas></div>
        </div>
      </div>

      <!-- RECENT TASKS -->
      <div class="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-sm text-slate-800">Công việc mới cập nhật</h3>
          <button onclick="navigateView('tasks')" class="text-xs font-semibold text-indigo-600 hover:underline">Xem tất cả</button>
        </div>
        <div id="dashboard-recent-tasks" class="divide-y divide-slate-100"></div>
      </div>
    </div>
  `;

  try {
    const res = await callApi("getDashboardData");
    if (res.success) {
      renderDashboardKpis(res.kpi);
      renderDashboardRecent(res.recentTasks);
      renderDashboardCharts();
    }
  } catch (e) {}
}

function renderDashboardKpis(kpi) {
  const container = document.getElementById("kpi-container");
  if (!container) return;
  container.innerHTML = `
    <div class="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
      <div class="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold"><i data-lucide="layers" class="w-5 h-5"></i></div>
      <div><p class="text-[11px] text-slate-500 uppercase font-semibold">Tổng số việc</p><p class="text-xl font-bold text-slate-800">${kpi.total}</p></div>
    </div>
    <div class="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
      <div class="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold"><i data-lucide="clock" class="w-5 h-5"></i></div>
      <div><p class="text-[11px] text-slate-500 uppercase font-semibold">Chưa làm</p><p class="text-xl font-bold text-slate-800">${kpi.notStarted}</p></div>
    </div>
    <div class="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
      <div class="w-10 h-10 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold"><i data-lucide="play" class="w-5 h-5"></i></div>
      <div><p class="text-[11px] text-slate-500 uppercase font-semibold">Đang xử lý</p><p class="text-xl font-bold text-slate-800">${kpi.inProgress}</p></div>
    </div>
    <div class="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
      <div class="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold"><i data-lucide="check-circle" class="w-5 h-5"></i></div>
      <div><p class="text-[11px] text-slate-500 uppercase font-semibold">Hoàn thành</p><p class="text-xl font-bold text-emerald-600">${kpi.completed}</p></div>
    </div>
    <div class="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
      <div class="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold"><i data-lucide="alert-triangle" class="w-5 h-5"></i></div>
      <div><p class="text-[11px] text-slate-500 uppercase font-semibold">Sắp đến hạn</p><p class="text-xl font-bold text-amber-600">${kpi.upcoming}</p></div>
    </div>
    <div class="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
      <div class="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold"><i data-lucide="alert-octagon" class="w-5 h-5"></i></div>
      <div><p class="text-[11px] text-slate-500 uppercase font-semibold">Quá hạn</p><p class="text-xl font-bold text-rose-600">${kpi.overdue}</p></div>
    </div>
  `;
  initLucide();
}

function renderDashboardRecent(recent) {
  const container = document.getElementById("dashboard-recent-tasks");
  if (!container) return;
  if (!recent || recent.length === 0) {
    container.innerHTML = `<div class="py-6 text-center text-xs text-slate-400">Chưa có công việc nào gần đây</div>`;
    return;
  }

  container.innerHTML = recent.map(t => {
    const status = state.metadata.statuses.find(s => s.StatusCode === t.StatusCode) || { StatusName: t.StatusCode, Color: "#94A3B8" };
    return `
      <div onclick="openTaskDetail('${t.TaskID}')" class="py-3 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg cursor-pointer transition">
        <div class="flex items-center space-x-3">
          <span class="font-mono text-xs text-indigo-600 font-bold">${t.TaskCode}</span>
          <span class="text-xs font-medium text-slate-800">${t.ActionName || "(Chưa đặt tên hành động)"}</span>
        </div>
        <div class="flex items-center space-x-3">
          <span class="text-[11px] text-slate-400">${t.ToDate ? formatDate(t.ToDate) : "Không có hạn"}</span>
          <span class="text-[11px] px-2 py-0.5 rounded-full font-medium" style="background-color: ${status.Color}20; color: ${status.Color}">
            ${status.StatusName}
          </span>
        </div>
      </div>
    `;
  }).join("");
}

async function renderDashboardCharts() {
  const res = await callApi("getReportData", { filters: {} });
  if (!res.success) return;

  const ctxStatus = document.getElementById("chart-status");
  const ctxBase = document.getElementById("chart-base");

  if (ctxStatus) {
    new Chart(ctxStatus, {
      type: "doughnut",
      data: {
        labels: Object.keys(res.statusStats),
        datasets: [{
          data: Object.values(res.statusStats),
          backgroundColor: ["#94A3B8", "#38BDF8", "#FBBF24", "#F87171", "#34D399", "#64748B"]
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  if (ctxBase) {
    new Chart(ctxBase, {
      type: "bar",
      data: {
        labels: Object.keys(res.baseStats),
        datasets: [{
          label: "Số việc",
          data: Object.values(res.baseStats),
          backgroundColor: "#4F46E5"
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
}

// ==========================================
// 6. TASKS VIEW (TABLE & KANBAN)
// ==========================================

async function renderTasksView() {
  const container = document.getElementById("content-view");
  container.innerHTML = `
    <div class="space-y-4">
      <!-- FILTER TOOLBAR -->
      <div class="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-wrap gap-3 items-center justify-between">
        <div class="flex flex-wrap gap-2 items-center flex-1">
          <div class="relative min-w-[200px]">
            <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3 top-2.5"></i>
            <input type="text" id="task-search-input" value="${state.filters.search}" oninput="handleSearchTasks(this.value)" placeholder="Tìm mã việc, tên hành động..." class="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-1 focus:ring-indigo-500 outline-none">
          </div>
          <select id="filter-base" onchange="handleFilterChange('baseId', this.value)" class="py-1.5 px-3 rounded-lg border border-slate-200 text-xs bg-white text-slate-700 outline-none">
            <option value="">Tất cả Cơ sở</option>
            ${state.metadata.bases.map(b => `<option value="${b.BaseID}" ${state.filters.baseId === b.BaseID ? "selected" : ""}>${b.BaseName}</option>`).join("")}
          </select>
          <select id="filter-plangroup" onchange="handleFilterChange('planGroupId', this.value)" class="py-1.5 px-3 rounded-lg border border-slate-200 text-xs bg-white text-slate-700 outline-none">
            <option value="">Tất cả Nhóm kế hoạch</option>
            ${state.metadata.planGroups.map(pg => `<option value="${pg.PlanGroupID}" ${state.filters.planGroupId === pg.PlanGroupID ? "selected" : ""}>${pg.PlanGroupName}</option>`).join("")}
          </select>
          <select id="filter-status" onchange="handleFilterChange('statusCode', this.value)" class="py-1.5 px-3 rounded-lg border border-slate-200 text-xs bg-white text-slate-700 outline-none">
            <option value="">Tất cả Trạng thái</option>
            ${state.metadata.statuses.map(s => `<option value="${s.StatusCode}" ${state.filters.statusCode === s.StatusCode ? "selected" : ""}>${s.StatusName}</option>`).join("")}
          </select>
        </div>

        <div class="flex items-center space-x-2">
          <button onclick="toggleKanbanView(false)" class="p-2 rounded-lg border text-xs font-semibold ${!state.activeKanbanView ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'text-slate-500 hover:bg-slate-50'}">
            <i data-lucide="list" class="w-4 h-4"></i>
          </button>
          <button onclick="toggleKanbanView(true)" class="p-2 rounded-lg border text-xs font-semibold ${state.activeKanbanView ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'text-slate-500 hover:bg-slate-50'}">
            <i data-lucide="kanban" class="w-4 h-4"></i>
          </button>
        </div>
      </div>

      <!-- MAIN CONTAINER: TABLE OR KANBAN -->
      <div id="tasks-list-container">
        <!-- Rendered dynamically -->
      </div>
    </div>
  `;

  initLucide();
  await loadAndRenderTasks();
}

async function loadAndRenderTasks() {
  const res = await callApi("getTasks", { filters: state.filters });
  if (res.success) {
    state.tasks = res.tasks || [];
    if (state.activeKanbanView) {
      renderKanban();
    } else {
      renderTable();
    }
  }
}

function handleSearchTasks(val) {
  state.filters.search = val;
  loadAndRenderTasks();
}

function handleFilterChange(key, val) {
  state.filters[key] = val;
  loadAndRenderTasks();
}

function toggleKanbanView(isKanban) {
  state.activeKanbanView = isKanban;
  if (isKanban) renderKanban();
  else renderTable();
  initLucide();
}

function renderTable() {
  const container = document.getElementById("tasks-list-container");
  if (!container) return;

  if (state.tasks.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <i data-lucide="folder-open" class="w-12 h-12 text-slate-300 mx-auto mb-3"></i>
        <h4 class="font-bold text-sm text-slate-700">Không tìm thấy công việc nào</h4>
        <p class="text-xs text-slate-400 mt-1">Thử thay đổi bộ lọc hoặc tạo công việc mới để bắt đầu.</p>
      </div>
    `;
    initLucide();
    return;
  }

  container.innerHTML = `
    <div class="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-x-auto">
      <table class="w-full text-left border-collapse text-xs">
        <thead>
          <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
            <th class="py-3 px-4">Mã việc</th>
            <th class="py-3 px-4">Hành động</th>
            <th class="py-3 px-4">Cơ sở</th>
            <th class="py-3 px-4">Nhóm kế hoạch</th>
            <th class="py-3 px-4">PIC</th>
            <th class="py-3 px-4">Hạn hoàn thành</th>
            <th class="py-3 px-4">Trạng thái</th>
            <th class="py-3 px-4 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 font-medium">
          ${state.tasks.map(t => {
            const status = state.metadata.statuses.find(s => s.StatusCode === t.StatusCode) || { StatusName: t.StatusCode, Color: "#94A3B8" };
            const pic = state.users.find(u => u.UserID === t.PICUserID);
            const base = state.metadata.bases.find(b => b.BaseID === t.BaseID);
            const pg = state.metadata.planGroups.find(p => p.PlanGroupID === t.PlanGroupID);
            return `
              <tr class="hover:bg-slate-50/80 transition cursor-pointer" onclick="openTaskDetail('${t.TaskID}')">
                <td class="py-3 px-4 font-mono font-bold text-indigo-600">${t.TaskCode}</td>
                <td class="py-3 px-4 font-semibold text-slate-800">${t.ActionName || '<span class="text-slate-400 italic font-normal">Chưa nhập</span>'}</td>
                <td class="py-3 px-4 text-slate-600">${base ? base.BaseName : '<span class="text-slate-400 italic">--</span>'}</td>
                <td class="py-3 px-4 text-slate-600">${pg ? pg.PlanGroupName : '<span class="text-slate-400 italic">--</span>'}</td>
                <td class="py-3 px-4 text-slate-700">${pic ? pic.FullName : '<span class="text-slate-400 italic">--</span>'}</td>
                <td class="py-3 px-4 text-slate-600">${t.ToDate ? formatDate(t.ToDate) : '<span class="text-slate-400 italic">--</span>'}</td>
                <td class="py-3 px-4">
                  <span class="px-2.5 py-1 rounded-full text-[11px] font-semibold" style="background-color: ${status.Color}20; color: ${status.Color}">
                    ${status.StatusName}
                  </span>
                </td>
                <td class="py-3 px-4 text-right" onclick="event.stopPropagation()">
                  <button onclick="openTaskModal('${t.TaskID}')" class="p-1 hover:text-indigo-600 text-slate-400 transition" title="Chỉnh sửa"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
  initLucide();
}

function renderKanban() {
  const container = document.getElementById("tasks-list-container");
  if (!container) return;

  const statuses = state.metadata.statuses;
  container.innerHTML = `
    <div class="flex gap-4 overflow-x-auto pb-6 items-start">
      ${statuses.map(st => {
        const colTasks = state.tasks.filter(t => t.StatusCode === st.StatusCode);
        return `
          <div class="w-72 shrink-0 bg-slate-100 rounded-xl p-3 border border-slate-200 flex flex-col max-h-[75vh]" ondragover="allowDrop(event)" ondrop="handleDrop(event, '${st.StatusCode}')">
            <div class="flex items-center justify-between mb-3 px-1">
              <div class="flex items-center space-x-2">
                <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${st.Color}"></span>
                <span class="font-bold text-xs text-slate-800">${st.StatusName}</span>
              </div>
              <span class="text-[11px] font-bold bg-white px-2 py-0.5 rounded-full text-slate-500 shadow-2xs">${colTasks.length}</span>
            </div>
            <div class="flex-1 overflow-y-auto space-y-2 pr-1">
              ${colTasks.map(t => {
                const pic = state.users.find(u => u.UserID === t.PICUserID);
                return `
                  <div id="task-card-${t.TaskID}" draggable="true" ondragstart="handleDragStart(event, '${t.TaskID}')" onclick="openTaskDetail('${t.TaskID}')" class="bg-white p-3.5 rounded-lg border border-slate-200/80 shadow-2xs hover:shadow-md cursor-grab active:cursor-grabbing transition space-y-2">
                    <div class="flex justify-between items-center text-[10px]">
                      <span class="font-mono font-bold text-indigo-600">${t.TaskCode}</span>
                      <span class="text-slate-400">${t.ToDate ? formatDate(t.ToDate) : ""}</span>
                    </div>
                    <p class="text-xs font-semibold text-slate-800 line-clamp-2">${t.ActionName || "(Chưa nhập tên hành động)"}</p>
                    <div class="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                      <span>${pic ? pic.FullName : "Chưa gán"}</span>
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
  initLucide();
}

function handleDragStart(e, taskId) {
  e.dataTransfer.setData("text/plain", taskId);
}

function allowDrop(e) {
  e.preventDefault();
}

async function handleDrop(e, targetStatusCode) {
  e.preventDefault();
  const taskId = e.dataTransfer.getData("text/plain");
  const task = state.tasks.find(t => t.TaskID === taskId);
  if (task && task.StatusCode !== targetStatusCode) {
    const oldStatus = task.StatusCode;
    task.StatusCode = targetStatusCode;
    renderKanban();

    try {
      const res = await callApi("updateTaskStatus", { taskId: taskId, statusCode: targetStatusCode });
      if (!res.success) {
        task.StatusCode = oldStatus;
        renderKanban();
        showToast("Không thể cập nhật trạng thái", "error");
      }
    } catch (err) {
      task.StatusCode = oldStatus;
      renderKanban();
    }
  }
}

// ==========================================
// 7. TASK DETAILS & SIDE DRAWER
// ==========================================

async function openTaskDetail(taskId) {
  state.activeTaskId = taskId;
  const drawer = document.getElementById("task-drawer");
  const overlay = document.getElementById("drawer-overlay");

  drawer.innerHTML = `<div class="p-8 text-center text-xs text-slate-400">Đang tải chi tiết công việc...</div>`;
  drawer.classList.remove("translate-x-full");
  overlay.classList.remove("hidden");

  const res = await callApi("getTaskById", { taskId: taskId });
  if (!res.success) {
    closeDrawer();
    return;
  }

  const { task, assignments, recreations, comments } = res;
  const pic = state.users.find(u => u.UserID === task.PICUserID);
  const creator = state.users.find(u => u.UserID === task.CreatedByUserID);
  const status = state.metadata.statuses.find(s => s.StatusCode === task.StatusCode) || { StatusName: task.StatusCode, Color: "#94A3B8" };

  drawer.innerHTML = `
    <!-- DRAWER HEADER -->
    <div class="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
      <div class="flex items-center space-x-2">
        <span class="font-mono font-bold text-indigo-600 text-sm">${task.TaskCode}</span>
        <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold" style="background-color: ${status.Color}20; color: ${status.Color}">
          ${status.StatusName}
        </span>
        ${task.CommitmentStatus === "RETRACTED" ? '<span class="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold">ĐÃ RÚT LỜI HỨA</span>' : ''}
      </div>
      <button onclick="closeDrawer()" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition">
        <i data-lucide="x" class="w-5 h-5"></i>
      </button>
    </div>

    <!-- DRAWER BODY -->
    <div class="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
      <div>
        <h3 class="text-base font-bold text-slate-900">${task.ActionName || "(Chưa nhập hành động)"}</h3>
        ${task.LinkMasterPlan ? `<a href="${task.LinkMasterPlan}" target="_blank" class="text-indigo-600 hover:underline flex items-center space-x-1 mt-1 font-medium"><i data-lucide="external-link" class="w-3.5 h-3.5"></i><span>Xem Master Plan</span></a>` : ''}
      </div>

      <!-- METADATA GRID -->
      <div class="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
        <div><span class="text-slate-400 block text-[10px] uppercase font-bold">Người chịu trách nhiệm (PIC)</span><span class="font-semibold text-slate-700">${pic ? pic.FullName : "Chưa phân công"}</span></div>
        <div><span class="text-slate-400 block text-[10px] uppercase font-bold">Người tạo việc</span><span class="font-semibold text-slate-700">${creator ? creator.FullName : "Hệ thống"}</span></div>
        <div><span class="text-slate-400 block text-[10px] uppercase font-bold">Ngày bắt đầu</span><span class="font-semibold text-slate-700">${task.FromDate ? formatDate(task.FromDate) : "--"}</span></div>
        <div><span class="text-slate-400 block text-[10px] uppercase font-bold">Hạn hoàn thành</span><span class="font-semibold text-slate-700">${task.ToDate ? formatDate(task.ToDate) : "--"}</span></div>
        <div><span class="text-slate-400 block text-[10px] uppercase font-bold">Kết quả công việc</span><span class="font-semibold text-slate-700">${task.Result || "--"}</span></div>
      </div>

      <!-- EXTENSIONS / RECREATIONS HISTORY -->
      <div>
        <div class="flex justify-between items-center mb-2">
          <span class="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Lịch sử gia hạn (${recreations.length})</span>
          ${task.CommitmentStatus !== "RETRACTED" ? `<button onclick="openRecreateModal('${task.TaskID}')" class="text-indigo-600 hover:underline font-semibold">+ Gia hạn mới</button>` : ''}
        </div>
        ${recreations.length === 0 ? '<p class="text-slate-400 italic">Chưa có lần gia hạn nào.</p>' : `
          <div class="space-y-2">
            ${recreations.map(r => `
              <div class="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200/60 text-amber-900">
                <div class="flex justify-between font-semibold"><span>Hạn mới: ${formatDate(r.NewDueDate)}</span><span class="text-[10px] text-amber-700">${formatDate(r.CreatedAt)}</span></div>
                <p class="mt-1 text-slate-600">Lý do: ${r.Reason}</p>
              </div>
            `).join("")}
          </div>
        `}
      </div>

      <!-- COMMENTS SECTION -->
      <div>
        <span class="font-bold text-slate-800 uppercase tracking-wider text-[11px] block mb-3">Trao đổi & Bình luận</span>
        <div class="space-y-3 mb-4">
          ${comments.map(c => `
            <div class="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div class="flex justify-between font-semibold text-slate-800 mb-1">
                <span>${state.users.find(u => u.UserID === c.UserID)?.FullName || "Ẩn danh"}</span>
                <span class="text-[10px] text-slate-400 font-normal">${formatDate(c.CreatedAt)}</span>
              </div>
              <p class="text-slate-600 whitespace-pre-wrap">${c.Content}</p>
            </div>
          `).join("")}
        </div>
        <div class="flex gap-2">
          <input type="text" id="comment-input" placeholder="Viết phản hồi thảo luận..." class="flex-1 px-3 py-2 rounded-lg border text-xs outline-none focus:border-indigo-500">
          <button onclick="submitComment('${task.TaskID}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold shadow">Gửi</button>
        </div>
      </div>
    </div>

    <!-- DRAWER FOOTER ACTION -->
    <div class="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
      ${task.CommitmentStatus !== "RETRACTED" ? `
        <button onclick="handleRetractCommitmentPrompt('${task.TaskID}')" class="text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-lg font-semibold transition">Rút lại lời hứa</button>
      ` : `
        <button onclick="handleRestoreCommitment('${task.TaskID}')" class="text-emerald-600 hover:bg-emerald-50 px-3 py-2 rounded-lg font-semibold transition">Khôi phục cam kết</button>
      `}
      <button onclick="openTaskModal('${task.TaskID}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold shadow">Sửa công việc</button>
    </div>
  `;

  initLucide();
}

function closeDrawer() {
  document.getElementById("task-drawer").classList.add("translate-x-full");
  document.getElementById("drawer-overlay").classList.add("hidden");
  state.activeTaskId = null;
}

async function submitComment(taskId) {
  const input = document.getElementById("comment-input");
  const val = input.value.trim();
  if (!val) return;

  const res = await callApi("addComment", { taskId: taskId, content: val });
  if (res.success) {
    input.value = "";
    openTaskDetail(taskId);
  }
}

async function handleRetractCommitmentPrompt(taskId) {
  const reason = prompt("Vui lòng nhập lý do rút lại lời hứa cho công việc này:");
  if (reason === null) return;

  const res = await callApi("retractCommitment", { taskId: taskId, reason: reason });
  if (res.success) {
    showToast(res.message, "success");
    closeDrawer();
    loadAndRenderTasks();
  }
}

async function handleRestoreCommitment(taskId) {
  if (!confirm("Bạn có chắc chắn muốn khôi phục công việc này lại trạng thái cam kết hoạt động?")) return;
  const res = await callApi("restoreCommitment", { taskId: taskId });
  if (res.success) {
    showToast(res.message, "success");
    closeDrawer();
    loadAndRenderTasks();
  }
}

// ==========================================
// 8. CREATE & EDIT MODAL (12 OPTIONAL FIELDS)
// ==========================================

function openTaskModal(taskId = null) {
  const modal = document.getElementById("task-modal");
  const isEdit = !!taskId;
  const task = isEdit ? state.tasks.find(t => t.TaskID === taskId) : {};

  modal.querySelector("div.bg-white").innerHTML = `
    <div class="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
      <h3 class="font-bold text-sm text-slate-800">${isEdit ? "Cập nhật công việc" : "Tạo công việc mới"}</h3>
      <button onclick="closeTaskModal()" class="text-slate-400 hover:text-slate-600"><i data-lucide="x" class="w-5 h-5"></i></button>
    </div>
    <form onsubmit="handleSaveTask(event, '${taskId || ""}')" class="p-6 space-y-4 text-xs">
      <p class="text-[11px] text-indigo-600 bg-indigo-50 p-2.5 rounded-lg mb-2">Tất cả 12 trường bên dưới hoàn toàn tùy chọn và có thể để trống khi tạo mới.</p>

      <div>
        <label class="block font-semibold text-slate-700 mb-1">Tên hành động</label>
        <input type="text" id="form-actionName" value="${task.ActionName || ""}" placeholder="Mô tả tóm tắt hành động thực hiện" class="w-full px-3 py-2 rounded-lg border">
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Tháng thực hiện</label>
          <input type="text" id="form-month" value="${task.Month || ""}" placeholder="Tháng 11/2026" class="w-full px-3 py-2 rounded-lg border">
        </div>
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Cơ sở</label>
          <select id="form-baseId" class="w-full px-3 py-2 rounded-lg border bg-white">
            <option value="">-- Chọn cơ sở --</option>
            ${state.metadata.bases.map(b => `<option value="${b.BaseID}" ${task.BaseID === b.BaseID ? "selected" : ""}>${b.BaseName}</option>`).join("")}
          </select>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Nhóm kế hoạch</label>
          <select id="form-planGroupId" class="w-full px-3 py-2 rounded-lg border bg-white">
            <option value="">-- Chọn nhóm kế hoạch --</option>
            ${state.metadata.planGroups.map(pg => `<option value="${pg.PlanGroupID}" ${task.PlanGroupID === pg.PlanGroupID ? "selected" : ""}>${pg.PlanGroupName}</option>`).join("")}
          </select>
        </div>
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Người chịu trách nhiệm (PIC)</label>
          <select id="form-picUserId" class="w-full px-3 py-2 rounded-lg border bg-white">
            <option value="">-- Chọn PIC --</option>
            ${state.users.map(u => `<option value="${u.UserID}" ${task.PICUserID === u.UserID ? "selected" : ""}>${u.FullName} (${u.Role})</option>`).join("")}
          </select>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Từ ngày</label>
          <input type="date" id="form-fromDate" value="${task.FromDate || ""}" class="w-full px-3 py-2 rounded-lg border">
        </div>
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Đến ngày</label>
          <input type="date" id="form-toDate" value="${task.ToDate || ""}" class="w-full px-3 py-2 rounded-lg border">
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Trạng thái công việc</label>
          <select id="form-statusCode" class="w-full px-3 py-2 rounded-lg border bg-white">
            ${state.metadata.statuses.map(s => `<option value="${s.StatusCode}" ${task.StatusCode === s.StatusCode ? "selected" : ""}>${s.StatusName}</option>`).join("")}
          </select>
        </div>
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Link / Master Plan</label>
          <input type="text" id="form-linkMasterPlan" value="${task.LinkMasterPlan || ""}" placeholder="https://..." class="w-full px-3 py-2 rounded-lg border">
        </div>
      </div>

      <div>
        <label class="block font-semibold text-slate-700 mb-1">Kết quả công việc</label>
        <textarea id="form-result" rows="2" placeholder="Ghi nhận kết quả bàn giao" class="w-full px-3 py-2 rounded-lg border">${task.Result || ""}</textarea>
      </div>

      <div class="p-4 border-t border-slate-100 flex justify-end space-x-2 pt-4">
        <button type="button" onclick="closeTaskModal()" class="px-4 py-2 border rounded-lg hover:bg-slate-50 font-semibold">Hủy bỏ</button>
        <button type="submit" class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-semibold shadow">Lưu dữ liệu</button>
      </div>
    </form>
  `;

  modal.classList.remove("hidden");
  initLucide();
}

function closeTaskModal() {
  document.getElementById("task-modal").classList.add("hidden");
}

async function handleSaveTask(e, taskId) {
  e.preventDefault();
  const payload = {
    actionName: document.getElementById("form-actionName").value.trim(),
    month: document.getElementById("form-month").value.trim(),
    baseId: document.getElementById("form-baseId").value,
    planGroupId: document.getElementById("form-planGroupId").value,
    picUserId: document.getElementById("form-picUserId").value,
    fromDate: document.getElementById("form-fromDate").value,
    toDate: document.getElementById("form-toDate").value,
    statusCode: document.getElementById("form-statusCode").value,
    linkMasterPlan: document.getElementById("form-linkMasterPlan").value.trim(),
    result: document.getElementById("form-result").value.trim()
  };

  const action = taskId ? "updateTask" : "createTask";
  if (taskId) payload.taskId = taskId;

  const res = await callApi(action, payload);
  if (res.success) {
    showToast(res.message, "success");
    closeTaskModal();
    if (taskId && state.activeTaskId === taskId) {
      openTaskDetail(taskId);
    }
    loadAndRenderTasks();
  }
}

// ==========================================
// 9. REPORTS VIEW
// ==========================================

async function renderReportsView() {
  const container = document.getElementById("content-view");
  container.innerHTML = `
    <div class="space-y-6">
      <div class="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex justify-between items-center">
        <div>
          <h3 class="font-bold text-sm text-slate-800">Xuất dữ liệu & Thống kê</h3>
          <p class="text-xs text-slate-400">Trích xuất báo cáo công việc và tình trạng cam kết</p>
        </div>
        <button onclick="exportTasksToCsv()" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow flex items-center space-x-1.5">
          <i data-lucide="download" class="w-4 h-4"></i>
          <span>Tải file CSV báo cáo</span>
        </button>
      </div>

      <div class="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs">
        <h4 class="font-bold text-xs text-slate-700 mb-4 uppercase tracking-wider">Tiến độ theo từng nhân sự</h4>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px]">
              <tr>
                <th class="p-3">Họ và tên</th>
                <th class="p-3">Tổng việc</th>
                <th class="p-3">Đã xong</th>
                <th class="p-3">Đang làm</th>
                <th class="p-3">Tỷ lệ hoàn thành</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-medium">
              ${state.users.map(u => {
                const userTasks = state.tasks.filter(t => t.PICUserID === u.UserID);
                const done = userTasks.filter(t => t.StatusCode === "COMPLETED").length;
                const inProg = userTasks.filter(t => t.StatusCode === "IN_PROGRESS").length;
                const rate = userTasks.length > 0 ? Math.round((done / userTasks.length) * 100) : 0;
                return `
                  <tr>
                    <td class="p-3 font-semibold text-slate-800">${u.FullName}</td>
                    <td class="p-3">${userTasks.length}</td>
                    <td class="p-3 text-emerald-600">${done}</td>
                    <td class="p-3 text-sky-600">${inProg}</td>
                    <td class="p-3 font-bold ${rate >= 80 ? 'text-emerald-600' : 'text-slate-700'}">${rate}%</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  initLucide();
}

function exportTasksToCsv() {
  if (state.tasks.length === 0) return showToast("Không có dữ liệu để xuất", "warning");

  const headers = ["Mã việc", "Hành động", "Tháng", "PIC", "Hạn hoàn thành", "Trạng thái", "Kết quả"];
  const rows = state.tasks.map(t => {
    const pic = state.users.find(u => u.UserID === t.PICUserID);
    return [
      `"${t.TaskCode}"`,
      `"${(t.ActionName || "").replace(/"/g, '""')}"`,
      `"${t.Month || ""}"`,
      `"${pic ? pic.FullName : ""}"`,
      `"${t.ToDate || ""}"`,
      `"${t.StatusCode}"`,
      `"${(t.Result || "").replace(/"/g, '""')}"`
    ];
  });

  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `BaoCaoCongViec_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ==========================================
// 10. ADMIN MANAGEMENT VIEW
// ==========================================

async function renderAdminUsersView() {
  const container = document.getElementById("content-view");
  container.innerHTML = `
    <div class="bg-white rounded-xl border border-slate-200/80 shadow-xs p-6 space-y-4">
      <div class="flex justify-between items-center mb-4">
        <div>
          <h3 class="font-bold text-sm text-slate-800">Danh sách tài khoản nội bộ</h3>
          <p class="text-xs text-slate-400">Duyệt tài khoản mới đăng ký, phân bổ vai trò và phòng ban</p>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead class="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px]">
            <tr>
              <th class="p-3">Họ và tên</th>
              <th class="p-3">Username</th>
              <th class="p-3">Email</th>
              <th class="p-3">Vai trò</th>
              <th class="p-3">Trạng thái</th>
              <th class="p-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 font-medium">
            ${state.users.map(u => `
              <tr>
                <td class="p-3 font-semibold text-slate-800">${u.FullName}</td>
                <td class="p-3 font-mono text-slate-600">${u.Username}</td>
                <td class="p-3 text-slate-600">${u.Email}</td>
                <td class="p-3 font-bold text-indigo-600">${u.Role}</td>
                <td class="p-3">
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold ${u.AccountStatus === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : u.AccountStatus === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}">
                    ${u.AccountStatus}
                  </span>
                </td>
                <td class="p-3 text-right space-x-1">
                  ${u.AccountStatus === 'PENDING' ? `
                    <button onclick="handleApproveUser('${u.UserID}')" class="bg-emerald-600 text-white px-2.5 py-1 rounded hover:bg-emerald-700 transition">Duyệt</button>
                    <button onclick="handleRejectUser('${u.UserID}')" class="bg-rose-600 text-white px-2.5 py-1 rounded hover:bg-rose-700 transition">Từ chối</button>
                  ` : `
                    <button onclick="handleToggleLockUser('${u.UserID}', ${u.AccountStatus === 'ACTIVE'})" class="text-slate-500 hover:text-slate-800 border px-2 py-1 rounded transition">
                      ${u.AccountStatus === 'ACTIVE' ? 'Khóa' : 'Mở khóa'}
                    </button>
                  `}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
  initLucide();
}

async function handleApproveUser(userId) {
  const role = prompt("Nhập vai trò cấp cho nhân sự (MEMBER, TEAM_LEADER, DEPARTMENT_MANAGER, ADMIN):", "MEMBER");
  if (!role) return;

  const res = await callApi("approveUser", { userId: userId, role: role });
  if (res.success) {
    showToast(res.message, "success");
    await loadInitialData();
    renderAdminUsersView();
  }
}

async function handleRejectUser(userId) {
  if (!confirm("Bạn có chắc chắn muốn từ chối tài khoản này?")) return;
  const res = await callApi("rejectUser", { userId: userId });
  if (res.success) {
    showToast(res.message, "success");
    await loadInitialData();
    renderAdminUsersView();
  }
}

async function handleToggleLockUser(userId, currentActive) {
  const action = currentActive ? "lockUser" : "unlockUser";
  const res = await callApi(action, { userId: userId });
  if (res.success) {
    showToast(res.message, "success");
    await loadInitialData();
    renderAdminUsersView();
  }
}

// ==========================================
// 11. NOTIFICATIONS & UTILITIES
// ==========================================

async function toggleNotifications() {
  const dd = document.getElementById("notif-dropdown");
  dd.classList.toggle("hidden");
  if (!dd.classList.contains("hidden")) {
    const res = await callApi("getNotifications");
    if (res.success) {
      renderNotificationList(res.notifications);
    }
  }
}

function renderNotificationList(list) {
  const container = document.getElementById("notif-list");
  if (!list || list.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-slate-400">Không có thông báo mới</div>`;
    return;
  }
  container.innerHTML = list.map(n => `
    <div class="p-3 hover:bg-slate-50 cursor-pointer ${n.IsRead === 'FALSE' ? 'bg-indigo-50/40' : ''}" onclick="handleClickNotification('${n.NotificationID}', '${n.RelatedTaskID}')">
      <p class="font-bold text-slate-800">${n.Title}</p>
      <p class="text-slate-600 mt-0.5">${n.Message}</p>
      <span class="text-[10px] text-slate-400 mt-1 block">${formatDate(n.CreatedAt)}</span>
    </div>
  `).join("");
}

async function handleClickNotification(notifId, taskId) {
  await callApi("markNotificationRead", { notificationId: notifId });
  document.getElementById("notif-dropdown").classList.add("hidden");
  if (taskId) {
    openTaskDetail(taskId);
  }
}

async function markAllNotificationsRead() {
  await callApi("markAllNotificationsRead");
  document.getElementById("notif-badge").classList.add("hidden");
  toggleNotifications();
}

async function pollNotifications() {
  try {
    const res = await callApi("getNotifications");
    if (res.success && res.notifications) {
      const unread = res.notifications.some(n => n.IsRead === "FALSE");
      const badge = document.getElementById("notif-badge");
      if (badge) {
        if (unread) badge.classList.remove("hidden");
        else badge.classList.add("hidden");
      }
    }
  } catch (e) {}
}

function showToast(msg, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const colors = {
    success: "bg-emerald-600 text-white",
    error: "bg-rose-600 text-white",
    warning: "bg-amber-500 text-white",
    info: "bg-slate-800 text-white"
  };
  const toast = document.createElement("div");
  toast.className = `${colors[type]} px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center space-x-2 transition-all duration-300 transform translate-y-2 opacity-0`;
  toast.innerHTML = `<span>${msg}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove("translate-y-2", "opacity-0");
  }, 10);

  setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-2");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function showGlobalLoading(isLoading) {
  const loader = document.getElementById("global-loader");
  if (loader) {
    if (isLoading) loader.classList.remove("hidden");
    else loader.classList.add("hidden");
  }
}

function formatDate(isoStr) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return `${("0" + d.getDate()).slice(-2)}/${("0" + (d.getMonth() + 1)).slice(-2)}/${d.getFullYear()}`;
  } catch (e) {
    return isoStr;
  }
}
