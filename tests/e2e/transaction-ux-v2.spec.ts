import {test,expect} from '@playwright/test';
test.use({viewport:{width:390,height:844}});
test('UMKM canonical order detail requires a buyer session',async({page})=>{await page.goto('/umkm/pesanan/10000000-0000-4000-8000-000000000001');await expect(page).toHaveURL(/\/login/);await expect(page.getByRole('heading',{name:/masuk/i})).toBeVisible();});
test('supplier guided creation requires a supplier session',async({page})=>{await page.goto('/supplier/catalog/new');await expect(page).toHaveURL(/\/login/);await expect(page.locator('body')).not.toContainText('Nama Produk');});
test('private partial drafts cannot be listed anonymously',async({request})=>{const result=await request.get('/api/suppliers/offers');expect(result.status()).toBe(401);});
test('a lost buyer session cannot withdraw somebody else’s transaction',async({request})=>{const result=await request.post('/api/umkm/orders/10000000-0000-4000-8000-000000000001/withdraw');expect(result.status()).toBe(401);});
