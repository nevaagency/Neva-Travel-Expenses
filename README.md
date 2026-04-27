# Neva Agency — Deslocações

App para registo mensal de deslocações e estacionamentos, com geração automática de PDF.

## Estrutura

```
neva-deslocacoes/
├── index.html                        ← App web
├── netlify.toml                      ← Configuração Netlify
├── README.md
└── netlify/
    └── functions/
        ├── gerar-pdf.py              ← Função serverless (gera o PDF)
        └── requirements.txt          ← Dependências Python
```

## Deploy (10 minutos)

### 1. Criar repositório no GitHub

1. Vai a [github.com](https://github.com) → **New repository**
2. Nome: `neva-deslocacoes`
3. Deixa **Public**
4. Clica **Create repository**
5. Faz upload dos 4 ficheiros (arrastar e largar na página do repo)

### 2. Ligar ao Netlify

1. Vai a [netlify.com](https://netlify.com) → **Sign up** com a conta GitHub
2. Clica **Add new site → Import an existing project**
3. Escolhe **GitHub** → selecciona `neva-deslocacoes`
4. Deixa tudo por defeito e clica **Deploy site**
5. Aguarda ~2 minutos → o site fica online com um URL tipo `https://amazing-name-123.netlify.app`

### 3. Adicionar funcionárias

No `index.html`, encontra esta secção e adiciona linhas conforme necessário:

```html
<select class="ctx-select" id="sel-func" onchange="load()">
  <option value="Juliana Soares Ramalho|Rua das Amareiras, nº 45, Vieira do Minho 4850-153|231 565 950|81-VD-69">
    Juliana Soares Ramalho
  </option>
  <!-- Adicionar aqui: -->
  <!-- <option value="NOME|MORADA|NIF|VIATURA">NOME</option> -->
</select>
```

Formato do value: `Nome completo|Morada|NIF|Matrícula da viatura`

## Como usar

1. Selecciona funcionária, mês e ano no topo
2. Regista deslocações (dia, origem, destino, justificação, KMs)
3. Regista estacionamentos (dia, evento, valor em €)
4. Clica **Gerar PDF ↓** — o PDF é descarregado automaticamente

### Notas automáticas
- Se a **origem não for Porto**, o sistema encontra a cidade equivalente em distância
- Os **estacionamentos** são convertidos em KMs equivalentes (valor ÷ 0,40€/km)
- Se houver estacionamento no **mesmo dia** que uma deslocação, os KMs somam-se
- Os dados ficam guardados no browser por funcionária/mês/ano
