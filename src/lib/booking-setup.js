// Read-only guidance. Supabase remains responsible for authorizing activation.
export function professionalSetupIssues(professional, roles, assignments) {
  const issues = [];
  const role = roles.find((item) => item.user_id === professional.user_id);
  if (!professional.active) issues.push('Marca Profesional activo y guarda la jornada.');
  if (!professional.user_id || !role?.active || role.role !== 'barber') issues.push('Falta vincular una cuenta activa con rol de peluquero mediante el script de personal.');
  if (!professional.name?.trim() || /^Peluquero .* —/.test(professional.name)) issues.push('Guarda el nombre que se mostrará al cliente.');
  if (!professional.hours?.length) issues.push('No hay días de trabajo guardados. Marca las casillas de los días, revisa sus horas y pulsa Guardar jornada.');
  if (!assignments.some((item) => item.professional_id === professional.id)) issues.push('No tiene servicios asignados. Completa sus servicios en el script de personal; cambiar precios no los asigna.');
  return issues;
}
