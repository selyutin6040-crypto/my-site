// script.js — вся логика приложения + самоуничтожение + редактирование текста + фото + профили + пагинация + экспорт + файловый архив + аватарки + администратор

(function() {
  'use strict';

  // ---- DOM-элементы ----
  const loginBox = document.getElementById('loginBox');
  const secretTab = document.getElementById('secretTab');
  const passwordInput = document.getElementById('passwordInput');
  const enterBtn = document.getElementById('enterBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const errorText = document.getElementById('errorText');
  const attemptCounter = document.getElementById('attemptCounter');
  const blockOverlay = document.getElementById('blockOverlay');
  const selfDestructBtn = document.getElementById('selfDestructBtn');
  
  // Элементы для редактирования
  const editableArea = document.getElementById('editableArea');
  const editToggleBtn = document.getElementById('editToggleBtn');
  const saveBtn = document.getElementById('saveBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const clearBtn = document.getElementById('clearBtn');
  const addImageBtn = document.getElementById('addImageBtn');
  const imageInput = document.getElementById('imageInput');
  const editStatus = document.getElementById('editStatus');

  // Элементы профиля
  const profileSelect = document.getElementById('profileSelect');
  const newProfileBtn = document.getElementById('newProfileBtn');
  const deleteProfileBtn = document.getElementById('deleteProfileBtn');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalCancel = document.getElementById('modalCancel');
  const modalConfirm = document.getElementById('modalConfirm');
  const newProfileName = document.getElementById('newProfileName');
  const newProfilePassword = document.getElementById('newProfilePassword');
  const newProfileConfirmPassword = document.getElementById('newProfileConfirmPassword');
  const modalError = document.getElementById('modalError');
  
  // Дополнительные поля профиля
  const newProfileFirstName = document.getElementById('newProfileFirstName');
  const newProfileLastName = document.getElementById('newProfileLastName');
  const newProfilePosition = document.getElementById('newProfilePosition');
  const newProfileDepartment = document.getElementById('newProfileDepartment');
  const newProfileBirthDate = document.getElementById('newProfileBirthDate');
  const newProfileEmail = document.getElementById('newProfileEmail');
  const newProfilePhone = document.getElementById('newProfilePhone');

  // Элементы аватарки
  const profileAvatar = document.getElementById('profileAvatar');
  const avatarInput = document.getElementById('avatarInput');
  const avatarPlaceholder = document.getElementById('avatarPlaceholder');

  // Элементы администратора
  const adminLoginBtn = document.getElementById('adminLoginBtn');
  const adminModalOverlay = document.getElementById('adminModalOverlay');
  const adminModalCancel = document.getElementById('adminModalCancel');
  const adminModalConfirm = document.getElementById('adminModalConfirm');
  const adminPasswordInput = document.getElementById('adminPasswordInput');
  const adminModalError = document.getElementById('adminModalError');
  const adminPanel = document.getElementById('adminPanel');
  const adminDataDisplay = document.getElementById('adminDataDisplay');

  // ---- Константы ----
  const MAX_ATTEMPTS = 3;
  const STORAGE_KEY = 'secret_content';
  const IMAGES_STORAGE_KEY = 'secret_images';
  const PROFILES_STORAGE_KEY = 'scp_profiles';
  const FILES_STORAGE_KEY = 'scp_exported_files';
  const AUTO_CLOSE_DELAY = 10000;
  const CHARS_PER_PAGE = 3000;
  const ADMIN_PASSWORD = '6767'; // Пароль администратора
  const MAX_PROFILE_NAME_LENGTH = 30; // Максимальная длина имени профиля

  // ---- Состояние ----
  let failedAttempts = 0;
  let isBlocked = false;
  let isDestroyed = false;
  let isEditMode = false;
  let savedContent = '';
  let savedImages = [];
  let autoCloseTimer = null;
  let countdownInterval = null;
  let remainingSeconds = 10;
  let currentProfile = null;
  let profiles = {};
  let currentPage = 1;
  let totalPages = 1;
  let fullContent = '';
  let pageContents = [];
  let exportedFiles = [];
  let isAdmin = false;

  // ---- Управление профилями ----
  function loadProfiles() {
    try {
      const data = localStorage.getItem(PROFILES_STORAGE_KEY);
      if (data) {
        profiles = JSON.parse(data);
        // Добавляем поля для старых профилей, если их нет
        Object.keys(profiles).forEach(name => {
          if (!profiles[name].avatar) {
            profiles[name].avatar = null;
          }
          if (!profiles[name].firstName) {
            profiles[name].firstName = '';
          }
          if (!profiles[name].lastName) {
            profiles[name].lastName = '';
          }
          if (!profiles[name].position) {
            profiles[name].position = '';
          }
          if (!profiles[name].department) {
            profiles[name].department = '';
          }
          if (!profiles[name].birthDate) {
            profiles[name].birthDate = '';
          }
          if (!profiles[name].email) {
            profiles[name].email = '';
          }
          if (!profiles[name].phone) {
            profiles[name].phone = '';
          }
        });
      } else {
        profiles = {};
      }
    } catch (e) {
      profiles = {};
    }
    updateProfileSelect();
    if (isAdmin) updateAdminPanel();
  }

  function saveProfiles() {
    try {
      localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
      if (isAdmin) updateAdminPanel();
    } catch (e) {
      console.warn('Не удалось сохранить профили:', e);
    }
  }

  function updateProfileSelect() {
    profileSelect.innerHTML = '<option value="">-- ВЫБЕРИТЕ ПРОФИЛЬ --</option>';
    const profileNames = Object.keys(profiles);
    if (profileNames.length === 0) {
      profileSelect.innerHTML += '<option value="" disabled>Нет сохранённых профилей</option>';
      return;
    }
    // Если админ, показываем все профили, иначе только обычные
    const filteredNames = isAdmin ? profileNames : profileNames.filter(name => name !== 'ADMIN');
    if (filteredNames.length === 0 && !isAdmin) {
      profileSelect.innerHTML += '<option value="" disabled>Нет сохранённых профилей</option>';
      return;
    }
    filteredNames.forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      // Показываем логин + имя/фамилию если есть
      let displayName = name;
      if (profiles[name] && (profiles[name].firstName || profiles[name].lastName)) {
        const fullName = [profiles[name].firstName, profiles[name].lastName].filter(Boolean).join(' ');
        displayName = `${name} (${fullName})`;
      }
      option.textContent = displayName;
      profileSelect.appendChild(option);
    });
    if (currentProfile && filteredNames.includes(currentProfile)) {
      profileSelect.value = currentProfile;
    }
  }

  function createProfile(name, password, userData) {
    // Проверяем, существует ли профиль
    if (profiles[name]) {
      return { success: false, error: 'Профиль с таким именем уже существует' };
    }
    if (name.trim() === '') {
      return { success: false, error: 'Имя профиля не может быть пустым' };
    }
    if (password.trim() === '') {
      return { success: false, error: 'Пароль не может быть пустым' };
    }
    if (password.length < 4) {
      return { success: false, error: 'Пароль должен содержать минимум 4 символа' };
    }
    if (name.length > MAX_PROFILE_NAME_LENGTH) {
      return { success: false, error: `Имя профиля не может превышать ${MAX_PROFILE_NAME_LENGTH} символов` };
    }
    // Запрещаем создание профиля с именем ADMIN (зарезервировано для администратора)
    if (name.toUpperCase() === 'ADMIN') {
      return { success: false, error: 'Недопустимое имя профиля' };
    }
    
    profiles[name] = {
      password: password,
      content: '',
      images: [],
      avatar: null,
      firstName: userData.firstName || '',
      lastName: userData.lastName || '',
      position: userData.position || '',
      department: userData.department || '',
      birthDate: userData.birthDate || '',
      email: userData.email || '',
      phone: userData.phone || ''
    };
    saveProfiles();
    updateProfileSelect();
    profileSelect.value = name;
    currentProfile = name;
    return { success: true };
  }

  function deleteProfile(name) {
    if (!profiles[name]) {
      return { success: false, error: 'Профиль не найден' };
    }
    if (name === 'ADMIN') {
      return { success: false, error: 'Нельзя удалить профиль администратора' };
    }
    if (name === currentProfile) {
      currentProfile = null;
      updateAvatarDisplay();
    }
    delete profiles[name];
    saveProfiles();
    updateProfileSelect();
    if (!isAdmin) {
      editableArea.innerHTML = '<p><span class="highlight">ДОБРО ПОЖАЛОВАТЬ В ЗАЩИЩЁННУЮ ОБЛАСТЬ</span><br /><br /><strong>Данный документ создан для хранения вашей информации</strong><br /><br />Нажмите <strong>«Редактировать»</strong> внизу, чтобы добавить данные в файл.<br />Используйте кнопку <strong>«Добавить фото»</strong> для вставки изображений объекта.<br /><br /><span style="color: #6a7a92; font-size: 0.95rem;">Все данные сохраняются в защищённой базе данных Фонда.</span></p>';
      const gallery = document.getElementById('imageGallery');
      if (gallery) gallery.innerHTML = '';
      fullContent = editableArea.innerHTML;
      initPagination();
    }
    return { success: true };
  }

  // ---- Управление аватарками ----
  function updateAvatarDisplay() {
    if (!profileAvatar) return;
    
    if (currentProfile && profiles[currentProfile] && profiles[currentProfile].avatar) {
      profileAvatar.innerHTML = `<img src="${profiles[currentProfile].avatar}" alt="Аватар" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" />`;
      profileAvatar.style.border = '2px solid #4ade80';
      profileAvatar.style.boxShadow = '0 0 20px rgba(74, 222, 128, 0.2)';
    } else {
      profileAvatar.innerHTML = '<span id="avatarPlaceholder">👤</span>';
      profileAvatar.style.border = '2px solid #2a3448';
      profileAvatar.style.boxShadow = 'none';
    }
  }

  function setProfileAvatar(imageDataUrl) {
    if (!currentProfile || !profiles[currentProfile]) {
      return false;
    }
    profiles[currentProfile].avatar = imageDataUrl;
    saveProfiles();
    updateAvatarDisplay();
    return true;
  }

  function removeProfileAvatar() {
    if (!currentProfile || !profiles[currentProfile]) {
      return false;
    }
    profiles[currentProfile].avatar = null;
    saveProfiles();
    updateAvatarDisplay();
    return true;
  }

  function handleAvatarUpload(file) {
    if (!file || !file.type.startsWith('image/')) {
      updateEditStatus(' НЕПОДДЕРЖИВАЕМЫЙ ФОРМАТ ФАЙЛА', '#ff6b6b');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      updateEditStatus(' ФАЙЛ СЛИШКОМ БОЛЬШОЙ (МАКС. 2MB)', '#ff6b6b');
      return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
      const result = setProfileAvatar(e.target.result);
      if (result) {
        updateEditStatus(' АВАТАРКА ОБНОВЛЕНА', '#4ade80');
      } else {
        updateEditStatus(' НЕ УДАЛОСЬ ОБНОВИТЬ АВАТАРКУ', '#ff6b6b');
      }
    };
    reader.onerror = function() {
      updateEditStatus(' ОШИБКА ЗАГРУЗКИ ФАЙЛА', '#ff6b6b');
    };
    reader.readAsDataURL(file);
  }

  // ---- ПАНЕЛЬ АДМИНИСТРАТОРА ----
  function updateAdminPanel() {
    if (!adminDataDisplay) return;
    
    const profileNames = Object.keys(profiles).filter(name => name !== 'ADMIN');
    if (profileNames.length === 0) {
      adminDataDisplay.innerHTML = `
        <div style="color: #4a5a72; text-align: center; padding: 1rem; font-size: 0.8rem; letter-spacing: 1px;">
          НЕТ СОХРАНЁННЫХ ПРОФИЛЕЙ
        </div>
      `;
      return;
    }

    let html = `
      <div style="font-size: 0.6rem; color: #4a5a72; padding-bottom: 0.5rem; letter-spacing: 1px;">
        ВСЕГО ПРОФИЛЕЙ: ${profileNames.length} | ФАЙЛОВ: ${exportedFiles.length}
        <span style="margin-left: 1rem; color: #ffd93d;">👑 АДМИНИСТРАТОР</span>
      </div>
      <div style="max-height: 400px; overflow-y: auto; padding-right: 0.3rem;">
    `;

    profileNames.forEach((name, index) => {
      const profile = profiles[name];
      const hasAvatar = profile.avatar ? 'ЕСТЬ' : 'НЕТ';
      const imageCount = profile.images ? profile.images.length : 0;
      const contentPreview = profile.content ? profile.content.replace(/<[^>]*>/g, '').substring(0, 100) : 'ПУСТО';
      const contentLength = profile.content ? profile.content.length : 0;
      
      // Собираем дополнительную информацию
      const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || '—';
      const position = profile.position || '—';
      const department = profile.department || '—';
      const birthDate = profile.birthDate || '—';
      const email = profile.email || '—';
      const phone = profile.phone || '—';
      
      html += `
        <div style="
          background: rgba(10, 10, 30, 0.5);
          border: 1px solid #1a2a3a;
          padding: 0.6rem 0.8rem;
          margin-bottom: 0.4rem;
          font-family: 'Courier New', monospace;
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.3rem;">
            <span style="color: #ffd93d; font-weight: 400; font-size: 0.75rem; letter-spacing: 1px;">
              ${index + 1}. ${name}
            </span>
            <span style="color: #ff6b6b; font-size: 0.6rem; letter-spacing: 1px;">
              ПАРОЛЬ: ${profile.password}
            </span>
            <div style="display: flex; gap: 0.3rem;">
              <button class="admin-login-btn" data-name="${name}" style="
                background: transparent;
                border: 1px solid #4ade80;
                color: #4ade80;
                padding: 0.1rem 0.5rem;
                font-size: 0.5rem;
                cursor: pointer;
                font-family: 'Courier New', monospace;
                letter-spacing: 0.5px;
                transition: all 0.2s;
              "> ВОЙТИ КАК</button>
              <button class="admin-delete-btn" data-name="${name}" style="
                background: transparent;
                border: 1px solid #ff6b6b;
                color: #ff6b6b;
                padding: 0.1rem 0.5rem;
                font-size: 0.5rem;
                cursor: pointer;
                font-family: 'Courier New', monospace;
                letter-spacing: 1px;
                transition: all 0.2s;
              ">УДАЛИТЬ</button>
            </div>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.2rem; font-size: 0.55rem; color: #6a7a92;">
            <span> АВАТАР: ${hasAvatar}</span>
            <span> ФОТО: ${imageCount}</span>
            <span> СИМВОЛОВ: ${contentLength}</span>
          </div>
          <div style="
            color: #8a9bb5; 
            font-size: 0.55rem; 
            margin-top: 0.15rem;
            padding: 0.15rem 0.3rem; 
            background: rgba(0,0,0,0.3);
            border-left: 2px solid #2a3448;
            word-break: break-all;
          ">
            <div><span style="color: #6a7a92;"> Имя:</span> ${fullName}</div>
            <div><span style="color: #6a7a92;"> Должность:</span> ${position}</div>
            <div><span style="color: #6a7a92;"> Отдел:</span> ${department}</div>
            ${birthDate !== '—' ? `<div><span style="color: #6a7a92;"> Дата рождения:</span> ${birthDate}</div>` : ''}
            ${email !== '—' ? `<div><span style="color: #6a7a92;"> Email:</span> ${email}</div>` : ''}
            ${phone !== '—' ? `<div><span style="color: #6a7a92;"> Телефон:</span> ${phone}</div>` : ''}
          </div>
          <div style="
            color: #8a9bb5; 
            font-size: 0.55rem; 
            margin-top: 0.2rem; 
            padding: 0.2rem 0.3rem; 
            background: rgba(0,0,0,0.2);
            border-left: 2px solid #3a4a5a;
            word-break: break-all;
            max-height: 40px;
            overflow-y: auto;
          ">
             ${contentPreview}${contentLength > 100 ? '...' : ''}
          </div>
        </div>
      `;
    });

    // Добавляем информацию о файлах
    if (exportedFiles.length > 0) {
      html += `
        <div style="
          background: rgba(10, 10, 30, 0.3);
          border: 1px solid #1a2a3a;
          padding: 0.5rem 0.8rem;
          margin-top: 0.3rem;
        ">
          <div style="color: #6a7a92; font-size: 0.6rem; letter-spacing: 1px;">
            📁 ЭКСПОРТИРОВАННЫЕ ФАЙЛЫ (${exportedFiles.length})
          </div>
          ${exportedFiles.slice(0, 5).map(file => `
            <div style="color: #5a6a82; font-size: 0.5rem; padding: 0.1rem 0; border-bottom: 1px solid #0a1a2a;">
              ${file.name} (${Math.round(file.size / 1024)} KB) — ${file.profile}
            </div>
          `).join('')}
          ${exportedFiles.length > 5 ? `<div style="color: #3a4a5a; font-size: 0.5rem; padding-top: 0.2rem;">... и ещё ${exportedFiles.length - 5} файлов</div>` : ''}
        </div>
      `;
    }

    html += '</div>';
    adminDataDisplay.innerHTML = html;

    // Добавляем обработчики для кнопок удаления
    document.querySelectorAll('.admin-delete-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        const name = this.getAttribute('data-name');
        if (confirm(`УДАЛИТЬ ПРОФИЛЬ "${name}"? Это действие нельзя отменить.`)) {
          const result = deleteProfile(name);
          if (result.success) {
            updateAdminPanel();
            updateEditStatus(` ПРОФИЛЬ "${name}" УДАЛЁН`, '#ff6b6b');
          } else {
            updateEditStatus(` ${result.error}`, '#ff6b6b');
          }
        }
      });
    });

    // Добавляем обработчики для кнопок "ВОЙТИ КАК"
    document.querySelectorAll('.admin-login-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        const name = this.getAttribute('data-name');
        adminLoginAsProfile(name);
      });
    });
  }

  // ---- Функция входа в профиль от имени администратора ----
  function adminLoginAsProfile(profileName) {
    if (!profileName || !profiles[profileName]) {
      updateEditStatus(` ПРОФИЛЬ "${profileName}" НЕ НАЙДЕН`, '#ff6b6b');
      return;
    }

    if (profileName === 'ADMIN') {
      updateEditStatus(' 👑 НЕЛЬЗЯ ВОЙТИ В ПРОФИЛЬ АДМИНИСТРАТОРА', '#ffd93d');
      return;
    }

    // Входим в профиль
    currentProfile = profileName;
    profileSelect.value = currentProfile;
    loadContentFromStorage();
    updateAvatarDisplay();
    
    // Показываем статус
    updateEditStatus(` 👑 ВХОД В ПРОФИЛЬ "${profileName}" (РЕЖИМ АДМИНИСТРАТОРА)`, '#4ade80');
  }

  // ---- Управление файлами ----
  function loadFiles() {
    try {
      const data = localStorage.getItem(FILES_STORAGE_KEY);
      if (data) {
        exportedFiles = JSON.parse(data);
      } else {
        exportedFiles = [];
      }
    } catch (e) {
      exportedFiles = [];
    }
    renderFilesList();
    if (isAdmin) updateAdminPanel();
  }

  function saveFiles() {
    try {
      localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(exportedFiles));
    } catch (e) {
      console.warn('Не удалось сохранить список файлов:', e);
    }
    renderFilesList();
    if (isAdmin) updateAdminPanel();
  }

  function addExportedFile(content, profileName) {
    const timestamp = new Date();
    const fileId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const fileName = `SCP_документ_${profileName || 'Без_профиля'}_${timestamp.toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
    
    const fileData = {
      id: fileId,
      name: fileName,
      content: content,
      profile: profileName || 'Без_профиля',
      date: timestamp.toISOString(),
      size: content.length
    };
    
    exportedFiles.unshift(fileData);
    saveFiles();
    updateEditStatus(' ФАЙЛ СОХРАНЁН В АРХИВЕ!', '#4ade80');
    return fileData;
  }

  function deleteFile(fileId) {
    if (!confirm('УДАЛИТЬ ЭТОТ ФАЙЛ ИЗ АРХИВА?')) return;
    exportedFiles = exportedFiles.filter(f => f.id !== fileId);
    saveFiles();
    updateEditStatus(' ФАЙЛ УДАЛЁН', '#ff6b6b');
  }

  function downloadFile(fileId) {
    const file = exportedFiles.find(f => f.id === fileId);
    if (!file) return;
    
    const blob = new Blob([file.content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${file.name}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    updateEditStatus(' ФАЙЛ СКАЧАН!', '#4ade80');
  }

  function renderFilesList() {
    const filesList = document.getElementById('filesList');
    const filesCount = document.getElementById('filesCount');
    
    if (!filesList) return;
    
    if (exportedFiles.length === 0) {
      filesList.innerHTML = '<div class="files-empty">Нет сохранённых файлов</div>';
      if (filesCount) filesCount.textContent = '0 файлов';
      return;
    }
    
    if (filesCount) {
      filesCount.textContent = `${exportedFiles.length} файлов`;
    }
    
    filesList.innerHTML = '';
    exportedFiles.forEach(file => {
      const fileItem = document.createElement('div');
      fileItem.className = 'file-item';
      
      const date = new Date(file.date);
      const dateStr = date.toLocaleDateString('ru-RU') + ' ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      
      fileItem.innerHTML = `
        <div class="file-info">
          <span class="file-name">📄 ${file.name}</span>
          <span class="file-meta">${file.profile} • ${dateStr} • ${Math.round(file.size / 1024)} KB</span>
        </div>
        <div class="file-actions">
          <button class="download-btn" data-id="${file.id}">⬇</button>
          <button class="delete-btn" data-id="${file.id}">✕</button>
        </div>
      `;
      
      filesList.appendChild(fileItem);
      
      const downloadBtn = fileItem.querySelector('.download-btn');
      const deleteBtn = fileItem.querySelector('.delete-btn');
      
      downloadBtn.addEventListener('click', () => downloadFile(file.id));
      deleteBtn.addEventListener('click', () => deleteFile(file.id));
    });
  }

  // ---- ЭКСПОРТ ЗАПИСЕЙ ----
  function exportContent() {
    const content = fullContent || editableArea.innerHTML;
    const profileName = currentProfile || 'Без_профиля';
    
    const exportHTML = `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SCP Документ - ${profileName}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #0a0a0f;
            color: #c8d4e4;
            font-family: 'Courier New', monospace;
            padding: 2rem;
            line-height: 1.8;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: rgba(15, 15, 25, 0.95);
            padding: 2rem;
            border: 1px solid #2a3448;
            border-radius: 0.5rem;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #2a3448;
            padding-bottom: 1rem;
            margin-bottom: 2rem;
        }
        .header h1 {
            color: #e8edf5;
            font-size: 1.8rem;
            letter-spacing: 4px;
        }
        .header .meta {
            color: #6a7a92;
            font-size: 0.8rem;
            margin-top: 0.5rem;
        }
        .header .meta span {
            color: #8a9bb5;
        }
        .content {
            min-height: 300px;
            padding: 1rem 0;
        }
        .content .highlight {
            color: #ffd93d;
        }
        .footer {
            text-align: center;
            border-top: 2px solid #2a3448;
            padding-top: 1rem;
            margin-top: 2rem;
            color: #3a4a5a;
            font-size: 0.7rem;
            letter-spacing: 2px;
        }
        .footer .scp-symbol {
            color: #6a7a92;
            font-size: 1.2rem;
        }
        hr {
            border: none;
            height: 1px;
            background: linear-gradient(90deg, transparent, #2a3448, transparent);
            margin: 1.5rem 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>◈ SCP ДОКУМЕНТ</h1>
            <div class="meta">
                <span>ПРОФИЛЬ:</span> ${profileName} &nbsp;|&nbsp; 
                <span>ДАТА ЭКСПОРТА:</span> ${new Date().toLocaleString('ru-RU')}
            </div>
        </div>
        <div class="content">
            ${content}
        </div>
        <hr>
        <div class="footer">
            <div class="scp-symbol">◈ SECURE. CONTAIN. PROTECT. ◈</div>
            <div style="margin-top: 0.3rem;">Данный документ является собственностью SCP Foundation</div>
        </div>
    </div>
</body>
</html>
    `;
    
    addExportedFile(exportHTML, profileName);
    
    const blob = new Blob([exportHTML], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileName = `SCP_документ_${profileName}_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
    link.download = `${fileName}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    updateEditStatus(' ДОКУМЕНТ ЭКСПОРТИРОВАН И СОХРАНЁН!', '#4ade80');
  }

  // ---- ПАГИНАЦИЯ ----
  function initPagination() {
    const content = editableArea.innerHTML;
    fullContent = content;
    
    pageContents = splitIntoPages(content);
    totalPages = pageContents.length;
    
    if (totalPages === 0) {
      pageContents = ['<p><span style="color: #6a7a92;">ПУСТО...</span></p>'];
      totalPages = 1;
    }
    
    if (currentPage > totalPages) {
      currentPage = totalPages;
    }
    if (currentPage < 1) {
      currentPage = 1;
    }
    
    displayPage(currentPage);
  }

  function splitIntoPages(content) {
    if (!content || content.trim() === '') {
      return ['<p><span style="color: #6a7a92;">ПУСТО...</span></p>'];
    }
    
    const pages = [];
    let currentPageContent = '';
    let charCount = 0;
    let insideTag = false;
    let tagBuffer = '';
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      
      if (char === '<') {
        insideTag = true;
        tagBuffer = '<';
        continue;
      }
      
      if (insideTag) {
        tagBuffer += char;
        if (char === '>') {
          insideTag = false;
          currentPageContent += tagBuffer;
          tagBuffer = '';
        }
        continue;
      }
      
      currentPageContent += char;
      
      if (char !== '&') {
        charCount++;
      }
      
      if (charCount >= CHARS_PER_PAGE && !insideTag) {
        let endIndex = i + 1;
        let foundEnd = false;
        
        for (let j = Math.max(0, i - 20); j < Math.min(content.length, i + 20); j++) {
          if (content[j] === '.' || content[j] === '!' || content[j] === '?') {
            endIndex = j + 1;
            foundEnd = true;
            break;
          }
        }
        
        if (!foundEnd) {
          let nextClose = content.indexOf('>', i);
          if (nextClose !== -1 && nextClose - i < 50) {
            endIndex = nextClose + 1;
          }
        }
        
        if (endIndex > i + 1) {
          const extra = content.substring(i + 1, endIndex);
          currentPageContent += extra;
          i = endIndex - 1;
        }
        
        pages.push(currentPageContent);
        currentPageContent = '';
        charCount = 0;
      }
    }
    
    if (currentPageContent.trim() !== '') {
      pages.push(currentPageContent);
    }
    
    if (pages.length === 0) {
      pages.push(content);
    }
    
    return pages;
  }

  function displayPage(pageNum) {
    if (pageNum < 1 || pageNum > totalPages) {
      pageNum = 1;
    }
    
    currentPage = pageNum;
    
    if (pageContents.length > 0 && pageNum <= pageContents.length) {
      editableArea.innerHTML = pageContents[pageNum - 1];
    } else {
      editableArea.innerHTML = '<p><span style="color: #6a7a92;">ПУСТО...</span></p>';
    }
    
    updatePageControls();
  }

  function updatePageControls() {
    document.querySelectorAll('.page-indicator, .page-progress, .export-btn-only').forEach(el => el.remove());
    
    if (totalPages <= 1) {
      addExportButton();
      return;
    }
    
    const contentCard = document.getElementById('contentCard');
    if (!contentCard) return;
    
    const indicatorContainer = document.createElement('div');
    indicatorContainer.className = 'page-indicator';
    indicatorContainer.style.cssText = `
      display: flex !important;
      justify-content: center;
      align-items: center;
      gap: 1rem;
      margin: 0.5rem 0 0 0;
      padding: 0.5rem;
      font-family: 'Courier New', monospace;
      color: #6a7a92;
      letter-spacing: 1px;
      flex-wrap: wrap;
    `;
    
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '◀';
    prevBtn.style.cssText = `
      background: ${currentPage <= 1 ? '#0a0a18' : 'transparent'};
      border: 1px solid ${currentPage <= 1 ? '#1a2a3a' : '#2a3448'};
      color: ${currentPage <= 1 ? '#3a4a5a' : '#8a9bb5'};
      padding: 0.3rem 0.8rem;
      cursor: ${currentPage <= 1 ? 'default' : 'pointer'};
      font-size: 1rem;
      transition: all 0.2s;
      font-family: 'Courier New', monospace;
      border-radius: 0;
      opacity: ${currentPage <= 1 ? '0.3' : '1'};
    `;
    prevBtn.onmouseover = () => {
      if (currentPage > 1) {
        prevBtn.style.background = '#1a2940';
        prevBtn.style.borderColor = '#3a4a62';
        prevBtn.style.color = '#e8edf5';
      }
    };
    prevBtn.onmouseout = () => {
      if (currentPage > 1) {
        prevBtn.style.background = 'transparent';
        prevBtn.style.borderColor = '#2a3448';
        prevBtn.style.color = '#8a9bb5';
      }
    };
    prevBtn.onclick = () => {
      if (currentPage > 1) {
        goToPage(currentPage - 1);
      }
    };
    
    const pageInfo = document.createElement('span');
    pageInfo.textContent = `СТРАНИЦА ${currentPage} ИЗ ${totalPages}`;
    pageInfo.style.cssText = `
      font-size: 0.8rem;
      letter-spacing: 2px;
      color: #c8d4e4;
      font-weight: 400;
    `;
    
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '▶';
    nextBtn.style.cssText = `
      background: ${currentPage >= totalPages ? '#0a0a18' : 'transparent'};
      border: 1px solid ${currentPage >= totalPages ? '#1a2a3a' : '#2a3448'};
      color: ${currentPage >= totalPages ? '#3a4a5a' : '#8a9bb5'};
      padding: 0.3rem 0.8rem;
      cursor: ${currentPage >= totalPages ? 'default' : 'pointer'};
      font-size: 1rem;
      transition: all 0.2s;
      font-family: 'Courier New', monospace;
      border-radius: 0;
      opacity: ${currentPage >= totalPages ? '0.3' : '1'};
    `;
    nextBtn.onmouseover = () => {
      if (currentPage < totalPages) {
        nextBtn.style.background = '#1a2940';
        nextBtn.style.borderColor = '#3a4a62';
        nextBtn.style.color = '#e8edf5';
      }
    };
    nextBtn.onmouseout = () => {
      if (currentPage < totalPages) {
        nextBtn.style.background = 'transparent';
        nextBtn.style.borderColor = '#2a3448';
        nextBtn.style.color = '#8a9bb5';
      }
    };
    nextBtn.onclick = () => {
      if (currentPage < totalPages) {
        goToPage(currentPage + 1);
      }
    };
    
    indicatorContainer.appendChild(prevBtn);
    indicatorContainer.appendChild(pageInfo);
    indicatorContainer.appendChild(nextBtn);
    
    const exportBtn = document.createElement('button');
    exportBtn.textContent = '⬇ ЭКСПОРТ';
    exportBtn.style.cssText = `
      background: transparent;
      border: 1px solid #4a7a9a;
      color: #6a9aba;
      padding: 0.3rem 0.8rem;
      cursor: pointer;
      font-size: 0.7rem;
      transition: all 0.2s;
      font-family: 'Courier New', monospace;
      border-radius: 0;
      letter-spacing: 1px;
      margin-left: 0.5rem;
    `;
    exportBtn.onmouseover = () => {
      exportBtn.style.background = 'rgba(74, 122, 154, 0.15)';
      exportBtn.style.borderColor = '#5a8aaa';
      exportBtn.style.color = '#8abaca';
    };
    exportBtn.onmouseout = () => {
      exportBtn.style.background = 'transparent';
      exportBtn.style.borderColor = '#4a7a9a';
      exportBtn.style.color = '#6a9aba';
    };
    exportBtn.onclick = exportContent;
    indicatorContainer.appendChild(exportBtn);
    
    const progressBar = document.createElement('div');
    progressBar.className = 'page-progress';
    progressBar.style.cssText = `
      width: 100%;
      height: 3px;
      background: #1a2a3a;
      margin: 0.2rem 0 0 0;
      position: relative;
      overflow: hidden;
    `;
    const progressFill = document.createElement('div');
    progressFill.style.cssText = `
      height: 100%;
      background: linear-gradient(90deg, #4a6fa5, #a5b4fc);
      width: ${(currentPage / totalPages) * 100}%;
      transition: width 0.4s ease;
    `;
    progressBar.appendChild(progressFill);
    
    const controls = contentCard.querySelector('.editor-controls');
    if (controls) {
      contentCard.insertBefore(indicatorContainer, controls);
      contentCard.insertBefore(progressBar, controls);
    } else {
      contentCard.appendChild(indicatorContainer);
      contentCard.appendChild(progressBar);
    }
  }

  function addExportButton() {
    const contentCard = document.getElementById('contentCard');
    if (!contentCard) return;
    
    if (contentCard.querySelector('.export-btn-only')) return;
    
    const exportContainer = document.createElement('div');
    exportContainer.className = 'export-btn-only';
    exportContainer.style.cssText = `
      display: flex;
      justify-content: center;
      margin: 0.5rem 0 0 0;
      padding: 0.5rem;
    `;
    
    const exportBtn = document.createElement('button');
    exportBtn.textContent = '⬇ ЭКСПОРТ ДОКУМЕНТА';
    exportBtn.style.cssText = `
      background: transparent;
      border: 1px solid #4a7a9a;
      color: #6a9aba;
      padding: 0.4rem 1.5rem;
      cursor: pointer;
      font-size: 0.8rem;
      transition: all 0.2s;
      font-family: 'Courier New', monospace;
      border-radius: 0;
      letter-spacing: 2px;
    `;
    exportBtn.onmouseover = () => {
      exportBtn.style.background = 'rgba(74, 122, 154, 0.15)';
      exportBtn.style.borderColor = '#5a8aaa';
      exportBtn.style.color = '#8abaca';
    };
    exportBtn.onmouseout = () => {
      exportBtn.style.background = 'transparent';
      exportBtn.style.borderColor = '#4a7a9a';
      exportBtn.style.color = '#6a9aba';
    };
    exportBtn.onclick = exportContent;
    
    exportContainer.appendChild(exportBtn);
    
    const controls = contentCard.querySelector('.editor-controls');
    if (controls) {
      contentCard.insertBefore(exportContainer, controls);
    } else {
      contentCard.appendChild(exportContainer);
    }
  }

  function goToPage(pageNum) {
    if (pageNum < 1 || pageNum > totalPages || pageNum === currentPage) {
      return;
    }
    displayPage(pageNum);
  }

  // ---- Работа с изображениями ----
  function getImageGallery() {
    return document.getElementById('imageGallery') || editableArea.querySelector('#imageGallery');
  }

  function saveImagesToStorage() {
    try {
      const gallery = getImageGallery();
      if (!gallery) return;
      
      const images = gallery.querySelectorAll('img');
      const imageData = [];
      
      images.forEach(img => {
        imageData.push({
          src: img.src,
          alt: img.alt || 'Фото',
          style: img.style.cssText || ''
        });
      });
      
      savedImages = imageData;
      if (currentProfile && profiles[currentProfile]) {
        profiles[currentProfile].images = imageData;
        saveProfiles();
      }
    } catch (e) {
      console.warn('Не удалось сохранить изображения:', e);
    }
  }

  function loadImagesFromStorage() {
    try {
      const gallery = getImageGallery();
      if (!gallery) return;
      
      if (currentProfile && profiles[currentProfile] && profiles[currentProfile].images) {
        const images = profiles[currentProfile].images;
        savedImages = images;
        gallery.innerHTML = '';
        
        images.forEach(imgData => {
          const img = document.createElement('img');
          img.src = imgData.src;
          img.alt = imgData.alt || 'Фото';
          if (imgData.style) {
            img.style.cssText = imgData.style;
          } else {
            img.style.cssText = 'max-width: 100%; max-height: 300px; border-radius: 0; box-shadow: 0 4px 16px rgba(0,0,0,0.5);';
          }
          gallery.appendChild(img);
        });
      } else {
        gallery.innerHTML = '';
        savedImages = [];
      }
    } catch (e) {
      console.warn('Не удалось загрузить изображения:', e);
      savedImages = [];
    }
  }

  // ---- Сохранение и загрузка контента ----
  function saveContentToStorage() {
    try {
      const content = editableArea.innerHTML;
      savedContent = content;
      fullContent = content;
      
      if (currentProfile && profiles[currentProfile]) {
        profiles[currentProfile].content = content;
        saveProfiles();
      }
      
      saveImagesToStorage();
    } catch (e) {
      console.warn('Не удалось сохранить контент:', e);
    }
  }

  function loadContentFromStorage() {
    try {
      let content = '';
      if (currentProfile && profiles[currentProfile] && profiles[currentProfile].content) {
        content = profiles[currentProfile].content;
        savedContent = content;
      } else {
        content = editableArea.innerHTML;
        savedContent = content;
      }
      
      fullContent = content;
      editableArea.innerHTML = content;
      loadImagesFromStorage();
      updateAvatarDisplay();
      currentPage = 1;
      initPagination();
    } catch (e) {
      console.warn('Не удалось загрузить контент:', e);
      savedContent = editableArea.innerHTML;
      fullContent = editableArea.innerHTML;
      initPagination();
    }
  }

  // ---- Остальные функции ----
  function setError(message) {
    if (message) {
      errorText.textContent = message;
      errorText.parentElement.style.opacity = '1';
    } else {
      errorText.textContent = '';
      errorText.parentElement.style.opacity = '0';
    }
  }

  function updateAttemptCounter() {
    if (failedAttempts === 0) {
      attemptCounter.textContent = '';
      attemptCounter.classList.remove('warning');
      return;
    }
    const remaining = MAX_ATTEMPTS - failedAttempts;
    if (remaining <= 0) {
      attemptCounter.textContent = ' ПОПЫТКИ ИСЧЕРПАНЫ';
      attemptCounter.classList.add('warning');
    } else {
      attemptCounter.textContent = ` ОСТАЛОСЬ ПОПЫТОК: ${remaining}`;
      attemptCounter.classList.add('warning');
    }
  }

  function addImageToGallery(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function(e) {
        const gallery = getImageGallery();
        if (!gallery) {
          reject('Галерея не найдена');
          return;
        }
        
        const img = document.createElement('img');
        img.src = e.target.result;
        img.alt = file.name || 'Фото';
        img.style.cssText = 'max-width: 100%; max-height: 300px; border-radius: 0; box-shadow: 0 4px 16px rgba(0,0,0,0.5); margin: 4px; border: 1px solid #1a2a3a;';
        
        if (isEditMode) {
          img.style.cursor = 'pointer';
          img.title = 'Кликните для удаления фото';
          img.addEventListener('click', function(e) {
            e.stopPropagation();
            if (isEditMode && confirm('Удалить это фото?')) {
              this.remove();
              saveImagesToStorage();
              saveContentToStorage();
              updateEditStatus(' ФОТО УДАЛЕНО');
            }
          });
        }
        
        gallery.appendChild(img);
        saveImagesToStorage();
        saveContentToStorage();
        resolve(img);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function handleImageUpload(files) {
    if (!files || files.length === 0) return;
    
    const gallery = getImageGallery();
    if (!gallery) return;
    
    let container = gallery;
    if (!container.id || container.id !== 'imageGallery') {
      container = document.createElement('div');
      container.id = 'imageGallery';
      container.style.cssText = 'display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px;';
      editableArea.appendChild(container);
    }
    
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        addImageToGallery(file).catch(console.warn);
      }
    });
  }

  function updateEditStatus(text, color = null) {
    editStatus.textContent = text;
    if (color) {
      editStatus.style.color = color;
    }
    setTimeout(() => {
      if (!isEditMode) {
        editStatus.textContent = ' РЕЖИМ ЧТЕНИЯ';
        editStatus.style.color = '#6a7a92';
      } else {
        editStatus.textContent = ' РЕЖИМ РЕДАКТИРОВАНИЯ';
        editStatus.style.color = '#a5b4fc';
      }
    }, 2000);
  }

  function setEditMode(enabled) {
    isEditMode = enabled;
    editableArea.contentEditable = enabled;
    
    if (enabled) {
      editableArea.classList.add('editing');
      editToggleBtn.textContent = 'ЗАКРЫТЬ РЕДАКТОР';
      editToggleBtn.style.borderColor = '#818cf8';
      editStatus.textContent = ' ';
      editStatus.style.color = '#a5b4fc';
      saveBtn.style.display = 'inline-block';
      cancelBtn.style.display = 'inline-block';
      clearBtn.style.display = 'inline-block';
      addImageBtn.style.display = 'inline-block';
      editableArea.focus();
      
      savedContent = editableArea.innerHTML;
      
      document.querySelectorAll('.page-indicator, .page-progress, .export-btn-only').forEach(el => {
        el.style.display = 'none';
      });
      
      if (fullContent) {
        editableArea.innerHTML = fullContent;
      }
      
      const gallery = getImageGallery();
      if (gallery) {
        gallery.querySelectorAll('img').forEach(img => {
          img.style.cursor = 'pointer';
          img.title = 'Кликните для удаления фото';
          img.addEventListener('click', function(e) {
            e.stopPropagation();
            if (isEditMode && confirm('Удалить это фото?')) {
              this.remove();
              saveImagesToStorage();
              saveContentToStorage();
              updateEditStatus(' ФОТО УДАЛЕНО');
            }
          });
        });
      }
    } else {
      editableArea.classList.remove('editing');
      editToggleBtn.textContent = '✎ РЕДАКТИРОВАТЬ';
      editToggleBtn.style.borderColor = '#2a3448';
      editStatus.textContent = ' РЕЖИМ ЧТЕНИЯ';
      editStatus.style.color = '#6a7a92';
      saveBtn.style.display = 'none';
      cancelBtn.style.display = 'none';
      clearBtn.style.display = 'none';
      addImageBtn.style.display = 'none';
      editableArea.blur();
      
      saveContentToStorage();
      fullContent = editableArea.innerHTML;
      initPagination();
      
      document.querySelectorAll('.page-indicator, .page-progress, .export-btn-only').forEach(el => {
        el.style.display = '';
      });
      
      const gallery = getImageGallery();
      if (gallery) {
        gallery.querySelectorAll('img').forEach(img => {
          img.style.cursor = 'default';
          img.title = '';
          const newImg = img.cloneNode(true);
          img.parentNode.replaceChild(newImg, img);
        });
      }
    }
  }

  function saveEdits() {
    const content = editableArea.innerHTML;
    if (content.trim() === '' || content === '<br>' || content === '<div><br></div>') {
      if (!confirm('Контент пустой. Вы уверены, что хотите сохранить пустую страницу?')) {
        return;
      }
    }
    fullContent = content;
    saveContentToStorage();
    setEditMode(false);
    updateEditStatus(' СОХРАНЕНО!', '#4ade80');
  }

  function cancelEdits() {
    if (editableArea.innerHTML !== savedContent) {
      if (!confirm('Отменить все изменения?')) {
        return;
      }
    }
    loadContentFromStorage();
    setEditMode(false);
    updateEditStatus(' ИЗМЕНЕНИЯ ОТМЕНЕНЫ', '#ffd93d');
  }

  function clearContent() {
    if (!confirm(' ОЧИСТИТЬ ВЕСЬ КОНТЕНТ? Это действие нельзя отменить.')) {
      return;
    }
    
    editableArea.innerHTML = '<p><span style="color: #6a7a92;">ПУСТО...</span></p>';
    
    const gallery = getImageGallery();
    if (gallery) {
      gallery.innerHTML = '';
    }
    
    savedImages = [];
    if (currentProfile && profiles[currentProfile]) {
      profiles[currentProfile].images = [];
      profiles[currentProfile].content = editableArea.innerHTML;
      saveProfiles();
    }
    
    fullContent = editableArea.innerHTML;
    saveContentToStorage();
    setEditMode(false);
    updateEditStatus('ОЧИЩЕНО', '#ff6b6b');
  }

  function updateCountdownDisplay(seconds) {
    const blockCard = document.querySelector('.block-card');
    if (!blockCard) return;
    
    const oldTimer = blockCard.querySelector('.countdown-timer');
    if (oldTimer) oldTimer.remove();
    
    const timerElement = document.createElement('p');
    timerElement.className = 'countdown-timer';
    timerElement.style.cssText = 'color: #ffd93d; font-size: 1.3rem; margin-top: 0.5rem; font-weight: 600;';
    timerElement.innerHTML = ` <span id="countdownSeconds" style="color: #ff6b6b; font-size: 1.6rem;">${seconds}</span> сек.`;
    blockCard.appendChild(timerElement);
  }

  function autoClosePage() {
    if (isDestroyed) return;
    
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    
    const blockCard = document.querySelector('.block-card');
    if (blockCard) {
      const timerElement = blockCard.querySelector('.countdown-timer');
      if (timerElement) {
        timerElement.innerHTML = ' ';
        timerElement.style.color = '#ff6b6b';
      }
    }

    try {
      window.close();
    } catch (e) {
      try {
        window.location.href = 'about:blank';
      } catch (e2) {
        console.log('Не удалось закрыть страницу автоматически.');
      }
    }
  }

  function blockPage() {
    isBlocked = true;
    blockOverlay.classList.add('active');
    passwordInput.disabled = true;
    enterBtn.disabled = true;
    setError('');
    attemptCounter.textContent = '';
    attemptCounter.classList.remove('warning');
    
    document.querySelectorAll('button, input, textarea, select').forEach(el => {
      if (el.id !== 'selfDestructBtn') {
        el.disabled = true;
      }
    });

    remainingSeconds = Math.floor(AUTO_CLOSE_DELAY / 1000);
    updateCountdownDisplay(remainingSeconds);

    if (countdownInterval) {
      clearInterval(countdownInterval);
    }
    
    countdownInterval = setInterval(function() {
      remainingSeconds--;
      
      if (remainingSeconds <= 0) {
        clearInterval(countdownInterval);
        countdownInterval = null;
        autoClosePage();
        return;
      }
      
      const secondsSpan = document.getElementById('countdownSeconds');
      if (secondsSpan) {
        secondsSpan.textContent = remainingSeconds;
      }
    }, 1000);

    if (autoCloseTimer) {
      clearTimeout(autoCloseTimer);
    }
    autoCloseTimer = setTimeout(function() {
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
      autoClosePage();
    }, AUTO_CLOSE_DELAY);
  }

  function selfDestruct() {
    if (isDestroyed) return;
    isDestroyed = true;

    if (autoCloseTimer) {
      clearTimeout(autoCloseTimer);
      autoCloseTimer = null;
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }

    document.body.innerHTML = '';

    document.body.style.cssText = `
      margin: 0;
      padding: 0;
      min-height: 100vh;
      background: #0a0a0a;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: system-ui, -apple-system, sans-serif;
    `;

    const message = document.createElement('div');
    message.style.cssText = `
      text-align: center;
      color: #ff6b6b;
      padding: 2rem;
      animation: fadeIn 0.8s ease;
    `;
    message.innerHTML = `
      <div style="font-size: 4rem; margin-bottom: 1rem;">☠</div>
      <h2 style="font-size: 2rem; margin-bottom: 0.5rem; color: #ff6b6b;">САЙТ УНИЧТОЖЕН</h2>
      <p style="color: #94a3b8; font-size: 1.1rem;">Страница полностью очищена и закрыта.</p>
      <p style="color: #64748b; font-size: 0.9rem; margin-top: 1rem;">Восстановление невозможно.</p>
    `;
    document.body.appendChild(message);

    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeIn {
        0% { opacity: 0; transform: scale(0.95); }
        100% { opacity: 1; transform: scale(1); }
      }
    `;
    document.head.appendChild(style);

    document.title = 'САЙТ УНИЧТОЖЕН';

    try {
      window.close();
    } catch (e) {
      console.log('Вкладка не может быть закрыта автоматически.');
    }
  }

  // ---- Попытка входа ----
  function attemptLogin() {
    if (isBlocked || isDestroyed) return;

    const entered = passwordInput.value.trim();

    if (entered === '') {
      setError('ВВЕДИТЕ ПАРОЛЬ');
      return;
    }

    if (!currentProfile || !profiles[currentProfile]) {
      setError('ВЫБЕРИТЕ ПРОФИЛЬ');
      return;
    }

    if (entered === profiles[currentProfile].password) {
      failedAttempts = 0;
      updateAttemptCounter();
      setError('');
      loginBox.style.display = 'none';
      secretTab.classList.add('active');
      passwordInput.value = '';
      loadContentFromStorage();
      loadFiles();
      updateAvatarDisplay();
      if (document.activeElement === passwordInput) {
        passwordInput.blur();
      }
      return;
    }

    failedAttempts++;
    updateAttemptCounter();

    if (failedAttempts >= MAX_ATTEMPTS) {
      setError(' ТРИ НЕВЕРНЫЕ ПОПЫТКИ. ДОСТУП ЗАБЛОКИРОВАН.');
      blockPage();
      return;
    }

    setError(`НЕВЕРНЫЙ ПАРОЛЬ. ОСТАЛОСЬ ПОПЫТОК: ${MAX_ATTEMPTS - failedAttempts}`);
    passwordInput.select();
    passwordInput.focus();

    setTimeout(() => {
      if (!isBlocked && errorText.textContent.includes('НЕВЕРНЫЙ ПАРОЛЬ')) {
        setError('');
      }
    }, 3000);
  }

  // ---- Вход администратора ----
  function adminLogin() {
    const password = adminPasswordInput.value.trim();
    if (password === ADMIN_PASSWORD) {
      isAdmin = true;
      adminModalOverlay.classList.remove('active');
      adminPasswordInput.value = '';
      adminModalError.textContent = '';
      adminPanel.style.display = 'block';
      updateProfileSelect();
      updateAdminPanel();
      updateEditStatus('  ВХОД В РЕЖИМ АДМИНИСТРАТОРА', '#ffd93d');
      
      // Автоматически выбираем первый профиль
      const profileNames = Object.keys(profiles).filter(name => name !== 'ADMIN');
      if (profileNames.length > 0) {
        currentProfile = profileNames[0];
        profileSelect.value = currentProfile;
        loadContentFromStorage();
        updateAvatarDisplay();
      } else {
        currentProfile = null;
        editableArea.innerHTML = '<p><span style="color: #6a7a92;">НЕТ ДОСТУПНЫХ ПРОФИЛЕЙ ДЛЯ ПРОСМОТРА</span></p>';
        fullContent = editableArea.innerHTML;
        initPagination();
      }
    } else {
      adminModalError.textContent = 'НЕВЕРНЫЙ ПАРОЛЬ АДМИНИСТРАТОРА';
      adminPasswordInput.value = '';
      adminPasswordInput.focus();
    }
  }

  // ---- Выход ----
  function logout() {
    if (isBlocked || isDestroyed) return;

    if (isEditMode) {
      if (editableArea.innerHTML !== savedContent) {
        if (confirm('У вас есть несохранённые изменения. Сохранить перед выходом?')) {
          saveEdits();
        } else {
          setEditMode(false);
        }
      } else {
        setEditMode(false);
      }
    }

    // Если админ, выходим из режима админа
    if (isAdmin) {
      isAdmin = false;
      adminPanel.style.display = 'none';
      updateProfileSelect();
    }

    secretTab.classList.remove('active');
    loginBox.style.display = 'flex';
    passwordInput.value = '';
    setError('');
    updateAttemptCounter();
    setTimeout(() => passwordInput.focus(), 100);
  }

  // ---- Обработчики событий ----
  enterBtn.addEventListener('click', function(e) {
    e.preventDefault();
    attemptLogin();
  });

  passwordInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      attemptLogin();
    }
  });

  logoutBtn.addEventListener('click', function(e) {
    e.preventDefault();
    logout();
  });

  selfDestructBtn.addEventListener('click', function(e) {
    e.preventDefault();
    if (confirm(' ВНИМАНИЕ! Вы действительно хотите уничтожить сайт?\nЭто действие НЕОБРАТИМО — сайт исчезнет навсегда.')) {
      selfDestruct();
    }
  });

  // ---- Обработчики профилей ----
  profileSelect.addEventListener('change', function(e) {
    const selected = this.value;
    if (selected && profiles[selected]) {
      currentProfile = selected;
      loadContentFromStorage();
      updateAvatarDisplay();
      passwordInput.value = '';
      setError('');
      if (isEditMode) setEditMode(false);
    } else {
      currentProfile = null;
      updateAvatarDisplay();
    }
  });

  newProfileBtn.addEventListener('click', function(e) {
    e.preventDefault();
    if (isAdmin) {
      updateEditStatus('  АДМИНИСТРАТОР НЕ МОЖЕТ СОЗДАВАТЬ ПРОФИЛИ', '#ffd93d');
      return;
    }
    modalOverlay.classList.add('active');
    newProfileName.value = '';
    newProfilePassword.value = '';
    newProfileConfirmPassword.value = '';
    newProfileFirstName.value = '';
    newProfileLastName.value = '';
    newProfilePosition.value = '';
    newProfileDepartment.value = '';
    newProfileBirthDate.value = '';
    newProfileEmail.value = '';
    newProfilePhone.value = '';
    modalError.textContent = '';
    setTimeout(() => newProfileName.focus(), 100);
  });

  deleteProfileBtn.addEventListener('click', function(e) {
    e.preventDefault();
    if (isAdmin) {
      updateEditStatus('  ИСПОЛЬЗУЙТЕ ПАНЕЛЬ АДМИНИСТРАТОРА ДЛЯ УДАЛЕНИЯ', '#ffd93d');
      return;
    }
    const selected = profileSelect.value;
    if (!selected || !profiles[selected]) {
      setError('ВЫБЕРИТЕ ПРОФИЛЬ ДЛЯ УДАЛЕНИЯ');
      return;
    }
    if (confirm(`УДАЛИТЬ ПРОФИЛЬ "${selected}"? Это действие нельзя отменить.`)) {
      const result = deleteProfile(selected);
      if (result.success) {
        setError('');
        passwordInput.value = '';
        updateAvatarDisplay();
      } else {
        setError(result.error);
      }
    }
  });

  modalCancel.addEventListener('click', function() {
    modalOverlay.classList.remove('active');
    modalError.textContent = '';
    // Очищаем поля
    newProfileName.value = '';
    newProfilePassword.value = '';
    newProfileConfirmPassword.value = '';
    newProfileFirstName.value = '';
    newProfileLastName.value = '';
    newProfilePosition.value = '';
    newProfileDepartment.value = '';
    newProfileBirthDate.value = '';
    newProfileEmail.value = '';
    newProfilePhone.value = '';
  });

  modalConfirm.addEventListener('click', function() {
    const name = newProfileName.value.trim();
    const password = newProfilePassword.value.trim();
    const confirmPassword = newProfileConfirmPassword.value.trim();
    const firstName = newProfileFirstName.value.trim();
    const lastName = newProfileLastName.value.trim();
    const position = newProfilePosition.value.trim();
    const department = newProfileDepartment.value.trim();
    const birthDate = newProfileBirthDate.value.trim();
    const email = newProfileEmail.value.trim();
    const phone = newProfilePhone.value.trim();

    if (!name) {
      modalError.textContent = 'ВВЕДИТЕ ЛОГИН ПРОФИЛЯ';
      return;
    }
    if (!password) {
      modalError.textContent = 'ВВЕДИТЕ ПАРОЛЬ';
      return;
    }
    if (password !== confirmPassword) {
      modalError.textContent = 'ПАРОЛИ НЕ СОВПАДАЮТ';
      return;
    }
    if (password.length < 4) {
      modalError.textContent = 'ПАРОЛЬ ДОЛЖЕН СОДЕРЖАТЬ МИНИМУМ 4 СИМВОЛА';
      return;
    }
    if (name.length > MAX_PROFILE_NAME_LENGTH) {
      modalError.textContent = `ЛОГИН НЕ ДОЛЖЕН ПРЕВЫШАТЬ ${MAX_PROFILE_NAME_LENGTH} СИМВОЛОВ`;
      return;
    }
    if (name.toUpperCase() === 'ADMIN') {
      modalError.textContent = 'НЕДОПУСТИМОЕ ИМЯ ПРОФИЛЯ';
      return;
    }

    const userData = {
      firstName: firstName,
      lastName: lastName,
      position: position,
      department: department,
      birthDate: birthDate,
      email: email,
      phone: phone
    };

    const result = createProfile(name, password, userData);
    if (result.success) {
      modalOverlay.classList.remove('active');
      modalError.textContent = '';
      setError(`ПРОФИЛЬ "${name}" СОЗДАН`);
      passwordInput.value = '';
      passwordInput.focus();
      updateAvatarDisplay();
      // Очищаем поля
      newProfileName.value = '';
      newProfilePassword.value = '';
      newProfileConfirmPassword.value = '';
      newProfileFirstName.value = '';
      newProfileLastName.value = '';
      newProfilePosition.value = '';
      newProfileDepartment.value = '';
      newProfileBirthDate.value = '';
      newProfileEmail.value = '';
      newProfilePhone.value = '';
    } else {
      modalError.textContent = result.error;
    }
  });

  modalOverlay.addEventListener('click', function(e) {
    if (e.target === this) {
      modalOverlay.classList.remove('active');
      modalError.textContent = '';
      // Очищаем поля
      newProfileName.value = '';
      newProfilePassword.value = '';
      newProfileConfirmPassword.value = '';
      newProfileFirstName.value = '';
      newProfileLastName.value = '';
      newProfilePosition.value = '';
      newProfileDepartment.value = '';
      newProfileBirthDate.value = '';
      newProfileEmail.value = '';
      newProfilePhone.value = '';
    }
  });

  newProfileName.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      newProfilePassword.focus();
    }
  });

  newProfilePassword.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      newProfileConfirmPassword.focus();
    }
  });

  newProfileConfirmPassword.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      newProfileFirstName.focus();
    }
  });

  newProfileFirstName.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      newProfileLastName.focus();
    }
  });

  newProfileLastName.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      newProfilePosition.focus();
    }
  });

  newProfilePosition.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      newProfileDepartment.focus();
    }
  });

  newProfileDepartment.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      newProfileBirthDate.focus();
    }
  });

  newProfileBirthDate.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      newProfileEmail.focus();
    }
  });

  newProfileEmail.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      newProfilePhone.focus();
    }
  });

  newProfilePhone.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      modalConfirm.click();
    }
  });

  // ---- Обработчики администратора ----
  adminLoginBtn.addEventListener('click', function(e) {
    e.preventDefault();
    adminModalOverlay.classList.add('active');
    adminPasswordInput.value = '';
    adminModalError.textContent = '';
    setTimeout(() => adminPasswordInput.focus(), 100);
  });

  adminModalCancel.addEventListener('click', function() {
    adminModalOverlay.classList.remove('active');
    adminModalError.textContent = '';
    adminPasswordInput.value = '';
  });

  adminModalConfirm.addEventListener('click', function() {
    adminLogin();
  });

  adminPasswordInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      adminLogin();
    }
  });

  adminModalOverlay.addEventListener('click', function(e) {
    if (e.target === this) {
      adminModalOverlay.classList.remove('active');
      adminModalError.textContent = '';
      adminPasswordInput.value = '';
    }
  });

  // ---- Обработчики редактирования ----
  editToggleBtn.addEventListener('click', function(e) {
    e.preventDefault();
    
    // Администратор может редактировать
    if (isEditMode) {
      if (editableArea.innerHTML !== savedContent) {
        if (confirm('У вас есть несохранённые изменения. Сохранить перед закрытием редактора?')) {
          saveEdits();
        } else {
          setEditMode(false);
        }
      } else {
        setEditMode(false);
      }
    } else {
      setEditMode(true);
    }
  });

  addImageBtn.addEventListener('click', function(e) {
    e.preventDefault();
    if (isEditMode) {
      imageInput.click();
    }
  });

  imageInput.addEventListener('change', function(e) {
    if (this.files && this.files.length > 0) {
      handleImageUpload(this.files);
      this.value = '';
    }
  });

  saveBtn.addEventListener('click', function(e) {
    e.preventDefault();
    saveEdits();
  });

  cancelBtn.addEventListener('click', function(e) {
    e.preventDefault();
    cancelEdits();
  });

  clearBtn.addEventListener('click', function(e) {
    e.preventDefault();
    clearContent();
  });

  // ---- Обработчики аватарки ----
  profileAvatar.addEventListener('click', function(e) {
    e.preventDefault();
    if (!currentProfile || !profiles[currentProfile]) {
      updateEditStatus(' ВЫБЕРИТЕ ПРОФИЛЬ', '#ff6b6b');
      return;
    }
    if (profiles[currentProfile].avatar) {
      if (confirm('Удалить текущую аватарку?')) {
        removeProfileAvatar();
        updateEditStatus(' АВАТАРКА УДАЛЕНА', '#ffd93d');
        return;
      }
    }
    avatarInput.click();
  });

  avatarInput.addEventListener('change', function(e) {
    if (this.files && this.files.length > 0) {
      handleAvatarUpload(this.files[0]);
      this.value = '';
    }
  });

  document.addEventListener('keydown', function(e) {
    if (!isEditMode && secretTab.classList.contains('active') && totalPages > 1) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        if (currentPage > 1) {
          e.preventDefault();
          goToPage(currentPage - 1);
        }
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        if (currentPage < totalPages) {
          e.preventDefault();
          goToPage(currentPage + 1);
        }
      }
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      if (isEditMode && secretTab.classList.contains('active')) {
        e.preventDefault();
        saveEdits();
      }
    }
    if (e.key === 'Escape' && isEditMode) {
      if (editableArea.innerHTML !== savedContent) {
        if (confirm('Отменить изменения и выйти из редактора?')) {
          cancelEdits();
        }
      } else {
        setEditMode(false);
      }
    }
    if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
      modalOverlay.classList.remove('active');
      modalError.textContent = '';
      // Очищаем поля
      newProfileName.value = '';
      newProfilePassword.value = '';
      newProfileConfirmPassword.value = '';
      newProfileFirstName.value = '';
      newProfileLastName.value = '';
      newProfilePosition.value = '';
      newProfileDepartment.value = '';
      newProfileBirthDate.value = '';
      newProfileEmail.value = '';
      newProfilePhone.value = '';
    }
    if (e.key === 'Escape' && adminModalOverlay.classList.contains('active')) {
      adminModalOverlay.classList.remove('active');
      adminModalError.textContent = '';
      adminPasswordInput.value = '';
    }
  });

  // ---- Инициализация ----
  window.addEventListener('load', function() {
    setError('');
    attemptCounter.textContent = '';
    attemptCounter.classList.remove('warning');
    blockOverlay.classList.remove('active');
    isBlocked = false;
    isDestroyed = false;
    failedAttempts = 0;
    passwordInput.disabled = false;
    enterBtn.disabled = false;
    secretTab.classList.remove('active');
    loginBox.style.display = 'flex';
    passwordInput.value = '';
    document.title = '......';
    passwordInput.focus();
    
    loadProfiles();
    loadContentFromStorage();
    loadFiles();
    updateAvatarDisplay();
    adminPanel.style.display = 'none';
  });

})();