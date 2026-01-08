/**
 * IVA Function Definitions for OpenAI Function Calling
 * 
 * These functions allow the LLM to save user preferences
 * when it detects the user wants to change something.
 */

const ivaFunctions = [
    {
        name: 'save_preferred_name',
        description: 'Salva o nome preferido do usuário quando ele pede para ser chamado de forma diferente. Use quando o usuário disser coisas como "me chame de X", "pode me chamar de Y", "prefiro Z", etc.',
        parameters: {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    description: 'O nome preferido que o usuário quer ser chamado (ex: "Sr. Augusto", "Guto", "Augusto")'
                }
            },
            required: ['name']
        }
    },
    {
        name: 'save_voice_settings',
        description: 'Salva configurações de voz quando o usuário pede para habilitar/desabilitar voz ou mudar velocidade',
        parameters: {
            type: 'object',
            properties: {
                enabled: {
                    type: 'boolean',
                    description: 'Se a voz está habilitada ou não'
                },
                rate: {
                    type: 'number',
                    description: 'Velocidade da voz (0-100, padrão 75)'
                }
            }
        }
    },
    {
        name: 'update_last_access',
        description: 'Registra a data e hora atual como o último acesso do usuário à IVA. Deve ser chamado obrigatoriamente no primeiro contato de cada dia para que o sistema saiba que o usuário já foi cumprimentado hoje.',
        parameters: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'close_chat',
        description: 'Encerra a conversa e fecha a janela do chat da IVA. Deve ser chamado quando o usuário disser explicitamente que não precisa de mais ajuda, se despedir, ou confirmar que resolveu seu problema.',
        parameters: {
            type: 'object',
            properties: {}
        }
    }
];

module.exports = ivaFunctions;
