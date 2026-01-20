import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';

// --- Types ---

export type SectionType = 'text' | 'table' | 'key-value' | 'signature' | 'amount-summary';

export interface BlockBase {
  id: string;
  type: SectionType;
  isVisible: boolean;
  label?: string; // For admin UI only
}

export interface TextBlock extends BlockBase {
  type: 'text';
  content: string; // HTML or simple text with variables
}

export interface TableColumn {
  id: string;
  header: string;
  key: string; // Variable name
  width: string; // Percentage or fixed
  type: 'text' | 'number' | 'amount' | 'tax';
}

export interface TableBlock extends BlockBase {
  type: 'table';
  columns: TableColumn[];
  rows?: any[]; // For Fill Mode: stores the actual data rows
  showTotal: boolean;
  showTax: boolean;
}

export interface KeyValueItem {
  id: string;
  key: string;
  value: string; // Can match variable
}

export interface KeyValueBlock extends BlockBase {
  type: 'key-value';
  items: KeyValueItem[];
  layout: '1-col' | '2-col' | '3-col';
}

export interface SignatureBlock extends BlockBase {
  type: 'signature';
  signatoryLabel: string;
}

export interface AmountSummaryBlock extends BlockBase {
  type: 'amount-summary';
  fields: { label: string; key: string }[];
}

export type DocumentSection = TextBlock | TableBlock | KeyValueBlock | SignatureBlock | AmountSummaryBlock;

export interface DocumentHeader {
  showLogo: boolean;
  orgDetailsVisible: boolean;
  layout: 'left' | 'center' | 'right';
  customText?: string;
  // Manual overrides for Org details
  orgName?: string;
  orgAddress?: string;
  orgGstin?: string;
  orgEmail?: string;
  orgMobile?: string;
  orgLogoUrl?: string; // Logo URL from Entity Master Data
}

export interface DocumentFooter {
  text: string;
  showBankDetails: boolean;
  showPageNumbers: boolean;
}

export interface DocumentTemplateState {
  meta: {
    name: string;
    type: string;
    status: 'draft' | 'active' | 'archived';
    description?: string;
    version: number;
  };
  mode: 'design' | 'fill'; // Added Mode
  header: DocumentHeader;
  sections: DocumentSection[];
  footer: DocumentFooter;
  documentData: {
    clientName: string;
    date: string;
    referenceNo: string;
  };
}

// --- Actions ---

export type DocumentBuilderAction =
  | { type: 'SET_MODE'; payload: 'design' | 'fill' }
  | { type: 'SET_META'; payload: Partial<DocumentTemplateState['meta']> }
  | { type: 'SET_DOCUMENT_DATA'; payload: Partial<DocumentTemplateState['documentData']> }
  | { type: 'UPDATE_HEADER'; payload: Partial<DocumentHeader> }
  | { type: 'UPDATE_FOOTER'; payload: Partial<DocumentFooter> }
  | { type: 'ADD_SECTION'; payload: { type: SectionType; index?: number } } // Simplified payload to just object in reducer
  | { type: 'REMOVE_SECTION'; payload: string }
  | { type: 'UPDATE_SECTION'; payload: { id: string; updates: Partial<DocumentSection> } }
  | { type: 'UPDATE_SECTION_DATA'; payload: { sectionId: string; data: any } } // New action for data updates
  | { type: 'REORDER_SECTIONS'; payload: { activeId: string; overId: string } }
  | { type: 'LOAD_TEMPLATE'; payload: Partial<DocumentTemplateState> };


// --- Initial State ---

const initialState: DocumentTemplateState = {
  meta: {
    name: '',
    type: 'invoice',
    status: 'draft',
    version: 1
  },
  mode: 'design',
  header: {
    showLogo: true,
    orgDetailsVisible: true,
    layout: 'left',
  },
  sections: [],
  footer: {
    text: '',
    showBankDetails: false,
    showPageNumbers: true,
  },
  documentData: {
    clientName: '',
    date: new Date().toISOString().split('T')[0],
    referenceNo: '',
  },
};

// --- Reducer ---

