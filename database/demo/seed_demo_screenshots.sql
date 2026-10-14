-- =============================================================================
-- Seed DEMO para capturas de pantalla: 3 doctores, 24 pacientes y una semana
-- (lunes a sábado de la semana actual) de citas en 3 calendarios.
--
-- Marcas para limpieza posterior (ver cleanup_demo_screenshots.sql):
--   users.internal_id         LIKE 'DEMO-%'
--   appointments.external_id  LIKE 'demo-seed-%'
--
-- Seguridad:
--   * Sólo acepta calendarios SIN google_calendar_id (el trigger
--     notify_appointment_change publica cada cita en appointments_sync_channel;
--     así no se empuja nada a Google Calendar).
--   * Emails @example.com (dominio reservado, nunca entrega).
--   * Todas las preferencias de comunicación de los pacientes demo quedan en
--     is_enabled = false para que recordatorios/alertas no les escriban.
--
-- Uso:  psql -v ON_ERROR_STOP=1 -f seed_demo_screenshots.sql
-- Ajustar la sección 0 (calendarios / semana) antes de correrlo.
-- =============================================================================

BEGIN;

SELECT setseed(0.42);  -- resultados reproducibles

-- -----------------------------------------------------------------------------
-- 0. Configuración
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE demo_cfg ON COMMIT DROP AS
SELECT
    -- Un calendario por doctor demo, en este orden. En DEV:
    -- 42 Consultorio Centro, 40 Consultorio MVD 3, 35 Carrasco (sede 1, sin Google).
    ARRAY[42, 40, 35]::bigint[]                                         AS calendar_ids,
    -- Lunes de la semana actual (hora de Uruguay). Cambiar por una fecha fija
    -- (p.ej. DATE '2026-10-19') para sembrar otra semana.
    date_trunc('week', now() AT TIME ZONE 'America/Montevideo')::date   AS week_start,
    (now() AT TIME ZONE 'America/Montevideo')::timestamp                AS now_local;

DO $$
DECLARE
    v_cal_ids bigint[];
    v_bad     text;
BEGIN
    SELECT calendar_ids INTO v_cal_ids FROM demo_cfg;

    IF array_length(v_cal_ids, 1) IS DISTINCT FROM 3 THEN
        RAISE EXCEPTION 'demo_cfg.calendar_ids debe tener exactamente 3 calendarios (uno por doctor demo)';
    END IF;

    SELECT string_agg(x::text, ', ') INTO v_bad
    FROM unnest(v_cal_ids) AS x
    WHERE NOT EXISTS (
        SELECT 1 FROM calendar_sources cs
        WHERE cs.id = x AND cs.is_active AND cs.google_calendar_id IS NULL
    );
    IF v_bad IS NOT NULL THEN
        RAISE EXCEPTION 'Calendarios inexistentes, inactivos o enlazados a Google: %', v_bad;
    END IF;

    IF EXISTS (SELECT 1 FROM users WHERE internal_id LIKE 'DEMO-%')
       OR EXISTS (SELECT 1 FROM appointments WHERE external_id LIKE 'demo-seed-%') THEN
        RAISE EXCEPTION 'Ya existen datos DEMO. Ejecutar cleanup_demo_screenshots.sql primero.';
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1. Doctores demo (rol medico = 2), uno por calendario
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE demo_doctors (ord int PRIMARY KEY, id uuid, name text) ON COMMIT DROP;

WITH src (ord, name, email, sex, color) AS (
    VALUES
        (1, 'Dra. Lucía Fernández', 'lucia.fernandez@example.com',  'female', '#0EA5E9'),
        (2, 'Dr. Martín Rodríguez', 'martin.rodriguez@example.com', 'male',   '#10B981'),
        (3, 'Dra. Valentina Sosa',  'valentina.sosa@example.com',   'female', '#F59E0B')
),
ins AS (
    INSERT INTO users (name, email, internal_id, sex, color, notes)
    SELECT name, email, 'DEMO-DOC-' || lpad(ord::text, 2, '0'), sex::sex_type, color,
           'Usuario demo para capturas'
    FROM src
    RETURNING id, internal_id, name
)
INSERT INTO demo_doctors (ord, id, name)
SELECT right(internal_id, 2)::int, id, name FROM ins;

