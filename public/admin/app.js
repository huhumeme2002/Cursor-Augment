// API Configuration
const API_BASE = window.location.origin + '/api';
let authToken = localStorage.getItem('admin_token');
let allKeys = [];

// DOM Elements
const loginPage = document.getElementById('loginPage');
const dashboardPage = document.getElementById('dashboardPage');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const createKeyBtn = document.getElementById('createKeyBtn');
const quickKeyBtn = document.getElementById('quickKeyBtn');
const createKeyModal = document.getElementById('createKeyModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelCreateBtn = document.getElementById('cancelCreateBtn');
const createKeyForm = document.getElementById('createKeyForm');
const searchInput = document.getElementById('searchInput');
const keysTableBody = document.getElementById('keysTableBody');

// Settings DOM Elements
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
const settingsForm = document.getElementById('settingsForm');
const apiUrlInput = document.getElementById('apiUrlInput');
const apiKeyInput = document.getElementById('apiKeyInput');
const modelDisplayInput = document.getElementById('modelDisplayInput');
const modelActualInput = document.getElementById('modelActualInput');
const settingsError = document.getElementById('settingsError');
const settingsSuccess = document.getElementById('settingsSuccess');

// Initialize
if (authToken) {
    showDashboard();
    loadKeys();
} else {
    showLogin();
}

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('passwordInput').value;
    loginError.classList.add('hidden');

    try {
        const response = await fetch(`${API_BASE}/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        const data = await response.json();

        if (response.ok) {
            authToken = data.token;
            localStorage.setItem('admin_token', authToken);
            showDashboard();
            loadKeys();
        } else {
            loginError.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Login error:', error);
        loginError.textContent = 'Lỗi kết nối server';
        loginError.classList.remove('hidden');
    }
});

// Logout
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('admin_token');
    authToken = null;
    showLogin();
});

// Show/Hide Pages
function showLogin() {
    loginPage.classList.remove('hidden');
    dashboardPage.classList.add('hidden');
}

function showDashboard() {
    loginPage.classList.add('hidden');
    dashboardPage.classList.remove('hidden');
}

// Load Keys
async function loadKeys() {
    try {
        const response = await fetch(`${API_BASE}/admin/keys/list`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.status === 401) {
            logout();
            return;
        }

        const data = await response.json();
        allKeys = data.keys || [];

        // Update stats
        document.getElementById('statTotal').textContent = data.stats.total_keys;
        document.getElementById('statActive').textContent = data.stats.active_keys;
        document.getElementById('statExpired').textContent = data.stats.expired_keys;
        document.getElementById('statActivations').textContent = data.stats.total_activations;

        // Render table
        renderKeysTable(allKeys);
    } catch (error) {
        console.error('Load keys error:', error);
        keysTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="px-6 py-8 text-center text-red-500">
          <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
          <p>Lỗi tải dữ liệu</p>
        </td>
      </tr>
    `;
    }
}

// Render Keys Table
function renderKeysTable(keys) {
    if (keys.length === 0) {
        keysTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="px-6 py-8 text-center text-gray-500">
          <i class="fas fa-inbox text-4xl mb-2"></i>
          <p>Chưa có key nào</p>
        </td>
      </tr>
    `;
        return;
    }

    keysTableBody.innerHTML = keys.map(key => {
        const usagePercent = Math.min(100, Math.round((key.current_usage / key.daily_limit) * 100));
        let progressColor = 'bg-blue-500';
        if (usagePercent > 80) progressColor = 'bg-yellow-500';
        if (usagePercent >= 100) progressColor = 'bg-red-500';

        const statusBadge = key.is_expired
            ? '<span class="px-3 py-1 bg-red-100 text-red-600 rounded-full text-xs font-semibold">Hết hạn</span>'
            : key.is_active
                ? '<span class="px-3 py-1 bg-green-100 text-green-600 rounded-full text-xs font-semibold">Hoạt động</span>'
                : '<span class="px-3 py-1 bg-red-100 text-red-600 rounded-full text-xs font-semibold">Hết lượt</span>';

        return `
      <tr class="transition">
        <td class="px-6 py-4">
          <div class="flex items-center">
            <i class="fas fa-key text-purple-500 mr-3"></i>
            <span class="font-medium text-gray-800">${key.name}</span>
          </div>
        </td>
        <td class="px-6 py-4">${statusBadge}</td>
        <td class="px-6 py-4 text-gray-600">${formatDate(key.expiry)}</td>
        <td class="px-6 py-4">
          <div class="flex flex-col w-full">
            <div class="flex justify-between text-xs mb-1">
              <span class="font-semibold text-gray-700">${key.current_usage} / ${key.daily_limit}</span>
              <span class="text-gray-500">${usagePercent}%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-1.5">
              <div class="${progressColor} h-1.5 rounded-full" style="width: ${usagePercent}%"></div>
            </div>
          </div>
        </td>
        <td class="px-6 py-4 text-right">
          <button onclick="copyKey('${key.name}')" class="text-blue-500 hover:text-blue-700 mr-3" title="Copy Key">
            <i class="fas fa-copy"></i>
          </button>
          <button onclick="deleteKey('${key.name}')" class="text-red-500 hover:text-red-700" title="Xóa">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
    }).join('');
}

