
import { Product, Activity, RevenueData } from './types';

export const MOCK_REVENUE: RevenueData[] = [
  { month: 'Jan', year: 2026, revenue: 45000 },
  { month: 'Feb', year: 2026, revenue: 62000 },
  { month: 'Mar', year: 2026, revenue: 85000 },
  { month: 'Apr', year: 2026, revenue: 105000 },
  { month: 'May', year: 2026, revenue: 48000 },
  { month: 'Jun', year: 2026, revenue: 92000 },
  { month: 'Jul', year: 2026, revenue: 32000 },
  { month: 'Aug', year: 2026, revenue: 88000 },
  { month: 'Sep', year: 2026, revenue: 12000 },
];

export const MOCK_ACTIVITIES: Activity[] = [
  { id: '1', timestamp: '2026-02-02 09:30', user: 'Admin01', action: 'Added Product', item: 'Diamond Pendant 003' },
  { id: '2', timestamp: '2026-02-02 10:15', user: 'Staff01', action: 'Completed Sale', item: 'Gold Ring 001 (Qty: 2)' },
  { id: '3', timestamp: '2026-02-02 11:00', user: 'Admin01', action: 'Updated Price', item: 'Ruby Earring 002 → ₱1,900' },
  { id: '4', timestamp: '2026-02-02 11:30', user: 'Staff02', action: 'Completed Sale', item: 'Silver Bracelet 005 (Qty: 1)' },
];

export const MOCK_LOW_STOCK: Product[] = [
  {
    id: '001',
    name: 'Eternal Silver Ring',
    stock: 1,
    price: 3200,
    material: '925 Sterling Silver',
    materialGrade: 'S925 Hallmarked',
    weightGrams: 4.5,
    category: 'Rings',
    specs: 'Sterling silver, minimalist band, size 7.',
    detailedDescription: 'A timeless sterling silver band designed for everyday elegance. Features a high-polish finish and a comfort-fit interior.',
    mainImage: 'https://images.unsplash.com/photo-1605100804763-247f67b3f8ad?auto=format&fit=crop&q=80&w=800',
    thumbnails: [
      'https://images.unsplash.com/photo-1605100804763-247f67b3f8ad?auto=format&fit=crop&q=80&w=400',
      'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&q=80&w=400',
      'https://images.unsplash.com/photo-1589128777073-263566ae5e4d?auto=format&fit=crop&q=80&w=400',
      'https://images.unsplash.com/photo-1598560917505-59a3ad559071?auto=format&fit=crop&q=80&w=400',
    ]
  },
  {
    id: '002',
    name: 'Royal Ruby Earrings',
    stock: 3,
    price: 18000,
    material: '14k Rose Gold',
    materialGrade: 'Natural Ruby / 14K',
    weightGrams: 2.1,
    category: 'Earrings',
    specs: 'Gold plated studs, natural ruby inlay.',
    detailedDescription: 'Exquisite stud earrings featuring 1-carat natural rubies set in handcrafted 14k rose gold. Perfect for gala events.',
    mainImage: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&q=80&w=800',
    thumbnails: [
      'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&q=80&w=400',
      'https://images.unsplash.com/photo-1596622723231-b20320c7346b?auto=format&fit=crop&q=80&w=400',
      'https://images.unsplash.com/photo-1573408302355-4e0b7300a78c?auto=format&fit=crop&q=80&w=400',
      'https://images.unsplash.com/photo-1635767798638-3e25273a8236?auto=format&fit=crop&q=80&w=400',
    ]
  },
  {
    id: '003',
    name: 'Gilded Chain Necklace',
    stock: 2,
    price: 45000,
    material: '24k Pure Gold',
    materialGrade: '24K Saudi Gold',
    weightGrams: 12.8,
    category: 'Necklaces',
    specs: '18-inch length, lobster claw clasp.',
    detailedDescription: 'Heavy-gauge 24k gold chain. Each link is individually polished to ensure maximum brilliance and durability.',
    mainImage: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&q=80&w=800',
    thumbnails: [
      'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&q=80&w=400',
      'https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?auto=format&fit=crop&q=80&w=400',
      'https://images.unsplash.com/photo-1611085583191-a3b13b24424a?auto=format&fit=crop&q=80&w=400',
      'https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&q=80&w=400',
    ]
  }
];
