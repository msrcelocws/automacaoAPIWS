// ============================================================
// Variáveis de configuração — carregadas via Cypress.env()
// Defina BASE_URL e AUTH_BASIC no cypress.env.json ou nas
// variáveis de ambiente do agendador (CYPRESS_BASE_URL, etc.)
// ============================================================
const BASE_URL = Cypress.env('BASE_URL') || 'https://ws.autorei.net';
const CUSTOMER_DOC = Cypress.env('CUSTOMER_DOC') || '503.961.710-01';
const AUTH_BASIC = Cypress.env('AUTH_BASIC');

// ── Overrides opcionais ──────────────────────────────────────
// Preencha no cypress.env.json para pular a autenticação e usar um token fixo.
// Deixe null/ausente para obter um token novo a cada execução.
const FIXED_ACCESS_TOKEN = null;
// null  → busca o pedido mais recente do CUSTOMER_DOC
// valor → usa esse orderId diretamente (pula o Step 2)
const FIXED_ORDER_ID = null

// ============================================================
// Credenciais de autenticação — lidas do cypress.env.json (não commitar)
// ============================================================
const AUTH = {
    username: Cypress.env('AUTH_USERNAME'),
    password: Cypress.env('AUTH_PASSWORD'),
};

// ============================================================
// Helpers
// ============================================================

/** Anexa JSON formatado ao relatório Allure */
const attachJSON = (label, data) => {
    cy.allure().attachment(label, JSON.stringify(data, null, 2), 'application/json');
};

/**
 * Verifica se o status HTTP é 2xx.
 * Em caso de falha, registra detalhes no state e lança erro descritivo.
 */
const assertSuccess = (response, stepLabel, state) => {
    const ok = response.status >= 200 && response.status < 300;
    if (!ok) {
        const errorDetail = {
            step: stepLabel,
            statusCode: response.status,
            responseBody: response.body,
        };
        state.success = false;
        state.errorMessage = JSON.stringify(errorDetail);
        state.testLogs.push(`[ERRO] ${stepLabel}: HTTP ${response.status} — ${JSON.stringify(response.body)}`);
        attachJSON(`Erro — ${stepLabel}`, errorDetail);
        throw new Error(`${stepLabel} falhou com status ${response.status}. Detalhes: ${state.errorMessage}`);
    }
    state.testLogs.push(`[OK] ${stepLabel}: HTTP ${response.status}`);
};

