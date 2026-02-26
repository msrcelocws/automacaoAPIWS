import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, verbose: true });
addFormats(ajv);

Cypress.Commands.add('validateSchema', (schemaName, body) => {
    // Carrega o schema dinamicamente
    cy.readFile(`cypress/schemas/${schemaName}.json`).then((schema) => {
        const validate = ajv.compile(schema);
        const valid = validate(body);

        if (!valid) {
            const errors = validate.errors.map(err => {
                return `
Campo: ${err.instancePath}
Erro: ${err.message}
Recebido: ${JSON.stringify(err.data)}
Esperado: ${JSON.stringify(err.params)}
                `;
            }).join('\n────────────────────');

            const fullErrorMessage = `❌ Falha de Contrato no Cenário 5.2.3\nFalha na validação do contrato [${schemaName}]:\n${errors}`;

            // Log amigável no console do Cypress
            Cypress.log({
                name: 'Schema Validation',
                displayName: 'SCHEMA',
                message: [`FAIL: ${schemaName}`],
                consoleProps: () => ({
                    errors: validate.errors,
                    schema: schema,
                    body: body
                })
            });

            throw new Error(fullErrorMessage);
        }

        Cypress.log({
            name: 'Schema Validation',
            displayName: 'SCHEMA',
            message: [`SUCCESS: ${schemaName}`],
        });
    });
});
