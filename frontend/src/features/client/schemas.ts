import { z } from "zod";

const phoneRegex = /^\+380\d{9}$/;

export const addressSchema = z.object({
  city: z.string().min(1, "Вкажіть місто"),
  street: z.string().min(1, "Вкажіть вулицю"),
  building: z.string().min(1, "Вкажіть будинок"),
  apartment: z.string().optional().or(z.literal("")),
  lat: z.number(),
  lon: z.number(),
});

export const paymentMethodSchema = z.enum(["cash", "card", "online"]);

export const orderCreateSchema = z.object({
  my_role: z.enum(["sender", "recipient"]),
  counterparty_phone: z
    .string()
    .min(1, "Вкажіть телефон")
    .regex(phoneRegex, "Формат: +380XXXXXXXXX"),
  weight: z.coerce.number().positive("Вага має бути > 0"),
  volume: z.coerce.number().positive("Об'єм має бути > 0"),
  special_instructions: z.string().optional().or(z.literal("")),
  pickup_date: z.string().min(1, "Вкажіть дату"),
  pickup_slot_hour: z.coerce.number().int().min(0).max(22),
  pickup_address: addressSchema,
  delivery_address: addressSchema,
  payment_method: paymentMethodSchema,
});

export type OrderCreateFormValues = z.infer<typeof orderCreateSchema>;

const nameRegex = /^[A-Za-zА-Яа-яІіЇїЄєҐґЁё'\-\s]+$/;

export const userUpdateSchema = z.object({
  full_name: z
    .string()
    .min(2, "Мінімум 2 символи")
    .max(255, "Максимум 255 символів")
    .regex(nameRegex, "Лише літери, пробіли, апостроф та дефіс"),
  phone: z
    .string()
    .regex(phoneRegex, "Формат: +380XXXXXXXXX"),
  email: z.string().email("Некоректний email"),
});

export type UserUpdateFormValues = z.infer<typeof userUpdateSchema>;

export const registerSchema = z.object({
  full_name: z
    .string()
    .min(2, "Мінімум 2 символи")
    .max(255, "Максимум 255 символів")
    .regex(nameRegex, "Лише літери, пробіли, апостроф та дефіс"),
  email: z.string().email("Некоректний email"),
  phone: z
    .string()
    .min(1, "Вкажіть телефон")
    .regex(phoneRegex, "Формат: +380XXXXXXXXX"),
  password: z.string().min(6, "Мінімум 6 символів").max(128, "Максимум 128 символів"),
});

export type RegisterFormValues = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().min(1, "Вкажіть email").email("Некоректний email"),
  password: z.string().min(1, "Вкажіть пароль"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const reviewCreateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional().or(z.literal("")),
});

export type ReviewCreateFormValues = z.infer<typeof reviewCreateSchema>;
