#!/usr/bin/env node
/**
 * generate-agent-jwt.mjs
 * ---------------------------------------------------------------------------
 * Firma el JWT del usuario de servicio "Agente WhatsApp" (migración
 * 122_20260930_whatsapp-agent-service-user.sql) con el MISMO secreto que usa la
 * credencial "JWT Auth account" de n8n.
 *
 * Claims idénticos a los que emite /api/auth/login:
 *   { userId, email, expiresIn, iat }
 * No lleva `exp`: el webhook jwtAuth de n8n sólo verifica la firma, así que el
 * token vale hasta que se rote el secreto. Para cortar el acceso sin rotarlo,
 * desactivar el rol agente_ia del usuario (ver la migración 122).
 *
 *   JWT_SECRET='<secreto de la credencial JWT de n8n>' \
 *   AGENT_USER_ID='<users.id del usuario Agente WhatsApp>' \
 *     node scripts/n8n/generate-agent-jwt.mjs
 *
 *   SELECT id FROM users WHERE email = 'agente-whatsapp@sistema.invokeia.invalid';
 *
 * El resultado se guarda como credencial de n8n (Header Auth con
 * `Authorization: Bearer <token>`) y NUNCA en el repo ni en el workflow.
 *
 * Supone HS256 con el secreto como passphrase (lo habitual en la credencial
 * "JWT Auth" de n8n). Si la credencial usa otro algoritmo, pasar JWT_ALG.
 * ---------------------------------------------------------------------------
 */
import { createHmac } from 'node:crypto';

const ALGS = { HS256: 'sha256', HS384: 'sha384', HS512: 'sha512' };

const secret = process.env.JWT_SECRET;
const userId = process.env.AGENT_USER_ID;
const email = process.env.AGENT_EMAIL || 'agente-whatsapp@sistema.invokeia.invalid';
const alg = (process.env.JWT_ALG || 'HS256').toUpperCase();

if (!secret || !userId) {
    console.error('Faltan JWT_SECRET y/o AGENT_USER_ID (ver el encabezado del script).');
    process.exit(1);
}
if (!ALGS[alg]) {
    console.error(`JWT_ALG no soportado: ${alg}. Usar ${Object.keys(ALGS).join(', ')}.`);
    process.exit(1);
}
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    console.error('AGENT_USER_ID no es un UUID.');
    process.exit(1);
}

const b64url = (input) => Buffer.from(input).toString('base64url');

const header = { alg, typ: 'JWT' };
const payload = {
    userId,
    email,
    expiresIn: 'service-account',
    iat: Math.floor(Date.now() / 1000),
};

const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
const signature = createHmac(ALGS[alg], secret).update(signingInput).digest('base64url');

process.stdout.write(`${signingInput}.${signature}\n`);
