export const IvaKnowledge = {
    activeScreenData: null,
    screens: {},

    // Helper: Normalize text (remove accents and lowercase)
    normalize: (str) => {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    },

    // Dynamic Active Screen Knowledge (The "Short-term Memory")
    activeScreen: null,

    registerScreen: (screenId, knowledge) => {
        console.log(`[Iva Knowledge] Learning about screen: ${screenId}`);
        IvaKnowledge.activeScreen = {
            id: screenId,
            ...knowledge
        };
    },

    clearActiveScreen: () => {
        IvaKnowledge.activeScreen = null;
    },

    getScreenByKeyword: (text) => {
        const normalize = IvaKnowledge.normalize;
        const lowerText = normalize(text);

        for (const key in IvaKnowledge.screens) {
            const screen = IvaKnowledge.screens[key];
            // Check against keywords
            if (screen.keywords.some(k => lowerText.includes(normalize(k)))) {
                return screen;
            }
            // Also check against the screen Action ID or Name just in case
            if (lowerText.includes(normalize(screen.id)) || lowerText.includes(normalize(screen.name))) {
                return screen;
            }
        }
        return null;
    }
};

