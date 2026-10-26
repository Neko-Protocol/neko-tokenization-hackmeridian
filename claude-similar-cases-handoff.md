# Neko: revisión de propuestas con memoria de decisiones

Fecha: 26 de octubre de 2026.

## Contexto y estado

La funcionalidad está implementada, validada localmente y publicada en dos ramas con PRs a `main`. El 26 de octubre de 2026 se verificó que ambos PRs siguen abiertos y sin merge. No se hizo despliegue durante esta tarea. Los resultados de pruebas descritos aquí corresponden a los commits indicados; no prueban que el cambio esté publicado en los servicios desplegados.

Esta entrega conecta la preparación de una propuesta, su evaluación mediante reglas y el criterio humano acumulado. El administrador puede ver qué decisiones se tomaron en propuestas comparables, leer la nota del revisor y comprobar por qué se recuperó cada caso, antes de tomar una nueva decisión.

La guía pública [docs/review-memory.md](docs/review-memory.md), enlazada desde `README.md`, `llms.txt` y `sitemap.xml`, presenta la misma contribución con enlaces al código y a las pruebas fijados a commits. Este Markdown es una explicación autónoma en español para compartir con Claude.

El objetivo es que el administrador vea propuestas anteriores parecidas a la que está revisando, junto con su decisión y la nota del revisor. «Learns from every decision» describe memoria de casos guardados y búsqueda por reglas; no hay entrenamiento de modelos.

Solo se consultan decisiones reales de `public.launchpad_applications`. No se insertaron casos de ejemplo en la base de datos.

## Problema y aportación dentro de la solución

Neko busca conectar a empresas que necesitan preparar y tokenizar una oferta de activos con inversores elegibles que puedan descubrirla y participar. La revisión administrativa es el paso entre la preparación de la propuesta y el recorrido previsto hacia la emisión y distribución.

Antes de este cambio, el revisor podía consultar los datos de la propuesta y los checks legales, pero no tenía en esa pantalla una búsqueda de decisiones anteriores comparables. El conocimiento de una revisión quedaba en la fila de esa propuesta, sin una forma directa de recuperarlo al revisar otra.

Ahora se añade ese acceso al contexto histórico. La aportación concreta es reutilizar criterios humanos que ya fueron registrados y hacer visible su procedencia. La reducción del trabajo repetido y una mayor consistencia son beneficios buscados; no se han medido tiempos de revisión ni una mejora cuantificada de calidad.

### Responsabilidad de cada pieza

| Pieza                                   | Qué aporta                                                             | Cómo se relaciona con este cambio                                                                     |
| --------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Formulario y asistente de IA del emisor | Ayudan a preparar los datos estructurados de una propuesta             | Los campos guardados son la entrada de la búsqueda. El asistente todavía no consulta casos similares. |
| Neko Legal KB                           | Artículos y documentos legales citados                                 | Da contexto a la revisión existente; las notas históricas no se convierten en fuentes legales.        |
| Checklist del admin                     | Reglas explícitas aplicadas a la propuesta actual y acceso a sus citas | Mantiene su lógica y se muestra junto a los casos.                                                    |
| Similar cases                           | Casos ya decididos, notas, resultados y motivos de similitud           | Es la funcionalidad añadida en esta entrega.                                                          |
| Revisor humano                          | Aprueba, rechaza o pide cambios y registra su nota                     | Conserva la autoridad para decidir; su resultado guardado puede recuperarse en búsquedas futuras.     |
| Contratos e inversión                   | Emisión, elegibilidad, distribución y movimiento de fondos             | Son etapas separadas. Buscar precedentes no ejecuta ni garantiza esas operaciones.                    |

### Recorrido completo de esta funcionalidad

1. El emisor presenta una propuesta con datos del activo, oferta e inversores.
2. El administrador abre la propuesta y consulta el checklist existente.
3. La nueva sección solicita casos similares mediante el proxy autenticado.
4. El backend consulta decisiones almacenadas en Supabase, las puntúa y devuelve los mejores resultados con sus motivos.
5. El administrador contrasta los hechos actuales, las citas legales y las notas de otros revisores. El sistema no deduce automáticamente si debe aprobar.
6. La decisión y su nota se guardan mediante el endpoint de revisión existente.
7. En una búsqueda posterior, esa propuesta puede ser candidata si su estado es elegible; aparecerá entre los resultados solo si coincide y entra en el límite solicitado.

