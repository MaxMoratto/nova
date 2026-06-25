# Guía: trabajar `nova` desde dos estaciones con GitHub

Esta guía monta GitHub como "carpeta en la nube" para que **tú (código)** y el
**diseñador (imágenes)** trabajen sobre el mismo proyecto desde computadoras
distintas, sin pisarse el trabajo y con historial para volver atrás.

> **Por qué en tu máquina y no desde aquí:** Git necesita ejecutarse en tu
> computadora real (donde vive la carpeta). El asistente no puede correrlo sobre
> la carpeta montada. Por eso los comandos de abajo los corres tú.

---

## Paso 0 — Limpiar un `.git` que quedó a medias

Durante la preparación se creó un `.git` incompleto que hay que borrar antes de
empezar. En **PowerShell** (Windows), pega:

```powershell
Remove-Item -Recurse -Force "$env:USERPROFILE\3D Objects\nova\.git"
```

Si dice que no existe, perfecto: ya está limpio.

---

## Paso 1 — Instalar las herramientas (una sola vez por computadora)

**Tu estación (código):**
- Git: https://git-scm.com/download/win
- (Opcional pero recomendado) VS Code, que ya trae botones de Git.

**Estación del diseñador (imágenes):**
- **GitHub Desktop**: https://desktop.github.com/
  Es una app con botones, sin terminal. Ideal para alguien no técnico: solo
  arrastra imágenes a la carpeta, le da "Commit" y "Push".

Ambos necesitan una **cuenta de GitHub** (https://github.com). Crea tú la cuenta
del proyecto/empresa e invita al diseñador como colaborador (Paso 4).

---

## Paso 2 — Crear el repositorio en GitHub (lo haces tú, una vez)

1. Entra a https://github.com → botón **New** (nuevo repositorio).
2. Nombre: `nova` (o el que prefieras).
3. Visibilidad: **Private** (privado) mientras no quieras que sea público.
4. **No** marques "Add a README" ni ".gitignore" (ya tienes archivos locales).
5. Click en **Create repository**. GitHub te mostrará la URL del repo:
   `https://github.com/MaxMoratto/nova.git`

> ✅ **Ya lo hiciste.** Tu repo es `https://github.com/MaxMoratto/nova.git`.
>
> ⚠️ **Ojo:** lo creaste como **Public** (público). Cualquiera puede ver el
> código. Si es trabajo tuyo o de clientes, cámbialo a privado en
> **Settings → General → Change visibility → Make private**.

---

## Paso 3 — Subir tu carpeta `nova` por primera vez

En PowerShell, dentro de la carpeta del proyecto:

```powershell
cd "$env:USERPROFILE\3D Objects\nova"

git init
git add .
git commit -m "Primer commit: Nova Strike Series"
git branch -M main
git remote add origin https://github.com/MaxMoratto/nova.git
git push -u origin main
```

La primera vez Git te pedirá iniciar sesión en GitHub (se abre una ventana del
navegador). Inicia sesión ahí —**nunca escribas tu contraseña en la terminal**.

Listo: tu carpeta ya está en la nube.

> El archivo `.gitignore` ya está creado y excluye cosas que no deben subir
> (`nova-preview.html` generado, `.env` con secretos, `node_modules`, etc.).

---

## Paso 4 — Dar acceso al diseñador

1. En el repo en GitHub: **Settings → Collaborators → Add people**.
2. Agrega el usuario de GitHub del diseñador.
3. Él acepta la invitación por correo.
4. En **GitHub Desktop**, el diseñador hace **File → Clone repository**, elige
   `nova` y lo descarga a su computadora. Ya tiene la carpeta sincronizada.

---

## Paso 5 — El día a día (la rutina que evita problemas)

La regla de oro: **traer antes de empezar, subir al terminar.**

**Tú (código), en terminal:**
```powershell
git pull            # 1. trae lo último (ej. imágenes nuevas del diseñador)
# ...trabajas en el código...
git add .
git commit -m "Describe tu cambio"
git push            # 2. sube tu trabajo
```

**El diseñador (imágenes), en GitHub Desktop:**
1. Abre la app y pulsa **Pull origin** (trae lo último).
2. Copia/actualiza las imágenes en la carpeta (ej. dentro de `uploads/`).
3. Escribe un mensaje y pulsa **Commit to main**.
4. Pulsa **Push origin** (sube los cambios).

Como tú tocas archivos de código y él toca imágenes, casi nunca chocarán. Si
ambos editan el mismo archivo a la vez, Git avisará de un "conflicto"; cuando eso
pase, escríbeme y te guío para resolverlo.

---

## Conceptos rápidos (para cerrar la brecha técnica)

- **commit** = una foto guardada de tus cambios, con un mensaje. Es tu punto de
  retorno si algo se rompe.
- **push** = subir tus commits a GitHub (la nube).
- **pull** = bajar a tu máquina los commits que otros subieron.
- **origin** = el apodo de tu repo en GitHub.
- **main** = la rama principal (la versión "oficial" del proyecto).
- **.gitignore** = lista de archivos que Git ignora a propósito (temporales,
  secretos, dependencias).

---

## Bonus: conectar con Vercel cuando quieras publicar

Una vez `nova` esté en GitHub, en Vercel puedes hacer **Add New → Project →
Import** desde ese repo. A partir de ahí, **cada `git push` despliega solo**.
Avísame y lo configuramos juntos.
