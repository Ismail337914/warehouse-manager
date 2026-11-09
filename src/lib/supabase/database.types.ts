
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"details": NonNullable<Json>,"entity": string,"entity_id": string | null,"id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"entity": string,"entity_id"?: string | null,"id"?: never
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"entity"?: string,"entity_id"?: string | null,"id"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "created_at": string,"id": number,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"name": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"customers": {
                  Row: {
                    "address": string | null,"city": string | null,"created_at": string,"customer_type": Database["public"]['Enums']["customer_type"],"email": string | null,"id": string,"jib": string | null,"name": string,"notes": string,"pdv_number": string | null,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"city"?: string | null,"created_at"?: string,"customer_type"?: Database["public"]['Enums']["customer_type"],"email"?: string | null,"id"?: string,"jib"?: string | null,"name": string,"notes"?: string,"pdv_number"?: string | null,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"city"?: string | null,"created_at"?: string,"customer_type"?: Database["public"]['Enums']["customer_type"],"email"?: string | null,"id"?: string,"jib"?: string | null,"name"?: string,"notes"?: string,"pdv_number"?: string | null,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"document_counters": {
                  Row: {
                    "doc_type": string,"last_number": number,"year": number
                  }
                  ComputedFields: never
                  Insert: {
                    "doc_type": string,"last_number": number,"year": number
                  }
                  Update: {
                    "doc_type"?: string,"last_number"?: number,"year"?: number
                  }
                  Relationships: [
                    
                  ]
                },"employees": {
                  Row: {
                    "created_at": string,"department": string,"email": string | null,"id": string,"name": string,"phone": string | null,"role": string,"status": Database["public"]['Enums']["employee_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"department": string,"email"?: string | null,"id"?: string,"name": string,"phone"?: string | null,"role": string,"status"?: Database["public"]['Enums']["employee_status"]
                  }
                  Update: {
                    "created_at"?: string,"department"?: string,"email"?: string | null,"id"?: string,"name"?: string,"phone"?: string | null,"role"?: string,"status"?: Database["public"]['Enums']["employee_status"]
                  }
                  Relationships: [
                    
                  ]
                },"goods_receipt_items": {
                  Row: {
                    "product_id": string,"quantity": number,"receipt_id": string,"unit_cost": number
                  }
                  ComputedFields: never
                  Insert: {
                    "product_id": string,"quantity": number,"receipt_id": string,"unit_cost": number
                  }
                  Update: {
                    "product_id"?: string,"quantity"?: number,"receipt_id"?: string,"unit_cost"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "goods_receipt_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "low_stock_products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "goods_receipt_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "goods_receipt_items_receipt_id_fkey"
      columns: ["receipt_id"]
isOneToOne: false
      referencedRelation: "goods_receipts"
      referencedColumns: ["id"]
    }
                  ]
                },"goods_receipts": {
                  Row: {
                    "created_at": string,"created_by": string | null,"document_number": string,"id": string,"note": string,"supplier_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"document_number"?: string,"id"?: string,"note"?: string,"supplier_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"document_number"?: string,"id"?: string,"note"?: string,"supplier_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "goods_receipts_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "goods_receipts_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"idempotency_keys": {
                  Row: {
                    "created_at": string,"created_by": string | null,"key": string,"operation": string,"result": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"key": string,"operation": string,"result"?: Json | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"key"?: string,"operation"?: string,"result"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "idempotency_keys_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_movements": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"on_hand_after": number | null,"on_hand_change": number,"product_id": string,"reason": string,"reserved_after": number | null,"reserved_change": number,"source_id": string | null,"source_type": Database["public"]['Enums']["stock_source_type"] | null,"type": Database["public"]['Enums']["stock_movement_type"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"on_hand_after"?: number | null,"on_hand_change": number,"product_id": string,"reason": string,"reserved_after"?: number | null,"reserved_change"?: number,"source_id"?: string | null,"source_type"?: Database["public"]['Enums']["stock_source_type"] | null,"type": Database["public"]['Enums']["stock_movement_type"]
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"on_hand_after"?: number | null,"on_hand_change"?: number,"product_id"?: string,"reason"?: string,"reserved_after"?: number | null,"reserved_change"?: number,"source_id"?: string | null,"source_type"?: Database["public"]['Enums']["stock_source_type"] | null,"type"?: Database["public"]['Enums']["stock_movement_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_movements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_movements_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "low_stock_products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_movements_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"invoice_items": {
                  Row: {
                    "discount_percent": number,"gross_amount": number,"invoice_id": string,"name": string,"net_amount": number,"product_id": string,"quantity": number,"sku": string,"unit": string,"unit_price": number,"vat_amount": number,"vat_rate": number
                  }
                  ComputedFields: never
                  Insert: {
                    "discount_percent": number,"gross_amount": number,"invoice_id": string,"name": string,"net_amount": number,"product_id": string,"quantity": number,"sku": string,"unit": string,"unit_price": number,"vat_amount": number,"vat_rate": number
                  }
                  Update: {
                    "discount_percent"?: number,"gross_amount"?: number,"invoice_id"?: string,"name"?: string,"net_amount"?: number,"product_id"?: string,"quantity"?: number,"sku"?: string,"unit"?: string,"unit_price"?: number,"vat_amount"?: number,"vat_rate"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoice_items_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoice_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoice_items_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoice_items_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "pos_sale_list"
      referencedColumns: ["invoice_id"]
    },{
      foreignKeyName: "invoice_items_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "unpaid_invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoice_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "low_stock_products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoice_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"invoices": {
                  Row: {
                    "company_address": string,"company_jib": string | null,"company_name": string,"company_pdv_number": string | null,"created_at": string,"created_by": string | null,"customer_address": string | null,"customer_city": string | null,"customer_id": string,"customer_jib": string | null,"customer_name": string,"customer_pdv_number": string | null,"customer_type": Database["public"]['Enums']["customer_type"],"due_date": string,"id": string,"issue_date": string,"note": string,"number": string,"order_id": string | null,"paid_amount": number,"payment_method": Database["public"]['Enums']["payment_method"] | null,"pos_sale_id": string | null,"status": Database["public"]['Enums']["invoice_status"],"storno_of": string | null,"subtotal": number,"total": number,"vat_total": number
                  }
                  ComputedFields: never
                  Insert: {
                    "company_address": string,"company_jib"?: string | null,"company_name": string,"company_pdv_number"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_address"?: string | null,"customer_city"?: string | null,"customer_id": string,"customer_jib"?: string | null,"customer_name": string,"customer_pdv_number"?: string | null,"customer_type": Database["public"]['Enums']["customer_type"],"due_date": string,"id"?: string,"issue_date": string,"note"?: string,"number": string,"order_id"?: string | null,"paid_amount"?: number,"payment_method"?: Database["public"]['Enums']["payment_method"] | null,"pos_sale_id"?: string | null,"status"?: Database["public"]['Enums']["invoice_status"],"storno_of"?: string | null,"subtotal": number,"total": number,"vat_total": number
                  }
                  Update: {
                    "company_address"?: string,"company_jib"?: string | null,"company_name"?: string,"company_pdv_number"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_address"?: string | null,"customer_city"?: string | null,"customer_id"?: string,"customer_jib"?: string | null,"customer_name"?: string,"customer_pdv_number"?: string | null,"customer_type"?: Database["public"]['Enums']["customer_type"],"due_date"?: string,"id"?: string,"issue_date"?: string,"note"?: string,"number"?: string,"order_id"?: string | null,"paid_amount"?: number,"payment_method"?: Database["public"]['Enums']["payment_method"] | null,"pos_sale_id"?: string | null,"status"?: Database["public"]['Enums']["invoice_status"],"storno_of"?: string | null,"subtotal"?: number,"total"?: number,"vat_total"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoices_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "order_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_pos_sale_id_fkey"
      columns: ["pos_sale_id"]
isOneToOne: false
      referencedRelation: "pos_sale_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_pos_sale_id_fkey"
      columns: ["pos_sale_id"]
isOneToOne: false
      referencedRelation: "pos_sales"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_storno_of_fkey"
      columns: ["storno_of"]
isOneToOne: true
      referencedRelation: "invoice_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_storno_of_fkey"
      columns: ["storno_of"]
isOneToOne: true
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_storno_of_fkey"
      columns: ["storno_of"]
isOneToOne: true
      referencedRelation: "pos_sale_list"
      referencedColumns: ["invoice_id"]
    },{
      foreignKeyName: "invoices_storno_of_fkey"
      columns: ["storno_of"]
isOneToOne: true
      referencedRelation: "unpaid_invoices"
      referencedColumns: ["id"]
    }
                  ]
                },"listings": {
                  Row: {
                    "channel": string,"created_at": string,"created_by": string,"external_id": string,"id": number,"price": number,"product_id": string,"status": Database["public"]['Enums']["listing_status"],"updated_at": string,"url": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel": string,"created_at"?: string,"created_by"?: string,"external_id"?: string,"id"?: never,"price": number,"product_id": string,"status"?: Database["public"]['Enums']["listing_status"],"updated_at"?: string,"url"?: string
                  }
                  Update: {
                    "channel"?: string,"created_at"?: string,"created_by"?: string,"external_id"?: string,"id"?: never,"price"?: number,"product_id"?: string,"status"?: Database["public"]['Enums']["listing_status"],"updated_at"?: string,"url"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "listings_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listings_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "low_stock_products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listings_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "discount_percent": number,"gross_amount": number,"net_amount": number,"order_id": string,"product_id": string,"quantity": number,"unit_price": number,"vat_amount": number,"vat_rate": number
                  }
                  ComputedFields: never
                  Insert: {
                    "discount_percent"?: number,"gross_amount"?: number,"net_amount"?: number,"order_id": string,"product_id": string,"quantity": number,"unit_price": number,"vat_amount"?: number,"vat_rate"?: number
                  }
                  Update: {
                    "discount_percent"?: number,"gross_amount"?: number,"net_amount"?: number,"order_id"?: string,"product_id"?: string,"quantity"?: number,"unit_price"?: number,"vat_amount"?: number,"vat_rate"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "order_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "low_stock_products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "assigned_to": string | null,"cancel_reason": string | null,"cancelled_at": string | null,"confirmed_at": string | null,"created_at": string,"created_by": string | null,"customer_id": string,"delivered_at": string | null,"id": string,"note": string,"number": string,"source": Database["public"]['Enums']["order_source"],"status": Database["public"]['Enums']["order_status"],"subtotal": number,"total": number,"updated_at": string,"vat_total": number
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_to"?: string | null,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"confirmed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_id": string,"delivered_at"?: string | null,"id"?: string,"note"?: string,"number"?: string,"source": Database["public"]['Enums']["order_source"],"status"?: Database["public"]['Enums']["order_status"],"subtotal"?: number,"total"?: number,"updated_at"?: string,"vat_total"?: number
                  }
                  Update: {
                    "assigned_to"?: string | null,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"confirmed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string,"delivered_at"?: string | null,"id"?: string,"note"?: string,"number"?: string,"source"?: Database["public"]['Enums']["order_source"],"status"?: Database["public"]['Enums']["order_status"],"subtotal"?: number,"total"?: number,"updated_at"?: string,"vat_total"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_assigned_to_fkey"
      columns: ["assigned_to"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"created_at": string,"created_by": string | null,"id": string,"invoice_id": string,"method": Database["public"]['Enums']["payment_method"],"note": string,"paid_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"created_by"?: string | null,"id"?: string,"invoice_id": string,"method": Database["public"]['Enums']["payment_method"],"note"?: string,"paid_on": string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"created_by"?: string | null,"id"?: string,"invoice_id"?: string,"method"?: Database["public"]['Enums']["payment_method"],"note"?: string,"paid_on"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoice_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "pos_sale_list"
      referencedColumns: ["invoice_id"]
    },{
      foreignKeyName: "payments_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "unpaid_invoices"
      referencedColumns: ["id"]
    }
                  ]
                },"pos_sale_items": {
                  Row: {
                    "discount_percent": number,"gross_amount": number,"net_amount": number,"pos_sale_id": string,"product_id": string,"quantity": number,"unit_price": number,"vat_amount": number,"vat_rate": number
                  }
                  ComputedFields: never
                  Insert: {
                    "discount_percent": number,"gross_amount": number,"net_amount": number,"pos_sale_id": string,"product_id": string,"quantity": number,"unit_price": number,"vat_amount": number,"vat_rate": number
                  }
                  Update: {
                    "discount_percent"?: number,"gross_amount"?: number,"net_amount"?: number,"pos_sale_id"?: string,"product_id"?: string,"quantity"?: number,"unit_price"?: number,"vat_amount"?: number,"vat_rate"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "pos_sale_items_pos_sale_id_fkey"
      columns: ["pos_sale_id"]
isOneToOne: false
      referencedRelation: "pos_sale_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pos_sale_items_pos_sale_id_fkey"
      columns: ["pos_sale_id"]
isOneToOne: false
      referencedRelation: "pos_sales"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pos_sale_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "low_stock_products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pos_sale_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"pos_sales": {
                  Row: {
                    "created_at": string,"created_by": string | null,"customer_id": string | null,"discount_percent": number,"id": string,"number": string,"payment_method": Database["public"]['Enums']["payment_method"],"subtotal": number,"total": number,"vat_total": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"customer_id"?: string | null,"discount_percent"?: number,"id"?: string,"number": string,"payment_method": Database["public"]['Enums']["payment_method"],"subtotal": number,"total": number,"vat_total": number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"customer_id"?: string | null,"discount_percent"?: number,"id"?: string,"number"?: string,"payment_method"?: Database["public"]['Enums']["payment_method"],"subtotal"?: number,"total"?: number,"vat_total"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "pos_sales_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pos_sales_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    }
                  ]
                },"procurement_docs": {
                  Row: {
                    "created_at": string,"document_number": string,"id": string,"status": Database["public"]['Enums']["procurement_status"],"supplier_id": string,"total": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"document_number"?: string,"id"?: string,"status"?: Database["public"]['Enums']["procurement_status"],"supplier_id": string,"total": number
                  }
                  Update: {
                    "created_at"?: string,"document_number"?: string,"id"?: string,"status"?: Database["public"]['Enums']["procurement_status"],"supplier_id"?: string,"total"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "procurement_docs_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "available_quantity": number | null,"barcode": string | null,"buy_price": number,"category_id": number,"created_at": string,"description": string,"id": string,"is_low_stock": boolean | null,"location": string,"min_quantity": number,"name": string,"oem_number": string | null,"quantity": number,"reserved_quantity": number,"sell_price": number,"sku": string,"status": Database["public"]['Enums']["product_status"],"unit": string,"updated_at": string,"vat_rate": number
                  }
                  ComputedFields: never
                  Insert: {
                    "available_quantity"?: never,"barcode"?: string | null,"buy_price": number,"category_id": number,"created_at"?: string,"description"?: string,"id"?: string,"is_low_stock"?: never,"location": string,"min_quantity"?: number,"name": string,"oem_number"?: string | null,"quantity"?: number,"reserved_quantity"?: number,"sell_price": number,"sku": string,"status"?: Database["public"]['Enums']["product_status"],"unit"?: string,"updated_at"?: string,"vat_rate"?: number
                  }
                  Update: {
                    "available_quantity"?: never,"barcode"?: string | null,"buy_price"?: number,"category_id"?: number,"created_at"?: string,"description"?: string,"id"?: string,"is_low_stock"?: never,"location"?: string,"min_quantity"?: number,"name"?: string,"oem_number"?: string | null,"quantity"?: number,"reserved_quantity"?: number,"sell_price"?: number,"sku"?: string,"status"?: Database["public"]['Enums']["product_status"],"unit"?: string,"updated_at"?: string,"vat_rate"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "products_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "category_list"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string,"full_name": string,"id": string,"is_active": boolean,"role": Database["public"]['Enums']["app_role"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"full_name"?: string,"id": string,"is_active"?: boolean,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"is_active"?: boolean,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reservations": {
                  Row: {
                    "created_at": string,"customer_id": string,"id": string,"note": string,"product_id": string,"quantity": number,"status": Database["public"]['Enums']["reservation_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"customer_id": string,"id"?: string,"note"?: string,"product_id": string,"quantity": number,"status"?: Database["public"]['Enums']["reservation_status"]
                  }
                  Update: {
                    "created_at"?: string,"customer_id"?: string,"id"?: string,"note"?: string,"product_id"?: string,"quantity"?: number,"status"?: Database["public"]['Enums']["reservation_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "reservations_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reservations_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "low_stock_products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reservations_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"settings": {
                  Row: {
                    "company_address": string,"company_bank_account": string,"company_city": string,"company_email": string,"company_jib": string | null,"company_name": string,"company_pdv_number": string | null,"company_phone": string,"default_vat_rate": number,"id": boolean,"invoice_due_days": number,"max_discount_menadzer": number,"max_discount_prodavac": number,"receipt_footer": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_address"?: string,"company_bank_account"?: string,"company_city"?: string,"company_email"?: string,"company_jib"?: string | null,"company_name"?: string,"company_pdv_number"?: string | null,"company_phone"?: string,"default_vat_rate"?: number,"id"?: boolean,"invoice_due_days"?: number,"max_discount_menadzer"?: number,"max_discount_prodavac"?: number,"receipt_footer"?: string,"updated_at"?: string
                  }
                  Update: {
                    "company_address"?: string,"company_bank_account"?: string,"company_city"?: string,"company_email"?: string,"company_jib"?: string | null,"company_name"?: string,"company_pdv_number"?: string | null,"company_phone"?: string,"default_vat_rate"?: number,"id"?: boolean,"invoice_due_days"?: number,"max_discount_menadzer"?: number,"max_discount_prodavac"?: number,"receipt_footer"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"stock_count_items": {
                  Row: {
                    "count_id": string,"counted_quantity": number,"expected_quantity": number,"product_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "count_id": string,"counted_quantity": number,"expected_quantity": number,"product_id": string
                  }
                  Update: {
                    "count_id"?: string,"counted_quantity"?: number,"expected_quantity"?: number,"product_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_count_items_count_id_fkey"
      columns: ["count_id"]
isOneToOne: false
      referencedRelation: "stock_counts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_count_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "low_stock_products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_count_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_counts": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"reason": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"reason": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"reason"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_counts_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"suppliers": {
                  Row: {
                    "address": string,"city": string,"created_at": string,"email": string | null,"id": string,"jib": string | null,"name": string,"note": string,"pdv_number": string | null,"phone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string,"city"?: string,"created_at"?: string,"email"?: string | null,"id"?: string,"jib"?: string | null,"name": string,"note"?: string,"pdv_number"?: string | null,"phone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string,"city"?: string,"created_at"?: string,"email"?: string | null,"id"?: string,"jib"?: string | null,"name"?: string,"note"?: string,"pdv_number"?: string | null,"phone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "active_reservations": {
                  Row: {
                    "confirmed_at": string | null,"customer_id": string | null,"customer_name": string | null,"order_id": string | null,"order_number": string | null,"product_id": string | null,"product_name": string | null,"quantity": number | null,"sku": string | null,"unit": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "order_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "low_stock_products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    }
                  ]
                },"category_list": {
                  Row: {
                    "id": number | null,"name": string | null,"product_count": number | null
                  }
                  ComputedFields: never
                  Insert: {
                           "id"?: number | null,"name"?: string | null,"product_count"?: never
                         }
                        Update: {
                           "id"?: number | null,"name"?: string | null,"product_count"?: never
                         }
                        Relationships: [
                    
                  ]
                },"invoice_list": {
                  Row: {
                    "balance": number | null,"created_at": string | null,"customer_id": string | null,"customer_name": string | null,"due_date": string | null,"id": string | null,"is_overdue": boolean | null,"issue_date": string | null,"number": string | null,"order_id": string | null,"order_number": string | null,"paid_amount": number | null,"pos_sale_id": string | null,"pos_sale_number": string | null,"status": Database["public"]['Enums']["invoice_status"] | null,"storno_of": string | null,"subtotal": number | null,"total": number | null,"vat_total": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "invoices_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "order_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_pos_sale_id_fkey"
      columns: ["pos_sale_id"]
isOneToOne: false
      referencedRelation: "pos_sale_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_pos_sale_id_fkey"
      columns: ["pos_sale_id"]
isOneToOne: false
      referencedRelation: "pos_sales"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_storno_of_fkey"
      columns: ["storno_of"]
isOneToOne: true
      referencedRelation: "invoice_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_storno_of_fkey"
      columns: ["storno_of"]
isOneToOne: true
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_storno_of_fkey"
      columns: ["storno_of"]
isOneToOne: true
      referencedRelation: "pos_sale_list"
      referencedColumns: ["invoice_id"]
    },{
      foreignKeyName: "invoices_storno_of_fkey"
      columns: ["storno_of"]
isOneToOne: true
      referencedRelation: "unpaid_invoices"
      referencedColumns: ["id"]
    }
                  ]
                },"low_stock_products": {
                  Row: {
                    "available_quantity": number | null,"category": string | null,"id": string | null,"location": string | null,"min_quantity": number | null,"name": string | null,"quantity": number | null,"reserved_quantity": number | null,"sku": string | null,"unit": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"order_list": {
                  Row: {
                    "assigned_to": string | null,"created_at": string | null,"customer_id": string | null,"customer_name": string | null,"id": string | null,"item_count": number | null,"number": string | null,"source": Database["public"]['Enums']["order_source"] | null,"status": Database["public"]['Enums']["order_status"] | null,"subtotal": number | null,"total": number | null,"vat_total": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "orders_assigned_to_fkey"
      columns: ["assigned_to"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    }
                  ]
                },"pos_sale_list": {
                  Row: {
                    "created_at": string | null,"customer_id": string | null,"customer_name": string | null,"discount_percent": number | null,"id": string | null,"invoice_id": string | null,"invoice_number": string | null,"number": string | null,"payment_method": Database["public"]['Enums']["payment_method"] | null,"subtotal": number | null,"total": number | null,"vat_total": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "pos_sales_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    }
                  ]
                },"unpaid_invoices": {
                  Row: {
                    "balance": number | null,"customer_id": string | null,"customer_name": string | null,"days_overdue": number | null,"due_date": string | null,"id": string | null,"is_overdue": boolean | null,"issue_date": string | null,"number": string | null,"paid_amount": number | null,"status": Database["public"]['Enums']["invoice_status"] | null,"total": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "invoices_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "adjust_stock":
{ Args: { "p_idempotency_key": string,"p_product_id": string,"p_quantity_change": number,"p_reason": string }; Returns: Json
                           },
"assign_order":
{ Args: { "p_order_id": string,"p_user_id": string }; Returns: Json
                           },
"assignable_users":
{ Args: Record<PropertyKey, never>; Returns: {
              "email": string,"full_name": string,"id": string,"role": Database["public"]['Enums']["app_role"]
            }[]
                           },
"auth_attempt_allowed":
{ Args: { "p_email_key": string,"p_ip_key": string,"p_kind": string }; Returns: boolean
                           },
"cancel_order":
{ Args: { "p_idempotency_key": string,"p_order_id": string,"p_reason": string }; Returns: Json
                           },
"clear_auth_attempts":
{ Args: { "p_email_key": string,"p_kind": string }; Returns: undefined
                           },
"complete_pos_sale":
{ Args: { "p_customer_id": string,"p_discount_percent": number,"p_idempotency_key": string,"p_items": Json,"p_payment_method": Database["public"]['Enums']["payment_method"] }; Returns: Json
                           },
"confirm_order":
{ Args: { "p_idempotency_key": string,"p_order_id": string }; Returns: Json
                           },
"create_order":
{ Args: { "p_customer_id": string,"p_idempotency_key": string,"p_items": Json,"p_note": string,"p_source": Database["public"]['Enums']["order_source"] }; Returns: Json
                           },
"dashboard_summary":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"deliver_order":
{ Args: { "p_idempotency_key": string,"p_order_id": string }; Returns: Json
                           },
"employee_directory":
{ Args: Record<PropertyKey, never>; Returns: {
              "email": string,"full_name": string,"id": string,"is_active": boolean,"role": Database["public"]['Enums']["app_role"]
            }[]
                           },
"invoice_order":
{ Args: { "p_idempotency_key": string,"p_order_id": string }; Returns: Json
                           },
"invoice_pos_sale":
{ Args: { "p_idempotency_key": string,"p_pos_sale_id": string }; Returns: Json
                           },
"product_costs":
{ Args: { "p_ids"?: (string)[] }; Returns: {
              "buy_price": number,"id": string
            }[]
                           },
"receive_stock":
{ Args: { "p_document_number": string,"p_idempotency_key": string,"p_items": Json,"p_note": string,"p_supplier_id": string }; Returns: Json
                           },
"record_auth_attempt":
{ Args: { "p_email_key": string,"p_ip_key": string,"p_kind": string }; Returns: undefined
                           },
"record_payment":
{ Args: { "p_amount": number,"p_idempotency_key": string,"p_invoice_id": string,"p_method": Database["public"]['Enums']["payment_method"],"p_note": string,"p_paid_on": string }; Returns: Json
                           },
"sales_by_month":
{ Args: { "p_months"?: number }; Returns: {
              "month": string,"revenue": number
            }[]
                           },
"sales_documents_by_month":
{ Args: { "p_month": string }; Returns: {
              "amount": number,"customer_name": string,"document_date": string,"document_id": string,"document_number": string,"document_type": string,"source_id": string,"source_number": string
            }[]
                           },
"stock_count":
{ Args: { "p_idempotency_key": string,"p_items": Json,"p_reason": string }; Returns: Json
                           },
"storno_invoice":
{ Args: { "p_idempotency_key": string,"p_invoice_id": string,"p_reason": string }; Returns: Json
                           },
"update_order_draft":
{ Args: { "p_customer_id": string,"p_items": Json,"p_note": string,"p_order_id": string,"p_source": Database["public"]['Enums']["order_source"] }; Returns: Json
                           }
          }
          Enums: {
            "app_role": "admin"|"menadzer"|"prodavac","customer_type": "fizicko"|"pravno","employee_status": "aktivan"|"odmor"|"neaktivan","invoice_status": "izdata"|"djelimicno_placena"|"placena"|"stornirana","listing_status": "nacrt"|"spreman"|"objavljen"|"pauziran"|"prodat"|"potrebna_izmjena","order_source": "web"|"olx"|"viber"|"telefon"|"pos","order_status": "nacrt"|"potvrđena"|"isporučena"|"fakturisana"|"otkazana","payment_method": "gotovina"|"kartica"|"virman","procurement_status": "u obradi"|"primljeno"|"otkazano","product_status": "active"|"inactive","reservation_status": "nova"|"potvrđena"|"završena"|"otkazana","stock_movement_type": "prijem"|"izlaz"|"rezervacija"|"oslobadjanje"|"korekcija"|"inventura","stock_source_type": "narudzba"|"pos_prodaja"|"prijem"|"korekcija"|"inventura"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "app_role": ["admin", "menadzer", "prodavac"],"customer_type": ["fizicko", "pravno"],"employee_status": ["aktivan", "odmor", "neaktivan"],"invoice_status": ["izdata", "djelimicno_placena", "placena", "stornirana"],"listing_status": ["nacrt", "spreman", "objavljen", "pauziran", "prodat", "potrebna_izmjena"],"order_source": ["web", "olx", "viber", "telefon", "pos"],"order_status": ["nacrt", "potvrđena", "isporučena", "fakturisana", "otkazana"],"payment_method": ["gotovina", "kartica", "virman"],"procurement_status": ["u obradi", "primljeno", "otkazano"],"product_status": ["active", "inactive"],"reservation_status": ["nova", "potvrđena", "završena", "otkazana"],"stock_movement_type": ["prijem", "izlaz", "rezervacija", "oslobadjanje", "korekcija", "inventura"],"stock_source_type": ["narudzba", "pos_prodaja", "prijem", "korekcija", "inventura"]
          }
        }
} as const
