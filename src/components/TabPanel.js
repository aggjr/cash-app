/**
 * TabPanel Component
 * Elegant tab navigation with rounded tabs
 */

export const TabPanel = (tabs, options = {}) => {
    const {
        defaultTab = 0,
        onTabChange = null
    } = options;

    let activeTabIndex = defaultTab;
    const tabContents = [];

    // Main container
    const container = document.createElement('div');
    container.className = 'tab-panel';

    // Tab headers container
    const tabHeaders = document.createElement('div');
    tabHeaders.className = 'tab-headers';

    // Tab content container
    const tabContentContainer = document.createElement('div');
    tabContentContainer.className = 'tab-content-container';

    // Create tabs
    tabs.forEach((tab, index) => {
        // Create tab header button
        const tabButton = document.createElement('button');
        tabButton.className = 'tab-header';
        tabButton.innerHTML = `
            ${tab.icon ? `<span class="tab-icon">${tab.icon}</span>` : ''}
            <span class="tab-label">${tab.label}</span>
        `;

        if (index === activeTabIndex) {
            tabButton.classList.add('active');
        }

        tabButton.onclick = () => switchTab(index);
        tabHeaders.appendChild(tabButton);

        // Create tab content
        const tabContent = document.createElement('div');
        tabContent.className = 'tab-content';
        if (index === activeTabIndex) {
            tabContent.classList.add('active');
        }

        // Render content (can be DOM element or function)
        if (typeof tab.content === 'function') {
            tabContent.appendChild(tab.content());
        } else {
            tabContent.appendChild(tab.content);
        }

        tabContentContainer.appendChild(tabContent);
        tabContents.push(tabContent);
    });

    // Switch tab function
    const switchTab = (index) => {
        if (index === activeTabIndex) return;

        // Update headers
        tabHeaders.querySelectorAll('.tab-header').forEach((btn, i) => {
            btn.classList.toggle('active', i === index);
        });

        // Update content
        tabContents.forEach((content, i) => {
            content.classList.toggle('active', i === index);
        });

        activeTabIndex = index;

        // Callback
        if (onTabChange) {
            onTabChange(index, tabs[index]);
        }
    };

    // Assemble
    container.appendChild(tabHeaders);
    container.appendChild(tabContentContainer);

    // Add styles
    addTabPanelStyles();

    return {
        element: container,
        switchTab,
        getActiveTab: () => activeTabIndex
    };
};

// Add CSS styles (only once)
let stylesAdded = false;
const addTabPanelStyles = () => {
    if (stylesAdded) return;
    stylesAdded = true;

    const style = document.createElement('style');
    style.textContent = `
        .tab-panel {
            display: flex;
            flex-direction: column;
            height: 100%;
            background: white;
            border-radius: 12px;
            overflow: hidden;
        }

        .tab-headers {
            display: flex;
            gap: 0.5rem;
            padding: 1.5rem 1.5rem 0 1.5rem;
            background: linear-gradient(to bottom, #f9fafb 0%, #ffffff 100%);
            border-bottom: 2px solid #e5e7eb;
        }

        .tab-header {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 1.5rem;
            background: transparent;
            border: none;
            border-radius: 12px 12px 0 0;
            cursor: pointer;
            font-size: 0.95rem;
            font-weight: 500;
            color: #6b7280;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            min-width: 120px;
            justify-content: center;
        }

        .tab-header:hover {
            background: rgba(0, 66, 95, 0.05);
            color: #00425F;
        }

        .tab-header.active {
            background: white;
            color: #00425F;
            font-weight: 600;
            box-shadow: 
                0 -2px 8px rgba(0, 0, 0, 0.05),
                inset 0 -2px 0 0 #DAB177;
        }

        .tab-header.active::after {
            content: '';
            position: absolute;
            bottom: -2px;
            left: 0;
            right: 0;
            height: 2px;
            background: white;
        }

        .tab-icon {
            font-size: 1.1rem;
            display: flex;
            align-items: center;
        }

        .tab-label {
            white-space: nowrap;
        }

        .tab-content-container {
            flex: 1;
            position: relative;
            overflow: hidden;
        }

        .tab-content {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            padding: 2rem;
            overflow-y: auto;
            opacity: 0;
            visibility: hidden;
            transform: translateY(10px);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .tab-content.active {
            opacity: 1;
            visibility: visible;
            transform: translateY(0);
            position: relative;
        }

        /* Scrollbar styling */
        .tab-content::-webkit-scrollbar {
            width: 8px;
        }

        .tab-content::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 4px;
        }

        .tab-content::-webkit-scrollbar-thumb {
            background: #c1c1c1;
            border-radius: 4px;
        }

        .tab-content::-webkit-scrollbar-thumb:hover {
            background: #a8a8a8;
        }
    `;
    document.head.appendChild(style);
};