INSERT INTO user_roles (user_id, role_id)
SELECT id, 2 FROM demo_doctors;

INSERT INTO calendar_users (calendar_source_id, user_id)
SELECT c.calendar_ids[d.ord], d.id
FROM demo_doctors d CROSS JOIN demo_cfg c;

-- -----------------------------------------------------------------------------
-- 2. Pacientes demo (rol paciente = 1)
--    Cédula UY: 7 dígitos base + dígito verificador calculado (pesos 2987634).
--    Los dos últimos son menores a cargo (is_dependant) de los pacientes 1 y 2.
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE demo_patients (ord int PRIMARY KEY, id uuid, name text) ON COMMIT DROP;

CREATE TEMP TABLE demo_patient_src ON COMMIT DROP AS
SELECT *
FROM (VALUES
    ( 1, 'María José González',  'female', DATE '1985-03-12', '4512378', '+59899412355', 'maria.gonzalez@example.com',    'Av. 18 de Julio 1234, Montevideo', NULL::int),
    ( 2, 'Juan Pablo Rodríguez', 'male',   DATE '1978-07-25', '3987124', '+59898567231', 'juanpablo.rodriguez@example.com','Bv. Artigas 876, Montevideo',     NULL),
    ( 3, 'Ana Laura Martínez',   'female', DATE '1992-11-03', '4870261', '+59894123876', 'analaura.martinez@example.com', 'Rambla República de México 5520',  NULL),
    ( 4, 'Diego Fernández',      'male',   DATE '1988-01-19', '4321657', '+59899765432', 'diego.fernandez@example.com',   'Av. Italia 3021, Montevideo',     NULL),
    ( 5, 'Sofía Pereira',        'female', DATE '1995-06-30', '5034982', '+59891234098', 'sofia.pereira@example.com',     'Canelones 1450, Montevideo',      NULL),
    ( 6, 'Martín López',         'male',   DATE '1970-09-14', '2765310', '+59899870123', 'martin.lopez@example.com',      'Av. Brasil 2788, Montevideo',     NULL),
    ( 7, 'Carolina Silva',       'female', DATE '1983-12-02', '4129876', '+59898340987', 'carolina.silva@example.com',    'Colonia 1820, Montevideo',        NULL),
    ( 8, 'Federico Sosa',        'male',   DATE '1990-04-08', '4698213', '+59894567120', 'federico.sosa@example.com',     'Luis A. de Herrera 1290',         NULL),
    ( 9, 'Valeria Díaz',         'female', DATE '1999-02-21', '5287604', '+59899102938', 'valeria.diaz@example.com',      'Av. Rivera 4410, Montevideo',     NULL),
    (10, 'Gonzalo Álvarez',      'male',   DATE '1965-10-11', '1987345', '+59898776655', 'gonzalo.alvarez@example.com',   'Av. Arocena 1580, Carrasco',      NULL),
    (11, 'Lucía Romero',         'female', DATE '1987-08-16', '4405718', '+59891556677', 'lucia.romero@example.com',      'Agraciada 2310, Montevideo',      NULL),
    (12, 'Andrés Suárez',        'male',   DATE '1993-05-27', '4956302', '+59899334411', 'andres.suarez@example.com',     'Mercedes 1105, Montevideo',       NULL),
    (13, 'Camila Torres',        'female', DATE '2001-01-09', '5412097', '+59894887766', 'camila.torres@example.com',     'Av. Millán 3650, Montevideo',     NULL),
    (14, 'Nicolás Ramírez',      'male',   DATE '1981-03-03', '3845629', '+59898221133', 'nicolas.ramirez@example.com',   'Gral. Flores 2450, Montevideo',   NULL),
    (15, 'Florencia Acosta',     'female', DATE '1976-11-29', '3209754', '+59899660022', 'florencia.acosta@example.com',  'Av. Agraciada 1600, Montevideo',  NULL),
    (16, 'Sebastián Benítez',    'male',   DATE '1997-07-07', '5123846', '+59891778899', 'sebastian.benitez@example.com', 'Bulevar España 2210, Montevideo', NULL),
    (17, 'Paula Medina',         'female', DATE '1989-09-18', '4587031', '+59894445566', 'paula.medina@example.com',      'Ellauri 870, Pocitos',            NULL),
    (18, 'Rodrigo Castro',       'male',   DATE '1974-12-24', '3076518', '+59899112244', 'rodrigo.castro@example.com',    'Av. Garibaldi 2133, Montevideo',  NULL),
    (19, 'Agustina Núñez',       'female', DATE '2003-04-15', '5639471', '+59898990011', 'agustina.nunez@example.com',    'Dr. Pablo de María 1540',         NULL),
    (20, 'Joaquín Cabrera',      'male',   DATE '1986-06-06', '4268953', '+59891003344', 'joaquin.cabrera@example.com',   'Av. Uruguay 1780, Montevideo',    NULL),
    (21, 'Natalia Viera',        'female', DATE '1991-10-22', '4789160', '+59894665588', 'natalia.viera@example.com',     'Juan Paullier 1245, Montevideo',  NULL),
    (22, 'Pablo Olivera',        'male',   DATE '1968-02-14', '2390847', '+59899557799', 'pablo.olivera@example.com',     'Av. Larrañaga 3320, Montevideo',  NULL),
    (23, 'Mateo González',       'male',   DATE '2015-05-10', '6123457', NULL,           NULL,                            'Av. 18 de Julio 1234, Montevideo', 1),
    (24, 'Emilia Rodríguez',     'female', DATE '2017-09-02', '6309718', NULL,           NULL,                            'Bv. Artigas 876, Montevideo',     2)
) AS t (ord, name, sex, birthday, ci_base, phone, email, address, responsible_ord);

