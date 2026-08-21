/* ==========================================================================
   CÓDIGO ZERO - GESTOR DE NIVELES (public/js/engine/LevelManager.js)
   ========================================================================== */

export class LevelManager {
  constructor() {
    this.currentLevelData = null;
    this.games = [];
    this.currentGameIndex = 0;
  }

  /**
   * Carga el archivo JSON correspondiente al nivel e intenta la ruta local o la carpeta data/
   * @param {string} levelFile - Nombre del archivo (ej: 'level1_ui.json')
   * @returns {Promise<Object|null>} Datos del nivel procesado
   */
  async loadLevel(levelFile) {
    try {
      let response = await fetch(levelFile);
      
      // Fallback: Si no lo encuentra en la raíz, busca dentro de ./data/
      if (!response.ok) {
        response = await fetch(`./data/${levelFile}`);
      }

      if (!response.ok) {
        throw new Error(`Error al cargar el nivel: ${response.statusText}`);
      }

      this.currentLevelData = await response.json();
      
      // Obtener arreglo de preguntas soportando tanto 'questions' como 'games'
      const rawQuestions = this.currentLevelData.questions || this.currentLevelData.games || [];

      if (rawQuestions.length === 0) {
        console.error("El archivo JSON no contiene preguntas o juegos válidos.");
        return null;
      }

      // Algoritmo de desordenado aleatorio (Shuffle) y selección de 4 preguntas
      const shuffled = [...rawQuestions].sort(() => 0.5 - Math.random());
      this.games = shuffled.slice(0, 4);
      this.currentGameIndex = 0;

      return {
        title: this.currentLevelData.module_title || this.currentLevelData.title || "Módulo de Evaluación",
        totalGames: this.games.length
      };
    } catch (error) {
      console.error('Error en LevelManager:', error);
      return null;
    }
  }

  /**
   * Obtiene el reto o pregunta actual adaptando la estructura a la interfaz
   * @returns {Object|null}
   */
  getCurrentGame() {
    if (!this.games || this.games.length === 0 || this.currentGameIndex >= this.games.length) {
      return null;
    }

    const rawGame = this.games[this.currentGameIndex];

    // Mapeo unificado para que funcione tanto con 'questions' como con 'games'
    return {
      gameId: rawGame.id || rawGame.gameId || this.currentGameIndex + 1,
      title: `RETO ${this.currentGameIndex + 1} DE ${this.games.length}`,
      instruction: rawGame.question || rawGame.instruction || "Lee el siguiente problema:",
      codeSnippet: rawGame.code || rawGame.codeSnippet || "// Sin código relevante",
      options: rawGame.options || [],
      explanation: rawGame.explanation || (rawGame.feedback ? rawGame.feedback.success : ""),
      points: rawGame.points || 100,
      raw: rawGame
    };
  }

  /**
   * Avanza al siguiente juego del nivel
   * @returns {Object|null} Retorna el nuevo juego o null si finalizó el nivel
   */
  nextGame() {
    if (this.currentGameIndex < this.games.length - 1) {
      this.currentGameIndex++;
      return this.getCurrentGame();
    }
    return null;
  }

  /**
   * Valida la opción seleccionada contra el juego actual
   * @param {string|number} optionId - ID o valor identificador de la opción elegida
   * @returns {Object} Resultado de la validación con puntos y retroalimentación
   */
  validateAnswer(optionId) {
    const game = this.getCurrentGame();
    if (!game) return { isCorrect: false, points: 0, feedback: 'Juego no disponible.' };

    // Buscar la opción elegida por identificador o texto
    const selectedOption = game.options.find(
      opt => opt.id === optionId || opt.text === optionId
    );

    const isCorrect = selectedOption ? Boolean(selectedOption.isCorrect) : false;

    return {
      isCorrect,
      points: isCorrect ? game.points : 0,
      feedback: game.explanation,
      gameId: game.gameId
    };
  }

  /**
   * Verifica si el juego actual es el último de los 4 retos seleccionados
   * @returns {boolean}
   */
  isLastGame() {
    if (!this.games || this.games.length === 0) return true;
    return this.currentGameIndex >= this.games.length - 1;
  }

  /**
   * Retorna el progreso actual en porcentaje
   * @returns {number} Porcentaje de avance (0 a 100)
   */
  getProgress() {
    if (!this.games || this.games.length === 0) return 0;
    return Math.round(((this.currentGameIndex + 1) / this.games.length) * 100);
  }

  /**
   * Reinicia el estado del nivel actual
   */
  reset() {
    this.currentGameIndex = 0;
  }
}