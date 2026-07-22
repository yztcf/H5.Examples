/**
 * UForm 表单设计器 - 核心逻辑
 * 支持 JSON/标签互转、可视化编辑、预览、导入导出
 * 兼容 @uform/antd 与 react-schema-editor
 */

// ==================== 状态 ====================
let formFields = []; // 扁平数组，通过 parentId 构建树
let selectedId = null;
let nextId = 1;
let dragSourceId = null;
let formTitle = '动态表单';

const LAYOUT_TYPES = ['FormLayout', 'FormCard', 'FormBlock', 'FormStep', 'FormItemGrid', 'FormTextBox', 'FormButtonGroup'];
const ENUM_TYPES = ['select', 'radio', 'checkbox', 'transfer'];

// 布局组件可视化属性配置
const layoutPropConfigs = {
    FormLayout: [
        { key: 'layout', label: '布局方向', type: 'select', options: ['vertical', 'horizontal', 'inline'] },
        { key: 'labelCol', label: 'labelCol (标签占比)', type: 'number' },
        { key: 'wrapperCol', label: 'wrapperCol (内容占比)', type: 'number' },
    ],
    FormCard: [
        { key: 'title', label: '卡片标题', type: 'text' },
        { key: 'className', label: 'className', type: 'text' },
    ],
    FormBlock: [
        { key: 'title', label: '分组标题', type: 'text' },
    ],
    FormStep: [
        { key: 'step', label: '当前步骤', type: 'number' },
    ],
    FormItemGrid: [
        { key: 'cols', label: '栅格列数', type: 'number' },
        { key: 'gutter', label: '列间距 (px)', type: 'number' },
    ],
    FormTextBox: [
        { key: 'text', label: '文本内容', type: 'text' },
    ],
    FormButtonGroup: [
        { key: 'offset', label: '偏移量', type: 'number' },
    ],
};

const defaultOptions = {
    string: { type: 'string', title: '文本字段', name: 'textField', 'x-component': 'Input', 'x-decorator': 'FormItem', 'x-component-props': { placeholder: '请输入' }, required: false },
    textarea: { type: 'string', title: '多行文本', name: 'textareaField', 'x-component': 'Input.TextArea', 'x-decorator': 'FormItem', 'x-component-props': { placeholder: '请输入内容', rows: 4 }, required: false },
    password: { type: 'string', title: '密码', name: 'passwordField', 'x-component': 'Password', 'x-decorator': 'FormItem', 'x-component-props': { placeholder: '请输入密码' }, required: false },
    number: { type: 'number', title: '数字字段', name: 'numberField', 'x-component': 'NumberPicker', 'x-decorator': 'FormItem', 'x-component-props': { placeholder: '请输入数字', min: 0, step: 1 }, required: false },
    boolean: { type: 'boolean', title: '开关', name: 'switchField', 'x-component': 'Switch', 'x-decorator': 'FormItem', default: false },
    date: { type: 'string', title: '日期', name: 'dateField', 'x-component': 'DatePicker', 'x-decorator': 'FormItem', 'x-component-props': { placeholder: '请选择日期', format: 'YYYY-MM-DD' }, required: false },
    time: { type: 'string', title: '时间', name: 'timeField', 'x-component': 'TimePicker', 'x-decorator': 'FormItem', 'x-component-props': { placeholder: '请选择时间', format: 'HH:mm:ss' }, required: false },
    range: { type: 'number', title: '滑块', name: 'rangeField', 'x-component': 'Range', 'x-decorator': 'FormItem', 'x-component-props': { min: 0, max: 100, step: 1 }, required: false },
    rating: { type: 'number', title: '评分', name: 'ratingField', 'x-component': 'Rating', 'x-decorator': 'FormItem', 'x-component-props': { max: 5, allowHalf: true }, required: false },
    select: { type: 'string', title: '下拉选择', name: 'selectField', 'x-component': 'Select', 'x-decorator': 'FormItem', 'x-component-props': { placeholder: '请选择' }, enum: [{ label: '选项一', value: '1' }, { label: '选项二', value: '2' }, { label: '选项三', value: '3' }] },
    radio: { type: 'string', title: '单选框', name: 'radioField', 'x-component': 'Radio.Group', 'x-decorator': 'FormItem', enum: [{ label: '选项A', value: 'A' }, { label: '选项B', value: 'B' }, { label: '选项C', value: 'C' }] },
    checkbox: { type: 'array', title: '多选框', name: 'checkboxField', 'x-component': 'Checkbox.Group', 'x-decorator': 'FormItem', enum: [{ label: '选项1', value: '1' }, { label: '选项2', value: '2' }, { label: '选项3', value: '3' }] },
    transfer: { type: 'array', title: '穿梭框', name: 'transferField', 'x-component': 'Transfer', 'x-decorator': 'FormItem', 'x-component-props': { showSearch: true }, enum: [{ label: '选项1', value: '1' }, { label: '选项2', value: '2' }, { label: '选项3', value: '3' }] },
    upload: { type: 'array', title: '上传', name: 'uploadField', 'x-component': 'Upload', 'x-decorator': 'FormItem', 'x-component-props': { action: '/upload', multiple: true, listType: 'text' }, required: false },
    FormLayout: { type: 'void', title: '布局容器', name: 'formLayout', 'x-component': 'FormLayout', 'x-component-props': { layout: 'vertical', labelCol: 6, wrapperCol: 18 } },
    FormCard: { type: 'void', title: '卡片', name: 'formCard', 'x-component': 'FormCard', 'x-component-props': { title: '卡片标题', className: 'card' } },
    FormBlock: { type: 'void', title: '分组', name: 'formBlock', 'x-component': 'FormBlock', 'x-component-props': { title: '分组标题' } },
    FormStep: { type: 'void', title: '分步表单', name: 'formStep', 'x-component': 'FormStep', 'x-component-props': { step: 0 } },
    FormItemGrid: { type: 'void', title: '栅格布局', name: 'formItemGrid', 'x-component': 'FormItemGrid', 'x-component-props': { cols: 2, gutter: 10 } },
    FormTextBox: { type: 'void', title: '文本布局', name: 'formTextBox', 'x-component': 'FormTextBox', 'x-component-props': { text: '文本内容' } },
    FormButtonGroup: { type: 'void', title: '按钮组', name: 'formButtonGroup', 'x-component': 'FormButtonGroup', 'x-component-props': { offset: 6 } },
};

