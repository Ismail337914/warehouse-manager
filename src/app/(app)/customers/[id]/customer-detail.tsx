"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { QueryState } from "@/components/list";
import { useCurrentUser } from "@/components/providers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { can } from "@/lib/permissions";
import { fetchCustomer } from "@/lib/queries/customers";
import { queryKeys } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";

import { CustomerForm } from "../customer-form";

export function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const user = useCurrentUser();
  const customer = useQuery({ queryKey: queryKeys.customers.detail(id), queryFn: () => fetchCustomer(createClient(), id) });

  return (
    <div className="space-y-6">
      <Link href="/customers" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        Nazad na kupce
      </Link>
      <QueryState isPending={customer.isPending} error={customer.error} isEmpty={!customer.data} emptyText="Kupac ne postoji.">
        {customer.data && (
          <Card className="max-w-3xl">
            <CardHeader>
              <CardTitle>{customer.data.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <CustomerForm
                customerId={id}
                readOnly={!can(user.role, "customers.update")}
                defaultValues={{
                  customerType: customer.data.customer_type,
                  name: customer.data.name,
                  jib: customer.data.jib ?? "",
                  pdvNumber: customer.data.pdv_number ?? "",
                  phone: customer.data.phone ?? "",
                  email: customer.data.email ?? "",
                  address: customer.data.address ?? "",
                  city: customer.data.city ?? "",
                  notes: customer.data.notes,
                }}
              />
            </CardContent>
          </Card>
        )}
      </QueryState>
    </div>
  );
}
