/* ==========================================================================
   CÓDIGO ZERO - MOTOR DE RENDERIZADO DE UI (public/js/engine/UiRenderer.js)
   ========================================================================== */

// Mapeo de identificadores de avatar a sus URLs de imagen correspondientes
const AVATAR_MAP = {
  byte_happy: './assets/avatars/byte_happy.png',
  byte_sad: './assets/avatars/byte_sad.png',
  ada_happy: './assets/avatars/ada_happy.png',
  ada_sad: './assets/avatars/ada_sad.png',
  // Fallbacks de avatares predeterminados
  panda_hacker: 'https://i.postimg.cc/JzxdvsKH/pixelcut-export.png',
  cyber_queen: 'https://i.postimg.cc/HknQWjdM/pixelcut-export-(1).png'
};

/**
 * Verifica si existe una sesión activa almacenada en localStorage.
 * Si no la hay, redirige automáticamente a la página de inicio/login.
 * @returns {Object|null} Objeto con la información del usuario o null si no existe.
 */
export function checkSession() {
  const userSessionRaw = localStorage.getItem('cz_user');

  if (!userSessionRaw) {
    window.location.href = './index.html';
    return null;
  }

  try {
    return JSON.parse(userSessionRaw);
  } catch (error) {
    console.error('Error al parsear la sesión del usuario:', error);
    localStorage.removeItem('cz_user');
    window.location.href = './index.html';
    return null;
  }
}

/**
 * Renderiza la información del jugador en la barra superior (HUD Cyberpunk).
 * @param {Object} user - Objeto con datos del usuario (nickname, score, avatar, etc.).
 */
export function renderHUD(user) {
  if (!user) return;

  const nicknameEl = document.getElementById('user-nickname');
  const avatarEl = document.getElementById('user-avatar');
  const scoreEl = document.getElementById('user-score');

  // Actualizar Nombre de Usuario
  if (nicknameEl) {
    nicknameEl.textContent = user.nickname || user.username || 'DEV_UNKNOWN';
  }

  // Actualizar Puntaje DLS
  if (scoreEl) {
    scoreEl.textContent = user.dls_score ?? user.score ?? 0;
  }

  // Actualizar Avatar
  if (avatarEl) {
    const avatarKey = user.avatar || 'byte_happy';
    avatarEl.src = AVATAR_MAP[avatarKey] || AVATAR_MAP.panda_hacker;
    avatarEl.alt = `Avatar de ${user.nickname || 'Jugador'}`;
  }
}

/**
 * Muestra una alerta o notificación estilo neón en la interfaz.
 * @param {string} message - Mensaje a mostrar.
 * @param {string} type - Tipo de mensaje ('success', 'error', 'info').
 */
export function showToast(message, type = 'info') {
  const toastContainer = document.getElementById('toast-container') || createToastContainer();
  
  const toast = document.createElement('div');
  toast.className = `cyber-toast ${type}`;
  toast.textContent = message;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3500);
}

/**
 * Crea el contenedor de notificaciones en el DOM si no existe.
 */
function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 10px;
  `;
  document.body.appendChild(container);
  return container;
}

/**
 * Elimina los datos de sesión almacenados y redirige al inicio.
 */
export function logout() {
  localStorage.removeItem('cz_user');
  localStorage.removeItem('cz_token');
  window.location.href = './index.html';
}