-- Adultos primero (los menores necesitan el id del responsable).
WITH ins AS (
    INSERT INTO users (name, email, phone_number, internal_id, identity_document, identity_document_type,
                       sex, birthday, address, notes)
    SELECT s.name, s.email, s.phone,
           'DEMO-PAC-' || lpad(s.ord::text, 2, '0'),
           s.ci_base || ((10 - ((substr(s.ci_base,1,1)::int*2 + substr(s.ci_base,2,1)::int*9
                               + substr(s.ci_base,3,1)::int*8 + substr(s.ci_base,4,1)::int*7
                               + substr(s.ci_base,5,1)::int*6 + substr(s.ci_base,6,1)::int*3
                               + substr(s.ci_base,7,1)::int*4) % 10)) % 10)::text,
           'cedula_uy', s.sex::sex_type, s.birthday, s.address, ''
    FROM demo_patient_src s
    WHERE s.responsible_ord IS NULL
    RETURNING id, internal_id, name
)
INSERT INTO demo_patients (ord, id, name)
SELECT right(internal_id, 2)::int, id, name FROM ins;

WITH ins AS (
    INSERT INTO users (name, internal_id, identity_document, identity_document_type, sex, birthday,
                       address, notes, is_dependant, responsible_contact_id)
    SELECT s.name,
           'DEMO-PAC-' || lpad(s.ord::text, 2, '0'),
           s.ci_base || ((10 - ((substr(s.ci_base,1,1)::int*2 + substr(s.ci_base,2,1)::int*9
                               + substr(s.ci_base,3,1)::int*8 + substr(s.ci_base,4,1)::int*7
                               + substr(s.ci_base,5,1)::int*6 + substr(s.ci_base,6,1)::int*3
                               + substr(s.ci_base,7,1)::int*4) % 10)) % 10)::text,
           'cedula_uy', s.sex::sex_type, s.birthday, s.address, '', true, r.id
    FROM demo_patient_src s
    JOIN demo_patients r ON r.ord = s.responsible_ord
    WHERE s.responsible_ord IS NOT NULL
    RETURNING id, internal_id, name
)
INSERT INTO demo_patients (ord, id, name)
SELECT right(internal_id, 2)::int, id, name FROM ins;

INSERT INTO user_roles (user_id, role_id)
SELECT id, 1 FROM demo_patients;

