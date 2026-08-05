<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:catalog-template-rules -->
# Plantilla Oficial para Nuevos Catálogos: Módulo Departamentos

El módulo **Departamentos** (`DepartmentsSecurityView.jsx` y `/api/departamentos`) es la plantilla patrón oficial para la creación de cualquier catálogo en la aplicación.

Para cada nuevo catálogo que se solicite, se heredará intacta toda la arquitectura, componentes, modales, tablas, ordenamiento, paginación, alertas visuales y validaciones centralizadas, modificando únicamente:
1. Nombre del módulo
2. Tabla de la base de datos (schema `admin.*`)
3. Campos y tipos de datos
4. Relaciones de la entidad
5. Validaciones y reglas de negocio propias del catálogo
6. Consultas SQL (GET, POST, PUT, DELETE)
<!-- END:catalog-template-rules -->