function isLayout(type) { return LAYOUT_TYPES.includes(type); }
function isEnumType(type) { return ENUM_TYPES.includes(type); }

// ==================== 树形操作 ====================
function getChildren(parentId) { return formFields.filter(f => f.parentId === parentId); }
function getFieldById(id) { return formFields.find(f => f.id === id); }

function getDescendantIds(id) {
    const ids = [id];
    let changed = true;
    while (changed) {
        changed = false;
        for (const f of formFields) {
            if (ids.includes(f.parentId) && !ids.includes(f.id)) { ids.push(f.id); changed = true; }
        }
    }
    return ids;
}

function isDescendant(descId, ancestorId) { return getDescendantIds(ancestorId).includes(descId); }

// ==================== 拖拽 ====================
function initDrag() {
    document.querySelectorAll('.field-item').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/new-type', item.getAttribute('data-type'));
            e.dataTransfer.effectAllowed = 'copy';
            dragSourceId = null;
        });
    });
}

function handleCanvasDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = dragSourceId ? 'move' : 'copy';
    document.getElementById('formCanvas').classList.add('drag-over');
}
function handleCanvasDragLeave(e) {
    if (e.target === document.getElementById('formCanvas'))
        document.getElementById('formCanvas').classList.remove('drag-over');
}
function handleCanvasDrop(e) {
    e.preventDefault();
    document.getElementById('formCanvas').classList.remove('drag-over');
    const newType = e.dataTransfer.getData('text/new-type');
    if (newType) { addField(newType, null); }
    else if (dragSourceId !== null) {
        const field = getFieldById(dragSourceId);
        if (field) field.parentId = null;
        render(); updateAllCode();
    }
    dragSourceId = null;
}

function handleLayoutDragOver(e, layoutId) {
    e.preventDefault(); e.stopPropagation();
    e.dataTransfer.dropEffect = dragSourceId ? 'move' : 'copy';
    e.currentTarget.classList.add('drag-over');
}
function handleLayoutDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
function handleLayoutDrop(e, layoutId) {
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
    const newType = e.dataTransfer.getData('text/new-type');
    if (newType) { addField(newType, layoutId); }
    else if (dragSourceId !== null) {
        if (dragSourceId === layoutId || isDescendant(layoutId, dragSourceId)) {
            showToast('不能拖入自身或子容器'); dragSourceId = null; return;
        }
        const field = getFieldById(dragSourceId);
        if (field) field.parentId = layoutId;
        render(); updateAllCode();
    }
    dragSourceId = null;
}

// ==================== 字段管理 ====================
function addField(type, parentId) {
    const field = { id: nextId++, fieldType: type, parentId: parentId === undefined ? null : parentId, ...JSON.parse(JSON.stringify(defaultOptions[type])) };
    formFields.push(field);
    selectedId = field.id;
    render(); updateAllCode();
}

function removeField(id) {
    const ids = getDescendantIds(id);
    formFields = formFields.filter(f => !ids.includes(f.id));
    if (ids.includes(selectedId)) selectedId = null;
    render(); updateAllCode();
}

function moveField(id, direction) {
    const field = getFieldById(id);
    if (!field) return;
    const siblings = getChildren(field.parentId);
    const index = siblings.findIndex(f => f.id === id);
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= siblings.length) return;
    const a = formFields.indexOf(siblings[index]);
    const b = formFields.indexOf(siblings[swapIndex]);
    [formFields[a], formFields[b]] = [formFields[b], formFields[a]];
    render(); updateAllCode();
}

// ==================== 渲染 ====================
function render() {
    const canvas = document.getElementById('formCanvas');
    const placeholder = document.getElementById('canvasPlaceholder');
    const rootChildren = getChildren(null);
    canvas.innerHTML = '';
    canvas.appendChild(placeholder);
    placeholder.style.display = rootChildren.length === 0 ? '' : 'none';
    renderChildren(null, canvas);
    renderPropsEditor();
}

function renderChildren(parentId, container) {
    for (const field of getChildren(parentId)) {
        container.appendChild(createFieldCard(field));
    }
}

