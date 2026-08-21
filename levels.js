/* ==========================================================================
   CÓDIGO ZERO - CONTROLADOR DE NIVELES (public/js/levels.js)
   ========================================================================== */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://gzfojrcnysmiinjiatpw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6Zm9qcmNueXNtaWluamlhdHB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NTQ4MDQsImV4cCI6MjEwMjIzMDgwNH0.t_snhtVLc_vHGz2sGDk57PSXi3noH1QzRhL47hxmaRw';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Validar Sesión del Usuario
  const userRaw = localStorage.getItem('cz_user');
  if (!userRaw) {
    window.location.href = 'login.html';
    return;
  }
  
  let user;
  try {
    user = JSON.parse(userRaw);
  } catch (e) {
    window.location.href = 'login.html';
    return;
  }

  // Sincronizar datos frescos desde Supabase
  try {
    let query = supabase.from('users').select('*');
    if (user.id) {
      query = query.eq('id', user.id);
    } else if (user.email) {
      query = query.eq('email', user.email);
    }
    
    const { data: freshUser, error } = await query.single();
    if (!error && freshUser) {
      user = freshUser;
      localStorage.setItem('cz_user', JSON.stringify(user));
    }
  } catch (e) {
    console.warn('No se pudo sincronizar con Supabase, usando datos locales.');
  }

  // 2. Obtener puntaje real calculado desde game_history (con respaldo en user.dls_score)
  let totalAccumulatedScore = 0;
  try {
    const { data: historyData, error: historyError } = await supabase
      .from('game_history')
      .select('module_id, score_obtained')
      .eq('user_id', user.id);

    if (!historyError && historyData && historyData.length > 0) {
      const bestScoresByModule = {};
      historyData.forEach(item => {
        const mod = item.module_id;
        const score = parseInt(item.score_obtained) || 0;
        if (!bestScoresByModule[mod] || score > bestScoresByModule[mod]) {
          bestScoresByModule[mod] = score;
        }
      });
      totalAccumulatedScore = Object.values(bestScoresByModule).reduce((sum, curr) => sum + curr, 0);
    } else {
      totalAccumulatedScore = user.dls_score ?? user.score ?? 0;
    }
  } catch (err) {
    console.warn('Error al consultar historial, usando puntaje de sesión:', err);
    totalAccumulatedScore = user.dls_score ?? user.score ?? 0;
  }

  // Actualizar puntaje sincronizado en base de datos si difiere
  if (user.dls_score !== totalAccumulatedScore) {
    try {
      await supabase
        .from('users')
        .update({ dls_score: totalAccumulatedScore })
        .eq('id', user.id);
      user.dls_score = totalAccumulatedScore;
      localStorage.setItem('cz_user', JSON.stringify(user));
    } catch (syncErr) {
      console.warn('No se pudo actualizar dls_score en servidor:', syncErr);
    }
  }

  // Renderizar HUD (Perfil, Puntuación y Avatar)
  document.getElementById('user-nickname')?.textContent = user.nickname || 'DEV_USER';
  document.getElementById('user-score')?.textContent = totalAccumulatedScore;

  const avatarImg = document.getElementById('user-avatar');
  if (avatarImg) {
    avatarImg.src = (user.avatar === 'cyber_queen') ? 
      'https://i.postimg.cc/HknQWjdM/pixelcut-export-(1).png' : 
      'https://i.postimg.cc/JzxdvsKH/pixelcut-export.png';
  }

  // 3. Gestionar Bloqueo/Desbloqueo de Módulos y Tarjetas
  const moduleCards = document.querySelectorAll('.module-card');
  const currentLevelUnlocked = parseInt(user.unlocked_level || user.unlockedLevel) || 1;

  moduleCards.forEach((card, index) => {
    const moduleNumber = index + 1;
    const levelFile = card.getAttribute('data-level');
    const requiredScore = parseInt(card.getAttribute('data-required')) || 0;
    
    // Validar estados del módulo
    let isCompleted = moduleNumber < currentLevelUnlocked;
    let isLocked = moduleNumber > currentLevelUnlocked;

    if (moduleNumber <= currentLevelUnlocked) {
      isLocked = false;
      if (moduleNumber < currentLevelUnlocked) {
        isCompleted = true;
      } else {
        isCompleted = false;
      }
    }

    const playBtn = card.querySelector('.select-level-btn, button');

    if (isCompleted) {
      card.classList.remove('locked');
      if (playBtn) {
        playBtn.classList.remove('locked-btn');
        playBtn.innerHTML = `✅ REPASAR MÓDULO`;
      }
    } else if (isLocked) {
      card.classList.add('locked');
      if (playBtn) {
        playBtn.classList.add('locked-btn');
        playBtn.innerHTML = `🔒 BLOQUEADO (${requiredScore} PTS)`;
      }
    } else {
      card.classList.remove('locked');
      if (playBtn) {
        playBtn.classList.remove('locked-btn');
        playBtn.innerHTML = `JUGAR MÓDULO 🚀`;
      }
    }
  });

  // NUEVO: Verificar si ya completó los 4 módulos (unlocked_level > 4 o equivalente) para mostrar el modal de premios
  if (currentLevelUnlocked > 4) {
    injectAndShowVictoryModal();
  }

  // 4. Frases desafiantes personalizadas para el Modal
  const moduleQuotes = {
    'level1_ui.json': '¿Seguro que dominas la maquetación o solo dependes del "Copy-Paste"? Muestra si realmente sabes diseñar.',
    'level2_logic.json': '¿Estás seguro de que la programación es tu fuerte? Aquí la lógica pura destruirá tus excusas.',
    'level3_sql.json': '¿Realmente sabes lo que quieres o te vas a paralizar al primer JOIN complejo en la base de datos?',
    'level4_devops.json': '¿Tienes lo necesario para resolver problemas bajo presión o te vas a acobardar en el primer fallo del sistema?'
  };

  // 5. Configuración del Modal Cyberpunk de Confirmación de Reto
  const modal = document.getElementById('challenge-modal');
  const modalQuote = document.getElementById('modal-quote');
  const confirmBtn = document.getElementById('modal-confirm-btn');
  const cancelBtn = document.getElementById('modal-cancel-btn');
  let selectedLevelFile = null;

  function openModal(levelFile) {
    selectedLevelFile = levelFile;
    if (modalQuote && moduleQuotes[levelFile]) {
      modalQuote.textContent = `"${moduleQuotes[levelFile]}"`;
    }
    if (modal) modal.classList.remove('hidden');
  }

  // Eventos de clic en botones de tarjeta y tarjetas completas
  const selectBtns = document.querySelectorAll('.select-level-btn');
  selectBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.module-card');
      if (card && card.classList.contains('locked')) return;

      const levelFile = btn.getAttribute('data-file') || card.getAttribute('data-level');
      openModal(levelFile);
    });
  });

  moduleCards.forEach(card => {
    card.addEventListener('click', (e) => {
      if (card.classList.contains('locked')) return;
      const levelFile = card.getAttribute('data-level');
      openModal(levelFile);
    });
  });

  if (confirmBtn) {
    confirmBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (selectedLevelFile) {
        sessionStorage.setItem('current_level_file', selectedLevelFile);
        window.location.href = 'gameplay.html';
      }
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (modal) modal.classList.add('hidden');
      selectedLevelFile = null;
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
        selectedLevelFile = null;
      }
    });
  }

  // 6. Logout / Cerrar Sesión
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    localStorage.removeItem('cz_user');
    sessionStorage.removeItem('current_level_file');
    window.location.href = 'login.html';
  });

  // 7. Reiniciar Progreso (Restablece nivel a 1 y puntaje a 0, opcionalmente limpia historial)
  document.getElementById('reset-btn')?.addEventListener('click', async () => {
    if (confirm('¿Estás seguro de reiniciar todo el progreso? Se borrarán tus puntajes y se bloquearán nuevamente los módulos.')) {
      try {
        let updateQuery = supabase.from('users').update({ unlocked_level: 1, dls_score: 0 });
        if (user.id) {
          updateQuery = updateQuery.eq('id', user.id);
        } else if (user.email) {
          updateQuery = updateQuery.eq('email', user.email);
        }
        
        const { error: updateError } = await updateQuery;
        if (updateError) throw updateError;

        // Limpiar también el historial de partidas en Supabase para un reseteo limpio
        if (user.id) {
          await supabase.from('game_history').delete().eq('user_id', user.id);
        }

        user.unlocked_level = 1;
        user.unlockedLevel = 1;
        user.dls_score = 0;
        user.score = 0;
        localStorage.setItem('cz_user', JSON.stringify(user));
        sessionStorage.clear();

        window.location.reload();
      } catch (err) {
        console.error('Error al reiniciar el progreso:', err);
        alert('Ocurrió un error al reiniciar. Intenta de nuevo.');
      }
    }
  });
});

