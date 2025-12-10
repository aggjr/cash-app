import { Dialogs } from './Dialogs.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';

export const ProjectList = (onProjectSelected) => {
    const API_BASE_URL = getApiBaseUrl();
    const container = document.createElement('div');
    container.className = 'glass-panel';
    container.style.padding = '2rem';
    container.style.maxWidth = '800px';
    container.style.margin = '2rem auto';

    const getHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    const loadProjects = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/projects`, {
                headers: getHeaders()
            });
            const projects = await response.json();
            renderProjects(projects);
        } catch (error) {
            console.error('Error loading projects:', error);
            Dialogs.alert('Erro ao carregar projetos', 'Erro');
        }
    };

    const createProject = async () => {
        const name = await Dialogs.prompt('Nome do Projeto', '', 'Novo Projeto');
        if (!name) return;

        try {
            const response = await fetch(`${API_BASE_URL}/auth/projects`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ name })
            });

            if (response.ok) {
                loadProjects();
            } else {
                const data = await response.json();
                Dialogs.alert(data.error || 'Erro ao criar projeto', 'Erro');
            }
        } catch (error) {
            Dialogs.alert('Erro de conexão', 'Erro');
        }
    };

    const renameProject = async (project) => {
        const newName = await Dialogs.prompt('Novo nome do projeto', project.name, 'Renomear Projeto');
        if (!newName || newName === project.name) return;

        try {
            const response = await fetch(`${API_BASE_URL}/auth/projects/${project.id}`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({ name: newName })
            });

            if (response.ok) {
                // Update local storage if current project is renamed
                const currentProject = JSON.parse(localStorage.getItem('currentProject'));
                if (currentProject && currentProject.id === project.id) {
                    currentProject.name = newName;
                    localStorage.setItem('currentProject', JSON.stringify(currentProject));
                    window.dispatchEvent(new CustomEvent('project-updated', { detail: currentProject }));
                }
                loadProjects();
            } else {
                const data = await response.json();
                Dialogs.alert(data.error || 'Erro ao renomear projeto', 'Erro');
            }
        } catch (error) {
            Dialogs.alert('Erro de conexão', 'Erro');
        }
    };

    const selectProject = (project) => {
        localStorage.setItem('currentProject', JSON.stringify(project));
        onProjectSelected(project);
    };

    const renderProjects = (projects) => {
        const currentProject = JSON.parse(localStorage.getItem('currentProject'));

        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2>Meus Projetos</h2>
                <button id="btn-new-project" class="btn-primary">+ Novo Projeto</button>
            </div>
            <div class="project-list">
                ${projects.map(p => `
                    <div class="project-card ${currentProject && currentProject.id === p.id ? 'active' : ''}" data-id="${p.id}">
                        <div class="project-info">
                            <h3 class="project-name" data-id="${p.id}" style="cursor: pointer;" title="Clique duplo para renomear">${p.name}</h3>
                            <p>Função: ${p.role === 'master' ? 'Administrador' : 'Usuário'}</p>
                        </div>
                        <div class="project-actions">
                            <button class="btn-secondary btn-select" data-id="${p.id}">Selecionar</button>
                            ${p.role === 'master' ? `
                                <button class="btn-secondary btn-rename" data-id="${p.id}">Renomear</button>
                                <button class="btn-secondary btn-users" data-id="${p.id}">Usuários</button>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        container.querySelector('#btn-new-project').addEventListener('click', createProject);

        container.querySelectorAll('.btn-select').forEach(btn => {
            btn.addEventListener('click', () => {
                const project = projects.find(p => p.id == btn.dataset.id);
                selectProject(project);
            });
        });

        container.querySelectorAll('.btn-rename').forEach(btn => {
            btn.addEventListener('click', () => {
                const project = projects.find(p => p.id == btn.dataset.id);
                renameProject(project);
            });
        });

        container.querySelectorAll('.project-name').forEach(el => {
            el.addEventListener('dblclick', () => {
                const project = projects.find(p => p.id == el.dataset.id);
                if (project.role === 'master') {
                    renameProject(project);
                }
            });
        });

        container.querySelectorAll('.btn-users').forEach(btn => {
            btn.addEventListener('click', () => {
                const project = projects.find(p => p.id == btn.dataset.id);
                window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'users', project } }));
            });
        });
    };

    loadProjects();

    return container;
};
