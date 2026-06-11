import { createBrowserClient } from '@supabase/ssr';

// 1. FORZAMOS LOS VALORES DIRECTAMENTE AQUÍ (Copia tu llave larga en la segunda variable)
const supabaseUrl = 'https://pnesuibfgtescgudkerf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuZXN1aWJmZ3Rlc2NndWRrZXJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODIzMjEsImV4cCI6MjA5NTE1ODMyMX0.V8s-7a9pNSEPZm0rUS9iQB156OeE9h5ASjp02Qyv2cw';

// 2. Quitamos la validación de errores temporalmente
export const supabase = createBrowserClient(supabaseUrl, supabaseKey);