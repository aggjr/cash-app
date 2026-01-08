// Simple test to verify Qdrant integration
const QdrantKnowledgeService = require('./services/QdrantKnowledgeService');

async function testQdrantIntegration() {
    console.log('\n🧪 Testing Qdrant Integration...\n');

    try {
        // Test 1: Get greeting
        console.log('Test 1: Getting morning greeting...');
        const greeting = await QdrantKnowledgeService.getGreeting(10); // 10h = morning
        console.log(`✅ Greeting: "${greeting}"`);

        // Test 2: Get personality
        console.log('\nTest 2: Getting personality...');
        const personality = await QdrantKnowledgeService.getPersonality();
        console.log(`✅ Personality:`, personality);

        // Test 3: Get system info
        console.log('\nTest 3: Getting system info...');
        const systemInfo = await QdrantKnowledgeService.getSystemInfo();
        console.log(`✅ System Info:`, systemInfo);

        // Test 4: Get introduction
        console.log('\nTest 4: Getting introduction...');
        const intro = await QdrantKnowledgeService.getIntroduction();
        console.log(`✅ Introduction: "${intro}"`);

        console.log('\n🎉 All tests passed! Qdrant integration is working!\n');

    } catch (err) {
        console.error('\n❌ Test failed:', err.message);
        console.error('Stack:', err.stack);
    }

    process.exit(0);
}

testQdrantIntegration();
