import express from 'express';

export class StaffError extends Error {
  constructor(code, status = 400) { super(code); this.status = status; }
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function normalizeOrigin(value) {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.origin : '';
  } catch { return ''; }
}

export function normalizeStaff(input = {}) {
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const name = typeof input.name === 'string' ? input.name.trim().replace(/\s+/g, ' ') : '';
  const role = input.role;
  const professional = role === 'barber' || input.professional === true;
  const serviceIds = Array.isArray(input.serviceIds) ? [...new Set(input.serviceIds)] : [];
  if (!emailPattern.test(email) || email.length > 254 || name.length < 2 || name.length > 100 || /[\u0000-\u001f]/.test(name)) throw new StaffError('INVALID_INPUT');
  if (!['admin', 'barber'].includes(role) || serviceIds.some((id) => !uuidPattern.test(id))) throw new StaffError('INVALID_INPUT');
  if (professional && serviceIds.length === 0) throw new StaffError('SERVICES_REQUIRED');
  return { email, name, role, professional, serviceIds };
}

export function staffRouter({ service, origin }) {
  const router = express.Router();
  const allowedOrigin = normalizeOrigin(origin);
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(express.json({ limit: '8kb', strict: true }));
  router.use(async (req, _res, next) => {
    try {
      if (!service || !allowedOrigin) throw new StaffError('STAFF_MANAGEMENT_UNAVAILABLE', 503);
      const match = req.get('authorization')?.match(/^Bearer\s+(.+)$/i);
      if (!match) throw new StaffError('LOGIN_REQUIRED', 401);
      req.staffActor = await service.authenticate(match[1]);
      if (!req.staffActor) throw new StaffError('NOT_AUTHORIZED', 403);
      if (req.method !== 'GET' && req.get('origin') !== allowedOrigin) throw new StaffError('NOT_AUTHORIZED', 403);
      next();
    } catch (error) { next(error); }
  });
  router.get('/users', async (req, res, next) => {
    try { res.json({ users: await service.list(req.staffActor.id) }); }
    catch (error) { next(error); }
  });
  router.post('/users', async (req, res, next) => {
    try {
      const result = await service.create(normalizeStaff(req.body), req.staffActor.id);
      res.status(201).json(result);
    } catch (error) { next(error); }
  });
  router.use((error, _req, res, _next) => {
    const known = ['INVALID_INPUT', 'SERVICES_REQUIRED', 'STAFF_EXISTS', 'LOGIN_REQUIRED', 'NOT_AUTHORIZED', 'STAFF_MANAGEMENT_UNAVAILABLE'];
    const code = error instanceof StaffError ? error.message : known.find((item) => error.message?.includes(item)) || (error.type === 'entity.too.large' ? 'PAYLOAD_TOO_LARGE' : error.type === 'entity.parse.failed' ? 'INVALID_INPUT' : 'STAFF_MANAGEMENT_UNAVAILABLE');
    const status = error.status || (code === 'LOGIN_REQUIRED' ? 401 : code === 'NOT_AUTHORIZED' ? 403 : code === 'STAFF_EXISTS' ? 409 : code === 'STAFF_MANAGEMENT_UNAVAILABLE' ? 503 : 400);
    res.status(status).json({ error: code });
  });
  return router;
}

async function allAuthUsers(database) {
  const users = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await database.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users;
}

export function createStaffService(database, origin) {
  if (!database) return null;
  const redirectTo = new URL('/ingresar', normalizeOrigin(origin) || 'http://invalid.local').href;
  const requireMigration = async () => {
    const { data, error } = await database.rpc('staff_management_version');
    if (error || data !== 1) throw new StaffError('STAFF_MANAGEMENT_UNAVAILABLE', 503);
  };
  return {
    async authenticate(token) {
      const { data: authData, error: authError } = await database.auth.getUser(token);
      if (authError || !authData.user) return null;
      const { data: role, error } = await database.from('user_roles').select('role,active').eq('user_id', authData.user.id).maybeSingle();
      if (error || role?.role !== 'admin' || !role.active) return null;
      return { id: authData.user.id };
    },
    async list() {
      await requireMigration();
      const [{ data: roles, error: rolesError }, { data: professionals, error: professionalsError }, authUsers] = await Promise.all([
        database.from('user_roles').select('user_id,role,active'),
        database.from('professionals').select('id,user_id,name,active'),
        allAuthUsers(database),
      ]);
      if (rolesError) throw rolesError;
      if (professionalsError) throw professionalsError;
      const authById = new Map(authUsers.map((user) => [user.id, user]));
      const professionalByUser = new Map(professionals.filter((item) => item.user_id).map((item) => [item.user_id, item]));
      return roles.map((item) => {
        const auth = authById.get(item.user_id), professional = professionalByUser.get(item.user_id);
        return { userId: item.user_id, email: auth?.email || '', role: item.role, active: item.active, invitedAt: auth?.invited_at || null, lastSignInAt: auth?.last_sign_in_at || null, professional: professional ? { id: professional.id, name: professional.name, active: professional.active } : null };
      }).sort((a, b) => Number(b.active) - Number(a.active) || a.email.localeCompare(b.email));
    },
    async create(input, actorId) {
      // Do not send an invitation when the database cannot assign its protected role yet.
      await requireMigration();
      const users = await allAuthUsers(database);
      let user = users.find((item) => item.email?.toLowerCase() === input.email);
      let invited = false;
      if (!user) {
        const { data, error } = await database.auth.admin.inviteUserByEmail(input.email, { redirectTo, data: { full_name: input.name } });
        if (error || !data.user) throw new StaffError('STAFF_INVITE_FAILED', 502);
        user = data.user; invited = true;
      }
      const { data, error } = await database.rpc('provision_staff', { p_actor: actorId, p_user: user.id, p_role: input.role, p_name: input.name, p_professional: input.professional, p_services: input.serviceIds });
      if (error) throw error;
      return { invited, user: { userId: user.id, email: input.email, role: input.role, active: true, professional: data?.professional_id ? { id: data.professional_id, name: input.name, active: false } : null } };
    },
  };
}
