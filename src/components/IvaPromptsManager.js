import React, { useState, useEffect } from 'react';
import api from '../services/api';
import '../styles/Settings.css';

const IvaPromptsManager = () => {
    const [prompts, setPrompts] = useState({});
    const [activeTab, setActiveTab] = useState('system');
    const [editedContent, setEditedContent] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPrompts();
    }, []);

    useEffect(() => {
        if (prompts[activeTab]) {
            setEditedContent(prompts[activeTab]);
        }
    }, [activeTab, prompts]);

    const loadPrompts = async () => {
        try {
            setLoading(true);
            const response = await api.get('/iva-prompts');
            setPrompts(response.data.prompts || {});
            setLoading(false);
        } catch (error) {
            console.error('Error loading prompts:', error);
            setMessage({ type: 'error', text: 'Erro ao carregar prompts' });
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (saving) return;

        const confirmed = window.confirm(
            `Tem certeza que deseja salvar o prompt "${activeTab}"?\n\n` +
            'Isso afetará imediatamente o comportamento da IVA para todos os usuários.'
        );

        if (!confirmed) return;

        try {
            setSaving(true);
            setMessage({ type: '', text: '' });

            await api.put(`/iva-prompts/${activeTab}`, {
                content: editedContent
            });

            setPrompts(prev => ({
                ...prev,
                [activeTab]: editedContent
            }));

            setMessage({
                type: 'success',
                text: 'Prompt salvo com sucesso! A IVA está usando o novo comportamento.'
            });

        } catch (error) {
            console.error('Error saving prompt:', error);
            setMessage({
                type: 'error',
                text: error.response?.data?.error || 'Erro ao salvar prompt'
            });
        } finally {
            setSaving(false);
        }
    };

    const handleRevert = () => {
        const confirmed = window.confirm(
            'Descartar todas as alterações não salvas?'
        );

        if (confirmed) {
            setEditedContent(prompts[activeTab] || '');
            setMessage({ type: 'info', text: 'Alterações descartadas' });
        }
    };

    const hasChanges = editedContent !== (prompts[activeTab] || '');

    if (loading) {
        return <div className="loading">Carregando prompts...</div>;
    }

    const availableTabs = Object.keys(prompts);

    return (
        <div className="iva-prompts-manager">
            <div className="prompts-header">
                <h3>⚙️ Gerenciamento de Prompts IVA</h3>
                <p className="prompts-warning">
                    ⚠️ <strong>Atenção:</strong> Alterações nos prompts afetam imediatamente o comportamento da IVA.
                    Apenas administradores devem editar.
                </p>
            </div>

            {message.text && (
                <div className={`message message-${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="prompts-tabs">
                {availableTabs.map(tab => (
                    <button
                        key={tab}
                        className={`tab-button ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab === 'system' ? '📋 System' : '💬 ' + tab}
                    </button>
                ))}
            </div>

            <div className="prompts-editor-container">
                <div className="editor-toolbar">
                    <span className="editor-label">
                        Editando: <strong>{activeTab}.txt</strong>
                    </span>
                    <div className="editor-stats">
                        {editedContent.length} caracteres | {editedContent.split('\n').length} linhas
                        {hasChanges && <span className="unsaved-indicator"> ● Não salvo</span>}
                    </div>
                </div>

                <textarea
                    className="prompts-editor"
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    placeholder="Conteúdo do prompt..."
                    spellCheck={false}
                />

                <div className="editor-actions">
                    <button
                        className="btn-revert"
                        onClick={handleRevert}
                        disabled={!hasChanges || saving}
                    >
                        ↺ Reverter
                    </button>
                    <button
                        className="btn-save"
                        onClick={handleSave}
                        disabled={!hasChanges || saving}
                    >
                        {saving ? '💾 Salvando...' : '💾 Salvar Prompt'}
                    </button>
                </div>
            </div>

            <div className="prompts-footer">
                <small>
                    <strong>Dica:</strong> Use ctrl+F para buscar no texto.
                    Mudanças são aplicadas imediatamente após salvar.
                </small>
            </div>
        </div>
    );
};

export default IvaPromptsManager;
