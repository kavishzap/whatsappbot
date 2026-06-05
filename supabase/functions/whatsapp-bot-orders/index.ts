import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function formatOrderDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

async function generateOrderRef(supabase: SupabaseClient): Promise<string> {
  const datePart = formatOrderDate(new Date());
  const prefix = `ORD-${datePart}-`;

  const { count, error } = await supabase
    .from("whatsapp_bot_orders")
    .select("order_ref", { count: "exact", head: true })
    .like("order_ref", `${prefix}%`);

  if (error) throw error;

  const sequence = (count ?? 0) + 1;
  return `${prefix}${String(sequence).padStart(3, "0")}`;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return jsonResponse(
        { success: false, error: "Server misconfiguration: missing Supabase credentials" },
        500
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    if (req.method !== "POST") {
      return jsonResponse({ success: false, error: "Method not allowed" }, 405);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ success: false, error: "Invalid JSON body" }, 400);
    }

    const required = [
      "customer_name",
      "customer_phone_number",
      "product_name",
      "quantity",
      "city",
      "address",
      "total",
    ] as const;

    for (const field of required) {
      if (body[field] === undefined || body[field] === null || body[field] === "") {
        return jsonResponse({ success: false, error: `Missing required field: ${field}` }, 400);
      }
    }

    for (let attempt = 0; attempt < 10; attempt++) {
      const order_ref = await generateOrderRef(supabase);

      const { data, error } = await supabase
        .from("whatsapp_bot_orders")
        .insert({
          order_ref,
          customer_name: body.customer_name,
          customer_phone_number: body.customer_phone_number,
          product_name: body.product_name,
          quantity: body.quantity,
          city: body.city,
          address: body.address,
          total: body.total,
        })
        .select()
        .single();

      if (error?.code === "23505") continue;
      if (error) throw error;

      return jsonResponse({
        success: true,
        message: "Order created successfully",
        data,
      });
    }

    return jsonResponse(
      { success: false, error: "Could not generate a unique order reference" },
      500
    );
  } catch (error) {
    console.error("whatsapp-bot-orders error:", error);
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});
