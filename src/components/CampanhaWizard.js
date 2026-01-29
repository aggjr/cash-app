import { SharedTable } from './SharedTable.js';
import Quill from 'quill';
import BlotFormatter from 'quill-blot-formatter';
import 'quill/dist/quill.snow.css';

Quill.register('modules/blotFormatter', BlotFormatter);
import { showToast } from '../utils/toast.js';
import { startOfWeek } from 'date-fns'; // Unused but likely available, or just ignore
import { getApiBaseUrl } from '../utils/apiConfig.js';

// --- CUSTOM VIDEO BLOT FOR QUILL ---
const BlockEmbed = Quill.import('blots/block/embed');
class VideoBlot extends BlockEmbed {
    static create(value) {
        let node = super.create();
        node.setAttribute('src', value);
        node.setAttribute('controls', '');
        node.setAttribute('preload', 'metadata');
        node.setAttribute('width', '100%');
        node.setAttribute('style', 'max-width: 100%; border-radius: 8px; margin: 10px 0; background-color: #000;');
        return node;
    }

    static value(node) {
        return node.getAttribute('src');
    }
}
VideoBlot.blotName = 'video-file';
VideoBlot.tagName = 'video';
Quill.register(VideoBlot);
// -----------------------------------

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
                width: '95%', height: '96vh', backgroundColor: 'white',
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
                    useWhatsapp: true,
                    dispatchIntervalSeconds: 120
                },
                groups: new Set(), // Set of selected Group IDs
                leads: [], // Preview leads
                message: {
                    emailSubject: '',
                    emailBody: '',
                    whatsappText: '',
                    mediaUrl: '' // NEW: Media URL
                },
                expandedGroups: new Set(['ALL']) // Tree View State
            };

            let treeRoot = null;
            let treeContainerRef = null;

            const header = document.createElement('div');
            Object.assign(header.style, {
                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '3rem',
                padding: '1.5rem', borderBottom: '1px solid #eee', backgroundColor: '#fff',
                position: 'relative'
            });

            const btnClose = document.createElement('button');
            btnClose.id = 'btn-close-wizard';
            btnClose.innerHTML = '×';
            Object.assign(btnClose.style, {
                position: 'absolute', top: '1rem', right: '1rem',
                background: 'none', border: 'none', fontSize: '1.5rem',
                color: '#999', cursor: 'pointer', lineHeight: 1
            });
            header.appendChild(btnClose);

            const renderStepBadge = (step, label) => {
                // ... unchanged
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

            header.appendChild(renderStepBadge(1, 'Mensagem e Canais'));
            header.appendChild(renderStepBadge(2, 'Configuração e Público'));
            header.appendChild(renderStepBadge(3, 'Confirmação e Disparo'));

            // Body
            const body = document.createElement('div');
            body.style.flex = '1';
            body.style.position = 'relative';
            body.style.overflow = 'hidden';

            // STEP 1 UNCHANGED ... (Ommitting mainly)

            const renderStep1 = () => {
                // ... (Original content of renderStep1)
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
                    <div style="font-weight:600; color:#444;">Canais de Envio:</div>
                    <label style="display:flex; alignItems:center; cursor:pointer;">
                        <input type="checkbox" id="check-use-email" ${state.config.useEmail ? 'checked' : ''} style="margin-right:8px; transform:scale(1.2);">
                        <span>E-mail</span>
                    </label>
                    <label style="display:flex; alignItems:center; cursor:pointer;">
                        <input type="checkbox" id="check-use-whatsapp" ${state.config.useWhatsapp ? 'checked' : ''} style="margin-right:8px; transform:scale(1.2);">
                        <span>WhatsApp</span>
                    </label>
                `;

                // Main Area
                const mainArea = document.createElement('div');
                Object.assign(mainArea.style, { display: 'flex', flex: '1', overflow: 'hidden' });

                // Left: Editors (Tabs)
                const editorPanel = document.createElement('div');
                Object.assign(editorPanel.style, { width: '60%', borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column' });

                const tabsDiv = document.createElement('div');
                tabsDiv.style.display = 'flex';
                tabsDiv.style.borderBottom = '1px solid #ddd';

                const renderTabs = () => {
                    let tabsHtml = '';
                    if (state.config.useEmail) tabsHtml += `<button class="tab-btn" data-tab="email" style="flex:1; padding:1rem; border:none; background:#f8f9fa; cursor:pointer; color:#666;">📧 E-mail</button>`;
                    if (state.config.useWhatsapp) tabsHtml += `<button class="tab-btn" data-tab="whatsapp" style="flex:1; padding:1rem; border:none; background:#f8f9fa; cursor:pointer; color:#666;">💬 WhatsApp</button>`;
                    if (!tabsHtml) tabsHtml = `<div style="padding:1rem; color:#999; width:100%; text-align:center;">Nenhum canal selecionado</div>`;
                    tabsDiv.innerHTML = tabsHtml;
                };
                renderTabs();

                const contentDiv = document.createElement('div');
                contentDiv.style.flex = '1';
                contentDiv.style.padding = '1.5rem';
                contentDiv.style.overflowY = 'auto';

                const emailEditor = document.createElement('div');
                emailEditor.id = 'editor-email';
                emailEditor.style.display = 'none';
                emailEditor.innerHTML = `
                    <div class="form-group">
                        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:4px;">
                            <label>Assunto</label>
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span id="email-upload-status" style="font-size:0.75rem; color:#666; display:none;">Enviando...</span>
                                <button id="btn-email-upload" class="btn-secondary" style="font-size:0.75rem; padding: 4px 10px; display:flex; align-items:center; gap:4px; height:28px;"><span>📷/🎥</span> Inserir Mídia</button>
                                <input type="file" id="email-media-input" accept="image/*,video/*" style="display: none;" />
                            </div>
                        </div>
                        <input type="text" id="msg-email-subject" class="form-input" value="${state.message.emailSubject}" placeholder="Assunto do e-mail..." />
                    </div>
                    <div class="form-group"><label>Corpo do E-mail</label><div id="editor-email-container" style="min-height:320px; background:white;"></div></div>
                `;

                const whatsappEditor = document.createElement('div');
                whatsappEditor.id = 'editor-whatsapp';
                whatsappEditor.style.display = 'none';
                whatsappEditor.innerHTML = `
                    <div class="form-group">
                         <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:4px;">
                            <label>Mensagem WhatsApp</label>
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span id="whatsapp-upload-status" style="font-size:0.75rem; color:#666; display:none;">Enviando...</span>
                                <button id="btn-whatsapp-upload" class="btn-secondary" style="font-size:0.75rem; padding: 4px 10px; display:flex; align-items:center; gap:4px; height:28px;"><span>📷/🎥</span> Inserir Mídia</button>
                                <input type="file" id="whatsapp-media-input" accept="image/*,video/*" style="display: none;" />
                            </div>
                        </div>
                        <div id="editor-whatsapp-container" style="min-height:320px; background:white;"></div>
                        <div style="font-size:0.8rem; color:#666; margin-top:0.5rem;">Variáveis disponíveis: {{nome}}, {{empresa}}. Use *negrito* para texto.</div>
                    </div>
                `;

                contentDiv.appendChild(emailEditor);
                contentDiv.appendChild(whatsappEditor);
                editorPanel.appendChild(tabsDiv);
                editorPanel.appendChild(contentDiv);

                // Right: Preview
                const previewPanel = document.createElement('div');
                Object.assign(previewPanel.style, { flex: '1', backgroundColor: '#e5ddd5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' });
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

                mainArea.appendChild(editorPanel);
                mainArea.appendChild(previewPanel);
                stepContainer.appendChild(mainArea);

                // LOGIC Helper Functions (defined inside renderStep1 to capture closures)
                const updateTabsVisibility = () => {
                    renderTabs();
                    tabsDiv.querySelectorAll('.tab-btn').forEach(btn => btn.onclick = () => activateTab(btn.dataset.tab));

                    if (state.config.useEmail && !state.config.useWhatsapp) activateTab('email');
                    else if (!state.config.useEmail && state.config.useWhatsapp) activateTab('whatsapp');
                    else if (state.config.useEmail && state.config.useWhatsapp) activateTab(stepContainer.dataset.activeTab || 'email');
                    else { emailEditor.style.display = 'none'; whatsappEditor.style.display = 'none'; }
                };

                const updatePreview = (type) => {
                    const header = type === 'email' ? state.message.emailSubject || 'Sem Assunto' : 'WhatsApp Preview';
                    const body = type === 'email' ? state.message.emailBody : state.message.whatsappText;
                    previewHeader.textContent = header;
                    previewHeader.style.background = type === 'email' ? '#4a5568' : '#075e54';
                    let contentHtml = body || '<span style="color:#aaa; font-style:italic;">(Digite para visualizar...)</span>';
                    if (type === 'whatsapp') {
                        // Extract images
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(body, 'text/html');
                        const img = doc.querySelector('img');
                        let textContent = contentHtml.replace(/<img[^>]+>/g, '').replace(/<[^>]+>/g, ' '); // Strip text only for formatting but keep structure? 

                        // Better approach: use regex on the raw HTML or cleaned text
                        // Quill returns HTML with <p>. We need to preserve lines but strip other tags for MD parsing?
                        // Or just parse existing text content.
                        // Let's rely on simple string replacement for now.

                        // 1. Remove HTML tags but keep line breaks
                        let rawText = contentHtml
                            .replace(/<br\s*\/?>/gi, '\n')
                            .replace(/<\/p>/gi, '\n\n')
                            .replace(/<[^>]+>/g, ''); // Strip remaining tags

                        // 2. Decode entities
                        const txt = document.createElement('textarea');
                        txt.innerHTML = rawText;
                        rawText = txt.value;

                        // 3. Markdowns
                        // Bold *text* -> <b>text</b>
                        rawText = rawText.replace(/\*(.*?)\*/g, '<b>$1</b>');
                        // Italic _text_ -> <i>text</i>
                        rawText = rawText.replace(/_(.*?)_/g, '<i>$1</i>');
                        // Strike ~text~ -> <s>text</s>
                        rawText = rawText.replace(/~(.*?)~/g, '<s>$1</s>');

                        // 4. Restore line breaks
                        contentHtml = rawText.replace(/\n/g, '<br>');

                        if (img) contentHtml = `<div style="margin-bottom:10px;"><img src="${img.src}" style="max-width:100%; border-radius:8px;"></div>` + contentHtml;
                        else if (doc.querySelector('video')) {
                            const video = doc.querySelector('video');
                            contentHtml = `<div style="margin-bottom:10px;"><video src="${video.getAttribute('src')}" controls style="max-width:100%; border-radius:8px; background: black;"></video></div>` + contentHtml;
                        }
                    }
                    previewBody.innerHTML = contentHtml.replace(/{{nome}}/g, state.leads[0]?.nome || 'João Silva');
                };

                const activateTab = (tab) => {
                    tabsDiv.querySelectorAll('.tab-btn').forEach(b => { b.style.background = '#f8f9fa'; b.style.borderBottom = 'none'; b.classList.remove('active'); });
                    const btn = tabsDiv.querySelector(`[data-tab="${tab}"]`);
                    if (btn) { btn.style.background = 'white'; btn.style.borderBottom = '2px solid var(--color-primary)'; btn.classList.add('active'); }
                    emailEditor.style.display = tab === 'email' ? 'block' : 'none';
                    whatsappEditor.style.display = tab === 'whatsapp' ? 'block' : 'none';
                    stepContainer.dataset.activeTab = tab;
                    updatePreview(tab);
                };

                // INITIALIZATION
                setTimeout(() => {
                    const checkEmail = formDiv.querySelector('#check-use-email');
                    const checkWa = formDiv.querySelector('#check-use-whatsapp');
                    if (checkEmail) checkEmail.onchange = (e) => { state.config.useEmail = e.target.checked; updateTabsVisibility(); };
                    if (checkWa) checkWa.onchange = (e) => { state.config.useWhatsapp = e.target.checked; updateTabsVisibility(); };

                    const subjectInput = emailEditor.querySelector('#msg-email-subject');
                    if (subjectInput) subjectInput.oninput = (e) => { state.message.emailSubject = e.target.value; updatePreview('email'); };
                    updateTabsVisibility();

                    // Init Editors
                    const emailToolbar = [['bold', 'italic', 'underline', 'strike'], [{ 'list': 'ordered' }, { 'list': 'bullet' }], [{ 'size': ['small', false, 'large', 'huge'] }], ['link', 'image']];
                    const whatsappToolbar = [['clean']];

                    if (document.getElementById('editor-email-container')) {
                        const quillEmail = new Quill('#editor-email-container', { theme: 'snow', placeholder: 'Conteúdo E-mail...', modules: { toolbar: emailToolbar, blotFormatter: {} } });
                        if (state.message.emailBody) quillEmail.root.innerHTML = state.message.emailBody;
                        quillEmail.on('text-change', () => { state.message.emailBody = quillEmail.root.innerHTML; if (stepContainer.dataset.activeTab === 'email') updatePreview('email'); });
                        const btnEmailUpload = emailEditor.querySelector('#btn-email-upload'); const inputEmailUpload = emailEditor.querySelector('#email-media-input');
                        if (btnEmailUpload && inputEmailUpload) {
                            btnEmailUpload.onclick = () => inputEmailUpload.click();
                            inputEmailUpload.onchange = async (e) => {
                                const file = e.target.files[0]; if (!file) return;
                                const formData = new FormData(); formData.append('file', file);
                                try {
                                    const res = await fetch(`${getApiBaseUrl()}/upload`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: formData });
                                    const data = await res.json();
                                    const fullUrl = data.fileUrl.startsWith('http') ? data.fileUrl : `${getApiBaseUrl()}${data.fileUrl}`;
                                    const range = quillEmail.getSelection(true) || { index: quillEmail.getLength(), length: 0 };

                                    if (file.type.startsWith('video/')) {
                                        quillEmail.insertEmbed(range.index, 'video-file', fullUrl);
                                    } else {
                                        quillEmail.insertEmbed(range.index, 'image', fullUrl);
                                    }
                                } catch (e) { console.error(e); } inputEmailUpload.value = '';
                            };
                        }
                    }

                    if (document.getElementById('editor-whatsapp-container')) {
                        const quillWhatsapp = new Quill('#editor-whatsapp-container', { theme: 'snow', placeholder: 'Mensagem WhatsApp...', modules: { toolbar: whatsappToolbar, blotFormatter: {} } });
                        if (state.message.whatsappText) quillWhatsapp.root.innerHTML = state.message.whatsappText;
                        quillWhatsapp.on('text-change', () => { state.message.whatsappText = quillWhatsapp.root.innerHTML; if (stepContainer.dataset.activeTab === 'whatsapp') updatePreview('whatsapp'); });
                        const btnWa = whatsappEditor.querySelector('#btn-whatsapp-upload'); const inputWa = whatsappEditor.querySelector('#whatsapp-media-input');
                        if (btnWa && inputWa) {
                            btnWa.onclick = () => inputWa.click();
                            inputWa.onchange = async (e) => {
                                const file = e.target.files[0]; if (!file) return;
                                const formData = new FormData(); formData.append('file', file);
                                try {
                                    const res = await fetch(`${getApiBaseUrl()}/upload`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: formData });
                                    const data = await res.json();
                                    const fullUrl = data.fileUrl.startsWith('http') ? data.fileUrl : `${getApiBaseUrl()}${data.fileUrl}`;
                                    const range = quillWhatsapp.getSelection(true) || { index: quillWhatsapp.getLength(), length: 0 };

                                    if (file.type.startsWith('video/')) {
                                        quillWhatsapp.insertEmbed(range.index, 'video-file', fullUrl);
                                    } else {
                                        quillWhatsapp.insertEmbed(range.index, 'image', fullUrl);
                                    }
                                } catch (e) { console.error(e); } inputWa.value = '';
                            };
                        }
                    }

                }, 50);

                return stepContainer;
            };

            // Helpers for Step 1
            // Tree Helpers
            let fetchedGroups = [];


            const buildTree = (items) => {
                const rootItems = [];
                const lookup = {};
                items.forEach(item => {
                    item.children = [];
                    lookup[item.id] = item;
                });
                items.forEach(item => {
                    if (item.parent_id && lookup[item.parent_id]) {
                        lookup[item.parent_id].children.push(item);
                    } else {
                        rootItems.push(item);
                    }
                });
                return rootItems;
            };

            const toggleExpand = (e, groupId) => {
                e.stopPropagation();
                if (state.expandedGroups.has(groupId)) state.expandedGroups.delete(groupId);
                else state.expandedGroups.add(groupId);
                renderTree();
            };

            const toggleGroupSelection = (e, group) => {
                if (e) e.stopPropagation();

                const isSelected = state.groups.has(group.id);
                // Toggle
                if (isSelected) {
                    state.groups.delete(group.id);
                    // Optional: Deselect children?
                    // For now, simple toggle.
                } else {
                    state.groups.add(group.id);
                    // Optional: Select children?
                }

                updateLeadsPreview();
                renderTree();
            };

            const renderGroupNode = (group, level = 0) => {
                const hasChildren = group.children && group.children.length > 0;
                const isExpanded = state.expandedGroups.has(group.id);
                const isSelected = state.groups.has(group.id);
                const paddingLeft = level * 1.5;

                // Container
                const nodeContainer = document.createElement('div');
                nodeContainer.className = 'group-node';

                // Row
                const row = document.createElement('div');
                row.className = 'group-row';
                Object.assign(row.style, {
                    display: 'flex', alignItems: 'center', padding: '6px 12px',
                    cursor: 'pointer', userSelect: 'none', borderBottom: '1px solid #f0f0f0',
                    backgroundColor: isSelected ? '#e0f2fe' : 'transparent',
                    transition: 'background-color 0.2s'
                });

                row.onmouseover = () => { if (!isSelected) row.style.backgroundColor = '#f9fafb'; };
                row.onmouseout = () => { if (!isSelected) row.style.backgroundColor = 'transparent'; };
                row.onclick = (e) => toggleGroupSelection(e, group);

                // Indent
                const indent = document.createElement('div');
                indent.style.width = `${paddingLeft}rem`;
                row.appendChild(indent);

                // Toggle Icon
                const toggleIcon = document.createElement('span');
                Object.assign(toggleIcon.style, {
                    width: '20px', display: 'inline-flex', justifyContent: 'center',
                    marginRight: '4px', color: '#6b7280', fontSize: '0.7rem'
                });

                if (hasChildren) {
                    toggleIcon.textContent = isExpanded ? '▼' : '▶';
                    toggleIcon.style.cursor = 'pointer';
                    toggleIcon.onclick = (e) => toggleExpand(e, group.id);
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
                    // Stop prop to avoid double toggle from row click
                    // Actually row click handles toggle. 
                    // If we click checkbox, it changes state, but row click handler also runs if propagation isn't stopped?
                    // If we stop prop, we must handle toggle here.
                    e.stopPropagation();
                    toggleGroupSelection(null, group);
                };
                row.appendChild(checkbox);

                // Folder Icon
                const folderIcon = document.createElement('span');
                folderIcon.textContent = isExpanded ? '📂' : '📁';
                folderIcon.style.marginRight = '8px';
                row.appendChild(folderIcon);

                // Name & Count
                const nameSpan = document.createElement('span');
                const countText = group.total_leads ? ` (${group.total_leads})` : ' (0)';
                nameSpan.textContent = `${group.nome}${countText}`;
                nameSpan.style.flex = '1';
                nameSpan.style.fontWeight = isSelected ? '600' : '400';
                nameSpan.style.color = isSelected ? 'var(--color-primary)' : 'inherit';
                row.appendChild(nameSpan);

                nodeContainer.appendChild(row);

                // Children
                if (hasChildren && isExpanded) {
                    const childrenContainer = document.createElement('div');
                    group.children.forEach(child => {
                        childrenContainer.appendChild(renderGroupNode(child, level + 1));
                    });
                    nodeContainer.appendChild(childrenContainer);
                }

                return nodeContainer;
            };

            const renderTree = () => {
                if (!treeContainerRef) return;
                treeContainerRef.innerHTML = '';

                // Add Styles if not present (inline styles used mostly, but classes help)
                // Assuming styles from main.css cover basics, or we rely on inline.

                if (fetchedGroups.length === 0) {
                    treeContainerRef.innerHTML = '<div style="padding:1rem; text-align:center; color:#666;">Nenhum grupo encontrado.</div>';
                    return;
                }

                const realRoots = buildTree(fetchedGroups);

                // Virtual Root: "Todos os Leads"
                // Assuming we want to show it as a selectable option? 
                // If selected, it selects ALL? logic in toggleGroupSelection might need to know.
                // For now, let's treat "Todos os Leads" as a group with ID 'ALL'.
                // If the backend expects actual group IDs, 'ALL' might be special.
                // updateLeadsPreview handles 'ALL' specifically?
                // The current updateLeadsPreview logic: `const groupIds = Array.from(state.groups).join(',');`
                // If 'ALL' is in Set, groupIds string includes 'ALL'.
                // Does backend `/marketing/leads?grupos=ALL` work?
                // I checked `loadGroups` previously, it didn't seem to have 'ALL'.
                // But `GruposLeadsManager` has.
                // Let's include it.

                const totalLeads = fetchedGroups.reduce((acc, g) => acc + (g.total_leads || 0), 0);
                // Note: sum of groups != total unique leads, but it's an estimation. 
                // Better: usage leads.length from a separate fetch? 
                // For now, let's use sum or just don't show count for ALL if unsure.

                const virtualRoot = {
                    id: 'ALL',
                    nome: 'Todos os Leads',
                    children: realRoots,
                    total_leads: '?' // We don't have total count handy without fetching all leads first.
                };

                // Manually render Root
                treeContainerRef.appendChild(renderGroupNode(virtualRoot));
            };

            const loadGroups = async (container) => {
                treeContainerRef = container;
                container.innerHTML = '<div style="padding:1rem; text-align:center; color:#666;">Carregando árvore de grupos...</div>';

                try {
                    const res = await fetch(`${API_BASE_URL}/marketing/grupos-leads`, { headers: getHeaders() });
                    if (!res.ok) throw new Error('Falha ao carregar grupos');
                    fetchedGroups = await res.json();

                    // Simple total count approximation or just 'ALL'
                    // renderTree will handle building structure
                    renderTree();

                } catch (e) {
                    console.error(e);
                    container.innerHTML = '<div style="padding:1rem; text-align:center; color:red;">Erro ao carregar grupos.</div>';
                }
            };

            const bindFormEvents = (form) => {
                const getInput = (id) => form.querySelector(id);

                const inputs = {
                    nome: getInput('#campaign-name'),
                    dataInicio: getInput('#campaign-start'),
                    dataFim: getInput('#campaign-end'),
                    dispatchInterval: getInput('#campaign-interval'),
                    useEmail: getInput('#check-use-email'),
                    useWhatsapp: getInput('#check-use-whatsapp')
                };

                if (inputs.nome) inputs.nome.oninput = (e) => state.config.nome = e.target.value;
                if (inputs.dataInicio) inputs.dataInicio.onchange = (e) => state.config.dataInicio = e.target.value;
                if (inputs.dataFim) inputs.dataFim.onchange = (e) => state.config.dataFim = e.target.value;
                if (inputs.dispatchInterval) inputs.dispatchInterval.oninput = (e) => {
                    const val = parseInt(e.target.value);
                    state.config.dispatchIntervalSeconds = isNaN(val) ? 120 : Math.max(1, Math.min(3600, val));
                };

                if (inputs.useEmail) inputs.useEmail.onchange = (e) => {
                    state.config.useEmail = e.target.checked;
                };
                if (inputs.useWhatsapp) inputs.useWhatsapp.onchange = (e) => {
                    state.config.useWhatsapp = e.target.checked;
                };
            };

            let sharedTableInstance = null;

            const updateLeadsPreview = async () => {
                const countBadge = document.getElementById('wizard-lead-count');
                if (countBadge) countBadge.textContent = 'Carregando...';

                try {
                    if (state.groups.size === 0) {
                        state.leads = [];
                    } else {
                        let url = `${API_BASE_URL}/marketing/leads`;
                        // If 'ALL' is selected, fetch all leads (no query param or specific logic?)
                        // If endpoint supports 'grupos' as list of IDs, we send them. 
                        // If 'ALL' is present, we just want everything.
                        if (state.groups.has('ALL')) {
                            // Fetch all (no params)
                        } else {
                            const groupIds = Array.from(state.groups).join(',');
                            url += `?grupos=${groupIds}`;
                        }

                        const res = await fetch(url, { headers: getHeaders() });
                        if (res.ok) {
                            const leads = await res.json();

                            // Deduplicate leads by ID (in case a lead belongs to multiple selected groups)
                            const uniqueLeadsMap = new Map();
                            leads.forEach(lead => {
                                if (!uniqueLeadsMap.has(lead.id)) {
                                    uniqueLeadsMap.set(lead.id, lead);
                                }
                            });
                            state.leads = Array.from(uniqueLeadsMap.values());
                        }
                    }

                    if (countBadge) countBadge.textContent = `${state.leads.length} leads`;
                    renderLeadsList();
                } catch (e) {
                    console.error('Error fetching leads:', e);
                }
            };

            const renderLeadsList = () => {
                const container = document.getElementById('wizard-leads-table');
                if (!container) return;

                const columns = [
                    { key: 'nome', label: 'Nome', align: 'left' },
                    { key: 'email', label: 'E-mail', align: 'left' },
                    { key: 'telefone', label: 'Telefone', align: 'left' }
                ];

                if (!sharedTableInstance) {
                    sharedTableInstance = new SharedTable({
                        container: container,
                        columns: columns,
                        data: state.leads,
                        itemsPerPage: 50,
                        enableSelection: false // Read-only: leads are auto-populated from selected groups
                    });
                    // Force render to ensure visibility on first load
                    sharedTableInstance.render(state.leads);
                } else {
                    sharedTableInstance.render(state.leads);
                }
            };

            // STEP 2: CONFIG & AUDIENCE
            const renderStep2 = () => {
                const stepContainer = document.createElement('div');
                Object.assign(stepContainer.style, { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' });

                // Top: Config Form (Compact Layout)
                const formDiv = document.createElement('div');
                Object.assign(formDiv.style, {
                    display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '1rem',
                    marginBottom: '1rem', padding: '1rem', backgroundColor: '#fff', borderBottom: '1px solid #eee'
                });

                formDiv.innerHTML = `
                     <div class="form-group" style="flex: 1 1 40%; min-width:220px; max-width:600px;">
                         <label style="font-size:0.85rem; color:#666; display:block; margin-bottom:4px;">Nome da Campanha (v0.9.14) <span style="color:#EF4444; margin-left:2px; font-weight:bold;">*</span></label>
                         <input type="text" id="campaign-name" class="form-input required-field" value="${state.config.nome}" placeholder="Ex: Promoção de Natal (v0.9.14)" required style="width:100%; padding:8px; border:2px solid #ddd; border-radius:6px;" />
                     </div>
                     <div class="form-group" style="width: 140px;">
                         <label style="font-size:0.85rem; color:#666; display:block; margin-bottom:4px;">Início <span style="color:#EF4444; margin-left:2px; font-weight:bold;">*</span></label>
                         <input type="date" id="campaign-start" class="form-input required-field" value="${state.config.dataInicio}" required style="width:100%; padding:8px; border:2px solid #ddd; border-radius:6px;" />
                     </div>
                     <div class="form-group" style="width: 140px;">
                         <label style="font-size:0.85rem; color:#666; display:block; margin-bottom:4px;">Fim <span style="color:#EF4444; margin-left:2px; font-weight:bold;">*</span></label>
                         <input type="date" id="campaign-end" class="form-input required-field" value="${state.config.dataFim}" required style="width:100%; padding:8px; border:2px solid #ddd; border-radius:6px;" />
                     </div>
                     <div class="form-group" style="width: 180px;">
                         <label style="font-size:0.85rem; color:#666; display:block; margin-bottom:4px;">Intervalo entre Mensagens (s) <span style="color:#EF4444; margin-left:2px; font-weight:bold;">*</span></label>
                         <input type="number" id="campaign-interval" class="form-input required-field" value="${state.config.dispatchIntervalSeconds}" min="1" max="3600" placeholder="120" required style="width:100%; padding:8px; border:2px solid #ddd; border-radius:6px; text-align:right;" />
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
                         <span>Leads Selecionados (Preview) <span style="color:#EF4444; margin-left:2px; font-weight:bold;">*</span></span>
                         <span id="wizard-lead-count" style="background:#e0e7ff; color:#4338ca; padding:2px 10px; border-radius:12px; font-size:0.75rem; font-weight:bold;">0 leads</span>
                     </div>
                 `;

                const listContent = document.createElement('div');
                Object.assign(listContent.style, { flex: '1', overflowY: 'hidden', display: 'flex', flexDirection: 'column' });
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

            // STEP 3: EXECUTION
            const renderStep3 = () => {
                const stepContainer = document.createElement('div');
                Object.assign(stepContainer.style, { display: 'flex', flexDirection: 'column', height: '100%', padding: '1rem', overflow: 'hidden' });

                // Summary
                const emailStatus = state.config.useEmail ? (state.message.emailSubject ? 'Pronto' : 'Pendente') : 'Não Habilitado';
                const whatsappStatus = state.config.useWhatsapp ? (state.message.whatsappText ? 'Pronto' : 'Pendente') : 'Não Habilitado';

                const summaryDiv = document.createElement('div');
                summaryDiv.style.marginBottom = '1rem';
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

                // Grid Container
                const gridContainer = document.createElement('div');
                Object.assign(gridContainer.style, {
                    flex: '1',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: 'white'
                });

                // Grid Header
                const gridHeader = document.createElement('div');
                Object.assign(gridHeader.style, {
                    display: 'grid',
                    gridTemplateColumns: '1fr 200px 200px',
                    gap: '1rem',
                    padding: '0.75rem 1rem',
                    background: '#f8f9fa',
                    borderBottom: '2px solid #ddd',
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    color: '#444'
                });

                gridHeader.innerHTML = `
                    <div>👤 Lead</div>
                    <div style="text-align: center;">📧 E-mail</div>
                    <div style="text-align: center;">💬 WhatsApp</div>
                `;

                // Grid Body (scrollable)
                const gridBody = document.createElement('div');
                Object.assign(gridBody.style, {
                    flex: '1',
                    overflowY: 'auto',
                    padding: '0.5rem'
                });
                gridBody.id = 'dispatch-grid-body';

                gridContainer.appendChild(gridHeader);
                gridContainer.appendChild(gridBody);

                stepContainer.appendChild(summaryDiv);
                stepContainer.appendChild(gridContainer);

                // Initialize Grid
                setTimeout(() => {
                    renderDispatchGrid();
                }, 0);

                return stepContainer;
            };

            const renderDispatchGrid = () => {
                const gridBody = document.getElementById('dispatch-grid-body');
                if (!gridBody) return;
                gridBody.innerHTML = '';

                if (state.leads.length === 0) {
                    gridBody.innerHTML = '<div style="padding:2rem; text-align:center; color:#999;">Nenhum lead selecionado</div>';
                    return;
                }

                state.leads.forEach(lead => {
                    const row = document.createElement('div');
                    row.id = `dispatch-row-${lead.id}`;
                    Object.assign(row.style, {
                        display: 'grid',
                        gridTemplateColumns: '1fr 200px 200px',
                        gap: '1rem',
                        padding: '0.75rem 1rem',
                        borderBottom: '1px solid #eee',
                        alignItems: 'center',
                        fontSize: '0.9rem',
                        transition: 'background-color 0.2s'
                    });

                    row.onmouseover = () => row.style.backgroundColor = '#f9fafb';
                    row.onmouseout = () => row.style.backgroundColor = 'transparent';

                    // Lead Info
                    const leadInfo = document.createElement('div');
                    leadInfo.innerHTML = `
                        <div style="font-weight: 500; color: #333;">${lead.nome}</div>
                        <div style="font-size: 0.8rem; color: #666;">${lead.email || lead.telefone || ''}</div>
                    `;

                    // Email Status
                    const emailStatus = document.createElement('div');
                    emailStatus.id = `status-email-${lead.id}`;
                    Object.assign(emailStatus.style, {
                        textAlign: 'center',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        fontWeight: '500',
                        fontSize: '0.85rem'
                    });

                    if (!state.config.useEmail) {
                        emailStatus.textContent = '—';
                        emailStatus.style.color = '#999';
                        emailStatus.style.backgroundColor = '#f5f5f5';
                    } else {
                        emailStatus.textContent = 'Pendente';
                        emailStatus.style.color = '#666';
                        emailStatus.style.backgroundColor = '#f0f0f0';
                    }

                    // WhatsApp Status
                    const whatsappStatus = document.createElement('div');
                    whatsappStatus.id = `status-whatsapp-${lead.id}`;
                    Object.assign(whatsappStatus.style, {
                        textAlign: 'center',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        fontWeight: '500',
                        fontSize: '0.85rem'
                    });

                    if (!state.config.useWhatsapp) {
                        whatsappStatus.textContent = '—';
                        whatsappStatus.style.color = '#999';
                        whatsappStatus.style.backgroundColor = '#f5f5f5';
                    } else {
                        whatsappStatus.textContent = 'Pendente';
                        whatsappStatus.style.color = '#666';
                        whatsappStatus.style.backgroundColor = '#f0f0f0';
                    }

                    row.appendChild(leadInfo);
                    row.appendChild(emailStatus);
                    row.appendChild(whatsappStatus);
                    gridBody.appendChild(row);
                });
            };

            const updateDispatchStatus = (leadId, channel, status, message = '') => {
                const statusEl = document.getElementById(`status-${channel}-${leadId}`);
                if (!statusEl) return;

                // Status can be: 'pending', 'sending', 'ok', 'error'
                const statusConfig = {
                    pending: { text: 'Pendente', color: '#666', bg: '#f0f0f0' },
                    sending: { text: 'Enviando...', color: '#f59e0b', bg: '#fef3c7' },
                    ok: { text: 'OK', color: '#10b981', bg: '#d1fae5' },
                    error: { text: 'NÃO OK', color: '#ef4444', bg: '#fee2e2' }
                };

                const config = statusConfig[status] || statusConfig.pending;
                statusEl.textContent = config.text;
                statusEl.style.color = config.color;
                statusEl.style.backgroundColor = config.bg;

                if (message) {
                    statusEl.title = message;
                    statusEl.style.cursor = 'help';
                }
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

                // Trigger async dispatch in backend - don't wait for completion
                fetch(`${API_BASE_URL}/marketing/campanhas/${campaignId}/disparar-async`, {
                    method: 'POST',
                    headers: getHeaders()
                }).then(res => {
                    if (res.ok) {
                        console.log('Disparos iniciados em background');
                        // Start Polling for status updates in this screen
                        startStep3Polling(campaignId);
                    } else {
                        console.error('Erro ao iniciar disparos');
                    }
                }).catch(err => {
                    console.error('Erro ao iniciar disparos:', err);
                });

                // Change button to "Fechar" immediately - dispatch is happening in background
                if (btn) {
                    btn.textContent = 'Fechar';
                    btn.disabled = false;
                    btn.onclick = () => {
                        close(); // Just close the wizard, don't reload the page
                    };
                }

                // Show toast that sending has started in background
                showToast('Disparos iniciados! Acompanhe o progresso aqui ou na lista.', 'success');
            };

            let step3PollInterval = null;
            const startStep3Polling = (campaignId) => {
                const poll = async () => {
                    if (!document.getElementById('wizard-container')) {
                        clearInterval(step3PollInterval);
                        return;
                    }
                    try {
                        const res = await fetch(`${API_BASE_URL}/marketing/campanhas/${campaignId}/dispatch-details`, { headers: getHeaders() });
                        if (!res.ok) return;
                        const details = await res.json();

                        details.forEach(lead => {
                            // Map backend status 'sucesso' -> 'ok' for UI helper
                            const mapStatus = (s) => {
                                if (s === 'sucesso') return 'ok';
                                if (s === 'falha') return 'error';
                                if (s === 'enviando') return 'sending';
                                return 'pending';
                            };

                            if (state.config.useEmail) {
                                updateDispatchStatus(lead.id, 'email', mapStatus(lead.status_email));
                            }
                            if (state.config.useWhatsapp) {
                                updateDispatchStatus(lead.id, 'whatsapp', mapStatus(lead.status_whatsapp));
                            }
                        });

                        // Check if all done? Optional.
                    } catch (e) { console.error("Poll error", e); }
                };

                if (step3PollInterval) clearInterval(step3PollInterval);
                step3PollInterval = setInterval(poll, 2000);
                poll();
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
                        const errorMessage = err.error || 'Erro desconhecido';
                        updateStatusItem(channel, leadId, 'Falha', 'red', true, errorMessage);
                        console.error(`Falha ${channel} lead ${leadId}:`, errorMessage);
                    }
                } catch (e) {
                    updateStatusItem(channel, leadId, 'Erro', 'red', true, e.message);
                    console.error(`Erro ${channel} lead ${leadId}:`, e);
                }
            };

            const updateStatusItem = (channel, leadId, text, color, bold = false, tooltip = '') => {
                const el = document.getElementById(`item-${channel}-${leadId}`);
                if (!el) return;
                const badge = el.querySelector('.status-badge');
                if (badge) {
                    badge.textContent = text;
                    badge.style.color = color;
                    badge.style.fontWeight = bold ? 'bold' : 'normal';
                    if (tooltip) {
                        badge.title = tooltip;
                        badge.style.cursor = 'help';
                    }
                }
            };

            // --- NAVIGATION ---
            const footer = document.createElement('div');
            Object.assign(footer.style, {
                padding: '1rem', borderTop: '1px solid #ddd', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', backgroundColor: '#f8f9fa'
            });

            const versionSpan = document.createElement('span');
            versionSpan.textContent = 'v0.9.14';
            versionSpan.style.marginRight = 'auto';
            versionSpan.style.color = '#ccc';
            versionSpan.style.fontSize = '0.8rem';
            versionSpan.style.fontWeight = '500';
            footer.appendChild(versionSpan);

            const btnBack = document.createElement('button');
            btnBack.className = 'btn-secondary';
            btnBack.textContent = 'Voltar';
            btnBack.onclick = () => { if (currentStep > 1) updateStep(currentStep - 1); };

            const btnNext = document.createElement('button');
            btnNext.className = 'btn-primary';
            btnNext.textContent = 'Próximo';
            btnNext.onclick = () => {
                // VALIDATION STEP 1: MESSAGE & CHANNELS
                if (currentStep === 1) {
                    if (!state.config.useEmail && !state.config.useWhatsapp) {
                        showToast('Selecione ao menos um canal de envio (E-mail ou WhatsApp)', 'warning');
                        return;
                    }
                    if (state.config.useEmail && !state.message.emailSubject) {
                        showToast('O Assunto do E-mail é obrigatório.', 'warning');
                        return;
                    }
                    // Optional: Check if bodies are empty?
                }

                // VALIDATION STEP 2: CONFIG & AUDIENCE
                if (currentStep === 2) {
                    let hasError = false;
                    const requiredIds = ['campaign-name', 'campaign-start', 'campaign-end'];

                    requiredIds.forEach(id => {
                        const el = document.getElementById(id);
                        if (el && !el.value.trim()) {
                            el.style.borderColor = '#EF4444';
                            el.style.backgroundColor = '#FEF2F2';
                            el.style.borderWidth = '2px';
                            hasError = true;
                        } else if (el) {
                            el.style.borderColor = '#ddd';
                            el.style.backgroundColor = 'white';
                            el.style.borderWidth = '2px';
                        }
                    });

                    if (hasError) {
                        showToast('Preencha os campos obrigatórios da campanha.', 'warning');
                        return;
                    }

                    if (!state.config.nome) { showToast('Nome da campanha obrigatório', 'warning'); return; }
                    if (state.groups.size === 0) {
                        showToast('Selecione ao menos um grupo de leads', 'warning');
                        // Highlight the groups section
                        const treeContainer = document.getElementById('wizard-tree-content');
                        if (treeContainer) {
                            treeContainer.style.border = '2px solid #EF4444';
                            treeContainer.style.backgroundColor = '#FEF2F2';
                            setTimeout(() => {
                                treeContainer.style.border = '';
                                treeContainer.style.backgroundColor = '';
                            }, 3000);
                        }
                        return;
                    }
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
                        circle.textContent = s; // Ensure number is visible
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
                if (step3PollInterval) clearInterval(step3PollInterval);
                if (container.parentNode) document.body.removeChild(container);
                resolve(null);
            };

            container.querySelector('#btn-close-wizard').onclick = close;

            // Init
            updateStep(1);
        });
    },

    showMonitoring({ campanha, leads, onClose }) {
        return new Promise((resolve) => {
            const API_BASE_URL = getApiBaseUrl();
            let container = document.getElementById('wizard-container');
            if (container) document.body.removeChild(container);

            container = document.createElement('div');
            container.id = 'wizard-container';
            container.className = 'wizard-overlay';
            Object.assign(container.style, {
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
                display: 'flex', justifyContent: 'center', alignItems: 'center'
            });

            const content = document.createElement('div');
            content.className = 'wizard-content animate-float-in';
            Object.assign(content.style, {
                width: '95%', height: '96vh', backgroundColor: 'white',
                borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                display: 'flex', flexDirection: 'column', overflow: 'hidden'
            });

            // Header
            const header = document.createElement('div');
            Object.assign(header.style, {
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                padding: '1.5rem', borderBottom: '1px solid #eee', backgroundColor: '#fff',
                position: 'relative'
            });

            const title = document.createElement('h2');
            title.textContent = `📊 Monitorando: ${campanha.nome}`;
            title.style.margin = '0';
            title.style.color = 'var(--color-primary)';
            header.appendChild(title);

            const btnClose = document.createElement('button');
            btnClose.innerHTML = '×';
            Object.assign(btnClose.style, {
                position: 'absolute', top: '1rem', right: '1rem',
                background: 'none', border: 'none', fontSize: '1.5rem',
                color: '#999', cursor: 'pointer', lineHeight: 1
            });
            header.appendChild(btnClose);

            // Body
            const body = document.createElement('div');
            body.style.flex = '1';
            body.style.padding = '1rem';
            body.style.overflow = 'auto';

            // Status Summary
            const summary = document.createElement('div');
            summary.id = 'status-summary';
            Object.assign(summary.style, {
                display: 'flex', gap: '1rem', marginBottom: '1rem',
                padding: '1rem', backgroundColor: '#f9fafb',
                borderRadius: '8px', justifyContent: 'space-around'
            });

            const createStat = (label, value, color) => {
                const stat = document.createElement('div');
                stat.style.textAlign = 'center';
                stat.innerHTML = `
                    <div style="font-size: 2rem; font-weight: bold; color: ${color};">${value}</div>
                    <div style="font-size: 0.875rem; color: #666;">${label}</div>
                `;
                return stat;
            };

            const totalLeads = leads.length;
            const emailOk = leads.filter(l => l.status_email === 'sucesso').length;
            const whatsappOk = leads.filter(l => l.status_whatsapp === 'sucesso').length;
            const pendentes = leads.filter(l =>
                (l.status_email === 'pendente' || !l.status_email) &&
                (l.status_whatsapp === 'pendente' || !l.status_whatsapp)
            ).length;

            summary.appendChild(createStat('Total Leads', totalLeads, '#3b82f6'));
            summary.appendChild(createStat('📧 E-mail OK', emailOk, '#10b981'));
            summary.appendChild(createStat('💬 WhatsApp OK', whatsappOk, '#10b981'));
            summary.appendChild(createStat('⏳ Pendentes', pendentes, '#f59e0b'));

            body.appendChild(summary);

            // Grid
            const gridContainer = document.createElement('div');
            gridContainer.id = 'dispatch-grid';
            gridContainer.style.flex = '1';
            gridContainer.style.overflow = 'auto';

            const table = document.createElement('table');
            table.style.width = '100%';
            table.style.borderCollapse = 'collapse';
            table.innerHTML = `
                <thead>
                    <tr style="background: #f3f4f6; position: sticky; top: 0;">
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Lead</th>
                        <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb; width: 150px;">📧 E-mail</th>
                        <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb; width: 150px;">💬 WhatsApp</th>
                    </tr>
                </thead>
                <tbody id="dispatch-tbody"></tbody>
            `;

            const tbody = table.querySelector('#dispatch-tbody');

            const renderLeads = (leadsData) => {
                tbody.innerHTML = '';
                leadsData.forEach(lead => {
                    const row = document.createElement('tr');
                    row.style.borderBottom = '1px solid #e5e7eb';
                    row.dataset.leadId = lead.id;

                    const getStatusBadge = (status) => {
                        const badges = {
                            'pendente': { text: 'Pendente', bg: '#f3f4f6', color: '#6b7280' },
                            'enviando': { text: 'Enviando...', bg: '#fffbeb', color: '#f59e0b' },
                            'sucesso': { text: 'OK', bg: '#ecfdf5', color: '#10b981' },
                            'falha': { text: 'Erro', bg: '#fef2f2', color: '#ef4444' }
                        };
                        const badge = badges[status] || badges['pendente'];
                        return `<span style="background: ${badge.bg}; color: ${badge.color}; padding: 4px 12px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">${badge.text}</span>`;
                    };

                    row.innerHTML = `
                        <td style="padding: 12px;">
                            <div style="font-weight: 500;">${lead.nome}</div>
                            <div style="font-size: 0.75rem; color: #6b7280;">${lead.email || ''}</div>
                        </td>
                        <td style="padding: 12px; text-align: center;" data-channel="email">
                            ${getStatusBadge(lead.status_email || 'pendente')}
                        </td>
                        <td style="padding: 12px; text-align: center;" data-channel="whatsapp">
                            ${getStatusBadge(lead.status_whatsapp || 'pendente')}
                        </td>
                    `;
                    tbody.appendChild(row);
                });
            };

            renderLeads(leads);
            gridContainer.appendChild(table);
            body.appendChild(gridContainer);

            // Footer
            const footer = document.createElement('div');
            Object.assign(footer.style, {
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '1rem', borderTop: '1px solid #eee', backgroundColor: '#fff'
            });

            const statusText = document.createElement('span');
            statusText.id = 'auto-refresh-status';
            statusText.textContent = '🔄 Atualizando a cada 3 segundos...';
            statusText.style.color = '#666';
            statusText.style.fontSize = '0.875rem';

            const btnCloseFooter = document.createElement('button');
            btnCloseFooter.className = 'btn-secondary';
            btnCloseFooter.textContent = 'Fechar';

            footer.appendChild(statusText);
            footer.appendChild(btnCloseFooter);

            // Assemble
            content.appendChild(header);
            content.appendChild(body);
            content.appendChild(footer);
            container.appendChild(content);
            document.body.appendChild(container);

            // Auto-refresh logic
            const getHeaders = () => ({
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            });

            let updateInterval = setInterval(async () => {
                try {
                    const response = await fetch(`${API_BASE_URL}/marketing/campanhas/${campanha.id}/dispatch-details`, {
                        headers: getHeaders()
                    });

                    if (!response.ok) return;

                    const updatedLeads = await response.json();

                    // Update stats
                    const newEmailOk = updatedLeads.filter(l => l.status_email === 'sucesso').length;
                    const newWhatsappOk = updatedLeads.filter(l => l.status_whatsapp === 'sucesso').length;
                    const newPendentes = updatedLeads.filter(l =>
                        (l.status_email === 'pendente' || !l.status_email) &&
                        (l.status_whatsapp === 'pendente' || !l.status_whatsapp)
                    ).length;

                    const stats = summary.querySelectorAll('div[style*="font-size: 2rem"]');
                    if (stats[1]) stats[1].textContent = newEmailOk;
                    if (stats[2]) stats[2].textContent = newWhatsappOk;
                    if (stats[3]) stats[3].textContent = newPendentes;

                    // Update grid
                    renderLeads(updatedLeads);
                } catch (error) {
                    console.error('Error updating dispatch status:', error);
                }
            }, 3000);

            const close = () => {
                clearInterval(updateInterval);
                if (document.body.contains(container)) {
                    document.body.removeChild(container);
                }
                if (onClose) onClose();
                resolve(null);
            };

            btnClose.onclick = close;
            btnCloseFooter.onclick = close;
        });
    }
};
