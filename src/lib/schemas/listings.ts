import { z } from "zod";

export const listingStatusSchema = z.enum(["nacrt", "spreman", "objavljen", "pauziran", "prodat", "potrebna_izmjena"]);

export const listingInputSchema = z.object({
  productId: z.string().trim().min(1, "Odaberite proizvod."),
  channel: z.enum(["olx", "web", "viber", "other"]),
  externalId: z.string().trim().max(128, "ID oglasa može imati najviše 128 znakova."),
  url: z.union([
    z.literal(""),
    z
      .url("Unesite ispravnu URL adresu.")
      .refine((value) => value.startsWith("http://") || value.startsWith("https://"), "URL mora počinjati sa http:// ili https://."),
  ]),
  price: z.number({ error: "Unesite cijenu." }).min(0, "Cijena ne može biti negativna."),
});

export type ListingStatus = z.infer<typeof listingStatusSchema>;
export type ListingInput = z.infer<typeof listingInputSchema>;