// Removed showDeviceIds function as it's no longer needed

// Format Date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN');
}

// Search
searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filtered = allKeys.filter(key =>
        key.name.toLowerCase().includes(searchTerm)
    );
    renderKeysTable(filtered);
});

// Create Key Modal
createKeyBtn.addEventListener('click', () => {
    createKeyModal.classList.remove('hidden');
    // Set default expiry to 1 year from now
    const oneYearLater = new Date();
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    document.getElementById('expiryInput').value = oneYearLater.toISOString().split('T')[0];
});

closeModalBtn.addEventListener('click', () => {
    createKeyModal.classList.add('hidden');
});

cancelCreateBtn.addEventListener('click', () => {
    createKeyModal.classList.add('hidden');
});

// Create Key Form
createKeyForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    let keyName = document.getElementById('keyNameInput').value.trim();
    const expiry = document.getElementById('expiryInput').value;
    const dailyLimit = parseInt(document.getElementById('maxActivationsInput').value);
    const errorDiv = document.getElementById('createKeyError');

    // Generate random key if name is empty
    if (!keyName) {
        keyName = generateRandomKey();
    }

    errorDiv.classList.add('hidden');

    try {
        const response = await fetch(`${API_BASE}/admin/keys/create`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: keyName,
                expiry,
                daily_limit: dailyLimit
            })
        });

        const data = await response.json();

        if (response.ok) {
            createKeyModal.classList.add('hidden');
            createKeyForm.reset();
            loadKeys();

            // Show success notification
            const message = `✅ Key đã được tạo thành công!\n\n🔑 Key: ${keyName}\n📈 Giới hạn: ${dailyLimit} lượt/ngày\n\nNhấn OK để copy key.`;

            if (confirm(message)) {
                copyToClipboard(keyName);
                alert('✅ Đã copy key!');
            }
        } else {
            errorDiv.textContent = data.error || 'Lỗi tạo key';
            errorDiv.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Create key error:', error);
        errorDiv.textContent = 'Lỗi kết nối server';
        errorDiv.classList.remove('hidden');
    }
});

