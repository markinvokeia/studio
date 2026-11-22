import { normalizeSpeech } from '@/lib/voice/parse';

/**
 * Lo que va en una caja de búsqueda cuando se pide filtrar o buscar: la palabra clave, no la
 * frase. «filtrá los pacientes que se llaman Carolina» → «Carolina»; «buscá la factura número
 * 123» → «123»; «search for providers named Acme» → «Acme». Se devuelve con las mayúsculas y
 * tildes con que se dijo (la búsqueda del backend las respeta).
 */

/** Lo que se dice antes de la palabra clave y no se busca (en orden: se repite hasta que no cambie). */
const LEAD = [
  // Artículos y preposiciones sueltos.
  /^(?:a|al|el|la|los|las|lo|un|una|unos|unas|por|para|en|de|del|the|a|an|for|by|on|in|of|to)\s+/,
  // «en la lista», «en la tabla», «in the list».
  /^(?:en (?:la |el )?(?:lista|tabla|listado|grilla)|in the (?:list|table|grid))\s+/,
  // Lo que se busca (el sustantivo de la pantalla) y su conector.
  /^(?:pacientes?|clientes?|registros?|filas?|facturas?|presupuestos?|pagos?|cobros?|recibos?|proveedores?|productos?|articulos?|servicios?|usuarios?|doctor(?:es|as?)?|medicos?|odontologos?|profesionales?|sedes?|clinicas?|ordenes?|orden|citas?|turnos?|cajas?|movimientos?|alertas?|plantillas?|reglas?|categorias?|grupos?|monedas?|feriados?|calendarios?|etapas?|laboratorios?|roles?|permisos?|personal|empleados?|items?|elementos?|cosas?|resultados?|medicamentos?|listas?|listados?|tablas?|insumos?|materiales?|tratamientos?|especialidades?|mutualistas?|aseguradoras?|sociedades?|medications?|drugs?|supplies|treatments?|patients?|clients?|records?|rows?|invoices?|quotes?|payments?|receipts?|providers?|suppliers?|products?|items?|services?|users?|doctors?|clinics?|branch(?:es)?|orders?|appointments?|templates?|rules?|categories|category|groups?|currenc(?:y|ies)|holidays?|calendars?|stages?|labs?|staff|entries|entry|results?|things?|ones?)\s+/,
  // «que se llama(n)», «llamado», «con (el) nombre (de)», «cuyo nombre es», «named», «called»…
  /^(?:que se llam\w+|que se apellid\w+|llamad[oa]s?|de nombre|con (?:el )?nombre(?: de)?|con (?:el )?apellido(?: de)?|cuyo nombre (?:es|sea)|cuyo apellido (?:es|sea)|named|called|whose name is|with (?:the )?name|by the name(?: of)?)\s+/,
  // «que tenga(n)», «que contenga(n)», «que diga(n)», «con», «containing», «with», «that (contain|have)».
  /^(?:que (?:tenga|tengan|tiene|tienen|contenga|contengan|contiene|contienen|diga|digan|dice|dicen|incluya|incluyan|sea|sean|es|son|empiece|empiecen|empieza|empiezan|arranque|arranquen)(?: con| por)?|con|cuyo|cuya|containing|contains?|with|that (?:contains?|has|have|starts? with|begins? with)|starting with|beginning with|like)\s+/,
  // Un identificador nombrado: «(el) número», «(el) id», «código», «cédula», «documento», «teléfono», «email».
  /^(?:(?:el |la |the )?(?:numero|nro|num|n|id|codigo|code|cedula|ci|documento|dni|rut|ruc|nif|cuit|telefono|celular|movil|mail|email|correo|number|phone|document|ref|referencia|reference)(?: de| del| es| igual a| is)?)\s+/,
];

/** Lo que se dice después y no se busca. */
const TRAIL = /\s+(?:por favor|please|en la (?:lista|tabla)|in the (?:list|table)|nada mas|solamente|solo|only)$/;

/** Verbos de buscar/filtrar al comienzo (si llegan con la frase entera). */
const VERB = /^(?:(?:busca\w*|buscar|filtra\w*|filtrar|encontra\w*|encuentra\w*|mostra\w*|muestra\w*|search(?: for)?|find|filter(?: by)?|look (?:for|up)|show(?: me)?)\s+)/;

/** La palabra clave (normalizada) de lo que se pide buscar. */
export function searchKeyword(normalized: string): string {
  let t = normalizeSpeech(normalized).replace(VERB, '');
  for (let guard = 0; guard < 12; guard++) {
    const before = t;
    for (const re of LEAD) {
      const next = t.replace(re, '');
      // Nunca se deja vacío: si lo que queda es solo el sustantivo, se busca eso.
      if (next && next !== t) { t = next; break; }
    }
    t = t.replace(TRAIL, '');
    if (t === before) break;
  }
  return t.trim();
}

/** Lo mismo, con las mayúsculas y tildes de lo dicho. */
export function searchTerm(normalized: string, raw: string): string {
  const key = searchKeyword(normalized);
  if (!key) return raw.trim();
  const tokens = raw.trim().split(/\s+/);
  // El tramo de lo dicho que normalizado es la palabra clave («MED-9» → «med 9»), el último que aparezca.
  for (let len = 1; len <= tokens.length; len++) {
    for (let i = tokens.length - len; i >= 0; i--) {
      const piece = tokens.slice(i, i + len).join(' ').replace(/[.,;:!?¿¡«»"']+$/g, '').replace(/^[«"'¿¡]+/, '');
      if (normalizeSpeech(piece) === key) return piece;
    }
  }
  return key;
}