El ciclo reutiliza la misma persistencia de decisiones, sin entrenamiento ni un proceso adicional de indexación. «Aprender de cada decisión» significa disponer de más contexto guardado para la siguiente revisión: no cambian los pesos ni se actualiza un modelo.

La memoria consulta la última decisión disponible de cada propuesta. Si una propuesta cambia de estado, su elegibilidad para búsquedas también puede cambiar; no es un registro inmutable de todas sus revisiones.

## Repositorios, ramas y PRs

| Parte                              | Repositorio local                                           | Rama                         | Commit                                     | PR                                                                                   |
| ---------------------------------- | ----------------------------------------------------------- | ---------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------ |
| Backend NestJS + Supabase          | `/Users/villarley/Code/neko/neko-backend-hackmeridian`      | `codex/similar-review-cases` | `3a02d19ab4e4d8c025c80679ae695cee5534ebba` | [Backend #5](https://github.com/Neko-Protocol/neko-backend-hackmeridian/pull/5)      |
| Admin Next.js, dentro del monorepo | `/Users/villarley/Code/neko/neko-tokenization-hackmeridian` | `codex/similar-review-cases` | `de9c26c2f01856ed93813244696d41c4a35464a5` | [Admin #16](https://github.com/Neko-Protocol/neko-tokenization-hackmeridian/pull/16) |

Los commits anteriores fijan la implementación validada. La documentación añadida después no altera esos resultados ni permite asumir que un checkout local de `main` ya contiene los cambios.

## Backend implementado

Nuevo endpoint:

```http
GET /v1/launchpad/admin/applications/:id/similar?limit=5
Authorization: Bearer <admin-session-token>
```

Se añadió al controlador administrativo existente, con `AdminAuthGuard`, validación UUID y throttling de 60 peticiones por minuto. Conserva el requisito global de autenticación interna del backend; el proxy existente añade `X-Internal-Key`.

`SimilarApplicationsQueryDto` transforma y valida `limit`: entero de 1 a 20, con valor predeterminado 5.

`ApplicationsService.adminSimilar(id, limit)`:

1. Busca la propuesta objetivo; devuelve 404 con `APPLICATION_NOT_FOUND` si no existe.
2. Consulta propuestas con estado `approved`, `rejected` o `changes_requested`, excluyendo el ID objetivo.
3. Recorre las decisiones en páginas de 500 para evitar quedarse solo con la primera página de Supabase.
4. Puntúa cada candidata y descarta las de puntuación cero.
5. Ordena por puntuación descendente, fecha de revisión más reciente y, como desempate final, ID ascendente.
6. Devuelve hasta `limit` casos. El resumen cuenta únicamente los casos devueltos.

Los errores de base de datos se propagan como error 500 con `DB_ERROR`; no se convierten en un resultado vacío.

### Puntuación

| Coincidencia                                                              | Puntos |
| ------------------------------------------------------------------------- | -----: |
| Mismo `asset_type`                                                        |      3 |
| Mismo `offering_type`                                                     |      2 |
| Mismo `issuer_country`                                                    |      2 |
| `target_amount` entre 0,5 y 2 veces el objetivo, ambos extremos incluidos |      1 |
| Al menos un país inversor compartido                                      |      1 |
| Mismo `accepts_us_investors`, incluido `false`                            |      1 |
| Mismo `uses_mass_marketing`, incluido `false`                             |      1 |

Máximo: 11 puntos. Los importes numéricos recibidos como strings de Postgres se convierten a números.

La comparación de importes usa los valores nominales, tal como pedía el alcance original: no convierte divisas ni exige que coincida `currency`.

La puntuación mide coincidencias de campos, no riesgo, legalidad ni probabilidad de aprobación. Una coincidencia positiva puede ser débil: por ejemplo, compartir solo las dos políticas booleanas aporta dos puntos. No se ha calibrado el umbral con un conjunto etiquetado de relevancia.

### Contrato de respuesta

```ts
interface SimilarApplicationsResponse {
  summary: {
    approved: number;
    rejected: number;
    changes_requested: number;
  };
  cases: Array<{
    id: string;
    asset_name: string;
    asset_type: AssetType;
    issuer_country: string;
    offering_type: OfferingType;
    target_amount: number;
    currency: string;
    status: "approved" | "rejected" | "changes_requested";
    review_note: string | null;
    reviewed_at: string | null;
    score: number;
    matched: string[];
  }>;
}
```

`matched` contiene motivos legibles, como `same asset type`, `same country` o `overlapping investor countries`.

Un resumen de «2 aprobados, 1 rechazado» describe únicamente los tres casos recuperados. No representa la tasa de aprobación de toda la base ni significa que la nueva propuesta tenga una probabilidad de aprobación de dos tercios. El usuario puede abrir los casos y leer sus notas para entender las diferencias.

### Archivos del backend

Todos están dentro de `src/domains/launchpad/`:

- `application-similarity.ts`: función pura de puntuación.
- `applications.service.ts`: búsqueda, paginación, ranking y resumen.
- `applications.controller.ts`: nuevo endpoint administrativo.
- `launchpad.types.ts`: tipos de los casos y de la respuesta.
- `dto/similar-applications-query.dto.ts`: validación del límite.
- `application-similarity.spec.ts`: 19 pruebas.
- `applications-similar.spec.ts`: 7 pruebas del servicio.
- `applications-similar.controller.spec.ts`: 8 pruebas HTTP, incluida autenticación.
- `dto/similar-applications-query.dto.spec.ts`: 11 pruebas de validación.

## Admin implementado

Se añadió `SimilarCases` dentro de `CompliancePanel`, sin modificar las reglas legales existentes.

El componente llama a `getSimilarApplications(token, id)` mediante el proxy actual: `/api/backend-proxy/v1/launchpad/admin/applications/:id/similar?limit=5`.

Muestra:

- Resumen de resultados por decisión.
- Enlace a cada propuesta y badge de estado.
- Tipo de activo, país, tipo de oferta, importe y divisa.
- Fecha de revisión, nota del revisor y motivos de coincidencia.
- Texto alternativo cuando no existe una nota.
- Estados de carga, error con botón de reintento y resultado vacío.

El estado se identifica por propuesta, token de sesión e intento de carga. Al navegar a otra propuesta no aparecen los resultados de la anterior; las respuestas de solicitudes anteriores se ignoran tras limpiar el efecto.

Texto del estado vacío:

> No similar decided cases yet. Each review you make here is remembered for the next one.

### Archivos del admin

Dentro de `apps/admin/src/`:

- `features/compliance/SimilarCases.tsx`: nueva sección y estados de carga.
- `features/compliance/CompliancePanel.tsx`: integración de la sección.
- `lib/admin-api.ts`: llamada autenticada al endpoint.
- `lib/types.ts`: contrato tipado de resultados.

## Mapa de evidencia verificable

| Afirmación                                                          | Evidencia concreta                                                                                                                                                                |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La memoria procede de decisiones guardadas                          | `ApplicationsService.adminDecide` escribe el resultado; `adminSimilar` consulta la misma tabla y restringe los estados.                                                           |
| El ranking es explicable                                            | `scoreApplicationSimilarity` devuelve conjuntamente `score` y `matched`; los pesos están en el código y sus pruebas.                                                              |
| Un caso antiguo no se descarta por estar fuera de la primera página | `adminSimilar` usa páginas de 500; una prueba coloca el mejor caso después de los primeros 500 candidatos.                                                                        |
| Solo se accede con sesión administrativa                            | El controlador conserva `AdminAuthGuard`; las pruebas HTTP comprueban peticiones sin token y con un token no administrativo. La verificación de tokens se simula en esas pruebas. |
| El resumen no infla los resultados                                  | El servicio contabiliza los estados después de seleccionar el top solicitado; una prueba verifica ese comportamiento.                                                             |
| La UI distingue ausencia de resultados de un error                  | `SimilarCases` tiene estados separados para carga, éxito vacío, éxito con casos y error con reintento.                                                                            |
| La revisión sigue siendo humana                                     | La búsqueda devuelve contexto; no llama al endpoint de decisión. La decisión se registra mediante el panel existente.                                                             |

Los enlaces permanentes a cada archivo y suite están reunidos en [la guía de implementación](docs/review-memory.md#evidence-map). No se presupone que las ramas `main` de los tres repositorios tengan la misma versión.

## Validación realizada

### Backend

- `npm ci --ignore-scripts --no-audit --no-fund`: restauró las dependencias ya declaradas en el lockfile. No se modificaron `package.json` ni el lockfile.
- `npm run build`: pasa.
- Las 45 pruebas nuevas pasan.
- Suite completa: 47 suites pasan y 5 fallan; 472 tests pasan y 1 falla. Cuatro de las suites fallidas no llegan a ejecutar sus tests.
- Una copia sin cambios de `origin/main` reprodujo las mismas cinco suites fallidas: 43 suites correctas, 427 tests correctos y 1 test fallido.
- Prettier y `git diff --check`: pasan para los archivos modificados.
- `npm run lint`: no puede ejecutarse porque el repositorio no declara ni instala ESLint y no contiene configuración de ESLint.

Fallos previos reproducidos en `main`:

1. `config/cors-origins.spec.ts`: discrepancia en el texto esperado para un error.
2. `domains/platform/mailing/enrollment/mailing-enrollment.service.spec.ts`: referencia a un directorio hermano `web-app/supabase/migrations` inexistente en este checkout.
3. `domains/investing/vault-apy/vault-apy.service.spec.ts`: tipos incompatibles de `PoolV2` del Blend SDK.
4. `domains/market-data/pool-rates/pool-rates.service.spec.ts`: carga de una dependencia ESM en Jest.
5. `domains/market-data/pool-rates/pool-rates.controller.spec.ts`: el mismo problema de carga ESM.

Comandos útiles desde el backend:

```bash
npm run build
npm test -- --runInBand --testPathPattern='application-similarity|applications-similar|similar-applications-query'
npm test -- --runInBand
```

### Admin

Desde la raíz del monorepo:

```bash
npm run lint -- --filter=@neko-tokenization/admin
npx --no-install tsc --noEmit -p apps/admin/tsconfig.json
npm run build -- --filter=@neko-tokenization/admin
```

Los tres comandos pasan. El build requiere acceso de red para descargar las Google Fonts ya utilizadas por el proyecto.

También se verificó la aplicación compilada con Chrome y respuestas interceptadas exclusivamente en el navegador de prueba:

- Resultado vacío y envío del token al proxy.
- Resumen, badges de las tres decisiones, notas y motivos.
- Nota ausente.
- Error y reintento exitoso.
- Navegación a otra propuesta sin mostrar casos anteriores.
- Vista de escritorio y móvil de 390 px, sin desbordamiento horizontal ni errores de JavaScript.

El workspace del admin no tiene un script de tests automatizados. Estas comprobaciones de navegador se ejecutaron mediante un script temporal, no añadido al PR. Los fixtures nunca se guardaron en Supabase. Verifican la interfaz y las solicitudes bajo respuestas controladas; no sustituyen una ejecución de integración con los servicios desplegados y decisiones reales.

### Criterios de aceptación y cobertura

| Criterio                                                                    | Resultado registrado                     | Alcance de la evidencia                                                            |
| --------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------- |
| Recuperar solo propuestas elegibles y distintas del objetivo                | Verificado por tests del servicio        | Consulta simulada, sin modificar Supabase.                                         |
| Aplicar las siete señales y sus límites                                     | 19 tests de puntuación correctos         | Algoritmo determinista, no benchmark de relevancia.                                |
| Proteger la ruta y validar entradas                                         | Tests HTTP y DTO correctos               | Guard real con comprobación de token simulada; no auditoría de seguridad completa. |
| Representar resumen, notas, errores y navegación                            | Verificado en Chrome, escritorio y móvil | API interceptada; no integración de producción.                                    |
| Compilar ambas aplicaciones afectadas                                       | Ambos builds correctos                   | Evidencia de compilación, no de despliegue.                                        |
| Verificar el recorrido con un admin y casos reales en un entorno desplegado | Pendiente                                | No se ha afirmado ni fabricado este resultado.                                     |

## Límites y continuación

- El backend debe estar disponible antes de publicar el admin que consume el endpoint. Los PRs están enlazados entre sí.
- No hace falta una migración para esta funcionalidad: se utiliza la tabla existente.
- `review_note` y el estado reflejan la última decisión de cada propuesta; no existe un historial de decisiones separado.
- La búsqueda recorre las decisiones y puntúa en código. Para un volumen grande convendría revisar rendimiento e indexación.
- Las notas son contexto histórico: una aprobación anterior no acredita que una nueva oferta cumpla la normativa. La memoria tampoco configura restricciones de contratos ni registra decisiones on-chain.
- La integración desplegada sigue pendiente de una ejecución autorizada del recorrido navegador → proxy → backend → Supabase con decisiones reales.
- No se integró la búsqueda con el formulario o asistente de emisores de `src/domains/launchpad/assistant/`; estaba expresamente fuera del alcance de esta versión.
- No se modificaron la configuración de despliegue ni los checks legales existentes.
- Para cambios posteriores, conservar una rama por repositorio, PRs a `main`, commits convencionales y formato Prettier con comillas dobles, punto y coma, dos espacios y 80 columnas.
