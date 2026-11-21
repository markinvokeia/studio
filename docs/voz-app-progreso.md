# Voz en toda la app · Avance por página

La voz de Invoke IA se lleva página por página con el mismo esquema que la agenda (la referencia): todo lo que hoy se hace con clics se tiene que poder pedir con la voz, en **español e inglés**, con la batería de pruebas de cada página y el flujo de n8n «Voz - Interpretar» actualizado. Reglas comunes del agente: [voz-agenda.md §1](voz-agenda.md). Pruebas: [voz-agenda-pruebas.md](voz-agenda-pruebas.md).

## Cómo funciona en cualquier página

- **Un solo botón Voz**, en el riel derecho, debajo de la mascota. Lo monta el `Header` una vez (`VoiceCommandHost` + `VoiceCommandButton`).
- **El contexto lo da la página abierta.** Cada pantalla registra sus módulos de voz con `useVoiceScreen([...])` (la agenda: `calendar`; laboratorio: `lab_orders`). Al navegar cambia el contexto **sin apagar el micrófono**.
- El módulo **`core`** está siempre activo, en todas las páginas (desplazarse, y lo que venga: navegar por el menú, el panel derecho).
- **Lo que está a la vista tiene prioridad**, en este orden:
  1. un aviso abierto (lee sus botones y aprieta el nombrado);
  2. una ventana o panel lateral abierto (sus botones y sus campos);
  3. lo seleccionado en pantalla (la cita abierta es el foco);
  4. la página.

  Si se pide algo de otro contexto, se suelta el foco y se cierra lo abierto antes de hacerlo.
- **Pila de tareas**: buscar, elegir, retomar; herramientas en el medio; cambio de tema con confirmación; dormir y retomar. Igual en todas las páginas.
- **n8n**: `pnpm n8n:help` regenera los flujos y `N8N_API_KEY=… pnpm n8n:deploy:voice` publica «Voz - Interpretar». Cada módulo nuevo suma su entrada en `VOICE_DOMAINS` del generador.

## Plan y estado

| # | Página / zona | Módulo | Estado | Pruebas |
| --- | --- | --- | --- | --- |
| 0 | **Agenda** (`/appointments`) | `calendar` | ✅ Completa: barra, vistas, zoom, panel, engranaje, exportar, citas, editor, avisos, pacientes (información y acciones), recordatorios, bloqueos | `e2e/tests/voice-agent/` (≈1300 casos es/en) |
| 0 | **General** (todas las páginas) | `core` | ✅ Desplazarse; avisos, ventanas y campos genéricos; dejar de escuchar; cerrar | `02`, `03`, `04`, `05` |
| 1 | Menú principal (izquierda): «andá a…», «quiero ver…», «navegá a…» | `core` (navegación) | ⏳ Siguiente: ir a la ruta como primer paso del plan, esperar a que cargue y seguir con el contexto de la página nueva | — |
| 2 | Panel flotante derecho (riel): paciente, sede, caja, TV, cobrar, alertas, cambio, bandeja, notas, asistente | `core` (riel) | ⏳ | — |
| 3 | Panel de control (`/dashboard`) | `dashboard` | ⏳ | — |
| 4 | Mi consultorio (`/workspace`) | `workspace` | ⏳ | — |
| 5 | Centro de alertas | `alerts` | ⏳ | — |
| 6 | Caja | `cashier` | ⏳ | — |
| 7 | Pacientes (lista y perfil, pestañas) | `patients` | ⏳ | — |
| 8 | Órdenes de laboratorio | `lab_orders` | 🟡 Comandos sueltos existentes; falta llevarlo al esquema de la agenda | `e2e/tests/lab-orders/voice-commands.spec.ts` |
| 9 | Periodontograma (sesión) | `perio` | 🟡 Dictado propio existente; falta integrarlo al botón único | `e2e/tests/patients/perio-voice-*.spec.ts` |
| 10 | Ventas, compras | `sales`, `purchases` | ⏳ | — |
| 11 | Reportes | `reports` | ⏳ | — |
| 12 | Catálogo de la clínica | `catalog` | ⏳ (al final) | — |
| 13 | Configuración del negocio | `config` | ⏳ (al final) | — |
| 14 | Sistema | `system` | ⏳ (al final) | — |

Cada página se cierra con su batería de pruebas en verde (es y en), el flujo de n8n publicado, este documento actualizado y un commit propio.
