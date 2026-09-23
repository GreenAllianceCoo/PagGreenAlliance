"""Genera docs/avances/Avances_Green_Alliance.xlsx a partir de docs/avances/plan.json.

plan.json es la única fuente de verdad: el supervisor (ga-supervisor-avances) edita el JSON
y vuelve a correr este script. No edites el Excel a mano: se sobrescribe.

Uso (Python con openpyxl; en este equipo vive en WSL):
    python3 docs/avances/generar_excel.py

Modelo del plan: 2 filas de trabajo (dos servidores) que toman tareas de una cola de
capacidad infinita. Una tarea entra a la cola cuando terminan sus dependencias y sale
cuando una fila queda libre; si hay varias en espera, sale primero la de mayor ruta
crítica restante (la que más retrasa el final si espera). Lo ya hecho se ubica antes
de la marca HOY; lo pendiente empieza desde HOY.
"""

import json
import random
from pathlib import Path

from openpyxl import Workbook
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter as col
from openpyxl.worksheet.datavalidation import DataValidation

AQUI = Path(__file__).resolve().parent
PLAN = AQUI / "plan.json"
SALIDA = AQUI / "Avances_Green_Alliance.xlsx"

VERDE, NAVY = "1E6652", "1A3C57"
VERDE_CLARO = "E3EFEA"
HECHO_BAR, BLOQ_BAR, AB_BAR = "9DBFB3", "E0A43A", "7B5EA7"
FUENTE = "Arial"
ESTADOS = ["Hecho", "En curso", "Pendiente", "Bloqueado"]
FILAS = ["A", "B"]

f_normal = Font(name=FUENTE, size=10)
f_negrita = Font(name=FUENTE, size=10, bold=True)
f_titulo = Font(name=FUENTE, size=16, bold=True, color=NAVY)
f_sub = Font(name=FUENTE, size=10, italic=True, color="555555")
f_head = Font(name=FUENTE, size=10, bold=True, color="FFFFFF")
f_input = Font(name=FUENTE, size=10, color="0000FF")
f_link = Font(name=FUENTE, size=10, color="008000")
fill_head = PatternFill("solid", fgColor=NAVY)
fill_fase = PatternFill("solid", fgColor=VERDE_CLARO)
fill_input = PatternFill("solid", fgColor="FFF6CC")
fino = Side(style="thin", color="D0D7D3")
borde = Border(left=fino, right=fino, top=fino, bottom=fino)
envolver = Alignment(wrap_text=True, vertical="top")
centro = Alignment(horizontal="center", vertical="center")


# ---------------------------------------------------------------- optimizador

def programar(tareas):
    por_id = {t["id"]: t for t in tareas}
    hijos = {t["id"]: [] for t in tareas}
    for t in tareas:
        for d in t["depende"]:
            hijos[d].append(t["id"])

    memo = {}

    def ruta_critica(i):  # bloques desde el inicio de i hasta el final del proyecto
        if i not in memo:
            memo[i] = por_id[i]["peso"] + max((ruta_critica(h) for h in hijos[i]), default=0)
        return memo[i]

    orden_id = {t["id"]: n for n, t in enumerate(tareas)}

    def ubicar(grupo, desde, clave):
        """Saca de la cola, en orden de `clave`, la tarea lista de mayor prioridad y la pone en el
        primer hueco libre de una fila (puede usar huecos que dejaron tareas anteriores)."""
        ocupado = {f: [] for f in FILAS}  # intervalos (inicio, fin) de cada fila

        def libre_en(f, t, d):
            for a, b in sorted(ocupado[f]):
                if t + d <= a:
                    break
                t = max(t, b)
            return t

        fin, resultado = {}, {}
        pendientes = set(grupo)
        while pendientes:
            elegibles = [i for i in pendientes if all(d in fin or d not in grupo for d in por_id[i]["depende"])]
            if not elegibles:
                raise ValueError(f"Dependencias circulares en: {sorted(pendientes)}")
            i = max(elegibles, key=lambda i: (clave[i], -orden_id[i]))
            d = por_id[i]["peso"]
            listo = max([desde] + [fin[x] for x in por_id[i]["depende"] if x in grupo])
            if por_id[i].get("simultanea", True) is False:
                t = listo
                while True:  # necesita las dos filas libres a la vez
                    t2 = max(libre_en(f, t, d) for f in FILAS)
                    if t2 == t:
                        break
                    t = t2
                fila = "A+B"
                for f in FILAS:
                    ocupado[f].append((t, t + d))
            else:
                fila, t = min(((f, libre_en(f, listo, d)) for f in FILAS), key=lambda x: (x[1], x[0]))
                ocupado[fila].append((t, t + d))
            fin[i] = t + d
            resultado[i] = {"fila": fila, "listo": listo, "inicio": t, "fin": t + d, "prioridad": ruta_critica(i)}
            pendientes.discard(i)
        return resultado, max([desde] + list(fin.values()))

    def correr(grupo, desde):
        # 1.º intento: prioridad pura por ruta crítica. Luego se prueban órdenes vecinos de la
        # cola (ruido aleatorio con semilla fija, siempre el mismo resultado) y se guarda el mejor:
        # menor duración total y, a igualdad, menos espera acumulada en la cola.
        rnd = random.Random(2026)
        base = {i: ruta_critica(i) for i in grupo}
        mejor = None
        for intento in range(4000):
            clave = base if intento == 0 else {i: base[i] + rnd.uniform(-3, 3) for i in grupo}
            res, total = ubicar(grupo, desde, clave)
            nota = (total, sum(p["fin"] for p in res.values()), sum(p["inicio"] - p["listo"] for p in res.values()))
            if mejor is None or nota < mejor[0]:
                mejor = (nota, res, total)
        return mejor[1], mejor[2]

    hechas = [t["id"] for t in tareas if t["estado"] == "Hecho"]
    resto = [t["id"] for t in tareas if t["estado"] != "Hecho"]
    for i in hechas:
        malas = [d for d in por_id[i]["depende"] if d in resto]
        if malas:
            raise ValueError(f"La tarea hecha {i} depende de tareas sin terminar: {malas}")
    prog_hecho, hoy = correr(hechas, 0)
    prog_resto, _ = correr(resto, hoy)
    prog = {**prog_hecho, **prog_resto}

    for i, p in prog.items():  # tareas que de verdad comparten tiempo en el plan optimizado
        p["paralelo"] = [j for j, q in prog.items()
                         if j != i and q["inicio"] < p["fin"] and p["inicio"] < q["fin"]]
    return prog, hoy


