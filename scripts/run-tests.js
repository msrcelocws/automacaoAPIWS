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
    await runCommand('npx', ['allure', 'generate', `"${resultsDir}"`, '--clean', '-o', `"${reportDir}"`]);

    // 4. Customização Visual (Especialist UI)
    console.log('🎨 Aplicando personalização visual (HISTÓRICO)...');
    try {
        const stylesPath = path.join(reportDir, 'styles.css');
        const indexPath = path.join(reportDir, 'index.html');

        const customCSS = `
            .side-nav__brand { background: #007bff !important; }
            .side-nav__item[data-tooltip="Graphs"],
            .side-nav__item[data-tooltip="Timeline"],
            .side-nav__item[data-tooltip="Behaviors"],
            .side-nav__item[data-tooltip="Packages"] { display: none !important; }
        `;
        fs.appendFileSync(stylesPath, customCSS);

        let html = fs.readFileSync(indexPath, 'utf8');
        const customJS = `<script>setTimeout(() => { document.querySelectorAll(".side-nav__item[data-tooltip='Overview'] .side-nav__label").forEach(el => el.innerText = "HISTÓRICO") }, 1000)</script></body>`;
        html = html.replace('</body>', customJS);
        fs.writeFileSync(indexPath, html);
    } catch (err) {
        console.warn('⚠️ Erro ao aplicar tema visual:', err.message);
    }

    // 5. Abre o relatório automaticamente (Local)
    console.log('🌐 Abrindo relatório no navegador...');
    runCommand('npx', ['allure', 'open', `"${reportDir}"`]);

    // 6. Aguarda a indexação
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