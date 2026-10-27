#!/usr/bin/env node
/**
 * Mapa del producto (Fase 1 del plan de onboarding guiado).
 *
 * Extrae del código todo lo que se puede extraer — menú, rutas, permisos,
 * campos de formulario, tabs, botones con help id — y lo une con las fichas
 * redactadas en knowledge/ (screens, use-cases, onboarding). Escribe
 * src/generated/help-catalog.json, que consume el asistente del frontend y que
 * el frontend publica en la BD de cada cliente (POST /help/catalog/sync).
 *
 *   node scripts/knowledge/build-catalog.mjs           escribe el catálogo
 *   node scripts/knowledge/build-catalog.mjs --check   falla si está desactualizado
 *                                                      o si una guía apunta a algo
 *                                                      que ya no existe
 *   --strict                                           además falla con pantallas del
 *                                                      menú sin ficha redactada
 *
 * Las reglas de help ids replican src/lib/help/help-id.ts: si cambian allá,
 * cambian acá.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = join(ROOT, 'src');
const APP_DIR = join(SRC, 'app', '[locale]');
const KNOWLEDGE = join(ROOT, 'knowledge');
const OUTPUT = join(SRC, 'generated', 'help-catalog.json');

const args = new Set(process.argv.slice(2));
const CHECK = args.has('--check');
const STRICT = args.has('--strict');

/** Pantallas fuera del dashboard del staff: no entran al catálogo del asistente. */
const EXCLUDED_ROUTES = new Set(['/login', '/patient-login', '/reset-password', '/set-first-password', '/my-profile', '/tv-display/screen']);
const STEP_ACTIONS = new Set(['navigate', 'click', 'highlight', 'fill', 'confirm', 'wait']);
const KINDS = ['field', 'btn', 'tab', 'filter', 'nav', 'section'];

const errors = [];
const warnings = [];

// ─── help ids (espejo de src/lib/help/help-id.ts) ────────────────────────────

const DYNAMIC_SEGMENT = /^(\[.+\]|\d+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

function routeToHelpScope(route) {
  const segments = route.split('?')[0].split('/').filter(Boolean).filter((s) => !DYNAMIC_SEGMENT.test(s));
  return segments.length ? segments.join('.') : 'dashboard';
}

function normalizeHelpName(name) {
  return name.split('.').filter((s) => !/^\d+$/.test(s)).join('.').replace(/[^a-zA-Z0-9_.-]/g, '-');
}

const composeHelpId = (scope, kind, name) => `${scope}.${kind}.${normalizeHelpName(name)}`;

function kindOfId(id) {
  if (id.startsWith('nav.')) return 'nav';
  return id.split('.').find((p) => KINDS.includes(p)) ?? 'section';
}

// ─── utilidades ──────────────────────────────────────────────────────────────

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const rel = (file) => relative(ROOT, file).split('\\').join('/');

function walk(dir, predicate, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, predicate, out);
    else if (predicate(full)) out.push(full);
  }
  return out;
}

function getPath(obj, path) {
  return path.split('.').reduce((acc, k) => (acc && typeof acc === 'object' ? acc[k] : undefined), obj);
}

function parse(file) {
  return ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}

function visit(node, fn) {
  fn(node);
  ts.forEachChild(node, (child) => visit(child, fn));
}

/** Orden estable de claves para que el hash y el diff no dependan del orden de lectura. */
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().filter((k) => value[k] !== undefined).map((k) => [k, stable(value[k])]));
  }
  return value;
}

const messagesEs = readJson(join(SRC, 'messages', 'es.json'));

// ─── permisos ────────────────────────────────────────────────────────────────

function extractPermissions() {
  const file = join(SRC, 'constants', 'permissions.ts');
  const sf = parse(file);
  const byConstant = new Map();
  const list = [];
  visit(sf, (node) => {
    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || !node.initializer) return;
    let init = node.initializer;
    if (ts.isAsExpression(init)) init = init.expression;
    if (!ts.isObjectLiteralExpression(init)) return;
    const group = node.name.text;
    for (const prop of init.properties) {
      if (!ts.isPropertyAssignment(prop) || !ts.isStringLiteral(prop.initializer)) continue;
      const key = prop.name.getText(sf);
      const code = prop.initializer.text;
      const doc = ts.getLeadingCommentRanges(sf.text, prop.getFullStart())
        ?.map((r) => sf.text.slice(r.pos, r.end).replace(/^\/\*\*?|\*\/$/g, '').replace(/^\s*\*\s?/gm, '').replace(/^\s*\/\/\s?/gm, '').trim())
        .join(' ')
        .replace(/\s+/g, ' ');
      byConstant.set(`${group}.${key}`, code);
      list.push({ code, constant: `${group}.${key}`, description: doc || undefined });
    }
  });
  const seen = new Set();
  return { byConstant, list: list.filter((p) => (seen.has(p.code) ? false : seen.add(p.code))) };
}

