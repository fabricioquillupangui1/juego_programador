// config/supabase.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// Validar que existan las credenciales antes de instanciar
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERROR CRÍTICO: Las variables SUPABASE_URL o SUPABASE_ANON_KEY no están definidas en el archivo .env');
  process.exit(1);
}

export const supabase = createClient(supabaseUrl, supabaseKey);