import { NativePurchases, PURCHASE_TYPE, Transaction, Product } from '@capgo/native-purchases';

// 제품 ID 정의 (구글 콘솔과 일치해야 함)
export const PRODUCT_IDS = {
    AD_FREE: 'ad_free_promo',
    UNLIMITED_POS: 'unlimited_pos_promo',
    FULL_PACK: 'premium_pack_promo',
} as const;

export type ProductId = typeof PRODUCT_IDS[keyof typeof PRODUCT_IDS];

class PaymentService {
    private products: Product[] = [];

    /**
     * 결제 시스템 초기화
     */
    async initialize(): Promise<Product[]> {
        try {
            const identifiers = Object.values(PRODUCT_IDS);
            const { products } = await NativePurchases.getProducts({
                productIdentifiers: identifiers,
                productType: PURCHASE_TYPE.INAPP,
            });
            this.products = products;
            return products;
        } catch (error) {
            console.error('PaymentService init failed:', error);
            return [];
        }
    }

    /**
     * 실제 구글 서버에서 구매 내역을 가져옴
     */
    async restorePurchases(): Promise<string[]> {
        try {
            console.log('Fetching purchases from Google Play...');
            // getPurchases는 현재 로그인된 스토어 계정의 실시간 내역을 반환함
            const { purchases } = await NativePurchases.getPurchases({
                productType: PURCHASE_TYPE.INAPP
            });

            // 상태값이 정확히 "1"(구매 완료)인 것만 필터링
            const activePurchases = (purchases || [])
                .filter(p => String(p.purchaseState) === "1")
                .map(p => p.productIdentifier);

            console.log('Active purchases found:', activePurchases);
            return activePurchases;
        } catch (error) {
            console.error('Failed to get purchases:', error);
            return [];
        }
    }

    async purchase(productId: ProductId): Promise<boolean> {
        try {
            const transaction: Transaction = await NativePurchases.purchaseProduct({
                productIdentifier: productId,
                productType: PURCHASE_TYPE.INAPP,
            });
            return String(transaction.purchaseState) === "1";
        } catch (error) {
            console.error('Purchase failed:', error);
            return false;
        }
    }
}

export const paymentService = new PaymentService();
