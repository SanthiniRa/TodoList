import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://hvgsjchmchkgbnfkuhur.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2Z3NqY2htY2hrZ2JuZmt1aHVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3MzQ0NTMsImV4cCI6MjA5MzMxMDQ1M30.ShhX8C2suVvGBV6qjZylIBpuXhN8iGLyOm0m5e-gIWU'
  ,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    }
  )
