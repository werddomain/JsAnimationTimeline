// demo/editor/src/main.ts
import { createEditor, createPropertiesPanelPlugin } from '@kazo-ca/timeline-editor';
import { htmlDocument } from './document';
import './style.css';

const host = document.getElementById('editor-host');
if (host === null) throw new Error('Editor host missing');
const editor = createEditor(host, { data: htmlDocument(), plugins: [createPropertiesPanelPlugin()] });
window.editorDemo = editor;
window.addEventListener('pagehide', (event) => { if (!event.persisted) editor.destroy(); });
