import { SharedTable } from './SharedTable.js';
import Quill from 'quill';
import BlotFormatter from 'quill-blot-formatter';
import 'quill/dist/quill.snow.css';

Quill.register('modules/blotFormatter', BlotFormatter);
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
                    whatsappText: '',
                    mediaUrl: '' // NEW: Media URL
                }
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

            header.appendChild(renderStepBadge(1, 'Configuração e Público'));
            header.appendChild(renderStepBadge(2, 'Mensagem'));
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
                     <div class="form-group" style="flex: 1 1 40%; min-width:220px; max-width:600px;">
                         <label style="font-size:0.85rem; color:#666; display:block; margin-bottom:4px;">Nome da Campanha (v0.9.13) <span style="color:red; margin-left:2px;">*</span></label>
                         <input type="text" id="campaign-name" class="form-input" value="${state.config.nome}" placeholder="Ex: Promoção de Natal (v0.9.13)" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;" />
                     </div>
                     <div class="form-group" style="width: 140px;">
                         <label style="font-size:0.85rem; color:#666; display:block; margin-bottom:4px;">Início <span style="color:red; margin-left:2px;">*</span></label>
                         <input type="date" id="campaign-start" class="form-input" value="${state.config.dataInicio}" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;" />
                     </div>
                     <div class="form-group" style="width: 140px;">
                         <label style="font-size:0.85rem; color:#666; display:block; margin-bottom:4px;">Fim <span style="color:red; margin-left:2px;">*</span></label>
                         <input type="date" id="campaign-end" class="form-input" value="${state.config.dataFim}" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;" />
                     </div>
                     <div class="form-group" style="display:flex; gap:1rem; align-items:center; white-space:nowrap; flex-direction:row !important; flex-wrap:nowrap !important; flex-shrink:0; min-width: 200px;">
                          <label style="display:flex; align-items:center; cursor:pointer; font-size:0.9rem; user-select:none; white-space: nowrap;">
                             <input type="checkbox" id="check-use-email" ${state.config.useEmail ? 'checked' : ''} style="margin-right:6px; width:16px; height:16px;">
                             <span>E-mail</span>
                          </label>
                          <label style="display:flex; align-items:center; cursor:pointer; font-size:0.9rem; user-select:none; white-space: nowrap;">
                             <input type="checkbox" id="check-use-whatsapp" ${state.config.useWhatsapp ? 'checked' : ''} style="margin-right:6px; width:16px; height:16px;">
                             <span>WhatsApp</span>
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
                Object.assign(listContent.style, { flex: '1', overflowY: 'hidden', display: 'flex', flexDirection: 'column' }); // Changed to hidden/flex to let SharedTable handle scroll
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

            // Helpers for Step 1
            const loadGroups = async (container) => {
                container.innerHTML = '<div style="padding:1rem; text-align:center; color:#666;">Carregando grupos...</div>';
                try {
                    const res = await fetch(`${API_BASE_URL}/marketing/grupos-leads`, { headers: getHeaders() });
                    if (!res.ok) throw new Error('Falha ao carregar grupos');
                    const groups = await res.json();

                    container.innerHTML = '';
                    if (groups.length === 0) {
                        container.innerHTML = '<div style="padding:1rem; text-align:center; color:#666;">Nenhum grupo encontrado.</div>';
                        return;
                    }

                    const list = document.createElement('div');
                    list.style.display = 'flex';
                    list.style.flexDirection = 'column';
                    list.style.gap = '0.5rem';

                    groups.forEach(g => {
                        const item = document.createElement('label');
                        Object.assign(item.style, {
                            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem',
                            border: '1px solid #eee', borderRadius: '4px', cursor: 'pointer',
                            backgroundColor: state.groups.has(g.id) ? '#e0e7ff' : 'white'
                        });

                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.value = g.id;
                        checkbox.checked = state.groups.has(g.id);
                        checkbox.style.width = '16px';
                        checkbox.style.height = '16px';

                        checkbox.onchange = async () => {
                            if (checkbox.checked) {
                                state.groups.add(g.id);
                                item.style.backgroundColor = '#e0e7ff';
                            } else {
                                state.groups.delete(g.id);
                                item.style.backgroundColor = 'white';
                            }
                            await updateLeadsPreview();
                        };

                        const name = document.createElement('span');
                        name.textContent = g.nome;
                        name.style.fontWeight = '500';

                        const count = document.createElement('span');
                        count.textContent = `(${g.total_leads || 0})`;
                        count.style.fontSize = '0.8rem';
                        count.style.color = '#666';

                        item.appendChild(checkbox);
                        item.appendChild(name);
                        item.appendChild(count);
                        list.appendChild(item);
                    });

                    container.appendChild(list);
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
                    useEmail: getInput('#check-use-email'),
                    useWhatsapp: getInput('#check-use-whatsapp')
                };

                if (inputs.nome) inputs.nome.oninput = (e) => state.config.nome = e.target.value;
                if (inputs.dataInicio) inputs.dataInicio.onchange = (e) => state.config.dataInicio = e.target.value;
                if (inputs.dataFim) inputs.dataFim.onchange = (e) => state.config.dataFim = e.target.value;

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
                    const groupIds = Array.from(state.groups).join(',');
                    if (!groupIds) {
                        state.leads = [];
                    } else {
                        const res = await fetch(`${API_BASE_URL}/marketing/leads?grupos=${groupIds}`, { headers: getHeaders() });
                        if (res.ok) {
                            state.leads = await res.json();
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
                        itemsPerPage: 50
                    });
                } else {
                    sharedTableInstance.render(state.leads);
                }
            };

            // STEP 2: MESSAGE
            const renderStep2 = () => {
                const stepContainer = document.createElement('div');
                Object.assign(stepContainer.style, { display: 'flex', height: '100%', overflow: 'hidden' });

                // Left: Editors (Tabs)
                const editorPanel = document.createElement('div');
                Object.assign(editorPanel.style, { width: '50%', borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column' });

                // Media Upload Section
                const mediaDiv = document.createElement('div');
                Object.assign(mediaDiv.style, { padding: '1rem', borderBottom: '1px solid #eee', background: '#fafafa' });
                mediaDiv.innerHTML = `
                    <label style="font-weight:600; font-size:0.9rem; color:#444; margin-bottom:8px; display:block;">
                        📸 Mídia da Campanha (Imagem ou Vídeo)
                    </label>
                    <div id="media-upload-area" style="
                        border: 2px dashed #ccc; border-radius: 8px; padding: 1.5rem; text-align: center; 
                        background: white; cursor: pointer; transition: all 0.2s; position: relative;">
                        <span id="media-placeholder" style="color: #888; pointer-events: none;">
                            Clique para selecionar ou <b>Cole (Ctrl+V)</b> aqui
                        </span>
                        <input type="file" id="media-input" accept="image/*,video/*" style="display: none;" />
                        <div id="media-preview-container" style="display: none; margin-top: 10px;">
                            <!-- Preview injected here -->
                        </div>
                    </div>
                `;
                editorPanel.appendChild(mediaDiv);

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
                        <div id="editor-email-container" style="min-height:320px; background:white;"></div>
                        <div style="font-size:0.8rem; color:#666; margin-top:0.5rem;">Variáveis disponíveis: {{nome}}, {{empresa}}.</div>
                    </div>
                `;

                const whatsappEditor = document.createElement('div');
                whatsappEditor.id = 'editor-whatsapp';
                whatsappEditor.style.display = 'none';
                whatsappEditor.innerHTML = `
                    <div class="form-group">
                        <label>Mensagem WhatsApp</label>
                         <div id="editor-whatsapp-container" style="min-height:320px; background:white;"></div>
                        <div style="font-size:0.8rem; color:#666; margin-top:0.5rem;">Variáveis disponíveis: {{nome}}, {{empresa}}. Use *negrito* para texto.</div>
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
                const updateMediaPreview = () => {
                    const container = mediaDiv.querySelector('#media-preview-container');
                    const placeholder = mediaDiv.querySelector('#media-placeholder');

                    if (state.message.mediaUrl) {
                        const isVideo = state.message.mediaUrl.match(/\.(mp4|mov|avi|wmv)$/i);
                        const fullUrl = state.message.mediaUrl.startsWith('http') ? state.message.mediaUrl : `${getApiBaseUrl()}${state.message.mediaUrl}`;

                        let html = '';
                        if (isVideo) {
                            html = `<video src="${fullUrl}" controls style="max-width: 100%; max-height: 200px; border-radius: 4px;"></video>`;
                        } else {
                            html = `<img src="${fullUrl}" style="max-width: 100%; max-height: 200px; border-radius: 4px; object-fit: contain;">`;
                        }

                        container.innerHTML = html;
                        container.style.display = 'block';
                        placeholder.style.display = 'none';
                    } else {
                        container.innerHTML = '';
                        container.style.display = 'none';
                        placeholder.style.display = 'inline';
                    }
                };

                const handleUpload = async (file) => {
                    if (!file) return;

                    // Show Loading
                    const placeholder = mediaDiv.querySelector('#media-placeholder');
                    const originalText = placeholder.textContent;
                    placeholder.textContent = '⏳ Enviando...';

                    const formData = new FormData();
                    formData.append('file', file);

                    try {
                        const res = await fetch(`${getApiBaseUrl()}/upload`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                            body: formData
                        });

                        if (!res.ok) throw new Error('Falha no upload');

                        const data = await res.json();
                        state.message.mediaUrl = data.fileUrl; // Save URL
                        showToast('Upload concluído!', 'success');

                        updateMediaPreview();
                        updatePreview(stepContainer.dataset.activeTab); // Update main preview
                    } catch (error) {
                        console.error(error);
                        showToast('Erro ao enviar imagem/vídeo', 'error');
                    } finally {
                        placeholder.textContent = originalText;
                    }
                };

                // Upload Events
                const uploadArea = mediaDiv.querySelector('#media-upload-area');
                const fileInput = mediaDiv.querySelector('#media-input');

                uploadArea.onclick = () => fileInput.click();
                fileInput.onchange = (e) => handleUpload(e.target.files[0]);

                // Paste Event
                uploadArea.addEventListener('paste', (e) => {
                    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
                    for (let index in items) {
                        const item = items[index];
                        if (item.kind === 'file') {
                            const blob = item.getAsFile();
                            handleUpload(blob);
                            e.preventDefault(); // Prevent pasting text if any
                            break;
                        }
                    }
                });

                // Allow pasting anywhere in the wizard (if focusing body)? similar to Notion/Discord
                // Use a global listener on the stepContainer for convenience
                stepContainer.addEventListener('paste', (e) => {
                    // Only if not pasting into an input/textarea
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') return;

                    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
                    for (let index in items) {
                        const item = items[index];
                        if (item.kind === 'file') {
                            const blob = item.getAsFile();
                            handleUpload(blob);
                            break;
                        }
                    }
                });

                const updatePreview = (type) => {
                    const header = type === 'email' ? state.message.emailSubject || 'Sem Assunto' : 'WhatsApp Preview';
                    const body = type === 'email' ? state.message.emailBody : state.message.whatsappText;

                    previewHeader.textContent = header;
                    previewHeader.style.background = type === 'email' ? '#4a5568' : '#075e54';

                    let contentHtml = body || '<span style="color:#aaa; font-style:italic;">(Digite para visualizar...)</span>';

                    // Inject Media Preview in Content
                    if (state.message.mediaUrl) {
                        const isVideo = state.message.mediaUrl.match(/\.(mp4|mov|avi|wmv)$/i);
                        const fullUrl = state.message.mediaUrl.startsWith('http') ? state.message.mediaUrl : `${getApiBaseUrl()}${state.message.mediaUrl}`;

                        let mediaHtml = '';
                        if (type === 'email') {
                            // Email logic (similar to backend)
                            if (isVideo) {
                                mediaHtml = `<div style="margin-bottom:15px; border:1px solid #ddd; padding:10px; border-radius:4px; text-align:center;">
                                    <p style="margin:0;">🎥 Vídeo: <a href="${fullUrl}" target="_blank">Clique para assistir</a></p>
                                </div>`;
                            } else {
                                mediaHtml = `<div style="margin-bottom:15px;"><img src="${fullUrl}" style="max-width:100%; border-radius:8px;"></div>`;
                            }
                        } else {
                            // WhatsApp logic
                            if (isVideo) {
                                mediaHtml = `<div style="margin-bottom:10px;"><video src="${fullUrl}" controls style="max-width:100%; border-radius:8px;"></video></div>`;
                            } else {
                                mediaHtml = `<div style="margin-bottom:10px;"><img src="${fullUrl}" style="max-width:100%; border-radius:8px;"></div>`;
                            }
                        }

                        contentHtml = mediaHtml + contentHtml;
                    }

                    // Render HTML for body preview
                    previewBody.innerHTML = contentHtml;

                    // Simple variable replacement preview (on HTML string)
                    const demoName = state.leads[0]?.nome || 'João Silva';
                    previewBody.innerHTML = previewBody.innerHTML.replace(/{{nome}}/g, demoName);
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

                // Show existing Media if coming back to step
                setTimeout(updateMediaPreview, 50);

                // Auto-select tab
                if (state.config.useEmail) {
                    activateTab('email');
                } else if (state.config.useWhatsapp) {
                    activateTab('whatsapp');
                }

                // Input Events
                const inputs = stepContainer.querySelectorAll('input, textarea');
                inputs.forEach(input => {
                    input.oninput = (e) => {
                        if (e.target.id === 'msg-email-subject') state.message.emailSubject = e.target.value;
                        updatePreview(stepContainer.dataset.activeTab);
                    };
                });

                // Initialize Quill Editors
                setTimeout(() => {
                    // Email Toolbar (Full Rich Text)
                    const emailToolbar = [
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                        [{ 'size': ['small', false, 'large', 'huge'] }],
                        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                        [{ 'color': [] }, { 'background': [] }],
                        [{ 'align': [] }],
                        ['link', 'image']
                    ];

                    // WhatsApp Toolbar (Image Only - User wants *text* for bold)
                    const whatsappToolbar = [
                        // Only basic text - user said "Use *negrito* para texto".
                        // Also user wants media via the separate field.
                        // Standard quill toolbar minimal
                        // Remove image from here since we use the dedicated upload
                        ['clean'] // Minimal
                    ];

                    // Init Email
                    const quillEmail = new Quill('#editor-email-container', {
                        theme: 'snow',
                        placeholder: 'Escreva o conteúdo do e-mail aqui',
                        modules: {
                            toolbar: emailToolbar,
                            blotFormatter: {}
                        }
                    });

                    if (state.message.emailBody) quillEmail.root.innerHTML = state.message.emailBody;

                    quillEmail.on('text-change', () => {
                        state.message.emailBody = quillEmail.root.innerHTML;
                        updatePreview('email');
                    });

                    // Init WhatsApp
                    const quillWhatsapp = new Quill('#editor-whatsapp-container', {
                        theme: 'snow',
                        placeholder: 'Escreva sua mensagem aqui. Use *negrito* para destaque.',
                        modules: {
                            toolbar: whatsappToolbar,
                            blotFormatter: {}
                        }
                    });

                    if (state.message.whatsappText) quillWhatsapp.root.innerHTML = state.message.whatsappText;

                    quillWhatsapp.on('text-change', () => {
                        // For WA, we might want text, but images make it HTML.
                        // We save HTML to state to preserve the image tag.
                        // Converter will handle it later.
                        state.message.whatsappText = quillWhatsapp.root.innerHTML;
                        if (stepContainer.dataset.activeTab === 'whatsapp') {
                            updatePreview('whatsapp');
                        }
                    });

                }, 50);

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
                    let hasError = false;
                    const requiredIds = ['campaign-name', 'campaign-start', 'campaign-end'];

                    requiredIds.forEach(id => {
                        const el = document.getElementById(id);
                        if (el && !el.value.trim()) {
                            el.style.borderColor = '#ef4444';
                            el.style.backgroundColor = '#fef2f2';
                            hasError = true;
                        }
                    });

                    if (hasError) {
                        showToast('Preencha os campos obrigatórios em vermelho.', 'warning');
                        return;
                    }

                    if (!state.config.nome) { showToast('Nome da campanha obrigatório', 'warning'); return; } // Backup check
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
