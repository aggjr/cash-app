import { SharedTable } from './SharedTable.js';
import Quill from 'quill';
import BlotFormatter from 'quill-blot-formatter';
import 'quill/dist/quill.snow.css';

Quill.register('modules/blotFormatter', BlotFormatter);
import { showToast } from '../utils/toast.js';
import { startOfWeek } from 'date-fns'; // Unused but likely available, or just ignore
import { getApiBaseUrl } from '../utils/apiConfig.js';
import SocketService from '../services/SocketService.js';

// --- CUSTOM VIDEO BLOT FOR QUILL ---
const BlockEmbed = Quill.import('blots/block/embed');
class VideoBlot extends BlockEmbed {
    static create(value) {
        let node = super.create();
        // Support object { url, poster } or string url
        let src = typeof value === 'string' ? value : value.url;
        let poster = typeof value === 'object' ? value.poster : null;

        node.setAttribute('src', src);
        if (poster) node.setAttribute('poster', poster);

        node.setAttribute('controls', '');
        node.setAttribute('preload', 'metadata');
        node.setAttribute('width', '100%');
        node.setAttribute('style', 'max-width: 100%; border-radius: 8px; margin: 10px 0; background-color: #000;');
        return node;
    }

    static value(node) {
        return {
            url: node.getAttribute('src'),
            poster: node.getAttribute('poster')
        };
    }
}
VideoBlot.blotName = 'video-file';
VideoBlot.tagName = 'video';
Quill.register(VideoBlot);