-- Silenciar todas las comunicaciones (recordatorios, marketing, etc.)
INSERT INTO user_communication_preferences (user_id, category_slug, channel_slug, is_enabled)
SELECT p.id, nc.slug, np.platform_name, false
FROM demo_patients p
CROSS JOIN notification_categories nc
CROSS JOIN notification_platforms np
ON CONFLICT (user_id, channel_slug, category_slug) DO UPDATE SET is_enabled = false;

-- -----------------------------------------------------------------------------
-- 3. Citas: lunes a viernes 09:00–13:00 / 14:00–19:00, sábado 09:00–13:00.
--    Estado según la hora actual: pasadas → completed / no_show / cancelled /
--    attended_late; en curso → in_progress; próximas 45 min → arrived;
--    futuras → confirmed / scheduled / pending.
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE demo_services ON COMMIT DROP AS
SELECT DISTINCT ON (sc.name) sc.id, sc.name, sc.duration_minutes AS dur, w.weight
FROM (VALUES
    ('Consulta General', 4),
    ('Limpieza dental', 4),
    ('Revisión ortodoncia mensual', 3),
    ('Obturación (empaste)', 3),
    ('Blanqueamiento dental', 2),
    ('Extracción dental', 2),
    ('Selladores dentales', 1),
    ('Tratamiento de conducto (endodoncia)', 2),
    ('Ortodoncia - Colocación de brackets', 1)
) AS w (name, weight)
JOIN service_catalog sc ON sc.name = w.name AND sc.is_active AND sc.duration_minutes > 0
ORDER BY sc.name, sc.id;

DO $$
DECLARE
    cfg         demo_cfg%ROWTYPE;
    v_svc_pool  int[];      -- ids repetidos según peso
    v_svc_id    int;
    v_patients  uuid[];
    v_pnames    text[];
    v_pidx      int := 0;
    v_seq       int := 0;
    v_day       date;
    v_dow       int;
    v_cal       int;
    v_doc       demo_doctors%ROWTYPE;
    v_t         timestamp;
    v_lunch_s   timestamp;
    v_lunch_e   timestamp;
    v_day_end   timestamp;
    v_svc1      demo_services%ROWTYPE;
    v_svc2      demo_services%ROWTYPE;
    v_has2      boolean;
    v_dur       int;
    v_end       timestamp;
    v_status    text;
    v_reason    text;
    v_r         float8;
    v_pid       uuid;
    v_pname     text;
    v_summary   text;
    v_appt_id   int;
