import { SharedTable } from './SharedTable.js';
import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';

export const CampanhaWizard = {
    show({ onSave }) {
        return new Promise((resolve) => {
            const API_BASE_URL = getApiBaseUrl();
            let container = document.getElementById('wizard-container');
            if (container) document.body.removeChild(container);

            container = document.createElement('div');
            container.id = 'wizard-container';
            container.className = 'wizard-overlay';
            // Basic Styles for full screen overlay
            Object.assign(container.style, {
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
                display: 'flex', justifyContent: 'center', alignItems: 'center'
            });

            const content = document.createElement('div');
            content.className = 'wizard-content animate-float-in';
            Object.assign(content.style, {
                width: '95%', height: '90vh', backgroundColor: 'white',
                borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                display: 'flex', flexDirection: 'column', overflow: 'hidden'
            });

            // State
            let currentStep = 1;
            const state = {
                config: {
                    nome: '',
                    descricao: '',
                    dataInicio: '',
                    dataFim: '',
                    status: 'planejamento',
                    useEmail: true,
                    useWhatsapp: true
                },
                groups: new Set(), // Set of selected Group IDs
                leads: [], // Preview leads
                message: {
                    emailSubject: '',
                    emailBody: '',
                    whatsappText: ''
                }
            };

            let treeRoot = null;
            let treeContainerRef = null;

            // Header (Stepper)
            const header = document.createElement('div');
            Object.assign(header.style, {
                padding: '1.5rem', borderBottom: '1px solid #eee',
                display: 'flex', justifyContent: 'center', gap: '3rem', position: 'relative'
            });

            // Close Button
            const btnClose = document.createElement('button');
            btnClose.id = 'btn-close-wizard';
            btnClose.innerHTML = '×';
            Object.assign(btnClose.style, {
                position: 'absolute', top: '1rem', right: '1rem',
                background: 'none', border: 'none', fontSize: '2rem', cursor: 'pointer', color: '#999'
            });
            header.appendChild(btnClose);

            const renderStepBadge = (step, label) => {
                const wrapper = document.createElement('div');
                wrapper.className = 'step-badge';
                wrapper.dataset.step = step;
                Object.assign(wrapper.style, { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', position: 'relative' });

                const circle = document.createElement('div');
                Object.assign(circle.style, {
                    width: '32px', height: '32px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 'bold', color: 'white', transition: 'all 0.3s'
                });

                const text = document.createElement('span');
                text.textContent = label;
                text.style.fontSize = '0.85rem';
                text.style.transition = 'all 0.3s';

                wrapper.appendChild(circle);
                wrapper.appendChild(text);
                return wrapper;
            };

            header.appendChild(renderStepBadge(1, 'Configuração e Público'));
            header.appendChild(renderStepBadge(2, 'Mensagem'));
            header.appendChild(renderStepBadge(3, 'Confirmação e Disparo'));

            // Body
            const body = document.createElement('div');
            body.style.flex = '1';
            body.style.position = 'relative';
            body.style.overflow = 'hidden';

            // STEP 1: CONFIG & AUDIENCE
            const renderStep1 = () => {
                const stepContainer = document.createElement('div');
                Object.assign(stepContainer.style, { display: 'flex', flexDirection: 'column', height: '100%', padding: '1rem' });

                // Top: Config Form (Compact Layout)
                const formDiv = document.createElement('div');
                Object.assign(formDiv.style, {
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'flex-end',
                    gap: '1rem',
                    marginBottom: '1rem',
                    padding: '1rem',
                    backgroundColor: '#fff',
                    borderBottom: '1px solid #eee'
                });

                formDiv.innerHTML = `
                    <div class="form-group" style="flex: 1 1 40%; min-width:220px; max-width:600px;">
                        <label style="font-size:0.85rem; color:#666; display:block; margin-bottom:4px;">Nome da Campanha (V3) *</label>
                        <input type="text" id="campaign-name" class="form-input" value="${state.config.nome}" placeholder="Ex: Promoção de Natal (V3)" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;" />
                    </div>
                    <div class="form-group" style="width: 140px;">
                        <label style="font-size:0.85rem; color:#666; display:block; margin-bottom:4px;">Início</label>
                        <input type="date" id="campaign-start" class="form-input" value="${state.config.dataInicio}" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;" />
                    </div>
                    <div class="form-group" style="width: 140px;">
                        <label style="font-size:0.85rem; color:#666; display:block; margin-bottom:4px;">Fim</label>
                        <input type="date" id="campaign-end" class="form-input" value="${state.config.dataFim}" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;" />
                    </div>
                    <div class="form-group" style="display:flex; gap:1rem; align-items:center; white-space:nowrap; flex-shrink:0;">
                         <label style="display:flex; align-items:center; cursor:pointer; font-size:0.9rem; user-select:none; white-space: nowrap;">
                            <input type="checkbox" id="check-use-email" ${state.config.useEmail ? 'checked' : ''} style="margin-right:6px; width:16px; height:16px;">
                            <span>📧 E-mail</span>
                         </label>
                         <label style="display:flex; align-items:center; cursor:pointer; font-size:0.9rem; user-select:none; white-space: nowrap;">
                            <input type="checkbox" id="check-use-whatsapp" ${state.config.useWhatsapp ? 'checked' : ''} style="margin-right:6px; width:16px; height:16px;">
                            <span>💬 WhatsApp</span>
                         </label>
                    </div>
                `;

                // Split View: Tree + List
                const splitDiv = document.createElement('div');
                Object.assign(splitDiv.style, { display: 'flex', flex: '1', gap: '1rem', overflow: 'hidden' });

                // Tree Column
                const treeCol = document.createElement('div');
                Object.assign(treeCol.style, { width: '350px', border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', backgroundColor: '#fafafa' });
                treeCol.innerHTML = `<div style="padding:0.75rem; background:#f8f9fa; border-bottom:1px solid #eee; font-weight:600; font-size:0.9rem; color:#444;">Grupos (Origem)</div>`;

                const treeContent = document.createElement('div');
                Object.assign(treeContent.style, { flex: '1', overflowY: 'auto', padding: '0.5rem' });
                treeContent.id = 'wizard-tree-content';
                treeCol.appendChild(treeContent);
                treeContainerRef = treeContent; // Save Ref

                // List Column (Preview)
                const listCol = document.createElement('div');
                Object.assign(listCol.style, { flex: '1', border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', backgroundColor: 'white' });
                listCol.innerHTML = `
                    <div style="padding:0.75rem; background:#f8f9fa; border-bottom:1px solid #eee; font-weight:600; font-size:0.9rem; color:#444; display:flex; justify-content:space-between; align-items:center;">
                        <span>Leads Selecionados (Preview)</span>
                        <span id="wizard-lead-count" style="background:#e0e7ff; color:#4338ca; padding:2px 10px; border-radius:12px; font-size:0.75rem; font-weight:bold;">0 leads</span>
                    </div>
                `;

                const listContent = document.createElement('div');
                Object.assign(listContent.style, { flex: '1', overflowY: 'auto' });
                listContent.id = 'wizard-leads-table';
                listCol.appendChild(listContent);

                splitDiv.appendChild(treeCol);
                splitDiv.appendChild(listCol);

                stepContainer.appendChild(formDiv);
                stepContainer.appendChild(splitDiv);

                // Initialize Logic
                setTimeout(() => {
                    loadGroups(treeContent);
                    bindFormEvents(formDiv);
                }, 0);

                return stepContainer;
            };



            const bindFormEvents = (div) => {
                div.querySelectorAll('input').forEach(input => {
                    input.onchange = (e) => { // Use onchange for checkboxes
                        if (e.target.id === 'campaign-name') state.config.nome = e.target.value;
                        // Description if present? I removed it in my replacement above relative to original.
                        // Let's restore description logic if I want to keep it, but the layout above didn't include it.
                        // I'll re-add description field to the HTML to be safe.
                        if (e.target.id === 'campaign-start') state.config.dataInicio = e.target.value;
                        if (e.target.id === 'campaign-end') state.config.dataFim = e.target.value;
                        if (e.target.id === 'check-use-email') state.config.useEmail = e.target.checked;
                        if (e.target.id === 'check-use-whatsapp') state.config.useWhatsapp = e.target.checked;
                    };
                });
            };

            // Loading Groups and Building Tree
            const loadGroups = async (container) => {
                try {
                    const res = await fetch(`${API_BASE_URL}/marketing/grupos-leads`, { headers: getHeaders() });
                    if (!res.ok) throw new Error('Falha ao carregar grupos');
                    const groups = await res.json();

                    const realRoots = buildTree(groups);
                    // Virtual Root
                    treeRoot = {
                        id: 'ALL',
                        nome: 'Todos os Leads',
                        children: realRoots,
                        expanded: true, // Auto expand root
                        total_leads: groups.find(g => g.id === 'ALL')?.total_leads || groups.reduce((acc, g) => acc + (g.total_leads || 0), 0) // Approx
                    };

                    refreshTree();
                } catch (e) {
                    container.innerHTML = `<div style="color:red; padding:1rem;">Erro: ${e.message}</div>`;
                }
            };

            const refreshTree = () => {
                if (!treeContainerRef || !treeRoot) return;
                treeContainerRef.innerHTML = '';
                treeContainerRef.appendChild(renderGroupNode(treeRoot));
            };

            const buildTree = (items) => {
                const map = {};
                const roots = [];
                items.forEach(i => map[i.id] = { ...i, children: [] });
                items.forEach(i => {
                    if (i.parent_id && map[i.parent_id]) map[i.parent_id].children.push(map[i.id]);
                    else roots.push(map[i.id]);
                });
                return roots;
            };

            const renderGroupNode = (node, level = 0) => {
                const div = document.createElement('div');
                div.className = 'group-node';

                const row = document.createElement('div');
                row.className = 'group-row';

                // V3: Check selection simple (Toggle handles recursion)
                const isSelected = state.groups.has(node.id);

                Object.assign(row.style, {
                    display: 'flex', alignItems: 'center', padding: '8px 12px',
                    cursor: 'pointer', borderBottom: '1px solid #f0f0f0',
                    userSelect: 'none', transition: 'background 0.2s',
                    backgroundColor: isSelected ? '#e0f2fe' : 'transparent'
                });

                row.onmouseover = () => { if (!isSelected) row.style.backgroundColor = '#f9fafb'; };
                row.onmouseout = () => { if (!isSelected) row.style.backgroundColor = 'transparent'; };

                // Indent
                const indent = document.createElement('div');
                indent.style.width = `${level * 1.5}rem`;
                row.appendChild(indent);

                const hasChildren = node.children && node.children.length > 0;

                // Toggle Icon
                const toggleIcon = document.createElement('span');
                Object.assign(toggleIcon.style, {
                    width: '20px', display: 'inline-flex', justifyContent: 'center',
                    marginRight: '4px', color: '#6b7280', fontSize: '0.7rem'
                });

                if (hasChildren) {
                    if (node.expanded === undefined) node.expanded = true;
                    toggleIcon.textContent = node.expanded ? '▼' : '▶';
                    toggleIcon.style.cursor = 'pointer';
                    toggleIcon.onclick = (e) => {
                        e.stopPropagation();
                        node.expanded = !node.expanded;
                        refreshTree();
                    };
                } else {
                    toggleIcon.innerHTML = '&nbsp;';
                }
                row.appendChild(toggleIcon);

                // Checkbox
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = isSelected;
                checkbox.style.marginRight = '8px';
                checkbox.style.cursor = 'pointer';
                checkbox.onclick = (e) => {
                    e.stopPropagation();
                    toggleGroup(node, checkbox.checked);
                };
                row.appendChild(checkbox);

                // Folder Icon (ALWAYS)
                const folderIcon = document.createElement('span');
                folderIcon.className = 'folder-icon';
                folderIcon.textContent = node.expanded ? '📂' : '📁';
                folderIcon.style.marginRight = '8px';
                row.appendChild(folderIcon);

                // Label
                const label = document.createElement('span');
                label.className = 'group-name-span';
                label.textContent = `${node.nome} (${node.total_leads || 0})`;
                label.style.flex = '1';
                label.style.fontWeight = isSelected ? '600' : '400';
                label.style.color = isSelected ? 'var(--color-primary)' : 'inherit';
                row.appendChild(label);

                // Allow row click to select
                row.onclick = () => {
                    const newState = !isSelected;
                    toggleGroup(node, newState);
                };

                div.appendChild(row);

                if (hasChildren && node.expanded) {
                    const childrenDiv = document.createElement('div');
                    childrenDiv.className = 'group-children';
                    node.children.forEach(child => childrenDiv.appendChild(renderGroupNode(child, level + 1)));
                    div.appendChild(childrenDiv);
                }

                return div;
            };

            const toggleGroupRecursive = (node, checked) => {
                if (checked) state.groups.add(node.id);
                else state.groups.delete(node.id);

                if (node.children) {
                    node.children.forEach(child => toggleGroupRecursive(child, checked));
                }
            };

            const toggleGroup = (node, checked) => {
                toggleGroupRecursive(node, checked);
                refreshTree();
                updateLeadsPreview();
            };

            const updateLeadsPreview = async () => {
                const tableContainer = document.getElementById('wizard-leads-table');
                if (!tableContainer) return;

                // Show loading?

                if (state.groups.size === 0) {
                    renderLeadsTable([]);
                    return;
                }

                const response = await fetch(`${API_BASE_URL}/marketing/leads?grupos=${Array.from(state.groups).join(',')}`, {
                    headers: getHeaders()
                });

                if (response.ok) {
                    state.leads = await response.json();
                    document.getElementById('wizard-lead-count').textContent = `${state.leads.length} leads`;
                    renderLeadsTable(state.leads);
                }
            };

            const renderLeadsTable = (leads) => {
                const tableContainer = document.getElementById('wizard-leads-table');
                tableContainer.innerHTML = '';
                // Enforce compact mode for SharedTable via CSS variable
                tableContainer.style.setProperty('--row-padding', '4px 8px');

                const columns = [
                    { key: 'nome', label: 'Nome' },
                    { key: 'email', label: 'Email' },
                    { key: 'telefone', label: 'Telefone' }
                ];

                new SharedTable({
                    container: tableContainer,
                    columns: columns,
                    data: leads,
                    compact: true // Logic handled by CSS var above
                });
            };

            // STEP 2: MESSAGE
            const renderStep2 = () => {
                const stepContainer = document.createElement('div');
                Object.assign(stepContainer.style, { display: 'flex', height: '100%', overflow: 'hidden' });

                // Left: Editors (Tabs)
                const editorPanel = document.createElement('div');
                Object.assign(editorPanel.style, { width: '50%', borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column' });

                // Tab Headers
                const tabsDiv = document.createElement('div');
                tabsDiv.style.display = 'flex';
                tabsDiv.style.borderBottom = '1px solid #ddd';

                let tabsHtml = '';
                if (state.config.useEmail) {
                    tabsHtml += `<button class="tab-btn" data-tab="email" style="flex:1; padding:1rem; border:none; background:#f8f9fa; cursor:pointer; color:#666;">📧 E-mail</button>`;
                }
                if (state.config.useWhatsapp) {
                    tabsHtml += `<button class="tab-btn" data-tab="whatsapp" style="flex:1; padding:1rem; border:none; background:#f8f9fa; cursor:pointer; color:#666;">💬 WhatsApp</button>`;
                }
                tabsDiv.innerHTML = tabsHtml;

                // Content Area
                const contentDiv = document.createElement('div');
                contentDiv.style.flex = '1';
                contentDiv.style.padding = '1.5rem';
                contentDiv.style.overflowY = 'auto';

                const emailEditor = document.createElement('div');
                emailEditor.id = 'editor-email';
                emailEditor.style.display = 'none';
                emailEditor.innerHTML = `
                    <div class="form-group">
                        <label>Assunto</label>
                        <input type="text" id="msg-email-subject" class="form-input" value="${state.message.emailSubject}" placeholder="Assunto do e-mail..." />
                    </div>
                    <div class="form-group">
                        <label>Corpo do E-mail</label>
                        <textarea id="msg-email-body" class="form-input" rows="15" placeholder="Olá {{nome}}, ...">${state.message.emailBody}</textarea>
                        <div style="font-size:0.8rem; color:#666; margin-top:0.5rem;">Variáveis disponíveis: {{nome}}, {{empresa}}</div>
                    </div>
                `;

                const whatsappEditor = document.createElement('div');
                whatsappEditor.id = 'editor-whatsapp';
                whatsappEditor.style.display = 'none';
                whatsappEditor.innerHTML = `
                    <div class="form-group">
                        <label>Mensagem WhatsApp</label>
                        <textarea id="msg-whatsapp-text" class="form-input" rows="15" placeholder="Olá {{nome}}, ...">${state.message.whatsappText}</textarea>
                        <div style="font-size:0.8rem; color:#666; margin-top:0.5rem;">Variáveis disponíveis: {{nome}}, {{empresa}}</div>
                    </div>
                `;

                if (state.config.useEmail) contentDiv.appendChild(emailEditor);
                if (state.config.useWhatsapp) contentDiv.appendChild(whatsappEditor);

                editorPanel.appendChild(tabsDiv);
                editorPanel.appendChild(contentDiv);

                // Right: Preview
                const previewPanel = document.createElement('div');
                Object.assign(previewPanel.style, { flex: '1', backgroundColor: '#e5ddd5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' });

                // Phone Frame for WA / Card for Email
                const previewCard = document.createElement('div');
                Object.assign(previewCard.style, { width: '360px', height: '600px', backgroundColor: 'white', borderRadius: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column' });

                const previewHeader = document.createElement('div');
                Object.assign(previewHeader.style, { padding: '1rem', background: '#075e54', color: 'white', fontWeight: 'bold' });
                previewHeader.id = 'preview-header';
                previewHeader.textContent = 'Preview';

                const previewBody = document.createElement('div');
                Object.assign(previewBody.style, { flex: '1', padding: '1rem', overflowY: 'auto', fontSize: '0.9rem', whiteSpace: 'pre-wrap' });
                previewBody.id = 'preview-body';

                previewCard.appendChild(previewHeader);
                previewCard.appendChild(previewBody);
                previewPanel.appendChild(previewCard);

                stepContainer.appendChild(editorPanel);
                stepContainer.appendChild(previewPanel);

                // Logic
                const updatePreview = (type) => {
                    const header = type === 'email' ? state.message.emailSubject || 'Sem Assunto' : 'WhatsApp Preview';
                    const body = type === 'email' ? state.message.emailBody : state.message.whatsappText;

                    previewHeader.textContent = header;
                    previewHeader.style.background = type === 'email' ? '#4a5568' : '#075e54';
                    previewBody.textContent = body || '(Digite para visualizar...)';

                    // Simple variable replacement preview
                    const demoName = state.leads[0]?.nome || 'João Silva';
                    previewBody.textContent = previewBody.textContent.replace(/{{nome}}/g, demoName);
                };

                // Tab Switching
                const activateTab = (tab) => {
                    tabsDiv.querySelectorAll('.tab-btn').forEach(b => {
                        b.style.background = '#f8f9fa';
                        b.style.borderBottom = 'none';
                        b.style.color = '#666';
                        b.classList.remove('active');
                    });

                    const btn = tabsDiv.querySelector(`[data-tab="${tab}"]`);
                    if (btn) {
                        btn.style.background = 'white';
                        btn.style.borderBottom = '2px solid var(--color-primary)';
                        btn.style.color = 'black';
                        btn.classList.add('active');
                    }

                    if (emailEditor) emailEditor.style.display = tab === 'email' ? 'block' : 'none';
                    if (whatsappEditor) whatsappEditor.style.display = tab === 'whatsapp' ? 'block' : 'none';

                    updatePreview(tab);
                    stepContainer.dataset.activeTab = tab;
                };

                tabsDiv.querySelectorAll('.tab-btn').forEach(btn => {
                    btn.onclick = () => activateTab(btn.dataset.tab);
                });

                // Input Events
                setTimeout(() => {
                    // Default Tab: First enabled one
                    let initialTab = '';
                    if (state.config.useEmail) initialTab = 'email';
                    else if (state.config.useWhatsapp) initialTab = 'whatsapp';

                    stepContainer.dataset.activeTab = initialTab;
                    if (initialTab) activateTab(initialTab);

                    const inputs = stepContainer.querySelectorAll('input, textarea');
                    inputs.forEach(input => {
                        input.oninput = (e) => {
                            if (e.target.id === 'msg-email-subject') state.message.emailSubject = e.target.value;
                            if (e.target.id === 'msg-email-body') state.message.emailBody = e.target.value;
                            if (e.target.id === 'msg-whatsapp-text') state.message.whatsappText = e.target.value;

                            updatePreview(stepContainer.dataset.activeTab);
                        };
                    });
                }, 0);

                return stepContainer;
            };

            // STEP 3: EXECUTION
            const renderStep3 = () => {
                const stepContainer = document.createElement('div');
                Object.assign(stepContainer.style, { display: 'flex', flexDirection: 'column', height: '100%', padding: '1rem', overflow: 'hidden' });

                // Summary
                const emailStatus = state.config.useEmail ? (state.message.emailSubject ? 'Pronto' : 'Pendente') : 'Não Habilitado';
                const whatsappStatus = state.config.useWhatsapp ? (state.message.whatsappText ? 'Pronto' : 'Pendente') : 'Não Habilitado';

                const summaryDiv = document.createElement('div');
                summaryDiv.style.marginBottom = '1.5rem';
                summaryDiv.innerHTML = `
                    <div style="background:#f0f9ff; padding:1rem; border-radius:8px; border:1px solid #bae6fd;">
                        <h3 style="margin:0 0 0.5rem 0; color:var(--color-primary);">${state.config.nome || 'Campanha Sem Nome'}</h3>
                        <div style="display:flex; gap:2rem; font-size:0.9rem;">
                            <span>👥 <b>Leads:</b> ${state.leads.length}</span>
                            <span>📧 <b>E-mail:</b> ${emailStatus}</span>
                            <span>💬 <b>WhatsApp:</b> ${whatsappStatus}</span>
                        </div>
                    </div>
                `;

                // Progress Area
                const progressContainer = document.createElement('div');
                Object.assign(progressContainer.style, { display: 'flex', gap: '1rem', flex: '1', overflow: 'hidden' });

                const renderColumn = (title, icon, type) => {
                    const col = document.createElement('div');
                    Object.assign(col.style, { flex: '1', border: '1px solid #ddd', borderRadius: '8px', display: 'flex', flexDirection: 'column', backgroundColor: 'white' });

                    // Visual cue if disabled
                    const isEnabled = (type === 'email' && state.config.useEmail) || (type === 'whatsapp' && state.config.useWhatsapp);
                    if (!isEnabled) {
                        col.style.opacity = '0.5';
                        col.style.backgroundColor = '#f0f0f0';
                    }

                    col.innerHTML = `
                        <div style="padding:0.75rem; background:#f8f9fa; border-bottom:1px solid #ddd; font-weight:bold; display:flex; align-items:center;">
                            <span style="margin-right:0.5rem;">${icon}</span> ${title} ${!isEnabled ? '(Desativado)' : ''}
                        </div>
                        <div id="progress-list-${type}" style="flex:1; overflow-y:auto; padding:0.5rem;">
                            <!-- Items will be injected here -->
                        </div>
                    `;
                    return col;
                };

                const emailCol = renderColumn('Envio de E-mails', '📧', 'email');
                const waCol = renderColumn('Envio de WhatsApp', '💬', 'whatsapp');

                progressContainer.appendChild(emailCol);
                progressContainer.appendChild(waCol);

                stepContainer.appendChild(summaryDiv);
                stepContainer.appendChild(progressContainer);

                // Initialize List
                setTimeout(() => {
                    renderProgressItems('email');
                    renderProgressItems('whatsapp');
                }, 0);

                return stepContainer;
            };

            const renderProgressItems = (type) => {
                const list = document.getElementById(`progress-list-${type}`);
                if (!list) return;
                list.innerHTML = '';

                // If disabled, maybe show just one item saying "Ignored"? Or list all as ignored?
                const isEnabled = (type === 'email' && state.config.useEmail) || (type === 'whatsapp' && state.config.useWhatsapp);

                state.leads.forEach(lead => {
                    const item = document.createElement('div');
                    item.id = `item-${type}-${lead.id}`;
                    item.style.padding = '8px';
                    item.style.borderBottom = '1px solid #eee';
                    item.style.fontSize = '0.9rem';
                    item.style.display = 'flex';
                    item.style.justifyContent = 'space-between';

                    const statusText = isEnabled ? 'Pendente' : 'Ignorado';
                    const statusColor = isEnabled ? '#666' : '#aaa';

                    item.innerHTML = `
                        <span>${lead.nome}</span>
                        <span class="status-badge" style="color:${statusColor};">${statusText}</span>
                    `;
                    list.appendChild(item);
                });
            };

            // Execution Logic
            const startExecution = async () => {
                const btn = footer.querySelector('button.btn-primary');
                if (btn) btn.disabled = true;
                btn.textContent = 'Salvando e Iniciando...';

                let campaignId = null;

                // 1. Save Campaign
                try {
                    if (onSave) {
                        const payload = {
                            ...state.config,
                            leadsIds: state.leads.map(l => l.id),
                            message: state.message
                        };
                        const savedCampaign = await onSave(payload);
                        if (savedCampaign && savedCampaign.id) {
                            campaignId = savedCampaign.id;
                        } else {
                            // If ID not returned (legacy controller?), we might have an issue.
                            // But we updated CampanhasManager to return it.
                            console.warn("Sem ID salvo, tentando prosseguir (risco de falha)...", savedCampaign);
                            // Fallback if needed? 
                        }
                    }
                } catch (e) {
                    console.error(e);
                    showToast('Erro ao salvar campanha: ' + (e.message || 'Erro desconhecido'), 'error');
                    if (btn) {
                        btn.disabled = false;
                        btn.textContent = 'Iniciar Disparos';
                    }
                    return;
                }

                if (!campaignId) {
                    showToast('Erro: ID da campanha não obtido. Não é possível enviar.', 'error');
                    if (btn) {
                        btn.disabled = false;
                        btn.textContent = 'Iniciar Disparos';
                    }
                    return;
                }

                btn.textContent = 'Enviando...';

                // 2. Loop through leads and execute sending
                for (const lead of state.leads) {
                    // Send Email
                    if (state.config.useEmail) {
                        await executeSend(campaignId, lead.id, 'email');
                    }

                    // Send WhatsApp
                    if (state.config.useWhatsapp) {
                        await executeSend(campaignId, lead.id, 'whatsapp');
                    }
                }

                showToast('Disparos concluídos!', 'success');
                if (btn) btn.textContent = 'Concluído';
            };

            const executeSend = async (campaignId, leadId, channel) => {
                updateStatusItem(channel, leadId, 'Enviando...', 'orange');

                try {
                    const res = await fetch(`${API_BASE_URL}/marketing/campanhas/${campaignId}/disparar`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({ leadId, channel })
                    });

                    if (res.ok) {
                        updateStatusItem(channel, leadId, 'OK', 'green', true);
                    } else {
                        const err = await res.json();
                        updateStatusItem(channel, leadId, 'Falha', 'red', true);
                        console.error(`Falha ${channel} lead ${leadId}:`, err);
                    }
                } catch (e) {
                    updateStatusItem(channel, leadId, 'Erro', 'red', true);
                    console.error(`Erro ${channel} lead ${leadId}:`, e);
                }
            };

            const updateStatusItem = (channel, leadId, text, color, bold = false) => {
                const el = document.getElementById(`item-${channel}-${leadId}`);
                if (!el) return;
                const badge = el.querySelector('.status-badge');
                if (badge) {
                    badge.textContent = text;
                    badge.style.color = color;
                    badge.style.fontWeight = bold ? 'bold' : 'normal';
                }
            };

            // --- NAVIGATION ---
            const footer = document.createElement('div');
            Object.assign(footer.style, {
                padding: '1rem', borderTop: '1px solid #ddd', display: 'flex', justifyContent: 'flex-end', gap: '1rem', backgroundColor: '#f8f9fa'
            });

            const btnBack = document.createElement('button');
            btnBack.className = 'btn-secondary';
            btnBack.textContent = 'Voltar';
            btnBack.onclick = () => { if (currentStep > 1) updateStep(currentStep - 1); };

            const btnNext = document.createElement('button');
            btnNext.className = 'btn-primary';
            btnNext.textContent = 'Próximo';
            btnNext.onclick = () => {
                if (currentStep === 1) {
                    if (!state.config.nome) { showToast('Nome da campanha obrigatório', 'warning'); return; }
                    if (state.groups.size === 0) { showToast('Selecione ao menos um grupo', 'warning'); return; }
                    if (!state.config.useEmail && !state.config.useWhatsapp) { showToast('Selecione ao menos um canal de envio', 'warning'); return; }
                }

                if (currentStep < 3) {
                    updateStep(currentStep + 1);
                } else {
                    // Step 3: Start
                    startExecution();
                }
            };


            footer.appendChild(btnBack);
            footer.appendChild(btnNext);


            const updateStep = (step) => {
                currentStep = step;
                // Update Stepper UI
                header.querySelectorAll('.step-badge').forEach(b => {
                    const s = parseInt(b.dataset.step);
                    const circle = b.querySelector('div');
                    const label = b.querySelector('span');
                    if (s === step) {
                        circle.style.background = 'var(--color-primary)';
                        label.style.color = 'var(--color-primary)';
                        label.style.fontWeight = '600';
                    } else if (s < step) {
                        circle.style.background = '#10b981'; // Completed
                        circle.textContent = '✓';
                        label.style.color = '#10b981';
                    } else {
                        circle.style.background = '#ccc';
                        circle.textContent = s;
                        label.style.color = '#ccc';
                    }
                });

                body.innerHTML = '';
                if (step === 1) body.appendChild(renderStep1());
                else if (step === 2) body.appendChild(renderStep2());
                else if (step === 3) body.appendChild(renderStep3());

                // Button State
                btnBack.style.visibility = step === 1 ? 'hidden' : 'visible';
                btnNext.textContent = step === 3 ? 'Iniciar Disparos' : 'Próximo';
            };


            // ASSEMBLE
            content.appendChild(header);
            content.appendChild(body);
            content.appendChild(footer);
            container.appendChild(content);
            document.body.appendChild(container);

            // Helpers
            const getHeaders = () => ({
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            });

            const close = () => {
                document.body.removeChild(container);
                resolve(null);
            };

            container.querySelector('#btn-close-wizard').onclick = close;

            // Init
            updateStep(1);
        });
    }
};