function createFieldCard(field) {
    const card = document.createElement('div');
    const layout = isLayout(field.fieldType);
    card.className = 'form-field-card' + (field.id === selectedId ? ' selected' : '') + (layout ? ' layout-card' : '');
    card.setAttribute('draggable', 'true');
    card.dataset.fieldId = field.id;
    card.onclick = (e) => { e.stopPropagation(); selectField(field.id); };
    card.addEventListener('dragstart', (e) => { dragSourceId = field.id; e.dataTransfer.effectAllowed = 'move'; e.stopPropagation(); });
    card.addEventListener('dragend', () => { dragSourceId = null; });

    const requiredStar = field.required ? '<span class="required-star">*</span>' : '';
    const children = getChildren(field.id);
    let html = `
        <div class="card-header">
            <span class="card-label">${escapeHtml(field.title)}${requiredStar} <span style="font-size:11px;color:#aaa;font-weight:400;">[${field.fieldType}]</span></span>
            <div class="card-actions">
                <button title="上移" onclick="event.stopPropagation();moveField(${field.id},'up')">▲</button>
                <button title="下移" onclick="event.stopPropagation();moveField(${field.id},'down')">▼</button>
                <button title="删除" onclick="event.stopPropagation();removeField(${field.id})">✕</button>
            </div>
        </div>`;
    if (layout) {
        html += `<div class="layout-drop-zone" id="dropzone-${field.id}" ondragover="handleLayoutDragOver(event,${field.id})" ondragleave="handleLayoutDragLeave(event)" ondrop="handleLayoutDrop(event,${field.id})">`;
        if (children.length === 0) html += `<div class="drop-hint">拖拽字段到此处添加子元素</div>`;
        html += `</div>`;
    } else {
        html += `<div class="card-preview">${createPreview(field)}</div>`;
    }
    card.innerHTML = html;
    if (layout && children.length > 0) {
        const dropZone = card.querySelector('.layout-drop-zone');
        if (dropZone) renderChildren(field.id, dropZone);
    }
    return card;
}

function createPreview(field) {
    const ft = field.fieldType;
    const cp = field['x-component-props'] || {};
    if (ft === 'string') return `<input type="text" placeholder="${cp.placeholder || ''}" disabled />`;
    if (ft === 'textarea') return `<textarea placeholder="${cp.placeholder || ''}" disabled></textarea>`;
    if (ft === 'password') return `<input type="password" placeholder="${cp.placeholder || ''}" disabled />`;
    if (ft === 'number') return `<input type="number" placeholder="${cp.placeholder || ''}" disabled />`;
    if (ft === 'boolean') return `<div class="switch-preview"></div>`;
    if (ft === 'date') return `<input type="date" disabled />`;
    if (ft === 'time') return `<input type="time" disabled />`;
    if (ft === 'range') return `<input type="range" disabled style="width:100%;accent-color:#4f7cff;" />`;
    if (ft === 'rating') return `<span style="font-size:18px;color:#ccc;">★★★★★</span>`;
    if (ft === 'select') { const opts = (field.enum || []).map(o => `<option>${o.label}</option>`).join(''); return `<select disabled><option>${cp.placeholder || '请选择'}</option>${opts}</select>`; }
    if (ft === 'radio') return `<div class="radio-group">${(field.enum || []).map(o => `<label><input type="radio" disabled />${o.label}</label>`).join('')}</div>`;
    if (ft === 'checkbox') return `<div class="checkbox-group">${(field.enum || []).map(o => `<label><input type="checkbox" disabled />${o.label}</label>`).join('')}</div>`;
    if (ft === 'transfer') return `<div style="display:flex;gap:8px;align-items:center;color:#999;font-size:12px;"><span>← 左侧列表</span><span>⇆</span><span>右侧列表 →</span></div>`;
    if (ft === 'upload') return `<div style="border:1px dashed #d0d5dd;border-radius:6px;padding:12px;text-align:center;color:#999;font-size:12px;">点击上传文件</div>`;
    return '';
}

function selectField(id) { selectedId = id; render(); updateAllCode(); }

function handleCanvasClick(e) {
    if (e.target === document.getElementById('formCanvas') || e.target.id === 'canvasPlaceholder') {
        selectedId = null; render();
    }
}

