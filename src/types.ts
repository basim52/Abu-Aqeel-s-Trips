export interface Trip {
  id: string;
  name: string;
  budget: number;
  members: string[];
  memberCommitments?: Record<string, number>;
  memberPhones?: Record<string, string>;
  departureTime?: string;
  departureLocation?: string;
  locationUrl?: string;
  ownerId: string;
  createdAt: any;
  updatedAt: any;
}

export interface Task {
  id: string;
  title: string;
  assignedTo: string;
  completed: boolean;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  category: 'food' | 'fuel' | 'supplies' | 'other';
  createdAt: any;
}

export interface GearItem {
  id: string;
  name: string;
  provider: string;
  status: 'available' | 'needed';
}

export interface ItineraryEvent {
  id: string;
  time: string;
  description: string;
}

export interface Contribution {
  id: string;
  memberName: string;
  amount: number;
  createdAt: any;
}

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}
