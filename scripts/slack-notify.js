const https = require('https');
const fs = require('fs');
const path = require('path');

// 1. Carregamento de Configurações
const envPath = path.join(__dirname, '..', 'cypress.env.json');
let cypressEnv = {};
if (fs.existsSync(envPath)) {
    cypressEnv = JSON.parse(fs.readFileSync(envPath, 'utf8'));
}

const SLACK_WEBHOOK_URL = process.env.CYPRESS_SLACK_WEBHOOK_URL || cypressEnv.SLACK_WEBHOOK_URL;
const REPORT_URL = process.env.REPORT_URL || cypressEnv.REPORT_URL || 'http://localhost:8080';
const BASE_URL = process.env.CYPRESS_BASE_URL || cypressEnv.BASE_URL || 'https://ws.autorei.net';

// 2. Captura de Argumentos (Status e ID Único da Execução)
const statusArg = process.argv[2] || 'unknown';
const executionId = process.argv[3] || new Date().toISOString().replace(/[:.]/g, '-'); // Fallback caso venha vazio
const isSuccess = statusArg === '0' || statusArg === 'success';

if (!SLACK_WEBHOOK_URL) {
    console.error('❌ ERRO: SLACK_WEBHOOK_URL não configurado.');
    process.exit(1);
}

// 3. Construção da URL do Report (Anti-Cache)
// Garante que termina com barra e adiciona o parâmetro único de versão
const finalReportUrl = `${REPORT_URL.replace(/\/$/, '')}/index.html?executionId=${executionId}`;

// 4. Montagem do Payload do Slack
const message = {
    text: isSuccess ? "✅ *Testes de API concluídos com SUCESSO!*" : "❌ *Falha detectada nos Testes de API!*",
    attachments: [
        {
            color: isSuccess ? "#36a64f" : "#ff0000",
            blocks: [
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*Cenário:* Agrofel 5.2.3 - Listagem de pedidos\n*Ambiente:* ${BASE_URL}\n*ID da Execução (GitHub Run):* \`#${executionId}\`\n*Resultado:* ${isSuccess ? 'PASSOU' : 'FALHOU'}\n*Data/Hora:* ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n\n_Dica: Se o relatório parecer antigo, use CTRL+F5._`
                    }
                },
                {
                    type: "actions",
                    elements: [
                        {
                            type: "button",
                            text: {
                                type: "plain_text",
                                text: "Visualizar Report Allure 📊"
                            },
                            url: finalReportUrl,
                            style: isSuccess ? "primary" : "danger"
                        }
                    ]
                }
            ]
        }
    ]
};

// 5. Envio da Requisição
const req = https.request(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
}, (res) => {
    res.on('data', (d) => process.stdout.write(d));
});

req.on('error', (e) => {
    console.error('❌ Erro ao enviar para o Slack:', e);
});

req.write(JSON.stringify(message));
req.end();