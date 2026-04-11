import { ProductCatalog } from "@/components/catalog/product-catalog";
import { getCatalogItems } from "@/lib/catalog/catalog";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const catalogItems = await getCatalogItems();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <ProductCatalog items={catalogItems} />
    </main>
  );
}
