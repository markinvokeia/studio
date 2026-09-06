-- ============================================================================
--  Clínica Imagen — Carga de horarios por sede (public.clinic_schedules)
--  Generado: 2026-09-05
--
--  Fuentes:
--    1) Planilla operativa de horarios (sedes 3,4,5,6,7,8) — tiene los cortes
--       reales de mediodía, por eso prevalece sobre la web.
--    2) https://clinicaimagen.uy/ubicaciones-de-las-clinicas/ (sedes 9..13 y
--       verificación del resto).
--
--  Convención day_of_week (igual que EXTRACT(DOW) de Postgres):
--    0=Domingo 1=Lunes 2=Martes 3=Miércoles 4=Jueves 5=Viernes 6=Sábado
--    >>> Si tu app usa 1=Lunes..7=Domingo, ajustá el mapeo antes de correr.
--
--  Domingo: ninguna sede abre -> no se insertan filas de domingo.
--  Las filas comentadas (-- OPCIONAL) son días que hoy NO abren; descomentá
--  solo si corresponde.
-- ============================================================================

BEGIN;

-- Limpieza previa: borra los horarios actuales de estas sedes para dejar
-- la carga consistente. Comentá este DELETE si querés conservar lo existente.
DELETE FROM public.clinic_schedules
 WHERE sede_id IN (3,4,5,6,7,8,9,10,11,12,13);

INSERT INTO public.clinic_schedules (sede_id, day_of_week, start_time, end_time) VALUES

-- ---------------------------------------------------------------------------
-- sede_id 3 — Montevideo Shopping
-- Datos operativos. Web: L-V 8-20, Sáb 8-13.
-- ---------------------------------------------------------------------------
  ( 3, 1, '08:00', '12:45'), -- Lunes      Montevideo Shopping
  ( 3, 1, '13:30', '19:45'), -- Lunes      Montevideo Shopping
  ( 3, 2, '08:00', '12:45'), -- Martes     Montevideo Shopping
  ( 3, 2, '13:30', '19:45'), -- Martes     Montevideo Shopping
  ( 3, 3, '08:00', '12:45'), -- Miércoles  Montevideo Shopping
  ( 3, 3, '13:30', '19:45'), -- Miércoles  Montevideo Shopping
  ( 3, 4, '08:00', '12:45'), -- Jueves     Montevideo Shopping
  ( 3, 4, '13:30', '19:45'), -- Jueves     Montevideo Shopping
  ( 3, 5, '08:00', '12:45'), -- Viernes    Montevideo Shopping
  ( 3, 5, '13:30', '19:45'), -- Viernes    Montevideo Shopping
  ( 3, 6, '08:15', '12:45'), -- Sábado     Montevideo Shopping

-- ---------------------------------------------------------------------------
-- sede_id 4 — Nuevo Centro
-- Datos operativos. Web: L-V 8-20, Sáb 9-14.
-- ---------------------------------------------------------------------------
  ( 4, 1, '08:00', '12:45'), -- Lunes      Nuevo Centro
  ( 4, 1, '13:00', '19:45'), -- Lunes      Nuevo Centro
  ( 4, 2, '08:00', '12:45'), -- Martes     Nuevo Centro
  ( 4, 2, '13:00', '19:45'), -- Martes     Nuevo Centro
  ( 4, 3, '08:00', '12:45'), -- Miércoles  Nuevo Centro
  ( 4, 3, '13:00', '19:45'), -- Miércoles  Nuevo Centro
  ( 4, 4, '08:00', '12:45'), -- Jueves     Nuevo Centro
  ( 4, 4, '13:00', '19:45'), -- Jueves     Nuevo Centro
  ( 4, 5, '08:00', '12:45'), -- Viernes    Nuevo Centro
  ( 4, 5, '13:00', '19:45'), -- Viernes    Nuevo Centro
  ( 4, 6, '09:00', '13:45'), -- Sábado     Nuevo Centro