function documentBuilderReducer(state: DocumentTemplateState, action: DocumentBuilderAction): DocumentTemplateState {
  switch (action.type) {
    case 'SET_MODE':
      return { ...state, mode: action.payload };
    case 'SET_DOCUMENT_DATA':
      return {
        ...state,
        documentData: { ...state.documentData, ...action.payload }
      };
    case 'SET_META':
      return { ...state, meta: { ...state.meta, ...action.payload } };
    case 'UPDATE_HEADER':
      return { ...state, header: { ...state.header, ...action.payload } };
    case 'UPDATE_FOOTER':
      return { ...state, footer: { ...state.footer, ...action.payload } };
    case 'ADD_SECTION': {
      // handle both object payload and simple type string if legacy
      const type = (action.payload as any).type || action.payload;
      const index = (action.payload as any).index;

      const newSection = createNewSection(type);
      const sections = [...state.sections];
      if (typeof index === 'number') {
        sections.splice(index, 0, newSection);
      } else {
        sections.push(newSection);
      }
      return { ...state, sections };
    }
    case 'REMOVE_SECTION':
      return { ...state, sections: state.sections.filter((s) => s.id !== action.payload) };
    case 'UPDATE_SECTION':
      return {
        ...state,
        sections: state.sections.map((s) =>
          s.id === action.payload.id ? { ...s, ...action.payload.updates } as DocumentSection : s
        ),
      };
    case 'UPDATE_SECTION_DATA':
      return {
        ...state,
        sections: state.sections.map(section =>
          section.id === action.payload.sectionId
            ? { ...section, ...action.payload.data }
            : section
        )
      };
    case 'REORDER_SECTIONS': {
      const { activeId, overId } = action.payload;
      const oldIndex = state.sections.findIndex((s) => s.id === activeId);
      const newIndex = state.sections.findIndex((s) => s.id === overId);

      if (oldIndex === -1 || newIndex === -1) return state;

      const sections = [...state.sections];
      const [moved] = sections.splice(oldIndex, 1);
      sections.splice(newIndex, 0, moved);
      return { ...state, sections };
    }
    case 'LOAD_TEMPLATE':
      return {
        ...initialState,
        ...action.payload,
        // Deep merge objects to ensure defaults remain if payload is partial
        meta: { ...initialState.meta, ...(action.payload.meta || {}) },
        header: { ...initialState.header, ...(action.payload.header || {}) },
        footer: { ...initialState.footer, ...(action.payload.footer || {}) },
        sections: Array.isArray(action.payload.sections) ? action.payload.sections : [],
        documentData: { ...initialState.documentData, ...(action.payload.documentData || {}) },
        mode: action.payload.mode || state.mode // Preserve mode if not explicitly in payload
      };
    default:
      return state;
  }
}

function createNewSection(type: SectionType): DocumentSection {
  const id = uuidv4();
  const common = { id, type, isVisible: true, label: 'New Section' };

  switch (type) {
    case 'text':
      return { ...common, type: 'text', content: '<p>Enter text here...</p>' };
    case 'table':
      return {
        ...common,
        type: 'table',
        columns: [
          { id: uuidv4(), header: 'Item', key: 'item_name', width: '40%', type: 'text' },
          { id: uuidv4(), header: 'Qty', key: 'quantity', width: '15%', type: 'number' },
          { id: uuidv4(), header: 'Rate', key: 'rate', width: '20%', type: 'amount' },
          { id: uuidv4(), header: 'Amount', key: 'amount', width: '25%', type: 'amount' }
        ],
        showTotal: true,
        showTax: true
      };
    case 'key-value':
      return { ...common, type: 'key-value', items: [], layout: '2-col' };
    case 'amount-summary':
      return { ...common, type: 'amount-summary', fields: [] };
    case 'signature':
      return { ...common, type: 'signature', signatoryLabel: 'Authorized Signatory' };
    default:
      return { ...common, type: 'text', content: '' } as TextBlock;
  }
}

// --- Context ---

interface DocumentBuilderContextType {
  state: DocumentTemplateState;
  dispatch: React.Dispatch<DocumentBuilderAction>;
}

const DocumentBuilderContext = createContext<DocumentBuilderContextType | undefined>(undefined);

export const DocumentBuilderProvider: React.FC<{ children: ReactNode; initialTemplate?: Partial<DocumentTemplateState> }> = ({
  children,
  initialTemplate,
}) => {
  const [state, dispatch] = useReducer(documentBuilderReducer, { ...initialState, ...initialTemplate });

  return (
    <DocumentBuilderContext.Provider value={{ state, dispatch }}>
      {children}
    </DocumentBuilderContext.Provider>
  );
};

export const useDocumentBuilder = () => {
  const context = useContext(DocumentBuilderContext);
  if (!context) {
    throw new Error('useDocumentBuilder must be used within a DocumentBuilderProvider');
  }
  return context;
};
