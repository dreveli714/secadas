# Secadas

Caja compartida para las secadas de ropa: saldo, secadas con un toque, compras con foto del ticket, abonos de 20 € y estadísticas. Pensada para el móvil.

**Cómo está hecha** (igual que Transformación 70):

| Parte | Dónde vive | Archivos |
|---|---|---|
| La app | GitHub Pages | `index.html`, `manifest.json`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` |
| Los datos | Google Sheets (pestañas `movimientos` y `config`) | se crean solas |
| El servidor | Google Apps Script | `Code.gs` |
| Las fotos | Carpeta de Drive `Secadas - tickets` | se crea sola |
| Leer tickets con IA (opcional) | API de Anthropic, llamada desde el Apps Script | clave en las propiedades del script |

---

## 1. Hoja de Google y Apps Script

1. En Google Drive: **Nuevo → Hojas de cálculo**. Llámala `Secadas`.
2. **Extensiones → Apps Script**. Borra lo que haya en `Código.gs`, pega todo `Code.gs` y guarda.
3. Arriba elige la función **`setup`** y pulsa **Ejecutar**. Autoriza el acceso a Sheets y Drive. Si sale "Google no ha verificado esta aplicación": **Configuración avanzada → Ir a…**
4. En el **registro de ejecución** aparece el **PIN** de la app. Apúntalo.
5. Elige **`importarOctubre`** y pulsa **Ejecutar**. El registro debe decir `Importados 28 movimientos. Saldo: 14.52 €`.

Para cambiar el PIN: **⚙️ Configuración del proyecto → Propiedades del script → `APP_PIN`**.

## 2. Leer tickets con IA (opcional)

1. Entra en [console.anthropic.com](https://console.anthropic.com), carga saldo en **Billing** y crea una clave en **API keys**.
2. En Apps Script: **⚙️ Configuración del proyecto → Propiedades del script → Añadir propiedad**
   - Propiedad: `ANTHROPIC_API_KEY`
   - Valor: la clave
3. La clave va **solo** ahí. Nunca la pegues en `index.html`: esa página es pública.

Usa Claude Haiku 5.5 (0,10 $ por millón de tokens de entrada y 0,50 $ de salida), así que cada ticket cuesta menos de 0,1 céntimos. Sin clave la app funciona igual y el importe se escribe a mano.

## 3. Publicar el Apps Script

1. **Implementar → Nueva implementación → ⚙️ Aplicación web**.
2. **Ejecutar como:** Yo. **Quién tiene acceso:** Cualquier usuario.
3. **Implementar** y copia la URL (termina en `/exec`).

**Cuando cambies `Code.gs`:** Implementar → **Gestionar implementaciones** → ✏️ → Versión: **Nueva versión** → Implementar. Así la URL no cambia. Si creas una implementación nueva, la URL cambia y hay que actualizar `index.html`.

## 4. GitHub Pages

1. En GitHub: **New repository** → `secadas` (público).
2. **Add file → Upload files** y sube los 5 archivos de la app.
3. Edita `index.html` en GitHub (lápiz), busca `PEGA_AQUI_LA_URL_DE_TU_APPS_SCRIPT` y pega entre las comillas la URL `/exec`. Haz commit.
4. **Settings → Pages → Branch: `main` / root → Save**. En uno o dos minutos está en `https://dreveli714.github.io/secadas/`.

## 5. En los móviles

1. Abre el enlace, escribe tu nombre y el PIN. Solo se pide una vez en cada móvil.
2. Instálala como app:
   - **iPhone:** Safari → Compartir → **Añadir a pantalla de inicio**.
   - **Android:** Chrome → ⋮ → **Instalar app** o **Añadir a pantalla de inicio**.
3. Vuelve a poner las dos fotos de octubre (20 y 22): pestaña **Tickets → Añadir foto**.

---

## Datos

- Cada movimiento es una fila de `movimientos`. No cambies el orden de las columnas.
- `cent` está en céntimos: `-280` son −2,80 €, `2000` son +20,00 €. El saldo es la suma de esa columna.
- `tipo`: `secado`, `compra`, `abono` o `ajuste`. `por` es quién lo anotó.
- Se puede corregir a mano en la hoja; la app lo recoge en menos de un minuto.
- Las fotos se guardan en `Secadas - tickets`, compartidas con "cualquiera con el enlace" para que la app pueda mostrarlas.

## Seguridad

La URL `/exec` es pública: lo que protege los datos es el **PIN**. Compártelo solo con la persona que usa la caja. Si cambias el PIN, en cada móvil se vuelve a pedir.

## Si algo falla

| Lo que pasa | Qué revisar |
|---|---|
| "PIN incorrecto" | La propiedad `APP_PIN` del script |
| "Sin conexión con la caja" | La URL en `index.html` y que la implementación tenga acceso "Cualquier usuario" |
| No se ven las fotos | Que el archivo en Drive esté compartido con "Cualquier persona con el enlace" |
| Cambié `Code.gs` y no se nota | Falta publicar como **Nueva versión** |
| "La lectura automática no está activada" | Falta `ANTHROPIC_API_KEY` o no tiene saldo |
