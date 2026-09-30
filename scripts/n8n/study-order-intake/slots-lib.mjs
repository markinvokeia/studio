/**
 * slots-lib.mjs
 * ---------------------------------------------------------------------------
 * Huecos libres para agendar una orden de estudio por WhatsApp (Fase 4 de
 * docs/whatsapp-ordenes-estudio-plan.md).
 *
 * POR QUÉ NO SE USA `Agent_Availability2`
 *   Ese subflujo arma los huecos a partir de la disponibilidad de los DOCTORES
 *   (availability_rules / ids_disponibles) y descarta a quien ya es assignee de
 *   una cita solapada. En una orden de estudio no hay doctor que atienda: la
 *   cita es de un calendario (equipo/consultorio) de una sede. Acá el hueco es:
 *     horario de atención de la SEDE (clinic_schedules)  ∩  calendario sin
 *     citas solapadas, por la DURACIÓN TOTAL de los estudios.
 *
 * TODO en "hora de pared" de la clínica (America/Montevideo), como texto
 * 'AAAA-MM-DDTHH:mm:ss' sin zona: es la convención de appointments
 * (timestamp sin zona) y evita cualquier conversión de zona horaria. Quien
 * llama pasa `now` ya en hora local (now() AT TIME ZONE 'America/Montevideo').
 *
 * Sin imports: el generador lo incrusta en un nodo Code de n8n (igual que
 * intake-lib.mjs).
 * ---------------------------------------------------------------------------
 */

const pad = (n) => String(n).padStart(2, '0');

/** 'AAAA-MM-DDTHH:mm[:ss]' → minutos absolutos desde 1970 (hora de pared, sin zona). */
function toMinutes(local) {
    const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(local));
    if (!m) return NaN;
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])) / 60000;
}