BEGIN
    SELECT * INTO cfg FROM demo_cfg;

    SELECT array_agg(s.id ORDER BY s.id, g) INTO v_svc_pool
    FROM demo_services s, generate_series(1, s.weight) g;
    IF v_svc_pool IS NULL THEN
        RAISE EXCEPTION 'No se encontró ningún servicio de la lista en service_catalog';
    END IF;

    -- Pacientes en orden aleatorio; se recorren en ciclo para que todos tengan citas.
    SELECT array_agg(id ORDER BY rnd), array_agg(name ORDER BY rnd)
      INTO v_patients, v_pnames
    FROM (SELECT id, name, random() AS rnd FROM demo_patients) p;

    FOR d IN 0..5 LOOP
        v_day := cfg.week_start + d;
        v_dow := extract(isodow FROM v_day);
        v_lunch_s := v_day + time '13:00';
        v_lunch_e := v_day + time '14:00';
        v_day_end := CASE WHEN v_dow = 6 THEN v_day + time '13:00' ELSE v_day + time '19:00' END;

        FOR v_cal IN 1..3 LOOP
            SELECT * INTO v_doc FROM demo_doctors WHERE ord = v_cal;
            v_t := v_day + time '09:00' + (floor(random() * 3) * interval '15 minutes');

            LOOP
                -- Huecos libres ocasionales para que la agenda no se vea saturada.
                IF random() < 0.18 THEN
                    v_t := v_t + (CASE WHEN random() < 0.5 THEN 30 ELSE 60 END) * interval '1 minute';
                END IF;

                -- El índice se sortea fuera del WHERE: random() ahí se reevalúa por fila.
                v_svc_id := v_svc_pool[1 + floor(random() * array_length(v_svc_pool, 1))::int];
                SELECT * INTO v_svc1 FROM demo_services WHERE id = v_svc_id;
                v_has2 := random() < 0.15;
                IF v_has2 THEN
                    v_svc_id := v_svc_pool[1 + floor(random() * array_length(v_svc_pool, 1))::int];
                    SELECT * INTO v_svc2 FROM demo_services WHERE id = v_svc_id AND id <> v_svc1.id;
                    v_has2 := FOUND;
                END IF;
                v_dur := v_svc1.dur + CASE WHEN v_has2 THEN v_svc2.dur ELSE 0 END;
                v_end := v_t + v_dur * interval '1 minute';

                -- Saltar el almuerzo (lun–vie).
                IF v_dow < 6 AND v_t < v_lunch_e AND v_end > v_lunch_s THEN
                    v_t := v_lunch_e;
                    v_end := v_t + v_dur * interval '1 minute';
                END IF;
                EXIT WHEN v_end > v_day_end;

                -- Estado según el momento actual.
                v_r := random();
                v_reason := NULL;
                IF v_end <= cfg.now_local THEN
                    v_status := CASE WHEN v_r < 0.78 THEN 'completed'
                                     WHEN v_r < 0.85 THEN 'attended_late'
                                     WHEN v_r < 0.93 THEN 'no_show'
                                     ELSE 'cancelled' END;
                ELSIF v_t <= cfg.now_local THEN
                    v_status := 'in_progress';
                ELSIF v_t <= cfg.now_local + interval '45 minutes' THEN
                    v_status := 'arrived';
                ELSE
                    v_status := CASE WHEN v_r < 0.50 THEN 'confirmed'
                                     WHEN v_r < 0.92 THEN 'scheduled'
                                     WHEN v_r < 0.97 THEN 'pending'
                                     ELSE 'cancelled' END;
                END IF;
                IF v_status = 'cancelled' THEN
                    v_reason := CASE WHEN random() < 0.6 THEN 'in_time' ELSE 'patient_request' END;
                END IF;

                v_pidx  := v_pidx % array_length(v_patients, 1) + 1;
                v_pid   := v_patients[v_pidx];
                v_pname := v_pnames[v_pidx];
                v_seq   := v_seq + 1;
                v_summary := v_pname || ' - ' || v_svc1.name
                             || CASE WHEN v_has2 THEN ', ' || v_svc2.name ELSE '' END;

                INSERT INTO appointments (patient_id, assignee_id, calendar_source_id, start_datetime,
                                          end_datetime, status, summary, description,
                                          cancellation_reason, external_id)
                VALUES (v_pid, v_doc.id, cfg.calendar_ids[v_cal], v_t, v_end, v_status, v_summary,
                        'Cita para: ' || v_pname || E'\n\nDoctor: ' || v_doc.name
                          || E'\n\nServicios:\n' || v_svc1.name
                          || CASE WHEN v_has2 THEN E'\n' || v_svc2.name ELSE '' END,
                        v_reason, 'demo-seed-' || lpad(v_seq::text, 4, '0'))
                RETURNING id INTO v_appt_id;

                INSERT INTO appointment_service_catalog (appointment_id, service_id)
                VALUES (v_appt_id, v_svc1.id);
                IF v_has2 THEN
                    INSERT INTO appointment_service_catalog (appointment_id, service_id)
                    VALUES (v_appt_id, v_svc2.id);
                END IF;

                -- Siguiente turno alineado a 10 minutos.
                v_t := v_day + (ceil(extract(epoch FROM (v_end - v_day)) / 600.0) * interval '10 minutes');
            END LOOP;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Seed demo: % citas creadas para la semana del %', v_seq, cfg.week_start;
END $$;

-- -----------------------------------------------------------------------------
-- 4. Resumen
-- -----------------------------------------------------------------------------
SELECT a.start_datetime::date AS dia, cs.name AS calendario, a.status, count(*) AS citas
FROM appointments a
JOIN calendar_sources cs ON cs.id = a.calendar_source_id
WHERE a.external_id LIKE 'demo-seed-%'
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;

COMMIT;