// Función auxiliar para inyectar y desplegar el modal de victoria con los libros de recompensa
function injectAndShowVictoryModal() {
  if (document.getElementById('victory-modal')) {
    document.getElementById('victory-modal').classList.remove('hidden');
    return;
  }

  const modalHTML = `
    <div id="victory-modal" class="modal-overlay">
      <div class="modal-content glass-card victory-card-custom" style="max-width: 500px; text-align: center; background: rgba(10, 15, 25, 0.95); border: 1px solid #00ff66; padding: 30px; border-radius: 12px; box-shadow: 0 0 25px rgba(0,255,102,0.3);">
        <div class="modal-avatar" style="margin-bottom: 15px;">
          <img src="assets/avatars/byte_happy.png" alt="Premio Cyber" style="width: 80px; filter: drop-shadow(0 0 10px #00ff66);" onerror="this.src='https://i.postimg.cc/JzxdvsKH/pixelcut-export.png';">
        </div>
        <div class="modal-body">
          <h3 style="color: #00ff66; font-family: 'Orbitron', sans-serif; font-size: 1.5rem; margin-bottom: 10px;">🎉 ¡MISIÓN CUMPLIDA! 🎉</h3>
          <p style="color: #e2e8f0; margin-bottom: 20px; font-size: 0.95rem; line-height: 1.5;">¡Has superado con éxito todos los módulos del sistema! Como recompensa por dominar el ciberespacio, has desbloqueado acceso exclusivo a nuestra biblioteca de programación:</p>
          
          <div class="book-rewards-container" style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 25px;">
            <a href="https://drive.google.com/file/d/1AP0gLrE2AMIIz9NFb4mRL85ar2MRLTqTm/view?usp=sharing" target="_blank" class="cyber-book-link" style="background: rgba(0, 255, 102, 0.1); border: 1px solid #00ff66; padding: 12px; border-radius: 8px; color: #fff; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 10px; font-weight: bold; transition: 0.3s;">
              <span>📖</span> Descargar Libro de Programación 1
            </a>
            <a href="https://drive.google.com/file/d/1HwKFtyBLotM3eVu9urysN2TMwLB1Mocq/view?usp=sharing" target="_blank" class="cyber-book-link" style="background: rgba(0, 243, 255, 0.1); border: 1px solid #00f3ff; padding: 12px; border-radius: 8px; color: #fff; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 10px; font-weight: bold; transition: 0.3s;">
              <span>📚</span> Descargar Libro de Programación 2
            </a>
          </div>
        </div>
        <div class="modal-actions">
          <button id="close-victory-btn" class="cyber-btn" style="width: 100%; padding: 12px; background: #00ff66; color: #000; font-weight: bold; border: none; border-radius: 6px; cursor: pointer; font-family: 'Orbitron', sans-serif;">¡ENTENDIDO, VOLVER AL PANEL! 🚀</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);

  document.getElementById('close-victory-btn').addEventListener('click', () => {
    document.getElementById('victory-modal').classList.add('hidden');
  });
}