// Generate Random Key
function generateRandomKey() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'key-';
    for (let i = 0; i < 12; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Copy Key
function copyKey(keyName) {
    copyToClipboard(keyName);
    alert(`✅ Đã copy key: ${keyName}`);
}

function copyToClipboard(text) {
    const tempInput = document.createElement('input');
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
}

// Delete Key
async function deleteKey(keyName) {
    if (!confirm(`Bạn có chắc muốn xóa key "${keyName}"?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/admin/keys/delete?name=${encodeURIComponent(keyName)}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            alert(`✅ Đã xóa key: ${keyName}`);
            loadKeys();
        } else {
            const data = await response.json();
            alert(`❌ Lỗi: ${data.error}`);
        }
    } catch (error) {
        console.error('Delete key error:', error);
        alert('❌ Lỗi kết nối server');
    }
}

// Logout helper
function logout() {
    localStorage.removeItem('admin_token');
    authToken = null;
    showLogin();
}

// =====================
// SETTINGS FUNCTIONALITY
// =====================

// =====================
// API PROFILES MANAGEMENT
// =====================

const PROFILES_STORAGE_KEY = 'api_profiles';

// Get all saved profiles from localStorage
function getProfiles() {
    const data = localStorage.getItem(PROFILES_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
}

// Save profiles to localStorage
function saveProfilesToStorage(profiles) {
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
}

// Load profile list into dropdown
function loadProfilesList() {
    const profiles = getProfiles();
    const select = document.getElementById('profileSelect');
    if (!select) return;

    select.innerHTML = '<option value="">-- Chọn Profile để áp dụng --</option>';

    Object.keys(profiles).forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    });
}

// Apply selected profile to form inputs
function applyProfile(profileName) {
    const profiles = getProfiles();
    const profile = profiles[profileName];
    if (!profile) return;

    apiUrlInput.value = profile.api_url || '';
    apiKeyInput.value = profile.api_key || '';
    modelDisplayInput.value = profile.model_display || '';
    modelActualInput.value = profile.model_actual || '';
    const systemPromptInput = document.getElementById('systemPromptInput');
    if (systemPromptInput) {
        systemPromptInput.value = profile.system_prompt || '';
    }

    // Show notification
    settingsSuccess.textContent = `✅ Đã áp dụng profile: ${profileName}`;
    settingsSuccess.classList.remove('hidden');
    setTimeout(() => settingsSuccess.classList.add('hidden'), 2000);
}

// Save current form as new profile
function saveCurrentAsProfile() {
    const name = prompt('Nhập tên profile:');
    if (!name || !name.trim()) return;

    const trimmedName = name.trim();
    const profiles = getProfiles();
    const systemPromptInput = document.getElementById('systemPromptInput');

    profiles[trimmedName] = {
        api_url: apiUrlInput.value,
        api_key: apiKeyInput.value,
        model_display: modelDisplayInput.value,
        model_actual: modelActualInput.value,
        system_prompt: systemPromptInput ? systemPromptInput.value : ''
    };

    saveProfilesToStorage(profiles);
    loadProfilesList();
    document.getElementById('profileSelect').value = trimmedName;

    settingsSuccess.textContent = `✅ Đã lưu profile: ${trimmedName}`;
    settingsSuccess.classList.remove('hidden');
    setTimeout(() => settingsSuccess.classList.add('hidden'), 2000);
}

// Delete selected profile
function deleteSelectedProfile() {
    const select = document.getElementById('profileSelect');
    const name = select.value;
    if (!name) {
        alert('Vui lòng chọn profile để xóa');
        return;
    }

    if (!confirm(`Xóa profile "${name}"?`)) return;

    const profiles = getProfiles();
    delete profiles[name];
    saveProfilesToStorage(profiles);
    loadProfilesList();

    settingsSuccess.textContent = `✅ Đã xóa profile: ${name}`;
    settingsSuccess.classList.remove('hidden');
    setTimeout(() => settingsSuccess.classList.add('hidden'), 2000);
}

// Profile event listeners
document.getElementById('profileSelect')?.addEventListener('change', (e) => {
    if (e.target.value) applyProfile(e.target.value);
});

document.getElementById('saveProfileBtn')?.addEventListener('click', saveCurrentAsProfile);
document.getElementById('deleteProfileBtn')?.addEventListener('click', deleteSelectedProfile);


// Open Settings Modal
settingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
    loadSettings();
    loadProfilesList();
});

// Close Settings Modal
closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
    hideSettingsMessages();
});

cancelSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
    hideSettingsMessages();
});

// Hide Settings Messages
function hideSettingsMessages() {
    settingsError.classList.add('hidden');
    settingsSuccess.classList.add('hidden');
}

// Load Settings
async function loadSettings() {
    try {
        const response = await fetch(`${API_BASE}/admin/settings/get`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.status === 401) {
            logout();
            return;
        }

        const data = await response.json();

        if (data.api_url) {
            apiUrlInput.value = data.api_url;
        }

        // Load model mapping
        if (data.model_display) {
            modelDisplayInput.value = data.model_display;
        }
        if (data.model_actual) {
            modelActualInput.value = data.model_actual;
        }

        // Load system prompt
        const systemPromptInput = document.getElementById('systemPromptInput');
        if (data.system_prompt && systemPromptInput) {
            systemPromptInput.value = data.system_prompt;
        }

        // Don't show masked key, let user enter new one if needed
        if (data.api_key_set) {
            apiKeyInput.placeholder = '(Đã cấu hình - nhập mới để thay đổi)';
        }
    } catch (error) {
        console.error('Load settings error:', error);
    }
}

// Save Settings
settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideSettingsMessages();

    const apiUrl = apiUrlInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    const modelDisplay = modelDisplayInput.value.trim() || 'Claude-Opus-4.5-VIP';
    const modelActual = modelActualInput.value.trim() || 'claude-3-5-haiku-20241022';
    const systemPromptInput = document.getElementById('systemPromptInput');
    const systemPrompt = systemPromptInput ? systemPromptInput.value.trim() : '';

    if (!apiUrl) {
        settingsError.textContent = 'Vui lòng nhập API URL';
        settingsError.classList.remove('hidden');
        return;
    }

    if (!apiKey) {
        settingsError.textContent = 'Vui lòng nhập API Key';
        settingsError.classList.remove('hidden');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/admin/settings/save`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                api_url: apiUrl,
                api_key: apiKey,
                model_display: modelDisplay,
                model_actual: modelActual,
                system_prompt: systemPrompt
            })
        });

        const data = await response.json();

        if (response.ok) {
            settingsSuccess.textContent = '✅ Settings đã được lưu thành công!';
            settingsSuccess.classList.remove('hidden');
            apiKeyInput.value = '';
            apiKeyInput.placeholder = '(Đã cấu hình - nhập mới để thay đổi)';

            // Auto close after 2 seconds
            setTimeout(() => {
                settingsModal.classList.add('hidden');
                hideSettingsMessages();
            }, 2000);
        } else {
            settingsError.textContent = data.error || 'Lỗi lưu settings';
            settingsError.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Save settings error:', error);
        settingsError.textContent = 'Lỗi kết nối server';
        settingsError.classList.remove('hidden');
    }
});

