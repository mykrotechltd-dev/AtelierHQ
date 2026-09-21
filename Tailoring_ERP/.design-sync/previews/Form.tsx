import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button, Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, Input } from "atelierhq-ui";

function CustomerFields({ form }: { form: any }) {
  return (
    <>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Full name</FormLabel>
            <FormControl>
              <Input placeholder="Adaeze Nwosu" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="phone"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Phone</FormLabel>
            <FormControl>
              <Input placeholder="+234 801 234 5678" {...field} />
            </FormControl>
            <FormDescription>Used for pickup reminders.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}

export function CustomerForm() {
  const form = useForm({ defaultValues: { name: "Adaeze Nwosu", phone: "+234 803 555 0142" } });
  return (
    <div className="p-6" style={{ maxWidth: 420 }}>
      <Form {...form}>
        <form className="flex flex-col gap-4">
          <CustomerFields form={form} />
          <Button type="button">Save customer</Button>
        </form>
      </Form>
    </div>
  );
}

export function WithValidationError() {
  const form = useForm({ defaultValues: { name: "Chinedu Okafor", phone: "0801" } });
  useEffect(() => {
    form.setError("phone", { type: "manual", message: "Enter a valid Nigerian phone number." });
  }, [form]);
  return (
    <div className="p-6" style={{ maxWidth: 420 }}>
      <Form {...form}>
        <form className="flex flex-col gap-4">
          <CustomerFields form={form} />
          <Button type="button">Save customer</Button>
        </form>
      </Form>
    </div>
  );
}
