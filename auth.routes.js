// routes/auth.routes.js
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'codigo_zero_secret_key_2026';

// 1. REGISTRO DE USUARIO
router.post('/register', async (req, res) => {
  try {
    const { nickname, email, password, avatar } = req.body;

    if (!nickname || !email || !password) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
    }

    // Hashear la contraseña por seguridad
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insertar en la tabla "users" de Supabase
    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          nickname,
          email,
          password: hashedPassword,
          avatar: avatar || 'byte', // avatar por defecto
          dls_score: 0
        }
      ])
      .select();

    if (error) {
      if (error.code === '23505') { // Violación de unicidad (email o nickname existente)
        return res.status(400).json({ error: 'El correo o nickname ya está registrado.' });
      }
      throw error;
    }

    const user = data[0];
    const token = jwt.sign({ id: user.id, nickname: user.nickname, role: 'student' }, JWT_SECRET, { expiresIn: '8h' });

    return res.status(201).json({
      message: 'Usuario registrado con éxito',
      token,
      user: { id: user.id, nickname: user.nickname, avatar: user.avatar }
    });

  } catch (err) {
    console.error('Error en /register:', err);
    return res.status(500).json({ error: 'Error interno del servidor al registrar.' });
  }
});

// 2. INICIO DE SESIÓN (LOGIN)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Por favor ingresa correo y contraseña.' });
    }

    // Buscar usuario en Supabase
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .limit(1);

    if (error || !users || users.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const user = users[0];

    // Verificar hash de contraseña
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    // Generar JWT
    const token = jwt.sign({ id: user.id, nickname: user.nickname }, JWT_SECRET, { expiresIn: '8h' });

    return res.status(200).json({
      message: 'Inicio de sesión exitoso',
      token,
      user: {
        id: user.id,
        nickname: user.nickname,
        avatar: user.avatar,
        dls_score: user.dls_score
      }
    });

  } catch (err) {
    console.error('Error en /login:', err);
    return res.status(500).json({ error: 'Error al procesar el inicio de sesión.' });
  }
});

export default router;