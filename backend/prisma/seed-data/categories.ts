import { relativeDate } from './dates';

export const categories = [
  {
    name: 'Office',
    color: '#64748b',
  },
  {
    name: 'Travel',
    color: '#0f766e',
  },
  {
    name: 'Software',
    color: '#2563eb',
  },
  {
    name: 'Marketing',
    color: '#db2777',
  },
  {
    name: 'Maintenance',
    color: '#d97706',
  },
  {
    name: 'Utilities',
    color: '#7c3aed',
  },
  {
    name: 'Fuel',
    color: '#dc2626',
  },
  {
    name: 'Cleaning',
    color: '#0891b2',
  },
  {
    name: 'Food',
    color: '#16a34a',
  },
  {
    name: 'Printing',
    color: '#4f46e5',
  },
  {
    name: 'Legacy communications',
    color: '#475569',
    archivedAt: relativeDate(-28),
  },
  {
    name: 'Events',
    color: '#b45309',
    archivedAt: relativeDate(-20),
  },
];
