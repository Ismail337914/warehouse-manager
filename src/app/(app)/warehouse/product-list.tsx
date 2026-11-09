"use client";

import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ClipboardList, PackagePlus, Plus, Tags, Truck } from "lucide-react";

import { Pagination, QueryState, SearchInput } from "@/components/list";
import { CsvExportButton } from "@/components/csv-export-button";
import { useCurrentUser } from "@/components/providers";
import { StockBadge } from "@/components/status-badges";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  NativeSelect,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { can } from "@/lib/permissions";
import { fetchCategories, fetchProductLocations, fetchProducts, fetchProductsForExport } from "@/lib/queries/products";
import { queryKeys } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { useListParams } from "@/lib/use-list-params";
import { formatMoney } from "@/lib/utils";

export function ProductList() {
  const user = useCurrentUser();
  const { values, page, update } = useListParams({ q: "", category: "", status: "", location: "", sort: "name" });
  const params = { ...values, page };

  const products = useQuery({
    queryKey: queryKeys.products.list(params),
    queryFn: () => fetchProducts(createClient(), params),
    placeholderData: keepPreviousData,
  });
  const categories = useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: () => fetchCategories(createClient()),
  });
  const locations = useQuery({
    queryKey: queryKeys.products.locations,
    queryFn: () => fetchProductLocations(createClient()),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>Proizvodi</CardTitle>
          <div className="flex flex-wrap gap-2">
            {can(user.role, "categories.manage") && (
              <Button asChild variant="outline" size="sm">
                <Link href="/warehouse/categories">
                  <Tags className="h-4 w-4" />
                  Kategorije
                </Link>
              </Button>
            )}
            {can(user.role, "suppliers.manage") && (
              <Button asChild variant="outline" size="sm">
                <Link href="/warehouse/suppliers">
                  <Truck className="h-4 w-4" />
                  Dobavljači
                </Link>
              </Button>
            )}
            <CsvExportButton
              loadRows={async () => {
                const products = await fetchProductsForExport(createClient());
                return products.map((product) => ({
                  ...product,
                  category: product.category?.name ?? "",
                  available_quantity: product.available_quantity ?? 0,
                }));
              }}
              fileName="proizvodi.csv"
              columns={[
                { key: "sku", label: "Šifra" },
                { key: "name", label: "Naziv" },
                { key: "oem_number", label: "OEM / kataloški broj" },
                { key: "barcode", label: "Barkod" },
                { key: "category", label: "Kategorija" },
                { key: "description", label: "Opis" },
                { key: "location", label: "Lokacija" },
                { key: "quantity", label: "Stanje" },
                { key: "reserved_quantity", label: "Rezervisano" },
                { key: "available_quantity", label: "Dostupno" },
                { key: "min_quantity", label: "Minimalna zaliha" },
                { key: "unit", label: "Jedinica" },
                { key: "sell_price", label: "Prodajna cijena bez PDV-a" },
                { key: "vat_rate", label: "PDV %" },
                { key: "status", label: "Status" },
              ]}
            />
            {can(user.role, "stock.receive") && (
              <Button asChild variant="outline" size="sm">
                <Link href="/warehouse/receipts/new">
                  <PackagePlus className="h-4 w-4" />
                  Prijem robe
                </Link>
              </Button>
            )}
            {can(user.role, "stock.adjust") && (
              <Button asChild variant="outline" size="sm">
                <Link href="/warehouse/adjustments/new">
                  <ClipboardList className="h-4 w-4" />
                  Korekcija / inventura
                </Link>
              </Button>
            )}
            {can(user.role, "products.create") && (
              <Button asChild size="sm">
                <Link href="/warehouse/new">
                  <Plus className="h-4 w-4" />
                  Novi proizvod
                </Link>
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 pt-3 md:flex-row md:flex-wrap">
          <SearchInput value={values.q} onSearch={(q) => update({ q })} label="Pretraga po nazivu, šifri, barkodu ili OEM broju" className="md:w-96" />
          <NativeSelect
            className="md:w-56"
            aria-label="Kategorija"
            value={values.category}
            onChange={(event) => update({ category: event.target.value })}
          >
            <option value="">Sve kategorije</option>
            {categories.data?.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </NativeSelect>
          <NativeSelect className="md:w-44" aria-label="Status" value={values.status} onChange={(event) => update({ status: event.target.value })}>
            <option value="">Svi statusi</option>
            <option value="active">Aktivni</option>
            <option value="inactive">Neaktivni</option>
            <option value="low">Niska zaliha</option>
          </NativeSelect>
          <NativeSelect className="md:w-44" aria-label="Lokacija" value={values.location} onChange={(event) => update({ location: event.target.value })}>
            <option value="">Sve lokacije</option>
            {locations.data?.map((location) => (
              <option key={location} value={location}>{location}</option>
            ))}
          </NativeSelect>
          <NativeSelect className="md:w-52" aria-label="Sortiranje proizvoda" value={values.sort} onChange={(event) => update({ sort: event.target.value })}>
            <option value="name">Naziv A–Ž</option>
            <option value="sku">Šifra A–Ž</option>
            <option value="quantity">Najveće stanje</option>
            <option value="available">Najviše dostupno</option>
            <option value="price">Najviša cijena</option>
          </NativeSelect>
        </div>
      </CardHeader>
      <CardContent>
        <QueryState
          isPending={products.isPending}
          error={products.error}
          isEmpty={products.data?.rows.length === 0}
          emptyText="Nema proizvoda za zadane filtere."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Šifra</TableHead>
                <TableHead>Naziv</TableHead>
                <TableHead>Kategorija</TableHead>
                <TableHead className="text-right">Stanje</TableHead>
                <TableHead className="text-right">Rezervisano</TableHead>
                <TableHead className="text-right">Dostupno</TableHead>
                <TableHead className="text-right">Cijena bez PDV-a</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.data?.rows.map((product) => (
                <TableRow key={product.id} className={product.is_low_stock ? "bg-amber-50/60" : undefined}>
                  <TableCell>
                    <p>{product.sku}</p>
                    {product.barcode && <p className="text-xs text-slate-500">{product.barcode}</p>}
                  </TableCell>
                  <TableCell>
                    <Link href={`/warehouse/${product.id}`} className="font-medium text-slate-900 hover:underline">
                      {product.name}
                    </Link>
                    <p className="text-xs text-slate-500">{product.location}</p>
                  </TableCell>
                  <TableCell>{product.category?.name}</TableCell>
                  <TableCell className="text-right">
                    {product.quantity} {product.unit}
                  </TableCell>
                  <TableCell className="text-right">{product.reserved_quantity}</TableCell>
                  <TableCell className="text-right font-medium text-slate-900">{product.available_quantity}</TableCell>
                  <TableCell className="text-right">{formatMoney(product.sell_price)}</TableCell>
                  <TableCell>
                    <StockBadge quantity={product.quantity} minQuantity={product.min_quantity} isActive={product.status === "active"} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            page={page}
            total={products.data?.total ?? 0}
            pageSize={products.data?.pageSize ?? 20}
            onPageChange={(next) => update({ page: next })}
          />
        </QueryState>
      </CardContent>
    </Card>
  );
}