// ==================== 属性编辑 ====================
function renderPropsEditor() {
    const editor = document.getElementById('propsEditor');
    if (selectedId === null) {
        editor.innerHTML = `
            <div class="prop-group">
                <label>表单标题 (title)</label>
                <input type="text" value="${escapeHtml(formTitle)}" onchange="formTitle=this.value;updateAllCode()" />
            </div>
            <div class="empty-hint">点击画布中的字段编辑属性</div>`;
        return;
    }
    const f = getFieldById(selectedId);
    if (!f) { editor.innerHTML = '<div class="empty-hint">点击画布中的字段编辑属性</div>'; return; }

    const layout = isLayout(f.fieldType);
    const isEnum = isEnumType(f.fieldType) || (f.enum && f.enum.length);

    let html = `
        <div class="prop-group"><label>字段类型</label><input type="text" value="${f.fieldType}" disabled style="background:#f5f5f5;" /></div>
        <div class="prop-group"><label>title (标签)</label><input type="text" value="${escapeHtml(f.title)}" onchange="updateProp('title', this.value)" /></div>
        <div class="prop-group"><label>name (字段名)</label><input type="text" value="${escapeHtml(f.name)}" onchange="updateProp('name', this.value)" /></div>`;

    if (!layout) {
        html += `
            <div class="prop-group"><label>description (描述)</label><input type="text" value="${escapeHtml(f.description || '')}" onchange="updateProp('description', this.value)" placeholder="字段下方的帮助文字" /></div>
            <div class="prop-inline">
                <div class="prop-group"><label>type (数据类型)</label><select onchange="updateProp('type', this.value)">
                    <option value="string" ${f.type==='string'?'selected':''}>string</option><option value="number" ${f.type==='number'?'selected':''}>number</option>
                    <option value="boolean" ${f.type==='boolean'?'selected':''}>boolean</option><option value="array" ${f.type==='array'?'selected':''}>array</option>
                    <option value="object" ${f.type==='object'?'selected':''}>object</option>
                </select></div>
                <div class="prop-group"><label>readOnly (只读)</label><select onchange="updateProp('readOnly', this.value==='true')">
                    <option value="false" ${!f.readOnly?'selected':''}>false</option><option value="true" ${f.readOnly?'selected':''}>true</option>
                </select></div>
            </div>
            <div class="prop-row"><label><input type="checkbox" ${f.required ? 'checked' : ''} onchange="updateProp('required', this.checked)" /> required (必填)</label></div>`;
    }

    html += `<div class="section-header">组件配置</div>
        <div class="prop-group"><label>x-component</label><input type="text" value="${escapeHtml(f['x-component'] || '')}" onchange="updateProp('x-component', this.value)" /></div>`;
    if (!layout) {
        html += `<div class="prop-group"><label>x-decorator</label><input type="text" value="${escapeHtml(f['x-decorator'] || '')}" onchange="updateProp('x-decorator', this.value)" /></div>`;
    }

    // 布局组件可视化属性编辑
    if (layout && layoutPropConfigs[f.fieldType]) {
        const cp = f['x-component-props'] || {};
        html += `<div class="section-header">布局属性</div>`;
        for (const cfg of layoutPropConfigs[f.fieldType]) {
            const val = cp[cfg.key] !== undefined ? cp[cfg.key] : '';
            if (cfg.type === 'select') {
                const opts = cfg.options.map(o => `<option value="${o}" ${val === o ? 'selected' : ''}>${o}</option>`).join('');
                html += `<div class="prop-group"><label>${cfg.label} (${cfg.key})</label><select onchange="updateLayoutProp('${cfg.key}', this.value)">${opts}</select></div>`;
            } else if (cfg.type === 'number') {
                html += `<div class="prop-group"><label>${cfg.label} (${cfg.key})</label><input type="number" value="${val}" onchange="updateLayoutProp('${cfg.key}', Number(this.value))" /></div>`;
            } else {
                html += `<div class="prop-group"><label>${cfg.label} (${cfg.key})</label><input type="text" value="${escapeHtml(val)}" onchange="updateLayoutProp('${cfg.key}', this.value)" /></div>`;
            }
        }
    }

    // 非布局组件仍然用 JSON 编辑 x-component-props
    if (!layout) {
        html += `<div class="prop-group"><label>x-component-props (JSON)</label><textarea onchange="updateProp('x-component-props', JSON.parse(this.value))">${escapeHtml(JSON.stringify(f['x-component-props'] || {}, null, 2))}</textarea><div class="hint">JSON 格式，如 {"placeholder": "请输入", "maxLength": 100}</div></div>`;
        html += `<div class="prop-group"><label>x-decorator-props (JSON)</label><textarea onchange="updateProp('x-decorator-props', JSON.parse(this.value))">${escapeHtml(JSON.stringify(f['x-decorator-props'] || {}, null, 2))}</textarea><div class="hint">如 {"labelCol": 6, "wrapperCol": 18}</div></div>`;
    }

    if (isEnum) {
        const enumStr = (f.enum || []).map(o => `${o.label}:${o.value}`).join('\n');
        html += `<div class="prop-group"><label>enum (枚举选项，每行 label:value)</label><textarea onchange="updateEnum(this.value)">${escapeHtml(enumStr)}</textarea><div class="hint">每行格式: 标签:值</div></div>`;
    }

    if (!layout) {
        html += `<div class="prop-group"><label>default (默认值)</label><input type="text" value="${escapeHtml(f.default !== undefined ? String(f.default) : '')}" onchange="updateProp('default', this.value)" /></div>`;
    }

    if (!layout) {
        const valStr = f['x-validator'] ? JSON.stringify(f['x-validator'], null, 2) : '';
        html += `<div class="section-header">校验与联动</div>
            <div class="prop-group"><label>x-validator (JSON)</label><textarea onchange="updateProp('x-validator', JSON.parse(this.value))" placeholder='{"required": true, "message": "此项必填"}'>${escapeHtml(valStr)}</textarea><div class="hint">如 {"required": true, "message": "此项必填"} 或 [{"pattern": "/^\\d+$/", "message": "只能数字"}]</div></div>`;
        const reactStr = f['x-reactions'] ? JSON.stringify(f['x-reactions'], null, 2) : '';
        html += `<div class="prop-group"><label>x-reactions (JSON 数组)</label><textarea onchange="updateProp('x-reactions', JSON.parse(this.value))" placeholder='[]'>${escapeHtml(reactStr)}</textarea><div class="hint">联动表达式，如 [{"target":"otherField","when":"{{$self.value==='xxx'}}","fulfill":{"state":{"visible":false}}}]</div></div>`;
    }

    if (!layout) {
        html += `<div class="section-header">状态控制</div>
            <div class="prop-inline">
                <div class="prop-group"><label>x-display</label><select onchange="updateProp('x-display', this.value)">
                    <option value="" ${!f['x-display']?'selected':''}>默认(显示)</option><option value="visible" ${f['x-display']==='visible'?'selected':''}>visible</option>
                    <option value="hidden" ${f['x-display']==='hidden'?'selected':''}>hidden</option><option value="none" ${f['x-display']==='none'?'selected':''}>none(隐藏)</option>
                </select></div>
                <div class="prop-group"><label>x-editable</label><select onchange="updateProp('x-editable', this.value === '' ? undefined : this.value === 'true')">
                    <option value="" ${f['x-editable']===undefined?'selected':''}>默认(可编辑)</option><option value="true" ${f['x-editable']===true?'selected':''}>true</option>
                    <option value="false" ${f['x-editable']===false?'selected':''}>false(只读)</option>
                </select></div>
            </div>
            <div class="prop-group"><label>x-read-pretty (纯展示)</label><select onchange="updateProp('x-read-pretty', this.value === 'true')">
                <option value="false" ${!f['x-read-pretty']?'selected':''}>false</option><option value="true" ${f['x-read-pretty']?'selected':''}>true</option>
            </select></div>`;
    }

    editor.innerHTML = html;
}

