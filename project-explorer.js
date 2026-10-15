/* One selection state drives the real HTML detail panel and the matching star diagram. */
(() => {
  if(window.resumeProjectExplorerReady)return;window.resumeProjectExplorerReady=true;
  const explorer = document.getElementById('projectExplorer');
  const list = document.getElementById('projectList');
  const detail = document.getElementById('projectDetail');
  const empty = document.getElementById('projectEmpty');
  const config = window.RESUME_PROJECT_CONSTELLATIONS;
  if (!explorer || !list || !detail || !config) return;
  let selectedId = null;

  const currentData = () => window.resumeProjectData;
  const text = (zh, en) => currentData().language === 'zh' ? zh : en;
  function element(tag, className, content) {
    const node = document.createElement(tag); node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }
  function emit() {
    explorer.dataset.activeProject = selectedId ?? '';
    window.dispatchEvent(new CustomEvent('resume:projectchange', { detail: { projectId: selectedId } }));
  }
  function close(restoreFocus = true) {
    const previous = selectedId; selectedId = null;
    detail.hidden = true; empty.hidden = false;
    list.querySelectorAll('button').forEach(button => { button.setAttribute('aria-pressed', 'false'); button.setAttribute('aria-expanded', 'false'); });
    document.getElementById('projectSelectionStatus').textContent = text('项目详情已关闭', 'Project details closed');
    emit();
    if (restoreFocus && previous) document.getElementById(`project-select-${previous}`)?.focus({ preventScroll: true });
  }
  function show(id) {
    const data = currentData();
    const project = data.projects.find(project => project.id === id);
    if (!project || !config.diagrams[id]) return;
    selectedId = id;
    document.getElementById('projectDetailTitle').textContent = project.title;
    document.getElementById('projectDetailSummary').textContent = project.desc;
    document.getElementById('projectDetailResult').textContent = project.result;
    const tags = document.getElementById('projectDetailTags'); tags.replaceChildren();
    project.stack.forEach(tag => tags.append(element('span', 'tag', tag)));
    const links = document.getElementById('projectDetailLinks'); links.replaceChildren();
    const references = config.references[id];
    for (const index of references.certificates ?? []) {
      const certificate = data.certificates[index];
      if (!certificate) continue;
      const item = element('li', '');
      const link = element('a', 'project-reference', certificate.label + text(' · 认证资料', ' · Certificate'));
      link.href = certificate.href;
      link.addEventListener('click', event => {
        // Keep native open-in-new-tab and modified-link behavior intact.
        if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !window.openModal) return;
        event.preventDefault(); window.openModal(certificate.href, certificate.label);
      });
      item.append(link); links.append(item);
    }
    if (references.href) {
      const item = element('li', '');
      const link = element('a', 'project-reference', references.label[data.language]);
      link.href = references.href; item.append(link); links.append(item);
    }
    document.getElementById('projectConstellationCaption').textContent = project.title;
    list.querySelectorAll('button').forEach(button => {
      const active = button.dataset.projectId === id;
      button.setAttribute('aria-pressed', String(active)); button.setAttribute('aria-expanded', String(active));
    });
    detail.hidden = false; empty.hidden = true;
    document.getElementById('projectSelectionStatus').textContent = text(`已选择：${project.title}`, `Selected: ${project.title}`);
    emit();
  }

  function renderList() {
    const data = currentData();
    if (!data) return;
    const focusId = list.contains(document.activeElement) ? document.activeElement.dataset.projectId : null;
    list.replaceChildren();
    data.projects.forEach(project => {
      const item = element('li', '');
      const button = element('button', 'project-select');
      button.type = 'button'; button.id = `project-select-${project.id}`; button.dataset.projectId = project.id;
      button.setAttribute('aria-controls', 'projectDetail');
      button.setAttribute('aria-pressed', 'false'); button.setAttribute('aria-expanded', 'false');
      button.append(element('span', 'project-select-title', project.title), element('span', 'project-select-summary', project.desc));
      // The existing outcome remains available, including in a printed resume.
      button.append(element('span', 'project-select-result', project.result));
      button.addEventListener('click', () => show(project.id));
      item.append(button); list.append(item);
    });
    explorer.setAttribute('aria-label', text('项目与对应星图', 'Projects and constellations'));
    list.setAttribute('aria-label', text('选择项目', 'Select a project'));
    document.getElementById('projectClose').textContent = text('关闭', 'Close');
    document.getElementById('projectClose').setAttribute('aria-label', text('关闭项目详情', 'Close project details'));
    document.getElementById('projectEmptyTitle').textContent = text('选择一个项目', 'Select a project');
    document.getElementById('projectEmptyDescription').textContent = text('查看项目详情与对应星图。', 'View the project details and its constellation.');
    document.getElementById('projectKeyboardHint').textContent = text('可用 Tab、Enter 或方向键选择，Esc 关闭。', 'Use Tab, Enter or arrow keys to select. Escape closes details.');
    if (selectedId && data.projects.some(project => project.id === selectedId)) show(selectedId);
    else close(false);
    if (focusId) document.getElementById(`project-select-${focusId}`)?.focus({ preventScroll: true });
  }

  document.getElementById('projectClose').addEventListener('click', () => close());
  explorer.addEventListener('keydown', event => {
    if (event.key === 'Escape' && selectedId) { event.preventDefault(); close(); }
  });
  list.addEventListener('keydown', event => {
    const button = event.target.closest('button[data-project-id]');
    if (!button || !['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...list.querySelectorAll('button')];
    let index = buttons.indexOf(button);
    if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = buttons.length - 1;
    else index = (index + (['ArrowDown','ArrowRight'].includes(event.key) ? 1 : -1) + buttons.length) % buttons.length;
    buttons[index].focus({ preventScroll: true }); show(buttons[index].dataset.projectId);
  });
  window.addEventListener('resume:render', renderList);
  renderList();
})();
