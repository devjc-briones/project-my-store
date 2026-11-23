import foodRestaurantImg from '../assets/images/template_food_restaurant_1795032346538.jpg';
import cafeDrinksImg from '../assets/images/template_cafe_drinks_1795032346573.jpg';
import clothingApparelImg from '../assets/images/template_clothing_apparel_1795032349980.jpg';
import footwearShoesImg from '../assets/images/template_footwear_shoes_1795032348171.jpg';
import gadgetsAccessoriesImg from '../assets/images/template_gadgets_accessories_1795032348700.jpg';
import foodBistroProImg from '../assets/images/pro_bistro_dining_1795350683657.jpg';
import cafeAtelierProImg from '../assets/images/pro_roastery_atelier_1795350684715.jpg';
import clothingEditorialProImg from '../assets/images/pro_maison_editorial_1795350684392.jpg';
import footwearStudioProImg from '../assets/images/pro_kinetic_footwear_1795350683550.jpg';
import gadgetsFlagshipProImg from '../assets/images/pro_flagship_hardware_1795350683769.jpg';
import { IndustryTemplateId } from '../types/schema';

export const TEMPLATE_IMAGE_ASSETS: Record<IndustryTemplateId, string> = {
  'food-restaurant': foodRestaurantImg,
  'cafe-drinks': cafeDrinksImg,
  'clothing-apparel': clothingApparelImg,
  'footwear-shoes': footwearShoesImg,
  'gadgets-accessories': gadgetsAccessoriesImg,
  'food-bistro-pro': foodBistroProImg,
  'cafe-atelier-pro': cafeAtelierProImg,
  'clothing-editorial-pro': clothingEditorialProImg,
  'footwear-studio-pro': footwearStudioProImg,
  'gadgets-flagship-pro': gadgetsFlagshipProImg,
};

const LEGACY_TEMPLATE_ASSET_MAP: Record<string, string> = {
  '/src/assets/images/template_food_restaurant_1795032346538.jpg': foodRestaurantImg,
  '/src/assets/images/template_cafe_drinks_1795032346573.jpg': cafeDrinksImg,
  '/src/assets/images/template_clothing_apparel_1795032349980.jpg': clothingApparelImg,
  '/src/assets/images/template_footwear_shoes_1795032348171.jpg': footwearShoesImg,
  '/src/assets/images/template_gadgets_accessories_1795032348700.jpg': gadgetsAccessoriesImg,
  '/src/assets/images/pro_bistro_dining_1795350683657.jpg': foodBistroProImg,
  '/src/assets/images/pro_roastery_atelier_1795350684715.jpg': cafeAtelierProImg,
  '/src/assets/images/pro_maison_editorial_1795350684392.jpg': clothingEditorialProImg,
  '/src/assets/images/pro_kinetic_footwear_1795350683550.jpg': footwearStudioProImg,
  '/src/assets/images/pro_flagship_hardware_1795350683769.jpg': gadgetsFlagshipProImg,
};

/**
 * Normalizes legacy `/src/assets/images/...` paths (e.g., from persisted localStorage)
 * to Vite-bundled asset URLs so default template images always load cleanly in production.
 */
export function resolveTemplateAssetUrl(url?: string): string | undefined {
  if (!url) return url;
  const trimmed = url.trim();
  return LEGACY_TEMPLATE_ASSET_MAP[trimmed] ?? url;
}
