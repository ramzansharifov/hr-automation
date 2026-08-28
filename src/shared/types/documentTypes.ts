export interface DocumentTypeRecord {
  id: number;
  enterpriseId: number;
  enterpriseName: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaveDocumentTypeParams {
  id?: number;
  enterpriseId?: number;
  name: string;
  isActive: boolean;
}
