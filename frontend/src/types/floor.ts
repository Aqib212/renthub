export interface Floor {
  id: number;
  buildingId: number;
  name: string;
  description: string | null;
  totalFlats: number;
  createdAt: string;
  updatedAt: string;
}

export interface FloorFormData {
  name: string;
  description?: string;
}
