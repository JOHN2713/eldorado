// Preview only. These records are never written to Supabase.
export const preview = {
  business: { name: 'El Dorado Barbería', address: 'Zámbiza, calle Quito', timezone: 'America/Guayaquil', currency: 'USD', booking_enabled: false, reminder_minutes: 10, slot_step_minutes: 5, min_notice_minutes: 0, horizon_days: 30 },
  services: [
    { id: '10000000-0000-0000-0000-000000000001', name: 'Corte normal', description: 'Un clásico bien hecho. Limpio, preciso y a tu medida.', price: 5, estimated_min_minutes: 30, estimated_max_minutes: 45, duration_minutes: 45, buffer_minutes: 0 },
    { id: '10000000-0000-0000-0000-000000000002', name: 'Corte con diseño', description: 'Detalles que hacen la diferencia. Dale tu toque.', price: 6, estimated_min_minutes: 40, estimated_max_minutes: 50, duration_minutes: 50, buffer_minutes: 0 },
    { id: '10000000-0000-0000-0000-000000000003', name: 'Corte con barba', description: 'Cabello y barba en equilibrio. Acabado completo.', price: 6.5, estimated_min_minutes: 40, estimated_max_minutes: 50, duration_minutes: 50, buffer_minutes: 0 },
    { id: '10000000-0000-0000-0000-000000000004', name: 'Corte completo', description: 'Tu servicio completo. Consulta los detalles en el local.', price: 8, estimated_min_minutes: 50, estimated_max_minutes: 60, duration_minutes: 60, buffer_minutes: 0 },
  ],
  professionals: [],
  business_hours: Array.from({ length: 7 }, (_, weekday) => ({ weekday, start_time: '09:00:00', end_time: '21:00:00' })),
};
