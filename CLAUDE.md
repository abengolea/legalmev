# LegalMev – Guía para IA

## Design Context

### Users
- **Quiénes**: Abogados, profesionales legales, secretarias jurídicas que usan MEV (Mesa de Entradas Virtual) y PJN (Poder Judicial de la Nación).
- **Contexto**: Trabajan con expedientes judiciales, necesitan exportarlos a PDF de forma ágil.
- **Tarea principal**: Exportar expedientes desde MEV/PJN a PDF usando la extensión Chrome, gestionar cuotas (free/premium), colegios con convenio.
- **Emociones objetivo**: Confianza, eficiencia, profesionalismo, claridad.

### Brand Personality
- **3 palabras**: Profesional, moderno, confiable.
- **Voz**: Directa, seria, sin ruido. Transmite seriedad y estabilidad propias del sector legal.
- **Anti-referencias**: Evitar look genérico, infantil o poco serio.

### Aesthetic Direction
- **Paleta** (del logo):
  - Teal oscuro `#2A6A78` (primary, sidebar, texto principal)
  - Teal claro `#54A6A8` (acentos, interactivos)
  - Fondo muy claro con matiz teal suave
- **Tipografía**: Inter (cuerpo), Poppins o similar para headlines. Sans-serif limpia y legible.
- **Referencias**: Logo con iniciales LM y martillo, estética geométrica y moderna.
- **Tema**: Solo light mode por defecto (dashboard aplica `.legalmev-rebrand`).

### Design Principles
1. **Identidad desde el logo**: Colores y tipografía derivados del logo.
2. **Profesionalismo legal**: Interfaz seria, ordenada, clara, sin elementos superfluos.
3. **Jerarquía visual clara**: Elementos importantes bien diferenciados, texto legible.
4. **Consistencia**: Usar tokens (`primary`, `accent`, `muted`) antes que colores hardcodeados.
5. **Accesibilidad**: Contraste adecuado, botones y estados claros.

### Tech Stack (para decisiones de diseño)
- Next.js 15, React, Tailwind, Radix UI, shadcn/ui
- Variables CSS en `globals.css`, tema rebrand en `.legalmev-rebrand`
