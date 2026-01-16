import { showToast } from '../utils/toast.js';

export const CaracteristicaValoresGrid = {
    render(container, caracteristicaId, initialValues = []) {
        container.innerHTML = '';
        const state = {
            values: [...initialValues],
            isProcessing: false,
            editingId: null
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

                if (state.editingId === val.id) {
                    // EDIT MODE
                    const inputEdit = document.createElement('input');
                    inputEdit.type = 'text';
                    inputEdit.value = val.valor;
                    inputEdit.className = 'form-input';
                    inputEdit.style.flex = '1';
                    inputEdit.style.padding = '0.25rem 0.5rem';
                    inputEdit.style.marginRight = '0.5rem';

                    const actionsDiv = document.createElement('div');
                    actionsDiv.style.display = 'flex';
                    actionsDiv.style.gap = '0.25rem';

                    const saveBtn = document.createElement('button');
                    saveBtn.innerHTML = '✅';
                    saveBtn.title = 'Salvar';
                    saveBtn.style.background = 'none';
                    saveBtn.style.border = 'none';
                    saveBtn.style.cursor = 'pointer';

                    const cancelBtn = document.createElement('button');
                    cancelBtn.innerHTML = '❌';
                    cancelBtn.title = 'Cancelar';
                    cancelBtn.style.background = 'none';
                    cancelBtn.style.border = 'none';
                    cancelBtn.style.cursor = 'pointer';

                    saveBtn.onclick = async () => {
                        const novoValor = inputEdit.value.trim();
                        if (!novoValor) return;
                        if (state.isProcessing) return;

                        state.isProcessing = true;
                        try {
                            const response = await fetch(`${document.location.origin}/api/marketing/caracteristicas/valores/${val.id}`, {
                                method: 'PUT',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                                },
                                body: JSON.stringify({ valor: novoValor })
                            });

                            if (response.ok) {
                                val.valor = novoValor;
                                state.editingId = null;
                                renderList();
                                showToast('Valor atualizado!', 'success');
                            } else {
                                throw new Error('Falha ao atualizar');
                            }
                        } catch (e) {
                            console.error(e);
                            showToast('Erro ao atualizar', 'error');
                        } finally {
                            state.isProcessing = false;
                        }
                    };

                    cancelBtn.onclick = () => {
                        state.editingId = null;
                        renderList();
                    };

                    actionsDiv.appendChild(saveBtn);
                    actionsDiv.appendChild(cancelBtn);
                    item.appendChild(inputEdit);
                    item.appendChild(actionsDiv);

                } else {
                    // VIEW MODE
                    const textSpan = document.createElement('span');
                    textSpan.textContent = val.valor;
                    textSpan.style.fontSize = '0.9rem';

                    const actionsDiv = document.createElement('div');
                    actionsDiv.style.display = 'flex';
                    actionsDiv.style.gap = '0.25rem';

                    const editBtn = document.createElement('button');
                    editBtn.innerHTML = '✏️';
                    editBtn.style.background = 'none';
                    editBtn.style.border = 'none';
                    editBtn.style.cursor = 'pointer';
                    editBtn.style.fontSize = '0.9rem';
                    editBtn.title = 'Editar';

                    const deleteBtn = document.createElement('button');
                    deleteBtn.innerHTML = '🗑️';
                    deleteBtn.style.background = 'none';
                    deleteBtn.style.border = 'none';
                    deleteBtn.style.cursor = 'pointer';
                    deleteBtn.style.fontSize = '0.9rem';
                    deleteBtn.title = 'Remover';

                    editBtn.onclick = () => {
                        state.editingId = val.id;
                        renderList();
                    };

                    deleteBtn.onclick = async () => {
                        if (state.isProcessing) return;
                        if (!confirm(`Remover valor "${val.valor}"?`)) return;

                        state.isProcessing = true;
                        try {
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

                    actionsDiv.appendChild(editBtn);
                    actionsDiv.appendChild(deleteBtn);
                    item.appendChild(textSpan);
                    item.appendChild(actionsDiv);
                }

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