# ---------------------------------------------------------------- utilidades

def encabezado(ws, fila, textos, anchos=None):
    for c, texto in enumerate(textos, 1):
        celda = ws.cell(fila, c, texto)
        celda.font, celda.fill, celda.border = f_head, fill_head, borde
        celda.alignment = Alignment(wrap_text=True, vertical="center", horizontal="center")
    if anchos:
        for c, a in enumerate(anchos, 1):
            ws.column_dimensions[col(c)].width = a


def titulo(ws, texto, sub):
    ws["A1"] = texto
    ws["A1"].font = f_titulo
    ws["A2"] = sub
    ws["A2"].font = f_sub
    ws.sheet_view.showGridLines = False


def celda(ws, fila, c, valor, fuente=f_normal, fmt=None, alin=None):
    x = ws.cell(fila, c, valor)
    x.font, x.border = fuente, borde
    x.alignment = alin or Alignment(vertical="top", wrap_text=isinstance(valor, str) and len(valor) > 25)
    if fmt:
        x.number_format = fmt
    return x


def colorear_estado(ws, rango, col_estado):
    colores = {"Hecho": ("D7EBDD", "1E6652"), "En curso": ("DCE8F5", NAVY),
               "Pendiente": ("F2F2F2", "444444"), "Bloqueado": ("FBE6C8", "8A5300")}
    for estado, (fondo, texto) in colores.items():
        ws.conditional_formatting.add(rango, FormulaRule(
            formula=[f'${col_estado}{rango.split(":")[0][1:]}="{estado}"'],
            fill=PatternFill("solid", bgColor=fondo), font=Font(color=texto, bold=True)))


# ---------------------------------------------------------------- libro

