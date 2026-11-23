import { IndustryTemplateId } from '../types/schema';
import { TEMPLATE_IMAGE_ASSETS } from './templateAssets';

export interface TemplateShowcaseSample {
  templateId: IndustryTemplateId;
  imageUrl: string;
  sampleSlug: string;
  sampleItems: Array<{
    name: string;
    category: string;
    basePrice: number;
    discountPercent: number;
    variantHint: string;
  }>;
}

export const TEMPLATE_SHOWCASE_MEDIA: Record<IndustryTemplateId, TemplateShowcaseSample> = {
  'food-restaurant': {
    templateId: 'food-restaurant',
    imageUrl: TEMPLATE_IMAGE_ASSETS['food-restaurant'],
    sampleSlug: 'saffron-hearth',
    sampleItems: [
      {
        name: 'Wood-Fired Herb Half Chicken',
        category: 'Wood-Fired',
        basePrice: 540,
        discountPercent: 10,
        variantHint: 'Mild · Medium · Spicy',
      },
      {
        name: 'Charred Garlic Flatbread',
        category: 'Small Plates',
        basePrice: 220,
        discountPercent: 0,
        variantHint: 'Regular · Family Size',
      },
      {
        name: 'Smoked Harissa Rice Bowl',
        category: 'Signature Mains',
        basePrice: 360,
        discountPercent: 0,
        variantHint: 'Regular · Extra Protein',
      },
    ],
  },
  'cafe-drinks': {
    templateId: 'cafe-drinks',
    imageUrl: TEMPLATE_IMAGE_ASSETS['cafe-drinks'],
    sampleSlug: 'brew-cafe',
    sampleItems: [
      {
        name: 'Spanish Oat Cortado',
        category: 'Espresso Bar',
        basePrice: 185,
        discountPercent: 10,
        variantHint: '8oz · 12oz',
      },
      {
        name: 'French Butter Croissant',
        category: 'Bakery & Pastries',
        basePrice: 145,
        discountPercent: 0,
        variantHint: 'Single · Box of 4',
      },
      {
        name: 'Uji Ceremonial Matcha',
        category: 'Cold Brew & Matcha',
        basePrice: 210,
        discountPercent: 0,
        variantHint: 'Iced · Hot',
      },
    ],
  },
  'clothing-apparel': {
    templateId: 'clothing-apparel',
    imageUrl: TEMPLATE_IMAGE_ASSETS['clothing-apparel'],
    sampleSlug: 'atelier-koto',
    sampleItems: [
      {
        name: 'Structured Linen Overshirt',
        category: 'Outerwear',
        basePrice: 2890,
        discountPercent: 15,
        variantHint: 'S · M · L · XL',
      },
      {
        name: 'Organic Poplin Camp Shirt',
        category: 'Tailored Shirts',
        basePrice: 1850,
        discountPercent: 0,
        variantHint: 'Ivory · Charcoal',
      },
      {
        name: '280gsm Boxy Cotton Tee',
        category: 'Heavyweight Tees',
        basePrice: 980,
        discountPercent: 0,
        variantHint: 'S · M · L',
      },
    ],
  },
  'footwear-shoes': {
    templateId: 'footwear-shoes',
    imageUrl: TEMPLATE_IMAGE_ASSETS['footwear-shoes'],
    sampleSlug: 'stride-kicks',
    sampleItems: [
      {
        name: 'Apex Carbon Runner V2',
        category: 'Running',
        basePrice: 6490,
        discountPercent: 15,
        variantHint: 'US 8 · US 9 · US 10 · US 11',
      },
      {
        name: 'Tempo Knit Daily Trainer',
        category: 'Lifestyle Trainers',
        basePrice: 4850,
        discountPercent: 0,
        variantHint: 'US 7 · US 8 · US 9',
      },
      {
        name: 'Heritage Suede Court Low',
        category: 'Court Classics',
        basePrice: 4290,
        discountPercent: 10,
        variantHint: 'US 8 · US 9 · US 10',
      },
    ],
  },
  'gadgets-accessories': {
    templateId: 'gadgets-accessories',
    imageUrl: TEMPLATE_IMAGE_ASSETS['gadgets-accessories'],
    sampleSlug: 'voltcraft-gear',
    sampleItems: [
      {
        name: 'Alu65 Mechanical Keyboard',
        category: 'Mechanical Keyboards',
        basePrice: 5890,
        discountPercent: 12,
        variantHint: 'Linear · Tactile',
      },
      {
        name: 'Studio ANC Wireless Buds',
        category: 'Audio & Headphones',
        basePrice: 3490,
        discountPercent: 0,
        variantHint: 'Matte Slate · Chalk',
      },
      {
        name: '100W GaN Dual USB-C Hub',
        category: 'Chargers & GaN',
        basePrice: 2150,
        discountPercent: 10,
        variantHint: 'PH/US Plug · Braided Cable',
      },
    ],
  },
  'food-bistro-pro': {
    templateId: 'food-bistro-pro',
    imageUrl: TEMPLATE_IMAGE_ASSETS['food-bistro-pro'],
    sampleSlug: 'maison-ember',
    sampleItems: [
      {
        name: 'Truffle & Porcini Agnolotti',
        category: 'Artisanal Pasta',
        basePrice: 680,
        discountPercent: 10,
        variantHint: 'Solo Tasting · Table Share',
      },
      {
        name: 'Dry-Aged Duck Breast Jus',
        category: 'Tasting Mains',
        basePrice: 940,
        discountPercent: 0,
        variantHint: 'Medium Rare · Medium',
      },
      {
        name: 'Charred Leek & Hazelnut Tartine',
        category: 'Chef Starters',
        basePrice: 340,
        discountPercent: 0,
        variantHint: 'Warm Sourdough · Gluten-Free',
      },
    ],
  },
  'cafe-atelier-pro': {
    templateId: 'cafe-atelier-pro',
    imageUrl: TEMPLATE_IMAGE_ASSETS['cafe-atelier-pro'],
    sampleSlug: 'kanso-atelier',
    sampleItems: [
      {
        name: 'Uji First-Harvest Matcha Einspänner',
        category: 'Ceremonial Matcha',
        basePrice: 235,
        discountPercent: 0,
        variantHint: 'Iced 12oz · Oat Milk',
      },
      {
        name: 'Ethiopia Guji Hand Pour-Over',
        category: 'Hand-Pour Single Origin',
        basePrice: 210,
        discountPercent: 10,
        variantHint: 'Hot Carafe · Iced Crystal',
      },
      {
        name: 'Pistachio Crème Kouign-Amann',
        category: 'Viennoiserie',
        basePrice: 175,
        discountPercent: 0,
        variantHint: 'Single Pastry · Gift Box of 4',
      },
    ],
  },
  'clothing-editorial-pro': {
    templateId: 'clothing-editorial-pro',
    imageUrl: TEMPLATE_IMAGE_ASSETS['clothing-editorial-pro'],
    sampleSlug: 'vespera-maison',
    sampleItems: [
      {
        name: 'Belted European Flax Duster Coat',
        category: 'Tailored Outerwear',
        basePrice: 4950,
        discountPercent: 10,
        variantHint: 'XS · S · M · L',
      },
      {
        name: 'Double-Pleated Architectural Trouser',
        category: 'Wide Trousers',
        basePrice: 3150,
        discountPercent: 0,
        variantHint: '28 · 30 · 32 · 34',
      },
      {
        name: 'Fine-Gauge Merino Knit Polo',
        category: 'Silk & Knitwear',
        basePrice: 2490,
        discountPercent: 0,
        variantHint: 'Ecru · Obsidian',
      },
    ],
  },
  'footwear-studio-pro': {
    templateId: 'footwear-studio-pro',
    imageUrl: TEMPLATE_IMAGE_ASSETS['footwear-studio-pro'],
    sampleSlug: 'apex-vault',
    sampleItems: [
      {
        name: 'Monolith Suede Trail V3',
        category: 'Trail Technical',
        basePrice: 7490,
        discountPercent: 10,
        variantHint: 'US 8 · US 9 · US 10 · US 11',
      },
      {
        name: 'AeroPlate Carbon Marathon Pro',
        category: 'Carbon Racers',
        basePrice: 8290,
        discountPercent: 0,
        variantHint: 'US 8 · US 9 · US 10',
      },
      {
        name: 'Archival Nubuck Court Low',
        category: 'Suede Heritage',
        basePrice: 5190,
        discountPercent: 15,
        variantHint: 'US 7 · US 8 · US 9 · US 10',
      },
    ],
  },
  'gadgets-flagship-pro': {
    templateId: 'gadgets-flagship-pro',
    imageUrl: TEMPLATE_IMAGE_ASSETS['gadgets-flagship-pro'],
    sampleSlug: 'monolith-labs',
    sampleItems: [
      {
        name: 'Ti-65 Gasket Aluminum Keyboard',
        category: 'Custom Keyboards',
        basePrice: 8950,
        discountPercent: 10,
        variantHint: 'Linear Obsidian · Tactile',
      },
      {
        name: 'Reference Studio ANC Over-Ear',
        category: 'Reference Audio',
        basePrice: 11490,
        discountPercent: 0,
        variantHint: 'Anodized Slate · Silver',
      },
      {
        name: '140W CNC Desktop GaN Dock',
        category: 'GaN Power',
        basePrice: 3690,
        discountPercent: 12,
        variantHint: 'PH/US Cable · Braided',
      },
    ],
  },
};
