"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeft, PackagePlus } from "lucide-react";

import { Pagination, QueryState } from "@/components/list";
import { useCurrentUser } from "@/components/providers";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { movementTypeLabels, sourceTypeLabels } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { fetchProduct, fetchProductCosts, fetchProductMovements } from "@/lib/queries/products";
import { queryKeys } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils";

import { ProductForm } from "../product-form";

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const user = useCurrentUser();
  const [movementsPage, setMovementsPage] = useState(1);

  const canManage = can(user.role, "products.update");
  const canSeeCost = can(user.role, "product_costs.read");
  const canReceive = can(user.role, "stock.receive");
  // The full stock history (every order and sale) is for staff; a seller sees availability above.
  const canSeeMovements = can(user.role, "stock.movements.read");
  const product = useQuery({ queryKey: queryKeys.products.detail(id), queryFn: () => fetchProduct(createClient(), id) });
  // Purchase price only for staff; the form waits for it so saving never overwrites it with an empty value.
  const cost = useQuery({
    queryKey: queryKeys.products.cost(id),
    queryFn: () => fetchProductCosts(createClient(), [id]).then((costs) => costs.get(id) ?? 0),
    enabled: canSeeCost,
  });
  const movements = useQuery({
    queryKey: queryKeys.products.movements(id, movementsPage),
    queryFn: () => fetchProductMovements(createClient(), id, movementsPage),
    placeholderData: keepPreviousData,
    enabled: canSeeMovements,
  });

  return (
    <div className="space-y-6">
      <Link href="/warehouse" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        Nazad na lager
      </Link>

      <QueryState
        isPending={product.isPending || (canSeeCost && cost.isPending)}
        error={product.error ?? cost.error}
        isEmpty={!product.data}
        emptyText="Proizvod ne postoji."
      >
        {product.data && (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Stat label="Na stanju" value={`${product.data.quantity} ${product.data.unit}`} />
              <Stat label="Rezervisano (potvrđene narudžbe)" value={String(product.data.reserved_quantity)} />
              <Stat label="Dostupno za prodaju" value={String(product.data.available_quantity)} highlight />
            </div>

            {/* Stock is never typed into the product form: it is added with a goods receipt (history entry). */}
            {canReceive && (
              <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-600">
                  {product.data.quantity === 0
                    ? "Proizvod još nema stanja. Dodajte robu kroz prijem robe."
                    : "Nova roba se dodaje kroz prijem robe."}
                </p>
                <Button asChild variant={product.data.quantity === 0 ? "default" : "secondary"}>
                  <Link href={`/warehouse/receipts/new?product=${encodeURIComponent(id)}`}>
                    <PackagePlus className="h-4 w-4" />
                    Dodaj stanje (prijem robe)
                  </Link>
                </Button>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>{product.data.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <ProductForm
                  productId={id}
                  readOnly={!canManage}
                  showCost={canSeeCost}
                  defaultValues={{
                    sku: product.data.sku,
                    barcode: product.data.barcode ?? "",
                    oemNumber: product.data.oem_number ?? "",
                    name: product.data.name,
                    categoryId: product.data.category_id,
                    description: product.data.description,
                    buyPrice: cost.data ?? 0,
                    sellPrice: product.data.sell_price,
                    vatRate: product.data.vat_rate,
                    minQuantity: product.data.min_quantity,
                    unit: product.data.unit,
                    location: product.data.location,
                    status: product.data.status,
                  }}
                />
              </CardContent>
            </Card>
          </>
        )}
      </QueryState>

      {canSeeMovements && (
        <Card>
          <CardHeader>
            <CardTitle>Historija kretanja</CardTitle>
          </CardHeader>
          <CardContent>
            <QueryState
              isPending={movements.isPending}
              error={movements.error}
              isEmpty={movements.data?.rows.length === 0}
              emptyText="Još nema kretanja."
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Vrsta</TableHead>
                    <TableHead className="text-right">Stanje</TableHead>
                    <TableHead className="text-right">Rezervisano</TableHead>
                    <TableHead>Dokument</TableHead>
                    <TableHead>Razlog</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.data?.rows.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell className="whitespace-nowrap">{formatDateTime(movement.created_at)}</TableCell>
                      <TableCell>
                        <Badge variant={movement.on_hand_change > 0 ? "success" : movement.on_hand_change < 0 ? "warning" : "secondary"}>
                          {movementTypeLabels[movement.type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {movement.on_hand_change !== 0 && signed(movement.on_hand_change)}
                        {movement.on_hand_after !== null && <span className="text-slate-400"> → {movement.on_hand_after}</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {movement.reserved_change !== 0 && signed(movement.reserved_change)}
                        {movement.reserved_after !== null && <span className="text-slate-400"> → {movement.reserved_after}</span>}
                      </TableCell>
                      <TableCell>
                        {movement.source_type === "narudzba" && movement.source_id ? (
                          <Link href={`/orders/${movement.source_id}`} className="hover:underline">
                            {sourceTypeLabels.narudzba}
                          </Link>
                        ) : (
                          movement.source_type && sourceTypeLabels[movement.source_type]
                        )}
                      </TableCell>
                      <TableCell className="text-slate-600">{movement.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                page={movementsPage}
                total={movements.data?.total ?? 0}
                pageSize={movements.data?.pageSize ?? 20}
                onPageChange={setMovementsPage}
              />
            </QueryState>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-emerald-200 bg-emerald-50" : undefined}>
      <CardContent className="p-4">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      </CardContent>
    </Card>
  );
}
