/* ==========================================================================
   CÓDIGO ZERO - MOTOR DE PUNTUACIÓN Y COMBOS (public/js/engine/ScoreEngine.js)
   ========================================================================== */

export class ScoreEngine {
  constructor(initialScore = 0) {
    this.score = initialScore;
    this.streak = 0;
    this.multiplier = 1;
  }

  /**
   * Reinicia el puntaje a 0 para un nuevo intento del módulo
   */
  initNewAttempt() {
    this.score = 0;
    this.resetStreak();
    sessionStorage.setItem('cz_current_score', '0');
    sessionStorage.setItem('cz_current_multiplier', '1');
    return this.score;
  }

  /**
   * Carga el puntaje actual guardado en la sesión o desde el perfil de usuario
   */
  initFromSession() {
    const sessionScore = sessionStorage.getItem('cz_current_score');
    if (sessionScore !== null) {
      this.score = parseInt(sessionScore, 10) || 0;
    } else {
      const userRaw = localStorage.getItem('cz_user');
      if (userRaw) {
        try {
          const user = JSON.parse(userRaw);
          this.score = user.dls_score ?? user.score ?? 0;
        } catch (e) {
          console.error('Error al recuperar puntaje de la sesión:', e);
          this.score = 0;
        }
      } else {
        this.score = 0;
      }
    }

    const sessionMultiplier = sessionStorage.getItem('cz_current_multiplier');
    if (sessionMultiplier !== null) {
      this.multiplier = parseInt(sessionMultiplier, 10) || 1;
    }

    return this.score;
  }

  /**
   * Procesa el resultado de un minijuego y calcula los puntos obtenidos o penalizaciones
   * @param {boolean} isCorrect - Indica si la respuesta fue correcta
   * @param {number} pointsInput - Puntos otorgados por el reto o valor base
   * @param {boolean} isTimeOut - Indica si se acabó el tiempo
   * @param {number|boolean} timeLeft - Tiempo restante al responder o indicador directo de bono de velocidad
   * @returns {Object} Resumen de la puntuación calculada
   */
  addResult(isCorrect, pointsInput = 100, isTimeOut = false, timeLeft = 0) {
    if (isCorrect && !isTimeOut) {
      this.streak++;
      this.updateMultiplier();

      // Forzamos los 100 puntos base mínimos por acierto a menos que se especifique lo contrario
      const basePoints = (pointsInput && !isNaN(pointsInput) && pointsInput >= 100) ? pointsInput : 100;

      // Cálculo base con multiplicador de racha
      let pointsEarned = basePoints * this.multiplier;

      // Bono de velocidad si timeLeft > 7 o es true
      let speedBonus = 0;
      if (timeLeft === true || (typeof timeLeft === 'number' && timeLeft > 7)) {
        speedBonus = 20; // Bono de velocidad de +20 puntos
      }

      pointsEarned += speedBonus;
      this.score += pointsEarned;

      sessionStorage.setItem('cz_current_score', this.score.toString());
      sessionStorage.setItem('cz_current_multiplier', this.multiplier.toString());

      return {
        isCorrect: true,
        pointsEarned,
        totalScore: this.score,
        streak: this.streak,
        multiplier: this.multiplier,
        speedBonus
      };
    } else {
      this.resetStreak();
      
      // Aplicar la penalización (ej. -50 puntos o valor negativo de pointsInput)
      const penalty = (pointsInput && pointsInput < 0) ? pointsInput : -50; 
      this.score += penalty;

      sessionStorage.setItem('cz_current_score', this.score.toString());
      sessionStorage.setItem('cz_current_multiplier', '1');

      return {
        isCorrect: false,
        pointsEarned: penalty,
        totalScore: this.score,
        streak: 0,
        multiplier: 1
      };
    }
  }

  /**
   * Actualiza el multiplicador en función de la racha de aciertos consecutivos
   */
  updateMultiplier() {
    if (this.streak >= 5) {
      this.multiplier = 3; // Combo máximo 3x
    } else if (this.streak >= 3) {
      this.multiplier = 2; // Combo intermedio 2x
    } else {
      this.multiplier = 1;
    }
  }

  /**
   * Reinicia la racha y el multiplicador a su valor base
   */
  resetStreak() {
    this.streak = 0;
    this.multiplier = 1;
    sessionStorage.setItem('cz_current_multiplier', '1');
  }

  /**
   * Guarda de forma limpia el puntaje del intento actual en el objeto de usuario local
   */
  saveToSession() {
    const userRaw = localStorage.getItem('cz_user');
    if (userRaw) {
      try {
        const user = JSON.parse(userRaw);
        user.last_attempt_score = this.score;
        localStorage.setItem('cz_user', JSON.stringify(user));
      } catch (e) {
        console.error('Error al guardar puntaje en la sesión:', e);
      }
    }
  }

  /**
   * Obtiene el puntaje acumulado del intento actual
   */
  getScore() {
    const saved = sessionStorage.getItem('cz_current_score');
    return saved !== null ? parseInt(saved, 10) : this.score;
  }

  /**
   * Obtiene la racha actual
   */
  getStreak() {
    return this.streak;
  }

  /**
   * Obtiene el multiplicador actual
   */
  getMultiplier() {
    return this.multiplier;
  }
}