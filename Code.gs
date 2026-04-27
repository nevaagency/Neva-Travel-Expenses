const SHEET_ID = '1qII5qgUfhL0mwMnn3s0DgvVqOzrbyh9gvudFvWxsfFk';

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const params = e.parameter;
  const action = params.action;

  try {
    let result;
    switch (action) {
      case 'getFuncionarias':  result = getFuncionarias(); break;
      case 'getEntradas':      result = getEntradas(params.funcionaria, params.ano, params.mes); break;
      case 'addDeslocacao':    result = addDeslocacao(JSON.parse(e.postData?.contents || '{}')); break;
      case 'addParque':        result = addParque(JSON.parse(e.postData?.contents || '{}')); break;
      case 'deleteDeslocacao': result = deleteRow('Deslocacoes', params.id); break;
      case 'deleteParque':     result = deleteRow('Parques', params.id); break;
      default: result = { error: 'Acção desconhecida: ' + action };
    }
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(name) {
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(name);
}

function getFuncionarias() {
  const sheet = getSheet('Funcionarias');
  const rows  = sheet.getDataRange().getValues();
  const headers = rows[0];
  return rows.slice(1)
    .filter(r => r[0])
    .map(r => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = r[i]);
      return obj;
    });
}

function getEntradas(funcionaria, ano, mes) {
  const deslocacoes = getSheetRows('Deslocacoes')
    .filter(r => r.Funcionaria === funcionaria && String(r.Ano) === String(ano) && r.Mes === mes);
  const parques = getSheetRows('Parques')
    .filter(r => r.Funcionaria === funcionaria && String(r.Ano) === String(ano) && r.Mes === mes);
  return { deslocacoes, parques };
}

function getSheetRows(sheetName) {
  const sheet = getSheet(sheetName);
  const rows  = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1)
    .filter(r => r[0])
    .map(r => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = r[i]);
      return obj;
    });
}

function addDeslocacao(data) {
  const sheet = getSheet('Deslocacoes');
  const id    = Date.now().toString();
  sheet.appendRow([
    id,
    data.funcionaria,
    data.ano,
    data.mes,
    data.dia,
    data.origem,
    data.destino,
    data.justificacao,
    data.kms,
    new Date().toISOString()
  ]);
  return { success: true, id };
}

function addParque(data) {
  const sheet = getSheet('Parques');
  const id    = Date.now().toString();
  sheet.appendRow([
    id,
    data.funcionaria,
    data.ano,
    data.mes,
    data.dia,
    data.evento,
    data.valor,
    new Date().toISOString()
  ]);
  return { success: true, id };
}

function deleteRow(sheetName, id) {
  const sheet = getSheet(sheetName);
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: 'Linha não encontrada' };
}