// ─── menú ────────────────────────────────────────────────────────────────────

function extractNav(permissionsByConstant) {
  const sf = parse(join(SRC, 'config', 'nav.ts'));
  const items = [];
  const permOf = (expr) => {
    if (!expr) return [];
    if (ts.isStringLiteral(expr)) return [expr.text];
    if (ts.isPropertyAccessExpression(expr)) return [permissionsByConstant.get(expr.getText(sf)) ?? expr.getText(sf)];
    if (ts.isArrayLiteralExpression(expr)) return expr.elements.flatMap(permOf);
    return [];
  };
  const readItem = (obj, parent) => {
    const props = Object.fromEntries(obj.properties.filter(ts.isPropertyAssignment).map((p) => [p.name.getText(sf), p.initializer]));
    if (props.isSeparator && props.isSeparator.kind === ts.SyntaxKind.TrueKeyword) return;
    const title = props.title && ts.isStringLiteral(props.title) ? props.title.text : '';
    const href = props.href && ts.isStringLiteral(props.href) ? props.href.text : '';
    const children = props.items && ts.isArrayLiteralExpression(props.items) ? props.items.elements.filter(ts.isObjectLiteralExpression) : [];
    const permissions = [...permOf(props.requiredPermission), ...permOf(props.requiredPermissions), ...permOf(props.requiredAnyPermission)];
    const label = getPath(messagesEs, `Navigation.${title}`) ?? title;
    if (children.length) {
      items.push({ id: `nav.group.${title}`, title, label, href: '', permissions, group: true, parent });
      for (const child of children) readItem(child, title);
    } else if (href) {
      items.push({ id: `nav.${routeToHelpScope(href)}`, title, label, href, permissions, group: false, parent });
    }
  };
  visit(sf, (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(sf) === 'navItems' && node.initializer && ts.isArrayLiteralExpression(node.initializer)) {
      for (const el of node.initializer.elements) if (ts.isObjectLiteralExpression(el)) readItem(el, undefined);
    }
  });
  return items;
}

// ─── pantallas y elementos ───────────────────────────────────────────────────

