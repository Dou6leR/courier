import { api } from "@/lib/api";
import type { SupportContact } from "../types";

export const supportApi = {
  getContact: () =>
    api.get<SupportContact>("/support/contact").then((r) => r.data),
};