function fromMinutes(min) {
    const d = new Date(min * 60000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`;
}

const timeToMin = (t) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(t));
    return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};

/** Une ventanas solapadas o repetidas del mismo día: [[540,780],[540,780],[900,1140]] → [[540,780],[900,1140]]. */
export function mergeWindows(windows) {
    const sorted = windows.filter((w) => w[0] < w[1]).sort((a, b) => a[0] - b[0]);
    const out = [];
    for (const w of sorted) {
        const last = out[out.length - 1];
        if (last && w[0] <= last[1]) last[1] = Math.max(last[1], w[1]);
        else out.push([w[0], w[1]]);
    }
    return out;
}

/**
 * @param {object} p
 * @param {string} p.now              Ahora en hora local: 'AAAA-MM-DDTHH:mm:ss'.
 * @param {Array}  p.schedules        clinic_schedules de la sede: [{day_of_week (0=domingo), start_time, end_time}].
 * @param {Array}  p.calendars        calendarios activos elegibles de la sede: [{id}].
 * @param {Array}  p.appointments     citas no canceladas de esos calendarios: [{calendar_source_id, start, end}] (hora local).
 * @param {number} p.durationMinutes  Duración total de los estudios.
 * @param {number} [p.stepMinutes=30] Paso de la grilla de inicios.
 * @param {number} [p.leadHours=4]    Antelación mínima. NO bajar de 3: el validador de public-book compara la hora local
 *                                    contra el reloj del servidor de n8n (UTC) y rechazaría como "pasado" un hueco más cercano.
 * @param {number} [p.horizonDays=14] Hasta cuántos días hacia adelante se busca.
 * @param {string} [p.fromDate]       'AAAA-MM-DD': no buscar antes de este día.
 * @param {string} [p.toDate]         'AAAA-MM-DD': no buscar después de este día.
 * @returns {Array<{date:string,time:string,start:string,end:string,calendar_source_id:number}>} ordenados por inicio.
 */
export function computeSlots(p) {
    const duration = Number(p.durationMinutes);
    if (!Number.isFinite(duration) || duration <= 0) return [];
    const step = Number(p.stepMinutes) > 0 ? Number(p.stepMinutes) : 30;
    const lead = (Number.isFinite(Number(p.leadHours)) ? Number(p.leadHours) : 4) * 60;
    const horizon = Number.isFinite(Number(p.horizonDays)) ? Number(p.horizonDays) : 14;

    const nowMin = toMinutes(p.now);
    if (!Number.isFinite(nowMin)) return [];
    const earliest = nowMin + lead;
    const dayStart0 = Math.floor(nowMin / 1440) * 1440;
    const fromMin = p.fromDate ? toMinutes(`${p.fromDate}T00:00`) : dayStart0;
    const toMin = p.toDate ? toMinutes(`${p.toDate}T00:00`) + 1440 : dayStart0 + (horizon + 1) * 1440;

    const calendars = (p.calendars || []).map((c) => Number(c.id)).filter(Number.isFinite).sort((a, b) => a - b);
    if (calendars.length === 0) return [];

    // Ocupación por calendario, en minutos.
    const busy = new Map(calendars.map((id) => [id, []]));
    for (const a of p.appointments || []) {
        const id = Number(a.calendar_source_id);
        if (!busy.has(id)) continue;
        const s = toMinutes(a.start);
        const e = toMinutes(a.end);
        if (Number.isFinite(s) && Number.isFinite(e) && e > s) busy.get(id).push([s, e]);
    }

    const byDow = new Map();
    for (const row of p.schedules || []) {
        const dow = Number(row.day_of_week);
        const w = [timeToMin(row.start_time), timeToMin(row.end_time)];
        if (!Number.isFinite(dow) || !Number.isFinite(w[0]) || !Number.isFinite(w[1])) continue;
        byDow.set(dow, [...(byDow.get(dow) || []), w]);
    }
    for (const [dow, ws] of byDow) byDow.set(dow, mergeWindows(ws));

    const slots = [];
    for (let day = Math.max(dayStart0, Math.floor(fromMin / 1440) * 1440); day < Math.min(toMin, dayStart0 + (horizon + 1) * 1440); day += 1440) {
        const dow = new Date(day * 60000).getUTCDay();
        for (const [ws, we] of byDow.get(dow) || []) {
            for (let start = day + ws; start + duration <= day + we; start += step) {
                if (start < earliest) continue;
                const end = start + duration;
                const free = calendars.find((id) => !busy.get(id).some(([bs, be]) => bs < end && be > start));
                if (free === undefined) continue;
                const startTxt = fromMinutes(start);
                slots.push({
                    date: startTxt.slice(0, 10),
                    time: startTxt.slice(11, 16),
                    start: startTxt,
                    end: fromMinutes(end),
                    calendar_source_id: free,
                });
            }
        }
    }
    return slots.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}

/**
 * Elige pocas opciones para ofrecerle al usuario (no 40 horarios por WhatsApp).
 *  - con fecha y hora deseadas: los más cercanos a esa hora ese día, o los del día más próximo si no hay;
 *  - con fecha: hasta `limit` repartidos a lo largo del día;
 *  - sin nada: los primeros horarios de los próximos días (máximo 2 por día).
 */
export function pickSlots(slots, { desiredDate = null, desiredTime = null, limit = 6 } = {}) {
    if (slots.length === 0) return [];
    const spread = (list, n) => {
        if (list.length <= n) return list;
        const out = [];
        for (let i = 0; i < n; i++) out.push(list[Math.round((i * (list.length - 1)) / (n - 1))]);
        return [...new Set(out)];
    };

    if (desiredDate) {
        const day = slots.filter((s) => s.date === desiredDate);
        if (day.length > 0) {
            if (desiredTime) {
                const want = timeToMin(desiredTime);
                const nearest = [...day].sort((a, b) => Math.abs(timeToMin(a.time) - want) - Math.abs(timeToMin(b.time) - want)).slice(0, limit);
                return nearest.sort((a, b) => (a.start < b.start ? -1 : 1));
            }
            return spread(day, limit);
        }
        // Ese día no hay lugar: se ofrece lo más próximo.
        const after = slots.filter((s) => s.date > desiredDate);
        return pickSlots(after.length ? after : slots, { limit });
    }

    const perDay = new Map();
    const out = [];
    for (const s of slots) {
        const n = perDay.get(s.date) || 0;
        if (n >= 2) continue;
        perDay.set(s.date, n + 1);
        out.push(s);
        if (out.length >= limit) break;
    }
    return out;
}
