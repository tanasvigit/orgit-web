import { DocumentTemplateState, DocumentSection, TableBlock } from './DocumentBuilderProvider';

export const serializeDocumentState = (state: DocumentTemplateState) => {
    // 1. Serialize Header
    // For now, we'll just generate a simple HTML structure based on config.
    // In a real app, this might use a template engine or more complex logic.
    const headerHTML = `
        <div class="header-container ${state.header.layout}">
            ${state.header.showLogo ? '<div class="logo">{{org.logo}}</div>' : ''}
            ${state.header.orgDetailsVisible ? `
                <div class="org-details">
                    <h2>{{org.name}}</h2>
                    <p>{{org.address}}</p>
                    <p>GST: {{org.gst}}</p>
                </div>
            ` : ''}
        </div>
    `;

    // 2. Serialize Body (Sections)
    const bodyHTML = state.sections.map(section => {
        if (section.type === 'text') {
            return `<div class="section text-section">${(section as any).content}</div>`;
        }
        if (section.type === 'table') {
            const table = section as TableBlock;
            const headers = table.columns.map(c => `<th>${c.header}</th>`).join('');
            const rowCells = table.columns.map(c => `<td>{{formatted_${c.key}}}</td>`).join('');

            return `
                <div class="section table-section">
                    <table class="w-full">
                        <thead><tr>${headers}</tr></thead>
                        <tbody>
                            {{#each items}}
                            <tr>${rowCells}</tr>
                            {{/each}}
                        </tbody>
                        ${table.showTotal ? '<tfoot><tr><td colspan="100%">Total: ₹{{total_amount}}</td></tr></tfoot>' : ''}
                    </table>
                </div>
            `;
        }
        if (section.type === 'signature') {
            return `
                <div class="section signature-section" style="margin-top: 50px; text-align: right;">
                    <div style="display: inline-block; border-top: 1px solid #000; min-width: 200px; padding-top: 5px;">
                        <strong>${(section as any).signatoryLabel || 'Authorized Signatory'}</strong>
                    </div>
                </div>
            `;
        }
        if (section.type === 'amount-summary') {
            return `
                <div class="section amount-summary-section" style="margin-top: 20px;">
                    <table style="margin-left: auto; width: 50%;">
                        ${((section as any).fields || []).map((f: any) => `
                            <tr>
                                <td>${f.label}</td>
                                <td style="text-align: right;">{{${f.key}}}</td>
                            </tr>
                        `).join('')}
                    </table>
                </div>
            `;
        }
        return '';
    }).join('\n');

    // 3. Serialize Schema (Editable Fields)
    // We extract variables from text blocks and columns to define what's editable.
    const editableFields = [];
    // (Simplistic extraction for demo)
    if (state.sections.some(s => s.type === 'table')) {
        editableFields.push({ name: 'items', type: 'array', label: 'Line Items' });
    }

    return {
        headerTemplate: headerHTML,
        bodyTemplate: bodyHTML,
        // Embed builderConfig in templateSchema to ensure it persists if backend lacks strict column
        templateSchema: {
            editableFields,
            _builderConfig: state
        },
        builderConfig: state
    };
};
