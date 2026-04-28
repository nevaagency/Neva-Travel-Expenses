const SHEET_ID = '1qII5qgUfhL0mwMnn3s0DgvVqOzrbyh9gvudFvWxsfFk';

function doGet(e)  { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  const params = e.parameter;
  const action = params.action;
  try {
    let result;
    switch (action) {
      case 'getFuncionarias':    result = getFuncionarias(); break;
      case 'getEntradas':        result = getEntradas(params.funcionaria, params.ano, params.mes); break;
      case 'getAssinatura':      result = getAssinatura(params.funcionaria); break;
      case 'getSaldoHoras':      result = getSaldoHoras(params.funcionaria); break;
      case 'addDeslocacao':      result = addDeslocacao(JSON.parse(e.postData?.contents || '{}')); break;
      case 'addParque':          result = addParque(JSON.parse(e.postData?.contents || '{}')); break;
      case 'addHorasExtra':      result = addHorasExtra(JSON.parse(e.postData?.contents || '{}')); break;
      case 'addHorasGozadas':    result = addHorasGozadas(JSON.parse(e.postData?.contents || '{}')); break;
      case 'deleteDeslocacao':   result = deleteRow('Deslocacoes', params.id); break;
      case 'deleteParque':       result = deleteRow('Parques', params.id); break;
      case 'deleteHorasExtra':   result = deleteRow('HorasExtra', params.id); break;
      case 'deleteHorasGozadas': result = deleteRow('HorasGozadas', params.id); break;
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

function getSheetRows(sheetName) {
  const sheet = getSheet(sheetName);
  const rows  = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).filter(r => r[0]).map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });
}

function getFuncionarias() {
  const sheet = getSheet('Funcionarias');
  const rows  = sheet.getDataRange().getValues();
  const headers = rows[0];
  return rows.slice(1).filter(r => r[0]).map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });
}

function getAssinatura(funcionaria) {
  const rows = getFuncionarias();
  const func = rows.find(r => r.Nome === funcionaria);
  if (!func || !func.Assinatura) return { base64: null };
  try {
    let url = func.Assinatura;
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match) url = `https://drive.google.com/uc?export=download&id=${match[1]}`;
    const response = UrlFetchApp.fetch(url, { followRedirects: true, muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) return { base64: null };
    return { base64: Utilities.base64Encode(response.getContent()), mimeType: 'image/png' };
  } catch(e) {
    return { base64: null, error: e.toString() };
  }
}

function getEntradas(funcionaria, ano, mes) {
  const deslocacoes = getSheetRows('Deslocacoes')
    .filter(r => r.Funcionaria === funcionaria && String(r.Ano) === String(ano) && r.Mes === mes);
  const parques = getSheetRows('Parques')
    .filter(r => r.Funcionaria === funcionaria && String(r.Ano) === String(ano) && r.Mes === mes);
  const horasExtra = getSheetRows('HorasExtra')
    .filter(r => r.Funcionaria === funcionaria && String(r.Data).startsWith(ano + '-' + mesNumero(mes)));
  const horasGozadas = getSheetRows('HorasGozadas')
    .filter(r => r.Funcionaria === funcionaria && String(r.Data).startsWith(ano + '-' + mesNumero(mes)));
  return { deslocacoes, parques, horasExtra, horasGozadas };
}

function getSaldoHoras(funcionaria) {
  const extras  = getSheetRows('HorasExtra').filter(r => r.Funcionaria === funcionaria);
  const gozadas = getSheetRows('HorasGozadas').filter(r => r.Funcionaria === funcionaria);
  const totalExtras  = extras.reduce((s, r)  => s + Number(r.Horas || 0), 0);
  const totalGozadas = gozadas.reduce((s, r) => s + Number(r.Horas || 0), 0);
  return { totalExtras, totalGozadas, saldo: totalExtras - totalGozadas };
}

function mesNumero(mes) {
  const m = {'Janeiro':'01','Fevereiro':'02','Março':'03','Abril':'04','Maio':'05','Junho':'06',
             'Julho':'07','Agosto':'08','Setembro':'09','Outubro':'10','Novembro':'11','Dezembro':'12'};
  return m[mes] || '01';
}

function addDeslocacao(data) {
  const id = Date.now().toString();
  getSheet('Deslocacoes').appendRow([id, data.funcionaria, data.ano, data.mes,
    data.dia, data.origem, data.destino, data.justificacao, data.kms, new Date().toISOString()]);
  return { success: true, id };
}

function addParque(data) {
  const id = Date.now().toString();
  getSheet('Parques').appendRow([id, data.funcionaria, data.ano, data.mes,
    data.dia, data.evento, data.valor, new Date().toISOString()]);
  return { success: true, id };
}

function addHorasExtra(data) {
  const id = Date.now().toString();
  getSheet('HorasExtra').appendRow([id, data.funcionaria, data.data,
    data.trabalho, data.horas, data.pagamento, new Date().toISOString()]);
  return { success: true, id };
}

function addHorasGozadas(data) {
  const id = Date.now().toString();
  getSheet('HorasGozadas').appendRow([id, data.funcionaria, data.data,
    data.horas, new Date().toISOString()]);
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