// Helper: Generate Thumbnail from Video File
const generateVideoThumbnail = (file) => {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.setAttribute('src', URL.createObjectURL(file));
        video.muted = true;
        video.playsInline = true;
        video.currentTime = 0.5; // Capture at 0.5s to avoid black frame

        video.onloadeddata = () => {
            // Wait a bit for seek
            video.currentTime = Math.min(1, video.duration / 2); // Middleware or start
        };

        video.onseeked = () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');

            // Draw video frame
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Draw Play Icon Overlay
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const radius = Math.min(canvas.width, canvas.height) * 0.15;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.fill();

            // Triangle
            const triSize = radius * 0.6;
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.moveTo(centerX - triSize / 2, centerY - triSize);
            ctx.lineTo(centerX + triSize, centerY);
            ctx.lineTo(centerX - triSize / 2, centerY + triSize);
            ctx.closePath();
            ctx.fill();

            canvas.toBlob((blob) => {
                resolve(blob);
                URL.revokeObjectURL(video.src); // Cleanup
            }, 'image/jpeg', 0.85);
        };

        video.onerror = () => resolve(null);
    });
};
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

                                const statusSpan = emailEditor.querySelector('#email-upload-status');
                                if (statusSpan) { statusSpan.style.display = 'inline'; statusSpan.textContent = 'Gerando thumb...'; }

                                try {
                                    // 1. Generate Thumb if Video
                                    let thumbUrl = null;
                                    const isVideo = file.type.startsWith('video/');

                                    if (isVideo) {
                                        const thumbBlob = await generateVideoThumbnail(file);
                                        if (thumbBlob) {
                                            if (statusSpan) statusSpan.textContent = 'Enviando thumb...';
                                            const thumbData = new FormData();
                                            thumbData.append('file', thumbBlob, 'thumbnail.jpg');
                                            const resThumb = await fetch(`${getApiBaseUrl()}/upload`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: thumbData });
                                            const dataThumb = await resThumb.json();
                                            thumbUrl = dataThumb.fileUrl.startsWith('http') ? dataThumb.fileUrl : `${getApiBaseUrl()}${dataThumb.fileUrl}`;
                                        }
                                    }

                                    // 2. Upload Main File
                                    if (statusSpan) statusSpan.textContent = 'Enviando arquivo...';
                                    const formData = new FormData();
                                    formData.append('file', file);

                                    const res = await fetch(`${getApiBaseUrl()}/upload`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: formData });
                                    const data = await res.json();
                                    const fullUrl = data.fileUrl.startsWith('http') ? data.fileUrl : `${getApiBaseUrl()}${data.fileUrl}`;

                                    const range = quillEmail.getSelection(true) || { index: quillEmail.getLength(), length: 0 };

                                    if (isVideo) {
                                        // Insert Video with Poster info
                                        quillEmail.insertEmbed(range.index, 'video-file', { url: fullUrl, poster: thumbUrl });
                                    } else {
                                        quillEmail.insertEmbed(range.index, 'image', fullUrl);
                                    }
                                } catch (e) {
                                    console.error(e);
                                    showToast('Erro no upload: ' + e.message, 'error');
                                } finally {
                                    if (statusSpan) statusSpan.style.display = 'none';
                                    inputEmailUpload.value = '';
                                }
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

                                const statusSpan = whatsappEditor.querySelector('#whatsapp-upload-status');
                                if (statusSpan) { statusSpan.style.display = 'inline'; statusSpan.textContent = 'Gerando thumb...'; }

                                try {
                                    // 1. Generate Thumb if Video
                                    let thumbUrl = null;
                                    const isVideo = file.type.startsWith('video/');

                                    if (isVideo) {
                                        const thumbBlob = await generateVideoThumbnail(file);
                                        if (thumbBlob) {
                                            if (statusSpan) statusSpan.textContent = 'Enviando thumb...';
                                            const thumbData = new FormData();
                                            thumbData.append('file', thumbBlob, 'thumbnail.jpg');
                                            const resThumb = await fetch(`${getApiBaseUrl()}/upload`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: thumbData });
                                            const dataThumb = await resThumb.json();
                                            thumbUrl = dataThumb.fileUrl.startsWith('http') ? dataThumb.fileUrl : `${getApiBaseUrl()}${dataThumb.fileUrl}`;
                                        }
                                    }

                                    // 2. Upload Main File
                                    if (statusSpan) statusSpan.textContent = 'Enviando arquivo...';
                                    const formData = new FormData();
                                    formData.append('file', file);

                                    const res = await fetch(`${getApiBaseUrl()}/upload`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: formData });
                                    const data = await res.json();
                                    const fullUrl = data.fileUrl.startsWith('http') ? data.fileUrl : `${getApiBaseUrl()}${data.fileUrl}`;

                                    const range = quillWhatsapp.getSelection(true) || { index: quillWhatsapp.getLength(), length: 0 };

                                    if (isVideo) {
                                        quillWhatsapp.insertEmbed(range.index, 'video-file', { url: fullUrl, poster: thumbUrl });
                                    } else {
                                        quillWhatsapp.insertEmbed(range.index, 'image', fullUrl);
                                    }
                                } catch (e) {
                                    console.error(e);
                                    showToast('Erro no upload: ' + e.message, 'error');
                                } finally {
                                    if (statusSpan) statusSpan.style.display = 'none';
                                    inputWa.value = '';
                                }
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
                         <label style="font-size:0.85rem; color:#666; display:block; margin-bottom:4px;">Nome da Campanha (v0.9.24) <span style="color:#EF4444; margin-left:2px; font-weight:bold;">*</span></label>
                         <input type="text" id="campaign-name" class="form-input required-field" value="${state.config.nome}" placeholder="Ex: Promoção de Natal (v0.9.24)" required style="width:100%; padding:8px; border:2px solid #ddd; border-radius:6px;" />
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

            // --- Step 3: Confirmation & Progress (WebSocket + Pagination) ---
            let step3State = {
                page: 1, limit: 20, total: 0, totalPages: 1,
                campaignId: null, socketActive: false, filterStatus: 'all'
            };

            const renderStep3 = () => {
                const stepContainer = document.createElement('div');
                Object.assign(stepContainer.style, { display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' });

                // Summary Header (Progress Bar)
                const summaryDiv = document.createElement('div');
                summaryDiv.innerHTML = `
                    <div style="background:#f8f9fa; padding:15px; border-radius:8px; border:1px solid #ddd; display:flex; flex-direction:column; gap:10px;">
                        <div style="display:flex; justify-content:space-between; font-weight:bold;">
                            <span>Progresso do Disparo</span>
                            <span id="progress-text">0%</span>
                        </div>
                        <div style="width:100%; background:#e9ecef; border-radius:10px; height:20px; overflow:hidden;">
                            <div id="progress-bar" style="width:0%; height:100%; background:#4caf50; transition:width 0.5s;"></div>
                        </div>
                        <div style="display:flex; gap:15px; font-size:0.9rem; margin-top:5px;">
                            <span style="color:#666;">Total: <b id="stat-total">0</b></span>
                            <span style="color:#2196f3;">Enviando: <b id="stat-sending">0</b></span>
                            <span style="color:#4caf50;">Sucesso: <b id="stat-success">0</b></span>
                            <span style="color:#f44336;">Falhas: <b id="stat-error">0</b></span>
                        </div>
                    </div>
                `;

                // Filters & Toolbar
                const toolbar = document.createElement('div');
                toolbar.style.display = 'flex';
                toolbar.style.justifyContent = 'space-between';
                toolbar.style.alignItems = 'center';
                toolbar.innerHTML = `
                    <div style="font-weight:bold; color:#555;">Lista de Disparos</div>
                    <div style="display:flex; gap:10px;">
                        <button id="refresh-btn" class="btn-secondary" title="Atualizar Lista">🔄</button>
                    </div>
                `;

                // Grid Container
                const gridContainer = document.createElement('div');
                Object.assign(gridContainer.style, {
                    flex: '1', border: '1px solid #ddd', borderRadius: '8px',
                    overflow: 'hidden', display: 'flex', flexDirection: 'column', backgroundColor: 'white'
                });

                // Grid Header
                const gridHeader = document.createElement('div');
                Object.assign(gridHeader.style, {
                    display: 'grid', gridTemplateColumns: '1fr 150px 150px', gap: '1rem',
                    padding: '0.75rem 1rem', background: '#f8f9fa', borderBottom: '2px solid #ddd',
                    fontWeight: 'bold', fontSize: '0.9rem', color: '#444'
                });
                gridHeader.innerHTML = `<div>👤 Lead</div><div style="text-align:center;">📧 E-mail</div><div style="text-align:center;">💬 WhatsApp</div>`;

                // Grid Body
                const gridBody = document.createElement('div');
                gridBody.id = 'dispatch-grid-body';
                Object.assign(gridBody.style, { flex: '1', overflowY: 'auto', padding: '0.5rem' });

                // Pagination Footer
                const paginationDiv = document.createElement('div');
                Object.assign(paginationDiv.style, {
                    padding: '10px', borderTop: '1px solid #ddd', display: 'flex', justifyContent: 'center', gap: '10px', background: '#f8f9fa'
                });
                paginationDiv.innerHTML = `
                    <button id="prev-page" class="btn-secondary" disabled>Anterior</button>
                    <span id="page-info" style="align-self:center; font-weight:500;">Página 1 de 1</span>
                    <button id="next-page" class="btn-secondary" disabled>Próxima</button>
                `;

                gridContainer.appendChild(gridHeader);
                gridContainer.appendChild(gridBody);
                gridContainer.appendChild(paginationDiv);

                stepContainer.appendChild(summaryDiv);
                stepContainer.appendChild(toolbar);
                stepContainer.appendChild(gridContainer);

                // Bind Events
                setTimeout(() => {
                    if (stepContainer.querySelector('#prev-page')) {
                        stepContainer.querySelector('#prev-page').onclick = () => changePage(-1);
                        stepContainer.querySelector('#next-page').onclick = () => changePage(1);
                        stepContainer.querySelector('#refresh-btn').onclick = () => loadPage(step3State.page);

                        // Initial render (empty or cached preview)
                        renderGrid(state.leads.slice(0, 20));
                        document.getElementById('stat-total').textContent = state.leads.length;
                    }
                }, 0);

                return stepContainer;
            };

            const changePage = (delta) => {
                const newPage = step3State.page + delta;
                if (newPage >= 1 && newPage <= step3State.totalPages) {
                    step3State.page = newPage;
                    loadPage(newPage);
                }
            };

            const loadPage = async (page) => {
                if (!step3State.campaignId) return;

                try {
                    const gridBody = document.getElementById('dispatch-grid-body');
                    if (gridBody) gridBody.style.opacity = '0.5';

                    const res = await fetch(`${API_BASE_URL}/marketing/campanhas/${step3State.campaignId}/dispatch-details?page=${page}&limit=${step3State.limit}`, {
                        headers: getHeaders()
                    });

                    if (res.ok) {
                        const data = await res.json();
                        step3State.total = data.pagination?.total || data.length || 0;
                        step3State.totalPages = data.pagination?.totalPages || 1;
                        renderGrid(data.leads || data);
                        updatePaginationUI();
                    }
                } catch (e) {
                    console.error("Erro ao carregar página:", e);
                } finally {
                    const gridBody = document.getElementById('dispatch-grid-body');
                    if (gridBody) gridBody.style.opacity = '1';
                }
            };

            const updatePaginationUI = () => {
                const info = document.getElementById('page-info');
                const prev = document.getElementById('prev-page');
                const next = document.getElementById('next-page');
                if (info && prev && next) {
                    info.textContent = `Página ${step3State.page} de ${step3State.totalPages}`;
                    prev.disabled = step3State.page <= 1;
                    next.disabled = step3State.page >= step3State.totalPages;
                }
            };

            const renderGrid = (leads) => {
                const gridBody = document.getElementById('dispatch-grid-body');
                if (!gridBody) return;
                gridBody.innerHTML = '';

                if (!leads || leads.length === 0) {
                    gridBody.innerHTML = '<div style="padding:2rem; text-align:center; color:#999;">Nenhum lead nesta página</div>';
                    return;
                }

                leads.forEach(lead => {
                    const row = document.createElement('div');
                    row.id = `row-${lead.id}`;
                    Object.assign(row.style, {
                        display: 'grid', gridTemplateColumns: '1fr 150px 150px', gap: '1rem',
                        padding: '0.75rem 1rem', borderBottom: '1px solid #eee', alignItems: 'center', fontSize: '0.9rem'
                    });

                    // Lead Info
                    row.innerHTML = `
                        <div>
                            <div style="font-weight: 500;">${lead.nome}</div>
                            <div style="font-size: 0.8rem; color: #666;">${lead.email || lead.telefone || ''}</div>
                        </div>
                    `;

                    // Helper for status
                    const createStatus = (type, val) => {
                        const el = document.createElement('div');
                        el.id = `status-${type}-${lead.id}`;
                        el.style.textAlign = 'center';
                        el.style.padding = '5px';
                        el.style.borderRadius = '4px';
                        el.style.fontSize = '0.8rem';
                        updateStatusElement(el, val || 'pendente');
                        return el;
                    };

                    row.appendChild(createStatus('email', state.config.useEmail ? lead.status_email : '—'));
                    row.appendChild(createStatus('whatsapp', state.config.useWhatsapp ? lead.status_whatsapp : '—'));

                    gridBody.appendChild(row);
                });
            };

            const updateStatusElement = (el, status) => {
                if (status === '—') {
                    el.textContent = '—'; el.style.background = '#f5f5f5'; el.style.color = '#999'; return;
                }
                const map = {
                    'pendente': { t: 'Pendente', c: '#666', b: '#f0f0f0' },
                    'sending': { t: 'Enviando...', c: '#f59e0b', b: '#fef3c7' },
                    'enviando': { t: 'Enviando...', c: '#f59e0b', b: '#fef3c7' },
                    'sucesso': { t: 'OK', c: '#10b981', b: '#d1fae5' },
                    'ok': { t: 'OK', c: '#10b981', b: '#d1fae5' },
                    'falha': { t: 'Erro', c: '#ef4444', b: '#fee2e2' },
                    'error': { t: 'Erro', c: '#ef4444', b: '#fee2e2' }
                };
                const cfg = map[status] || map['pendente'];
                el.textContent = cfg.t;
                el.style.color = cfg.c;
                el.style.backgroundColor = cfg.b;
            };

            const setupSocketListeners = (campaignId) => {
                console.log(`LOG: [CampanhaWizard] setupSocketListeners called for campaign ${campaignId}`);
                if (step3State.socketActive) {
                    console.log('LOG: [CampanhaWizard] Socket listeners already active. Skipping.');
                    return;
                }

                console.log('LOG: [CampanhaWizard] Connecting to SocketService...');
                SocketService.connect();
                step3State.socketActive = true;

                SocketService.on('connect', () => console.log('LOG: [CampanhaWizard] ✅ Socket Connected via Wizard'));

                SocketService.on('campaign_progress', (data) => {
                    console.log('LOG: [CampanhaWizard] 📥 Received campaign_progress:', data);
                    if (data.campaignId != campaignId) return;

                    const bar = document.getElementById('progress-bar');
                    const text = document.getElementById('progress-text');
                    if (bar && text) {
                        bar.style.width = `${data.percentage}%`;
                        text.textContent = `${data.percentage}%`;
                    }

                    const statTotal = document.getElementById('stat-total');
                    const statSending = document.getElementById('stat-sending');
                    if (statTotal) statTotal.textContent = data.total;
                    if (statSending) statSending.textContent = data.current;
                });

                SocketService.on('lead_status_update', (data) => {
                    console.log('LOG: [CampanhaWizard] 📥 Received lead_status_update:', data);
                    if (data.campaignId != campaignId) return;

                    // Update row if visible
                    const el = document.getElementById(`status-${data.channel}-${data.leadId}`);
                    if (el) {
                        updateStatusElement(el, data.status);
                    }
                    // Update Stats implicitly
                    const isSuccess = data.status === 'ok' || data.status === 'sucesso';
                    const statId = isSuccess ? 'stat-success' : 'stat-error';
                    const statEl = document.getElementById(statId);
                    if (statEl) {
                        const currentVal = parseInt(statEl.textContent) || 0;
                        statEl.textContent = currentVal + 1;
                    }
                });

                SocketService.on('campaign_complete', (data) => {
                    console.log('LOG: [CampanhaWizard] 📥 Received campaign_complete:', data);
                    if (data.campaignId != campaignId) return;
                    showToast('Campanha concluída com sucesso!', 'success');

                    const btn = document.querySelector('#wizard-container .btn-primary');
                    if (btn) {
                        btn.textContent = 'Fechar - Concluído';
                        btn.disabled = false;
                    }
                    loadPage(step3State.page);
                });
            };

            // Execution Logic (Socket)
            const startExecution = async () => {
                const btn = footer.querySelector('button.btn-primary');
                if (btn) {
                    btn.disabled = true;
                    btn.textContent = 'Iniciando...';
                }

                // 1. Save Campaign First
                let campaignId = null;
                try {
                    if (onSave) {
                        const payload = { ...state.config, leadsIds: state.leads.map(l => l.id), message: state.message };
                        const saved = await onSave(payload);
                        campaignId = saved?.id;
                    }
                } catch (e) {
                    showToast('Erro ao salvar: ' + e.message, 'error');
                    if (btn) btn.disabled = false; return;
                }

                if (!campaignId) { showToast('Erro ID campanha.', 'error'); if (btn) btn.disabled = false; return; }
                step3State.campaignId = campaignId;

                // 2. Start Socket Listeners
                setupSocketListeners(campaignId);

                // 3. Trigger Dispatch
                fetch(`${API_BASE_URL}/marketing/campanhas/${campaignId}/disparar-async`, {
                    method: 'POST',
                    headers: getHeaders()
                }).then(res => {
                    if (res.ok) {
                        showToast('Disparos iniciados! Acompanhe.', 'success');
                        loadPage(1);

                        // Change button to Close
                        if (btn) {
                            btn.textContent = 'Fechar';
                            btn.disabled = false;
                            btn.onclick = () => close();
                        }
                    } else {
                        showToast('Erro ao iniciar disparos.', 'error');
                        if (btn) btn.disabled = false;
                    }
                }).catch(err => {
                    console.error('Erro disparar:', err);
                    if (btn) btn.disabled = false;
                });
            };

            // --- NAVIGATION ---
            const footer = document.createElement('div');
            Object.assign(footer.style, {
                padding: '1rem', borderTop: '1px solid #ddd', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', backgroundColor: '#f8f9fa'
            });

            const versionSpan = document.createElement('span');
            versionSpan.textContent = 'v0.9.24';
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
                SocketService.disconnect();
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

            // Progress Bar & Stats (Copied & Adapted from Step 3)
            const summaryDiv = document.createElement('div');
            summaryDiv.innerHTML = `
                <div style="background:#f8f9fa; padding:15px; border-radius:8px; border:1px solid #ddd; display:flex; flex-direction:column; gap:10px; margin-bottom: 1rem;">
                    <div style="display:flex; justify-content:space-between; font-weight:bold;">
                        <span>Progresso do Disparo</span>
                        <span id="progress-text">0%</span>
                    </div>
                    <div style="width:100%; background:#e9ecef; border-radius:10px; height:20px; overflow:hidden;">
                        <div id="progress-bar" style="width:0%; height:100%; background:#4caf50; transition:width 0.5s;"></div>
                    </div>
                    <div style="display:flex; gap:15px; font-size:0.9rem; margin-top:5px; justify-content: space-around;">
                        <span style="color:#666;">Total: <b id="stat-total">0</b></span>
                        <span style="color:#2196f3;">Processados: <b id="stat-sending">0</b></span>
                        <span style="color:#10b981;">E-mail OK: <b id="stat-email-ok">0</b></span>
                        <span style="color:#10b981;">WhatsApp OK: <b id="stat-whatsapp-ok">0</b></span>
                    </div>
                </div>
            `;
            body.appendChild(summaryDiv);

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
                    <tr style="background: #f3f4f6; position: sticky; top: 0; z-index: 10;">
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

                    const createStatusBadge = (type, val) => {
                        // val can be 'sucesso', 'falha', 'pendente', 'enviando', etc.
                        // We will create a span with an ID to update it easily
                        const span = document.createElement('span');
                        span.id = `monitor-status-${type}-${lead.id}`;
                        updateMonitorStatus(span, val);
                        return span;
                    };

                    const tdName = document.createElement('td');
                    tdName.style.padding = '12px';
                    tdName.innerHTML = `<div style="font-weight: 500;">${lead.nome}</div><div style="font-size: 0.75rem; color: #6b7280;">${lead.email || ''}</div>`;
                    row.appendChild(tdName);

                    const tdEmail = document.createElement('td');
                    tdEmail.style.padding = '12px';
                    tdEmail.style.textAlign = 'center';
                    tdEmail.appendChild(createStatusBadge('email', lead.status_email));
                    row.appendChild(tdEmail);

                    const tdWa = document.createElement('td');
                    tdWa.style.padding = '12px';
                    tdWa.style.textAlign = 'center';
                    tdWa.appendChild(createStatusBadge('whatsapp', lead.status_whatsapp));
                    row.appendChild(tdWa);

                    tbody.appendChild(row);
                });
            };

            const updateMonitorStatus = (el, status) => {
                const map = {
                    'pendente': { t: 'Pendente', bg: '#f3f4f6', c: '#6b7280' },
                    'sending': { t: 'Enviando...', bg: '#fffbeb', c: '#f59e0b' },
                    'enviando': { t: 'Enviando...', bg: '#fffbeb', c: '#f59e0b' },
                    'sucesso': { t: 'OK', bg: '#ecfdf5', c: '#10b981' },
                    'ok': { t: 'OK', bg: '#ecfdf5', c: '#10b981' },
                    'falha': { t: 'Erro', bg: '#fef2f2', c: '#ef4444' },
                    'error': { t: 'Erro', bg: '#fef2f2', c: '#ef4444' }
                };
                const cfg = map[status] || map['pendente'];

                el.textContent = cfg.t;
                el.style.backgroundColor = cfg.bg;
                el.style.color = cfg.c;
                el.style.padding = '4px 12px';
                el.style.borderRadius = '12px';
                el.style.fontSize = '0.75rem';
                el.style.fontWeight = '600';
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
            statusText.textContent = '⚡ Conectado ao servidor de disparos';
            statusText.style.color = '#10b981';
            statusText.style.fontSize = '0.875rem';
            statusText.style.fontWeight = '500';

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

            // --- REAL TIME SOCKET LOGIC ---
            // Initial Stats Calculation
            const updateStats = (currentLeads) => {
                const total = currentLeads.length;
                const emailOk = currentLeads.filter(l => l.status_email === 'sucesso' || l.status_email === 'ok').length;
                const waOk = currentLeads.filter(l => l.status_whatsapp === 'sucesso' || l.status_whatsapp === 'ok').length;
                const processed = currentLeads.filter(l =>
                    (l.status_email && l.status_email !== 'pendente') ||
                    (l.status_whatsapp && l.status_whatsapp !== 'pendente')
                ).length;

                // Progress is roughly processed / total
                const pct = total === 0 ? 0 : Math.round((processed / total) * 100);

                const elTotal = document.getElementById('stat-total');
                const elSending = document.getElementById('stat-sending');
                const elEmailOk = document.getElementById('stat-email-ok');
                const elWaOk = document.getElementById('stat-whatsapp-ok');
                const elBar = document.getElementById('progress-bar');
                const elText = document.getElementById('progress-text');

                if (elTotal) elTotal.textContent = total;
                if (elSending) elSending.textContent = processed;
                if (elEmailOk) elEmailOk.textContent = emailOk;
                if (elWaOk) elWaOk.textContent = waOk;
                if (elBar) elBar.style.width = `${pct}%`;
                if (elText) elText.textContent = `${pct}%`;
            };

            // Run initial stats
            updateStats(leads);

            // Connect Socket
            console.log('LOG: [CampanhaWizard] Connecting Socket for Monitoring...');
            SocketService.connect();

            SocketService.on('campaign_progress', (data) => {
                if (data.campaignId != campanha.id) return;
                // Update Progress Bar directly from server event if available
                const elBar = document.getElementById('progress-bar');
                const elText = document.getElementById('progress-text');
                const elSending = document.getElementById('stat-sending');

                if (elBar) elBar.style.width = `${data.percentage}%`;
                if (elText) elText.textContent = `${data.percentage}%`;
                if (elSending) elSending.textContent = data.current;
            });

            SocketService.on('lead_status_update', (data) => {
                if (data.campaignId != campanha.id) return;

                const el = document.getElementById(`monitor-status-${data.channel}-${data.leadId}`);
                if (el) {
                    updateMonitorStatus(el, data.status);

                    // Increment Stats locally
                    if (data.status === 'ok' || data.status === 'sucesso') {
                        const statId = data.channel === 'email' ? 'stat-email-ok' : 'stat-whatsapp-ok';
                        const statEl = document.getElementById(statId);
                        if (statEl) {
                            statEl.textContent = (parseInt(statEl.textContent) || 0) + 1;
                        }
                    }
                }
            });

            SocketService.on('campaign_complete', (data) => {
                if (data.campaignId != campanha.id) return;
                showToast('Campanha concluída!', 'success');
                const elBar = document.getElementById('progress-bar');
                const elText = document.getElementById('progress-text');
                if (elBar) elBar.style.width = '100%';
                if (elText) elText.textContent = '100%';
            });

            const close = () => {
                SocketService.disconnect();
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
