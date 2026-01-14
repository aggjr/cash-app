const axios = require('axios');

const QDRANT_URL = 'https://iva-bd.gutoapps.site';
const QDRANT_API_KEY = null; // Set if needed

const collections = ['iva_knowledge', 'iva_user_preferences'];

(async () => {
    console.log('🔍 Searching Qdrant for "Guto"...\n');
    console.log(`📡 Qdrant URL: ${QDRANT_URL}\n`);

    for (const collection of collections) {
        console.log(`\n📦 Searching collection: ${collection}`);
        console.log('='.repeat(60));

        try {
            // Scroll through all points in the collection
            const response = await axios.post(
                `${QDRANT_URL}/collections/${collection}/points/scroll`,
                {
                    limit: 100,
                    with_payload: true,
                    with_vector: false
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        ...(QDRANT_API_KEY && { 'api-key': QDRANT_API_KEY })
                    }
                }
            );

            const points = response.data.result.points || [];
            console.log(`📊 Total points in collection: ${points.length}\n`);

            // Search for "Guto" in payloads
            const gutoPoints = points.filter(point => {
                const payloadStr = JSON.stringify(point.payload).toLowerCase();
                return payloadStr.includes('guto');
            });

            if (gutoPoints.length > 0) {
                console.log(`⚠️  Found ${gutoPoints.length} point(s) containing "Guto":\n`);
                gutoPoints.forEach((point, idx) => {
                    console.log(`\n--- Point ${idx + 1} ---`);
                    console.log(`ID: ${point.id}`);
                    console.log(`Payload:`, JSON.stringify(point.payload, null, 2));
                });
            } else {
                console.log(`✅ No points containing "Guto" found in ${collection}`);
            }

        } catch (error) {
            if (error.response?.status === 404) {
                console.log(`⚠️  Collection "${collection}" does not exist`);
            } else {
                console.error(`❌ Error searching ${collection}:`, error.message);
                if (error.response?.data) {
                    console.error('Response:', error.response.data);
                }
            }
        }
    }

    console.log('\n\n✅ Search complete!');
})();
