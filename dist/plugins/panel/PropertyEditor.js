// src/plugins/panel/PropertyEditor.ts
/**
 * Property Editor Component
 * Provides a UI for editing CSS animation properties of selected elements
 */
import { Component } from '../../core/BaseComponent';
export class PropertyEditor extends Component {
    constructor(options) {
        super(options.container, 'timeline-property-editor');
        this.selectedElement = null;
        this.propertyGroups = [];
        this.eventEmitter = options.eventEmitter;
        this.options = options;
        this.initPropertyGroups();
        this.init();
    }
    /**
     * Initialize property groups
     */
    initPropertyGroups() {
        this.propertyGroups = [
            {
                name: 'Position & Size',
                icon: '📐',
                expanded: true,
                properties: [
                    { name: 'x', label: 'X Position', type: 'number', defaultValue: 0, step: 1, unit: 'px' },
                    { name: 'y', label: 'Y Position', type: 'number', defaultValue: 0, step: 1, unit: 'px' },
                    { name: 'width', label: 'Width', type: 'number', defaultValue: 100, min: 1, step: 1, unit: 'px' },
                    { name: 'height', label: 'Height', type: 'number', defaultValue: 100, min: 1, step: 1, unit: 'px' },
                    { name: 'zIndex', label: 'Z-Index', type: 'number', defaultValue: 1, step: 1 }
                ]
            },
            {
                name: 'Transform',
                icon: '🔄',
                expanded: true,
                properties: [
                    { name: 'rotation', label: 'Rotation', type: 'number', defaultValue: 0, step: 1, unit: 'deg' },
                    { name: 'scaleX', label: 'Scale X', type: 'range', defaultValue: 1, min: 0.1, max: 5, step: 0.1 },
                    { name: 'scaleY', label: 'Scale Y', type: 'range', defaultValue: 1, min: 0.1, max: 5, step: 0.1 },
                    { name: 'translateX', label: 'Translate X', type: 'number', defaultValue: 0, step: 1, unit: 'px', cssProperty: 'transform' },
                    { name: 'translateY', label: 'Translate Y', type: 'number', defaultValue: 0, step: 1, unit: 'px', cssProperty: 'transform' },
                    { name: 'skewX', label: 'Skew X', type: 'number', defaultValue: 0, step: 1, unit: 'deg', cssProperty: 'transform' },
                    { name: 'skewY', label: 'Skew Y', type: 'number', defaultValue: 0, step: 1, unit: 'deg', cssProperty: 'transform' }
                ]
            },
            {
                name: 'Appearance',
                icon: '🎨',
                expanded: true,
                properties: [
                    { name: 'opacity', label: 'Opacity', type: 'range', defaultValue: 1, min: 0, max: 1, step: 0.01 },
                    { name: 'backgroundColor', label: 'Background Color', type: 'color', defaultValue: '#ffffff' },
                    { name: 'borderWidth', label: 'Border Width', type: 'number', defaultValue: 0, min: 0, step: 1, unit: 'px' },
                    { name: 'borderColor', label: 'Border Color', type: 'color', defaultValue: '#000000' },
                    { name: 'borderRadius', label: 'Border Radius', type: 'number', defaultValue: 0, min: 0, step: 1, unit: 'px' },
                    { name: 'boxShadowX', label: 'Shadow X', type: 'number', defaultValue: 0, step: 1, unit: 'px', cssProperty: 'boxShadow' },
                    { name: 'boxShadowY', label: 'Shadow Y', type: 'number', defaultValue: 0, step: 1, unit: 'px', cssProperty: 'boxShadow' },
                    { name: 'boxShadowBlur', label: 'Shadow Blur', type: 'number', defaultValue: 0, min: 0, step: 1, unit: 'px', cssProperty: 'boxShadow' },
                    { name: 'boxShadowSpread', label: 'Shadow Spread', type: 'number', defaultValue: 0, step: 1, unit: 'px', cssProperty: 'boxShadow' },
                    { name: 'boxShadowColor', label: 'Shadow Color', type: 'color', defaultValue: 'rgba(0,0,0,0.5)', cssProperty: 'boxShadow' }
                ]
            },
            {
                name: 'Text',
                icon: '📝',
                properties: [
                    { name: 'color', label: 'Text Color', type: 'color', defaultValue: '#000000' },
                    { name: 'fontSize', label: 'Font Size', type: 'number', defaultValue: 16, min: 1, step: 1, unit: 'px' },
                    {
                        name: 'fontWeight', label: 'Font Weight', type: 'select', defaultValue: 'normal',
                        options: [
                            { value: 'normal', label: 'Normal' },
                            { value: 'bold', label: 'Bold' },
                            { value: '100', label: '100' },
                            { value: '200', label: '200' },
                            { value: '300', label: '300' },
                            { value: '400', label: '400' },
                            { value: '500', label: '500' },
                            { value: '600', label: '600' },
                            { value: '700', label: '700' },
                            { value: '800', label: '800' },
                            { value: '900', label: '900' }
                        ]
                    },
                    { name: 'fontFamily', label: 'Font Family', type: 'text', defaultValue: 'Arial, sans-serif' },
                    {
                        name: 'textAlign', label: 'Text Align', type: 'select', defaultValue: 'left',
                        options: [
                            { value: 'left', label: 'Left' },
                            { value: 'center', label: 'Center' },
                            { value: 'right', label: 'Right' },
                            { value: 'justify', label: 'Justify' }
                        ]
                    },
                    { name: 'lineHeight', label: 'Line Height', type: 'number', defaultValue: 1.2, step: 0.1 },
                    { name: 'letterSpacing', label: 'Letter Spacing', type: 'number', defaultValue: 0, step: 0.1, unit: 'px' },
                    { name: 'textShadowX', label: 'Text Shadow X', type: 'number', defaultValue: 0, step: 1, unit: 'px', cssProperty: 'textShadow' },
                    { name: 'textShadowY', label: 'Text Shadow Y', type: 'number', defaultValue: 0, step: 1, unit: 'px', cssProperty: 'textShadow' },
                    { name: 'textShadowBlur', label: 'Text Shadow Blur', type: 'number', defaultValue: 0, min: 0, step: 1, unit: 'px', cssProperty: 'textShadow' },
                    { name: 'textShadowColor', label: 'Text Shadow Color', type: 'color', defaultValue: 'rgba(0,0,0,0.5)', cssProperty: 'textShadow' }
                ]
            },
            {
                name: 'Filters',
                icon: '🔍',
                properties: [
                    { name: 'blur', label: 'Blur', type: 'number', defaultValue: 0, min: 0, step: 1, unit: 'px', cssProperty: 'filter' },
                    { name: 'brightness', label: 'Brightness', type: 'range', defaultValue: 100, min: 0, max: 200, step: 1, unit: '%', cssProperty: 'filter' },
                    { name: 'contrast', label: 'Contrast', type: 'range', defaultValue: 100, min: 0, max: 200, step: 1, unit: '%', cssProperty: 'filter' },
                    { name: 'grayscale', label: 'Grayscale', type: 'range', defaultValue: 0, min: 0, max: 100, step: 1, unit: '%', cssProperty: 'filter' },
                    { name: 'hueRotate', label: 'Hue Rotate', type: 'range', defaultValue: 0, min: 0, max: 360, step: 1, unit: 'deg', cssProperty: 'filter' },
                    { name: 'invert', label: 'Invert', type: 'range', defaultValue: 0, min: 0, max: 100, step: 1, unit: '%', cssProperty: 'filter' },
                    { name: 'saturate', label: 'Saturate', type: 'range', defaultValue: 100, min: 0, max: 200, step: 1, unit: '%', cssProperty: 'filter' },
                    { name: 'sepia', label: 'Sepia', type: 'range', defaultValue: 0, min: 0, max: 100, step: 1, unit: '%', cssProperty: 'filter' }
                ]
            },
            {
                name: 'Layout',
                icon: '📏',
                properties: [
                    {
                        name: 'display', label: 'Display', type: 'select', defaultValue: 'block',
                        options: [
                            { value: 'block', label: 'Block' },
                            { value: 'flex', label: 'Flex' },
                            { value: 'grid', label: 'Grid' },
                            { value: 'none', label: 'None' }
                        ]
                    },
                    {
                        name: 'overflow', label: 'Overflow', type: 'select', defaultValue: 'visible',
                        options: [
                            { value: 'visible', label: 'Visible' },
                            { value: 'hidden', label: 'Hidden' },
                            { value: 'scroll', label: 'Scroll' },
                            { value: 'auto', label: 'Auto' }
                        ]
                    },
                    {
                        name: 'justifyContent', label: 'Justify Content', type: 'select', defaultValue: 'flex-start',
                        options: [
                            { value: 'flex-start', label: 'Start' },
                            { value: 'flex-end', label: 'End' },
                            { value: 'center', label: 'Center' },
                            { value: 'space-between', label: 'Space Between' },
                            { value: 'space-around', label: 'Space Around' }
                        ]
                    },
                    {
                        name: 'alignItems', label: 'Align Items', type: 'select', defaultValue: 'stretch',
                        options: [
                            { value: 'flex-start', label: 'Start' },
                            { value: 'flex-end', label: 'End' },
                            { value: 'center', label: 'Center' },
                            { value: 'baseline', label: 'Baseline' },
                            { value: 'stretch', label: 'Stretch' }
                        ]
                    },
                    {
                        name: 'flexDirection', label: 'Flex Direction', type: 'select', defaultValue: 'row',
                        options: [
                            { value: 'row', label: 'Row' },
                            { value: 'row-reverse', label: 'Row Reverse' },
                            { value: 'column', label: 'Column' },
                            { value: 'column-reverse', label: 'Column Reverse' }
                        ]
                    }
                ]
            }
        ];
    }
    /**
     * Initialize the property editor
     */
    init() {
        this.initialize();
        // Listen for element selection events
        this.eventEmitter.on('panel:element:selected', (element) => {
            this.setSelectedElement(element);
        });
        this.eventEmitter.on('panel:element:deselected', () => {
            this.setSelectedElement(null);
        });
    }
    /**
     * Initialize event listeners
     */
    initialize() {
        const element = this.getElement();
        if (element) {
            element.addEventListener('change', this.handleChange.bind(this));
            element.addEventListener('input', this.handleInput.bind(this));
            element.addEventListener('click', this.handleClick.bind(this));
        }
    }
    /**
     * Set the selected element
     * @param element Selected element or null
     */
    setSelectedElement(element) {
        this.selectedElement = element;
        this.update({});
    }
    /**
     * Generate HTML for the property editor
     */
    render() {
        return `
      <div id="${this.elementId}" class="timeline-property-editor">
        <div class="timeline-property-editor-header">
          <h3>Properties</h3>
        </div>
        <div class="timeline-property-editor-content">
          ${this.selectedElement
            ? this.renderPropertyGroups()
            : '<div class="timeline-property-editor-empty">No element selected</div>'}
        </div>
      </div>
    `;
    }
    /**
     * Update the property editor
     */
    update(data) {
        const element = this.getElement();
        if (element) {
            const content = element.querySelector('.timeline-property-editor-content');
            if (content) {
                content.innerHTML = this.selectedElement
                    ? this.renderPropertyGroups()
                    : '<div class="timeline-property-editor-empty">No element selected</div>';
            }
        }
    }
    /**
     * Render property groups
     */
    renderPropertyGroups() {
        return this.propertyGroups.map((group, index) => {
            const isExpanded = group.expanded !== false;
            return `
        <div class="timeline-property-group">
          <div class="timeline-property-group-header" data-group-index="${index}">
            ${group.icon ? `<span class="timeline-property-group-icon">${group.icon}</span>` : ''}
            <span class="timeline-property-group-name">${group.name}</span>
            <span class="timeline-property-group-toggle">${isExpanded ? '▼' : '►'}</span>
          </div>
          <div class="timeline-property-group-content" style="${isExpanded ? '' : 'display: none;'}">
            ${this.renderProperties(group.properties)}
          </div>
        </div>
      `;
        }).join('');
    }
    /**
     * Render properties in a group
     */
    renderProperties(properties) {
        return properties.map(property => {
            const value = this.getPropertyValue(property);
            const id = `property-${property.name}`;
            return `
        <div class="timeline-property-row">
          <label for="${id}" class="timeline-property-label" title="${property.name}">${property.label}</label>
          <div class="timeline-property-input">
            ${this.renderInput(property, id, value)}
          </div>
        </div>
      `;
        }).join('');
    }
    /**
     * Render appropriate input for a property
     */
    renderInput(property, id, value) {
        var _a;
        switch (property.type) {
            case 'number':
                return `
          <div class="timeline-property-number-input">
            <input type="number" id="${id}" data-property="${property.name}" 
              value="${value}" 
              ${property.min !== undefined ? `min="${property.min}"` : ''} 
              ${property.max !== undefined ? `max="${property.max}"` : ''} 
              ${property.step !== undefined ? `step="${property.step}"` : ''} 
            />
            ${property.unit ? `<span class="timeline-property-unit">${property.unit}</span>` : ''}
          </div>
        `;
            case 'text':
                return `
          <input type="text" id="${id}" data-property="${property.name}" value="${value}" />
        `;
            case 'color':
                return `
          <div class="timeline-property-color-input">
            <input type="color" id="${id}" data-property="${property.name}" value="${this.normalizeColor(value)}" />
            <input type="text" id="${id}-text" data-property="${property.name}" value="${value}" />
          </div>
        `;
            case 'select':
                return `
          <select id="${id}" data-property="${property.name}">
            ${(_a = property.options) === null || _a === void 0 ? void 0 : _a.map(option => `<option value="${option.value}" ${value === option.value ? 'selected' : ''}>${option.label}</option>`).join('')}
          </select>
        `;
            case 'checkbox':
                return `
          <input type="checkbox" id="${id}" data-property="${property.name}" ${value ? 'checked' : ''} />
        `;
            case 'range':
                return `
          <div class="timeline-property-range-input">
            <input type="range" id="${id}" data-property="${property.name}" 
              value="${value}" 
              ${property.min !== undefined ? `min="${property.min}"` : ''} 
              ${property.max !== undefined ? `max="${property.max}"` : ''} 
              ${property.step !== undefined ? `step="${property.step}"` : ''} 
            />
            <span class="timeline-property-value">${value}${property.unit || ''}</span>
          </div>
        `;
            default:
                return `<input type="text" id="${id}" data-property="${property.name}" value="${value}" />`;
        }
    }
    /**
     * Get property value from selected element or default
     */
    getPropertyValue(property) {
        if (!this.selectedElement)
            return property.defaultValue;
        // Check if the property exists in the element's properties
        if (this.selectedElement.properties && property.name in this.selectedElement.properties) {
            return this.selectedElement.properties[property.name];
        }
        // Special handling for base properties
        if (property.name in this.selectedElement) {
            return this.selectedElement[property.name];
        }
        return property.defaultValue;
    }
    /**
     * Handle input events (for ranges and immediate updates)
     */
    handleInput(e) {
        var _a;
        const target = e.target;
        if (!target || !target.dataset.property)
            return;
        const property = target.dataset.property;
        const type = target.type;
        // Update display value for range inputs
        if (type === 'range') {
            const valueDisplay = (_a = target.parentElement) === null || _a === void 0 ? void 0 : _a.querySelector('.timeline-property-value');
            if (valueDisplay) {
                const propertyDef = this.findPropertyByName(property);
                valueDisplay.textContent = `${target.value}${(propertyDef === null || propertyDef === void 0 ? void 0 : propertyDef.unit) || ''}`;
            }
        }
    }
    /**
     * Handle change events
     */
    handleChange(e) {
        const target = e.target;
        if (!target || !target.dataset.property || !this.selectedElement)
            return;
        const property = target.dataset.property;
        let value;
        // Get value based on input type
        switch (target.type) {
            case 'checkbox':
                value = target.checked;
                break;
            case 'number':
                value = parseFloat(target.value);
                break;
            default:
                value = target.value;
        }
        // Update the property
        this.options.onPropertyChange(this.selectedElement.id, property, value);
    }
    /**
     * Handle click events
     */
    handleClick(e) {
        const target = e.target;
        // Toggle property group
        const groupHeader = this.findParentWithClass(target, 'timeline-property-group-header');
        if (groupHeader) {
            const groupIndex = parseInt(groupHeader.getAttribute('data-group-index') || '-1');
            if (groupIndex >= 0 && groupIndex < this.propertyGroups.length) {
                // Toggle group expanded state
                this.propertyGroups[groupIndex].expanded = !this.propertyGroups[groupIndex].expanded;
                // Update display
                const groupContent = groupHeader.nextElementSibling;
                if (groupContent) {
                    groupContent.style.display = this.propertyGroups[groupIndex].expanded ? '' : 'none';
                }
                // Update toggle icon
                const toggleIcon = groupHeader.querySelector('.timeline-property-group-toggle');
                if (toggleIcon) {
                    toggleIcon.textContent = this.propertyGroups[groupIndex].expanded ? '▼' : '►';
                }
            }
        }
    }
    /**
     * Find property definition by name
     */
    findPropertyByName(name) {
        for (const group of this.propertyGroups) {
            const property = group.properties.find(p => p.name === name);
            if (property)
                return property;
        }
        return undefined;
    }
    /**
     * Normalize color value to hex format for color inputs
     */
    normalizeColor(color) {
        // If it's already a hex color, return it
        if (color.startsWith('#')) {
            return color;
        }
        // For rgb/rgba colors, we'd need a conversion to hex
        // For simplicity, returning a default color
        return '#000000';
    }
    /**
     * Find parent element with specific class
     */
    findParentWithClass(element, className) {
        while (element && !element.classList.contains(className)) {
            element = element.parentElement;
        }
        return element;
    }
    /**
     * Clean up event listeners
     */
    destroy() {
        const element = this.getElement();
        if (element) {
            element.removeEventListener('change', this.handleChange.bind(this));
            element.removeEventListener('input', this.handleInput.bind(this));
            element.removeEventListener('click', this.handleClick.bind(this));
        }
    }
}
//# sourceMappingURL=PropertyEditor.js.map