-- ---------------------------------------------------------------------------
-- sede_id 5 — Caudillos
-- Datos operativos. Web: L-V 8-20, Sáb 9-14.
-- ---------------------------------------------------------------------------
  ( 5, 1, '08:00', '12:45'), -- Lunes      Caudillos
  ( 5, 1, '13:30', '19:45'), -- Lunes      Caudillos
  ( 5, 2, '08:00', '12:45'), -- Martes     Caudillos
  ( 5, 2, '13:30', '19:45'), -- Martes     Caudillos
  ( 5, 3, '08:00', '12:45'), -- Miércoles  Caudillos
  ( 5, 3, '13:30', '19:45'), -- Miércoles  Caudillos
  ( 5, 4, '08:00', '12:45'), -- Jueves     Caudillos
  ( 5, 4, '13:30', '19:45'), -- Jueves     Caudillos
  ( 5, 5, '08:00', '12:45'), -- Viernes    Caudillos
  ( 5, 5, '13:30', '19:45'), -- Viernes    Caudillos
  ( 5, 6, '09:00', '13:45'), -- Sábado     Caudillos

-- ---------------------------------------------------------------------------
-- sede_id 6 — Atlántida
-- Solo periapicales, escaneos y OPT. SIN miércoles ni sábado (ver web). Web: Lun 8-14; Mar/Jue/Vie 8-16.
-- ---------------------------------------------------------------------------
  ( 6, 1, '08:00', '11:30'), -- Lunes      Atlántida
  ( 6, 2, '08:00', '11:30'), -- Martes     Atlántida
  ( 6, 2, '14:00', '15:30'), -- Martes     Atlántida
-- OPCIONAL (Miércoles no abre hoy): (6, 3, '08:00', '18:00'),
  ( 6, 4, '08:00', '11:45'), -- Jueves     Atlántida
  ( 6, 4, '14:00', '15:30'), -- Jueves     Atlántida
  ( 6, 5, '08:00', '11:45'), -- Viernes    Atlántida
  ( 6, 5, '14:00', '15:30'), -- Viernes    Atlántida
-- OPCIONAL (Sábado no abre hoy): (6, 6, '08:00', '18:00'),

-- ---------------------------------------------------------------------------
-- sede_id 7 — Carrasco
-- Datos operativos. Web: L-V 8-20, Sáb 9-14.
-- ---------------------------------------------------------------------------
  ( 7, 1, '08:00', '12:00'), -- Lunes      Carrasco
  ( 7, 1, '12:30', '19:45'), -- Lunes      Carrasco
  ( 7, 2, '08:00', '12:00'), -- Martes     Carrasco
  ( 7, 2, '12:30', '19:45'), -- Martes     Carrasco
  ( 7, 3, '08:00', '12:00'), -- Miércoles  Carrasco
  ( 7, 3, '12:30', '19:45'), -- Miércoles  Carrasco
  ( 7, 4, '08:00', '12:00'), -- Jueves     Carrasco
  ( 7, 4, '12:30', '19:45'), -- Jueves     Carrasco
  ( 7, 5, '08:00', '12:00'), -- Viernes    Carrasco
  ( 7, 5, '12:30', '19:45'), -- Viernes    Carrasco
  ( 7, 6, '09:00', '13:45'), -- Sábado     Carrasco

-- ---------------------------------------------------------------------------
-- sede_id 8 — Lagomar
-- Datos operativos. Web: L-V 8-20, Sáb 9-14.
-- ---------------------------------------------------------------------------
  ( 8, 1, '08:00', '12:15'), -- Lunes      Lagomar
  ( 8, 1, '13:00', '19:45'), -- Lunes      Lagomar
  ( 8, 2, '08:00', '12:15'), -- Martes     Lagomar
  ( 8, 2, '13:00', '19:45'), -- Martes     Lagomar
  ( 8, 3, '08:00', '12:15'), -- Miércoles  Lagomar
  ( 8, 3, '13:00', '19:45'), -- Miércoles  Lagomar
  ( 8, 4, '08:00', '12:15'), -- Jueves     Lagomar
  ( 8, 4, '13:00', '19:45'), -- Jueves     Lagomar
  ( 8, 5, '08:00', '12:15'), -- Viernes    Lagomar
  ( 8, 5, '13:00', '19:45'), -- Viernes    Lagomar
  ( 8, 6, '08:00', '13:45'), -- Sábado     Lagomar

-- ---------------------------------------------------------------------------
-- sede_id 9 — Punta del Este
-- FUENTE: web (sin corte de mediodía publicado). L-V 08:00-20:00, Sáb 09:00-13:00.
-- ---------------------------------------------------------------------------
  ( 9, 1, '08:00', '20:00'), -- Lunes      Punta del Este
  ( 9, 2, '08:00', '20:00'), -- Martes     Punta del Este
  ( 9, 3, '08:00', '20:00'), -- Miércoles  Punta del Este
  ( 9, 4, '08:00', '20:00'), -- Jueves     Punta del Este
  ( 9, 5, '08:00', '20:00'), -- Viernes    Punta del Este
  ( 9, 6, '09:00', '13:00'), -- Sábado     Punta del Este

