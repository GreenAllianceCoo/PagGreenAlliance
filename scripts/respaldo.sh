#!/usr/bin/env bash
# =============================================================================
# Respaldo de la base de datos (y, opcionalmente, de Storage) de Green Alliance.
# Procedimiento completo: docs/entrega/respaldo-y-restauracion.md
#
# Uso (desde la raíz del repositorio, con el proyecto ya enlazado):
#   npx supabase link --project-ref <ref>        # una sola vez por equipo
#   bash scripts/respaldo.sh <destino> [--con-storage] [--con-codigo] [--motivo <texto>]
#
# Ejemplos:
#   bash scripts/respaldo.sh "D:/Respaldos Green Alliance" --motivo antes-migracion
#   bash scripts/respaldo.sh "D:/Respaldos Green Alliance" --con-storage --con-codigo --motivo mensual
#
# Crea <carpeta-destino>/<AAAA-MM-DD-HHMM>[-motivo]/ con:
#   roles.sql        roles del clúster          (supabase db dump --role-only)
#   esquema.sql      tablas, funciones, RLS     (supabase db dump)
#   datos.sql        datos, incluido auth.users (supabase db dump --data-only --use-copy)
#   storage/         fotos y logos              (solo con --con-storage)
#   codigo-main.zip  código de la rama main     (solo con --con-codigo)
#   LEEME.txt        fecha, proyecto, commit y sumas SHA-256
#
# Requiere Docker Desktop abierto: `supabase db dump` corre pg_dump en un contenedor.
# No guarda contraseñas ni llaves. La CLI pide la contraseña de la base si no
# la tiene en caché (o tomarla de la variable SUPABASE_DB_PASSWORD que el
# operador define en su propia terminal, nunca en este archivo).
#
# IMPORTANTE: el respaldo contiene datos personales (cédulas, correos, nómina,
# fotos de documentos). Guárdalo cifrado y solo en ubicaciones de la cooperativa.
# Nunca dentro del repositorio.
# =============================================================================
set -euo pipefail

uso() {
  sed -n '6,12p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
}

