DO $$ 
BEGIN
    INSERT INTO public.permissions 
    (name, description, resource, casl_action, code, module, submenu, permission_type)
    VALUES
    -- General / Menú
    ('Ver menú Nómina', 'Permite ver la entrada del menú de Nómina en el sidebar', 'Payroll', 'read', 'PAYROLL_VIEW_MENU', 'Nómina', 'General', 'MENÚ'),
    ('Ver dashboard de nómina', 'Visualizar indicadores y resumen de nómina', 'Payroll', 'read', 'PAYROLL_DASHBOARD_VIEW', 'Nómina', 'Dashboard', 'LECTURA'),

    -- Employees (Legajo)
    ('Ver listado de empleados', 'Ver tabla de empleados y legajos', 'Payroll', 'read', 'PAYROLL_EMPLOYEES_VIEW_LIST', 'Nómina', 'Empleados', 'LECTURA'),
    ('Crear empleado', 'Registrar un nuevo empleado en el sistema', 'Payroll', 'create', 'PAYROLL_EMPLOYEES_CREATE', 'Nómina', 'Empleados', 'CREAR'),
    ('Editar empleado', 'Modificar datos del legajo del empleado', 'Payroll', 'update', 'PAYROLL_EMPLOYEES_UPDATE', 'Nómina', 'Empleados', 'ACTUALIZAR'),
    ('Desactivar empleado', 'Cambiar estado a inactivo o gestionar baja de empleado', 'Payroll', 'update', 'PAYROLL_EMPLOYEES_DEACTIVATE', 'Nómina', 'Empleados', 'FUNCIONAL'),
    ('Ver legajo detallado', 'Acceder a la información completa del legajo del trabajador', 'Payroll', 'read', 'PAYROLL_EMPLOYEES_VIEW_LEGAJO', 'Nómina', 'Empleados', 'LECTURA'),
    ('Gestionar grupo familiar', 'Administrar vínculos y datos de familiares del empleado', 'Payroll', 'manage', 'PAYROLL_EMPLOYEES_MANAGE_FAMILY', 'Nómina', 'Empleados', 'FUNCIONAL'),
    ('Gestionar deducciones', 'Administrar deducciones personales y retenciones fijas', 'Payroll', 'manage', 'PAYROLL_EMPLOYEES_MANAGE_DEDUCTIONS', 'Nómina', 'Empleados', 'FUNCIONAL'),
    ('Gestionar documentos empleado', 'Administrar archivos y documentos adjuntos al legajo', 'Payroll', 'manage', 'PAYROLL_EMPLOYEES_MANAGE_DOCUMENTS', 'Nómina', 'Empleados', 'FUNCIONAL'),

    -- Contracts (Doctores Independientes)
    ('Ver listado de contratos', 'Ver contratos de profesionales independientes', 'Payroll', 'read', 'PAYROLL_CONTRACTS_VIEW_LIST', 'Nómina', 'Contratos', 'LECTURA'),
    ('Crear contrato', 'Registrar nuevo contrato de profesional', 'Payroll', 'create', 'PAYROLL_CONTRACTS_CREATE', 'Nómina', 'Contratos', 'CREAR'),
    ('Editar contrato', 'Modificar términos de contratos existentes', 'Payroll', 'update', 'PAYROLL_CONTRACTS_UPDATE', 'Nómina', 'Contratos', 'ACTUALIZAR'),
    ('Eliminar contrato', 'Remover registro de contrato del sistema', 'Payroll', 'delete', 'PAYROLL_CONTRACTS_DELETE', 'Nómina', 'Contratos', 'ELIMINAR'),

    -- Novedades
    ('Ver novedades del mes', 'Visualizar incidencias, horas extra y faltas del periodo', 'Payroll', 'read', 'PAYROLL_NOVEDADES_VIEW', 'Nómina', 'Novedades', 'LECTURA'),
    ('Gestionar novedades', 'Cargar o modificar novedades manualmente', 'Payroll', 'manage', 'PAYROLL_NOVEDADES_MANAGE', 'Nómina', 'Novedades', 'FUNCIONAL'),
    ('Importar novedades', 'Carga masiva de novedades vía archivo externo', 'Payroll', 'create', 'PAYROLL_NOVEDADES_IMPORT', 'Nómina', 'Novedades', 'FUNCIONAL'),

    -- Periods
    ('Ver listado de periodos', 'Ver historial de periodos de liquidación', 'Payroll', 'read', 'PAYROLL_PERIODS_VIEW_LIST', 'Nómina', 'Periodos', 'LECTURA'),
    ('Crear periodo', 'Abrir un nuevo periodo de liquidación mensual', 'Payroll', 'create', 'PAYROLL_PERIODS_CREATE', 'Nómina', 'Periodos', 'CREAR'),
    ('Calcular nómina', 'Ejecutar proceso de cálculo de haberes del periodo', 'Payroll', 'manage', 'PAYROLL_PERIODS_CALCULATE', 'Nómina', 'Periodos', 'FUNCIONAL'),
    ('Aprobar nómina', 'Dar aprobación técnica a los resultados del periodo', 'Payroll', 'manage', 'PAYROLL_PERIODS_APPROVE', 'Nómina', 'Periodos', 'FUNCIONAL'),
    ('Marcar periodo como pagado', 'Registrar la confirmación de pago de haberes', 'Payroll', 'manage', 'PAYROLL_PERIODS_MARK_PAID', 'Nómina', 'Periodos', 'FUNCIONAL'),
    ('Cerrar periodo', 'Realizar el cierre administrativo del periodo', 'Payroll', 'manage', 'PAYROLL_PERIODS_CLOSE', 'Nómina', 'Periodos', 'FUNCIONAL'),
    ('Reabrir periodo', 'Permite abrir un periodo cerrado para correcciones', 'Payroll', 'manage', 'PAYROLL_PERIODS_REOPEN', 'Nómina', 'Periodos', 'FUNCIONAL'),

    -- Entries / Adjustments
    ('Ver entradas de liquidación', 'Ver el detalle de conceptos liquidados por empleado', 'Payroll', 'read', 'PAYROLL_ENTRIES_VIEW', 'Nómina', 'Liquidación', 'LECTURA'),
    ('Actualizar entradas', 'Modificar valores calculados en la liquidación', 'Payroll', 'update', 'PAYROLL_ENTRIES_UPDATE', 'Nómina', 'Liquidación', 'ACTUALIZAR'),
    ('Gestionar ajustes manuales', 'Realizar ajustes excepcionales en la liquidación', 'Payroll', 'manage', 'PAYROLL_ADJUSTMENTS_MANAGE', 'Nómina', 'Liquidación', 'FUNCIONAL'),

    -- Honorarios
    ('Ver honorarios', 'Visualizar honorarios de profesionales independientes', 'Payroll', 'read', 'PAYROLL_HONORARIOS_VIEW', 'Nómina', 'Honorarios', 'LECTURA'),
    ('Gestionar honorarios', 'Administrar montos y conceptos de honorarios', 'Payroll', 'manage', 'PAYROLL_HONORARIOS_MANAGE', 'Nómina', 'Honorarios', 'FUNCIONAL'),
    ('Autorizar honorarios', 'Aprobar el pago de honorarios profesionales', 'Payroll', 'manage', 'PAYROLL_HONORARIOS_AUTHORIZE', 'Nómina', 'Honorarios', 'FUNCIONAL'),
    ('Marcar honorarios pagados', 'Confirmar el pago efectivo de honorarios', 'Payroll', 'manage', 'PAYROLL_HONORARIOS_MARK_PAID', 'Nómina', 'Honorarios', 'FUNCIONAL'),

    -- Egreso
    ('Calcular liquidación egreso', 'Procesar cálculo de liquidación final por baja', 'Payroll', 'manage', 'PAYROLL_EGRESO_CALCULATE', 'Nómina', 'Egresos', 'FUNCIONAL'),
    ('Confirmar liquidación egreso', 'Finalizar y confirmar la liquidación de egreso', 'Payroll', 'manage', 'PAYROLL_EGRESO_CONFIRM', 'Nómina', 'Egresos', 'FUNCIONAL'),

    -- Reports
    ('Ver sección reportes', 'Acceso al módulo de reportes de nómina', 'Payroll', 'read', 'PAYROLL_REPORTS_VIEW', 'Nómina', 'Reportes', 'LECTURA'),
    ('Generar reporte BPS', 'Generar archivos para declaración de BPS', 'Payroll', 'read', 'PAYROLL_REPORTS_BPS', 'Nómina', 'Reportes', 'FUNCIONAL'),
    ('Generar reporte DGI', 'Generar archivos para declaración IRPF/DGI', 'Payroll', 'read', 'PAYROLL_REPORTS_DGI', 'Nómina', 'Reportes', 'FUNCIONAL'),
    ('Generar archivo bancos', 'Generar archivo de acreditación bancaria de haberes', 'Payroll', 'read', 'PAYROLL_REPORTS_BANK', 'Nómina', 'Reportes', 'FUNCIONAL'),
    ('Generar reporte contable', 'Generar asiento de sueldos para contabilidad', 'Payroll', 'read', 'PAYROLL_REPORTS_ACCOUNTING', 'Nómina', 'Reportes', 'FUNCIONAL'),
    ('Emitir recibos de sueldo', 'Generación masiva de recibos en PDF', 'Payroll', 'read', 'PAYROLL_REPORTS_RECEIPTS', 'Nómina', 'Reportes', 'FUNCIONAL'),

    -- Cierre Formal
    ('Ejecutar cierre anual/formal', 'Proceso de cierre definitivo de ciclo', 'Payroll', 'manage', 'PAYROLL_CIERRE_EXECUTE', 'Nómina', 'Cierre', 'FUNCIONAL'),
    ('Reabrir cierre formal', 'Reapertura de ciclo cerrado formalmente', 'Payroll', 'manage', 'PAYROLL_CIERRE_REOPEN', 'Nómina', 'Cierre', 'FUNCIONAL'),

    -- Settings
    ('Ver configuración nómina', 'Ver parámetros generales del módulo', 'Payroll', 'read', 'PAYROLL_SETTINGS_VIEW', 'Nómina', 'Configuración', 'LECTURA'),
    ('Actualizar configuración nómina', 'Modificar valores globales de configuración', 'Payroll', 'update', 'PAYROLL_SETTINGS_UPDATE', 'Nómina', 'Configuración', 'ACTUALIZAR'),
    ('Configurar conceptos', 'Administrar conceptos salariales y fórmulas', 'Payroll', 'manage', 'PAYROLL_SETTINGS_CONCEPTS', 'Nómina', 'Configuración', 'FUNCIONAL'),
    ('Configurar categorías', 'Gestionar categorías laborales y laudos', 'Payroll', 'manage', 'PAYROLL_SETTINGS_CATEGORIES', 'Nómina', 'Configuración', 'FUNCIONAL'),
    ('Configurar calendario nómina', 'Administrar feriados y días laborables del módulo', 'Payroll', 'manage', 'PAYROLL_SETTINGS_CALENDAR', 'Nómina', 'Configuración', 'FUNCIONAL'),

    -- Export / Portal
    ('Exportar datos nómina', 'Exportación general de datos a formatos externos', 'Payroll', 'read', 'PAYROLL_EXPORT', 'Nómina', 'General', 'FUNCIONAL'),
    ('Ver portal del trabajador', 'Acceso a la vista de autoservicio para empleados', 'Payroll', 'read', 'PAYROLL_PORTAL_VIEW', 'Nómina', 'Portal', 'LECTURA')

    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        casl_action = EXCLUDED.casl_action,
        permission_type = EXCLUDED.permission_type,
        module = EXCLUDED.module,
        submenu = EXCLUDED.submenu;
END $$;