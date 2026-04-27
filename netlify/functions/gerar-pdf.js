const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const PORTO_DISTANCES = [
  ["Matosinhos", 17], ["Vila Nova de Gaia", 22], ["Espinho", 40],
  ["Maia", 25], ["Valongo", 30], ["Paredes", 60], ["Famalicão", 70],
  ["Penafiel", 70], ["Felgueiras", 80], ["Barcelos", 90],
  ["Guimarães", 100], ["Braga", 110], ["Amarante", 120],
  ["Viana do Castelo", 140], ["Vila Real", 160], ["Aveiro", 130],
  ["Coimbra", 240], ["Viseu", 260], ["Chaves", 320], ["Bragança", 450],
];

function kmToCity(kms) {
  return PORTO_DISTANCES.reduce((best, cur) =>
    Math.abs(cur[1] - kms) < Math.abs(best[1] - kms) ? cur : best
  )[0];
}

function eurosToKms(v, valorKm) {
  return Math.ceil(v / valorKm);
}

function today() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

async function generatePDF(payload) {
  const func    = payload.funcionaria;
  const empresa = payload.empresa;
  const mes     = payload.mes;
  const ano     = payload.ano;
  const valorKm = payload.valor_km || 0.40;

  // Build parking entries
  const parquesComoKm = (payload.parques || []).map(p => {
    const kmsEq = eurosToKms(p.valor, valorKm);
    return { dia: p.dia, origem: 'Porto', destino: kmToCity(kmsEq), just: p.evento || '', kms: kmsEq, _parque: true };
  });

  // Normalize KM entries: always Porto origin
  const kmsRaw = (payload.kms || []).map(r => {
    const entry = { ...r };
    if ((entry.origem || 'Porto').trim().toLowerCase() !== 'porto') {
      entry.destino = kmToCity(entry.kms);
    }
    entry.origem = 'Porto';
    return entry;
  });

  // Build day index (first entry per day)
  const kmsPorDia = {};
  kmsRaw.forEach((r, i) => { if (!(r.dia in kmsPorDia)) kmsPorDia[r.dia] = i; });

  // Merge parking into same-day trip or keep standalone
  const parquesStandalone = [];
  parquesComoKm.forEach(p => {
    if (p.dia in kmsPorDia) {
      kmsRaw[kmsPorDia[p.dia]].kms += p.kms;
    } else {
      parquesStandalone.push(p);
    }
  });

  const todas = [...kmsRaw, ...parquesStandalone].sort((a, b) => a.dia - b.dia);
  const diasUsados = {};
  todas.forEach(r => { diasUsados[r.dia] = r; });
  const totalKms   = todas.reduce((s, r) => s + r.kms, 0);
  const totalValor = totalKms * valorKm;

  // ── PDF setup ──────────────────────────────────────────────────────────────
  const pdfDoc = await PDFDocument.create();
  const page   = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const fontR = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontI = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const ML = 42; // margin left/right (pts)
  const MT = 40; // margin top
  const TW = width - ML * 2;

  const DARK    = rgb(0.10, 0.09, 0.09);
  const MID     = rgb(0.40, 0.40, 0.40);
  const LIGHT   = rgb(0.63, 0.63, 0.63);
  const BG1     = rgb(0.94, 0.94, 0.94);
  const BG2     = rgb(1, 1, 1);
  const HBG     = rgb(0.17, 0.17, 0.17);
  const ROW_ALT = rgb(0.97, 0.97, 0.97);
  const BORD    = rgb(0.80, 0.80, 0.80);
  const BORD_LT = rgb(0.90, 0.90, 0.90);
  const PARK_BG = rgb(0.93, 0.96, 0.98);

  let y = height - MT;

  function drawText(text, x, yy, { font = fontR, size = 8, color = DARK } = {}) {
    page.drawText(String(text), { x, y: yy, size, font, color });
  }

  function drawRect(x, yy, w, h, color) {
    page.drawRectangle({ x, y: yy, width: w, height: h, color, borderWidth: 0 });
  }

  function hline(yy, thickness = 0.4, color = BORD) {
    page.drawLine({ start: { x: ML, y: yy }, end: { x: ML + TW, y: yy }, thickness, color });
  }

  // ── TITLE ──────────────────────────────────────────────────────────────────
  drawText('Mapa de Deslocações', ML, y, { font: fontB, size: 15, color: DARK });
  y -= 16;
  hline(y, 1.6, DARK);
  y -= 11;

  // ── HEADER TABLE ───────────────────────────────────────────────────────────
  const ROW_H = 13.6;
  const PAD_X = 7;
  const cL1   = ML;
  const cV1   = ML + 62;
  const SPLIT = TW * 0.62;
  const cL2   = ML + SPLIT;
  const cV2   = ML + SPLIT + 62;

  function headerRow(yy, label1, value1, label2, value2, bg) {
    drawRect(ML, yy - ROW_H + 3, TW, ROW_H, bg);
    page.drawLine({ start: { x: ML, y: yy - ROW_H + 3 }, end: { x: ML + TW, y: yy - ROW_H + 3 }, thickness: 0.3, color: BORD });
    const ty = yy - ROW_H + 5.5;
    drawText(label1, cL1 + PAD_X, ty, { font: fontB, size: 8, color: DARK });
    drawText(value1, cV1 + PAD_X, ty, { font: fontR, size: 8, color: DARK });
    if (label2) drawText(label2, cL2 + PAD_X, ty, { font: fontB, size: 8, color: DARK });
    if (value2) drawText(value2, cV2 + PAD_X, ty, { font: fontR, size: 8, color: DARK });
    return yy - ROW_H;
  }

  y = headerRow(y, 'Empresa', empresa.nome, 'Ano', ano, BG1);
  y = headerRow(y, 'Morada',  empresa.morada, 'Mês', mes, BG2);
  y = headerRow(y, 'NIF',     empresa.nif, '', '', BG1);
  y -= 8;

  drawText('Recebido por:', ML, y, { font: fontR, size: 8, color: DARK });
  y -= 8;

  y = headerRow(y, 'Nome',   func.nome,   'Viatura', func.viatura, BG1);
  y = headerRow(y, 'Morada', func.morada, 'Data',    today(),      BG2);

  // NIF + assinatura row — taller if we have a signature image
  const SIG_H = func.assinaturaBase64 ? ROW_H * 3.5 : ROW_H;
  drawRect(ML, y - SIG_H + 3, TW, SIG_H, BG1);
  page.drawLine({ start: { x: ML, y: y - SIG_H + 3 }, end: { x: ML + TW, y: y - SIG_H + 3 }, thickness: 0.3, color: BORD });
  const ty3 = y - ROW_H + 5.5;
  drawText('NIF',        cL1 + PAD_X, ty3, { font: fontB, size: 8, color: DARK });
  drawText(func.nif,     cV1 + PAD_X, ty3, { font: fontR, size: 8, color: DARK });
  drawText('Assinatura', cL2 + PAD_X, ty3, { font: fontB, size: 8, color: DARK });
  if (func.assinaturaBase64) {
    try {
      const sigBytes = Buffer.from(func.assinaturaBase64, 'base64');
      const sigImg   = await pdfDoc.embedPng(sigBytes);
      const sigDims  = sigImg.scaleToFit(ML + TW - PAD_X - (cV2 + PAD_X), SIG_H - 6);
      page.drawImage(sigImg, {
        x: cV2 + PAD_X,
        y: y - SIG_H + 5,
        width:  sigDims.width,
        height: sigDims.height,
      });
    } catch(e) {
      // fallback: just draw the line if image fails
      page.drawLine({ start: { x: cV2 + PAD_X, y: ty3 - 1 }, end: { x: ML + TW - PAD_X, y: ty3 - 1 }, thickness: 0.4, color: BORD });
    }
  } else {
    page.drawLine({ start: { x: cV2 + PAD_X, y: ty3 - 1 }, end: { x: ML + TW - PAD_X, y: ty3 - 1 }, thickness: 0.4, color: BORD });
  }
  y -= SIG_H;
  y -= 9;

  hline(y);
  y -= 9;

  // ── TOTALS ─────────────────────────────────────────────────────────────────
  const tW3 = TW / 3;
  const tA  = ML, tB2 = ML + tW3, tC = ML + tW3 * 2;

  drawRect(ML, y - ROW_H * 2 + 3, TW, ROW_H * 2, BG2);
  const ty1 = y - ROW_H * 0.5;
  const ty2 = y - ROW_H * 1.5;

  drawText('Valor por KM, conforme portaria', tA + PAD_X, ty1, { font: fontR, size: 7.5, color: MID });
  drawText('Total KMs',                       tB2 + PAD_X, ty1, { font: fontR, size: 7.5, color: MID });
  drawText('Total Recebido',                  tC + PAD_X,  ty1, { font: fontB, size: 8,   color: DARK });

  drawText(`${valorKm.toFixed(2)}€`, tA + PAD_X,  ty2, { font: fontR, size: 9, color: DARK });
  drawText(`${totalKms}`,            tB2 + PAD_X, ty2, { font: fontR, size: 9, color: DARK });
  drawText(`${totalValor.toFixed(2)}€`, tC + PAD_X, ty2, { font: fontB, size: 9, color: DARK });

  y -= ROW_H * 2;
  y -= 8;
  hline(y);
  y -= 7;

  if (parquesStandalone.length) {
    drawText('* Estacionamentos convertidos em KMs equivalentes (Porto → cidade mais próxima)', ML, y, { font: fontI, size: 6.5, color: MID });
    y -= 8;
  }

  // ── TABLE ──────────────────────────────────────────────────────────────────
  const _fixed = 24 + 62 + 79 + 48;
  const colW  = [24, 62, 79, TW - _fixed, 48];
  const totW  = colW.reduce((s, w) => s + w, 0);
  const heads = ['DIA', 'ORIGEM', 'DESTINO', 'JUSTIFICAÇÃO', 'Nº KMs'];
  const FOOTER_H = 19;
  const HH       = 13.6;
  const available = y - ML - FOOTER_H - HH;
  const RH = available / 31;

  // Header bar
  drawRect(ML, y - HH, totW, HH, HBG);
  let x = ML;
  heads.forEach((h, i) => {
    const tx = i === 4 ? x + colW[i] - fontB.widthOfTextAtSize(h, 7.5) - 5 : x + 4.5;
    drawText(h, tx, y - HH + 4, { font: fontB, size: 7.5, color: rgb(1,1,1) });
    x += colW[i];
  });
  y -= HH;

  // 31 rows
  for (let dia = 1; dia <= 31; dia++) {
    const row      = diasUsados[dia];
    const isParque = row && row._parque;

    if (isParque) {
      drawRect(ML, y - RH, totW, RH, PARK_BG);
    } else if (dia % 2 === 0) {
      drawRect(ML, y - RH, totW, RH, ROW_ALT);
    }
    page.drawLine({ start: { x: ML, y: y - RH }, end: { x: ML + totW, y: y - RH }, thickness: 0.25, color: BORD_LT });

    const ty = y - RH / 2 - 3;
    const vals = [
      String(dia),
      row ? row.origem  : '',
      row ? row.destino : '',
      row ? row.just    : '',
      row ? String(row.kms) : '',
    ];

    x = ML;
    vals.forEach((v, i) => {
      const font  = (i === 0 || (i === 4 && row)) ? fontB : (isParque && i > 0 && i < 4 ? fontI : fontR);
      const color = (i === 0 && !row) ? LIGHT : (i > 0 && !row) ? LIGHT : DARK;
      if (i === 4 && v) {
        const tw = font.widthOfTextAtSize(v, 7.5);
        drawText(v, x + colW[i] - tw - 5, ty, { font, size: 7.5, color });
      } else {
        drawText(v, x + 4.5, ty, { font, size: 7.5, color });
      }
      x += colW[i];
    });
    y -= RH;
  }

  // ── FOOTER ─────────────────────────────────────────────────────────────────
  hline(y);
  y -= 7;
  drawText(`Total KMs: ${totalKms}`, ML, y, { font: fontB, size: 8, color: DARK });
  drawText(`Total a receber: ${totalValor.toFixed(2)}€`, ML + 102, y, { font: fontB, size: 8, color: DARK });
  const rightText = `Neva Agency — ${mes} ${ano}`;
  const rtw = fontB.widthOfTextAtSize(rightText, 8);
  drawText(rightText, ML + TW - rtw, y, { font: fontB, size: 8, color: DARK });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const payload  = JSON.parse(event.body || '{}');
    const pdfBytes = await generatePDF(payload);
    const nome     = payload.funcionaria?.nome?.split(' ')[0] || 'Funcionaria';
    const filename = `Deslocacoes_${nome}_${payload.mes}_${payload.ano}.pdf`;
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
      body: pdfBytes.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
