import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Importar rutas API de la aplicación
import authRoutes from './routes/auth.routes.js';

// Cargar variables de entorno desde el archivo .env
dotenv.config();

// Obtener la ruta del directorio actual (equivalente a __dirname en ES Modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Servir archivos estáticos de la carpeta 'public' (HTML, CSS, JS, imágenes)
app.use(express.static(path.join(__dirname, 'public')));

// === RUTAS API DE LA APLICACIÓN ===

// Rutas de Autenticación (Registro, Login)
app.use('/api/auth', authRoutes);

// Ruta API de prueba para verificar que el backend responda
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'CÓDIGO ZERO: EL DESAFÍO',
    message: 'Servidor operativo y listo para evaluar devs.',
    timestamp: new Date().toISOString()
  });
});

// === RUTAS DEL FRONTEND ===

// Ruta principal -> Carga la Landing Page (Presentación para la exposición)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Arrancar el servidor Node.js
app.listen(PORT, () => {
  console.log(`
  ======================================================
  🚀 CÓDIGO ZERO: EL DESAFÍO
  👉 Servidor ejecutándose en: http://localhost:${PORT}
  ======================================================
  `);
});