import json
import math
import base64
import tempfile
import os
from datetime import date as _date
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas


def euros_to_kms(v, valor_km):
    return math.ceil(v / valor_km)


PORTO_DISTANCES = [
    ("Matosinhos", 17), ("Vila Nova de Gaia", 22), ("Espinho", 40),
    ("Maia", 25), ("Valongo", 30), ("Paredes", 60), ("Famalicão", 70),
    ("Penafiel", 70), ("Felgueiras", 80), ("Barcelos", 90),
    ("Guimarães", 100), ("Braga", 110), ("Amarante", 120),
    ("Viana do Castelo", 140), ("Vila Real", 160), ("Aveiro", 130),
    ("Coimbra", 240), ("Viseu", 260), ("Chaves", 320), ("Bragança", 450),
]


def km_to_city(kms):
    return min(PORTO_DISTANCES, key=lambda x: abs(x[1] - kms))[0]


def generate_pdf(payload):
    func     = payload["funcionaria"]
    empresa  = payload["empresa"]
    mes      = payload["mes"]
    ano      = payload["ano"]
    valor_km = payload.get("valor_km", 0.40)

    parques_como_km = []
    for p in payload.get("parques", []):
        kms_eq = euros_to_kms(p["valor"], valor_km)
        parques_como_km.append({
            "dia": p["dia"], "origem": "Porto",
            "destino": km_to_city(kms_eq),
            "just": p.get("evento", ""),
            "kms": kms_eq, "_parque": True
        })

    kms_raw = [dict(r) for r in payload.get("kms", [])]
    for r in kms_raw:
        if r.get("origem", "Porto").strip().lower() != "porto":
            r["destino"] = km_to_city(r["kms"])
        r["origem"] = "Porto"

    kms_por_dia = {}
    for i, r in enumerate(kms_raw):
        if r["dia"] not in kms_por_dia:
            kms_por_dia[r["dia"]] = i

    parques_standalone = []
    for p in parques_como_km:
        if p["dia"] in kms_por_dia:
            idx = kms_por_dia[p["dia"]]
            kms_raw[idx]["kms"] += p["kms"]
        else:
            parques_standalone.append(p)

    todas = kms_raw + parques_standalone
    todas.sort(key=lambda x: x["dia"])
    dias_usados = {r["dia"]: r for r in todas}
    total_kms   = sum(r["kms"] for r in todas)
    total_valor = total_kms * valor_km

    tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    output_path = tmp.name
    tmp.close()

    W, H = A4
    ML = 1.5 * cm
    MT = 1.4 * cm

    DARK      = colors.HexColor("#1a1a1a")
    MID       = colors.HexColor("#666666")
    BORDER    = colors.HexColor("#cccccc")
    BORDER_LT = colors.HexColor("#e5e5e5")
    HEADER_BG = colors.HexColor("#2c2c2c")
    ROW_ALT   = colors.HexColor("#f7f7f7")
    PARQUE_BG = colors.HexColor("#eef4fb")
    BG1       = colors.HexColor("#f0f0f0")
    BG2       = colors.white

    c = canvas.Canvas(output_path, pagesize=A4)
    c.setTitle(f"Mapa de Deslocações - {func['nome']} - {mes} {ano}")

    y = H - MT

    def lbl(cx, cy, txt):
        c.setFont("Helvetica-Bold", 6.5)
        c.setFillColor(MID)
        c.drawString(cx, cy, txt)

    def val(cx, cy, txt, bold=False, size=8.5):
        c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
        c.setFillColor(DARK)
        c.drawString(cx, cy, txt)

    def hline(yy, weight=0.4, clr=None):
        c.setStrokeColor(clr or BORDER)
        c.setLineWidth(weight)
        c.line(ML, yy, W - ML, yy)

    # TÍTULO
    c.setFont("Helvetica-Bold", 15)
    c.setFillColor(DARK)
    c.drawString(ML, y, "Mapa de Deslocações")
    y -= 0.55 * cm
    hline(y, weight=1.6, clr=DARK)
    y -= 0.40 * cm

    ROW_H = 0.48 * cm
    PAD_X = 0.25 * cm
    PAD_Y = 0.13 * cm
    TW  = W - 2*ML
    cL1 = ML
    cV1 = ML + 2.2*cm
    cL2 = ML + TW/2
    cV2 = ML + TW/2 + 2.2*cm

    def header_row(yy, lbl1, val1, lbl2, val2, bg=BG1):
        c.setFillColor(bg)
        c.rect(ML, yy - ROW_H + 0.10*cm, TW, ROW_H, fill=1, stroke=0)
        c.setStrokeColor(BORDER); c.setLineWidth(0.3)
        c.line(ML, yy - ROW_H + 0.10*cm, ML + TW, yy - ROW_H + 0.10*cm)
        ty = yy - ROW_H + PAD_Y + 0.10*cm
        c.setFont("Helvetica-Bold", 8); c.setFillColor(DARK)
        c.drawString(cL1 + PAD_X, ty, lbl1)
        if lbl2:
            c.drawString(cL2 + PAD_X, ty, lbl2)
        c.setFont("Helvetica", 8)
        c.drawString(cV1 + PAD_X, ty, val1)
        if val2:
            c.drawString(cV2 + PAD_X, ty, val2)
        return yy - ROW_H

    y = header_row(y, "Empresa", empresa["nome"], "Ano", ano, bg=BG1)
    y = header_row(y, "Morada",  empresa["morada"], "Mês", mes, bg=BG2)
    y = header_row(y, "NIF",     empresa["nif"], "", "", bg=BG1)
    y -= 0.28 * cm

    c.setFont("Helvetica", 8); c.setFillColor(DARK)
    c.drawString(ML, y, "Recebido por:")
    y -= 0.30 * cm

    y = header_row(y, "Nome",   func["nome"],   "Viatura", func["viatura"], bg=BG1)
    y = header_row(y, "Morada", func["morada"], "Data",    _date.today().strftime("%d/%m/%Y"), bg=BG2)

    c.setFillColor(BG1)
    c.rect(ML, y - ROW_H + 0.10*cm, TW, ROW_H, fill=1, stroke=0)
    c.setStrokeColor(BORDER); c.setLineWidth(0.3)
    c.line(ML, y - ROW_H + 0.10*cm, ML + TW, y - ROW_H + 0.10*cm)
    ty = y - ROW_H + PAD_Y + 0.10*cm
    c.setFont("Helvetica-Bold", 8); c.setFillColor(DARK)
    c.drawString(cL1 + PAD_X, ty, "NIF")
    c.drawString(cL2 + PAD_X, ty, "Assinatura")
    c.setFont("Helvetica", 8)
    c.drawString(cV1 + PAD_X, ty, func["nif"])
    c.setStrokeColor(BORDER); c.setLineWidth(0.4)
    c.line(cV2 + PAD_X, ty - 0.02*cm, ML + TW - PAD_X, ty - 0.02*cm)
    y -= ROW_H
    y -= 0.32 * cm

    hline(y)
    y -= 0.32 * cm

    tot_w = TW / 3
    tA = ML; tB = ML + tot_w; tC = ML + tot_w * 2

    c.setFillColor(BG2)
    c.rect(ML, y - ROW_H*2 + 0.10*cm, TW, ROW_H*2, fill=1, stroke=0)
    ty1 = y - ROW_H*0.45
    ty2 = y - ROW_H*1.4

    c.setFont("Helvetica", 7.5); c.setFillColor(MID)
    c.drawString(tA + PAD_X, ty1, "Valor por KM, conforme portaria")
    c.drawString(tB + PAD_X, ty1, "Total KMs")
    c.setFont("Helvetica-Bold", 8); c.setFillColor(DARK)
    c.drawString(tC + PAD_X, ty1, "Total Recebido")
    c.setFont("Helvetica", 9); c.setFillColor(DARK)
    c.drawString(tA + PAD_X, ty2, f"{valor_km:.2f}\u20ac")
    c.drawString(tB + PAD_X, ty2, f"{total_kms}")
    c.setFont("Helvetica-Bold", 9)
    c.drawString(tC + PAD_X, ty2, f"{total_valor:.2f}\u20ac")
    y -= ROW_H * 2
    y -= 0.28 * cm

    hline(y)
    y -= 0.28 * cm

    if parques_standalone:
        c.setFont("Helvetica-Oblique", 6.5); c.setFillColor(MID)
        c.drawString(ML, y, "* Estacionamentos convertidos em KMs equivalentes (Porto \u2192 cidade mais próxima)")
        y -= 0.28 * cm

    col_widths = [0.85*cm, 2.2*cm, 2.8*cm, 5.95*cm, 1.7*cm]
    total_w    = sum(col_widths)
    headers    = ["DIA", "ORIGEM", "DESTINO", "JUSTIFICAÇÃO", "Nº KMs"]

    FOOTER_H = 0.68 * cm
    HH       = 0.48 * cm
    available = y - ML - FOOTER_H - HH
    RH = available / 31

    c.setFillColor(HEADER_BG)
    c.rect(ML, y - HH, total_w, HH, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 7.5); c.setFillColor(colors.white)
    x = ML
    for h, w in zip(headers, col_widths):
        ty = y - HH * 0.5 - 0.10*cm
        if h == "Nº KMs":
            c.drawRightString(x + w - 0.18*cm, ty, h)
        else:
            c.drawString(x + 0.16*cm, ty, h)
        x += w
    y -= HH

    for dia in range(1, 32):
        row = dias_usados.get(dia)
        is_parque = row and row.get("_parque")

        if is_parque:
            c.setFillColor(PARQUE_BG)
            c.rect(ML, y - RH, total_w, RH, fill=1, stroke=0)
        elif dia % 2 == 0:
            c.setFillColor(ROW_ALT)
            c.rect(ML, y - RH, total_w, RH, fill=1, stroke=0)

        c.setStrokeColor(BORDER_LT); c.setLineWidth(0.25)
        c.line(ML, y - RH, ML + total_w, y - RH)

        ty = y - RH * 0.5 - 0.10*cm
        row_vals = [
            str(dia),
            row["origem"]   if row else "",
            row["destino"]  if row else "",
            row["just"]     if row else "",
            str(row["kms"]) if row else "",
        ]

        x = ML
        for i, (v, w) in enumerate(zip(row_vals, col_widths)):
            if i == 0:
                c.setFont("Helvetica-Bold", 7.5)
                c.setFillColor(DARK if row else BORDER)
                c.drawString(x + 0.16*cm, ty, v)
            elif i == 4:
                c.setFont("Helvetica-Bold" if row else "Helvetica", 7.5)
                c.setFillColor(DARK)
                c.drawRightString(x + w - 0.18*cm, ty, v)
            else:
                c.setFont("Helvetica-Oblique" if is_parque else "Helvetica", 7.5)
                c.setFillColor(DARK if row else BORDER)
                c.drawString(x + 0.16*cm, ty, v)
            x += w
        y -= RH

    hline(y)
    y -= 0.26 * cm
    c.setFont("Helvetica-Bold", 8); c.setFillColor(DARK)
    c.drawString(ML, y, f"Total KMs: {total_kms}")
    c.drawString(ML + 3.6*cm, y, f"Total a receber: {total_valor:.2f}\u20ac")
    c.drawRightString(W - ML, y, f"Neva Agency \u2014 {mes} {ano}")

    c.save()

    with open(output_path, "rb") as f:
        pdf_bytes = f.read()
    os.unlink(output_path)
    return pdf_bytes, func["nome"], mes, ano


def handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
            },
            "body": ""
        }

    try:
        payload = json.loads(event.get("body", "{}"))
        pdf_bytes, nome, mes, ano = generate_pdf(payload)
        filename = f"Deslocacoes_{nome.split()[0]}_{mes}_{ano}.pdf"
        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/pdf",
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Allow-Origin": "*",
            },
            "body": base64.b64encode(pdf_bytes).decode("utf-8"),
            "isBase64Encoded": True,
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": str(e)})
        }
