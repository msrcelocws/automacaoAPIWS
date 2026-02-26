# Script de agendamento para Automação de API Agrofel
# Este script deve ser chamado pelo Agendador de Tarefas do Windows

$ProjectDir = "C:\Users\Mauricio - CWS\Documents\automacaoapiws"

Write-Host "Iniciando execução agendada em $ProjectDir..." -ForegroundColor Cyan

# Navega até o diretório do projeto
Set-Location -Path $ProjectDir

# Executa os testes e a notificação do Slack
npm run test:schedule

Write-Host "Execução concluída." -ForegroundColor Green
