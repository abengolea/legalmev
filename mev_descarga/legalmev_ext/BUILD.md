# Build de la extensión LegalMev

## Producción (Chrome Web Store)

Usá `manifest.json` directamente. Ya está configurado para producción:

- **host_permissions**: Solo portales judiciales y legalmev.com.ar
- **content_scripts**: extension-connect solo en legalmev.com.ar
- **background.js**: Solo acepta `https://legalmev.com.ar` o `https://www.legalmev.com.ar` como apiBase

Para empaquetar:

1. Verificá que `manifest.json` sea el de producción (no lo reemplaces con manifest.dev.json).
2. En Chrome: `chrome://extensions` → "Empaquetar extensión" → elegí la carpeta `mev_exporter_ext`.
3. Subí el `.zip` generado al Chrome Web Store.

## Desarrollo local

Para probar contra localhost o Firebase:

1. Renombrá `manifest.json` → `manifest.prod.json` (backup).
2. Renombrá `manifest.dev.json` → `manifest.json`.
3. Cargá la extensión en Chrome desde esta carpeta.
4. Podés conectar contra `http://localhost:9003`, Firebase, etc.

Para volver a producción:

1. Renombrá `manifest.json` → `manifest.dev.json`.
2. Renombrá `manifest.prod.json` → `manifest.json`.

### Script opcional (PowerShell)

```powershell
# Cambiar a dev
Copy-Item manifest.json manifest.prod.json; Copy-Item manifest.dev.json manifest.json

# Volver a prod
Copy-Item manifest.json manifest.dev.json; Copy-Item manifest.prod.json manifest.json
```

## Checklist antes de publicar

- [ ] `manifest.json` es el de producción (sin localhost/Firebase en host_permissions).
- [ ] content_scripts: extension-connect solo en legalmev.com.ar.
- [ ] background.js con PROD_BASES activo.
- [ ] popup.js sin mensajes "npm run dev" ni "Verificá la URL en popup.js".
- [ ] Verificar que no haya eval/new Function/importScripts remoto en el código propio.
