# Nóminas — Flujos n8n

## Archivos de workflow

| Archivo | Descripción | Endpoints cubiertos |
|---------|-------------|---------------------|
| `payroll-settings.json` | Configuración, categorías Grupo 15, calendario laboral | 7 endpoints |
| `payroll-employees.json` | Legajo de empleados, vinculaciones, cargas de familia, deducciones IRPF | 13 endpoints |
| `payroll-contracts.json` | Contratos honorarios / arrendamiento (doctores independientes) | 4 endpoints |
| `payroll-periods.json` | Períodos: crear, calcular, aprobar, pagar, cerrar, reabrir | 8 endpoints |
| `payroll-entries.json` | Entradas de liquidación, sesiones asignadas, ajustes manuales | 8 endpoints |
| `payroll-novedades.json` | Novedades: licencias, ausencias, horas extra | 4 endpoints |
| `payroll-honorarios.json` | Ciclo de honorarios: draft → factura → autorización → pago | 6 endpoints |
| `payroll-dashboard.json` | KPIs del mes actual + top earners | 1 endpoint |
| `payroll-reports.json` | Reportes BPS, IRPF anual, MTSS, banco, contabilidad, recibos | 7 endpoints |

**Total: 58 endpoints en 9 workflows**

## Cómo importar en n8n

1. En n8n → **Workflows** → botón **Import**
2. Seleccionar el archivo `.json`
3. Después de importar, editar la credencial Postgres en cada nodo y reemplazar `POSTGRES_CREDENTIAL_ID` con el ID real de la credencial Postgres configurada en el entorno

## Motor de cálculo (`payroll-periods.json`)

El workflow `POST /payroll/periods/calculate` implementa el cálculo completo:

1. **Fetch settings** — lee todas las tasas de `payroll_settings` (BPS, FONASA, IRPF, BPC, etc.)
2. **Fetch contracts** — doctor_contracts activos en el rango de fechas del período
3. **Fetch sessions** — sesiones de `patient_sessions` con revenue de `payments` (cobrado) y `services` (precio lista)
4. **Calculate Payroll** (Code node) — lógica JS completa:
   - Gross según `calculation_type` (fijo / por_hora / porcentaje / fijo_porcentaje / por_prestacion)
   - Si `empleado`: BPS obrero (15%), FONASA básico (3%), FRL (0.125%), IRPF progresivo con deducciones
   - Costo patronal: BPS (7.5%), FONASA (5%), FGCL (0.025%), BSE (0.3%)
   - Provisiones: aguinaldo (bruto/12), vacacional (bruto/30 × días/12)
5. **Save entries** — `ON CONFLICT DO UPDATE` en `payroll_entries`
6. **Update period status** → `'calculated'`

## Variables de entorno requeridas

Todos los nodos Postgres usan la credencial nombrada `Postgres`. En producción debe existir esa credencial con:
- Host, puerto, base de datos, usuario y contraseña del servidor PostgreSQL de InvokeIA

## Parámetros de entrada por endpoint

### POST /payroll/periods/calculate
```json
{ "id": "<period_uuid>", "calculated_by": "<user_uuid>" }
```

### POST /payroll/periods/approve
```json
{ "id": "<period_uuid>", "approved_by": "<user_uuid>" }
```

### GET /payroll/dashboard
```
?clinic_id=1&year=2026&month=4
```

### GET /payroll/reports/* (los de período)
```
?period_id=<uuid>
```

### GET /payroll/reports/dgi-irpf-annual
```
?year=2025&clinic_id=1
```