// =====================
// QUICK KEY GENERATION
// =====================

// Generate random key name
function generateRandomKeyName() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'key-';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Get date 1 month from now
function getOneMonthFromNow() {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date.toISOString().split('T')[0];
}

// Quick Key Button Handler
quickKeyBtn.addEventListener('click', async () => {
    const keyName = generateRandomKeyName();
    const expiry = getOneMonthFromNow();
    const maxActivations = 1;

    try {
        const response = await fetch(`${API_BASE}/admin/keys/create`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: keyName, // Changed from key_name to name to match existing createKeyForm logic
                expiry: expiry,
                max_activations: maxActivations
            })
        });

        if (response.ok) {
            const data = await response.json();
            alert(`✅ Đã tạo key nhanh thành công!\n\nKey: ${data.key_name || keyName}\nHết hạn: ${expiry}\nSố thiết bị: ${maxActivations}`);
            loadKeys();
        } else {
            const data = await response.json();
            alert(`❌ Lỗi: ${data.error}`);
        }
    } catch (error) {
        console.error('Quick key error:', error);
        alert('❌ Lỗi kết nối server');
    }
});

// =====================
// MODEL MANAGEMENT
// =====================

let editingModelId = null;

// Load models list
async function loadModels() {
    const modelsList = document.getElementById('modelsList');
    if (!modelsList) return;

    try {
        const response = await fetch(`${API_BASE}/admin/models/list`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) {
            modelsList.innerHTML = '<p class="text-sm text-red-400 text-center py-2">Lỗi tải danh sách model</p>';
            return;
        }

        const data = await response.json();

        if (!data.models || data.models.length === 0) {
            modelsList.innerHTML = '<p class="text-sm text-gray-400 text-center py-2">Chưa có model nào</p>';
            return;
        }

        modelsList.innerHTML = data.models.map(model => `
            <div class="flex items-center justify-between p-2 bg-white rounded border border-gray-200 hover:border-purple-300 transition">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                        <span class="font-medium text-sm text-gray-700">${model.name}</span>
                        <span class="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">${model.id}</span>
                    </div>
                    <p class="text-xs text-gray-500 truncate mt-0.5">${model.system_prompt ? model.system_prompt.substring(0, 50) + '...' : '(không có prompt)'}</p>
                </div>
                <div class="flex gap-1 ml-2">
                    <button onclick="editModel('${model.id}')" class="text-blue-500 hover:text-blue-700 p-1" title="Sửa">
                        <i class="fas fa-edit text-sm"></i>
                    </button>
                    <button onclick="deleteModel('${model.id}')" class="text-red-500 hover:text-red-700 p-1" title="Xóa">
                        <i class="fas fa-trash text-sm"></i>
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Load models error:', error);
        modelsList.innerHTML = '<p class="text-sm text-red-400 text-center py-2">Lỗi kết nối server</p>';
    }
}

// Show add model form
document.getElementById('addModelBtn')?.addEventListener('click', () => {
    editingModelId = null;
    document.getElementById('modelIdInput').value = '';
    document.getElementById('modelIdInput').disabled = false;
    document.getElementById('modelNameInput').value = '';
    document.getElementById('modelSystemPromptInput').value = '';
    document.getElementById('modelForm').classList.remove('hidden');
});

// Cancel model form
document.getElementById('cancelModelBtn')?.addEventListener('click', () => {
    document.getElementById('modelForm').classList.add('hidden');
    editingModelId = null;
});

// Edit model
async function editModel(modelId) {
    try {
        const response = await fetch(`${API_BASE}/admin/models/list`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) return;

        const data = await response.json();
        const model = data.models.find(m => m.id === modelId);

        if (!model) return;

        editingModelId = modelId;
        document.getElementById('modelIdInput').value = model.id;
        document.getElementById('modelIdInput').disabled = true;
        document.getElementById('modelNameInput').value = model.name;
        document.getElementById('modelSystemPromptInput').value = model.system_prompt || '';
        document.getElementById('modelForm').classList.remove('hidden');
    } catch (error) {
        console.error('Edit model error:', error);
    }
}

// Save model
document.getElementById('saveModelBtn')?.addEventListener('click', async () => {
    const modelId = document.getElementById('modelIdInput').value.trim();
    const modelName = document.getElementById('modelNameInput').value.trim();
    const systemPrompt = document.getElementById('modelSystemPromptInput').value;

    if (!modelId || !modelName) {
        alert('Vui lòng nhập Model ID và Tên hiển thị');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/admin/models/save`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model_id: editingModelId || modelId,
                name: modelName,
                system_prompt: systemPrompt
            })
        });

        const data = await response.json();

        if (response.ok) {
            document.getElementById('modelForm').classList.add('hidden');
            editingModelId = null;
            loadModels();
            settingsSuccess.textContent = `✅ Đã lưu model: ${modelName}`;
            settingsSuccess.classList.remove('hidden');
            setTimeout(() => settingsSuccess.classList.add('hidden'), 2000);
        } else {
            alert(`❌ Lỗi: ${data.error}`);
        }
    } catch (error) {
        console.error('Save model error:', error);
        alert('❌ Lỗi kết nối server');
    }
});

