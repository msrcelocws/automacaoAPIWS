const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function runCommand(command, args) {
    return new Promise((resolve) => {
        const cmd = spawn(command, args, { shell: true, stdio: 'inherit' });
        cmd.on('close', (code) => resolve(code));
    });
}

async function start() {
    // ID único com data e hora para quebrar o cache
    const executionId = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
    console.log(`🚀 Iniciando execução Agrofel [${executionId}]...`);

    // Ajuste nos caminhos: Se o script está na pasta /scripts, o '..' sobe para a raiz
    const resultsDir = path.resolve(__dirname, '..', 'allure-results');
    const reportDir = path.resolve(__dirname, '..', 'allure-report');

    // 1. Limpeza Profunda (Garante que as pastas estejam VAZIAS e EXISTAM)
    [resultsDir, reportDir].forEach(dir => {
        try {
            if (fs.existsSync(dir)) {
                console.log(`🧹 Removendo dados antigos: ${path.basename(dir)}`);
                // Força a remoção recursiva para limpar tudo
                fs.rmSync(dir, { recursive: true, force: true });
            }
            // Recria a pasta limpa
            fs.mkdirSync(dir, { recursive: true });
        } catch (err) {
            console.warn(`⚠️ Erro ao limpar ${path.basename(dir)}: ${err.message}`);
        }
    });

    // 2. Executa o Cypress
    console.log('🌲 Rodando Cypress...');
    const cypressCode = await runCommand('npx', ['cypress', 'run', '--env', 'allure=true']);

    // 3. Gera o Report Allure (Geração Forçada)
    console.log('📊 Gerando report Allure atualizado...');
    // Usamos caminhos absolutos para evitar que o Allure pegue pastas erradas
    await runCommand('npx', ['allure', 'generate', `"${resultsDir}"`, '--clean', '-o', `"${reportDir}"`]);

    // 4. Aguarda a indexação (Aumentamos para 12s para segurança extra)
    console.log('⏳ Sincronizando arquivos...');
    await new Promise(resolve => setTimeout(resolve, 12000));

    // 5. Notificação Slack
    console.log('🔔 Notificando Slack...');
    const slackScriptPath = path.join(__dirname, 'slack-notify.js');

    // IMPORTANTE: O slack-notify.js deve ler o process.argv[3] para usar no link
    await runCommand('node', [`"${slackScriptPath}"`, cypressCode, executionId]);

    process.exit(cypressCode);
}

start();