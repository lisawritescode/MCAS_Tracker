import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://wtyxasyktwkktntsdffr.supabase.co"
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0eXhhc3lrdHdra3RudHNkZmZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1ODg3NDUsImV4cCI6MjA5MjE2NDc0NX0.F4PuJXU2rfLB-7rAHI-rbWhdCPYQaoVEB3OWp6O3bys'

export const supabase = createClient(supabaseUrl, supabaseKey)