// Delete model
async function deleteModel(modelId) {
    if (!confirm(`Xóa model "${modelId}"?`)) return;

    try {
        const response = await fetch(`${API_BASE}/admin/models/delete?model_id=${encodeURIComponent(modelId)}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            loadModels();
            settingsSuccess.textContent = `✅ Đã xóa model: ${modelId}`;
            settingsSuccess.classList.remove('hidden');
            setTimeout(() => settingsSuccess.classList.add('hidden'), 2000);
        } else {
            const data = await response.json();
            alert(`❌ Lỗi: ${data.error}`);
        }
    } catch (error) {
        console.error('Delete model error:', error);
        alert('❌ Lỗi kết nối server');
    }
}

// Update settings modal open to also load models
const originalSettingsBtnHandler = settingsBtn.onclick;
settingsBtn.addEventListener('click', () => {
    loadModels();
});


// =====================
// TAB MANAGEMENT
// =====================

window.switchTab = function (tabName) {
    // Hide all contents
    ['keys', 'profiles', 'settings'].forEach(t => {
        const el = document.getElementById(`content-${t}`);
        if (el) el.classList.add('hidden');

        const btn = document.getElementById(`tab-${t}`);
        if (btn) {
            btn.classList.remove('bg-purple-100', 'text-purple-700');
            btn.classList.add('text-gray-600');
        }
    });

    // Show selected content
    const selectedContent = document.getElementById(`content-${tabName}`);
    if (selectedContent) selectedContent.classList.remove('hidden');

    const selectedBtn = document.getElementById(`tab-${tabName}`);
    if (selectedBtn) {
        selectedBtn.classList.remove('text-gray-600');
        selectedBtn.classList.add('bg-purple-100', 'text-purple-700');
    }

    // Load data if needed
    if (tabName === 'profiles') {
        loadAPIProfiles();
    } else if (tabName === 'keys') {
        loadKeys();
    }
}

// =====================
// API PROFILE UI MANAGEMENT
// =====================

let editingProfileId = null;
window.currentProfiles = {}; // Global store

async function loadAPIProfiles() {
    const tbody = document.getElementById('profilesTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-400">Loading...</td></tr>';

    try {
        const response = await fetch(`${API_BASE}/admin/profiles/list`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) throw new Error('Failed to load profiles');

        const data = await response.json();
        const profiles = Object.values(data.profiles || {});

        if (profiles.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-400">No profiles found</td></tr>';
            return;
        }

        // Store profiles globally for easier editing access
        window.currentProfiles = data.profiles;

        tbody.innerHTML = profiles.map(profile => `
            <tr class="hover:bg-gray-50 transition">
                <td class="p-4 font-medium text-gray-800">${profile.name}</td>
                <td class="p-4 text-gray-600 font-mono text-xs">${profile.api_url}</td>
                <td class="p-4">
                    <span class="px-2 py-1 rounded text-xs font-semibold ${profile.speed === 'fast' ? 'bg-green-100 text-green-700' :
                profile.speed === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
            }">${profile.speed.toUpperCase()}</span>
                </td>
                <td class="p-4">
                    <span class="px-2 py-1 rounded text-xs font-semibold ${profile.is_active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
            }">${profile.is_active ? 'Active' : 'Inactive'}</span>
                </td>
                <td class="p-4 text-right space-x-2">
                    <button onclick="editAPIProfile('${profile.id}')" class="text-blue-500 hover:text-blue-700">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteAPIProfile('${profile.id}')" class="text-red-500 hover:text-red-700">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error loading profiles:', error);
        tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-red-400">Error loading profiles</td></tr>';
    }
}