function updateProp(key, value) {
    if (selectedId === null) return;
    const f = getFieldById(selectedId);
    if (!f) return;
    f[key] = value; render(); updateAllCode();
}

function updateLayoutProp(key, value) {
    if (selectedId === null) return;
    const f = getFieldById(selectedId);
    if (!f) return;
    if (!f['x-component-props']) f['x-component-props'] = {};
    f['x-component-props'][key] = value;
    render(); updateAllCode();
}

function updateEnum(str) {
    if (selectedId === null) return;
    const f = getFieldById(selectedId);
    if (!f) return;
    f.enum = str.split('\n').filter(l => l.trim()).map(line => {
        const [label, ...rest] = line.split(':');
        return { label: label.trim(), value: (rest.join(':') || label).trim() };
    });
    render(); updateAllCode();
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ==================== Schema 生成（递归） ====================
function buildSchemaObject() { return { title: formTitle, type: 'object', properties: buildProperties(null) }; }

function buildProperties(parentId) {
    const props = {};
    for (const f of getChildren(parentId)) {
        const prop = { type: f.type || 'string', title: f.title };
        if (f.name) prop.name = f.name;
        if (f.description) prop.description = f.description;
        if (f.required) prop.required = true;
        if (f.readOnly) prop.readOnly = true;
        if (f.default !== undefined && f.default !== '') {
            prop.default = f.type === 'number' ? Number(f.default) : f.type === 'boolean' ? (f.default === 'true') : f.default;
        }
        if (f['x-component']) prop['x-component'] = f['x-component'];
        if (f['x-decorator']) prop['x-decorator'] = f['x-decorator'];
        if (f['x-component-props'] && Object.keys(f['x-component-props']).length) prop['x-component-props'] = f['x-component-props'];
        if (f['x-decorator-props'] && Object.keys(f['x-decorator-props']).length) prop['x-decorator-props'] = f['x-decorator-props'];
        if (f['x-validator'] && (Array.isArray(f['x-validator']) ? f['x-validator'].length : Object.keys(f['x-validator']).length)) prop['x-validator'] = f['x-validator'];
        if (f['x-reactions'] && f['x-reactions'].length) prop['x-reactions'] = f['x-reactions'];
        if (f['x-display']) prop['x-display'] = f['x-display'];
        if (f['x-editable'] !== undefined) prop['x-editable'] = f['x-editable'];
        if (f['x-read-pretty']) prop['x-read-pretty'] = true;
        if (f.enum && f.enum.length) prop.enum = f.enum;
        if (isLayout(f.fieldType)) {
            const childProps = buildProperties(f.id);
            if (Object.keys(childProps).length) prop.properties = childProps;
        }
        props[f.name] = prop;
    }
    return props;
}

function toSchemaJSON() { return JSON.stringify(buildSchemaObject(), null, 2); }

// ==================== Markup JSX 生成（递归） ====================
function generateMarkupJSX() {
    if (formFields.length === 0) return '// 暂无表单字段';
    let code = `import React from 'react';\nimport { SchemaForm, SchemaMarkupField, Submit, Reset, FormButtonGroup, FormLayout, FormCard, FormBlock, FormStep, FormItemGrid, FormTextBox } from '@uform/antd';\n\nconst MyForm = () => {\n  return (\n    <SchemaForm\n      onSubmit={values => console.log(values)}\n      labelCol={6}\n      wrapperCol={18}\n    >\n`;
    code += generateMarkupFields(null, '      ');
    code += `      <FormButtonGroup offset={6}>\n        <Submit>提交</Submit>\n        <Reset>重置</Reset>\n      </FormButtonGroup>\n    </SchemaForm>\n  );\n};\n\nexport default MyForm;`;
    return code;
}

function generateMarkupFields(parentId, indent) {
    let code = '';
    for (const f of getChildren(parentId)) {
        const attrs = getMarkupAttrs(f);
        if (isLayout(f.fieldType)) {
            code += `${indent}<${f.fieldType}${attrs}>\n`;
            code += generateMarkupFields(f.id, indent + '  ');
            code += `${indent}</${f.fieldType}>\n`;
        } else {
            code += `${indent}<SchemaMarkupField${attrs}\n${indent}/>\n`;
        }
    }
    return code;
}

function getMarkupAttrs(f) {
    const attrs = [];
    const typeAttrMap = { string: 'string', textarea: 'string', password: 'string', select: 'string', radio: 'string', checkbox: 'array', number: 'number', boolean: 'boolean', date: 'string', time: 'string', range: 'number', rating: 'number', transfer: 'array', upload: 'array' };
    if (!isLayout(f.fieldType)) attrs.push(`type="${typeAttrMap[f.fieldType] || f.type || 'string'}"`);
    else attrs.push('type="void"');
    attrs.push(`name="${f.name}"`);
    attrs.push(`title="${f.title}"`);
    if (f.required) attrs.push('required');
    if (f.description) attrs.push(`description="${f.description}"`);
    if (f.readOnly) attrs.push('readOnly');
    if (f['x-component']) attrs.push(`x-component="${f['x-component']}"`);
    if (f['x-decorator']) attrs.push(`x-decorator="${f['x-decorator']}"`);
    if (f['x-component-props'] && Object.keys(f['x-component-props']).length) attrs.push(`x-component-props={${JSON.stringify(f['x-component-props'])}}`);
    if (f['x-decorator-props'] && Object.keys(f['x-decorator-props']).length) attrs.push(`x-decorator-props={${JSON.stringify(f['x-decorator-props'])}}`);
    if (f.enum && f.enum.length) attrs.push(`enum={${JSON.stringify(f.enum)}}`);
    if (f['x-validator'] && (Array.isArray(f['x-validator']) ? f['x-validator'].length : Object.keys(f['x-validator']).length)) attrs.push(`x-validator={${JSON.stringify(f['x-validator'])}}`);
    if (f['x-reactions'] && f['x-reactions'].length) attrs.push(`x-reactions={${JSON.stringify(f['x-reactions'])}}`);
    if (f['x-display']) attrs.push(`x-display="${f['x-display']}"`);
    if (f['x-editable'] !== undefined) attrs.push(`x-editable={${f['x-editable']}}`);
    if (f['x-read-pretty']) attrs.push('x-read-pretty');
    return attrs.length ? ' ' + attrs.join(' ') : '';
}

// ==================== JSON Schema 渲染 ====================
function generateJSONRender() {
    if (formFields.length === 0) return '// 暂无表单字段';
    const schema = buildSchemaObject();
    const schemaStr = JSON.stringify(schema, null, 2).split('\n').map(l => '      ' + l).join('\n');
    return `import React from 'react';\nimport { SchemaForm, Submit, Reset, FormButtonGroup } from '@uform/antd';\n\nconst schema = ${schemaStr.trimStart()};\n\nconst MyForm = () => {\n  return (\n    <SchemaForm\n      schema={schema}\n      onSubmit={values => console.log(values)}\n      labelCol={6}\n      wrapperCol={18}\n    >\n      <FormButtonGroup offset={6}>\n        <Submit>提交</Submit>\n        <Reset>重置</Reset>\n      </FormButtonGroup>\n    </SchemaForm>\n  );\n};\n\nexport default MyForm;`;
}

// ==================== 更新所有代码 ====================
function updateAllCode() {
    if (!document.getElementById('tabJson').classList.contains('hidden')) document.getElementById('jsonEditor').value = toSchemaJSON();
    if (!document.getElementById('tabMarkup').classList.contains('hidden')) document.getElementById('markupOutput').value = generateMarkupJSX();
    if (!document.getElementById('tabJsonRender').classList.contains('hidden')) document.getElementById('jsonRenderOutput').value = generateJSONRender();
}

// ==================== 导出 ====================
function exportFile(type) {
    if (type === 'json') { downloadFile('form-schema.json', toSchemaJSON()); showToast('Schema JSON 已导出'); }
    else if (type === 'markup') { downloadFile('MyForm.markup.jsx', generateMarkupJSX()); showToast('Markup JSX 已导出'); }
    else if (type === 'json-render') { downloadFile('MyForm.jsx', generateJSONRender()); showToast('JSON Schema 渲染组件已导出'); }
}

function downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

function clearForm() { formFields = []; selectedId = null; formTitle = '动态表单'; render(); updateAllCode(); showToast('已清空'); }

// ==================== Tab 切换 ====================
function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.add('hidden'));
    const map = { props: 0, json: 1, markup: 2, 'json-render': 3 };
    document.querySelectorAll('.tab')[map[tab] || 0].classList.add('active');
    if (tab === 'props') { document.getElementById('tabProps').classList.remove('hidden'); renderPropsEditor(); }
    else if (tab === 'json') { document.getElementById('tabJson').classList.remove('hidden'); document.getElementById('jsonEditor').value = toSchemaJSON(); }
    else if (tab === 'markup') { document.getElementById('tabMarkup').classList.remove('hidden'); document.getElementById('markupOutput').value = generateMarkupJSX(); }
    else if (tab === 'json-render') { document.getElementById('tabJsonRender').classList.remove('hidden'); document.getElementById('jsonRenderOutput').value = generateJSONRender(); }
}

