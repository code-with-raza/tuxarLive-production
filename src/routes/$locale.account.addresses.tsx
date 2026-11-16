import { createFileRoute } from "@tanstack/react-router";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useEffect, useState } from "react";
import { Loader2, Plus, Edit2, Trash2, X, MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/hooks/useUser";

export const Route = createFileRoute("/$locale/account/addresses")({
  component: AccountAddresses,
});

const addressSchema = z.object({
  firstName: z.string().trim().min(2, "First name must be at least 2 characters").max(100),
  lastName: z.string().trim().min(2, "Last name must be at least 2 characters").max(100),
  phone: z.string().trim().min(6, "Phone must be at least 6 characters").max(40),
  streetAddress: z.string().trim().min(5, "Street address must be at least 5 characters").max(200),
  city: z.string().trim().min(2, "City must be at least 2 characters").max(100),
  postalCode: z.string().trim().min(3, "Postal code must be at least 3 characters").max(20),
  country: z.string().trim().min(2, "Country is required").max(100),
  type: z.enum(["SHIPPING", "BILLING"]),
});

type AddressFields = z.infer<typeof addressSchema>;
type SavedAddress = AddressFields & { id: string };

function fromRecord(row: Record<string, string>): SavedAddress {
  return { id: row.id, firstName: row.first_name, lastName: row.last_name, phone: row.phone, streetAddress: row.street_address, city: row.city, postalCode: row.postal_code, country: row.country, type: row.address_type as AddressFields["type"] };
}

function AccountAddresses() {
  const { user } = useUser();
  const userId = user?.id;
  const [isEditing, setIsEditing] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setAddresses([]);
    if (!userId) { setIsLoading(false); return; }
    setIsLoading(true);
    void supabase.from("customer_addresses").select("*").eq("user_id", userId).order("created_at").then(({ data, error }) => {
      if (!active) return;
      if (error) toast.error("Saved addresses could not be loaded. Please try again.");
      else setAddresses((data ?? []).map(fromRecord));
      setIsLoading(false);
    });
    return () => { active = false; };
  }, [userId]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddressFields>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      streetAddress: "",
      city: "",
      postalCode: "",
      country: "",
      type: "SHIPPING",
    },
  });

  const openAddForm = () => {
    reset({
      firstName: "",
      lastName: "",
      phone: "",
      streetAddress: "",
      city: "",
      postalCode: "",
      country: "",
      type: "SHIPPING",
    });
    setEditingAddressId(null);
    setIsEditing(true);
  };

  const openEditForm = (addr: SavedAddress) => {
    reset({
      firstName: addr.firstName,
      lastName: addr.lastName,
      phone: addr.phone,
      streetAddress: addr.streetAddress,
      city: addr.city,
      postalCode: addr.postalCode,
      country: addr.country,
      type: addr.type,
    });
    setEditingAddressId(addr.id);
    setIsEditing(true);
  };

  const closeForm = () => {
    setIsEditing(false);
    setEditingAddressId(null);
  };

  const onSubmit: SubmitHandler<AddressFields> = async (data) => {
    if (!user) return;
    const record = { user_id: user.id, first_name: data.firstName, last_name: data.lastName, phone: data.phone, street_address: data.streetAddress, city: data.city, postal_code: data.postalCode, country: data.country, address_type: data.type };
    const result = editingAddressId
      ? await supabase.from("customer_addresses").update(record).eq("id", editingAddressId).eq("user_id", user.id).select().single()
      : await supabase.from("customer_addresses").insert(record).select().single();
    if (result.error || !result.data) { toast.error("The address could not be saved"); return; }
    const saved = fromRecord(result.data);
    setAddresses((current) => editingAddressId ? current.map((address) => address.id === editingAddressId ? saved : address) : [...current, saved]);
    toast.success(editingAddressId ? "Address updated successfully" : "Address created successfully");
    closeForm();
  };

  const handleDelete = async (id: string) => {
    if (user && confirm("Are you sure you want to delete this address?")) {
      const result = await supabase.from("customer_addresses").delete().eq("id", id).eq("user_id", user.id).select("id");
      if (result.error || !result.data?.length) { toast.error("The address could not be deleted"); return; }
      setAddresses((current) => current.filter((address) => address.id !== id));
      toast.success("Address deleted successfully");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-luxe-fade-in">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="font-display text-3xl mb-1">Addresses</h1>
          <p className="text-sm text-muted-foreground font-sans">
            Manage shipping and billing details saved to your account.
          </p>
        </div>
        {!isEditing && (
          <button
            onClick={openAddForm}
            className="inline-flex items-center gap-2 text-xs uppercase tracking-widest bg-foreground text-background px-4 py-2.5 font-sans font-semibold hover:bg-foreground/90 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Add Address
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="border border-border p-6 bg-surface space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-border">
            <h3 className="font-display text-lg">
              {editingAddressId ? "Edit Address" : "Add New Address"}
            </h3>
            <button
              onClick={closeForm}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-5 w-5" strokeWidth={1.4} />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 font-sans">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  First Name
                </label>
                <input
                  type="text"
                  {...register("firstName")}
                  className={`w-full h-10 border-b bg-transparent px-1 focus:outline-none transition-colors text-sm ${
                    errors.firstName
                      ? "border-destructive focus:border-destructive"
                      : "border-foreground/20 focus:border-foreground"
                  }`}
                />
                {errors.firstName && (
                  <span className="text-destructive text-xs mt-1">{errors.firstName.message}</span>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Last Name
                </label>
                <input
                  type="text"
                  {...register("lastName")}
                  className={`w-full h-10 border-b bg-transparent px-1 focus:outline-none transition-colors text-sm ${
                    errors.lastName
                      ? "border-destructive focus:border-destructive"
                      : "border-foreground/20 focus:border-foreground"
                  }`}
                />
                {errors.lastName && (
                  <span className="text-destructive text-xs mt-1">{errors.lastName.message}</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Phone Number
                </label>
                <input
                  type="text"
                  {...register("phone")}
                  className={`w-full h-10 border-b bg-transparent px-1 focus:outline-none transition-colors text-sm ${
                    errors.phone
                      ? "border-destructive focus:border-destructive"
                      : "border-foreground/20 focus:border-foreground"
                  }`}
                />
                {errors.phone && (
                  <span className="text-destructive text-xs mt-1">{errors.phone.message}</span>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Address Type
                </label>
                <select
                  {...register("type")}
                  className="w-full h-10 border-b border-foreground/20 bg-transparent px-1 focus:outline-none focus:border-foreground text-sm uppercase cursor-pointer"
                >
                  <option value="SHIPPING">Shipping Address</option>
                  <option value="BILLING">Billing Address</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Street Address
              </label>
              <input
                type="text"
                {...register("streetAddress")}
                className={`w-full h-10 border-b bg-transparent px-1 focus:outline-none transition-colors text-sm ${
                  errors.streetAddress
                    ? "border-destructive focus:border-destructive"
                    : "border-foreground/20 focus:border-foreground"
                }`}
              />
              {errors.streetAddress && (
                <span className="text-destructive text-xs mt-1">
                  {errors.streetAddress.message}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  City
                </label>
                <input
                  type="text"
                  {...register("city")}
                  className={`w-full h-10 border-b bg-transparent px-1 focus:outline-none transition-colors text-sm ${
                    errors.city
                      ? "border-destructive focus:border-destructive"
                      : "border-foreground/20 focus:border-foreground"
                  }`}
                />
                {errors.city && (
                  <span className="text-destructive text-xs mt-1">{errors.city.message}</span>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Postal Code
                </label>
                <input
                  type="text"
                  {...register("postalCode")}
                  className={`w-full h-10 border-b bg-transparent px-1 focus:outline-none transition-colors text-sm ${
                    errors.postalCode
                      ? "border-destructive focus:border-destructive"
                      : "border-foreground/20 focus:border-foreground"
                  }`}
                />
                {errors.postalCode && (
                  <span className="text-destructive text-xs mt-1">{errors.postalCode.message}</span>
                )}
              </div>

              <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Country
                </label>
                <input
                  type="text"
                  {...register("country")}
                  className={`w-full h-10 border-b bg-transparent px-1 focus:outline-none transition-colors text-sm ${
                    errors.country
                      ? "border-destructive focus:border-destructive"
                      : "border-foreground/20 focus:border-foreground"
                  }`}
                />
                {errors.country && (
                  <span className="text-destructive text-xs mt-1">{errors.country.message}</span>
                )}
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="h-11 px-6 bg-foreground text-background uppercase tracking-widest text-xs hover:bg-foreground/90 transition-all flex items-center justify-center gap-2 cursor-pointer font-medium disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingAddressId ? "Update Address" : "Save Address"}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="h-11 px-6 border border-border hover:bg-section uppercase tracking-widest text-xs transition-colors cursor-pointer font-medium text-foreground"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : addresses.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border/60 bg-surface">
          <MapPin className="h-10 w-10 text-muted-foreground/60 mx-auto mb-4" strokeWidth={1} />
          <p className="text-sm text-muted-foreground font-sans mb-6">No saved addresses found.</p>
          <button
            onClick={openAddForm}
            className="inline-flex items-center gap-2 text-xs uppercase tracking-widest bg-foreground text-background px-6 py-3 font-sans font-semibold hover:bg-foreground/90 transition-colors cursor-pointer"
          >
            Add Address
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className="border border-border p-6 bg-surface flex flex-col justify-between h-56 font-sans"
            >
              <div className="space-y-1">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 bg-section border text-muted-foreground">
                    {addr.type}
                  </span>
                  <div className="flex gap-3 text-muted-foreground">
                    <button
                      onClick={() => openEditForm(addr)}
                      className="hover:text-foreground transition-colors cursor-pointer"
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4" strokeWidth={1.4} />
                    </button>
                    <button
                      onClick={() => handleDelete(addr.id)}
                      className="hover:text-destructive transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.4} />
                    </button>
                  </div>
                </div>
                <p className="font-semibold text-foreground">
                  {addr.firstName} {addr.lastName}
                </p>
                <p className="text-sm text-foreground/80">{addr.streetAddress}</p>
                <p className="text-sm text-foreground/80">
                  {addr.postalCode} {addr.city}
                </p>
                <p className="text-sm text-foreground/80">{addr.country}</p>
              </div>
              <div className="text-xs text-muted-foreground border-t pt-3 border-border/40 mt-4">
                Phone: {addr.phone}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
