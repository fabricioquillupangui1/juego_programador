import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ==========================================
// 0. CONFIGURACIÓN E INICIALIZACIÓN SUPABASE
// ==========================================
const SUPABASE_URL = 'https://gzfojrcnysmiinjiatpw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6Zm9qcmNueXNtaWluamlhdHB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NTQ4MDQsImV4cCI6MjEwMjIzMDgwNH0.t_snhtVLc_vHGz2sGDk57PSXi3noH1QzRhL47hxmaRw';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Función auxiliar para encriptar la contraseña a SHA-256
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  // Elementos del DOM
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const avatarGrid = document.querySelector('.avatar-grid');
  const tabBtns = document.querySelectorAll('.tab-btn');
  const togglePasswordBtns = document.querySelectorAll('.toggle-password');

  // Estado del Avatar Seleccionado (Default: panda_hacker)
  let selectedAvatar = 'panda_hacker';

  // ==========================================
  // 1. SELECCIÓN DE AVATAR (.closest)
  // ==========================================
  if (avatarGrid) {
    avatarGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.avatar-select-card');
      
      if (!card) return;

      document.querySelectorAll('.avatar-select-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      selectedAvatar = card.dataset.avatar;
      console.log('⚡ Avatar seleccionado:', selectedAvatar);
    });
  }

  // ==========================================
  // 2. CAMBIO DE PESTAÑAS (LOGIN / REGISTRO)
  // ==========================================
  if (tabBtns.length > 0) {
    tabBtns.forEach((btn, index) => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const isLogin = btn.dataset.tab === 'login' || index === 0;

        if (isLogin) {
          loginForm?.classList.remove('hidden');
          registerForm?.classList.add('hidden');
        } else {
          loginForm?.classList.add('hidden');
          registerForm?.classList.remove('hidden');
        }
      });
    });
  }

  // ==========================================
  // 3. MOSTRAR / OCULTAR CONTRASEÑA
  // ==========================================
  togglePasswordBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const button = e.currentTarget || e.target.closest('.toggle-password');
      if (!button) return;

      const targetId = button.getAttribute('data-target');
      let input = targetId ? document.getElementById(targetId) : null;

      if (!input) {
        const wrapper = button.closest('.password-wrapper');
        input = wrapper?.querySelector('input');
      }

      if (input) {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        button.textContent = isPassword ? '🙈' : '👁️';
      }
    });
  });

  // ==========================================
  // 4. REGISTRO DIRECTO A SUPABASE
  // ==========================================
  if (registerForm) {
    registerForm.removeAttribute('action'); 
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const nickname = document.getElementById('reg-nickname').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const passwordPlain = document.getElementById('reg-password').value;

      try {
        const passwordHashed = await hashPassword(passwordPlain);

        const { data, error } = await supabase
          .from('users')
          .insert([
            {
              nickname: nickname,
              email: email,
              password: passwordHashed,
              avatar: selectedAvatar,
              dls_score: 0,
              unlocked_level: 1 // <--- AQUÍ: Inicializa el nivel 1 desbloqueado por defecto
            }
          ])
          .select();

        if (error) {
          throw new Error(error.message);
        }

        console.log('✅ Jugador guardado con éxito:', data);

        alert('¡Jugador registrado exitosamente! Ahora inicia sesión.');

        registerForm.reset();
        registerForm.classList.add('hidden');
        loginForm?.classList.remove('hidden');

        const tabLogin = document.getElementById('tab-login') || tabBtns[0];
        const tabRegister = document.getElementById('tab-register') || tabBtns[1];

        tabLogin?.classList.add('active');
        tabRegister?.classList.remove('active');

      } catch (err) {
        console.error('Error al registrar:', err);
        alert(err.message || 'Error al completar el registro.');
      }
    });
  }

  // ==========================================
  // 5. INICIO DE SESIÓN DIRECTO A SUPABASE
  // ==========================================
  if (loginForm) {
    loginForm.removeAttribute('action'); 
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const email = document.getElementById('login-email').value.trim();
      const passwordPlain = document.getElementById('login-password').value;

      try {
        const passwordHashed = await hashPassword(passwordPlain);

        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .eq('password', passwordHashed)
          .single();

        if (error || !data) {
          throw new Error('Credenciales inválidas o usuario inexistente.');
        }

        console.log('✅ Sesión iniciada:', data);

        // Guardar sesión y forzar redirección a la pantalla de niveles
        localStorage.setItem('cz_user', JSON.stringify(data));
        window.location.replace('levels.html');

      } catch (err) {
        console.error('Error al iniciar sesión:', err);
        alert(err.message || 'Credenciales no válidas.');
      }
    });
  }
});