function resolveImport(fromFile, spec) {
  let base;
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec);
  else return null;
  for (const candidate of [base, `${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Imports locales de una página que vale la pena recorrer (formularios y paneles propios). */
function localImports(file, sf) {
  const out = [];
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    const spec = stmt.moduleSpecifier.text;
    if (!(spec.startsWith('.') || spec.startsWith('@/components/'))) continue;
    if (/@\/components\/(ui|help|icons)\//.test(spec)) continue;
    const target = resolveImport(file, spec);
    if (target && /\.tsx?$/.test(target)) out.push(target);
  }
  return out;
}

function translationNamespaces(sf) {
  const map = new Map();
  visit(sf, (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isCallExpression(node.initializer)) {
      const callee = node.initializer.expression.getText(sf);
      if (callee === 'useTranslations' || callee === 'getTranslations') {
        const arg = node.initializer.arguments[0];
        map.set(node.name.text, arg && ts.isStringLiteral(arg) ? arg.text : '');
      }
    }
  });
  return map;
}

function firstTranslation(node, sf, namespaces) {
  let found;
  visit(node, (n) => {
    if (found || !ts.isCallExpression(n) || !ts.isIdentifier(n.expression)) return;
    const ns = namespaces.get(n.expression.text);
    const arg = n.arguments[0];
    if (ns === undefined || !arg || !ts.isStringLiteralLike(arg)) return;
    const key = ns ? `${ns}.${arg.text}` : arg.text;
    const value = getPath(messagesEs, key);
    if (typeof value === 'string') found = value;
  });
  return found;
}

function jsxAttr(node, name) {
  const attrs = (ts.isJsxElement(node) ? node.openingElement : node).attributes;
  return attrs.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText() === name);
}

function attrString(attr) {
  if (!attr || !attr.initializer) return undefined;
  if (ts.isStringLiteral(attr.initializer)) return attr.initializer.text;
  if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression && ts.isStringLiteralLike(attr.initializer.expression)) {
    return attr.initializer.expression.text;
  }
  // `items.${index}.unit_price` (filas de useFieldArray): el índice se descarta igual que en la app → items.unit_price.
  if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression && ts.isTemplateExpression(attr.initializer.expression)) {
    const tpl = attr.initializer.expression;
    return tpl.head.text + tpl.templateSpans.map((span) => '0' + span.literal.text).join('');
  }
  return undefined;
}

function tagName(node) {
  return (ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName).getText();
}

const DEFAULT_LABELS = {
  'btn.new': getPath(messagesEs, 'DataTableToolbar.create'),
  'btn.refresh': getPath(messagesEs, 'DataTableToolbar.refresh'),
};

function extractElements(file, pageScope) {
  const sf = parse(file);
  const namespaces = translationNamespaces(sf);
  const source = rel(file);
  const elements = [];
  let scope = pageScope;
  const add = (kind, name, label) => elements.push({ id: composeHelpId(scope, kind, name), kind, label: label ?? DEFAULT_LABELS[`${kind}.${name}`], source });

  // Como `visit`, pero respeta <HelpScopeProvider scope="..."> escrito inline.
  const walkScoped = (node, fn) => {
    const isScopeProvider = (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) && tagName(node) === 'HelpScopeProvider';
    const nested = isScopeProvider ? attrString(jsxAttr(node, 'scope')) : undefined;
    const previous = scope;
    if (nested) scope = nested;
    fn(node);
    ts.forEachChild(node, (child) => walkScoped(child, fn));
    scope = previous;
  };

  walkScoped(sf, (node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = tagName(node);
      const explicit = attrString(jsxAttr(node, 'data-help-id'));
      if (explicit) elements.push({ id: explicit, kind: kindOfId(explicit), label: firstTranslation(node, sf, namespaces), source });

      if (tag === 'FormField') {
        const name = attrString(jsxAttr(node, 'name'));
        if (name) {
          let label;
          visit(node, (n) => {
            if (!label && (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) && tagName(n) === 'FormLabel') label = firstTranslation(n, sf, namespaces);
          });
          add('field', name, label);
        }
      } else if (tag === 'TabsTrigger') {
        const value = attrString(jsxAttr(node, 'value'));
        if (value) add('tab', value, firstTranslation(node, sf, namespaces));
      } else if (tag === 'DataTable' || tag === 'DataTableAdvancedToolbar') {
        // Las dos barras (estándar y avanzada) ponen los mismos ids.
        if (jsxAttr(node, 'onCreate')) add('btn', 'new');
        if (jsxAttr(node, 'onRefresh')) add('btn', 'refresh');
        const placeholder = jsxAttr(node, 'filterPlaceholder');
        if (jsxAttr(node, 'filterColumnId') || placeholder || jsxAttr(node, 'useGlobalFilter')) {
          add('filter', 'search', placeholder?.initializer ? firstTranslation(placeholder.initializer, sf, namespaces) : undefined);
        }
      } else if (tag === 'Button' && attrString(jsxAttr(node, 'type')) === 'submit') {
        add('btn', 'submit', firstTranslation(node, sf, namespaces));
      }
    }
    // Tabs de VerticalTabStrip: { id: 'info', icon: X, label: t('...') }
    if (ts.isObjectLiteralExpression(node)) {
      const props = Object.fromEntries(node.properties.filter(ts.isPropertyAssignment).map((p) => [p.name.getText(sf), p.initializer]));
      if (props.id && props.icon && props.label && ts.isStringLiteralLike(props.id)) {
        add('tab', props.id.text, firstTranslation(props.label, sf, namespaces));
      }
    }
  });
  return elements;
}

function extractScreens(navItems, permissions) {
  const pages = walk(APP_DIR, (f) => f.endsWith(`${'/'}page.tsx`) || f.endsWith('\\page.tsx'));
  const navByRoute = new Map(navItems.filter((n) => !n.group).map((n) => [n.href, n]));
  const screens = [];
  for (const page of pages) {
    const route = '/' + relative(APP_DIR, dirname(page)).split('\\').join('/');
    const normalized = route === '/.' || route === '/' ? '/' : route.replace(/\/$/, '');
    if (EXCLUDED_ROUTES.has(normalized)) continue;
    const scope = routeToHelpScope(normalized);
    const files = [page, ...localImports(page, parse(page))];
    const byId = new Map();
    for (const file of files) {
      for (const el of extractElements(file, scope)) {
        const prev = byId.get(el.id);
        if (!prev) byId.set(el.id, el);
        else if (!prev.label && el.label) byId.set(el.id, { ...prev, label: el.label });
      }
    }
    const nav = navByRoute.get(normalized);
    screens.push({
      id: scope,
      route: normalized,
      title: nav?.label ?? normalized,
      module: nav?.parent ? getPath(messagesEs, `Navigation.${nav.parent}`) ?? nav.parent : undefined,
      permissions: nav?.permissions ?? [],
      inMenu: Boolean(nav),
      status: 'auto',
      elements: [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)),
    });
  }
  void permissions;
  return screens.sort((a, b) => a.route.localeCompare(b.route));
}

// ─── fichas redactadas ───────────────────────────────────────────────────────

function loadDir(dir) {
  return walk(dir, (f) => f.endsWith('.json')).map((file) => ({ file: rel(file), data: readJson(file) }));
}

function mergeCuratedScreens(screens) {
  const byId = new Map(screens.map((s) => [s.id, s]));
  for (const { file, data } of loadDir(join(KNOWLEDGE, 'screens'))) {
    const screen = byId.get(data.id);
    if (!screen) { warnings.push(`${file}: la pantalla "${data.id}" ya no existe en src/app (ficha huérfana)`); continue; }
    Object.assign(screen, {
      title: data.title ?? screen.title,
      summary: data.summary,
      purpose: data.purpose,
      prerequisites: data.prerequisites,
      tips: data.tips,
      useCases: data.useCases,
      status: data.status === 'validated' ? 'validated' : 'draft',
    });
    // Elementos que el extractor atribuye mal (p. ej. campos definidos fuera de su HelpScopeProvider).
    const ignored = new Set(data.ignoreElements ?? []);
    screen.elements = screen.elements.filter((e) => !ignored.has(e.id));
    const known = new Map(screen.elements.map((e) => [e.id, e]));
    for (const [id, doc] of Object.entries(data.elements ?? {})) {
      const el = known.get(id);
      if (!el) {
        // Elementos que el extractor no ve (ids compuestos en runtime): se documentan igual.
        screen.elements.push({ id, kind: kindOfId(id), label: doc.label, description: doc.description, source: file });
        continue;
      }
      if (doc.description) el.description = doc.description;
      if (doc.label) el.label = doc.label;
    }
    screen.elements.sort((a, b) => a.id.localeCompare(b.id));
  }
}

/** Estados de la app que registra HelpAssistant (registerGuideCondition). */
const GUIDE_CONDITIONS = new Set(['cash-session-open', 'cash-session-closed']);

function validateGuides(screens, navItems, useCases, journey) {
  const routes = new Set(screens.map((s) => s.route));
  const ids = new Set([...screens.flatMap((s) => s.elements.map((e) => e.id)), ...navItems.map((n) => n.id)]);
  const useCaseIds = new Set(useCases.map((u) => u.data.id));
  for (const { file, data } of useCases) {
    if (!data.id || !data.title || !Array.isArray(data.steps) || !data.steps.length) {
      errors.push(`${file}: falta id, title o steps`);
      continue;
    }
    data.steps.forEach((step, i) => {
      const where = `${file} paso ${i + 1} (${step.id ?? '?'})`;
      if (!STEP_ACTIONS.has(step.action)) errors.push(`${where}: acción "${step.action}" inválida`);
      if (step.action === 'navigate') {
        if (!routes.has(step.route)) errors.push(`${where}: la ruta "${step.route}" no existe`);
      } else if (!step.target) {
        errors.push(`${where}: falta target`);
      } else if (step.target.includes('{{')) {
        // Target con datos (`…period-{{values.period}}`): sólo en pasos opcionales.
        if (!step.optional) errors.push(`${where}: un target con {{values.x}} tiene que ser optional`);
      } else if (!ids.has(step.target)) {
        errors.push(`${where}: el help id "${step.target}" no existe en el catálogo`);
      }
      for (const cond of [step.onlyIf, step.unless].filter(Boolean)) {
        const base = cond.replace(/@start$/, '');
        if (base.includes('.') ? !ids.has(base) : !GUIDE_CONDITIONS.has(base)) errors.push(`${where}: la condición "${cond}" no existe (help id o ${[...GUIDE_CONDITIONS].join(', ')})`);
      }
      for (const id of [].concat(step.until ?? [])) {
        if (!ids.has(id)) errors.push(`${where}: el help id de "until" "${id}" no existe en el catálogo`);
      }
    });
    for (const scope of data.screens ?? []) {
      if (!screens.some((s) => s.id === scope)) errors.push(`${file}: la pantalla "${scope}" no existe`);
    }
  }
  for (const step of journey) {
    if (!routes.has(step.route)) errors.push(`knowledge/onboarding/journey.json (${step.id}): la ruta "${step.route}" no existe`);
    if (step.useCaseId && !useCaseIds.has(step.useCaseId)) errors.push(`knowledge/onboarding/journey.json (${step.id}): el caso de uso "${step.useCaseId}" no existe`);
  }
  for (const screen of screens) {
    for (const uc of screen.useCases ?? []) {
      if (!useCaseIds.has(uc)) errors.push(`ficha ${screen.id}: el caso de uso "${uc}" no existe`);
    }
  }
}

// ─── main ────────────────────────────────────────────────────────────────────

const permissions = extractPermissions();
const navItems = extractNav(permissions.byConstant);
const screens = extractScreens(navItems, permissions);
mergeCuratedScreens(screens);

// El menú también es un elemento navegable (el asistente lo resalta para enseñar el camino).
const dashboard = screens.find((s) => s.id === 'dashboard');
if (dashboard) {
  for (const n of navItems) dashboard.elements.push({ id: n.id, kind: 'nav', label: n.label, description: n.group ? undefined : n.href });
  dashboard.elements.sort((a, b) => a.id.localeCompare(b.id));
}

const useCaseFiles = loadDir(join(KNOWLEDGE, 'use-cases'));
const journeyFile = join(KNOWLEDGE, 'onboarding', 'journey.json');
const journey = existsSync(journeyFile) ? readJson(journeyFile).steps ?? [] : [];
validateGuides(screens, navItems, useCaseFiles, journey);

// Mismo id en dos pantallas: sólo es un problema si viene de archivos distintos
// (un mismo componente, como el diálogo de citas, se abre desde varias pantallas).
const seenIds = new Map();
for (const s of screens) for (const e of s.elements) {
  const prev = seenIds.get(e.id);
  if (prev && prev.screen !== s.id && prev.source !== e.source) warnings.push(`help id "${e.id}" aparece en ${prev.screen} y ${s.id}`);
  if (!prev) seenIds.set(e.id, { screen: s.id, source: e.source });
}

const menuScreens = screens.filter((s) => s.inMenu);
const undocumented = menuScreens.filter((s) => s.status === 'auto');
if (STRICT) for (const s of undocumented) errors.push(`pantalla del menú sin ficha: ${s.route} (knowledge/screens/${s.id}.json)`);

// Lo que muestra la burbuja junto a la manito: si la guía no trae `details`,
// sirve la descripción del elemento en su ficha.
const elementDescriptions = new Map(screens.flatMap((sc) => sc.elements.filter((e) => e.description).map((e) => [e.id, e.description])));
const useCases = useCaseFiles.map(({ data }) => ({
  ...data,
  steps: (data.steps ?? []).map((step) => (
    step.details || !step.target || !elementDescriptions.has(step.target)
      ? step
      : { ...step, details: elementDescriptions.get(step.target) }
  )),
}));

const body = stable({
  screens,
  useCases: useCases.sort((a, b) => a.id.localeCompare(b.id)),
  journey,
  permissions: permissions.list.sort((a, b) => a.code.localeCompare(b.code)),
});
const version = createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 16);
const output = JSON.stringify({ version, ...body }, null, 1) + '\n';

const elementsTotal = screens.reduce((n, s) => n + s.elements.length, 0);
const validated = menuScreens.filter((s) => s.status === 'validated').length;
console.log(`[knowledge] ${screens.length} pantallas · ${elementsTotal} elementos · ${body.useCases.length} guías · ${permissions.list.length} permisos · versión ${version}`);
console.log(`[knowledge] menú: ${menuScreens.length - undocumented.length}/${menuScreens.length} con ficha, ${validated} validadas`);
for (const w of warnings) console.warn(`[knowledge] aviso: ${w}`);
for (const e of errors) console.error(`[knowledge] ERROR: ${e}`);

if (CHECK) {
  const current = existsSync(OUTPUT) ? readFileSync(OUTPUT, 'utf8') : '';
  if (current !== output) {
    console.error('[knowledge] ERROR: src/generated/help-catalog.json está desactualizado. Corré `pnpm knowledge:build`.');
    process.exit(1);
  }
  if (errors.length) process.exit(1);
  process.exit(0);
}

if (errors.length) process.exit(1);
mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, output);