// ============================================================
// Fluxo E2E: Auth → Listagem → Detalhe do Pedido
// ============================================================
describe('Fluxo 5.2.3 - Listagem de pedidos por Order - Marketplace', () => {

    it('AGROFEL - Fluxo 5.2.3 - Listagem de pedidos por Order - Marketplace', function () {
        cy.allure()
            .severity('critical')
            .feature('Marketplace')
            .story('Fluxo de Pedido')
            .link('Documentação da API', 'https://ws.autorei.net/swagger-ui.html') // Exemplo de link de doc
            .description('Autentica via OAuth, busca o último pedido do cliente e valida os atributos.');

        // ── Registro de Ambiente no Allure ──────────────────
        const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        cy.allure().writeEnvironmentInfo({
            'Data/Hora (Brasília)': now,
            'Ambiente': BASE_URL,
            'ID da Execução': Cypress.env('GITHUB_RUN_ID') || 'Local',
        });

        // ── Estado compartilhado entre os steps ──────────────
        const state = {
            success: true,
            errorMessage: null,
            testLogs: [],
        };

        let accessToken;
        let orderId;

        // ════════════════════════════════════════════════════
        // STEP 1 — Autenticação (POST /oauth/token)
        // Pulado se FIXED_ACCESS_TOKEN estiver preenchido
        // ════════════════════════════════════════════════════
        if (FIXED_ACCESS_TOKEN) {
            cy.allure().startStep('1. Autenticação — token fixo (override)');
            cy.then(() => {
                accessToken = FIXED_ACCESS_TOKEN;
                state.testLogs.push('[OK] Step 1: token fixo utilizado (override).');
            });
            cy.allure().endStep();
        } else {
            cy.allure().startStep('Step 1 — POST /oauth/token');
            cy.request({
                method: 'POST',
                url: `${BASE_URL}/oauth/token`,
                failOnStatusCode: false,                        // ← captura erros sem abortar
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    ...(AUTH_BASIC ? { 'Authorization': `Basic ${AUTH_BASIC}` } : {}),
                },
                body: new URLSearchParams({
                    scope: 'trust', grant_type: 'password',
                    username: AUTH.username, password: AUTH.password,
                }).toString(),
            }).then((authResponse) => {
                attachJSON('Response Body — Auth', authResponse.body);
                cy.allure().parameter('Tempo de Resposta (Step 1)', `${authResponse.duration}ms`);
                assertSuccess(authResponse, `Step 1 — POST /oauth/token (${authResponse.duration}ms)`, state);   // lança se não 2xx

                accessToken = authResponse.body.access_token;
                if (!accessToken) {
                    state.success = false;
                    state.errorMessage = 'access_token ausente na resposta de autenticação.';
                    state.testLogs.push(`[ERRO] Step 1: ${state.errorMessage}`);
                    throw new Error(state.errorMessage);
                }
            });
            cy.allure().endStep();
        }

        // ════════════════════════════════════════════════════
        // STEP 2 — Busca do último pedido (GET /list/store)
        // Pulado se FIXED_ORDER_ID estiver preenchido
        // ════════════════════════════════════════════════════
        if (FIXED_ORDER_ID) {
            cy.allure().startStep('2. Busca do pedido — orderId fixo (override)');
            cy.then(() => {
                orderId = FIXED_ORDER_ID;
                state.testLogs.push(`[OK] Step 2: orderId fixo utilizado (${FIXED_ORDER_ID}).`);
            });
            cy.allure().endStep();
        } else {
            cy.allure().startStep('Step 2 — GET /partnerOrders/list/store');
            cy.then(() => {
                cy.api({
                    method: 'GET',
                    url: `${BASE_URL}/partnerOrders/list/store?offset=0&limit=50&_t=${Date.now()}`,
                    failOnStatusCode: false,                    // ← captura erros sem abortar
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                }).then((listResponse) => {
                    attachJSON('Response Body — Listagem', listResponse.body);
                    cy.allure().parameter('Tempo de Resposta (Step 2)', `${listResponse.duration}ms`);
                    assertSuccess(listResponse, `Step 2 — GET /partnerOrders/list/store (${listResponse.duration}ms)`, state);

                    const orders = listResponse.body;
                    const filtered = orders
                        .filter((o) => o.customer?.customerDocument === CUSTOMER_DOC)
                        .sort((a, b) => new Date(b.dateCreated) - new Date(a.dateCreated));

                    if (filtered.length === 0) {
                        state.success = false;
                        state.errorMessage = `Nenhum pedido encontrado para o cliente ${CUSTOMER_DOC}.`;
                        state.testLogs.push(`[ERRO] Step 2: ${state.errorMessage}`);
                        throw new Error(state.errorMessage);
                    }

                    orderId = filtered[0].orderId;

                    if (!orderId) {
                        state.success = false;
                        state.errorMessage = 'orderId não encontrado no pedido mais recente.';
                        state.testLogs.push(`[ERRO] Step 2: ${state.errorMessage}`);
                        throw new Error(state.errorMessage);
                    }

                    state.testLogs.push(`[OK] Step 2: orderId obtido — ${orderId}.`);
                });
            });
            cy.allure().endStep();
        }

        // ════════════════════════════════════════════════════
        // STEP 3 — Validação do pedido (GET /store/order/:id)
        // ════════════════════════════════════════════════════
        cy.allure().startStep('Step 3 — GET /partnerOrders/store/order/:id');
        cy.then(() => {
            cy.allure().parameter('Order ID', orderId);
            cy.api({
                method: 'GET',
                url: `${BASE_URL}/partnerOrders/store/order/${orderId}`,
                failOnStatusCode: false,                        // ← captura erros sem abortar
                headers: { 'Authorization': `Bearer ${accessToken}` },
            }).then((detailResponse) => {
                attachJSON('Response Body — Detalhe do Pedido', detailResponse.body);
                cy.allure().parameter('Tempo de Resposta (Step 3)', `${detailResponse.duration}ms`);
                assertSuccess(detailResponse, `Step 3 — GET /partnerOrders/store/order/${orderId} (${detailResponse.duration}ms)`, state);

                // Validação de Contrato via JSON Schema
                cy.allure().startStep('Validação de JSON Schema');
                cy.validateSchema('Agrofel-JSONSCHEMA-5.2.3', detailResponse.body);
                cy.allure().endStep();

                state.testLogs.push('[OK] Step 3: Contrato validado com sucesso.');
                state.testLogs.push('[OK] Step 3: partnerOrderAttributes validados via Schema.');
                state.testLogs.push('[OK] Step 3: priceContractSkuCustomAttributes validados via Schema.');
                state.testLogs.push('[OK] Step 3: paymentDateVpvf validado via Schema.');

                // ── Resumo final ──────────────────────────────────
                attachJSON('Estado Final do Teste', state);

                if (!state.success) {
                    const failMsg = `Teste falhou. Logs:\n${state.testLogs.join('\n')}`;
                    expect(state.success, failMsg).to.be.true;
                } else {
                    expect(state.success).to.be.true;
                }
            });
        });
        cy.allure().endStep();
    });

});
