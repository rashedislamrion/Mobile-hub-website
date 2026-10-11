import { sanitizePublicProduct } from './product.service';

describe('sanitizePublicProduct', () => {
  const SENSITIVE_KEYS = [
    'costPrice',
    'buyingPrice',
    'wholesalePrice',
    'supplier',
    'supplierId',
    'internalNotes',
    'phoneUnits',
    'branchInventories',
  ];

  it('should remove all internal/sensitive fields from root product and variants', () => {
    const rawProduct = {
      id: 'prod-123',
      name: 'Samsung Galaxy S24',
      slug: 'samsung-galaxy-s24',
      regularPrice: 95000,
      salePrice: 90000,
      costPrice: 75000,
      buyingPrice: 74000,
      wholesalePrice: 82000,
      supplierId: 'supp-456',
      supplier: { id: 'supp-456', name: 'Global Tech Wholesale' },
      internalNotes: 'Purchased with bulk discount batch #44',
      variants: [
        {
          id: 'var-1',
          sku: 'S24-BLK',
          price: 90000,
          stock: 5,
          costPrice: 75000,
          buyingPrice: 74000,
          wholesalePrice: 82000,
          supplierId: 'supp-456',
          supplier: { id: 'supp-456' },
          phoneUnits: [{ id: 'pu-1', imei1: '123456789012345' }],
          branchInventories: [{ branchId: 'b-1', quantity: 5 }],
        },
      ],
      relatedProducts: [
        {
          id: 'prod-999',
          name: 'Galaxy S24 Case',
          slug: 'galaxy-s24-case',
          regularPrice: 1200,
          costPrice: 400,
          buyingPrice: 350,
          wholesalePrice: 600,
          variants: [
            {
              id: 'var-case-1',
              price: 1200,
              costPrice: 400,
            },
          ],
        },
      ],
    };

    const sanitized = sanitizePublicProduct(rawProduct);

    // Verify root object
    for (const key of ['costPrice', 'buyingPrice', 'wholesalePrice', 'supplier', 'supplierId', 'internalNotes']) {
      expect((sanitized as any)[key]).toBeUndefined();
    }

    // Verify variants
    expect(sanitized.variants).toHaveLength(1);
    for (const key of SENSITIVE_KEYS) {
      expect((sanitized.variants[0] as any)[key]).toBeUndefined();
    }

    // Verify related products
    expect(sanitized.relatedProducts).toHaveLength(1);
    const related = sanitized.relatedProducts[0];
    expect((related as any).costPrice).toBeUndefined();
    expect((related as any).buyingPrice).toBeUndefined();
    expect((related as any).wholesalePrice).toBeUndefined();
    expect((related.variants[0] as any).costPrice).toBeUndefined();

    // Verify public fields are preserved
    expect(sanitized.id).toBe('prod-123');
    expect(sanitized.name).toBe('Samsung Galaxy S24');
    expect(sanitized.regularPrice).toBe(95000);
    expect(sanitized.variants[0].sku).toBe('S24-BLK');
  });
});