[[ $# -ge 1 ]] || uso
DESTINO_BASE="$1"; shift
CON_STORAGE=0
CON_CODIGO=0
MOTIVO=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --con-storage) CON_STORAGE=1; shift ;;
    --con-codigo) CON_CODIGO=1; shift ;;
    --motivo)
      [[ $# -ge 2 && -n "$2" ]] || { echo "ERROR: --motivo necesita un texto." >&2; uso; }
      MOTIVO="$2"; shift 2 ;;
    *) echo "Opción desconocida: $1" >&2; uso ;;
  esac
done

RAIZ_REPO="$(cd "$(dirname "$0")/.." && pwd)"

# Ruta absoluta del destino, relativa a donde se ejecutó el comando.
case "$DESTINO_BASE" in
  /*|[A-Za-z]:[/\\]*) DESTINO_ABS="$DESTINO_BASE" ;;
  *) DESTINO_ABS="$(pwd)/$DESTINO_BASE" ;;
esac
mkdir -p "$DESTINO_ABS"
DESTINO_ABS="$(cd "$DESTINO_ABS" && pwd)"

# El destino no puede quedar dentro del repositorio (se subiría a GitHub).
# En Windows las rutas no distinguen mayúsculas: se comparan en minúsculas.
DESTINO_MIN="$(printf '%s/' "$DESTINO_ABS" | tr '[:upper:]' '[:lower:]')"
RAIZ_MIN="$(printf '%s/' "$RAIZ_REPO" | tr '[:upper:]' '[:lower:]')"
case "$DESTINO_MIN" in
  "$RAIZ_MIN"*) echo "ERROR: la carpeta de destino está dentro del repositorio. Usa una carpeta externa." >&2; exit 1 ;;
esac
cd "$RAIZ_REPO"

if [[ ! -f supabase/.temp/project-ref ]]; then
  echo "ERROR: el proyecto no está enlazado. Ejecuta: npx supabase link --project-ref <ref>" >&2
  exit 1
fi
PROYECTO="$(cat supabase/.temp/project-ref)"

if ! docker info >/dev/null 2>&1; then
  echo "ERROR: Docker no está corriendo. Abre Docker Desktop (supabase db dump lo necesita) y vuelve a intentar." >&2
  exit 1
fi

SELLO="$(date +%Y-%m-%d-%H%M)"
MOTIVO_LIMPIO="$(printf '%s' "$MOTIVO" | tr -c 'A-Za-z0-9-' '-' | sed 's/^-*//; s/-*$//')"
if [[ -n "$MOTIVO_LIMPIO" ]]; then SELLO="$SELLO-$MOTIVO_LIMPIO"; fi
CARPETA="$DESTINO_ABS/$SELLO"
if [[ -e "$CARPETA" ]]; then
  echo "ERROR: ya existe $CARPETA" >&2
  exit 1
fi
mkdir -p "$CARPETA"

echo "Respaldo del proyecto $PROYECTO en $CARPETA"

echo "1/3 Roles..."
npx supabase db dump --linked --role-only -f "$CARPETA/roles.sql"
echo "2/3 Esquema..."
npx supabase db dump --linked -f "$CARPETA/esquema.sql"
echo "3/3 Datos..."
npx supabase db dump --linked --data-only --use-copy -f "$CARPETA/datos.sql"

if [[ $CON_STORAGE -eq 1 ]]; then
  for BUCKET in afiliacion-documentos convenios-logos; do
    echo "Storage: $BUCKET..."
    mkdir -p "$CARPETA/storage/$BUCKET"
    npx supabase storage cp -r "ss:///$BUCKET" "$CARPETA/storage/$BUCKET" --linked --experimental \
      || echo "AVISO: no se pudo copiar el bucket $BUCKET; descárgalo desde el panel de Supabase (ver el procedimiento)." >&2
  done
fi

if [[ $CON_CODIGO -eq 1 ]]; then
  echo "Código: rama main..."
  git fetch --quiet origin main 2>/dev/null || echo "AVISO: no se pudo actualizar origin/main; se usa la copia local." >&2
  if git rev-parse --verify --quiet origin/main >/dev/null; then REF_CODIGO=origin/main; else REF_CODIGO=main; fi
  git archive --format=zip -o "$CARPETA/codigo-main.zip" "$REF_CODIGO"
fi

# Un respaldo vacío es peor que ninguno: verificar tamaños mínimos.
for ARCHIVO in roles.sql esquema.sql datos.sql; do
  if [[ ! -s "$CARPETA/$ARCHIVO" ]]; then
    echo "ERROR: $ARCHIVO quedó vacío. El respaldo NO es válido." >&2
    exit 1
  fi
done
grep -q "CREATE TABLE" "$CARPETA/esquema.sql" || { echo "ERROR: esquema.sql no tiene tablas." >&2; exit 1; }

{
  echo "Respaldo Green Alliance"
  echo "Fecha:     $(date '+%Y-%m-%d %H:%M:%S %z')"
  echo "Proyecto:  $PROYECTO"
  echo "Commit:    $(git rev-parse --short HEAD 2>/dev/null || echo 'desconocido')"
  echo "Última migración en el repositorio (no necesariamente aplicada): $(ls supabase/migrations | tail -1)"
  echo "Storage:   $([[ $CON_STORAGE -eq 1 ]] && echo 'incluido' || echo 'NO incluido')"
  echo "Código:    $([[ $CON_CODIGO -eq 1 ]] && echo "incluido ($REF_CODIGO @ $(git rev-parse --short "$REF_CODIGO"))" || echo 'NO incluido')"
  echo
  echo "SHA-256:"
  (cd "$CARPETA" && find . -type f ! -name LEEME.txt -print0 | sort -z | xargs -0 sha256sum)
} > "$CARPETA/LEEME.txt"

echo
echo "Listo: $CARPETA"
du -sh "$CARPETA" 2>/dev/null || true
echo "Siguiente paso: comprimir con contraseña (p. ej. 7-Zip, AES-256) y copiar a las DOS ubicaciones de la cooperativa."
