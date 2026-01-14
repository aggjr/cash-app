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
        name: 'close_chat',
        description: 'Encerra a conversa e fecha a janela do chat da IVA. Deve ser chamado quando o usuário disser explicitamente que não precisa de mais ajuda, se despedir, ou confirmar que resolveu seu problema.',
        parameters: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'highlight_element',
        description: 'Destaca visualmente um elemento na tela com borda azul escura para mostrar ao usuário onde está a informação solicitada. Use quando o usuário perguntar onde encontrar algo ou pedir para mostrar um dado específico.',
        parameters: {
            type: 'object',
            properties: {
                selector: {
                    type: 'string',
                    description: 'Seletor CSS do elemento a destacar (ex: ".classe", "#id", "tr:nth-child(2)")'
                },
                message: {
                    type: 'string',
                    description: 'Mensagem para o usuário explicando o que está sendo destacado'
                }
            },
            required: ['selector', 'message']
        }
    },
    {
        name: 'update_user_profile',
        description: 'Atualiza informações do perfil do usuário no cadastro quando estiverem FALTANDO (cargo, departamento, gênero). Use APENAS quando o usuário informar esses dados E eles não estiverem preenchidos no sistema. Verifique o contexto antes de usar.',
        parameters: {
            type: 'object',
            properties: {
                job_title: {
                    type: 'string',
                    description: 'Cargo/função do usuário (ex: "Diretor Financeiro", "Analista de TI")'
                },
                department: {
                    type: 'string',
                    description: 'Departamento do usuário (ex: "Financeiro", "TI", "Vendas", "RH")'
                },
                gender: {
                    type: 'string',
                    enum: ['M', 'F'],
                    description: 'Gênero do usuário para tratamento adequado (M=Masculino, F=Feminino)'
                }
            }
        }
    },
    {
        name: 'save_user_preference',
        description: 'Salva preferências PESSOAIS e CONTEXTUAIS que NÃO estão no cadastro do usuário. Use para: horários de trabalho, estilo de comunicação, atalhos, definições personalizadas, filtros favoritos, contextos específicos. NÃO use para dados que JÁ EXISTEM no sistema: nome (use save_preferred_name), cargo, departamento, empresa, ou voz (use save_voice_settings). Esses dados já estão disponíveis no contexto.',
        parameters: {
            type: 'object',
            properties: {
                preference_key: {
                    type: 'string',
                    description: 'Identificador da preferência (ex: work_hours, communication_style, default_filters, shortcuts)'
                },
                preference_value: {
                    type: 'string',
                    description: 'Valor da preferência em linguagem natural'
                },
                description: {
                    type: 'string',
                    description: 'Descrição opcional para contexto adicional'
                }
            },
            required: ['preference_key', 'preference_value']
        }
    },
    {
        name: 'contribute_knowledge',
        description: 'Adiciona novo conhecimento ao sistema global da IVA. Use sempre que o usuário te ensinar algo novo, explicar um passo a passo, ou quando você descobrir como encontrar uma informação que não sabia antes.',
        parameters: {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    enum: ['menus', 'actions', 'custom_rules'],
                    description: 'O tipo de conhecimento sendo adicionado'
                },
                scope: {
                    type: 'string',
                    enum: ['SYSTEM', 'DEPARTMENT', 'ROLE', 'USER'],
                    description: 'Quem deve ver este conhecimento? SYSTEM=Todos, DEPARTMENT=Só meu departamento, ROLE=Só meu cargo, USER=Só eu.'
                },
                data: {
                    type: 'object',
                    description: 'Os dados do conhecimento. Para menus: {screen_id, keywords: {primary: []}, purpose}. Para actions: {screen_id, action_type, keywords: {primary: []}, description}. Para rules: {description}.',
                    properties: {
                        screen_id: { type: 'string' },
                        action_type: { type: 'string' },
                        description: { type: 'string' },
                        purpose: { type: 'string' },
                        keywords: {
                            type: 'object',
                            properties: {
                                primary: { type: 'array', items: { type: 'string' } }
                            }
                        }
                    }
                }
            },
            required: ['type', 'data', 'scope']
        }
    }
];

module.exports = ivaFunctions;
