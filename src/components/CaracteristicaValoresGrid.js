import { showToast } from '../utils/toast.js';

export const CaracteristicaValoresGrid = {
    render(container, caracteristicaId, initialValues = []) {
        container.innerHTML = '';
        const state = {
            values: [...initialValues],
            isProcessing: false
        };

        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.gap = '1rem';
        wrapper.style.marginTop = '1rem';
        wrapper.style.padding = '1rem';
        wrapper.style.background = '#f8f9fa';
        wrapper.style.borderRadius = '8px';
        wrapper.style.border = '1px solid #e9ecef';

        // Header
        const header = document.createElement('div');
        header.innerHTML = '<h4 style="margin: 0; color: #495057; font-size: 0.95rem;">Valores Possíveis</h4>';
        wrapper.appendChild(header);

        // Input Area
        const inputRow = document.createElement('div');
        inputRow.style.display = 'flex';
        inputRow.style.gap = '0.5rem';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Novo valor (ex: Azul)';
        input.className = 'form-input';
        input.style.flex = '1';

        const addButton = document.createElement('button');
        addButton.textContent = 'Adicionar';
        addButton.className = 'btn-primary';
        addButton.style.padding = '0.5rem 1rem';

        inputRow.appendChild(input);
        inputRow.appendChild(addButton);
        wrapper.appendChild(inputRow);

        // Values List
        const listContainer = document.createElement('div');
        listContainer.style.maxHeight = '200px';
        listContainer.style.overflowY = 'auto';
        listContainer.style.display = 'flex';
        listContainer.style.flexDirection = 'column';
        listContainer.style.gap = '0.5rem';
        wrapper.appendChild(listContainer);

        const renderList = () => {
            listContainer.innerHTML = '';
            if (state.values.length === 0) {
                listContainer.innerHTML = '<div style="color: #adb5bd; font-size: 0.85rem; text-align: center; padding: 1rem;">Nenhum valor cadastrado</div>';
                return;
            }

            state.values.forEach(val => {
                const item = document.createElement('div');
                item.style.display = 'flex';
                item.style.justifyContent = 'space-between';
                item.style.alignItems = 'center';
                item.style.padding = '0.5rem';
                item.style.background = 'white';
                item.style.borderRadius = '4px';
                item.style.border = '1px solid #dee2e6';

                const textSpan = document.createElement('span');
                textSpan.textContent = val.valor;
                textSpan.style.fontSize = '0.9rem';

                const deleteBtn = document.createElement('button');
                deleteBtn.innerHTML = '🗑️';
                deleteBtn.style.background = 'none';
                deleteBtn.style.border = 'none';
                deleteBtn.style.cursor = 'pointer';
                deleteBtn.style.fontSize = '0.9rem';
                deleteBtn.title = 'Remover';

                deleteBtn.onclick = async () => {
                    if (state.isProcessing) return;
                    if (!confirm(`Remover valor "${val.valor}"?`)) return;

                    state.isProcessing = true;
                    try {
                        // Calls backend directly
                        const response = await fetch(`${document.location.origin}/api/marketing/caracteristicas/valores/${val.id}`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('token')}`
                            }
                        });

                        if (response.ok) {
                            state.values = state.values.filter(v => v.id !== val.id);
                            renderList();
                            showToast('Valor removido', 'success');
                        } else {
                            throw new Error('Falha ao remover');
                        }
                    } catch (err) {
                        showToast('Erro ao remover valor', 'error');
                        console.error(err);
                    } finally {
                        state.isProcessing = false;
                    }
                };

                item.appendChild(textSpan);
                item.appendChild(deleteBtn);
                listContainer.appendChild(item);
            });
        };

        // Add Handler
        addButton.onclick = async () => {
            const valor = input.value.trim();
            if (!valor) return;
            if (state.isProcessing) return;

            state.isProcessing = true;
            addButton.disabled = true;

            try {
                // Determine if we are just adding to state (new characteristic mode) OR saving to DB (edit mode)
                // For now, assuming Edit Mode mostly as per plan. 
                // If ID is present, save immediately.
                if (caracteristicaId) {
                    const response = await fetch(`${document.location.origin}/api/marketing/caracteristicas/${caracteristicaId}/valores`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        },
                        body: JSON.stringify({ valor })
                    });

                    if (response.ok) {
                        const newVal = await response.json();
                        state.values.push(newVal);
                        input.value = '';
                        renderList();
                        showToast('Valor adicionado', 'success');
                    } else {
                        throw new Error('Erro ao salvar valor');
                    }
                } else {
                    // Just local state? (Maybe not needed if we enforce creation first)
                    // For simplicity, we disable adding values if not creating.
                    showToast('Salve a característica antes de adicionar valores.', 'info');
                }

            } catch (err) {
                showToast('Erro ao adicionar valor', 'error');
                console.error(err);
            } finally {
                state.isProcessing = false;
                addButton.disabled = false;
            }
        };

        renderList();
        container.appendChild(wrapper);
    }
};
