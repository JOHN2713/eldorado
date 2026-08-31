export function authModeFromLocationHash(hash = '') {
  const type = new URLSearchParams(String(hash).replace(/^#/, '')).get('type');
  return type === 'invite' || type === 'recovery' ? 'reset' : 'login';
}
