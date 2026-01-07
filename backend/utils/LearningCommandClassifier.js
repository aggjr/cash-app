/**
 * Learning Command Classifier
 * 
 * Classifica comandos do usuário em:
 * - LEARN (Aprender novo conhecimento)
 * - RELEARN (Atualizar conhecimento existente)
 * - UNLEARN (Remover conhecimento obsoleto)
 * - NONE (Não é comando de aprendizado)
 */

class LearningCommandClassifier {

    /**
     * Palavras-chave por tipo de comando
     */
    static KEYWORDS = {
        LEARN: [
            'aprenda', 'guarde', 'memorize', 'grave', 'registre',
            'anote', 'salve', 'lembre', 'para encontrar', 'para saber'
        ],

        RELEARN: [
            'reaprender', 'atualizar', 'corrigir', 'mudar',
            'alterar', 'modificar', 'agora é', 'mudou para',
            'não é mais', 'passou a ser'
        ],

        UNLEARN: [
            'esqueça', 'desaprender', 'remover', 'deletar',
            'apagar', 'não preciso mais', 'não vale mais',
            'não existe mais', 'foi removido'
        ]
    };

    /**
     * Classificar mensagem do usuário
     */
    classify(message) {
        const msg = message.toLowerCase();

        // Verificar RELEARN (tem prioridade sobre LEARN)
        if (this.matchesKeywords(msg, this.KEYWORDS.RELEARN)) {
            return {
                type: 'RELEARN',
                confidence: this.calculateConfidence(msg, this.KEYWORDS.RELEARN)
            };
        }

        // Verificar UNLEARN
        if (this.matchesKeywords(msg, this.KEYWORDS.UNLEARN)) {
            return {
                type: 'UNLEARN',
                confidence: this.calculateConfidence(msg, this.KEYWORDS.UNLEARN)
            };
        }

        // Verificar LEARN
        if (this.matchesKeywords(msg, this.KEYWORDS.LEARN)) {
            return {
                type: 'LEARN',
                confidence: this.calculateConfidence(msg, this.KEYWORDS.LEARN)
            };
        }

        return {
            type: 'NONE',
            confidence: 0
        };
    }

    /**
     * Verificar se mensagem contém palavras-chave
     */
    matchesKeywords(message, keywords) {
        return keywords.some(keyword => message.includes(keyword));
    }

    /**
     * Calcular confiança baseado em número de matches
     */
    calculateConfidence(message, keywords) {
        const matches = keywords.filter(keyword => message.includes(keyword)).length;
        return Math.min(matches / keywords.length, 1.0);
    }

    /**
     * Extrair tipo de conhecimento da mensagem
     */
    extractKnowledgeType(message) {
        const msg = message.toLowerCase();

        // NAVIGATION
        if (msg.includes('tela') || msg.includes('menu') || msg.includes('onde fica') || msg.includes('ir em')) {
            return 'NAVIGATION';
        }

        // ACTION
        if (msg.includes('botão') || msg.includes('clicar') || msg.includes('criar') || msg.includes('editar')) {
            return 'ACTION';
        }

        // DATA
        if (msg.includes('dado') || msg.includes('valor') || msg.includes('informação') ||
            msg.includes('coluna') || msg.includes('linha') || msg.includes('tabela')) {
            return 'DATA';
        }

        // RULE (default)
        return 'RULE';
    }

    /**
     * Extrair camada de conhecimento da mensagem
     */
    extractLayer(message) {
        const msg = message.toLowerCase();

        // USER
        if (msg.includes('eu sempre') || msg.includes('minha preferência') ||
            msg.includes('quando eu') || msg.includes('me mostre')) {
            return 'USER';
        }

        // SECTOR
        if (msg.includes('nosso setor') || msg.includes('nossa equipe') ||
            msg.includes('departamento')) {
            return 'SECTOR';
        }

        // COMPANY
        if (msg.includes('nossa empresa') || msg.includes('política da empresa') ||
            msg.includes('todos devem') || msg.includes('regra da empresa')) {
            return 'COMPANY';
        }

        // MODULE (default para conhecimento do sistema)
        return 'MODULE';
    }
}

module.exports = new LearningCommandClassifier();
