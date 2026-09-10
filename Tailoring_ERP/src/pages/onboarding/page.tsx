import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateTenant } from "@/lib/queries/tenants.ts";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { motion } from "motion/react";
import { ScissorsLineDashed } from "lucide-react";

const schema = z.object({
  name: z.string().min(2, "Shop name must be at least 2 characters"),
  phone: z.string().optional(),
  address: z.string().optional(),
  currency: z.string().min(1, "Please select a currency"),
});

type FormValues = z.infer<typeof schema>;

const CURRENCIES = [
  { code: "USD", label: "USD — US Dollar" },
  { code: "NGN", label: "NGN — Nigerian Naira" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GHS", label: "GHS — Ghanaian Cedi" },
  { code: "KES", label: "KES — Kenyan Shilling" },
  { code: "ZAR", label: "ZAR — South African Rand" },
  { code: "INR", label: "INR — Indian Rupee" },
  { code: "CAD", label: "CAD — Canadian Dollar" },
  { code: "AUD", label: "AUD — Australian Dollar" },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const createTenant = useCreateTenant();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", phone: "", address: "", currency: "USD" },
  });

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    try {
      await createTenant(values);
      toast.success("Your shop is ready!");
      navigate("/dashboard", { replace: true });
    } catch {
      toast.error("Failed to create shop. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" as const }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
            <ScissorsLineDashed className="size-7 text-primary" />
          </div>
          <h1 className="font-sans text-3xl font-semibold text-foreground mb-2">
            Set up your shop
          </h1>
          <p className="font-body text-muted-foreground text-sm">
            Tell us about your tailoring business to get started
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-body">Shop name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Bello & Sons Tailors" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-body">Currency *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-body">Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="+1 555 000 1234" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-body">Address</FormLabel>
                  <FormControl>
                    <Input placeholder="123 High Street, Lagos" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full mt-2" disabled={isLoading}>
              {isLoading ? "Creating shop..." : "Create my shop"}
            </Button>
          </form>
        </Form>
      </motion.div>
    </div>
  );
}
