import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireCurrentUser } from "@/lib/utils/tenant";
import { NewCustomerDialog } from "@/components/customers/NewCustomerDialog";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  await requireCurrentUser(); // enforces auth; RLS enforces tenant scoping on the query below
  const supabase = createServerSupabase();

  let query = supabase
    .from("customers")
    .select("id, full_name, phone, whatsapp_number, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (searchParams.q) {
    query = query.or(`full_name.ilike.%${searchParams.q}%,phone.ilike.%${searchParams.q}%`);
  }

  const { data: customers, error } = await query;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold font-serif text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500">Records and measurements in one place.</p>
        </div>
        <NewCustomerDialog />
      </div>

      <form className="max-w-sm">
        <input
          name="q"
          defaultValue={searchParams.q}
          placeholder="Search by name or phone…"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </form>

      {error && <p className="text-sm text-red-600">{error.message}</p>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">WhatsApp</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {customers?.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{c.full_name}</td>
                <td className="px-4 py-3 text-slate-600">{c.phone}</td>
                <td className="px-4 py-3 text-slate-600">{c.whatsapp_number || "—"}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/customers/${c.id}`} className="text-brand-600 hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {customers?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  No customers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
