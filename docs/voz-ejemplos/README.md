# Voz · Ejemplos probados

Generado por `pnpm test:voice:examples` (`scripts/voice-examples.mjs`) — no editar a mano. Cómo funciona la voz: [voz-gestion.md](../voz-gestion.md).

Cada frase de este catálogo se dijo en una prueba de la batería del simulador (`e2e/tests/voice-agent/`, `pnpm test:voice`) **que pasa**: **2983 frases dichas** (1850 distintas) en **2420 pruebas en verde** (todas las de la batería). Por idioma: es 2071 · es-ES 68 · en 844.

**Cómo leerlo.** El simulador corre la sesión de voz, los comandos y los textos reales de cada idioma; las pantallas son simuladas (publican lo mismo que la pantalla real) y la IA es el flujo de n8n con el modelo reemplazado por la respuesta que da la prueba. Lo que no lleva la marca «IA» lo entiende el navegador solo, siempre igual. Lo que lleva «IA» depende en la app real de lo que conteste el modelo. Lo probado en la app real, pantalla por pantalla, está en [voz-pruebas-vivo.md](../voz-pruebas-vivo.md).

## Por área

| Área | Pruebas con frases | Frases | es | es-ES | en | IA | Pruebas sin frase |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [Escucha y palabra «Invoke»](01-escucha.md) | 0 | 0 | 0 | 0 | 0 | 0 | 23 |
| [Micrófono permanente](02-microfono.md) | 0 | 0 | 0 | 0 | 0 | 0 | 7 |
| [Avisos, cerrar y dejar de escuchar](03-avisos-cerrar-parar.md) | 35 | 60 | 39 | 0 | 21 | 0 | 57 |
| [Avisos y ventanas: elegir](04-avisos-y-elegir.md) | 169 | 201 | 103 | 0 | 98 | 0 | 16 |
| [General: desplazarse y lo abierto primero](05-general.md) | 29 | 33 | 24 | 0 | 9 | 0 | 37 |
| [Menú principal (navegar)](06-menu.md) | 35 | 45 | 40 | 2 | 3 | 7 | 91 |
| [Cualquier pantalla (voz genérica)](07-cualquier-pantalla.md) | 114 | 126 | 99 | 5 | 22 | 0 | 0 |
| [Riel derecho (panel flotante)](08-riel-derecho.md) | 60 | 67 | 50 | 3 | 14 | 0 | 0 |
| [Cobro rápido](09-cobro-rapido.md) | 59 | 155 | 140 | 1 | 14 | 0 | 0 |
| [Agenda: escucha, navegación, vistas y zoom](10-agenda-barra.md) | 27 | 34 | 34 | 0 | 0 | 0 | 1 |
| [Agenda: agendas, filtros y engranaje](11-agenda-engranaje.md) | 67 | 83 | 83 | 0 | 0 | 0 | 0 |
| [Agenda: la cita](12-agenda-citas.md) | 31 | 52 | 52 | 0 | 0 | 0 | 0 |
| [Agenda: formulario, exportar y pacientes](13-agenda-formulario.md) | 34 | 61 | 61 | 0 | 0 | 0 | 0 |
| [Encadenados](20-encadenados.md) | 24 | 66 | 66 | 0 | 0 | 0 | 0 |
| [Con IA: planes de varios pasos](30-ia-planes.md) | 27 | 49 | 49 | 0 | 0 | 17 | 0 |
| [Incompletos o mal dichos](40-incompletos.md) | 16 | 32 | 32 | 0 | 0 | 0 | 0 |
| [La agenda en inglés](50-ingles.md) | 88 | 131 | 0 | 0 | 131 | 4 | 1 |
| [Información y acciones del paciente](60-info-paciente.md) | 37 | 54 | 35 | 0 | 19 | 0 | 0 |
| [Variantes en español](70-variantes-es.md) | 213 | 243 | 243 | 0 | 0 | 0 | 0 |
| [Variantes en inglés](71-variantes-en.md) | 192 | 219 | 0 | 0 | 219 | 0 | 0 |
| [Más variantes](72-mas-variantes.md) | 119 | 196 | 114 | 0 | 82 | 0 | 0 |
| [Rutinas reales](80-rutinas.md) | 27 | 114 | 70 | 0 | 44 | 1 | 0 |
| [Comprensión con IA](90-ia-comprension.md) | 42 | 55 | 39 | 0 | 16 | 40 | 0 |
| [Panel de control](91-panel-de-control.md) | 33 | 36 | 26 | 1 | 9 | 0 | 18 |
| [Mi consultorio](92-mi-consultorio.md) | 129 | 194 | 143 | 14 | 37 | 0 | 0 |
| [Centro de alertas](93-alertas.md) | 33 | 49 | 41 | 1 | 7 | 0 | 0 |
| [Caja](94-caja.md) | 29 | 32 | 27 | 1 | 4 | 0 | 0 |
| [Pacientes](95-pacientes.md) | 63 | 91 | 81 | 2 | 8 | 0 | 0 |
| [Órdenes de laboratorio](96-laboratorio.md) | 17 | 26 | 20 | 2 | 4 | 0 | 17 |
| [Periodontograma](97-periodontograma.md) | 14 | 15 | 13 | 0 | 2 | 0 | 3 |
| [Facturas, pagos y presupuestos](98-documentos.md) | 35 | 41 | 29 | 2 | 10 | 0 | 0 |
| [Reportes](99-reportes.md) | 33 | 42 | 32 | 2 | 8 | 0 | 0 |
| [Listas (Catálogo, Configuración, Sistema)](9a-listas.md) | 40 | 46 | 30 | 5 | 11 | 0 | 0 |
| [Caso clínico (agente clínico)](9b-caso-clinico.md) | 50 | 117 | 95 | 10 | 12 | 0 | 2 |
| [Tablas](9c-tablas.md) | 116 | 128 | 88 | 12 | 28 | 0 | 0 |
| [Valores de los campos](9d-valores-de-campos.md) | 0 | 0 | 0 | 0 | 0 | 0 | 35 |
| [Estado de cuenta del paciente](9e-estado-de-cuenta.md) | 42 | 50 | 38 | 4 | 8 | 0 | 0 |
| [Entender lo no dicho tal cual](9f-entender.md) | 29 | 40 | 35 | 1 | 4 | 4 | 4 |

