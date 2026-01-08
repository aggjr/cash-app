require('dotenv').config();
const VectorSearchService = require('./services/VectorSearchService');

async function verify() {
    console.log('--- DIAGNÓSTICO QDRANT ---');
    try {
        // Search for general knowledge
        const knowledge = await VectorSearchService.search('conhecimento', {}, 20);
        console.log(`\nFound ${knowledge.length} knowledge entries:`);
        knowledge.forEach((item, i) => {
            console.log(`[${i}] Category: ${item.category}, Layer: ${item.layer}, Payload:`, JSON.stringify(item.payload || item, null, 2));
        });

        // Search for personality
        const personality = await VectorSearchService.search('personalidade', { category: 'personality' }, 1);
        console.log('\nPersonality:', JSON.stringify(personality[0], null, 2));

        // Search for greetings
        const greetings = await VectorSearchService.search('saudação', { category: 'greeting' }, 5);
        console.log('\nGreetings:', JSON.stringify(greetings, null, 2));

    } catch (err) {
        console.error('Error:', err);
    }
}

verify();