def generar():
    datos = json.loads(PLAN.read_text(encoding="utf-8"))
    tareas, pendientes, fases = datos["tareas"], datos["pendientes"], datos["fases"]
    prog, hoy = programar(tareas)
    nombre_fase = {f["n"]: f["nombre"] for f in fases}

    wb = Workbook()
    ws_res = wb.active
    ws_res.title = "Resumen"
    ws_pen = wb.create_sheet("Pendientes")
    ws_plan = wb.create_sheet("Plan")
    ws_gan = wb.create_sheet("Gantt")
    ws_cola = wb.create_sheet("Cola")
    ws_prop = wb.create_sheet("Propuesta original")
    ws_pes = wb.create_sheet("Pesos")
    ws_bit = wb.create_sheet("Bitácora")

    # ------------------------------------------------ Plan (tabla)
    titulo(ws_plan, "Plan optimizado — tabla de actividades",
           "Inicio, Listo y Fila los calcula el optimizador (2 filas, cola infinita). Si cambias pesos o "
           "dependencias, pide a ga-supervisor-avances que regenere el libro.")
    cab = ["ID", "Fase", "Actividad", "Peso (1–5)", "Duración (bloques)", "Depende de",
           "¿Simultánea con otras?", "En paralelo con", "Fila", "Entra a la cola (bloque)",
           "Inicio (bloque)", "Fin (bloque)", "Espera en cola", "Semanas", "Estado", "Origen",
           "Agente / responsable", "Bloqueo externo"]
    encabezado(ws_plan, 4, cab, [6, 22, 52, 9, 10, 14, 12, 22, 7, 11, 9, 9, 9, 10, 11, 11, 26, 34])
    ws_plan.row_dimensions[4].height = 42
    P0 = 5
    PN = P0 + len(tareas) - 1
    for n, t in enumerate(tareas):
        r = P0 + n
        p = prog[t["id"]]
        celda(ws_plan, r, 1, t["id"], f_negrita)
        celda(ws_plan, r, 2, f'{t["fase"]}. {nombre_fase[t["fase"]]}')
        celda(ws_plan, r, 3, t["actividad"], alin=envolver)
        x = celda(ws_plan, r, 4, t["peso"], f_input, alin=centro)
        x.fill = fill_input
        celda(ws_plan, r, 5, f"=D{r}", alin=centro)
        celda(ws_plan, r, 6, ", ".join(t["depende"]) or "—")
        exclusiva = t.get("simultanea", True) is False
        celda(ws_plan, r, 7, "No (usa las 2 filas)" if exclusiva else ("Sí" if p["paralelo"] else "Sí (sin par en el plan)"),
              alin=envolver)
        celda(ws_plan, r, 8, ", ".join(p["paralelo"]) or "—", alin=envolver)
        celda(ws_plan, r, 9, p["fila"], f_negrita, alin=centro)
        celda(ws_plan, r, 10, p["listo"], alin=centro)
        celda(ws_plan, r, 11, p["inicio"], alin=centro)
        celda(ws_plan, r, 12, f"=K{r}+E{r}", alin=centro)
        celda(ws_plan, r, 13, f"=K{r}-J{r}", alin=centro)
        celda(ws_plan, r, 14, f'="S"&(INT(K{r}/Resumen!$C$5)+1)&"–S"&MAX(INT(K{r}/Resumen!$C$5)+1,ROUNDUP(L{r}/Resumen!$C$5,0))',
              alin=centro)
        celda(ws_plan, r, 15, t["estado"], alin=centro)
        celda(ws_plan, r, 16, t["origen"], alin=centro)
        celda(ws_plan, r, 17, t["agente"], alin=envolver)
        celda(ws_plan, r, 18, t.get("bloqueo", ""), alin=envolver)
    colorear_estado(ws_plan, f"O{P0}:O{PN}", "O")
    dv = DataValidation(type="list", formula1='"' + ",".join(ESTADOS) + '"', allow_blank=False)
    ws_plan.add_data_validation(dv)
    dv.add(f"O{P0}:O{PN}")
    ws_plan.freeze_panes = f"D{P0}"
    ws_plan.auto_filter.ref = f"A4:R{PN}"
    nota = PN + 2
    ws_plan.cell(nota, 1, "Notas").font = f_negrita
    for k, texto in enumerate([
        "Peso (azul, fondo amarillo) = dato de entrada; 1 punto de peso = 1 bloque de tiempo (ver hoja Pesos).",
        "«Origen: Agregado» = actividad que no estaba en la propuesta del 31-ago (p. ej. ingreso con código, afiliación, importación).",
        "«En paralelo con» lista las tareas que comparten tiempo con esta en el plan optimizado.",
        "Espera en cola = bloques entre que la tarea queda lista y una fila la toma.",
    ]):
        ws_plan.cell(nota + 1 + k, 1, texto).font = f_sub

    rng = lambda c: f"Plan!${c}${P0}:${c}${PN}"  # noqa: E731

    # ------------------------------------------------ Resumen
    titulo(ws_res, "Green Alliance — tablero de avances",
           f"Actualizado: {datos['parametros']['actualizado']}. Lo mantiene el agente ga-supervisor-avances "
           "a partir de docs/avances/plan.json.")
    ws_res.column_dimensions["A"].width = 3
    ws_res.column_dimensions["B"].width = 40
    for c in "CDEFGH":
        ws_res.column_dimensions[c].width = 34 if c == "E" else 15
    ws_res["B4"] = "Parámetros"
    ws_res["B4"].font = f_negrita
    celda(ws_res, 5, 2, "Bloques por semana")
    x = celda(ws_res, 5, 3, datos["parametros"]["bloques_por_semana"], f_input, alin=centro)
    x.fill = fill_input
    celda(ws_res, 5, 4, datos["parametros"]["nota_bloque"], f_sub, alin=Alignment(vertical="center"))
    celda(ws_res, 6, 2, "HOY (bloque donde termina lo hecho)")
    celda(ws_res, 6, 3, hoy, alin=centro)
    celda(ws_res, 6, 4, "Calculado por el optimizador.", f_sub, alin=Alignment(vertical="center"))

    ws_res["B8"] = "Indicadores"
    ws_res["B8"].font = f_negrita
    kpis = [
        ("Actividades en el plan", f"=COUNTA({rng('A')})", "0"),
        ("Hechas", f'=COUNTIF({rng("O")},"Hecho")', "0"),
        ("En curso", f'=COUNTIF({rng("O")},"En curso")', "0"),
        ("Pendientes", f'=COUNTIF({rng("O")},"Pendiente")', "0"),
        ("Bloqueadas (esperan a la cooperativa)", f'=COUNTIF({rng("O")},"Bloqueado")', "0"),
        ("Peso total (puntos)", f"=SUM({rng('D')})", "0"),
        ("Peso hecho (puntos)", f'=SUMIF({rng("O")},"Hecho",{rng("D")})', "0"),
        ("Avance ponderado por peso", "=IF(C14=0,0,C15/C14)", "0.0%"),
        ("Duración total optimizada (bloques)", f"=MAX({rng('L')})", "0"),
        ("Duración total optimizada (semanas)", "=C17/C5", "0.0"),
        ("Si se hiciera en una sola fila (bloques)", "=C14", "0"),
        ("Si se hiciera en una sola fila (semanas)", "=C19/C5", "0.0"),
        ("Tiempo ahorrado con 2 filas", "=IF(C19=0,0,1-C17/C19)", "0.0%"),
        ("Falta desde HOY (semanas)", "=(C17-C6)/C5", "0.0"),
        ("Uso de la Fila A", f'=IF(C17=0,0,(SUMIF({rng("I")},"A",{rng("E")})+SUMIF({rng("I")},"A+B",{rng("E")}))/C17)', "0%"),
        ("Uso de la Fila B", f'=IF(C17=0,0,(SUMIF({rng("I")},"B",{rng("E")})+SUMIF({rng("I")},"A+B",{rng("E")}))/C17)', "0%"),
        ("Plazo de la propuesta (semanas)", "=MAX('Propuesta original'!E5:E10)", "0"),
    ]
    for k, (etq, formula, fmt) in enumerate(kpis):
        r = 9 + k
        celda(ws_res, r, 2, etq)
        celda(ws_res, r, 3, formula, f_negrita, fmt, centro)

    # Avance por fase
    r0 = 9 + len(kpis) + 1
    ws_res.cell(r0, 2, "Avance por fase").font = f_negrita
    encabezado(ws_res, r0 + 1, ["", "Fase", "Peso total", "Peso hecho", "Avance", "Termina (bloque)",
                                 "Termina (semana)", "Propuesta (semanas)"])
    ws_res.cell(r0 + 1, 1).fill = PatternFill()
    ws_res.cell(r0 + 1, 1).border = Border()
    fila_fase = {}
    for k, f in enumerate(fases):
        r = r0 + 2 + k
        fila_fase[f["n"]] = r
        clave = f'"{f["n"]}. {f["nombre"]}"'
        celda(ws_res, r, 2, f'{f["n"]}. {f["nombre"]}')
        celda(ws_res, r, 3, f'=SUMIF({rng("B")},{clave},{rng("D")})', fmt="0", alin=centro)
        celda(ws_res, r, 4, f'=SUMIFS({rng("D")},{rng("B")},{clave},{rng("O")},"Hecho")', fmt="0", alin=centro)
        celda(ws_res, r, 5, f"=IF(C{r}=0,0,D{r}/C{r})", f_negrita, "0%", centro)
        celda(ws_res, r, 6, f'=SUMPRODUCT(MAX(({rng("B")}={clave})*{rng("L")}))', fmt="0", alin=centro)
        celda(ws_res, r, 7, f'="S"&ROUNDUP(F{r}/$C$5,0)', alin=centro)
        celda(ws_res, r, 8, f"='Propuesta original'!E{5 + k}", f_link, alin=centro)
    rf = r0 + 2 + len(fases) - 1
    ws_res.conditional_formatting.add(f"E{r0 + 2}:E{rf}", FormulaRule(
        formula=[f"E{r0 + 2}=1"], fill=PatternFill("solid", bgColor="D7EBDD")))

    # Hitos de pago
    r1 = rf + 2
    ws_res.cell(r1, 2, "Hitos de pago (propuesta)").font = f_negrita
    encabezado(ws_res, r1 + 1, ["", "Pago", "Valor (COP)", "Fase", "Se libera en", "Bloque", "Semana", "Estado del hito"])
    ws_res.cell(r1 + 1, 1).fill = PatternFill()
    ws_res.cell(r1 + 1, 1).border = Border()
    for k, pg in enumerate(datos["pagos"]):
        r = r1 + 2 + k
        rfz = fila_fase[pg["fase"]]
        es_adelanto = k == 0
        celda(ws_res, r, 2, pg["pago"])
        celda(ws_res, r, 3, pg["valor"], f_input, "$#,##0", centro)
        celda(ws_res, r, 4, pg["fase"], alin=centro)
        celda(ws_res, r, 5, pg["cuando"], alin=envolver)
        celda(ws_res, r, 6, 0 if es_adelanto else f"=F{rfz}", fmt="0", alin=centro)
        celda(ws_res, r, 7, "S1" if es_adelanto else f"=G{rfz}", alin=centro)
        celda(ws_res, r, 8, '="Cumplido (inicio)"' if es_adelanto else
              f'=IF(E{rfz}=1,"Cumplido","Falta "&TEXT(1-E{rfz},"0%"))', f_negrita, alin=centro)
    rp = r1 + 2 + len(datos["pagos"])
    celda(ws_res, rp, 2, "Total", f_negrita)
    celda(ws_res, rp, 3, f"=SUM(C{r1 + 2}:C{rp - 1})", f_negrita, "$#,##0", centro)

    # Pendientes por categoría
    r2 = rp + 2
    ws_res.cell(r2, 2, "Pendientes por categoría (hoja Pendientes)").font = f_negrita
    encabezado(ws_res, r2 + 1, [""] + ["Categoría"] + ESTADOS + ["Total"])
    ws_res.cell(r2 + 1, 1).fill = PatternFill()
    ws_res.cell(r2 + 1, 1).border = Border()
    categorias = list(dict.fromkeys(p["categoria"] for p in pendientes))
    Q0, QN = 5, 5 + len(pendientes) - 1
    for k, cat in enumerate(categorias):
        r = r2 + 2 + k
        celda(ws_res, r, 2, cat)
        for j, est in enumerate(ESTADOS):
            celda(ws_res, r, 3 + j, f'=COUNTIFS(Pendientes!$B${Q0}:$B${QN},$B{r},Pendientes!$G${Q0}:$G${QN},"{est}")',
                  fmt="0", alin=centro)
        celda(ws_res, r, 7, f"=SUM(C{r}:F{r})", f_negrita, "0", centro)

    # ------------------------------------------------ Pendientes
    titulo(ws_pen, "Pendientes organizados",
           "Ordenados por categoría, estado y prioridad. «Actividad del plan» enlaza con la hoja Plan / Gantt.")
    encabezado(ws_pen, 4, ["ID", "Categoría", "Área / pantalla", "Tarea", "Responsable", "Prioridad", "Estado",
                           "Actividad del plan", "Fase de la actividad", "Nota"],
               [7, 20, 16, 56, 24, 10, 11, 10, 26, 46])
    orden_est = {"Bloqueado": 0, "En curso": 1, "Pendiente": 2, "Hecho": 3}
    orden_pri = {"Alta": 0, "Media": 1, "Baja": 2}
    orden_cat = {c: n for n, c in enumerate(["Configuración", "Funcionalidad", "Dato de la cooperativa",
                                             "Verificación y cierre", "Decisión"])}
    lista = sorted(pendientes, key=lambda p: (orden_cat.get(p["categoria"], 9), orden_est[p["estado"]],
                                              orden_pri[p["prioridad"]], p["id"]))
    for n, p in enumerate(lista):
        r = Q0 + n
        celda(ws_pen, r, 1, p["id"], f_negrita)
        celda(ws_pen, r, 2, p["categoria"])
        celda(ws_pen, r, 3, p["area"])
        celda(ws_pen, r, 4, p["tarea"], alin=envolver)
        celda(ws_pen, r, 5, p["responsable"], alin=envolver)
        celda(ws_pen, r, 6, p["prioridad"], alin=centro)
        celda(ws_pen, r, 7, p["estado"], alin=centro)
        celda(ws_pen, r, 8, p["gantt"] or "—", alin=centro)
        celda(ws_pen, r, 9, f'=IFERROR(INDEX({rng("B")},MATCH(H{r},{rng("A")},0)),"—")', f_link)
        celda(ws_pen, r, 10, p["nota"], alin=envolver)
    colorear_estado(ws_pen, f"G{Q0}:G{QN}", "G")
    for pri, color in {"Alta": "B3261E", "Media": "8A5300", "Baja": "666666"}.items():
        ws_pen.conditional_formatting.add(f"F{Q0}:F{QN}", FormulaRule(
            formula=[f'$F{Q0}="{pri}"'], font=Font(color=color, bold=True)))
    ws_pen.conditional_formatting.add(f"A{Q0}:F{QN}", FormulaRule(
        formula=[f'$G{Q0}="Hecho"'], font=Font(color="8A8A8A", strike=True)))
    dv2 = DataValidation(type="list", formula1='"' + ",".join(ESTADOS) + '"')
    dv3 = DataValidation(type="list", formula1='"Alta,Media,Baja"')
    ws_pen.add_data_validation(dv2)
    ws_pen.add_data_validation(dv3)
    dv2.add(f"G{Q0}:G{QN}")
    dv3.add(f"F{Q0}:F{QN}")
    ws_pen.freeze_panes = f"B{Q0}"
    ws_pen.auto_filter.ref = f"A4:J{QN}"

    # ------------------------------------------------ Gantt
    bps = datos["parametros"]["bloques_por_semana"]
    total = max(p["fin"] for p in prog.values())
    ncols = -(-total // bps) * bps  # redondeado a semanas completas
    G0 = 8  # primera columna de bloques (H)
    titulo(ws_gan, "Diagrama de Gantt optimizado — 2 filas, cola infinita",
           "El número al inicio de cada barra es el peso (1–5). Verde = Fila A, azul = Fila B, morado = usa las 2 filas, "
           "gris verdoso = hecho, ámbar = bloqueado por la cooperativa. Columna roja = HOY.")
    for c, (t, a) in enumerate([("ID", 6), ("Actividad", 44), ("Peso", 6), ("Fila", 5), ("Inicio", 6),
                                ("Fin", 6), ("Estado", 10)], 1):
        ws_gan.column_dimensions[col(c)].width = a
    for b in range(1, ncols + 1):
        ws_gan.column_dimensions[col(G0 + b - 1)].width = 3.2
    # fila 4: semanas; fila 5: bloques
    for s in range(ncols // bps):
        c1, c2 = G0 + s * bps, G0 + (s + 1) * bps - 1
        ws_gan.merge_cells(start_row=4, start_column=c1, end_row=4, end_column=c2)
        x = ws_gan.cell(4, c1, f"Semana {s + 1}")
        x.font, x.fill, x.alignment = f_head, fill_head, centro
    encabezado_g = ["ID", "Actividad", "Peso", "Fila", "Inicio", "Fin", "Estado"]
    for c, t in enumerate(encabezado_g, 1):
        x = ws_gan.cell(5, c, t)
        x.font, x.fill, x.alignment, x.border = f_head, fill_head, centro, borde
    for b in range(1, ncols + 1):
        x = ws_gan.cell(5, G0 + b - 1, b)
        x.font = Font(name=FUENTE, size=7, color="FFFFFF")
        x.fill, x.alignment = PatternFill("solid", fgColor=VERDE), centro

    # filas 6 y 7: ocupación de cada fila de trabajo (qué tarea hay en cada bloque)
    for k, fila in enumerate(FILAS):
        r = 6 + k
        ws_gan.merge_cells(start_row=r, start_column=1, end_row=r, end_column=7)
        x = ws_gan.cell(r, 1, f"Fila {fila} — tarea en curso")
        x.font, x.fill, x.alignment = f_head, PatternFill("solid", fgColor=VERDE if fila == "A" else NAVY), centro
        for b in range(1, ncols + 1):
            L = col(G0 + b - 1)
            cond = (f'((Plan!$I${P0}:$I${PN}="{fila}")+(Plan!$I${P0}:$I${PN}="A+B"))'
                    f'*(Plan!$K${P0}:$K${PN}<{L}$5)*(Plan!$L${P0}:$L${PN}>={L}$5)')
            formula = (f'=IF(SUMPRODUCT({cond})=0,"",INDEX(Plan!$A${P0}:$A${PN},'
                       f'SUMPRODUCT({cond}*(ROW(Plan!$A${P0}:$A${PN})-{P0 - 1}))))')
            x = ws_gan.cell(r, G0 + b - 1, formula)
            x.font = Font(name=FUENTE, size=6, color="FFFFFF")
            x.alignment = Alignment(horizontal="center", vertical="center", text_rotation=90)
            x.border = borde
        ws_gan.row_dimensions[r].height = 26
    ult = col(G0 + ncols - 1)
    for k, fila in enumerate(FILAS):
        r = 6 + k
        ws_gan.conditional_formatting.add(f"{col(G0)}{r}:{ult}{r}", FormulaRule(
            formula=[f'{col(G0)}{r}<>""'], fill=PatternFill("solid", bgColor=VERDE if fila == "A" else NAVY)))

    # tareas agrupadas por fase
    r = 9
    filas_tarea = []
    fila_plan = {t["id"]: P0 + n for n, t in enumerate(tareas)}
    for f in fases:
        clave = f'"{f["n"]}. {f["nombre"]}"'
        ws_gan.merge_cells(start_row=r, start_column=1, end_row=r, end_column=4)
        x = ws_gan.cell(r, 1, f'Fase {f["n"]}. {f["nombre"]}')
        x.font = Font(name=FUENTE, size=10, bold=True, color=NAVY)
        for c in range(1, 8):
            ws_gan.cell(r, c).fill = fill_fase
        ws_gan.cell(r, 5, f'=SUMPRODUCT(MIN(({rng("B")}={clave})*{rng("K")}+({rng("B")}<>{clave})*1E9))').font = f_negrita
        ws_gan.cell(r, 6, f'=SUMPRODUCT(MAX(({rng("B")}={clave})*{rng("L")}))').font = f_negrita
        ws_gan.cell(r, 7, f"=Resumen!E{fila_fase[f['n']]}").number_format = "0%"
        ws_gan.cell(r, 7).font = f_link
        for c in range(G0, G0 + ncols):
            ws_gan.cell(r, c).border = Border(bottom=fino)

        ws_gan.conditional_formatting.add(f"{col(G0)}{r}:{ult}{r}", FormulaRule(
            formula=[f"AND({col(G0)}$5>$E{r},{col(G0)}$5<=$F{r})"],
            fill=PatternFill("solid", bgColor="B9D3C9")))
        r += 1
        for t in [t for t in tareas if t["fase"] == f["n"]]:
            pr = fila_plan[t["id"]]
            for c, ref in enumerate(["A", "C", "D", "I", "K", "L", "O"], 1):
                x = ws_gan.cell(r, c, f"=Plan!{ref}{pr}")
                x.font = f_link if c != 1 else Font(name=FUENTE, size=10, bold=True, color="008000")
                x.border = borde
                x.alignment = Alignment(vertical="center", horizontal="left" if c == 2 else "center")
            for b in range(1, ncols + 1):
                L = col(G0 + b - 1)
                x = ws_gan.cell(r, G0 + b - 1, f'=IF(AND({L}$5>$E{r},{L}$5<=$F{r}),IF({L}$5=$E{r}+1,$C{r},""),"")')
                x.font = Font(name=FUENTE, size=8, bold=True, color="FFFFFF")
                x.alignment = centro
                x.border = Border(left=Side(style="hair", color="E6E6E6"), bottom=Side(style="hair", color="E6E6E6"))
            filas_tarea.append(r)
            r += 1
    g_fin = r - 1
    zona = f"{col(G0)}9:{ult}{g_fin}"
    barra = f"AND({col(G0)}$5>$E9,{col(G0)}$5<=$F9,$A9<>\"\")"
    reglas = [
        (f'AND({barra},$G9="Hecho")', HECHO_BAR),
        (f'AND({barra},$G9="Bloqueado")', BLOQ_BAR),
        (f'AND({barra},$D9="A+B")', AB_BAR),
        (f'AND({barra},$D9="A")', VERDE),
        (f'AND({barra},$D9="B")', NAVY),
    ]
    for formula, color in reglas:
        ws_gan.conditional_formatting.add(zona, FormulaRule(
            formula=[formula], fill=PatternFill("solid", bgColor=color), stopIfTrue=True))
    # columna de HOY: encabezado rojo y fondo rosado donde no hay barra
    ws_gan.conditional_formatting.add(f"{col(G0)}5:{ult}5", FormulaRule(
        formula=[f"{col(G0)}$5=Resumen!$C$6+1"], fill=PatternFill("solid", bgColor="D32F2F")))
    ws_gan.conditional_formatting.add(zona, FormulaRule(
        formula=[f"{col(G0)}$5=Resumen!$C$6+1"], fill=PatternFill("solid", bgColor="F8D7D5")))
    ws_gan.freeze_panes = ws_gan.cell(8, G0)

    # ------------------------------------------------ Cola
    titulo(ws_cola, "Cola de trabajo — 2 filas, capacidad infinita",
           "Cada actividad entra a la cola cuando terminan sus dependencias y sale cuando una fila queda libre. "
           "Si hay varias esperando, sale primero la de mayor ruta crítica restante.")
    encabezado(ws_cola, 4, ["Turno", "ID", "Actividad", "Prioridad (ruta crítica, bloques)", "Entra a la cola",
                            "Sale de la cola (inicio)", "Espera", "Fila", "Estado"],
               [7, 7, 52, 14, 11, 12, 9, 7, 11])
    ws_cola.row_dimensions[4].height = 42
    despacho = sorted(prog.items(), key=lambda kv: (kv[1]["inicio"], -kv[1]["prioridad"], kv[0]))
    C0 = 5
    for n, (i, p) in enumerate(despacho):
        r = C0 + n
        pr = fila_plan[i]
        celda(ws_cola, r, 1, n + 1, alin=centro)
        celda(ws_cola, r, 2, i, f_negrita, alin=centro)
        celda(ws_cola, r, 3, f"=Plan!C{pr}", f_link)
        celda(ws_cola, r, 4, p["prioridad"], alin=centro)
        celda(ws_cola, r, 5, f"=Plan!J{pr}", f_link, alin=centro)
        celda(ws_cola, r, 6, f"=Plan!K{pr}", f_link, alin=centro)
        celda(ws_cola, r, 7, f"=F{r}-E{r}", alin=centro)
        celda(ws_cola, r, 8, f"=Plan!I{pr}", f_link, alin=centro)
        celda(ws_cola, r, 9, f"=Plan!O{pr}", f_link, alin=centro)
    CN = C0 + len(despacho) - 1
    colorear_estado(ws_cola, f"I{C0}:I{CN}", "I")
    ws_cola.conditional_formatting.add(f"G{C0}:G{CN}", FormulaRule(
        formula=[f"G{C0}>0"], fill=PatternFill("solid", bgColor="FBE6C8")))
    ws_cola.freeze_panes = f"C{C0}"
    rs = CN + 2
    ws_cola.cell(rs, 2, "Estadísticas de la cola").font = f_negrita
    encabezado_stats = ["", "Fila", "Actividades", "Bloques ocupados", "Uso", "Espera promedio"]
    for c, t in enumerate(encabezado_stats[1:], 2):
        x = ws_cola.cell(rs + 1, c, t)
        x.font, x.fill, x.border, x.alignment = f_head, fill_head, borde, centro
    for k, fila in enumerate(FILAS + ["A+B"]):
        r = rs + 2 + k
        celda(ws_cola, r, 2, fila, f_negrita, alin=centro)
        celda(ws_cola, r, 3, f'=COUNTIF($H${C0}:$H${CN},B{r})', fmt="0", alin=centro)
        celda(ws_cola, r, 4, f'=SUMIF({rng("I")},B{r},{rng("E")})', fmt="0", alin=centro)
        celda(ws_cola, r, 5, f"=IF(Resumen!$C$17=0,0,D{r}/Resumen!$C$17)", fmt="0%", alin=centro)
        celda(ws_cola, r, 6, f'=IFERROR(AVERAGEIF($H${C0}:$H${CN},B{r},$G${C0}:$G${CN}),0)', fmt="0.0", alin=centro)
    r = rs + 2 + 3
    celda(ws_cola, r, 2, "Total", f_negrita)
    celda(ws_cola, r, 3, f"=SUM(C{rs + 2}:C{r - 1})", f_negrita, "0", centro)
    celda(ws_cola, r, 6, f"=AVERAGE($G${C0}:$G${CN})", f_negrita, "0.0", centro)

    # ------------------------------------------------ Propuesta original
    titulo(ws_prop, "Propuesta original (31-ago-2026) — plan por semanas",
           "Tal como se presentó: 6 fases en máximo 8 semanas, en secuencia. Sirve de referencia contra el plan optimizado.")
    encabezado(ws_prop, 4, ["Fase", "Nombre", "Qué se realiza", "Semana inicio", "Semana fin"] +
               [f"S{s}" for s in range(1, 9)], [6, 28, 58, 9, 9] + [5] * 8)
    que = [
        "Wireframes, modelo de datos y definición del stack (Next.js, Supabase, Resend).",
        "Página pública (misión, visión, servicios) y sistema de registro e inicio de sesión.",
        "Formulario de solicitud (50 %/100 %, monto según tope), envío y notificación por correo.",
        "Dashboard de solicitudes y asociados, aprobación/rechazo y notificación automática de resultado.",
        "Sección de empresas aliadas y ajustes visuales, incluido el diseño responsive para celular.",
        "Pruebas con usuarios reales, corrección de errores, capacitación y despliegue en producción.",
    ]
    for k, f in enumerate(fases):
        r = 5 + k
        celda(ws_prop, r, 1, f["n"], f_negrita, alin=centro)
        celda(ws_prop, r, 2, f["nombre"])
        celda(ws_prop, r, 3, que[k], alin=envolver)
        celda(ws_prop, r, 4, f["semanas"][0], f_input, alin=centro)
        celda(ws_prop, r, 5, f["semanas"][1], f_input, alin=centro)
        for s in range(1, 9):
            celda(ws_prop, r, 5 + s, None)
        ws_prop.row_dimensions[r].height = 30
    for s in range(1, 9):
        ws_prop.cell(4, 5 + s).value = s  # número de semana para la regla
        ws_prop.cell(4, 5 + s).number_format = '"S"0'
    ws_prop.conditional_formatting.add("F5:M10", FormulaRule(
        formula=["AND(F$4>=$D5,F$4<=$E5)"], fill=PatternFill("solid", bgColor=VERDE)))
    ws_prop.cell(12, 1, "Qué cambia en el plan optimizado").font = f_negrita
    for k, texto in enumerate([
        "Las 6 fases se partieron en actividades pequeñas (hoja Plan), cada una con un peso de 1 a 5.",
        "En vez de ir fase por fase, dos filas de trabajo toman actividades de una cola común: lo que no depende de otra cosa avanza en paralelo.",
        "Se agregaron actividades que surgieron en el desarrollo (Origen = «Agregado»): ingreso con código, afiliación, importación de asociados, política de datos.",
        "Las fechas no se usan: el tiempo se mide en bloques y semanas relativas.",
    ]):
        ws_prop.cell(13 + k, 1, f"• {texto}").font = f_normal

    # ------------------------------------------------ Pesos
    titulo(ws_pes, "Escala de pesos (1 a 5)", "El peso mide el esfuerzo de una actividad y define su largo en el Gantt.")
    encabezado(ws_pes, 4, ["Peso", "Nivel", "Bloques", "Equivale a", "Ejemplo del proyecto", "Actividades con este peso"],
               [7, 14, 9, 22, 60, 14])
    escala = [
        (1, "Muy baja", "Media jornada", "Borrar /login y /dashboard; capacitación"),
        (2, "Baja", "1 jornada", "SMTP con Resend; proteger /cuenta en proxy.ts"),
        (3, "Media", "1,5 jornadas", "Verificación del código OTP; /cuenta con datos reales"),
        (4, "Alta", "2 jornadas", "Panel /admin; afiliación con Resend; importar asociados"),
        (5, "Muy alta", "2,5 jornadas o más", "Reservado para trabajos que conviene partir en dos"),
    ]
    for k, (p, nivel, eq, ej) in enumerate(escala):
        r = 5 + k
        celda(ws_pes, r, 1, p, f_negrita, alin=centro)
        celda(ws_pes, r, 2, nivel)
        celda(ws_pes, r, 3, p, alin=centro)
        celda(ws_pes, r, 4, eq)
        celda(ws_pes, r, 5, ej, alin=envolver)
        celda(ws_pes, r, 6, f"=COUNTIF({rng('D')},A{r})", fmt="0", alin=centro)
    ws_pes.cell(11, 1, "Reglas de simultaneidad").font = f_negrita
    for k, texto in enumerate([
        "Dos actividades pueden ir al mismo tiempo si ninguna depende (directa o indirectamente) de la otra.",
        "Hay 2 filas de trabajo: como máximo 2 actividades a la vez. Las demás esperan en la cola, que no tiene límite.",
        "«Simultánea: No» significa que la actividad ocupa las 2 filas (p. ej. el despliegue a producción).",
        "La equivalencia en jornadas se ajusta en Resumen → Bloques por semana.",
    ]):
        ws_pes.cell(12 + k, 1, f"• {texto}").font = f_normal

    # ------------------------------------------------ Bitácora
    titulo(ws_bit, "Bitácora de avances", "Cada reporte de un agente que el supervisor aplicó al plan.")
    encabezado(ws_bit, 4, ["Fecha", "Agente", "Actividades", "Cambio", "Detalle"], [12, 28, 16, 40, 80])
    for n, e in enumerate(reversed(datos["bitacora"])):
        r = 5 + n
        celda(ws_bit, r, 1, e["fecha"], alin=centro)
        celda(ws_bit, r, 2, e["agente"])
        celda(ws_bit, r, 3, e["tareas"], alin=centro)
        celda(ws_bit, r, 4, e["cambio"], alin=envolver)
        celda(ws_bit, r, 5, e["detalle"], alin=envolver)
    ws_bit.freeze_panes = "A5"

    for ws in wb.worksheets:
        ws.sheet_view.zoomScale = 90
    ws_gan.sheet_view.zoomScale = 80
    wb.calculation.fullCalcOnLoad = True
    wb.save(SALIDA)
    return prog, hoy, total


if __name__ == "__main__":
    prog, hoy, total = generar()
    print(f"OK -> {SALIDA.name}: {len(prog)} actividades, HOY = bloque {hoy}, fin = bloque {total}")
    for i, p in sorted(prog.items(), key=lambda kv: (kv[1]["inicio"], kv[1]["fila"])):
        print(f'  {i:>5} fila {p["fila"]:<3} listo {p["listo"]:>3} inicio {p["inicio"]:>3} fin {p["fin"]:>3} prio {p["prioridad"]}')
