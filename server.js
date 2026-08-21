import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Importar rutas API de la aplicación
import authRoutes from './auth.routes.js';

// Cargar variables de entorno
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Servir archivos estáticos (si tus archivos HTML/JS están en la raíz, usamos __dirname directamente)
app.use(express.static(__dirname));

// === RUTAS API ===
app.use('/api/auth', authRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'CÓDIGO ZERO: EL DESAFÍO',
    message: 'Servidor operativo y listo.',
    timestamp: new Date().toISOString()
  });
});

// Ruta principal -> Carga index.html desde la raíz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// IMPORTANTE PARA RENDER: Permitir que siempre escuche el puerto en producción
app.listen(PORT, () => {
  console.log(`🚀 CÓDIGO ZERO ejecutándose en el puerto ${PORT}`);
});
