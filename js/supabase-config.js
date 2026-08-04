const SUPABASE_URL = 'https://bxrssqnytyiwnhvedjna.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Vm3-7etqhH33W_faqX8o6Q_yB_VC2Ln';

// Shared client used by both reports.js and analytics.js — lives here rather
// than in either one so neither page has to load the other's code just to
// get a Supabase connection.
let _supabaseClient;
function getSupabaseClient() {
  if (_supabaseClient !== undefined) return _supabaseClient;
  const notConfigured = !SUPABASE_URL || !SUPABASE_ANON_KEY ||
    SUPABASE_URL.indexOf('YOUR_') === 0 || SUPABASE_ANON_KEY.indexOf('YOUR_') === 0;
  if (notConfigured || !window.supabase) {
    _supabaseClient = null;
  } else {
    _supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _supabaseClient;
}
