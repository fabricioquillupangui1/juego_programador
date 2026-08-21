/* ==========================================================================
   CÓDIGO ZERO - CONTROLADOR DE GAMEPLAY (public/js/game.js)
   ========================================================================== */

import { LevelManager } from 'LevelManager.js';
import { ScoreEngine } from 'ScoreEngine.js';
import { AvatarManager } from 'AvatarManager.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Configuración de Supabase para guardar el avance en la base de datos
const SUPABASE_URL = 'https://gzfojrcnysmiinjiatpw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6Zm9qcmNueXNtaWluamlhdHB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NTQ4MDQsImV4cCI6MjEwMjIzMDgwNH0.t_snhtVLc_vHGz2sGDk57PSXi3noH1QzRhL47hxmaRw';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Función modularizada para guardar el resultado al terminar la partida en Supabase
async function finalizarPartida(userId, moduleId, puntajeObtenido, nuevoPuntajeTotal, nuevoNivelDesbloqueado) {
  try {
    // 1. Insertar el registro en la tabla game_history
    const { error: historyError } = await supabase
      .from('game_history')
      .insert([
        { 
          user_id: userId, 
          module_id: moduleId, 
          score_obtained: puntajeObtenido,
          completed_at: new Date().toISOString()
        }
      ]);

    if (historyError) {
      console.error('Error al guardar en game_history:', historyError.message);
    } else {
      console.log('✅ Partida registrada exitosamente en el historial.');
    }

    // 2. Actualizar el puntaje total (dls_score) y el nivel desbloqueado en la tabla users
    const { error: userError } = await supabase
      .from('users')
      .update({ 
        dls_score: nuevoPuntajeTotal,
        unlocked_level: nuevoNivelDesbloqueado
      })
      .eq('id', userId);

    if (userError) {
      console.error('Error al actualizar el usuario en Supabase:', userError.message);
    } else {
      console.log('✅ Puntaje de usuario y nivel actualizados en Supabase.');
    }

  } catch (err) {
    console.error('Error inesperado al sincronizar con Supabase:', err);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Validar Sesión del Usuario
  const userRaw = localStorage.getItem('cz_user');
  if (!userRaw) {
    window.location.href = 'login.html';
    return;
  }
  const user = JSON.parse(userRaw);

  // Reglas del juego
  const MIN_PASS_SCORE = 300;
  const BASE_QUESTION_TIME = 15; // 15 segundos base por pregunta
  const PENALTY_POINTS = -50;    // Puntos a restar por respuesta incorrecta o tiempo agotado
  const GAME_OVER_THRESHOLD = -150; // Límite negativo severo general para Game Over

  // Control del temporizador y acumulador de bonus de tiempo
  let timerInterval = null;
  let timeLeft = BASE_QUESTION_TIME;
  let timeBonusForNextQuestion = 0; 
  window.hasExtraChance = false; // Bandera para controlar la repesca

  // Limpieza total de puntajes temporales al cargar el script
  sessionStorage.removeItem('cz_current_score');
  sessionStorage.removeItem('cz_current_multiplier');

  // 2. Inicializar Motores
  const levelManager = new LevelManager();
  const scoreEngine = new ScoreEngine();
  scoreEngine.initNewAttempt(); 

  const selectedAvatar = user.avatar || 'panda_hacker';
  const avatarManager = new AvatarManager(selectedAvatar);

  // 3. Referencias al DOM del Gameplay
  const nicknameEl = document.getElementById('user-nickname');
  const levelTitleTagEl = document.getElementById('level-title-tag');
  const scoreEl = document.getElementById('user-score');
  const comboEl = document.getElementById('combo-multiplier');
  const avatarImgEl = document.getElementById('user-avatar');
  const gameTitleEl = document.getElementById('game-title');
  const gameInstructionEl = document.getElementById('game-instruction');
  const codeSnippetEl = document.getElementById('code-snippet');
  const optionsContainerEl = document.getElementById('options-container');
  const progressBarEl = document.getElementById('game-progress');
  const logoutBtn = document.getElementById('logout-btn');
  const panelBtn = document.querySelector("a[href='levels.html'], button[onclick*='levels.html']");

  // Referencias a Modales de Instrucciones y Retroalimentación
  const instructionsModalEl = document.getElementById('instructions-modal');
  const closeInstructionsBtn = document.getElementById('close-instructions-btn');
  const startGameBtn = document.getElementById('start-game-btn');

  const feedbackModalEl = document.getElementById('feedback-modal');
  const modalStatusTitleEl = document.getElementById('modal-status-title');
  const modalExplanationTextEl = document.getElementById('modal-explanation-text');
  const modalAvatarImgEl = document.getElementById('modal-avatar-img');
  let nextBtn = document.getElementById('next-btn');

  if (comboEl) {
    comboEl.style.display = 'none';
  }

  // Renderizar HUD Inicial
  if (nicknameEl) nicknameEl.textContent = user.nickname || user.email.split('@')[0];
  if (scoreEl) scoreEl.textContent = '0';
  if (avatarImgEl) avatarManager.setExpression('happy');

  // Cargar nivel
  const activeLevelFile = sessionStorage.getItem('current_level_file') || 'level1_ui.json';
  const levelData = await levelManager.loadLevel(activeLevelFile);

  if (!levelData) {
    console.error('Error al cargar la estructura del nivel.');
    window.location.href = 'levels.html';
    return;
  }

  if (levelTitleTagEl && levelData.title) {
    levelTitleTagEl.textContent = levelData.title;
  }

  // BARAJADO ALEATORIO Y GARANTÍA DE PREGUNTAS (Soporte para 4 base + 1 repesca)
  if (levelData.games && Array.isArray(levelData.games)) {
    levelData.games = [...levelData.games].sort(() => 0.5 - Math.random());
    if (levelData.games.length > 5) {
      levelData.games = levelData.games.slice(0, 5);
    }
  }

  // Funcionalidad del Modal de Instrucciones Iniciales
  function dismissInstructions() {
    if (instructionsModalEl) {
      instructionsModalEl.classList.add('hidden');
    }
    renderCurrentGame();
  }

  if (closeInstructionsBtn) {
    closeInstructionsBtn.addEventListener('click', dismissInstructions);
  }
  if (startGameBtn) {
    startGameBtn.addEventListener('click', dismissInstructions);
  }

  // 4. Lógica del Temporizador y Barra Visual
  function startTimer() {
    stopTimer();

    const maxTime = BASE_QUESTION_TIME + timeBonusForNextQuestion;
    timeLeft = maxTime;
    timeBonusForNextQuestion = 0; // Consumir bonus

    updateTimerUI(timeLeft, maxTime);

    timerInterval = setInterval(() => {
      timeLeft -= 0.1;
      updateTimerUI(timeLeft, maxTime);

      if (timeLeft <= 0) {
        stopTimer();
        handleTimeOut();
      }
    }, 100);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function updateTimerUI(current, max) {
    if (progressBarEl) {
      const percentage = Math.max(0, (current / max) * 100);
      progressBarEl.style.width = `${percentage}%`;

      if (percentage < 25) {
        progressBarEl.style.backgroundColor = '#ff0055'; // Rojo crítico
      } else if (percentage < 50) {
        progressBarEl.style.backgroundColor = '#ffcc00'; // Amarillo advertencia
      } else {
        progressBarEl.style.backgroundColor = '#00ff66'; // Verde normal
      }
    }
  }

  function handleTimeOut() {
    const currentGame = levelManager.getCurrentGame();
    handleOptionSelect(null, { isCorrect: false }, currentGame, true);
  }

  // 5. Renderizar Minijuego Activo
  function renderCurrentGame() {
    const currentGame = levelManager.getCurrentGame();
    if (!currentGame) return;

    if (feedbackModalEl) feedbackModalEl.classList.add('hidden');
    if (optionsContainerEl) optionsContainerEl.innerHTML = '';

    if (gameTitleEl) gameTitleEl.textContent = `${levelData.title} - ${currentGame.title || 'Reto'}`;
    if (gameInstructionEl) gameInstructionEl.textContent = currentGame.instruction || currentGame.question;
    if (codeSnippetEl) codeSnippetEl.textContent = currentGame.codeSnippet || currentGame.code || '// Sin código relevante';

    const optionsToRender = [...(currentGame.options || [])].sort(() => 0.5 - Math.random());

    optionsToRender.forEach(option => {
      const btn = document.createElement('button');
      btn.className = 'cyber-btn option-btn';
      btn.textContent = option.text;

      const optionId = option.id !== undefined ? option.id : option.text;
      btn.dataset.optionId = optionId;

      btn.addEventListener('click', () => handleOptionSelect(optionId, option, currentGame, false));
      optionsContainerEl.appendChild(btn);
    });

    startTimer();
  }

  // 6. Manejar Selección de Respuesta, Resta de Puntos y Descalificación
  function handleOptionSelect(optionId, optionObj, currentGame, isTimeOut = false) {
    stopTimer();

    const allBtns = optionsContainerEl.querySelectorAll('.option-btn');
    allBtns.forEach(btn => (btn.disabled = true));

    let isCorrect = false;
    let points = 100;
    let explanationText = currentGame.explanation || 'Sin explicación disponible.';

    if (isTimeOut) {
      isCorrect = false;
      explanationText = '⏱️ ¡Tiempo agotado! No respondiste a tiempo.';
    } else if (levelManager.validateAnswer) {
      const validation = levelManager.validateAnswer(optionId);
      isCorrect = validation.isCorrect;
      points = validation.points || 100;
      if (validation.feedback) {
        explanationText = validation.feedback;
      }
    } else {
      isCorrect = optionObj.isCorrect === true;
    }

    if (!isCorrect && !isTimeOut) {
      if (explanationText.includes('¡Correcto!')) {
        explanationText = explanationText.replace('¡Correcto!', '').trim();
      }
      explanationText = `La respuesta correcta es: ${currentGame.correctAnswerDescription || explanationText}`;
    } else if (isTimeOut) {
      explanationText = `La respuesta correcta era la opción esperada.`;
    }

    const hasSpeedBonus = !isTimeOut && timeLeft > 7;
    
    if (isCorrect && !isTimeOut && hasSpeedBonus) {
      timeBonusForNextQuestion = 2; 
      explanationText += ' ⚡ ¡BONUS VELOCIDAD: +20 PTS y +2s adicionales para el próximo reto!';
    } else if (!isCorrect && !isTimeOut) {
      explanationText += ` ⚠️ Penalización: ${PENALTY_POINTS} PTS.`;
    }

    // Actualizar puntaje a través del ScoreEngine
    const scoreResult = scoreEngine.addResult(
      isCorrect, 
      points, 
      isTimeOut, 
      hasSpeedBonus ? true : timeLeft
    );
    const updatedScore = scoreResult.totalScore;

    if (scoreEl) scoreEl.textContent = updatedScore;

    // --- VALIDACIÓN COMBINADA DE GAME OVER ---
    const isBelowNegativeLimit = updatedScore <= GAME_OVER_THRESHOLD;
    const currentQuestionIndex = levelManager.currentGameIndex; 
    const isGameOverAtQuestion3OrLater = (currentQuestionIndex >= 2) && (updatedScore <= 0);

    const isGameOverByThreshold = isBelowNegativeLimit || isGameOverAtQuestion3OrLater;
    const isGameOver = isGameOverByThreshold;

    // Configurar Modal
    if (modalStatusTitleEl) {
      if (isGameOver) {
        modalStatusTitleEl.textContent = '☠️ ¡JUEGO TERMINADO!';
        modalStatusTitleEl.style.color = '#ff0055';
      } else if (isTimeOut) {
        modalStatusTitleEl.textContent = '¡TIEMPO AGOTADO!';
        modalStatusTitleEl.style.color = '#ff9900';
      } else {
        modalStatusTitleEl.textContent = isCorrect ? '¡CÓDIGO CORRECTO!' : '¡ERROR DE SINTAXIS!';
        modalStatusTitleEl.style.color = isCorrect ? '#00ff66' : '#ff0055';
      }
    }

    if (modalExplanationTextEl) {
      if (isGameOverByThreshold) {
        let reasonText = "";
        if (isGameOverAtQuestion3OrLater) {
          reasonText = `Llegaste a la pregunta 3 con un puntaje de ${updatedScore} (0 o menos puntos). El juego se detiene por descalificación temprana.`;
        } else {
          reasonText = `Has acumulado -150 puntos o menos. El juego se ha detenido por descalificación.`;
        }
        modalExplanationTextEl.textContent = `${explanationText}\n${reasonText}`;
      } else {
        modalExplanationTextEl.textContent = explanationText;
      }
    }

    if (modalAvatarImgEl) {
      modalAvatarImgEl.src = isCorrect 
        ? 'assets/avatars/byte_happy.png' 
        : 'assets/avatars/byte_sad.png';
    }

    if (avatarManager.reactToAnswer) {
      avatarManager.reactToAnswer(isCorrect, explanationText);
    }

    if (nextBtn) {
      if (isGameOverByThreshold) {
        nextBtn.textContent = 'REINICIAR NIVEL 🏆';
        nextBtn.dataset.gameOver = 'true';
      } else {
        nextBtn.dataset.gameOver = 'false';
        nextBtn.textContent = levelManager.isLastGame() ? 'VER RESULTADOS 🎉' : 'CONTINUAR →';
      }
    }

    if (feedbackModalEl) {
      feedbackModalEl.classList.remove('hidden');
    }
  }

  // 7. Navegación, Repesca y Finalización de Nivel (Optimizada con clonación de botón para evitar bloqueos)
  if (nextBtn) {
    const newNextBtn = nextBtn.cloneNode(true);
    nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
    nextBtn = newNextBtn;

    nextBtn.addEventListener('click', async () => {
      if (nextBtn.dataset.gameOver === 'true') {
        sessionStorage.removeItem('cz_current_score');
        window.location.reload();
        return;
      }

      const finalScore = scoreEngine.getScore();
      const currentQuestionIndex = levelManager.currentGameIndex;

      // CONDICIÓN DE REPESCA: Evaluada al terminar la 4ta pregunta (índice 3) para TODOS los módulos
      const isFourthQuestionFinished = (currentQuestionIndex === 3);

      if (isFourthQuestionFinished && finalScore >= 200 && finalScore < MIN_PASS_SCORE && !window.hasExtraChance) {
        window.hasExtraChance = true;
        
        if (modalStatusTitleEl && modalExplanationTextEl && feedbackModalEl) {
          modalStatusTitleEl.textContent = '⚡ ¡OPORTUNIDAD DE REPESCA!';
          modalStatusTitleEl.style.color = '#ffcc00';
          modalExplanationTextEl.textContent = `Tu puntaje acumulado es de ${finalScore} PTS. ¡Estás muy cerca de la meta! Se te otorgará 1 pregunta adicional de repesca para alcanzar los 300 puntos y aprobar.`;
          nextBtn.textContent = '¡ACEPTAR RETO EXTRA! →';
          feedbackModalEl.classList.remove('hidden');
          
          if (levelData.games && levelData.games.length > 4) {
            levelManager.currentGameIndex = 4; // Avanzar explícitamente al índice 4 (5ta pregunta)
          }
          return; 
        }
      }

      // Si el usuario acaba de aceptar la repesca y está en la 5ta pregunta (índice 4)
      if (currentQuestionIndex === 4 && window.hasExtraChance && feedbackModalEl && !feedbackModalEl.classList.contains('hidden')) {
        feedbackModalEl.classList.add('hidden');
        renderCurrentGame();
        return;
      }

      // Verificamos si es realmente la última pregunta del bloque actual
      if (levelManager.isLastGame()) {
        stopTimer();

        const passed = finalScore >= MIN_PASS_SCORE;
        const currentUser = JSON.parse(localStorage.getItem('cz_user') || userRaw);
        if (!currentUser.history) currentUser.history = [];

        // Registrar intento actual en el historial local del usuario
        currentUser.history.push({
          module: activeLevelFile,
          score: finalScore,
          date: new Date().toISOString(),
          passed: passed
        });

        const extractedModuleId = parseInt(activeLevelFile.replace(/[^0-9]/g, '')) || 1;

        if (passed) {
          const currentLvl = parseInt(currentUser.unlocked_level || currentUser.unlockedLevel) || 1;
          const newUnlockedLevel = Math.max(currentLvl, extractedModuleId + 1);

          currentUser.unlockedLevel = newUnlockedLevel;
          currentUser.unlocked_level = newUnlockedLevel;

          // --- CÁLCULO DE PUNTAJE TOTAL: Máximo puntaje por cada módulo único ---
          const bestScoresByModule = {};
          currentUser.history.forEach(item => {
            if (!bestScoresByModule[item.module] || item.score > bestScoresByModule[item.module]) {
              bestScoresByModule[item.module] = item.score;
            }
          });
          
          let totalAccumulatedScore = Object.values(bestScoresByModule).reduce((acc, score) => acc + score, 0);
          currentUser.dls_score = totalAccumulatedScore;

          // GUARDADO CRÍTICO LOCAL ANTES DE SUPABASE
          localStorage.setItem('cz_user', JSON.stringify(currentUser));
          scoreEngine.saveToSession();

          // LLAMADA A SUPABASE PARA SINCRONIZAR
          await finalizarPartida(currentUser.id, extractedModuleId, finalScore, totalAccumulatedScore, newUnlockedLevel);

         // --- VENTANA FLOTANTE DE PREMIO ANTES DE REDIRIGIR ---
         if (modalStatusTitleEl && modalExplanationTextEl && feedbackModalEl) {
           
           // Cambia el número 4 por el ID de tu último módulo en caso de ser necesario
           const ULTIMO_MODULO_ID = 4; 

           if (extractedModuleId === ULTIMO_MODULO_ID) {
             modalStatusTitleEl.textContent = '🏆 ¡JUEGO COMPLETADO CON ÉXITO!';
             modalStatusTitleEl.style.color = '#00ff66';
             modalExplanationTextEl.innerHTML = `¡Increíble trabajo! Has completado el último módulo con <strong>${finalScore} PTS</strong>.<br><br>🎁 <strong>¡Premio Especial Desbloqueado!</strong> Has ganado <strong>2 libros de programación</strong>:<br>📚 <a href="https://drive.google.com/file/d/1AP0gLrE2AMIIz9NFb4mRL8ar2MRLTqTm/view?usp=drive_link" target="_blank" style="color: #00ffff; text-decoration: underline;">Descargar Libro 1</a><br>📚 <a href="https://drive.google.com/file/d/1HwKFtyBLotM3eVu9urysN2TMwLB1Mocq/view?usp=drive_link" target="_blank" style="color: #00ffff; text-decoration: underline;">Descargar Libro 2</a>`;
           } else {
             modalStatusTitleEl.textContent = '🎉 ¡NIVEL COMPLETADO CON ÉXITO!';
             modalStatusTitleEl.style.color = '#00ff66';
             modalExplanationTextEl.innerHTML = `¡Excelente trabajo! Has obtenido <strong>${finalScore} PTS</strong>.<br><br>🏆 <strong>¡Premio desbloqueado!</strong> Has ganado insignia de nivel y acceso al siguiente módulo.`;
           }
           
           if (modalAvatarImgEl) {
              modalAvatarImgEl.src = 'assets/avatars/byte_happy.png';
           }
           
           nextBtn.textContent = 'IR AL PANEL DE NIVELES 🚀';
           nextBtn.dataset.gameOver = 'false';
           
           // Modificamos temporalmente el evento del botón para que al hacer clic en la ventana de premio redirija
           const finalRedirectBtn = nextBtn.cloneNode(true);
           nextBtn.parentNode.replaceChild(finalRedirectBtn, nextBtn);
           finalRedirectBtn.addEventListener('click', () => {
              window.location.href = 'levels.html';
           });

           feedbackModalEl.classList.remove('hidden');
           return;
         }

          window.location.href = 'levels.html';
          return; 

        } else {
          localStorage.setItem('cz_user', JSON.stringify(currentUser));
          sessionStorage.removeItem('cz_current_score');
          sessionStorage.removeItem('cz_current_multiplier');
          window.location.href = 'levels.html';
        }

      } else {
        levelManager.nextGame();
        renderCurrentGame();
      }
    });
  }

  // Eventos de salida y controles
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      stopTimer();
      localStorage.removeItem('cz_user');
      sessionStorage.removeItem('current_level_file');
      sessionStorage.removeItem('cz_current_score');
      sessionStorage.removeItem('cz_current_multiplier');
      window.location.href = 'login.html';
    });
  }

  if (panelBtn) {
    panelBtn.addEventListener('click', () => {
      stopTimer();
      sessionStorage.removeItem('cz_current_score');
      sessionStorage.removeItem('cz_current_multiplier');
    });
  }

  // Lógica robusta y definitiva del botón de reiniciar
  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (confirm('¿Estás seguro de reiniciar todo el progreso? Se borrarán tus puntajes y se bloquearán nuevamente los módulos.')) {
        stopTimer();
        
        // 1. Limpieza profunda de session y local storage local
        sessionStorage.clear();
        localStorage.removeItem('cz_unlocked_levels');
        
        if (user) {
          user.unlockedLevel = 1;
          user.unlocked_level = 1;
          user.dls_score = 0;
          user.history = [];
          localStorage.setItem('cz_user', JSON.stringify(user));
        }

        // 2. Sincronización con Supabase (actualizando por ID y por Email para evitar fallos)
        try {
          if (user) {
            let updateQuery = supabase
              .from('users')
              .update({ 
                unlocked_level: 1,
                dls_score: 0 
              });

            // Condicionamos la actualización según lo que exista disponible en el objeto user
            if (user.id) {
              updateQuery = updateQuery.eq('id', user.id);
            } else if (user.email) {
              updateQuery = updateQuery.eq('email', user.email);
            }

            const { error: updateError } = await updateQuery;

            if (updateError) {
              console.error('Error al actualizar Supabase en el reinicio:', updateError.message);
            } else {
              console.log('✅ Progreso reseteado a 0 en Supabase exitosamente.');
            }

            // Opcional: Si deseas limpiar también el historial de partidas de este usuario en Supabase
            if (user.id) {
              await supabase
                .from('game_history')
                .delete()
                .eq('user_id', user.id);
            }
          }
        } catch (syncErr) {
          console.error('Error inesperado al sincronizar el reinicio en Supabase:', syncErr);
        }

        window.location.href = 'levels.html';
      }
    });
  }
});
