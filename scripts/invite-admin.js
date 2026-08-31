import { createClient } from '@supabase/supabase-js';

const email = String(process.argv[2] || '').trim().toLowerCase();
const invite = process.argv.includes('--invite');
const origin = process.env.ADMIN_REDIRECT_ORIGIN || process.env.PUBLIC_APP_ORIGIN;
const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

function stop(code, label) {
  console.error(label);
  process.exitCode = code;
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) stop(2, 'INVALID_EMAIL');
else if (!url || !secret) stop(2, 'SERVER_CONFIGURATION_REQUIRED');
else {
  const supabase = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
  let user;
  for (let page = 1; page <= 10 && !user; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) { stop(1, `LIST_USERS_FAILED:${error.code || 'UNKNOWN'}`); break; }
    user = data.users.find((item) => item.email?.toLowerCase() === email);
    if (data.users.length < 1000) break;
  }

  let status = 'EXISTING_USER';
  if (!process.exitCode && !user && !invite) stop(3, 'USER_NOT_FOUND');
  if (!process.exitCode && !user && invite) {
    let redirectTo;
    try {
      const parsed = new URL(origin);
      if (parsed.protocol !== 'https:') throw new Error('HTTPS_REQUIRED');
      redirectTo = new URL('/ingresar', parsed.origin).href;
    } catch { stop(2, 'VALID_HTTPS_REDIRECT_REQUIRED'); }
    if (!process.exitCode) {
      const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, { redirectTo, data: { full_name: 'Administrador' } });
      if (error || !data.user) stop(1, `INVITE_FAILED:${error?.code || 'UNKNOWN'}`);
      else { user = data.user; status = 'INVITED'; }
    }
  }

  if (!process.exitCode && user) {
    const { data: linked, error: linkedError } = await supabase.from('professionals').select('id').eq('user_id', user.id).limit(1);
    if (linkedError) stop(1, `PROFESSIONAL_CHECK_FAILED:${linkedError.code || 'UNKNOWN'}`);
    else if (linked.length) stop(4, 'USER_IS_LINKED_PROFESSIONAL');
    else {
      const { error } = await supabase.from('user_roles').upsert({ user_id: user.id, role: 'admin', active: true }, { onConflict: 'user_id' });
      if (error) stop(1, `ROLE_ASSIGNMENT_FAILED:${error.code || 'UNKNOWN'}`);
      else console.log(status === 'INVITED' ? 'ADMIN_INVITED_AND_ACTIVATED' : 'ADMIN_ACTIVATED');
    }
  }
}
