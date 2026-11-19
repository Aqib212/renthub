export interface Building {
  id: number;
  ownerId: number;
  name: string;
  holdingNumber: string | null;
  address: string | null;
  ward: string | null;
  area: string | null;
  district: string | null;
  description: string | null;
  totalFloors: number;
  createdAt: string;
  updatedAt: string;
}

export interface BuildingFormData {
  name: string;
  holdingNumber?: string;
  address?: string;
  ward?: string;
  area?: string;
  district?: string;
  description?: string;
}