// JSON 编辑器双向同步
function initJsonEditorSync() {
    document.getElementById('jsonEditor').addEventListener('input', function () {
        try { const parsed = JSON.parse(this.value); if (parsed && parsed.type === 'object' && parsed.properties) fromSchemaJSON(parsed); } catch (e) {}
    });
    document.getElementById('jsonEditor').addEventListener('blur', function () {
        try { const parsed = JSON.parse(this.value); if (parsed && parsed.type === 'object' && parsed.properties) fromSchemaJSON(parsed); } catch (e) { showToast('JSON 解析失败: ' + e.message); }
    });
}

// 从 Schema JSON 反向导入（递归），兼容 react-schema-editor 格式
function fromSchemaJSON(schema, parentId) {
    if (parentId === undefined) {
        formFields = []; nextId = 1; selectedId = null;
        if (schema.title) formTitle = schema.title;
    }
    const props = schema.properties || {};
    for (const [name, prop] of Object.entries(props)) {
        const component = prop['x-component'] || '';
        const cp = prop['x-component-props'] || {};
        let fieldType = 'string';
        if (component === 'Input.TextArea' || component === 'TextArea') fieldType = 'textarea';
        else if (component === 'Password' || cp.htmlType === 'password') fieldType = 'password';
        else if (component === 'NumberPicker') fieldType = 'number';
        else if (component === 'Switch') fieldType = 'boolean';
        else if (component === 'DatePicker') fieldType = 'date';
        else if (component === 'TimePicker') fieldType = 'time';
        else if (component === 'Range' || component === 'Slider') fieldType = 'range';
        else if (component === 'Rating' || component === 'Rate') fieldType = 'rating';
        else if (component === 'Select') fieldType = 'select';
        else if (component === 'Radio.Group' || component === 'Radio') fieldType = 'radio';
        else if (component === 'Checkbox.Group' || component === 'Checkbox') fieldType = 'checkbox';
        else if (component === 'Transfer') fieldType = 'transfer';
        else if (component === 'Upload') fieldType = 'upload';
        else if (LAYOUT_TYPES.includes(component)) fieldType = component;
        else if (prop.type === 'void' && component) fieldType = component;
        if (component === 'Checkbox' && prop.type === 'boolean') fieldType = 'boolean';

        const field = {
            id: nextId++, fieldType, parentId: parentId || null,
            type: prop.type || 'string', title: prop.title || name, name: name,
            description: prop.description || '', required: prop.required || false, readOnly: prop.readOnly || false,
            default: prop.default !== undefined ? prop.default : (cp.defaultChecked !== undefined ? cp.defaultChecked : undefined),
            'x-component': prop['x-component'] || '', 'x-decorator': prop['x-decorator'] || '',
            'x-component-props': prop['x-component-props'] || {}, 'x-decorator-props': prop['x-decorator-props'] || {},
            'x-validator': prop['x-validator'] || null, 'x-reactions': prop['x-reactions'] || null,
            'x-display': prop['x-display'] || '', 'x-editable': prop['x-editable'], 'x-read-pretty': prop['x-read-pretty'] || false,
            enum: prop.enum || [],
        };
        formFields.push(field);
        if (prop.properties) fromSchemaJSON({ type: 'object', properties: prop.properties }, field.id);
    }
    if (parentId === undefined) {
        selectedId = formFields.length > 0 ? formFields[0].id : null;
        render(); updateAllCode();
    }
}

