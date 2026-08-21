/* ==========================================================================
   CÓDIGO ZERO - GESTOR DE AVATAR Y DIÁLOGOS (public/js/engine/AvatarManager.js)
   ========================================================================== */

const AVATAR_EXPRESSIONS = {
  byte: {
    happy: './byte_happy.png',
    sad: './byte_sad.png',
    fallback: 'https://i.postimg.cc/JzxdvsKH/pixelcut-export.png'
  },
  ada: {
    happy: './ada_happy.png',
    sad: './ada_sad.png',
    fallback: 'https://i.postimg.cc/HknQWjdM/pixelcut-export-(1).png'
  }
};

export class AvatarManager {
  /**
   * @param {string} avatarName - Nombre base del personaje ('byte' o 'ada')
   */
  constructor(avatarName = 'byte') {
    this.avatarName = avatarName.toLowerCase();
    this.currentExpression = 'happy';
  }

  /**
   * Actualiza la imagen del avatar en pantalla según el estado del resultado
   * @param {'happy'|'sad'} state - Estado emocional del avatar
   */
  setExpression(state = 'happy') {
    this.currentExpression = state;
    const avatarImg = document.getElementById('user-avatar');
    if (!avatarImg) return;

    const character = AVATAR_EXPRESSIONS[this.avatarName] || AVATAR_EXPRESSIONS.byte;
    const newSrc = character[state] || character.fallback;

    // Efecto visual suave de cambio de expresión
    avatarImg.style.opacity = '0.4';
    setTimeout(() => {
      avatarImg.src = newSrc;
      avatarImg.style.opacity = '1';
    }, 150);
  }

  /**
   * Muestra un mensaje de retroalimentación en un bocadillo de diálogo
   * @param {string} message - Texto del diálogo
   * @param {string} title - Título o nombre del asistente (opcional)
   */
  speak(message, title = 'ASISTENTE') {
    let dialogBox = document.getElementById('avatar-dialog-box');
    
    // Si no existe el contenedor de diálogo en el DOM, se genera dinámicamente
    if (!dialogBox) {
      dialogBox = document.createElement('div');
      dialogBox.id = 'avatar-dialog-box';
      dialogBox.className = 'avatar-dialog-box';

      const mainContent = document.querySelector('.game-content') || document.body;
      mainContent.insertBefore(dialogBox, mainContent.firstChild);
    }

    dialogBox.innerHTML = `
      <div class="avatar-speech-bubble">
        <strong>[${title}]:</strong> ${message}
      </div>
    `;
  }

  /**
   * Procesa la reacción automática del avatar tras responder a un minijuego
   * @param {boolean} isCorrect - Resultado de la respuesta
   * @param {string} feedbackText - Explicación pedagógica
   */
  reactToAnswer(isCorrect, feedbackText) {
    if (isCorrect) {
      this.setExpression('happy');
      this.speak(feedbackText || '¡Excelente trabajo! Código optimizado.', 'CORRECTO');
    } else {
      this.setExpression('sad');
      this.speak(feedbackText || '¡Error detected! Revisa la sintaxis.', 'COMPILATION_ERROR');
    }
  }
}