window.openProfileModal = function (profileId = null) {
    const modal = document.getElementById('profileModal');
    const title = document.getElementById('profileModalTitle');

    // Reset form
    document.getElementById('profileId').value = '';
    document.getElementById('profileName').value = '';
    document.getElementById('profileUrl').value = '';
    document.getElementById('profileKey').value = '';
    document.getElementById('profileSpeed').value = 'medium';
    document.getElementById('profileStatus').value = 'true';
    document.getElementById('profileCapabilities').value = '';
    document.getElementById('profileDescription').value = '';

    if (profileId && window.currentProfiles && window.currentProfiles[profileId]) {
        const p = window.currentProfiles[profileId];
        editingProfileId = profileId;
        title.textContent = 'Edit Profile';

        document.getElementById('profileId').value = p.id;
        document.getElementById('profileName').value = p.name;
        document.getElementById('profileUrl').value = p.api_url;
        document.getElementById('profileKey').value = p.api_key;
        document.getElementById('profileSpeed').value = p.speed;
        document.getElementById('profileStatus').value = p.is_active.toString();
        document.getElementById('profileCapabilities').value = (p.capabilities || []).join(', ');
        document.getElementById('profileDescription').value = p.description || '';
    } else {
        editingProfileId = null;
        title.textContent = 'New Profile';
    }

    modal.classList.remove('hidden');
}

window.closeProfileModal = function () {
    document.getElementById('profileModal').classList.add('hidden');
    editingProfileId = null;
}

// Close modal when clicking outside
document.getElementById('profileModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('profileModal')) {
        closeProfileModal();
    }
});

window.editAPIProfile = function (id) {
    openProfileModal(id);
}

window.saveProfile = async function () {
    const name = document.getElementById('profileName').value.trim();
    const api_url = document.getElementById('profileUrl').value.trim();
    const api_key = document.getElementById('profileKey').value.trim();
    const speed = document.getElementById('profileSpeed').value;
    const is_active = document.getElementById('profileStatus').value === 'true';
    const capabilities = document.getElementById('profileCapabilities').value.split(',').map(s => s.trim()).filter(s => s);
    const description = document.getElementById('profileDescription').value.trim();
    const id = document.getElementById('profileId').value.trim();

    if (!name || !api_url || !api_key) {
        alert('Please fill in Name, URL, and API Key');
        return;
    }

    const payload = {
        name, api_url, api_key, speed, is_active, capabilities, description
    };

    const endpoint = id ? `${API_BASE}/admin/profiles/update` : `${API_BASE}/admin/profiles/create`;
    const method = id ? 'PUT' : 'POST';

    if (id) {
        payload.id = id;
    }

    try {
        const response = await fetch(endpoint, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Failed to save profile');

        closeProfileModal();
        loadAPIProfiles();
        alert('Profile saved successfully');
    } catch (error) {
        console.error('Error saving profile:', error);
        alert('Error saving profile');
    }
}

window.deleteAPIProfile = async function (id) {
    if (!confirm('Are you sure you want to delete this profile?')) return;

    try {
        const response = await fetch(`${API_BASE}/admin/profiles/delete?id=${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) throw new Error('Failed to delete profile');

        loadAPIProfiles();
    } catch (error) {
        console.error('Error deleting profile:', error);
        alert('Error deleting profile');
    }
}

