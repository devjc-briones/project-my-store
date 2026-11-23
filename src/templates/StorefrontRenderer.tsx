import { FoodTemplate } from './FoodTemplate';
import { DrinksTemplate } from './DrinksTemplate';
import { ClothingTemplate } from './ClothingTemplate';
import { ShoesTemplate } from './ShoesTemplate';
import { GadgetsTemplate } from './GadgetsTemplate';
import { FoodBistroProTemplate } from './pro/FoodBistroProTemplate';
import { CafeAtelierProTemplate } from './pro/CafeAtelierProTemplate';
import { ClothingEditorialProTemplate } from './pro/ClothingEditorialProTemplate';
import { FootwearStudioProTemplate } from './pro/FootwearStudioProTemplate';
import { GadgetsFlagshipProTemplate } from './pro/GadgetsFlagshipProTemplate';
import { StorefrontInformationSettingsPage } from '../components/storefront/StorefrontInformationSettingsPage';
import { useStore } from '../context/StoreContext';
import { StorefrontTemplateProps, useStorefrontPage } from './templateTypes';

export function StorefrontRenderer(props: StorefrontTemplateProps) {
  const { getBuyerCheckoutInfo } = useStore();
  const [currentPage, setCurrentPage] = useStorefrontPage(props.activePage, props.onChangePage);

  const savedInfo = props.currentBuyer ? getBuyerCheckoutInfo() : null;
  const hasSavedBuyerInfo = Boolean(
    props.currentBuyer &&
      savedInfo &&
      (savedInfo.fullName.trim() ||
        savedInfo.phoneNumber.trim() ||
        savedInfo.deliveryAddress.trim())
  );

  if (currentPage === 'info-settings') {
    return (
      <StorefrontInformationSettingsPage
        store={props.store}
        viewport={props.viewport}
        isPreview={props.isPreview}
        cartCount={props.cartCount}
        currentBuyer={props.currentBuyer}
        activePage={currentPage}
        onNavigatePage={setCurrentPage}
        onOpenCart={props.onOpenCart}
        onOpenTrackOrder={props.onOpenTrackOrder}
        onOpenBuyerAuth={props.onOpenBuyerAuth}
        onOpenBuyerAccount={props.onOpenBuyerAccount}
      />
    );
  }

  const forwardedProps: StorefrontTemplateProps = {
    ...props,
    activePage: currentPage,
    onChangePage: setCurrentPage,
    hasSavedBuyerInfo: props.hasSavedBuyerInfo ?? hasSavedBuyerInfo,
  };

  switch (props.store.templateId) {
    case 'food-restaurant':
      return <FoodTemplate {...forwardedProps} />;
    case 'cafe-drinks':
      return <DrinksTemplate {...forwardedProps} />;
    case 'clothing-apparel':
      return <ClothingTemplate {...forwardedProps} />;
    case 'footwear-shoes':
      return <ShoesTemplate {...forwardedProps} />;
    case 'gadgets-accessories':
      return <GadgetsTemplate {...forwardedProps} />;
    case 'food-bistro-pro':
      return <FoodBistroProTemplate {...forwardedProps} />;
    case 'cafe-atelier-pro':
      return <CafeAtelierProTemplate {...forwardedProps} />;
    case 'clothing-editorial-pro':
      return <ClothingEditorialProTemplate {...forwardedProps} />;
    case 'footwear-studio-pro':
      return <FootwearStudioProTemplate {...forwardedProps} />;
    case 'gadgets-flagship-pro':
      return <GadgetsFlagshipProTemplate {...forwardedProps} />;
    default:
      return <FoodTemplate {...forwardedProps} />;
  }
}
