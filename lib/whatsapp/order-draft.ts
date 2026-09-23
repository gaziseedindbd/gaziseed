import { z } from 'zod';

export const WhatsAppOrderItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive().max(1000),
});

export const WhatsAppOrderDraftSchema = z.object({
  customer_name: z.string().trim().min(2).max(120).optional(),
  customer_phone: z.string().trim().min(6).max(30).optional(),
  delivery_address: z.string().trim().min(5).max(500).optional(),
  district: z.string().trim().max(120).optional(),
  thana: z.string().trim().max(120).optional(),
  items: z.array(WhatsAppOrderItemSchema).min(1).max(30),
  special_instructions: z.string().trim().max(500).optional(),
  confirmed: z.boolean().default(false),
});

export type WhatsAppOrderDraft = z.infer<typeof WhatsAppOrderDraftSchema>;

export function validateOrderDraft(input: unknown): WhatsAppOrderDraft {
  return WhatsAppOrderDraftSchema.parse(input);
}
