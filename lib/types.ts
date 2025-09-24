export type Role = 'system' | 'user' | 'assistant';
export interface Message {
  role: Role;
  content: string;
  id?: string;
  timestamp?: string;
} 
