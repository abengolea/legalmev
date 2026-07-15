# Entre Ríos — Mesa Virtual (exploración técnica)

URL de prueba: `https://mesavirtual.jusentrerios.gov.ar/expedientes/68ee62d8bfc4b60008b653a0`

## Stack

| Pieza | Valor |
|-------|--------|
| Frontend | Next.js (pages) + MUI + DevExtreme |
| API | GraphQL Apollo en `https://mesavirtual.jusentrerios.gov.ar/api/graphql` |
| Auth | Keycloak SSO `https://ol-sso.jusentrerios.gov.ar` — realm `mesavirtual`, client `mesa-virtual-ui` |
| Archivos | `GET /api/archivos/{expedienteId}/{movimientoId}?token={accessToken}` |

**Requiere login judicial.** Sin Bearer token, GraphQL responde `"Acceso no permitido"`.

## Rutas relevantes

- `/expedientes` — listado / búsqueda
- `/expedientes/[id]` — ficha del expediente (ID MongoDB 24 hex)
- `/expedientes/[id]/movi/[moviId]` — detalle de un movimiento

## Queries usadas por la extensión

```graphql
query expediente($id: String!) {
  expediente(id: $id) {
    id caratula organismo
    nro { exp0 exp1 exp2 exp3 }
    datos_organismo { nombre_organismo localidad jurisdiccion }
  }
}

query expedienteOnlyMovimientos($first: Int!, $skip: Int!, $expId: String!) {
  expedienteMovimientos(first: $first, skip: $skip, expId: $expId, orderBy: fecha_hora_DESC) {
    aggregate { count }
    edges {
      node {
        id fecha_hora fecha_procesal descripcion tipo publico fojas
        archivo { id tipo size texto }
        origen { nombre }
      }
    }
  }
}
```

El campo `archivo.texto` a menudo trae el texto ya extraído; si falta, se descarga el PDF.

## Flujo usuario

1. Iniciar sesión en Mesa Virtual Entre Ríos.
2. Abrir un expediente (`/expedientes/{id}`).
3. Abrir LegalMev y exportar.