// ==================== 预览模式 ====================
function togglePreview() {
    const overlay = document.getElementById('previewOverlay');
    if (overlay.classList.contains('show')) closePreview();
    else openPreview();
}

function openPreview() {
    const schema = buildSchemaObject();
    document.getElementById('previewTitle').textContent = schema.title || '表单预览';
    const formEl = document.getElementById('previewForm');
    formEl.innerHTML = '';
    renderPreviewFields(null, formEl);
    const submitBtn = document.createElement('button');
    submitBtn.className = 'preview-submit';
    submitBtn.textContent = '提交';
    submitBtn.onclick = (e) => { e.preventDefault(); submitPreview(); };
    formEl.appendChild(submitBtn);
    document.getElementById('previewOverlay').classList.add('show');
}

function closePreview() {
    document.getElementById('previewOverlay').classList.remove('show');
    document.getElementById('previewResult').classList.remove('show');
}

// 预览模式：布局容器只做定位，不展示标题/边框
function renderPreviewFields(parentId, container) {
    const children = getChildren(parentId);
    for (const field of children) {
        if (isLayout(field.fieldType)) {
            const cp = field['x-component-props'] || {};
            if (field.fieldType === 'FormItemGrid') {
                // 栅格布局：CSS Grid
                const grid = document.createElement('div');
                grid.style.display = 'grid';
                grid.style.gridTemplateColumns = `repeat(${cp.cols || 2}, 1fr)`;
                grid.style.gap = `${cp.gutter || 10}px`;
                grid.style.marginBottom = '16px';
                renderPreviewFields(field.id, grid);
                container.appendChild(grid);
            } else if (field.fieldType === 'FormLayout') {
                // 布局容器：透明，仅定位
                const wrapper = document.createElement('div');
                if (cp.layout === 'horizontal') wrapper.style.display = 'flex';
                renderPreviewFields(field.id, wrapper);
                container.appendChild(wrapper);
            } else if (field.fieldType === 'FormTextBox') {
                // 文本布局：展示文本内容
                const textDiv = document.createElement('div');
                textDiv.style.cssText = 'padding:8px 0;font-size:13px;color:#667085;margin-bottom:16px;';
                textDiv.textContent = cp.text || '';
                container.appendChild(textDiv);
                renderPreviewFields(field.id, container);
            } else if (field.fieldType === 'FormButtonGroup') {
                // 按钮组：跳过，提交按钮已在底部
                renderPreviewFields(field.id, container);
            } else {
                // FormCard / FormBlock / FormStep：仅作为容器，不展示标题和边框
                const wrapper = document.createElement('div');
                renderPreviewFields(field.id, wrapper);
                container.appendChild(wrapper);
            }
        } else {
            container.appendChild(createPreviewField(field));
        }
    }
}

