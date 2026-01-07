import { getApiBaseUrl } from '../utils/apiConfig.js';

/**
 * IVA Learning - Active Learning System
 * Records knowledge when IVA is explicitly invoked
 */
export class IvaLearning {

    /**
     * Record menu navigation knowledge
     */
    static async recordMenuKnowledge(userQuery, screenId, menuPath, success = true) {
        try {
            const keywords = this.extractKeywords(userQuery);

            await fetch(`${getApiBaseUrl()}/IVA/learn`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: 'menus',
                    data: {
                        screen_id: screenId,
                        menu_path: menuPath,
                        keywords,
                        purpose: this.inferPurpose(screenId),
                        success
                    }
                })
            });

            console.log('[IVA Learning] 📝 Recorded menu knowledge:', screenId);
        } catch (error) {
            console.error('[IVA Learning] Error recording menu:', error);
        }
    }

    /**
     * Record action execution knowledge
     */
    static async recordActionKnowledge(userQuery, screenId, action, success = true) {
        try {
            const keywords = this.extractKeywords(userQuery);

            await fetch(`${getApiBaseUrl()}/IVA/learn`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: 'actions',
                    data: {
                        screen_id: screenId,
                        action_id: action.id,
                        action_type: action.type,
                        description: action.label || action.description,
                        keywords,
                        selector: action.selector,
                        params: action.params,
                        success
                    }
                })
            });

            console.log('[IVA Learning] 📝 Recorded action knowledge:', action.id);
        } catch (error) {
            console.error('[IVA Learning] Error recording action:', error);
        }
    }

    /**
     * Record data structure knowledge
     */
    static async recordDataKnowledge(userQuery, screenId, dataPath, dataType, success = true) {
        try {
            const keywords = this.extractKeywords(userQuery);

            await fetch(`${getApiBaseUrl()}/IVA/learn`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: 'data_structures',
                    data: {
                        screen_id: screenId,
                        data_path: dataPath,
                        data_type: dataType,
                        description: this.inferDataDescription(dataPath),
                        keywords,
                        success
                    }
                })
            });

            console.log('[IVA Learning] 📝 Recorded data knowledge:', dataPath);
        } catch (error) {
            console.error('[IVA Learning] Error recording data:', error);
        }
    }

    /**
     * Extract keywords from user query
     */
    static extractKeywords(query) {
        const stopWords = ['o', 'a', 'de', 'da', 'do', 'em', 'para', 'com', 'que', 'é', 'um', 'uma', 'os', 'as'];

        return query
            .toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.includes(word))
            .slice(0, 10);
    }

    /**
     * Infer screen purpose from ID
     */
    static inferPurpose(screenId) {
        const purposes = {
            'entradas': 'Gerenciar entradas financeiras',
            'saidas': 'Gerenciar saídas financeiras',
            'contas': 'Gerenciar contas bancárias',
            'empresa': 'Gerenciar empresas',
            'usuarios': 'Gerenciar usuários',
            'tipo-entrada': 'Gerenciar tipos de entrada',
            'tipo-saida': 'Gerenciar tipos de saída',
            'fechamento': 'Realizar fechamento de contas',
            'extrato-conta': 'Visualizar extrato de contas',
            'consolidada-financeira': 'Visualizar consolidação financeira',
            'previsao': 'Visualizar previsão de fluxo de caixa',
            'aportes': 'Gerenciar aportes de sócios',
            'retiradas': 'Gerenciar retiradas de sócios',
            'transferencias': 'Gerenciar transferências entre contas',
            'dividas-emprestimos': 'Gerenciar dívidas e empréstimos'
        };

        return purposes[screenId] || `Gerenciar ${screenId}`;
    }

    /**
     * Infer data description from path
     */
    static inferDataDescription(dataPath) {
        if (dataPath.includes('total')) return 'Total de valores';
        if (dataPath.includes('count')) return 'Quantidade de itens';
        if (dataPath.includes('summary')) return 'Resumo de dados';
        if (dataPath.includes('table')) return 'Tabela de dados';

        return 'Dados extraídos';
    }
}

export default IvaLearning;