## Por pantalla

La pantalla en la que estaba la voz cuando se dijo la frase. Las áreas generales (cualquier pantalla, avisos, tablas) usan una pantalla de ejemplo: valen igual en todas.

| Pantalla | Frases | Idiomas | Áreas |
| --- | --- | --- | --- |
| `/` | 119 | en, es, es-ES | [Menú principal (navegar)](06-menu.md), [Cualquier pantalla (voz genérica)](07-cualquier-pantalla.md), [Riel derecho (panel flotante)](08-riel-derecho.md), [Panel de control](91-panel-de-control.md), [Mi consultorio](92-mi-consultorio.md), [Centro de alertas](93-alertas.md), [Caja](94-caja.md), [Pacientes](95-pacientes.md), [Órdenes de laboratorio](96-laboratorio.md), [Facturas, pagos y presupuestos](98-documentos.md), [Reportes](99-reportes.md), [Listas (Catálogo, Configuración, Sistema)](9a-listas.md) |
| `/alerts` | 48 | en, es, es-ES | [Centro de alertas](93-alertas.md) |
| `/appointments` | 1708 | en, es | [Avisos, cerrar y dejar de escuchar](03-avisos-cerrar-parar.md), [Avisos y ventanas: elegir](04-avisos-y-elegir.md), [General: desplazarse y lo abierto primero](05-general.md), [Menú principal (navegar)](06-menu.md), [Cualquier pantalla (voz genérica)](07-cualquier-pantalla.md), [Riel derecho (panel flotante)](08-riel-derecho.md), [Agenda: escucha, navegación, vistas y zoom](10-agenda-barra.md), [Agenda: agendas, filtros y engranaje](11-agenda-engranaje.md), [Agenda: la cita](12-agenda-citas.md), [Agenda: formulario, exportar y pacientes](13-agenda-formulario.md), [Encadenados](20-encadenados.md), [Con IA: planes de varios pasos](30-ia-planes.md), [Incompletos o mal dichos](40-incompletos.md), [La agenda en inglés](50-ingles.md), [Información y acciones del paciente](60-info-paciente.md), [Variantes en español](70-variantes-es.md), [Variantes en inglés](71-variantes-en.md), [Más variantes](72-mas-variantes.md), [Rutinas reales](80-rutinas.md), [Comprensión con IA](90-ia-comprension.md), [Panel de control](91-panel-de-control.md) |
| `/cashier` | 40 | en, es, es-ES | [Cualquier pantalla (voz genérica)](07-cualquier-pantalla.md), [Caja](94-caja.md) |
| `/clinic-catalog/measurement-units` | 1 | es | [Listas (Catálogo, Configuración, Sistema)](9a-listas.md) |
| `/clinic-catalog/medications` | 162 | en, es, es-ES | [Listas (Catálogo, Configuración, Sistema)](9a-listas.md), [Tablas](9c-tablas.md) |
| `/config/currencies` | 1 | es-ES | [Listas (Catálogo, Configuración, Sistema)](9a-listas.md) |
| `/config/doctors` | 1 | es | [Listas (Catálogo, Configuración, Sistema)](9a-listas.md) |
| `/config/holidays` | 2 | es | [Listas (Catálogo, Configuración, Sistema)](9a-listas.md) |
| `/config/sedes` | 45 | en, es, es-ES | [Listas (Catálogo, Configuración, Sistema)](9a-listas.md), [Entender lo no dicho tal cual](9f-entender.md) |
| `/lab-orders` | 25 | en, es, es-ES | [Órdenes de laboratorio](96-laboratorio.md) |
| `/patients` | 161 | en, es, es-ES | [Menú principal (navegar)](06-menu.md), [Panel de control](91-panel-de-control.md), [Pacientes](95-pacientes.md), [Periodontograma](97-periodontograma.md), [Estado de cuenta del paciente](9e-estado-de-cuenta.md) |
| `/purchases/invoices` | 1 | es | [Facturas, pagos y presupuestos](98-documentos.md) |
| `/purchases/providers` | 278 | en, es, es-ES | [Cualquier pantalla (voz genérica)](07-cualquier-pantalla.md), [Riel derecho (panel flotante)](08-riel-derecho.md), [Cobro rápido](09-cobro-rapido.md) |
| `/reports/cierre-caja` | 10 | en, es, es-ES | [Reportes](99-reportes.md) |
| `/reports/deudores` | 31 | en, es, es-ES | [Reportes](99-reportes.md) |
| `/sales/invoices` | 34 | en, es, es-ES | [Facturas, pagos y presupuestos](98-documentos.md) |
| `/sales/quotes` | 5 | es | [Facturas, pagos y presupuestos](98-documentos.md) |
| `/workspace` | 311 | en, es, es-ES | [Mi consultorio](92-mi-consultorio.md), [Caso clínico (agente clínico)](9b-caso-clinico.md), [Entender lo no dicho tal cual](9f-entender.md) |