-- ---------------------------------------------------------------------------
-- sede_id 10 — Las Piedras
-- FUENTE: web. L-V 8:30-12:30 y 15-19, Sáb 8-14.
-- ---------------------------------------------------------------------------
  (10, 1, '08:30', '12:30'), -- Lunes      Las Piedras
  (10, 1, '15:00', '19:00'), -- Lunes      Las Piedras
  (10, 2, '08:30', '12:30'), -- Martes     Las Piedras
  (10, 2, '15:00', '19:00'), -- Martes     Las Piedras
  (10, 3, '08:30', '12:30'), -- Miércoles  Las Piedras
  (10, 3, '15:00', '19:00'), -- Miércoles  Las Piedras
  (10, 4, '08:30', '12:30'), -- Jueves     Las Piedras
  (10, 4, '15:00', '19:00'), -- Jueves     Las Piedras
  (10, 5, '08:30', '12:30'), -- Viernes    Las Piedras
  (10, 5, '15:00', '19:00'), -- Viernes    Las Piedras
  (10, 6, '08:00', '14:00'), -- Sábado     Las Piedras

-- ---------------------------------------------------------------------------
-- sede_id 11 — Colonia
-- FUENTE: web. L-Mié 08-20, Jue-Vie 08-16, Sáb 09-13.
-- ---------------------------------------------------------------------------
  (11, 1, '08:00', '20:00'), -- Lunes      Colonia
  (11, 2, '08:00', '20:00'), -- Martes     Colonia
  (11, 3, '08:00', '20:00'), -- Miércoles  Colonia
  (11, 4, '08:00', '16:00'), -- Jueves     Colonia
  (11, 5, '08:00', '16:00'), -- Viernes    Colonia
  (11, 6, '09:00', '13:00'), -- Sábado     Colonia

-- ---------------------------------------------------------------------------
-- sede_id 12 — Libertad
-- FUENTE: web. SIN sábado publicado.
-- ---------------------------------------------------------------------------
  (12, 1, '14:00', '18:30'), -- Lunes      Libertad
  (12, 2, '09:00', '13:00'), -- Martes     Libertad
  (12, 3, '09:00', '12:00'), -- Miércoles  Libertad
  (12, 3, '14:00', '18:30'), -- Miércoles  Libertad
  (12, 4, '17:00', '19:00'), -- Jueves     Libertad
  (12, 5, '09:00', '13:00'), -- Viernes    Libertad
-- OPCIONAL (Sábado no abre hoy): (12, 6, '08:00', '18:00'),

-- ---------------------------------------------------------------------------
-- sede_id 13 — Durazno
-- FUENTE: web. L y Mié 11-19; Mar/Jue/Vie 08-12 y 14-18; Sáb 09-13.
-- ---------------------------------------------------------------------------
  (13, 1, '11:00', '19:00'), -- Lunes      Durazno
  (13, 2, '08:00', '12:00'), -- Martes     Durazno
  (13, 2, '14:00', '18:00'), -- Martes     Durazno
  (13, 3, '11:00', '19:00'), -- Miércoles  Durazno
  (13, 4, '08:00', '12:00'), -- Jueves     Durazno
  (13, 4, '14:00', '18:00'), -- Jueves     Durazno
  (13, 5, '08:00', '12:00'), -- Viernes    Durazno
  (13, 5, '14:00', '18:00'), -- Viernes    Durazno
  (13, 6, '09:00', '13:00'); -- Sábado     Durazno

-- Verificación rápida antes de confirmar:
SELECT s.id, s.name,
       COUNT(*)                              AS tramos,
       COUNT(DISTINCT cs.day_of_week)        AS dias_abiertos,
       string_agg(DISTINCT cs.day_of_week::text, ',' ORDER BY cs.day_of_week::text) AS dias
  FROM public.sedes s
  JOIN public.clinic_schedules cs ON cs.sede_id = s.id
 WHERE s.id IN (3,4,5,6,7,8,9,10,11,12,13)
 GROUP BY s.id, s.name
 ORDER BY s.id;

COMMIT;
-- ROLLBACK;  -- usar en lugar de COMMIT si la verificación no cuadra