function createPreviewField(field) {
    const div = document.createElement('div');
    div.className = 'preview-field';
    const cp = field['x-component-props'] || {};
    const req = field.required ? '<span class="req">*</span>' : '';
    const desc = field.description ? `<div class="desc">${escapeHtml(field.description)}</div>` : '';
    let inputType = 'text';
    if (field.fieldType === 'password' || cp.htmlType === 'password') inputType = 'password';
    if (field.fieldType === 'number') inputType = 'number';
    if (field.fieldType === 'date') inputType = 'date';
    if (field.fieldType === 'time') inputType = 'time';
    let inner = '';
    const label = `<label>${escapeHtml(field.title)}${req}</label>`;

    switch (field.fieldType) {
        case 'string': case 'password':
            inner = `<input type="${inputType}" name="${field.name}" placeholder="${cp.placeholder || ''}" ${field.readOnly ? 'readonly' : ''} value="${field.default || ''}" />`; break;
        case 'textarea':
            inner = `<textarea name="${field.name}" placeholder="${cp.placeholder || ''}" rows="${cp.rows || 4}" ${field.readOnly ? 'readonly' : ''}>${field.default || ''}</textarea>`; break;
        case 'number':
            inner = `<input type="number" name="${field.name}" placeholder="${cp.placeholder || ''}" min="${cp.min !== undefined ? cp.min : ''}" max="${cp.max !== undefined ? cp.max : ''}" step="${cp.step || 1}" ${field.readOnly ? 'readonly' : ''} value="${field.default !== undefined ? field.default : ''}" />`; break;
        case 'boolean': { const isOn = field.default === true || field.default === 'true'; inner = `<div class="preview-switch ${isOn ? 'on' : ''}" data-name="${field.name}" onclick="this.classList.toggle('on')"></div>`; break; }
        case 'date': inner = `<input type="date" name="${field.name}" ${field.readOnly ? 'readonly' : ''} value="${field.default || ''}" />`; break;
        case 'time': inner = `<input type="time" name="${field.name}" ${field.readOnly ? 'readonly' : ''} value="${field.default || ''}" />`; break;
        case 'range': inner = `<input type="range" name="${field.name}" min="${cp.min || 0}" max="${cp.max || 100}" step="${cp.step || 1}" value="${field.default || cp.min || 0}" oninput="this.nextElementSibling.textContent=this.value" /><span style="font-size:12px;color:#667085;margin-left:8px;">${field.default || cp.min || 0}</span>`; break;
        case 'rating': { const max = cp.max || 5; const cur = field.default || 0; let stars = ''; for (let i = 1; i <= max; i++) { stars += `<span class="${i <= cur ? 'active' : ''}" data-val="${i}" onclick="this.parentNode.querySelectorAll('span').forEach((s,j)=>s.classList.toggle('active',j<${i}));this.parentNode.dataset.val=${i}">★</span>`; } inner = `<div class="preview-rating" data-name="${field.name}" data-val="${cur}">${stars}</div>`; break; }
        case 'select': inner = `<select name="${field.name}" ${field.readOnly ? 'disabled' : ''}><option value="">${cp.placeholder || '请选择'}</option>${(field.enum || []).map(o => `<option value="${o.value}" ${field.default === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}</select>`; break;
        case 'radio': inner = `<div class="preview-radio" data-name="${field.name}">${(field.enum || []).map(o => `<label><input type="radio" name="${field.name}" value="${o.value}" ${field.default === o.value ? 'checked' : ''} ${field.readOnly ? 'disabled' : ''} />${o.label}</label>`).join('')}</div>`; break;
        case 'checkbox': inner = `<div class="preview-checkbox" data-name="${field.name}">${(field.enum || []).map(o => `<label><input type="checkbox" name="${field.name}" value="${o.value}" ${field.readOnly ? 'disabled' : ''} />${o.label}</label>`).join('')}</div>`; break;
        case 'transfer': inner = `<div style="display:flex;gap:12px;align-items:center;border:1px solid #e0e4ea;border-radius:6px;padding:12px;"><div style="flex:1;font-size:12px;color:#999;">${(field.enum || []).map(o => `<div style="padding:2px 0;"><input type="checkbox" name="${field.name}" value="${o.value}" /> ${o.label}</div>`).join('')}</div><span style="color:#ccc;">⇆</span><div style="flex:1;font-size:12px;color:#ccc;">右侧列表</div></div>`; break;
        case 'upload': inner = `<div class="preview-upload" onclick="showToast('文件上传（预览模式不可用）')">点击或拖拽文件上传</div>`; break;
        default: inner = `<input type="${inputType}" name="${field.name}" placeholder="${cp.placeholder || ''}" />`;
    }
    div.innerHTML = label + inner + desc;
    return div;
}

function submitPreview() {
    const formEl = document.getElementById('previewForm');
    const result = {};
    formEl.querySelectorAll('input[type="text"], input[type="password"], input[type="number"], input[type="date"], input[type="time"], textarea, select').forEach(el => { if (el.name) result[el.name] = el.type === 'number' ? Number(el.value) : el.value; });
    formEl.querySelectorAll('input[type="radio"]:checked').forEach(el => { result[el.name] = el.value; });
    const cbGroups = {};
    formEl.querySelectorAll('input[type="checkbox"]:checked').forEach(el => { if (el.name) { if (!cbGroups[el.name]) cbGroups[el.name] = []; cbGroups[el.name].push(el.value); } });
    Object.assign(result, cbGroups);
    formEl.querySelectorAll('.preview-switch').forEach(el => { result[el.dataset.name] = el.classList.contains('on'); });
    formEl.querySelectorAll('.preview-rating').forEach(el => { result[el.dataset.name] = Number(el.dataset.val) || 0; });
    formEl.querySelectorAll('input[type="range"]').forEach(el => { result[el.name] = Number(el.value); });
    const resultEl = document.getElementById('previewResult');
    resultEl.textContent = '提交数据:\n' + JSON.stringify(result, null, 2);
    resultEl.classList.add('show');
    showToast('表单已提交，查看下方数据');
}

// ==================== JSON 导入 ====================
function openImportModal() { document.getElementById('importTextarea').value = ''; document.getElementById('importModal').classList.add('show'); }
function closeImportModal() { document.getElementById('importModal').classList.remove('show'); }

function importFromText() {
    const text = document.getElementById('importTextarea').value.trim();
    if (!text) { showToast('请输入 JSON 内容'); return; }
    try {
        const parsed = JSON.parse(text);
        if (parsed && parsed.type === 'object' && parsed.properties) { fromSchemaJSON(parsed); closeImportModal(); showToast('JSON 导入成功'); }
        else showToast('JSON 格式不正确，需要 type: "object" 和 properties');
    } catch (e) { showToast('JSON 解析失败: ' + e.message); }
}

function importFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => { document.getElementById('importTextarea').value = e.target.result; };
    reader.readAsText(file);
}

// ==================== Toast ====================
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 1500);
}

// ==================== 初始化 ====================
function init() {
    initDrag();
    initJsonEditorSync();
    render();
}
