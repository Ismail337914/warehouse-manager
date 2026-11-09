"use client";

import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";

import { QueryState } from "@/components/list";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, FormMessage, Input, NativeSelect } from "@/components/ui";
import type { ListingStatus } from "@/lib/schemas/listings";
import { fetchListings } from "@/lib/queries/listings";
import { fetchProductOptions } from "@/lib/queries/products";
import { queryKeys } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { useAction } from "@/lib/use-action";
import { formatDateTime, formatMoney } from "@/lib/utils";
import { createListing, updateListingStatus } from "@/server/actions/listings";

const statusLabels: Record<ListingStatus, string> = {
  nacrt: "Nacrt",
  spreman: "Spreman",
  objavljen: "Objavljen",
  pauziran: "Pauziran",
  prodat: "Prodat",
  potrebna_izmjena: "Potrebna izmjena",
};

const isWebUrl = (value: string | null): value is string => Boolean(value && /^https?:\/\//i.test(value));

const channelLabels = {
  olx: "OLX",
  web: "Web",
  viber: "Viber",
  other: "Drugo",
} as const;

export function ListingsModule() {
  const [productId, setProductId] = useState("");
  const [channel, setChannel] = useState<keyof typeof channelLabels>("olx");
  const [externalId, setExternalId] = useState("");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");

  const listings = useQuery({
    queryKey: queryKeys.listings.all,
    queryFn: () => fetchListings(createClient()),
  });
  const products = useQuery({
    queryKey: queryKeys.products.options,
    queryFn: () => fetchProductOptions(createClient()),
  });
  const create = useAction(createListing, [queryKeys.listings.all]);
  const updateStatus = useAction(
    ({ id, status }: { id: number; status: ListingStatus }) => updateListingStatus(id, status),
    [queryKeys.listings.all],
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const result = await create.mutateAsync({
      productId,
      channel,
      externalId,
      url,
      price: Number(price),
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setProductId("");
    setExternalId("");
    setUrl("");
    setPrice("");
  };

  const changeStatus = async (id: number, status: ListingStatus) => {
    setError("");
    const result = await updateStatus.mutateAsync({ id, status });
    if (!result.ok) setError(result.error);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Evidencija oglasa</CardTitle>
          <CardDescription>
            Ručno praćenje oglasa povezanih s artiklima. Status oglasa se ne sinhronizuje s vanjskim kanalima.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QueryState isPending={listings.isPending || products.isPending} error={listings.error ?? products.error}>
            <div className="space-y-4">
              <FormMessage>{error}</FormMessage>
              <form className="grid gap-3 rounded-lg border border-slate-200 p-4 md:grid-cols-2 xl:grid-cols-6" onSubmit={(event) => void submit(event)}>
                <NativeSelect aria-label="Artikal" value={productId} onChange={(event) => setProductId(event.target.value)} required>
                  <option value="">Odaberite artikal</option>
                  {products.data?.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.sku} — {product.name}
                    </option>
                  ))}
                </NativeSelect>
                <NativeSelect aria-label="Kanal" value={channel} onChange={(event) => setChannel(event.target.value as keyof typeof channelLabels)}>
                  {Object.entries(channelLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </NativeSelect>
                <Input aria-label="Vanjski ID oglasa" placeholder="ID oglasa (opcionalno)" value={externalId} onChange={(event) => setExternalId(event.target.value)} />
                <Input aria-label="URL oglasa" placeholder="URL oglasa (opcionalno)" value={url} onChange={(event) => setUrl(event.target.value)} />
                <Input
                  aria-label="Cijena oglasa"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Cijena (KM)"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  required
                />
                <Button type="submit" disabled={create.isPending || products.data?.length === 0}>
                  {create.isPending ? "Spremanje..." : "Dodaj oglas"}
                </Button>
              </form>
              <div className="overflow-x-auto">
                <table className="w-full caption-bottom text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left">
                      <th className="h-10 px-3 font-medium">Artikal</th>
                      <th className="h-10 px-3 font-medium">Kanal</th>
                      <th className="h-10 px-3 font-medium">ID / URL</th>
                      <th className="h-10 px-3 text-right font-medium">Cijena</th>
                      <th className="h-10 px-3 font-medium">Status</th>
                      <th className="h-10 px-3 font-medium">Zadnja izmjena</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listings.data?.map((listing) => (
                      <tr className="border-b border-slate-100" key={listing.id}>
                        <td className="px-3 py-3">
                          <p className="font-medium">{listing.product?.name ?? listing.product_id}</p>
                          <p className="text-xs text-slate-500">{listing.product?.sku}</p>
                        </td>
                        <td className="px-3 py-3">{channelLabels[listing.channel as keyof typeof channelLabels] ?? listing.channel}</td>
                        <td className="max-w-64 px-3 py-3">
                          {/* Only http(s) links are clickable: a "javascript:" URL stored by any route would run on click. */}
                          {isWebUrl(listing.url) ? (
                            <a className="break-all text-blue-700 underline" href={listing.url} target="_blank" rel="noopener noreferrer">
                              {listing.external_id || listing.url}
                            </a>
                          ) : listing.external_id || "—"}
                          <p className="text-xs text-slate-500">Sinhronizacija: ručna</p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right">{formatMoney(listing.price)}</td>
                        <td className="min-w-48 px-3 py-3">
                          <NativeSelect
                            aria-label={`Status oglasa ${listing.product?.name ?? listing.product_id}`}
                            value={listing.status}
                            disabled={updateStatus.isPending}
                            onChange={(event) => void changeStatus(listing.id, event.target.value as ListingStatus)}
                          >
                            {Object.entries(statusLabels).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </NativeSelect>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                          <Badge variant="secondary">Ručno</Badge>
                          <p className="mt-1 text-xs">{formatDateTime(listing.updated_at)}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {listings.data?.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Nema evidentiranih oglasa.</p>}
              </div>
            </div>
          </QueryState>
        </CardContent>
      </Card>
    </div>
  );
}
