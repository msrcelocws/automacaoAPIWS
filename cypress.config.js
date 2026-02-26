const { defineConfig } = require('cypress');
const allureWriter = require('@shelex/cypress-allure-plugin/writer');

module.exports = defineConfig({
    e2e: {
        baseUrl: 'https://ws.autorei.net',
        env: {
            // Ativa o log detalhado das requisições no relatório
            allure: true,
            // Esta linha abaixo é o segredo para limpar a poluição visual:
            allureSkipCommands: 'assert,expect',
            allureAttachRequests: true,
            allureLogGherkin: true,
            allureAddVideoOnPass: false, // Opcional: mude para true se quiser vídeo
        },
        setupNodeEvents(on, config) {
            allureWriter(on, config);
            return config;
        },
    },
});